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

// 默认 Worker 端点（部署后填入）
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
