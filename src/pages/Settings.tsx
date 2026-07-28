import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import { getAISettings, saveAISettings } from '@/lib/db';
import { toast } from '@/lib/utils';
import { exportAll } from '@/lib/db';
import type { AIProvider } from '@/types';
import Icon from '@/components/Icon';

const PROVIDER_PRESET: Record<Exclude<AIProvider, 'trial'>, { label: string; model: string; baseUrl: string; help: string }> = {
  openai: { label: 'OpenAI', model: 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1', help: 'https://platform.openai.com/api-keys' },
  anthropic: { label: 'Anthropic Claude', model: 'claude-3-5-sonnet-20240620', baseUrl: 'https://api.anthropic.com/v1', help: 'https://console.anthropic.com/settings/keys' },
  deepseek: { label: 'DeepSeek 深度求索', model: 'deepseek-chat', baseUrl: 'https://api.deepseek.com/v1', help: 'https://platform.deepseek.com/api_keys' }
};

export default function Settings() {
  const aiSettings = useStore((s) => s.aiSettings);
  const updateAISettings = useStore((s) => s.updateAISettings);
  const initAISettings = useStore((s) => s.initAISettings);
  const [form, setForm] = useState(aiSettings);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!aiSettings) initAISettings();
  }, [aiSettings, initAISettings]);

  useEffect(() => {
    setForm(aiSettings);
  }, [aiSettings]);

  const save = async () => {
    if (!form) return;
    setSaving(true);
    await updateAISettings(form);
    toast('设置已保存（仅存浏览器）', 'success');
    setSaving(false);
  };

  const switchProvider = (provider: AIProvider) => {
    if (provider === 'trial') {
      setForm({ provider, apiKey: '', model: '', temperature: 0.7 });
      return;
    }
    const preset = PROVIDER_PRESET[provider];
    setForm({
      provider,
      apiKey: form?.apiKey ?? '',
      model: preset.model,
      baseUrl: preset.baseUrl,
      temperature: form?.temperature ?? 0.7
    });
  };

  if (!form) return <div className="text-ink-500">加载中...</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-ink-100">设置</h1>
        <p className="text-sm text-ink-500 mt-1">所有配置仅存浏览器 IndexedDB，不上传任何服务器</p>
      </div>

      {/* AI 提供商 */}
      <div className="card p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-ink-100 mb-1">AI 提供商</h2>
          <p className="text-xs text-ink-500">选择 Trial 试用，或填写自己的 API Key（推荐，无配额限制）</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <ProviderCard
            active={form.provider === 'trial'}
            onClick={() => switchProvider('trial')}
            label="Trial 模式"
            desc="免费配额"
            icon="🎁"
          />
          {Object.entries(PROVIDER_PRESET).map(([k, v]) => (
            <ProviderCard
              key={k}
              active={form.provider === k}
              onClick={() => switchProvider(k as AIProvider)}
              label={v.label}
              desc="自带 Key"
              icon="🔑"
            />
          ))}
        </div>

        {form.provider !== 'trial' && (
          <>
            <div>
              <label className="label">API Key {form.provider && (
                <a
                  href={PROVIDER_PRESET[form.provider as Exclude<AIProvider, 'trial'>]?.help}
                  target="_blank"
                  rel="noopener"
                  className="ml-2 text-xs text-accent hover:underline"
                >获取 Key <Icon name="arrow-right" size={14} /></a>
              )}</label>
              <input
                type="password"
                className="input font-mono"
                value={form.apiKey}
                onChange={e => setForm({ ...form, apiKey: e.target.value })}
                placeholder="sk-..."
                autoComplete="off"
              />
              <p className="text-[11px] text-ink-500 mt-1">🔒 Key 仅存浏览器，调用时直接发往 AI 提供商，不经过任何中间服务器</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">模型</label>
                <input className="input font-mono" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} />
              </div>
              <div>
                <label className="label">Base URL（可自定义）</label>
                <input className="input font-mono text-xs" value={form.baseUrl ?? ''} onChange={e => setForm({ ...form, baseUrl: e.target.value })} />
              </div>
            </div>

            <div>
              <label className="label">Temperature: {form.temperature.toFixed(1)}</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={form.temperature}
                onChange={e => setForm({ ...form, temperature: parseFloat(e.target.value) })}
                className="w-full accent-accent"
              />
              <div className="flex justify-between text-[10px] text-ink-500 mt-1">
                <span>精确（0）</span>
                <span>创意（1）</span>
              </div>
            </div>
          </>
        )}

        {form.provider === 'trial' && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-300">
            <Icon name="alert" size={14} /> Trial 模式通过 Cloudflare Worker 代理调用 AI，按 IP 限制每日配额（默认 20 次/天）。
            建议在试用后配置自己的 API Key 以解除限制。
          </div>
        )}

        <button className="btn-primary w-full" onClick={save} disabled={saving}>
          {saving ? '保存中...' : '保存设置'}
        </button>
      </div>

      {/* Embedding 配置（JD 匹配推荐用） */}
      <div className="card p-5 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-ink-100 mb-1">Embedding 配置</h2>
          <p className="text-xs text-ink-500">用于 JD 池匹配推荐。默认复用上面的 OpenAI 配置；Anthropic/DeepSeek 用户需单独配置 OpenAI 兼容端点或切 Trial 模式走 Worker 代理。</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Embedding 模型</label>
            <input
              className="input font-mono text-xs"
              value={form.embeddingModel ?? ''}
              onChange={e => setForm({ ...form, embeddingModel: e.target.value })}
              placeholder="text-embedding-3-small"
            />
          </div>
          <div>
            <label className="label">Embedding API Key（留空复用上方）</label>
            <input
              type="password"
              className="input font-mono text-xs"
              value={form.embeddingApiKey ?? ''}
              onChange={e => setForm({ ...form, embeddingApiKey: e.target.value })}
              placeholder="留空复用 chat API Key"
              autoComplete="off"
            />
          </div>
        </div>
        <div>
          <label className="label">Embedding Base URL（留空复用上方）</label>
          <input
            className="input font-mono text-xs"
            value={form.embeddingBaseUrl ?? ''}
            onChange={e => setForm({ ...form, embeddingBaseUrl: e.target.value })}
            placeholder="留空复用 chat baseUrl（仅 OpenAI 兼容）"
          />
        </div>
        <div className="text-[11px] text-ink-500">
          {form.provider === 'openai'
            ? (<><Icon name="check" size={14} /> OpenAI 默认支持 embedding，留空即可</>)
            : form.provider === 'trial'
            ? (<><Icon name="check" size={14} /> Trial 模式自动走 Worker 代理（共享池需 Worker 配置 Vectorize）</>)
            : (<><Icon name="alert" size={14} /> 当前 chat provider 不支持 embedding，请填 OpenAI 兼容端点，或切 Trial 模式</>)}
        </div>
        <button className="btn-outline w-full text-xs" onClick={save} disabled={saving}>
          保存 Embedding 配置
        </button>
      </div>

      {/* 数据管理 */}
      <div className="card p-5 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-ink-100">数据主权</h2>
          <p className="text-xs text-ink-500 mt-0.5">本地优先架构：你的所有数据存浏览器，可随时导出备份</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            className="btn-outline"
            onClick={async () => {
              const json = await exportAll();
              const blob = new Blob([json], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `hunter-ai-backup-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
              toast('已导出', 'success');
            }}
          >
            <Icon name="upload" size={14} /> 导出全部数据
          </button>
          <button
            className="btn-outline"
            onClick={() => {
              if (!confirm('确定清除本地所有数据？此操作不可撤销。建议先导出备份。')) return;
              indexedDB.deleteDatabase('hunter-ai');
              toast('已清除，刷新中...', 'success');
              setTimeout(() => window.location.reload(), 800);
            }}
          >
            <Icon name="trash" size={14} /> 清除本地数据
          </button>
        </div>
      </div>

      {/* 关于 */}
      <div className="card p-5 text-xs text-ink-500 space-y-1.5">
        <div className="text-sm font-semibold text-ink-300 mb-2">关于 Hunter AI</div>
        <p>• 灵感来源：CV.PRO（Lawted）+ 实习.skill（Natalie）+ devpath-ai（soulor8908）</p>
        <p>• 架构参考：<a href="https://github.com/soulor8908/devpath-ai" target="_blank" rel="noopener" className="text-accent hover:underline">devpath-ai</a> 的本地优先 PWA + Cloudflare 部署模式</p>
        <p>• 核心理念：一岗一简历 · 长期职业上下文 · 投递即学习</p>
        <p>• 技术栈：React 18 + Vite + TypeScript + Tailwind + IndexedDB + Cloudflare Worker</p>
        <p>• 数据存储：浏览器 IndexedDB（永不上云）</p>
      </div>
    </div>
  );
}

function ProviderCard({ active, onClick, label, desc, icon }: { active: boolean; onClick: () => void; label: string; desc: string; icon: string }) {
  return (
    <button
      onClick={onClick}
      className={`p-3 rounded-lg border text-left transition-all ${
        active
          ? 'border-accent bg-accent/10 text-ink-100'
          : 'border-ink-700 bg-ink-900/40 text-ink-400 hover:border-ink-600'
      }`}
    >
      <div className="text-lg mb-1">{icon}</div>
      <div className="text-xs font-medium">{label}</div>
      <div className="text-[10px] text-ink-500 mt-0.5">{desc}</div>
    </button>
  );
}
