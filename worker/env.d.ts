// Cloudflare Workers 类型声明（最小集，避免引入 @cloudflare/workers-types）
// 如需完整类型，可执行：npm i -D @cloudflare/workers-types

declare interface KVNamespace {
  get(key: string, options?: { type?: 'text' | 'json' | 'arrayBuffer' | 'stream' }): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number; metadata?: unknown }): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
    keys: { name: string; expiration?: number; metadata?: unknown }[];
    list_complete: boolean;
    cursor?: string;
  }>;
}

declare interface Env {
  AI_GATEWAY_PROVIDER: string;
  AI_GATEWAY_API_KEY: string;
  AI_GATEWAY_BASE_URL?: string;
  AI_GATEWAY_MODEL?: string;
  TRIAL_DAILY_QUOTA_PER_IP: string;
  TRIAL_KV: KVNamespace;
}
