// Hunter AI — Cloudflare Worker
// Trial 模式 AI 代理 + 按 IP 限制每日配额
// 仅在用户未自带 API Key 时降级使用
// 架构参考 devpath-ai：边缘部署，零信任

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * CORS：默认同源（生产环境前后端同域）。
 * 开发/第三方接入可通过 env.ALLOWED_ORIGINS（逗号分隔）扩展白名单。
 * 不再使用 '*'，避免被任意网站当作免费 AI 代理消耗配额。
 */
function corsHeaders(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  // 同源：Origin 与请求 Host 一致
  const host = req.headers.get('Host') || '';
  let allow = false;
  if (origin) {
    if (allowed.includes(origin)) allow = true;
    else if (new URL(origin).host === host) allow = true;
  }
  return {
    'Access-Control-Allow-Origin': allow ? origin : '',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
}

const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIM = 1536;

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(req, env);
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    const url = new URL(req.url);

    // 辅助：带 CORS 的 JSON 响应
    const jsonCORS = (data: unknown, status = 200): Response =>
      new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...cors }
      });

    // 非后端 API 路径由 ASSETS 托管（前端 SPA + 静态资源）
    // wrangler.toml [assets] 配置了 not_found_handling = "single-page-application"
    // 但当 Worker 声明 ASSETS binding 时，所有请求默认由 Worker 处理
    // 所以这里显式把非 /api 请求委托给 ASSETS
    if (!url.pathname.startsWith('/api/')) {
      // 仅对 CORS 预检在此处已处理；非 OPTIONS 的静态请求交给 ASSETS
      if (req.method === 'GET' || req.method === 'HEAD') {
        return env.ASSETS.fetch(req);
      }
      // POST/PUT/DELETE 等打到非 /api 路径，直接 404
      return jsonCORS({ error: 'Not found', path: url.pathname }, 404);
    }

    // 健康检查
    if (url.pathname === '/api/health') {
      return jsonCORS({ ok: true, ts: Date.now(), vectorize: !!env.JD_INDEX }, 200);
    }

    // 配额查询
    if (url.pathname === '/api/quota') {
      const ip = getClientIP(req);
      const used = await getUsed(env, ip);
      const limit = parseInt(env.TRIAL_DAILY_QUOTA_PER_IP || '20');
      return jsonCORS({ used, limit, remaining: Math.max(0, limit - used) }, 200);
    }

    // AI 代理（chat）
    if (url.pathname === '/api/ai/chat') {
      if (req.method !== 'POST') return jsonCORS({ error: 'Method not allowed' }, 405);

      const ip = getClientIP(req);
      const limit = parseInt(env.TRIAL_DAILY_QUOTA_PER_IP || '20');
      const used = await getUsed(env, ip);
      if (used >= limit) {
        return jsonCORS({ error: '每日 Trial 配额已用尽，请配置自己的 API Key' }, 429);
      }

      let body: { messages: ChatMessage[] };
      try { body = await req.json(); } catch { return jsonCORS({ error: 'Invalid JSON' }, 400); }
      if (!body.messages?.length) return jsonCORS({ error: 'messages required' }, 400);

      try {
        const upstream = await callUpstream(env, body.messages, true);
        await incUsed(env, ip);
        return new Response(upstream.body, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            ...cors
          }
        });
      } catch (e) {
        return jsonCORS({ error: (e as Error).message }, 502);
      }
    }

    // Embedding 代理（Trial 用户 / 非 OpenAI provider 用）
    if (url.pathname === '/api/embedding') {
      if (req.method !== 'POST') return jsonCORS({ error: 'Method not allowed' }, 405);
      const ip = getClientIP(req);
      // 共享配额池，避免滥用
      const limit = parseInt(env.TRIAL_DAILY_QUOTA_PER_IP || '20');
      const used = await getUsed(env, ip);
      if (used >= limit) {
        return jsonCORS({ error: '每日 Trial 配额已用尽' }, 429);
      }
      let body: { texts: string[] };
      try { body = await req.json(); } catch { return jsonCORS({ error: 'Invalid JSON' }, 400); }
      if (!body.texts?.length) return jsonCORS({ error: 'texts required' }, 400);

      try {
        const embeddings = await embedViaUpstream(env, body.texts);
        await incUsed(env, ip);
        return jsonCORS({ embeddings }, 200);
      } catch (e) {
        return jsonCORS({ error: (e as Error).message }, 502);
      }
    }

    // JD 链接抓取：从招聘网站 URL 提取 JD 正文
    if (url.pathname === '/api/jd/fetch') {
      if (req.method !== 'POST') return jsonCORS({ error: 'Method not allowed' }, 405);

      let body: { url?: string };
      try { body = await req.json(); } catch { return jsonCORS({ error: 'Invalid JSON' }, 400); }

      if (!body.url) return jsonCORS({ error: '缺少 url 参数' }, 400);

      let targetUrl: URL;
      try {
        targetUrl = new URL(body.url);
      } catch {
        return jsonCORS({ error: 'URL 格式无效' }, 400);
      }
      if (!['http:', 'https:'].includes(targetUrl.protocol)) {
        return jsonCORS({ error: '仅支持 http/https 协议' }, 400);
      }
      // SSRF 防护：禁止抓取内网/保留地址（云元数据、本机、私有网段）
      if (isDisallowedHost(targetUrl.hostname)) {
        return jsonCORS({ error: '目标地址不被允许（内网/保留地址）' }, 400);
      }

      try {
        const resp = await fetch(targetUrl.toString(), {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
          },
          redirect: 'follow'
        });

        if (!resp.ok) {
          return jsonCORS({ error: `目标站点返回 ${resp.status}` }, 502);
        }

        const html = await resp.text();
        const extracted = extractJDFromHTML(html, targetUrl.hostname);
        return jsonCORS(extracted, 200);
      } catch (e) {
        return jsonCORS({ error: `抓取失败：${(e as Error).message}` }, 502);
      }
    }

    // 共享池：上传 JD 向量
    if (url.pathname === '/api/jd/import') {
      if (req.method !== 'POST') return jsonCORS({ error: 'Method not allowed' }, 405);
      if (!env.JD_INDEX) return jsonCORS({ error: 'Vectorize 未配置' }, 501);

      let body: {
        jobTitle: string;
        company: string;
        city?: string;
        salary?: string;
        jdText: string;
        embedding: number[];
      };
      try { body = await req.json(); } catch { return jsonCORS({ error: 'Invalid JSON' }, 400); }

      if (!body.embedding || body.embedding.length !== EMBEDDING_DIM) {
        return jsonCORS({ error: `embedding 必须为 ${EMBEDDING_DIM} 维` }, 400);
      }
      if (!body.jobTitle || !body.company) {
        return jsonCORS({ error: 'jobTitle 和 company 必填' }, 400);
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
        return jsonCORS({ id }, 200);
      } catch (e) {
        return jsonCORS({ error: (e as Error).message }, 502);
      }
    }

    // 共享池：查询匹配
    if (url.pathname === '/api/match') {
      if (req.method !== 'POST') return jsonCORS({ error: 'Method not allowed' }, 405);
      if (!env.JD_INDEX) return jsonCORS({ error: 'Vectorize 未配置' }, 501);

      let body: { embedding: number[]; topK?: number };
      try { body = await req.json(); } catch { return jsonCORS({ error: 'Invalid JSON' }, 400); }

      if (!body.embedding || body.embedding.length !== EMBEDDING_DIM) {
        return jsonCORS({ error: `embedding 必须为 ${EMBEDDING_DIM} 维` }, 400);
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
        return jsonCORS({ matches }, 200);
      } catch (e) {
        return jsonCORS({ error: (e as Error).message }, 502);
      }
    }

    return jsonCORS({ error: 'Not found', path: url.pathname }, 404);
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

