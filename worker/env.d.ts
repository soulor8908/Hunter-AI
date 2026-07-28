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

// Vectorize 最小类型声明
declare interface VectorizeVector {
  id: string;
  values: number[];
  metadata?: Record<string, unknown>;
}
declare interface VectorizeMatches {
  matches: Array<{
    vectorId: string;
    score: number;
    vector?: VectorizeVector;
  }>;
  count: number;
}
declare interface VectorizeIndex {
  insert(vectors: VectorizeVector[]): Promise<void>;
  upsert(vectors: VectorizeVector[]): Promise<void>;
  deleteByIds(ids: string[]): Promise<void>;
  query(query: number[], options?: { topK?: number; returnMetadata?: boolean; returnValues?: boolean; filter?: Record<string, unknown> }): Promise<VectorizeMatches>;
  describe(): Promise<{ dimension: number; metric: string; index_name: string; uuid: string }>;
}

// Fetcher (用于 ASSETS binding)
declare interface Fetcher {
  fetch(request: Request): Promise<Response>;
}

declare interface Env {
  AI_GATEWAY_PROVIDER: string;
  AI_GATEWAY_API_KEY: string;
  AI_GATEWAY_BASE_URL?: string;
  AI_GATEWAY_MODEL?: string;
  TRIAL_DAILY_QUOTA_PER_IP: string;
  TRIAL_KV: KVNamespace;
  // Embedding（共享池 + Trial embedding 代理）
  EMBEDDING_PROVIDER?: string;     // 默认 openai
  EMBEDDING_BASE_URL?: string;     // 默认 https://api.openai.com/v1
  EMBEDDING_API_KEY?: string;      // 默认复用 AI_GATEWAY_API_KEY
  EMBEDDING_MODEL?: string;        // 默认 text-embedding-3-small
  // Vectorize 共享 JD 池
  JD_INDEX?: VectorizeIndex;
  // Static Assets（前端 SPA 托管）
  ASSETS: Fetcher;
}

