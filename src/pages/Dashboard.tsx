import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listApplications, listExperiences, listInterviews, listResumes, listJobLeads, getProfile } from '@/lib/db';
import { relativeTime, cn } from '@/lib/utils';
import type { Application, CareerProfile, Experience, InterviewPrep, JobLead, ResumeVersion } from '@/types';
import { useStore } from '@/store/useStore';
import Icon, { type IconName } from '@/components/Icon';

const STAGE_LABEL: Record<Application['stage'], { label: string; color: string }> = {
  planning: { label: '准备中', color: 'text-ink-400 bg-ink-700' },
  submitted: { label: '已投递', color: 'text-blue-400 bg-blue-500/10' },
  screening: { label: '筛选中', color: 'text-amber-400 bg-amber-500/10' },
  interview: { label: '面试中', color: 'text-purple-400 bg-purple-500/10' },
  offer: { label: 'Offer', color: 'text-accent bg-accent/10' },
  rejected: { label: '未通过', color: 'text-red-400 bg-red-500/10' },
  withdrawn: { label: '已撤回', color: 'text-ink-500 bg-ink-700' }
};

export default function Dashboard() {
  const [profile, setProfile] = useState<CareerProfile | null>(null);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [resumes, setResumes] = useState<ResumeVersion[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [interviews, setInterviews] = useState<InterviewPrep[]>([]);
  const [jobLeads, setJobLeads] = useState<JobLead[]>([]);
  const aiSettings = useStore((s) => s.aiSettings);

  useEffect(() => {
    (async () => {
      const [p, e, r, a, i, j] = await Promise.all([
        getProfile(),
        listExperiences(),
        listResumes(),
        listApplications(),
        listInterviews(),
        listJobLeads()
      ]);
      setProfile(p ?? null);
      setExperiences(e);
      setResumes(r);
      setApplications(a);
      setInterviews(i);
      setJobLeads(j);
    })();
  }, []);

  const stats: { label: string; value: string | number; to: string; icon: IconName; accent?: boolean }[] = [
    { label: '职业档案', value: profile?.name ? '已建立' : '未建立', to: '/profile', icon: 'profile', accent: !profile?.name },
    { label: 'JD 池', value: jobLeads.length, to: '/jobs', icon: 'jobs' },
    { label: '简历版本', value: resumes.length, to: '/resume', icon: 'resume' },
    { label: '投递记录', value: applications.length, to: '/tracking', icon: 'tracking' },
    { label: '面试准备', value: interviews.length, to: '/interview', icon: 'interview' }
  ];

  const activeApps = applications.filter((a) =>
    ['submitted', 'screening', 'interview'].includes(a.stage)
  );

  const offerCount = applications.filter((a) => a.stage === 'offer').length;
  const rejectCount = applications.filter((a) => a.stage === 'rejected').length;
  const totalApplied = applications.filter((a) => a.stage !== 'planning').length;
  const successRate = totalApplied > 0 ? ((offerCount / totalApplied) * 100).toFixed(0) : '0';

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="card p-5 md:p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-2 text-xs text-accent mb-2 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            HUNTER OS · LOCAL FIRST
          </div>
          <h1 className="text-xl md:text-3xl font-bold text-ink-100 mb-2">
            {profile?.name ? `你好，${profile.name}` : '欢迎，开始你的求职 Agent'}
          </h1>
          <p className="text-ink-400 text-xs md:text-sm max-w-2xl">
            粘贴 JD → 一键生成专属简历 → 拆解面试题 → 追踪投递。所有数据存浏览器，不上云。
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            <Link to="/jobs" className="btn-primary text-xs md:text-sm">
              <Icon name="jobs" size={14} className="inline-block mr-1 align-[-2px]" /> 导入 JD 找匹配
            </Link>
            <Link to="/resume" className="btn-outline text-xs md:text-sm">
              <Icon name="sparkles" size={14} className="inline-block mr-1 align-[-2px]" /> 粘贴 JD 生成简历
            </Link>
            {!profile?.name && (
              <Link to="/profile" className="btn-ghost text-xs md:text-sm">
                <Icon name="profile" size={14} className="inline-block mr-1 align-[-2px]" /> 先建立职业档案
              </Link>
            )}
            <Link to="/chat" className="btn-ghost text-xs md:text-sm">
              <Icon name="chat" size={14} className="inline-block mr-1 align-[-2px]" /> 与 AI 求职教练对话
            </Link>
          </div>
        </div>
      </div>

      {/* AI 配置状态 */}
      {!aiSettings?.apiKey && aiSettings?.provider !== 'trial' && (
        <div className="card p-4 border-amber-500/30 bg-amber-500/5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Icon name="alert" size={18} className="text-amber-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-sm text-ink-100 font-medium">未配置 AI</div>
              <div className="text-xs text-ink-400">使用 Trial 模式（每日配额）或填写自己的 API Key</div>
            </div>
          </div>
          <Link to="/settings" className="btn-outline text-xs shrink-0">前往设置</Link>
        </div>
      )}

      {/* 统计 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {stats.map((s) => (
          <Link key={s.label} to={s.to} className={cn('card-hover p-4 group', s.accent && 'border-amber-500/30')}>
            <div className="text-xs text-ink-500 mb-1 flex items-center gap-1">
              <Icon name={s.icon} size={14} />
              {s.label}
            </div>
            <div className={cn('text-xl font-bold', s.accent ? 'text-amber-400' : 'text-ink-100')}>
              {s.value}
            </div>
          </Link>
        ))}
      </div>

      {/* 漏斗 */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-ink-100">投递漏斗</h2>
          <Link to="/tracking" className="text-xs text-accent hover:underline">查看全部 →</Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-center">
          {[
            { label: '已投递', value: totalApplied, color: 'text-blue-400' },
            { label: '筛选中', value: applications.filter(a => a.stage === 'screening').length, color: 'text-amber-400' },
            { label: '面试中', value: applications.filter(a => a.stage === 'interview').length, color: 'text-purple-400' },
            { label: 'Offer', value: offerCount, color: 'text-accent' },
            { label: '成功率', value: `${successRate}%`, color: 'text-accent-glow' }
          ].map((s) => (
            <div key={s.label} className="bg-ink-900/40 rounded-lg p-3">
              <div className={cn('text-2xl font-bold', s.color)}>{s.value}</div>
              <div className="text-xs text-ink-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 活跃投递 */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-ink-100">活跃投递</h2>
          {activeApps.length === 0 && <span className="text-xs text-ink-500">暂无活跃投递</span>}
        </div>
        <div className="space-y-2">
          {activeApps.slice(0, 5).map((a) => (
            <Link key={a.id} to="/tracking" className="block card-hover p-3 flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-sm font-medium text-ink-100 truncate">
                  {a.jobTitle} <span className="text-ink-500">@ {a.company}</span>
                </div>
                <div className="text-xs text-ink-500 mt-0.5">
                  {a.nextAction ? `下一步：${a.nextAction}` : '更新于 ' + relativeTime(a.updatedAt)}
                </div>
              </div>
              <span className={cn('chip', STAGE_LABEL[a.stage].color)}>{STAGE_LABEL[a.stage].label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* 最近的简历 */}
      {resumes.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-ink-100">最近的简历版本</h2>
            <Link to="/resume" className="text-xs text-accent hover:underline">查看全部 →</Link>
          </div>
          <div className="grid md:grid-cols-2 gap-2">
            {resumes.slice(0, 4).map((r) => (
              <Link key={r.id} to={`/resume/${r.id}`} className="block card-hover p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-ink-100 truncate">
                    {r.jobTitle} @ {r.company}
                  </div>
                  {r.matchScore != null && (
                    <span className="chip-accent">{r.matchScore}分</span>
                  )}
                </div>
                <div className="text-xs text-ink-500 mt-1">{relativeTime(r.updatedAt)}</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="text-center text-xs text-ink-600 pt-4">
        Hunter AI · 灵感来自 CV.PRO + devpath-ai · 本地优先 · 你的数据归你所有
      </div>
    </div>
  );
}
