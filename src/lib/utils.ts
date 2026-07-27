// Hunter AI — 工具函数
import { clsx, type ClassValue } from 'clsx';
import { marked } from 'marked';

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatDateShort(ts: number): string {
  return new Date(ts).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

export function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return '刚刚';
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`;
  return formatDateShort(ts);
}

export function renderMarkdown(md: string): string {
  marked.setOptions({ breaks: true, gfm: true });
  return marked.parse(md) as string;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function downloadText(filename: string, content: string, mime = 'text/plain'): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * 简单的 toast 提示（避免引入额外库）
 */
export function toast(msg: string, type: 'info' | 'success' | 'error' = 'info'): void {
  const el = document.createElement('div');
  el.className = `fixed left-4 right-4 md:left-auto md:right-6 bottom-24 md:bottom-6 z-[60] px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium animate-glow max-w-sm mx-auto md:mx-0 ${
    type === 'success' ? 'bg-accent text-ink-900' :
    type === 'error' ? 'bg-red-500 text-white' :
    'bg-ink-700 text-ink-300 border border-ink-600'
  }`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.3s';
    setTimeout(() => el.remove(), 300);
  }, 2200);
}
