import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import { listInterviews, saveInterview, deleteInterview, listResumes, getResume } from '@/lib/db';
import { streamChat, chatJSON, type ChatTurn } from '@/lib/ai';
import { SYSTEM_PROMPT, INTERVIEW_PREP_PROMPT, fill } from '@/lib/prompts';
import { toast, cn, relativeTime } from '@/lib/utils';
import type { InterviewPrep, InterviewQuestion, ResumeVersion } from '@/types';
import { nanoid } from 'nanoid';

const CATEGORY_LABEL: Record<InterviewQuestion['category'], { label: string; color: string }> = {
  behavioral: { label: '行为', color: 'text-blue-400 bg-blue-500/10' },
  technical: { label: '技术', color: 'text-accent bg-accent/10' },
  case: { label: '案例', color: 'text-purple-400 bg-purple-500/10' },
  deep: { label: '深挖', color: 'text-amber-400 bg-amber-500/10' },
  culture: { label: '文化', color: 'text-pink-400 bg-pink-500/10' }
};

const DIFFICULTY_LABEL: Record<InterviewQuestion['difficulty'], string> = {
  easy: '⭐',
  medium: '⭐⭐',
  hard: '⭐⭐⭐'
};

export default function Interview() {
  const aiSettings = useStore((s) => s.aiSettings);
  const [list, setList] = useState<InterviewPrep[]>([]);
  const [resumes, setResumes] = useState<ResumeVersion[]>([]);
  const [current, setCurrent] = useState<InterviewPrep | null>(null);
  const [generating, setGenerating] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [error, setError] = useState('');

  // 新建表单
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [jdText, setJdText] = useState('');
  const [resumeId, setResumeId] = useState('');

  const load = async () => {
    const [l, r] = await Promise.all([listInterviews(), listResumes()]);
    setList(l);
    setResumes(r);
  };

  useEffect(() => { load(); }, []);

  const generate = async () => {
    if (!aiSettings) return;
    if (aiSettings.provider !== 'trial' && !aiSettings.apiKey) {
      toast('请先配置 API Key', 'error');
      return;
    }
    if (!jdText.trim()) {
      toast('请粘贴 JD', 'error');
      return;
    }
    setError('');
    setGenerating(true);
    setStreamingText('');

    let resumeMarkdown = '';
    if (resumeId) {
      const r = await getResume(resumeId);
      resumeMarkdown = r?.markdown ?? '';
    }

    try {
      const messages: ChatTurn[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: fill(INTERVIEW_PREP_PROMPT, {
            jobTitle: jobTitle || '该岗位',
            company: company || '该公司',
            jd: jdText,
            resumeMarkdown: resumeMarkdown || '（未关联简历，请基于通用面试经验出题）'
          })
        }
      ];

      const out = await chatJSON(messages, aiSettings);
      const parsed = JSON.parse(out) as { questions: Omit<InterviewQuestion, 'id' | 'practiced'>[]; myStories: string[]; questionsToAsk: string[] };

      const prep = await saveInterview({
        jobTitle: jobTitle || '未命名岗位',
        company: company || '未命名公司',
        jdText,
        resumeId: resumeId || undefined,
        questions: parsed.questions.map(q => ({ ...q, id: nanoid(), practiced: false })),
        myStories: parsed.myStories ?? [],
        questionsToAsk: parsed.questionsToAsk ?? []
      });
      setCurrent(prep);
      setStreamingText('');
      setGenerating(false);
      toast('面试清单已生成', 'success');
      await load();
    } catch (e) {
      setError((e as Error).message);
      setGenerating(false);
    }
  };

  const togglePracticed = async (qid: string) => {
    if (!current) return;
    const updated = {
      ...current,
      questions: current.questions.map(q => q.id === qid ? { ...q, practiced: !q.practiced } : q)
    };
    const saved = await saveInterview(updated);
    setCurrent(saved);
    setList(await listInterviews());
  };

  const remove = async (id: string) => {
    if (!confirm('确认删除这份面试准备？')) return;
    await deleteInterview(id);
    if (current?.id === id) setCurrent(null);
    await load();
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-ink-100">面试准备</h1>
        <p className="text-xs md:text-sm text-ink-500 mt-1">基于 JD + 简历生成专属面试题清单、STAR 故事和反问</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4 md:gap-5">
        {/* 左：表单 + 历史 */}
        <div className="md:col-span-1 space-y-4">
          <div className="card p-4 space-y-3">
            <h3 className="text-sm font-semibold text-ink-100">新建面试准备</h3>
            <div className="grid grid-cols-2 gap-2">
              <input className="input text-xs" value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="岗位" />
              <input className="input text-xs" value={company} onChange={e => setCompany(e.target.value)} placeholder="公司" />
            </div>
            {resumes.length > 0 && (
              <select className="input text-xs" value={resumeId} onChange={e => setResumeId(e.target.value)}>
                <option value="">不关联简历</option>
                {resumes.map(r => <option key={r.id} value={r.id}>{r.jobTitle} @ {r.company}</option>)}
              </select>
            )}
            <textarea
              className="textarea text-xs min-h-[120px]"
              value={jdText}
              onChange={e => setJdText(e.target.value)}
              placeholder="粘贴 JD..."
            />
            {error && <div className="text-xs text-red-400">{error}</div>}
            <button className="btn-primary w-full text-xs" onClick={generate} disabled={generating || !jdText.trim()}>
              {generating ? '生成中...' : '✦ 生成面试清单'}
            </button>
          </div>

          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-100 mb-2">历史 ({list.length})</h3>
            {list.length === 0 ? (
              <div className="text-xs text-ink-500 py-3 text-center">暂无</div>
            ) : (
              <div className="space-y-1.5">
                {list.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-ink-700/50 group">
                    <button className="flex-1 text-left min-w-0" onClick={() => setCurrent(p)}>
                      <div className="text-xs text-ink-100 truncate">{p.jobTitle} @ {p.company}</div>
                      <div className="text-[10px] text-ink-500">{p.questions.length} 题 · {relativeTime(p.updatedAt)}</div>
                    </button>
                    <button className="opacity-100 md:opacity-0 md:group-hover:opacity-100 text-red-400 text-xs px-2 shrink-0" onClick={() => remove(p.id)}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 右：当前面试准备详情 */}
        <div className="md:col-span-2">
          {!current ? (
            <div className="card p-8 text-center">
              <div className="text-4xl mb-3">◈</div>
              <p className="text-ink-400 text-sm">填写左侧表单生成面试准备清单，或从历史中选择一份</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-ink-100">{current.jobTitle} @ {current.company}</h3>
                    <div className="text-xs text-ink-500 mt-0.5">
                      {current.questions.length} 题 · 已练习 {current.questions.filter(q => q.practiced).length} 题
                    </div>
                  </div>
                  <div className="w-24 h-2 bg-ink-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent transition-all"
                      style={{ width: `${(current.questions.filter(q => q.practiced).length / Math.max(1, current.questions.length)) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* 面试题列表 */}
              <div className="card p-4">
                <h4 className="text-xs font-semibold text-ink-300 mb-3 flex items-center gap-2">
                  <span>📝</span> 面试题清单
                </h4>
                <div className="space-y-2">
                  {current.questions.map((q, i) => (
                    <div key={q.id} className={cn('p-3 rounded-lg border', q.practiced ? 'border-accent/30 bg-accent/5' : 'border-ink-700 bg-ink-900/40')}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap mb-1">
                            <span className="text-[10px] text-ink-500">#{i + 1}</span>
                            <span className={cn('chip text-[10px]', CATEGORY_LABEL[q.category].color)}>{CATEGORY_LABEL[q.category].label}</span>
                            <span className="text-[10px] text-ink-500">{DIFFICULTY_LABEL[q.difficulty]}</span>
                          </div>
                          <div className="text-sm text-ink-100 font-medium">{q.question}</div>
                          <div className="text-xs text-ink-500 mt-1">🎯 {q.intent}</div>
                          {q.suggestedAnswer && (
                            <details className="mt-2">
                              <summary className="text-xs text-accent cursor-pointer hover:underline">查看建议答题方向</summary>
                              <div className="text-xs text-ink-400 mt-1.5 pl-3 border-l-2 border-accent/30 whitespace-pre-wrap">
                                {q.suggestedAnswer}
                              </div>
                            </details>
                          )}
                        </div>
                        <button
                          onClick={() => togglePracticed(q.id)}
                          className={cn('text-xs px-2 py-1 rounded', q.practiced ? 'text-accent bg-accent/10' : 'text-ink-500 hover:text-ink-300')}
                        >
                          {q.practiced ? '✓ 已练习' : '标记'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* STAR 故事 */}
              {current.myStories.length > 0 && (
                <div className="card p-4">
                  <h4 className="text-xs font-semibold text-ink-300 mb-3 flex items-center gap-2">
                    <span>📖</span> 可复用的 STAR 故事
                  </h4>
                  <ul className="space-y-1.5">
                    {current.myStories.map((s, i) => (
                      <li key={i} className="text-xs text-ink-400 p-2 bg-ink-900/40 rounded-lg whitespace-pre-wrap">{s}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 反问清单 */}
              {current.questionsToAsk.length > 0 && (
                <div className="card p-4">
                  <h4 className="text-xs font-semibold text-ink-300 mb-3 flex items-center gap-2">
                    <span>❓</span> 反问面试官
                  </h4>
                  <ul className="space-y-1.5">
                    {current.questionsToAsk.map((q, i) => (
                      <li key={i} className="text-xs text-ink-400 p-2 bg-ink-900/40 rounded-lg">• {q}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
