// Hunter AI — AI 调用层
// 三层降级：用户自带 Key（零信任）→ Trial 配额（Worker 代理）→ 错误提示
// 流式优先：所有 chat 走 SSE
import type { AISettings, AIProvider } from '@/types';

const PROVIDER_BASE_URL: Record<Exclude<AIProvider, 'trial'>, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  deepseek: 'https://api.deepseek.com/v1'
};

const PROVIDER_DEFAULT_MODEL: Record<Exclude<AIProvider, 'trial'>, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-sonnet-20240620',
  deepseek: 'deepseek-chat'
};

// 已部署的 Trial Worker（Cloudflare）
// - 生产环境：前后端同域（Worker + Static Assets），直接用相对路径 /api/ai
// - 开发环境：用 VITE_TRIAL_WORKER_URL 指向远程 Worker，或保持默认 workers.dev
// - 老部署：可用 VITE_TRIAL_WORKER_URL 覆盖
const TRIAL_WORKER_URL = import.meta.env.VITE_TRIAL_WORKER_URL ?? '/api/ai';

export interface ChatTurn {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onDone: (full: string) => void;
  onError: (err: Error) => void;
}

/**
 * 流式聊天。根据 provider 走不同路径。
 */
export async function streamChat(
  messages: ChatTurn[],
  settings: AISettings,
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  try {
    if (settings.provider === 'trial') {
      await streamViaWorker(messages, callbacks, signal);
    } else {
      await streamViaOwnKey(messages, settings, callbacks, signal);
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') return;
    callbacks.onError(err as Error);
  }
}

/**
 * 用户自带 Key：直接浏览器 → AI 提供商，Key 不离开浏览器（零信任）
 * Anthropic 用原生 messages API；OpenAI/DeepSeek 用 chat/completions
 */
async function streamViaOwnKey(
  messages: ChatTurn[],
  settings: AISettings,
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const provider = settings.provider as Exclude<AIProvider, 'trial'>;
  const baseUrl = settings.baseUrl?.replace(/\/$/, '') || PROVIDER_BASE_URL[provider];
  const model = settings.model || PROVIDER_DEFAULT_MODEL[provider];

  if (!settings.apiKey) {
    throw new Error('未配置 API Key。请在「设置」中填写，或切换到 Trial 模式。');
  }

  if (provider === 'anthropic') {
    await streamAnthropic(baseUrl, model, settings.apiKey, messages, settings.temperature, callbacks, signal);
  } else {
    await streamOpenAICompatible(baseUrl, model, settings.apiKey, messages, settings.temperature, callbacks, signal);
  }
}

async function streamOpenAICompatible(
  baseUrl: string,
  model: string,
  apiKey: string,
  messages: ChatTurn[],
  temperature: number,
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      stream: true
    }),
    signal
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    throw new Error(`AI 请求失败 (${res.status}): ${text.slice(0, 200)}`);
  }

  await readSSE(res.body, (data) => {
    if (data === '[DONE]') return;
    try {
      const json = JSON.parse(data);
      const token = json.choices?.[0]?.delta?.content;
      if (token) callbacks.onToken(token);
    } catch {
      // 忽略 keep-alive
    }
  }, callbacks);
}

async function streamAnthropic(
  baseUrl: string,
  model: string,
  apiKey: string,
  messages: ChatTurn[],
  temperature: number,
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const systemMsg = messages.find((m) => m.role === 'system')?.content;
  const turns = messages.filter((m) => m.role !== 'system');

  const res = await fetch(`${baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      system: systemMsg,
      messages: turns.map((m) => ({ role: m.role, content: m.content })),
      temperature,
      max_tokens: 4096,
      stream: true
    }),
    signal
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    throw new Error(`Anthropic 请求失败 (${res.status}): ${text.slice(0, 200)}`);
  }

  await readSSE(res.body, (data) => {
    try {
      const json = JSON.parse(data);
      if (json.type === 'content_block_delta' && json.delta?.text) {
        callbacks.onToken(json.delta.text);
      }
    } catch {
      // ignore
    }
  }, callbacks);
}

/**
 * Trial 模式：通过 Cloudflare Worker 代理，按 IP 配额限制
 */
async function streamViaWorker(
  messages: ChatTurn[],
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(`${TRIAL_WORKER_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
    signal
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    if (res.status === 429) {
      throw new Error('Trial 每日配额已用尽。请在「设置」中配置自己的 API Key。');
    }
    throw new Error(`Trial 请求失败 (${res.status}): ${text.slice(0, 200)}`);
  }

  await readSSE(res.body, (data) => {
    try {
      const json = JSON.parse(data);
      if (json.token) callbacks.onToken(json.token);
      if (json.error) throw new Error(json.error);
    } catch (e) {
      // 可能是纯文本 token
      if (data.trim() && !data.startsWith('{')) callbacks.onToken(data);
    }
  }, callbacks);
}

/**
 * 通用 SSE 读取器
 */
async function readSSE(
  body: ReadableStream<Uint8Array>,
  onData: (data: string) => void,
  callbacks: StreamCallbacks
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data) {
            onData(data);
            // 累积完整文本（简单实现，主要给 onDone 用）
            try {
              const json = JSON.parse(data);
              const token = json.choices?.[0]?.delta?.content || json.delta?.text || json.token;
              if (token) full += token;
            } catch {
              // ignore
            }
          }
        }
      }
    }
    callbacks.onDone(full);
  } finally {
    reader.releaseLock();
  }
}

