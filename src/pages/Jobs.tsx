// Hunter AI — JD 池 + 匹配推荐
// 站在用户角度：粘贴/导入 JD → AI 拆解 + 向量化 → 按画像评分排序 → 一键进入简历生成
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { getProfile, listExperiences, listJobLeads, saveJobLead, deleteJobLead, saveApplication, saveProfile } from '@/lib/db';
import { chatJSON, embed, uploadToSharedPool, querySharedPool, canEmbedLocally, type ChatTurn } from '@/lib/ai';
import { SYSTEM_PROMPT, JD_ANALYSIS_PROMPT, fill } from '@/lib/prompts';
import { buildProfileText, buildJobLeadText, hashText, rankLeads } from '@/lib/matching';
import { toast, cn, relativeTime } from '@/lib/utils';
import type { AISettings, CareerProfile, Experience, JDAnalysis, JobLead } from '@/types';

type ImportStep = 'idle' | 'analyzing' | 'embedding' | 'done';

export default function Jobs() {
  const nav = useNavigate();
  const aiSettings = useStore((s) => s.aiSettings);
  const [profile, setProfile] = useState<CareerProfile | null>(null);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [leads, setLeads] = useState<JobLead[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [sharedMatches, setSharedMatches] = useState<Array<{ id: string; score: number; jobTitle: string; company: string; city?: string; salary?: string }>>([]);
  const [loadingShared, setLoadingShared] = useState(false);
  const [refreshingEmbed, setRefreshingEmbed] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const refresh = async () => {
    const [p, e, l] = await Promise.all([getProfile(), listExperiences(), listJobLeads()]);
    setProfile(p ?? null);
    setExperiences(e);
    setLeads(l);
  };

  useEffect(() => { refresh(); }, []);

  // 是否能用 embedding（决定显示提示文案）
  const embeddingReady = useMemo(() => !!aiSettings && (canEmbedLocally(aiSettings) || aiSettings.provider === 'trial'), [aiSettings]);

  // 用画像 embedding 对 leads 排序
  const ranked = useMemo(() => {
    if (!profile) return [];
    return rankLeads(leads, profile, experiences, profile.embedding);
  }, [leads, profile, experiences]);

  // 更新画像 embedding（文本变了才重算）
  const refreshProfileEmbedding = async () => {
    if (!profile || !aiSettings) return;
    if (!embeddingReady) {
      toast('当前 AI 配置不支持 embedding，请在设置中切换 OpenAI 或 Trial 模式', 'error');
      return;
    }
    setRefreshingEmbed(true);
    try {
      const text = buildProfileText(profile, experiences);
      const textHash = hashText(text);
      if (profile.embedding && profile.embeddingTextHash === textHash) {
        toast('画像未变化，无需更新', 'info');
        return;
      }
      const [vec] = await embed([text], aiSettings);
      if (!vec || vec.length === 0) throw new Error('embedding 返回空');
      const updated = { ...profile, embedding: vec, embeddingTextHash: textHash, embeddingUpdatedAt: Date.now() };
      await saveProfile(updated);
      setProfile(updated);
      toast('画像向量已更新', 'success');
    } catch (e) {
      toast(`更新失败：${(e as Error).message}`, 'error');
    } finally {
      setRefreshingEmbed(false);
    }
  };

  // 从共享池查推荐
  const fetchShared = async () => {
    if (!profile?.embedding) {
      toast('请先更新画像向量', 'error');
      return;
    }
    setLoadingShared(true);
    try {
      const matches = await querySharedPool(profile.embedding, 20);
      setSharedMatches(matches);
      if (matches.length === 0) {
        toast('共享池暂无匹配（可能 Worker 未配置 Vectorize）', 'info');
      }
    } finally {
      setLoadingShared(false);
    }
  };

  const applyShared = async (m: { jobTitle: string; company: string; city?: string; salary?: string }) => {
    // 把共享池发现转为本地 lead（jdText 留空，引导用户去原平台搜）
    const saved = await saveJobLead({
      jobTitle: m.jobTitle,
      company: m.company,
      jdText: '', // 共享池不存完整 JD
      city: m.city,
      salary: m.salary,
      source: 'shared',
      fromSharedPool: true,
      status: 'new'
    });
    setLeads(await listJobLeads());
    toast(`已加入本地池：${m.jobTitle} @ ${m.company}`, 'success');
    void saved;
  };

  const remove = async (id: string) => {
    if (!confirm('从 JD 池移除？')) return;
    await deleteJobLead(id);
    setLeads(await listJobLeads());
  };

  const setStatus = async (lead: JobLead, status: JobLead['status']) => {
    await saveJobLead({ ...lead, status });
    setLeads(await listJobLeads());
  };

  // 进入简历生成（带预填）
  const goGenResume = (lead: JobLead) => {
    // 通过 sessionStorage 传递预填数据，避免 URL 过长
    sessionStorage.setItem('jobs:prefill', JSON.stringify({
      jobTitle: lead.jobTitle,
      company: lead.company,
      jdText: lead.jdText
    }));
    nav('/resume');
  };

  // 转为投递追踪
  const goTrack = async (lead: JobLead) => {
    await saveApplication({
      company: lead.company,
      jobTitle: lead.jobTitle,
      jdText: lead.jdText,
      stage: 'planning',
      source: lead.source
    });
    toast('已加入投递追踪', 'success');
    nav('/tracking');
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold text-ink-100">JD 池 / 匹配推荐</h1>
          <p className="text-xs md:text-sm text-ink-500 mt-1">导入 JD → AI 拆解 + 向量化 → 按你的画像评分排序</p>
        </div>
        <button className="btn-primary text-xs shrink-0" onClick={() => setImportOpen(true)}>
          + 导入 JD
        </button>
      </div>

      {/* 画像向量状态 */}
      <div className="card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-ink-100">画像向量</div>
          <div className="text-xs text-ink-500 mt-0.5">
            {profile?.embedding
              ? `已生成 · ${profile.embeddingUpdatedAt ? relativeTime(profile.embeddingUpdatedAt) : ''}${profile.embeddingTextHash ? '' : ''}`
              : '未生成 — 画像变化后请重算'}
          </div>
          {!embeddingReady && (
            <div className="text-[10px] text-amber-400 mt-1">当前 AI 配置不支持 embedding，请用 OpenAI 或 Trial 模式</div>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            className="btn-outline text-xs"
            onClick={refreshProfileEmbedding}
            disabled={!embeddingReady || refreshingEmbed}
          >
            {refreshingEmbed ? '⏳ 计算中...' : '⟳ 更新画像向量'}
          </button>
          <button
            className="btn-ghost text-xs"
            onClick={fetchShared}
            disabled={!profile?.embedding || loadingShared}
          >
            {loadingShared ? '⏳ 搜索中...' : '✧ 共享池推荐'}
          </button>
        </div>
      </div>

      {/* 共享池推荐结果 */}
      {sharedMatches.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-ink-100">共享池推荐（{sharedMatches.length}）</h3>
            <button className="btn-ghost text-xs" onClick={() => setSharedMatches([])}>收起</button>
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {sharedMatches.map((m, i) => (
              <div key={i} className="card-hover p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm text-ink-100 truncate">{m.jobTitle}</div>
                  <div className="text-xs text-ink-500 truncate">@ {m.company}{m.city ? ` · ${m.city}` : ''}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={cn('chip text-[10px]', m.score > 0.7 ? 'chip-accent' : '')}>
                    {Math.round(m.score * 100)}%
                  </span>
                  <button className="btn-ghost text-xs px-2 py-1" onClick={() => applyShared(m)}>+</button>
                </div>
              </div>
            ))}
          </div>
          <div className="text-[10px] text-ink-600 mt-2">共享池仅返回 JD 摘要，点击 + 加入本地池后请去原平台补全 JD 文本</div>
        </div>
      )}

      {/* JD 池列表 */}
      <div>
        <h3 className="text-sm font-semibold text-ink-100 mb-2">本地 JD 池（{ranked.length}）</h3>
        {ranked.length === 0 ? (
          <div className="card p-8 text-center">
            <div className="text-4xl mb-2 text-ink-600">▤</div>
            <div className="text-sm text-ink-400 mb-1">还没有 JD</div>
            <div className="text-xs text-ink-500">点击右上角"导入 JD"开始</div>
          </div>
        ) : (
          <div className="space-y-2">
            {ranked.map(lead => (
              <div key={lead.id} className="card p-3 md:p-4 group">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-ink-100 truncate">{lead.jobTitle}</span>
                      {lead.matchScore !== undefined && lead.matchScore > 0 && (
                        <span className={cn(
                          'chip text-[10px]',
                          lead.matchScore >= 70 ? 'chip-accent' :
                          lead.matchScore >= 50 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : ''
                        )}>
                          {lead.matchScore} 分
                        </span>
                      )}
                      {lead.fromSharedPool && <span className="chip text-[10px] bg-blue-500/10 text-blue-400">共享池</span>}
                    </div>
                    <div className="text-xs text-ink-500 mt-0.5 truncate">
                      @ {lead.company}{lead.city ? ` · ${lead.city}` : ''}{lead.salary ? ` · ${lead.salary}` : ''}
                    </div>
                    {lead.matchReasons && lead.matchReasons.length > 0 && (
                      <div className="text-[11px] text-accent/80 mt-1.5">
                        {lead.matchReasons.map((r, i) => <div key={i}>✓ {r}</div>)}
                      </div>
                    )}
                    {lead.matchGaps && lead.matchGaps.length > 0 && (
                      <div className="text-[11px] text-amber-400/80 mt-1">
                        {lead.matchGaps.map((g, i) => <div key={i}>⚠ {g}</div>)}
                      </div>
                    )}
                    <div className="text-[10px] text-ink-600 mt-1.5">
                      导入于 {relativeTime(lead.importedAt)}
                      {lead.jdAnalysis?.keywords?.length ? ` · ${lead.jdAnalysis.keywords.length} 个关键词` : ''}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <select
                      className="text-[10px] bg-ink-700 border border-ink-600 rounded px-1 py-0.5 text-ink-300 min-h-[24px]"
                      value={lead.status}
                      onChange={e => setStatus(lead, e.target.value as JobLead['status'])}
                    >
                      <option value="new">新</option>
                      <option value="viewed">已看</option>
                      <option value="applied">已投</option>
                      <option value="ignored">忽略</option>
                    </select>
                    <button className="text-[10px] text-red-400 px-1.5 py-0.5 min-h-[24px]" onClick={() => remove(lead.id)}>✕</button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {lead.jdText && (
                    <button className="btn-outline text-[10px] px-2 py-1" onClick={() => goGenResume(lead)}>✦ 生成简历</button>
                  )}
                  <button className="btn-ghost text-[10px] px-2 py-1" onClick={() => goTrack(lead)}>→ 投递追踪</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 导入 JD 抽屉 */}
      {importOpen && (
        <ImportDrawer
          aiSettings={aiSettings}
          onClose={() => setImportOpen(false)}
          onSaved={async () => { setImportOpen(false); await refresh(); }}
          abortRef={abortRef}
        />
      )}
    </div>
  );
}

// ============ 导入 JD 抽屉 ============
function ImportDrawer({
  aiSettings,
  onClose,
  onSaved,
  abortRef
}: {
  aiSettings: AISettings | null;
  onClose: () => void;
  onSaved: () => void;
  abortRef: React.MutableRefObject<AbortController | null>;
}) {
  const [jdText, setJdText] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [city, setCity] = useState('');
  const [salary, setSalary] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [step, setStep] = useState<ImportStep>('idle');
  const [error, setError] = useState('');
  const [shareToPool, setShareToPool] = useState(true);

  const requireSettings = (): boolean => {
    if (!aiSettings) { toast('AI 设置加载中', 'error'); return false; }
    if (aiSettings.provider !== 'trial' && !aiSettings.apiKey) {
      toast('请先在设置中配置 API Key', 'error'); return false;
    }
    return true;
  };

  const tryAutoFillFromText = (text: string) => {
    // 简单启发式：尝试从 JD 文本提取标题/公司
    if (!jobTitle) {
      const m = text.match(/(?:岗位|职位|招聘)[:：\s]*([^\n，,。]{2,30})/);
      if (m) setJobTitle(m[1].trim());
    }
    if (!company) {
      const m = text.match(/(?:公司|企业|单位)[:：\s]*([^\n，,。]{2,30})/);
      if (m) setCompany(m[1].trim());
    }
  };

  const run = async () => {
    if (!jdText.trim()) { toast('请粘贴 JD 文本', 'error'); return; }
    if (!requireSettings()) return;
    setError('');
    setStep('analyzing');
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    try {
      // 1. JD 拆解
      const messages: ChatTurn[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: fill(JD_ANALYSIS_PROMPT, { jd: jdText }) }
      ];
      const out = await chatJSON(messages, aiSettings!, signal);
      let jdAnalysis: JDAnalysis | undefined;
      try { jdAnalysis = JSON.parse(out) as JDAnalysis; } catch { jdAnalysis = undefined; }

      // 2. Embedding
      setStep('embedding');
      const leadText = buildJobLeadText({
        jobTitle: jobTitle || '未命名岗位',
        company: company || '未知公司',
        jdText,
        city,
        salary
      });
      let embedding: number[] | undefined;
      try {
        const [vec] = await embed([leadText], aiSettings!, signal);
        embedding = vec;
      } catch (e) {
        // embedding 失败不阻塞，lead 仍可保存（评分退化为标题匹配）
        console.warn('embedding failed:', e);
      }

      // 3. 保存到本地池
      const saved = await saveJobLead({
        jobTitle: jobTitle || '未命名岗位',
        company: company || '未知公司',
        jdText,
        source: sourceUrl ? 'extension' : 'paste',
        sourceUrl: sourceUrl || undefined,
        city: city || undefined,
        salary: salary || undefined,
        jdAnalysis,
        embedding,
        status: 'new'
      });

      // 4. 上传到共享池（可选，静默失败）
      if (shareToPool && embedding && embedding.length > 0) {
        await uploadToSharedPool({
          jobTitle: saved.jobTitle,
          company: saved.company,
          city: saved.city,
          salary: saved.salary,
          jdText: saved.jdText,
          embedding
        }, signal);
      }

      setStep('done');
      toast('JD 已导入并评分', 'success');
      setTimeout(onSaved, 300);
    } catch (e) {
      if ((e as Error).name === 'AbortError') { setStep('idle'); return; }
      setError((e as Error).message);
      setStep('idle');
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
    setStep('idle');
  };

  return (
    <div className="fixed inset-0 bg-ink-900/80 backdrop-blur z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={step === 'idle' ? onClose : undefined}>
      <div
        className="card p-5 max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-t-2xl md:rounded-xl"
        onClick={e => e.stopPropagation()}
        style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-ink-100">导入 JD</h3>
          <button className="btn-ghost text-xs" onClick={step === 'idle' ? onClose : cancel} disabled={step === 'done'}>
            {step === 'idle' ? '✕' : '取消'}
          </button>
        </div>

        {step === 'idle' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">岗位 *</label>
                <input className="input" value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="如：高级前端工程师" />
              </div>
              <div>
                <label className="label">公司 *</label>
                <input className="input" value={company} onChange={e => setCompany(e.target.value)} placeholder="如：字节跳动" />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="label">城市</label>
                <input className="input" value={city} onChange={e => setCity(e.target.value)} placeholder="北京" />
              </div>
              <div>
                <label className="label">薪资</label>
                <input className="input" value={salary} onChange={e => setSalary(e.target.value)} placeholder="30-50k" />
              </div>
              <div>
                <label className="label">来源链接</label>
                <input className="input" value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="https://..." />
              </div>
            </div>
            <div>
              <label className="label">JD 正文 *</label>
              <textarea
                className="textarea min-h-[180px]"
                value={jdText}
                onChange={e => {
                  setJdText(e.target.value);
                  tryAutoFillFromText(e.target.value);
                }}
                placeholder="粘贴完整 JD 文本..."
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-ink-400">
              <input type="checkbox" checked={shareToPool} onChange={e => setShareToPool(e.target.checked)} />
              上传匿名向量到共享池（仅向量+元信息，不含完整 JD）
            </label>
            {error && <div className="text-xs text-red-400">⚠ {error}</div>}
            <div className="flex justify-end gap-2 pt-1">
              <button className="btn-primary text-xs" onClick={run}>导入并分析</button>
            </div>
          </div>
        )}

        {(step === 'analyzing' || step === 'embedding') && (
          <div className="py-10 text-center">
            <div className="text-3xl mb-3 animate-pulse">{step === 'analyzing' ? '◉' : '✧'}</div>
            <div className="text-sm text-ink-300">
              {step === 'analyzing' ? 'AI 正在拆解 JD...' : '生成向量并写入...'}
            </div>
            <div className="text-[10px] text-ink-500 mt-2">这可能需要几秒到十几秒</div>
          </div>
        )}

        {step === 'done' && (
          <div className="py-10 text-center">
            <div className="text-3xl mb-3 text-accent">✓</div>
            <div className="text-sm text-ink-300">导入成功</div>
          </div>
        )}
      </div>
    </div>
  );
}
