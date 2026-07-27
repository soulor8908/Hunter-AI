/// <reference types="vite/client" />

// PWA 注册模块声明
declare module 'virtual:pwa-register' {
  export interface RegisterSWOptions {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
    onRegisterError?: (error: unknown) => void;
  }
  export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void>;
}

// import.meta.env 类型补充
interface ImportMetaEnv {
  readonly VITE_DEFAULT_AI_PROVIDER?: string;
  readonly VITE_DEFAULT_AI_MODEL?: string;
  readonly VITE_TRIAL_WORKER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
