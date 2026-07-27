import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listApplications, saveApplication, deleteApplication, listResumes } from '@/lib/db';
import { toast, cn, formatDateShort, relativeTime } from '@/lib/utils';
import type { Application, ApplicationStage, ResumeVersion } from '@/types';

const STAGES: { key: ApplicationStage; label: string; border: string; dot: string }[] = [
  { key: 'planning', label: '准备中', border: 'border-ink-600', dot: 'bg-ink-500' },
  { key: 'submitted', label: '已投递', border: 'border-blue-500', dot: 'bg-blue-400' },
  { key: 'screening', label: '筛选中', border: 'border-amber-500', dot: 'bg-amber-400' },
  { key: 'interview', label: '面试中', border: 'border-purple-500', dot: 'bg-purple-400' },
  { key: 'offer', label: 'Offer', border: 'border-accent', dot: 'bg-accent' },
  { key: 'rejected', label: '未通过', border: 'border-red-500', dot: 'bg-red-400' },
  { key: 'withdrawn', label: '已撤回', border: 'border-ink-700', dot: 'bg-ink-600' }
];

export default function Tracking() {
  const nav = useNavigate();
  const [apps, setApps] = useState<Application[]>([]);
  const [resumes, setResumes] = useState<ResumeVersion[]>([]);
  const [editing, setEditing] = useState<Application | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    const [a, r] = await Promise.all([listApplications(), listResumes()]);
    setApps(a);
    setResumes(r);
  };

  useEffect(() => { load(); }, []);

  const grouped = STAGES.map(s => ({
    ...s,
    items: apps.filter(a => a.stage === s.key)
  }));

  const stats = {
    total: apps.length,
    active: apps.filter(a => ['submitted', 'screening', 'interview'].includes(a.stage)).length,
    offer: apps.filter(a => a.stage === 'offer').length,
    rate: apps.length > 0
      ? ((apps.filter(a => a.stage === 'offer').length / apps.filter(a => a.stage !== 'planning').length || 0) * 100).toFixed(0)
      : '0'
  };

  const moveStage = async (id: string, stage: ApplicationStage) => {
    const app = apps.find(a => a.id === id);
    if (!app) return;
    await saveApplication({ ...app, stage });
    await load();
    toast(`已移动到「${STAGES.find(s => s.key === stage)?.label}」`, 'success');
  };

  const remove = async (id: string) => {
    if (!confirm('确认删除这条投递记录？')) return;
    await deleteApplication(id);
    await load();
    toast('已删除', 'success');
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold text-ink-100">投递追踪</h1>
          <p className="text-xs md:text-sm text-ink-500 mt-1">看板视图 · 每次状态变更都是一次学习</p>
        </div>
        <button className="btn-primary text-xs shrink-0" onClick={() => { setEditing(null); setShowForm(true); }}>
          + 新增
        </button>
      </div>

      {/* 统计条 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <StatCard label="总投递" value={stats.total} color="text-ink-100" />
        <StatCard label="进行中" value={stats.active} color="text-blue-400" />
        <StatCard label="Offer" value={stats.offer} color="text-accent" />
        <StatCard label="成功率" value={`${stats.rate}%`} color="text-accent-glow" />
      </div>

      {/* 看板 — 移动端横向滚动，桌面端网格 */}
      <div className="flex md:grid md:grid-cols-4 lg:grid-cols-7 gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 snap-x snap-mandatory">
        {grouped.map(col => (
          <div key={col.key} className="min-w-[75vw] sm:min-w-[220px] md:min-w-0 snap-start shrink-0 md:shrink">
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="flex items-center gap-1.5">
                <span className={cn('w-1.5 h-1.5 rounded-full', col.dot)} />
                <span className="text-xs font-medium text-ink-300">{col.label}</span>
              </div>
              <span className="text-[10px] text-ink-500">{col.items.length}</span>
            </div>
            <div className={cn('space-y-1.5 border-t-2 pt-2 min-h-[60px]', col.border)}>
              {col.items.length === 0 ? (
                <div className="text-[10px] text-ink-600 text-center py-4">—</div>
              ) : col.items.map(a => (
                <div key={a.id} className="card-hover p-2.5 group cursor-pointer" onClick={() => { setEditing(a); setShowForm(true); }}>
                  <div className="text-xs font-medium text-ink-100 truncate">{a.jobTitle}</div>
                  <div className="text-[10px] text-ink-500 truncate">@ {a.company}</div>
                  {a.nextAction && (
                    <div className="text-[10px] text-amber-400 mt-1 truncate">→ {a.nextAction}</div>
                  )}
                  <div className="text-[9px] text-ink-600 mt-1">{relativeTime(a.updatedAt)}</div>
                  {/* 移动端常显，桌面端 hover 显示 */}
                  <div className="flex gap-1 mt-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <select
                      className="text-[10px] bg-ink-700 border border-ink-600 rounded px-1 py-0.5 text-ink-300 min-h-[24px]"
                      value={a.stage}
                      onClick={e => e.stopPropagation()}
                      onChange={e => moveStage(a.id, e.target.value as ApplicationStage)}
                    >
                      {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                    <button
                      className="text-[10px] text-red-400 px-1.5 py-0.5 min-h-[24px]"
                      onClick={(e) => { e.stopPropagation(); remove(a.id); }}
                    >✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 编辑/新增表单 */}
      {showForm && (
        <AppForm
          initial={editing}
          resumes={resumes}
          onClose={() => setShowForm(false)}
          onSaved={async () => { setShowForm(false); await load(); }}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="card p-3 text-center">
      <div className={cn('text-xl font-bold', color)}>{value}</div>
      <div className="text-[10px] text-ink-500 mt-0.5">{label}</div>
    </div>
  );
}

function AppForm({ initial, resumes, onClose, onSaved }: {
  initial: Application | null;
  resumes: ResumeVersion[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<Application>>(
    initial ?? { company: '', jobTitle: '', stage: 'planning', jdText: '', source: '', nextAction: '', reflection: '' }
  );
  const [nextActionAt, setNextActionAt] = useState(
    initial?.nextActionAt ? new Date(initial.nextActionAt).toISOString().slice(0, 10) : ''
  );

  const save = async () => {
    if (!form.company?.trim() || !form.jobTitle?.trim()) {
      toast('请填写公司和岗位', 'error');
      return;
    }
    await saveApplication({
      ...form,
      id: initial?.id,
      stage: form.stage ?? 'planning',
      company: form.company!,
      jobTitle: form.jobTitle!,
      nextActionAt: nextActionAt ? new Date(nextActionAt).getTime() : undefined
    } as Partial<Application> & { company: string; jobTitle: string; stage: ApplicationStage });
    toast('已保存', 'success');
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-ink-900/80 backdrop-blur z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div className="card p-5 max-w-xl w-full max-h-[90vh] overflow-y-auto rounded-t-2xl md:rounded-xl" onClick={e => e.stopPropagation()} style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-ink-100">{initial ? '编辑投递' : '新增投递'}</h3>
          <button className="btn-ghost text-xs" onClick={onClose}>✕</button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">公司 *</label>
              <input className="input" value={form.company ?? ''} onChange={e => setForm({ ...form, company: e.target.value })} />
            </div>
            <div>
              <label className="label">岗位 *</label>
              <input className="input" value={form.jobTitle ?? ''} onChange={e => setForm({ ...form, jobTitle: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">当前阶段</label>
              <select className="input" value={form.stage} onChange={e => setForm({ ...form, stage: e.target.value as ApplicationStage })}>
                {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">渠道</label>
              <input className="input" value={form.source ?? ''} onChange={e => setForm({ ...form, source: e.target.value })} placeholder="BOSS / 内推 / 官网" />
            </div>
          </div>
          <div>
            <label className="label">关联简历版本</label>
            <select className="input" value={form.resumeId ?? ''} onChange={e => setForm({ ...form, resumeId: e.target.value || undefined })}>
              <option value="">不关联</option>
              {resumes.map(r => <option key={r.id} value={r.id}>{r.jobTitle} @ {r.company}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">下一步动作</label>
              <input className="input" value={form.nextAction ?? ''} onChange={e => setForm({ ...form, nextAction: e.target.value })} placeholder="如：周三前发送作品集" />
            </div>
            <div>
              <label className="label">下一步时间</label>
              <input type="date" className="input" value={nextActionAt} onChange={e => setNextActionAt(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">JD（可选，便于后续生成面试题）</label>
            <textarea className="textarea min-h-[80px]" value={form.jdText ?? ''} onChange={e => setForm({ ...form, jdText: e.target.value })} />
          </div>
          <div>
            <label className="label">复盘（投递即学习）</label>
            <textarea className="textarea min-h-[60px]" value={form.reflection ?? ''} onChange={e => setForm({ ...form, reflection: e.target.value })} placeholder="这次投递的得失、可复用经验" />
          </div>

          {initial && initial.stages.length > 0 && (
            <div>
              <label className="label">状态历史</label>
              <div className="space-y-1">
                {initial.stages.map((s, i) => (
                  <div key={i} className="text-xs text-ink-500 flex justify-between">
                    <span>{STAGES.find(st => st.key === s.stage)?.label}</span>
                    <span>{formatDateShort(s.at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-ghost" onClick={onClose}>取消</button>
            <button className="btn-primary" onClick={save}>保存</button>
          </div>
        </div>
      </div>
    </div>
  );
}