/**
 * 非流式调用（用于结构化 JSON 输出，如 JD 分析、面试题生成）
 */
export async function chatJSON(
  messages: ChatTurn[],
  settings: AISettings,
  signal?: AbortSignal
): Promise<string> {
  return new Promise((resolve, reject) => {
    let full = '';
    streamChat(
      messages,
      settings,
      {
        onToken: (t) => { full += t; },
        onDone: () => resolve(stripJSON(full)),
        onError: reject
      },
      signal
    );
  });
}

/**
 * 从可能含 markdown 代码块包裹的输出中提取 JSON
 */
export function stripJSON(text: string): string {
  // 去掉 ```json ... ``` 包裹
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  // 找第一个 { 或 [ 到最后一个 } 或 ]
  const start = text.search(/[{[]/);
  if (start === -1) return text.trim();
  const lastBrace = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
  return text.slice(start, lastBrace + 1).trim();
}

// ============ Embedding（用于 JD 匹配推荐） ============

const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';
const DEFAULT_EMBEDDING_DIM = 1536;

/**
 * 判断当前配置能否在浏览器直调 embedding（OpenAI 兼容）
 */
export function canEmbedLocally(settings: AISettings): boolean {
  if (settings.provider === 'openai') return true;
  // 自定义 baseUrl 指向 OpenAI 兼容服务时也可
  if (settings.embeddingBaseUrl) return true;
  return false;
}

/**
 * 计算 embedding。
 * - openai / 自定义 embeddingBaseUrl：浏览器直调（零信任，key 不离开浏览器）
 * - trial / 其他无 embedding 的 provider：走 Worker 代理
 *   Worker 端 AI_GATEWAY 必须配 OpenAI 兼容的 embedding 服务
 */
export async function embed(
  texts: string[],
  settings: AISettings,
  signal?: AbortSignal
): Promise<number[][]> {
  const inputs = texts.map(t => t.trim()).filter(Boolean);
  if (inputs.length === 0) return [];

  if (canEmbedLocally(settings)) {
    return embedViaOwnKey(inputs, settings, signal);
  }
  // 降级：Worker 代理（trial 模式或 anthropic/deepseek 用户）
  return embedViaWorker(inputs, signal);
}

async function embedViaOwnKey(
  texts: string[],
  settings: AISettings,
  signal?: AbortSignal
): Promise<number[][]> {
  const baseUrl = (settings.embeddingBaseUrl ?? settings.baseUrl ?? PROVIDER_BASE_URL.openai).replace(/\/$/, '');
  const url = `${baseUrl}/embeddings`;
  const model = settings.embeddingModel ?? DEFAULT_EMBEDDING_MODEL;
  const apiKey = settings.embeddingApiKey ?? settings.apiKey;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({ model, input: texts }),
    signal
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Embedding 失败 (${res.status})：${detail.slice(0, 200)}`);
  }
  const data = await res.json();
  return (data.data as Array<{ embedding: number[] }>)
    .sort((a, b) => 0) // 顺序保证由 API 保证
    .map(d => d.embedding);
}

async function embedViaWorker(texts: string[], signal?: AbortSignal): Promise<number[][]> {
  // Worker 端点：/api/embedding
  const workerBase = TRIAL_WORKER_URL.replace(/\/api\/ai\/?$/, '/api');
  const res = await fetch(`${workerBase}/embedding`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts }),
    signal
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Worker embedding 失败 (${res.status})：${detail.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.embeddings as number[][];
}

export const EMBEDDING_DIM = DEFAULT_EMBEDDING_DIM;

// ============ 共享池（阶段二：Vectorize） ============

export interface UploadToSharedPoolArgs {
  jobTitle: string;
  company: string;
  city?: string;
  salary?: string;
  jdText: string;
  embedding: number[];
}

/**
 * 上传 JD 到共享池（Vectorize）。
 * 只上传 embedding + metadata，不上传完整 jdText（隐私：JD 本身公开，但谁在看是隐私）。
 */
export async function uploadToSharedPool(args: UploadToSharedPoolArgs, signal?: AbortSignal): Promise<{ id: string } | null> {
  const workerBase = TRIAL_WORKER_URL.replace(/\/api\/ai\/?$/, '/api');
  try {
    const res = await fetch(`${workerBase}/jd/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      signal
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null; // 静默失败，共享池是 nice-to-have
  }
}

/**
 * 从共享池查 top-K 匹配 JD。
 */
export async function querySharedPool(
  profileEmbedding: number[],
  topK = 20,
  signal?: AbortSignal
): Promise<Array<{ id: string; score: number; jobTitle: string; company: string; city?: string; salary?: string }>> {
  const workerBase = TRIAL_WORKER_URL.replace(/\/api\/ai\/?$/, '/api');
  try {
    const res = await fetch(`${workerBase}/match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embedding: profileEmbedding, topK }),
      signal
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.matches ?? [];
  } catch {
    return []; // 静默失败
  }
}
