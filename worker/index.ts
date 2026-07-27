// Hunter AI — Cloudflare Worker
// Trial 模式 AI 代理 + 按 IP 限制每日配额
// 仅在用户未自带 API Key 时降级使用
// 架构参考 devpath-ai：边缘部署，零信任

interface Env {
  AI_GATEWAY_PROVIDER: string;     // 'deepseek' | 'openai' | 'anthropic'
  AI_GATEWAY_API_KEY: string;
  AI_GATEWAY_BASE_URL?: string;
  AI_GATEWAY_MODEL?: string;
  TRIAL_DAILY_QUOTA_PER_IP: string; // 数字字符串
  // 配额存储：用 KV（需在 wrangler.toml 绑定）
  TRIAL_KV: KVNamespace;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(req.url);

    // 健康检查
    if (url.pathname === '/api/health') {
      return json({ ok: true, ts: Date.now() }, 200);
    }

    // 配额查询
    if (url.pathname === '/api/quota') {
      const ip = getClientIP(req);
      const used = await getUsed(env, ip);
      const limit = parseInt(env.TRIAL_DAILY_QUOTA_PER_IP || '20');
      return json({ used, limit, remaining: Math.max(0, limit - used) }, 200);
    }

    // AI 代理
    if (url.pathname === '/api/ai/chat') {
      if (req.method !== 'POST') {
        return json({ error: 'Method not allowed' }, 405);
      }

      const ip = getClientIP(req);

      // 配额检查
      const limit = parseInt(env.TRIAL_DAILY_QUOTA_PER_IP || '20');
      const used = await getUsed(env, ip);
      if (used >= limit) {
        return json({ error: '每日 Trial 配额已用尽，请配置自己的 API Key' }, 429);
      }

      let body: { messages: ChatMessage[] };
      try {
        body = await req.json();
      } catch {
        return json({ error: 'Invalid JSON' }, 400);
      }

      if (!body.messages?.length) {
        return json({ error: 'messages required' }, 400);
      }

      // 流式转发到上游
      try {
        const upstream = await callUpstream(env, body.messages, true);

        // 增加配额
        await incUsed(env, ip);

        // 透传 SSE
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

    return json({ error: 'Not found', path: url.pathname }, 404);
  }
};

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
