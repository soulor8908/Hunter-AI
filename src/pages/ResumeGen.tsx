import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { getProfile, listExperiences, listResumes, saveResume, getResume, deleteResume } from '@/lib/db';
import { streamChat, chatJSON, type ChatTurn } from '@/lib/ai';
import { SYSTEM_PROMPT, JD_ANALYSIS_PROMPT, RESUME_GEN_PROMPT, fill } from '@/lib/prompts';
import { renderMarkdown, toast, copyToClipboard, downloadText, cn, relativeTime } from '@/lib/utils';
import type { CareerProfile, Experience, JDAnalysis, ResumeVersion } from '@/types';

type Step = 'input' | 'analyzing' | 'analyzed' | 'generating' | 'done';

export default function ResumeGen() {
  const { id } = useParams();
  const nav = useNavigate();
  const aiSettings = useStore((s) => s.aiSettings);
  const [profile, setProfile] = useState<CareerProfile | null>(null);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [resumes, setResumes] = useState<ResumeVersion[]>([]);
  const [step, setStep] = useState<Step>('input');
  const [jdText, setJdText] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [analysis, setAnalysis] = useState<JDAnalysis | null>(null);
  const [streamingMd, setStreamingMd] = useState('');
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    (async () => {
      const [p, e, r] = await Promise.all([getProfile(), listExperiences(), listResumes()]);
      setProfile(p ?? null);
      setExperiences(e);
      setResumes(r);
      if (id) {
        const loaded = await getResume(id);
        if (loaded) {
          setJdText(loaded.jdText);
          setJobTitle(loaded.jobTitle);
          setCompany(loaded.company);
          setAnalysis(loaded.jdAnalysis ?? null);
          setStreamingMd(loaded.markdown);
          setSavedId(loaded.id);
          setStep(loaded.markdown ? 'done' : (loaded.jdAnalysis ? 'analyzed' : 'input'));
        }
      } else {
        // 从 Jobs 页预填
        const prefill = sessionStorage.getItem('jobs:prefill');
        if (prefill) {
          sessionStorage.removeItem('jobs:prefill');
          try {
            const data = JSON.parse(prefill);
            if (data.jobTitle) setJobTitle(data.jobTitle);
            if (data.company) setCompany(data.company);
            if (data.jdText) setJdText(data.jdText);
          } catch { /* ignore */ }
        }
      }
    })();
  }, [id]);

  const requireSettings = (): boolean => {
    if (!aiSettings) {
      toast('AI 设置加载中，请稍候', 'error');
      return false;
    }
    if (aiSettings.provider !== 'trial' && !aiSettings.apiKey) {
      toast('请先在设置中配置 API Key', 'error');
      nav('/settings');
      return false;
    }
    return true;
  };

  const analyzeJD = async () => {
    if (!jdText.trim()) {
      toast('请粘贴 JD', 'error');
      return;
    }
    if (!requireSettings()) return;
    setError('');
    setStep('analyzing');
    setAnalysis(null);
    try {
      const messages: ChatTurn[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: fill(JD_ANALYSIS_PROMPT, { jd: jdText }) }
      ];
      const out = await chatJSON(messages, aiSettings!);
      const parsed = JSON.parse(out) as JDAnalysis;
      setAnalysis(parsed);
      setStep('analyzed');
      toast('JD 拆解完成', 'success');
    } catch (e) {
      setError((e as Error).message);
      setStep('input');
    }
  };

  const generateResume = async () => {
    if (!requireSettings()) return;
    if (!analysis) {
      toast('请先拆解 JD', 'error');
      return;
    }
    if (!profile?.name) {
      if (!confirm('还没有建立职业档案，AI 将仅基于 JD 生成通用模板。建议先去建立档案。是否继续？')) {
        nav('/profile');
        return;
      }
    }
    setError('');
    setStep('generating');
    setStreamingMd('');
    abortRef.current = new AbortController();

    const expText = experiences.map(e => `
### ${e.title} @ ${e.org} (${e.start} - ${e.end})
类型: ${e.type}
${e.bullets.length ? '要点:\n' + e.bullets.map(b => `- ${b}`).join('\n') : ''}
${e.tags.length ? '标签: ' + e.tags.join(', ') : ''}
${e.description ? '描述: ' + e.description : ''}
`).join('\n');

    const profileText = `
姓名: ${profile?.name ?? '（未填）'}
定位: ${profile?.headline ?? '（未填）'}
自我介绍: ${profile?.summary ?? '（未填）'}
目标岗位: ${profile?.targetRoles.join(', ') ?? '（未填）'}
联系方式: ${profile?.contact.email ?? ''} ${profile?.contact.github ?? ''} ${profile?.contact.website ?? ''}
`;

    const messages: ChatTurn[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: fill(RESUME_GEN_PROMPT, {
          jobTitle: jobTitle || '（岗位）',
          company: company || '（公司）',
          jdAnalysis: JSON.stringify(analysis, null, 2),
          profile: profileText,
          experiences: expText || '（无经历）'
        })
      }
    ];

    let full = '';
    await streamChat(messages, aiSettings!, {
      onToken: (t) => {
        full += t;
        setStreamingMd(full);
      },
      onDone: async (finalText) => {
        // 提取匹配度评分
        const scoreMatch = finalText.match(/匹配度自评[\s\S]*?(\d{1,3})\s*分/);
        const score = scoreMatch ? Math.min(100, parseInt(scoreMatch[1])) : undefined;

        const saved = await saveResume({
          id: savedId ?? undefined,
          jobTitle: jobTitle || '未命名岗位',
          company: company || '未命名公司',
          jdText,
          jdAnalysis: analysis,
          markdown: finalText,
          status: 'finalized',
          matchScore: score
        });
        setSavedId(saved.id);
        setStep('done');
        toast('简历已生成并保存', 'success');
        // 刷新历史列表
        setResumes(await listResumes());
      },
      onError: (e) => {
        setError(e.message);
        setStep('analyzed');
      }
    }, abortRef.current.signal);
  };

  const stop = () => {
    abortRef.current?.abort();
    setStep('analyzed');
  };

  const loadHistory = async (r: ResumeVersion) => {
    setHistoryOpen(false);
    nav(`/resume/${r.id}`);
  };

  const remove = async (rid: string) => {
    if (!confirm('确认删除该简历版本？')) return;
    await deleteResume(rid);
    setResumes(await listResumes());
    if (rid === savedId) {
      nav('/resume');
      window.location.reload();
    }
  };

  return (
    <div className="space-y-5">
      {/* 顶栏 */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold text-ink-100">简历生成</h1>
          <p className="text-xs md:text-sm text-ink-500 mt-1">粘贴 JD → AI 拆解 → 基于你的经历池生成专属简历</p>
        </div>
        <button className="btn-ghost text-xs shrink-0" onClick={() => setHistoryOpen(!historyOpen)}>
          历史 ({resumes.length})
        </button>
      </div>

      {/* 历史抽屉 */}
      {historyOpen && (
        <div className="card p-3 space-y-1.5">
          {resumes.length === 0 ? (
            <div className="text-xs text-ink-500 text-center py-3">暂无历史版本</div>
          ) : resumes.map(r => (
            <div key={r.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-ink-700/50 group">
              <button className="flex-1 text-left min-w-0" onClick={() => loadHistory(r)}>
                <div className="text-sm text-ink-100 truncate">{r.jobTitle} @ {r.company}</div>
                <div className="text-[10px] text-ink-500">{relativeTime(r.updatedAt)} {r.matchScore != null && `· ${r.matchScore}分`}</div>
              </button>
              <button className="opacity-100 md:opacity-0 md:group-hover:opacity-100 text-red-400 text-xs px-2 shrink-0" onClick={() => remove(r.id)}>删除</button>
            </div>
          ))}
        </div>
      )}

      {/* 输入区 */}
      <div className="card p-4 md:p-5 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">目标岗位</label>
            <input className="input" value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="如：高级前端工程师" />
          </div>
          <div>
            <label className="label">公司</label>
            <input className="input" value={company} onChange={e => setCompany(e.target.value)} placeholder="如：字节跳动" />
          </div>
        </div>
        <div>
          <label className="label">JD 内容（粘贴完整职位描述）</label>
          <textarea
            className="textarea min-h-[180px]"
            value={jdText}
            onChange={e => setJdText(e.target.value)}
            placeholder={'粘贴完整 JD，包括岗位职责和任职要求。\nAI 会拆解出关键词、核心职责、隐藏考察点。'}
          />
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-xs text-red-300">
            ⚠ {error}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {step === 'input' && (
            <button className="btn-primary" onClick={analyzeJD} disabled={!jdText.trim()}>
              ◉ 拆解 JD
            </button>
          )}
          {(step === 'analyzing' || step === 'generating') && (
            <button className="btn-outline" onClick={stop}>⏹ 停止</button>
          )}
          {step === 'analyzed' && (
            <>
              <button className="btn-primary" onClick={generateResume}>✦ 生成专属简历</button>
              <button className="btn-ghost" onClick={() => setStep('input')}>← 修改 JD</button>
            </>
          )}
          {step === 'done' && (
            <>
              <button className="btn-outline text-xs" onClick={() => copyToClipboard(streamingMd)}>📋 复制 Markdown</button>
              <button className="btn-outline text-xs" onClick={() => downloadText(`${company || 'resume'}-${jobTitle}.md`, streamingMd, 'text/markdown')}>⬇ 下载 .md</button>
              <button className="btn-ghost text-xs" onClick={() => window.print()}>🖨 打印/PDF</button>
              <button className="btn-ghost text-xs" onClick={() => { setStep('input'); setAnalysis(null); setStreamingMd(''); setSavedId(null); nav('/resume'); }}>+ 新建</button>
            </>
          )}
        </div>

        {/* 步骤指示 */}
        <div className="flex items-center gap-2 text-[10px] text-ink-500 pt-1">
          <StepDot active={step !== 'input'} label="拆解 JD" />
          <span>→</span>
          <StepDot active={['generating', 'done'].includes(step)} label="生成简历" />
          <span>→</span>
          <StepDot active={step === 'done'} label="保存" />
        </div>
      </div>

      {/* JD 拆解结果 */}
      {analysis && (step === 'analyzed' || step === 'generating' || step === 'done') && (
        <div className="card p-4 md:p-5">
          <h3 className="text-sm font-semibold text-ink-100 mb-3 flex items-center gap-2">
            <span className="text-accent">◉</span> JD 拆解
          </h3>
          <div className="grid sm:grid-cols-2 gap-4 text-xs">
            <AnalysisSection title="关键技能词" items={analysis.keywords} variant="accent" />
            <AnalysisSection title="核心职责" items={analysis.responsibilities} />
            <AnalysisSection title="硬性要求" items={analysis.requirements} />
            <AnalysisSection title="加分项" items={analysis.niceToHaves} />
            {analysis.redFlags.length > 0 && (
              <AnalysisSection title="⚠ 警示信号" items={analysis.redFlags} variant="red" />
            )}
            <AnalysisSection title="推测面试考察点" items={analysis.interviewFocus} variant="purple" />
          </div>
        </div>
      )}

      {/* 简历预览 */}
      {(step === 'generating' || step === 'done') && (
        <div className="card p-4 md:p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-ink-100 flex items-center gap-2">
              <span className="text-accent">✦</span>
              {step === 'generating' ? '生成中...' : '简历预览'}
              {step === 'generating' && <span className="stream-cursor" />}
            </h3>
            {savedId && step === 'done' && (
              <span className="chip-accent text-[10px]">已保存</span>
            )}
          </div>
          <div
            className="prose-resume max-w-none"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(streamingMd || (step === 'generating' ? '' : '_等待生成_')) }}
          />
        </div>
      )}
    </div>
  );
}

function StepDot({ active, label }: { active: boolean; label: string }) {
  return (
    <span className={cn('px-2 py-0.5 rounded', active ? 'bg-accent/10 text-accent' : 'bg-ink-700 text-ink-500')}>
      {label}
    </span>
  );
}

function AnalysisSection({ title, items, variant = 'default' }: { title: string; items: string[]; variant?: 'default' | 'accent' | 'red' | 'purple' }) {
  if (!items?.length) return null;
  const colorClass = {
    default: 'text-ink-300 bg-ink-700/50',
    accent: 'text-accent bg-accent/10',
    red: 'text-red-400 bg-red-500/10',
    purple: 'text-purple-400 bg-purple-500/10'
  }[variant];
  return (
    <div>
      <div className="text-ink-500 mb-1.5 font-medium">{title}</div>
      <div className="flex flex-wrap gap-1">
        {items.map((it, i) => (
          <span key={i} className={cn('px-2 py-1 rounded text-[11px]', colorClass)}>{it}</span>
        ))}
      </div>
    </div>
  );
}
