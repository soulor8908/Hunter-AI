// Hunter AI — 轻量可观测性
// 当前实现：结构化 console.error + 预留 /api/log 上报通道（默认禁用，避免泄露用户数据）
//
// 设计权衡：本地优先架构下，用户数据归用户所有，默认不上报任何内容到服务器。
// 仅当用户显式开启遥测（Settings 中 toggle）时，才通过 /api/log 上报错误堆栈。
// 这与零信任原则一致：错误上报本身也不应成为隐私泄露通道。

export interface ErrorReport {
  /** 事件类型，如 'render_error' / 'async_error' / 'worker_error' */
  evt: string;
  msg: string;
  stack?: string;
  /** 附加元信息（不含用户数据） */
  meta?: Record<string, string | number | boolean>;
  ts: number;
}

/** 是否启用远端上报。默认 false，需用户在 Settings 显式开启。 */
let telemetryEnabled = false;

export function setTelemetryEnabled(enabled: boolean): void {
  telemetryEnabled = enabled;
}

/**
 * 上报错误。
 * - 始终写入 console（便于本地排障）
 * - 仅在 telemetryEnabled 时通过 beacon 上报 /api/log（不阻塞、不重试）
 */
export function reportError(report: Omit<ErrorReport, 'ts'>): void {
  const full: ErrorReport = { ...report, ts: Date.now() };

  // 本地结构化日志
  console.error('[telemetry]', JSON.stringify(full));

  // 远端上报（仅在用户开启时）
  if (telemetryEnabled && typeof navigator !== 'undefined' && navigator.sendBeacon) {
    try {
      const blob = new Blob([JSON.stringify(full)], { type: 'application/json' });
      navigator.sendBeacon('/api/log', blob);
    } catch {
      // sendBeacon 失败不阻塞，已写 console
    }
  }
}

/** 便捷封装：从 Error 对象构造上报 */
export function reportFromError(evt: string, err: Error, meta?: Record<string, string | number | boolean>): void {
  reportError({
    evt,
    msg: err.message,
    stack: err.stack?.slice(0, 1000),
    meta
  });
}