/**
 * SSRF 防护：拒绝指向内网/保留地址的 hostname。
 * Worker 无法预解析 DNS，因此对 IP 字面量和已知元数据 hostname 做硬过滤；
 * 同时拒绝 localhost / *.local / *.internal 等保留名。
 */
function isDisallowedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) {
    return true;
  }
  // 云元数据 endpoint 字面量
  const META_HOSTS = ['169.254.169.254', 'metadata.google.internal', 'metadata.azure.com', '169.254.170.2'];
  if (META_HOSTS.includes(h)) return true;
  // IPv4 字面量
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [parseInt(m[1]), parseInt(m[2])];
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;        // link-local / 元数据
    if (a === 172 && b >= 16 && b <= 31) return true; // 私有
    if (a === 192 && b === 168) return true;          // 私有
    if (a >= 224) return true;                        // 组播/保留
  }
  // IPv6 回环 / 私有
  if (h === '::1' || h === '::' || h === '0:0:0:0:0:0:0:1') return true;
  if (h.startsWith('fc') || h.startsWith('fd')) return true; // unique local
  if (h.startsWith('fe80')) return true;                      // link-local
  return false;
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

/**
 * 从 HTML 中提取 JD 相关信息（岗位标题、公司、正文）。
 * Worker 无 DOM 环境，用正则做轻量解析。
 * 策略：先清理 script/style/nav，再提取 title/meta，最后取 body 文本。
 */
