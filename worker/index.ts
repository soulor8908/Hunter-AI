// Hunter AI — Cloudflare Worker
// Trial 模式 AI 代理 + 按 IP 限制每日配额
// 仅在用户未自带 API Key 时降级使用
// 架构参考 devpath-ai：边缘部署，零信任

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIM = 1536;

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(req.url);

    // 健康检查
    if (url.pathname === '/api/health') {
      return json({ ok: true, ts: Date.now(), vectorize: !!env.JD_INDEX }, 200);
    }

    // 配额查询
    if (url.pathname === '/api/quota') {
      const ip = getClientIP(req);
      const used = await getUsed(env, ip);
      const limit = parseInt(env.TRIAL_DAILY_QUOTA_PER_IP || '20');
      return json({ used, limit, remaining: Math.max(0, limit - used) }, 200);
    }

    // AI 代理（chat）
    if (url.pathname === '/api/ai/chat') {
      if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

      const ip = getClientIP(req);
      const limit = parseInt(env.TRIAL_DAILY_QUOTA_PER_IP || '20');
      const used = await getUsed(env, ip);
      if (used >= limit) {
        return json({ error: '每日 Trial 配额已用尽，请配置自己的 API Key' }, 429);
      }

      let body: { messages: ChatMessage[] };
      try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
      if (!body.messages?.length) return json({ error: 'messages required' }, 400);

      try {
        const upstream = await callUpstream(env, body.messages, true);
        await incUsed(env, ip);
        return new Response(upstream.body, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            ...CORS_HEADERS
          }
        });
      } catch (e) {
        return json({ error: (e as Error).message }, 502);
      }
    }

    // Embedding 代理（Trial 用户 / 非 OpenAI provider 用）
    if (url.pathname === '/api/embedding') {
      if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
      const ip = getClientIP(req);
      // 共享配额池，避免滥用
      const limit = parseInt(env.TRIAL_DAILY_QUOTA_PER_IP || '20');
      const used = await getUsed(env, ip);
      if (used >= limit) {
        return json({ error: '每日 Trial 配额已用尽' }, 429);
      }
      let body: { texts: string[] };
      try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
      if (!body.texts?.length) return json({ error: 'texts required' }, 400);

      try {
        const embeddings = await embedViaUpstream(env, body.texts);
        await incUsed(env, ip);
        return json({ embeddings }, 200);
      } catch (e) {
        return json({ error: (e as Error).message }, 502);
      }
    }

    // 共享池：上传 JD 向量
    if (url.pathname === '/api/jd/import') {
      if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
      if (!env.JD_INDEX) return json({ error: 'Vectorize 未配置' }, 501);

      let body: {
        jobTitle: string;
        company: string;
        city?: string;
        salary?: string;
        jdText: string;
        embedding: number[];
      };
      try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

      if (!body.embedding || body.embedding.length !== EMBEDDING_DIM) {
        return json({ error: `embedding 必须为 ${EMBEDDING_DIM} 维` }, 400);
      }
      if (!body.jobTitle || !body.company) {
        return json({ error: 'jobTitle 和 company 必填' }, 400);
      }

      // 用 ip + timestamp 生成不可逆 id（不存原始用户标识）
      const ip = getClientIP(req);
      const id = `jd_${hashStr(ip + body.company + body.jobTitle + Date.now())}`;

      try {
        await env.JD_INDEX.upsert([{
          id,
          values: body.embedding,
          metadata: {
            jobTitle: body.jobTitle.slice(0, 100),
            company: body.company.slice(0, 100),
            city: (body.city ?? '').slice(0, 50),
            salary: (body.salary ?? '').slice(0, 50),
            // 不存完整 jdText，保护上传者隐私
            uploadedAt: Date.now()
          }
        }]);
        return json({ id }, 200);
      } catch (e) {
        return json({ error: (e as Error).message }, 502);
      }
    }

    // 共享池：查询匹配
    if (url.pathname === '/api/match') {
      if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
      if (!env.JD_INDEX) return json({ error: 'Vectorize 未配置' }, 501);

      let body: { embedding: number[]; topK?: number };
      try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

      if (!body.embedding || body.embedding.length !== EMBEDDING_DIM) {
        return json({ error: `embedding 必须为 ${EMBEDDING_DIM} 维` }, 400);
      }

      const topK = Math.min(Math.max(body.topK ?? 20, 1), 50);

      try {
        const result = await env.JD_INDEX.query(body.embedding, {
          topK,
          returnMetadata: true,
          returnValues: false
        });
        const matches = (result.matches ?? []).map(m => ({
          id: m.vectorId,
          score: m.score,
          jobTitle: String(m.vector?.metadata?.jobTitle ?? ''),
          company: String(m.vector?.metadata?.company ?? ''),
          city: m.vector?.metadata?.city ? String(m.vector.metadata.city) : undefined,
          salary: m.vector?.metadata?.salary ? String(m.vector.metadata.salary) : undefined
        }));
        return json({ matches }, 200);
      } catch (e) {
        return json({ error: (e as Error).message }, 502);
      }
    }

    return json({ error: 'Not found', path: url.pathname }, 404);
  }
};

