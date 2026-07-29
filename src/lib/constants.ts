// Hunter AI — 全局常量与共享工具
// 把散落在多处的 provider 默认值、stage 标签、requireSettings 统一到此，
// 避免三处手工同步与颜色/文案不一致

import type { AIProvider, AISettings, ApplicationStage } from '@/types';
import { toast } from '@/lib/utils';

// ============ AI Provider 默认值（前端唯一来源） ============
// worker/index.ts 的 callUpstream 有自己一份（环境变量默认值），那一份是 Worker 端兜底
export const PROVIDER_BASE_URL: Record<Exclude<AIProvider, 'trial'>, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  deepseek: 'https://api.deepseek.com/v1'
};

export const PROVIDER_DEFAULT_MODEL: Record<Exclude<AIProvider, 'trial'>, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-sonnet-20240620',
  deepseek: 'deepseek-chat'
};

export interface ProviderPreset {
  label: string;
  model: string;
  baseUrl: string;
  help: string;
}

export const PROVIDER_PRESET: Record<Exclude<AIProvider, 'trial'>, ProviderPreset> = {
  openai: {
    label: 'OpenAI',
    model: PROVIDER_DEFAULT_MODEL.openai,
    baseUrl: PROVIDER_BASE_URL.openai,
    help: 'https://platform.openai.com/api-keys'
  },
  anthropic: {
    label: 'Anthropic Claude',
    model: PROVIDER_DEFAULT_MODEL.anthropic,
    baseUrl: PROVIDER_BASE_URL.anthropic,
    help: 'https://console.anthropic.com/settings/keys'
  },
  deepseek: {
    label: 'DeepSeek 深度求索',
    model: PROVIDER_DEFAULT_MODEL.deepseek,
    baseUrl: PROVIDER_BASE_URL.deepseek,
    help: 'https://platform.deepseek.com/api_keys'
  }
};

// ============ 投递阶段标签（前端唯一来源） ============
// Dashboard 与 Tracking 共用，颜色/文案保持一致
export interface StageMeta {
  label: string;
  /** chip 文字色 + 背景色（用于 Dashboard 卡片） */
  color: string;
  /** 看板列顶部边框色 */
  border: string;
  /** 看板列标题左侧小圆点色 */
  dot: string;
}

export const STAGE_META: Record<ApplicationStage, StageMeta> = {
  planning:   { label: '准备中', color: 'text-ink-400 bg-ink-700',       border: 'border-ink-600',   dot: 'bg-ink-500'   },
  submitted:  { label: '已投递', color: 'text-blue-400 bg-blue-500/10',  border: 'border-blue-500',  dot: 'bg-blue-400'  },
  screening:  { label: '筛选中', color: 'text-amber-400 bg-amber-500/10',border: 'border-amber-500', dot: 'bg-amber-400' },
  interview:  { label: '面试中', color: 'text-purple-400 bg-purple-500/10', border: 'border-purple-500', dot: 'bg-purple-400' },
  offer:      { label: 'Offer',  color: 'text-accent bg-accent/10',      border: 'border-accent',    dot: 'bg-accent'    },
  rejected:   { label: '未通过', color: 'text-red-400 bg-red-500/10',    border: 'border-red-500',   dot: 'bg-red-400'   },
  withdrawn:  { label: '已撤回', color: 'text-ink-500 bg-ink-700',       border: 'border-ink-700',   dot: 'bg-ink-600'   }
};

/** 看板列顺序（Tracking 用） */
export const STAGE_ORDER: ApplicationStage[] = [
  'planning', 'submitted', 'screening', 'interview', 'offer', 'rejected', 'withdrawn'
];

// ============ requireSettings 统一工具 ============
// 各页面的 requireSettings 实现略有差异（有的跳转 settings，有的不跳），
// 这里统一为一个带可选跳转的版本
export interface RequireSettingsOptions {
  /** 校验失败时是否跳转到 /settings，默认 false */
  navigateToSettings?: boolean;
  /** 跳转函数（来自 useNavigate），navigateToSettings=true 时必传 */
  nav?: (to: string) => void;
}

/**
 * 校验 AI 设置是否可用。
 * - aiSettings 未加载：toast 提示，返回 false
 * - 非 trial 且无 apiKey：toast 提示（可选跳转 /settings），返回 false
 * - 通过：返回 true
 */
export function requireSettings(
  aiSettings: AISettings | null,
  opts: RequireSettingsOptions = {}
): aiSettings is AISettings {
  if (!aiSettings) {
    toast('AI 设置加载中，请稍候', 'error');
    return false;
  }
  if (aiSettings.provider !== 'trial' && !aiSettings.apiKey) {
    toast('请先在设置中配置 API Key', 'error');
    if (opts.navigateToSettings && opts.nav) {
      opts.nav('/settings');
    }
    return false;
  }
  return true;
}