function extractJDFromHTML(html: string, hostname: string): { title: string; company: string; content: string; source: string } {
  // 1. 清理无关标签
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '');

  // 2. 提取 <title>
  let title = '';
  const titleMatch = cleaned.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) title = decodeEntities(titleMatch[1].trim());

  // 3. 提取 meta description / keywords
  let metaDesc = '';
  const descMatch = cleaned.match(/<meta\s+[^>]*?(?:name|property)=["'](?:description|og:description)["'][^>]*?content=["']([^"']+)["']/i);
  if (descMatch) metaDesc = decodeEntities(descMatch[1].trim());

  // 4. 提取 og:title（通常更干净）
  const ogTitleMatch = cleaned.match(/<meta\s+[^>]*?property=["']og:title["'][^>]*?content=["']([^"']+)["']/i);
  if (ogTitleMatch && !title) title = decodeEntities(ogTitleMatch[1].trim());

  // 5. 提取 body 文本
  let bodyText = '';
  const bodyMatch = cleaned.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyHTML = bodyMatch ? bodyMatch[1] : cleaned;

  // 把块级标签转为换行，保留结构
  bodyText = bodyHTML
    .replace(/<(?:p|div|li|h[1-6]|tr|br|hr)[^>]*>/gi, '\n')
    .replace(/<\/(?:p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')          // 移除所有剩余标签
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&[a-z]+;/gi, '')         // 其它实体
    .replace(/\n{3,}/g, '\n\n')        // 合并多余空行
    .replace(/[ \t]+/g, ' ')           // 合并空格
    .trim();

  // 6. 截断过长内容（避免 Token 爆炸）
  if (bodyText.length > 8000) {
    bodyText = bodyText.slice(0, 8000) + '\n...(内容已截断)';
  }

  // 7. 从 title 推测岗位名和公司
  let company = '';
  let jobTitle = title;
  // 常见模式："岗位名-公司名-招聘网站名"
  const parts = title.split(/[-_|·]/).map(s => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    jobTitle = parts[0];
    // 排除招聘网站名
    const siteNames = ['boss直聘', '拉勾', '智联招聘', '前程无忧', '猎聘', 'linkedin', ' github', 'indeed'];
    for (let i = 1; i < parts.length; i++) {
      if (!siteNames.some(s => parts[i].toLowerCase().includes(s))) {
        company = parts[i];
        break;
      }
    }
  }

  return {
    title: jobTitle || metaDesc.slice(0, 50) || '未知岗位',
    company,
    content: bodyText || metaDesc || '(无法提取正文，可能是 SPA 页面)',
    source: hostname
  };
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&[a-z]+;/gi, '')
    .trim();
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