/**
 * 在 Worker 端调 OpenAI 兼容的 embedding API。
 * 必须配 EMBEDDING_API_KEY（或复用 AI_GATEWAY_API_KEY），且上游服务支持 /embeddings。
 */
async function embedViaUpstream(env: Env, texts: string[]): Promise<number[][]> {
  const baseUrl = (env.EMBEDDING_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, '');
  const apiKey = env.EMBEDDING_API_KEY ?? env.AI_GATEWAY_API_KEY;
  const model = env.EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL;

  if (!apiKey) throw new Error('Worker 未配置 EMBEDDING_API_KEY');

  const res = await fetch(`${baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({ model, input: texts })
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`embedding 上游失败 (${res.status})：${detail.slice(0, 200)}`);
  }
  const data = await res.json() as { data: Array<{ embedding: number[] }> };
  return data.data.map(d => d.embedding);
}

/** 简单 djb2 哈希，用于生成不可逆 id */
function hashStr(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) + s.charCodeAt(i);
    h = h & 0xffffffff;
  }
  return (h >>> 0).toString(36);
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  });
}

function getClientIP(req: Request): string {
  // Cloudflare 提供 CF-Connecting-IP
  return req.headers.get('CF-Connecting-IP') ||
         req.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
         'unknown';
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

async function getUsed(env: Env, ip: string): Promise<number> {
  const key = `quota:${ip}:${todayKey()}`;
  const v = await env.TRIAL_KV.get(key);
  return v ? parseInt(v) : 0;
}

async function incUsed(env: Env, ip: string): Promise<void> {
  const key = `quota:${ip}:${todayKey()}`;
  const used = await getUsed(env, ip);
  // KV 写入有最终一致性，配额可能略超，但 Trial 模式可接受
  await env.TRIAL_KV.put(key, String(used + 1), { expirationTtl: 86400 });
}

async function callUpstream(env: Env, messages: ChatMessage[], stream: boolean): Promise<Response> {
  const provider = env.AI_GATEWAY_PROVIDER || 'deepseek';
  const baseUrl = env.AI_GATEWAY_BASE_URL || ({
    openai: 'https://api.openai.com/v1',
    anthropic: 'https://api.anthropic.com/v1',
    deepseek: 'https://api.deepseek.com/v1'
  } as const)[provider as 'openai' | 'anthropic' | 'deepseek'];
  const model = env.AI_GATEWAY_MODEL || ({
    openai: 'gpt-4o-mini',
    anthropic: 'claude-3-5-sonnet-20240620',
    deepseek: 'deepseek-chat'
  } as const)[provider as 'openai' | 'anthropic' | 'deepseek'];

  if (provider === 'anthropic') {
    const systemMsg = messages.find(m => m.role === 'system')?.content;
    const turns = messages.filter(m => m.role !== 'system');
    return fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.AI_GATEWAY_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        system: systemMsg,
        messages: turns.map(m => ({ role: m.role, content: m.content })),
        max_tokens: 4096,
        temperature: 0.7,
        stream
      })
    });
  }

  // OpenAI / DeepSeek 兼容协议
  return fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.AI_GATEWAY_API_KEY}`
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      stream
    })
  });
}
