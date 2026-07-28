import { useEffect, useState } from 'react';
import { getProfile, listExperiences, saveExperience, deleteExperience, exportAll, importAll, saveProfile } from '@/lib/db';
import { toast, downloadText, cn } from '@/lib/utils';
import SkillInput from '@/components/SkillInput';
import Icon from '@/components/Icon';
import type { CareerProfile, Experience } from '@/types';

const TYPE_LABEL: Record<Experience['type'], string> = {
  work: '工作',
  education: '教育',
  project: '项目',
  skill: '技能',
  award: '奖项'
};

const EMPTY_EXP: Partial<Experience> = {
  type: 'work',
  title: '',
  org: '',
  start: '',
  end: 'present',
  description: '',
  tags: [],
  bullets: []
};

export default function Profile() {
  const [profile, setProfile] = useState<CareerProfile | null>(null);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [editing, setEditing] = useState<Experience | null>(null);
  const [bulletsText, setBulletsText] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [showProfileForm, setShowProfileForm] = useState(false);

  const load = async () => {
    const [p, e] = await Promise.all([getProfile(), listExperiences()]);
    setProfile(p ?? null);
    setExperiences(e);
  };

  useEffect(() => { load(); }, []);

  const startNew = (type: Experience['type']) => {
    setEditing({ ...(EMPTY_EXP as Experience), id: '', type });
    setBulletsText('');
    setTagsText('');
  };

  const startEdit = (e: Experience) => {
    setEditing(e);
    setBulletsText(e.bullets.join('\n'));
    setTagsText(e.tags.join(', '));
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.title.trim()) {
      toast('请填写标题', 'error');
      return;
    }
    const bullets = bulletsText.split('\n').map(s => s.trim()).filter(Boolean);
    const tags = tagsText.split(',').map(s => s.trim()).filter(Boolean);
    await saveExperience({ ...editing, bullets, tags });
    toast('已保存', 'success');
    setEditing(null);
    await load();
  };

  const remove = async (id: string) => {
    if (!confirm('确认删除这条经历？')) return;
    await deleteExperience(id);
    toast('已删除', 'success');
    await load();
  };

  const onExport = async () => {
    const json = await exportAll();
    downloadText(`hunter-ai-backup-${Date.now()}.json`, json, 'application/json');
    toast('已导出全部数据', 'success');
  };

  const onImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        await importAll(text);
        toast('已导入，刷新中...', 'success');
        setTimeout(() => window.location.reload(), 800);
      } catch {
        toast('导入失败：JSON 格式错误', 'error');
      }
    };
    input.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold text-ink-100">职业档案</h1>
          <p className="text-xs md:text-sm text-ink-500 mt-1">长期维护的个人上下文，AI 据此生成针对性简历</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button className="btn-ghost text-xs" onClick={onImport}>导入</button>
          <button className="btn-ghost text-xs" onClick={onExport}>导出</button>
        </div>
      </div>

      {/* 基本信息卡 */}
      <div className="card p-5">
        {profile?.name ? (
          <>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="text-lg font-bold text-ink-100">{profile.name}</h2>
                {profile.headline && <p className="text-sm text-accent mt-0.5">{profile.headline}</p>}
              </div>
              <button className="btn-ghost text-xs" onClick={() => setShowProfileForm(!showProfileForm)}>
                {showProfileForm ? '收起' : '编辑'}
              </button>
            </div>
            {profile.summary && <p className="text-sm text-ink-400 mb-3 whitespace-pre-wrap">{profile.summary}</p>}
            <div className="flex flex-wrap gap-2 text-xs">
              {profile.targetRoles.map(r => <span key={r} className="chip-accent">{r}</span>)}
              {profile.targetCities.map(c => <span key={c} className="chip"><Icon name="map-pin" size={14} /> {c}</span>)}
              {profile.expectedSalary && <span className="chip">💰 {profile.expectedSalary}</span>}
            </div>
            {(profile.contact.email || profile.contact.github || profile.contact.website) && (
              <div className="mt-3 pt-3 border-t border-ink-700 flex flex-wrap gap-3 text-xs text-ink-500">
                {profile.contact.email && <span>✉ {profile.contact.email}</span>}
                {profile.contact.phone && <span>☎ {profile.contact.phone}</span>}
                {profile.contact.github && <span>⌥ {profile.contact.github}</span>}
                {profile.contact.website && <span>◈ {profile.contact.website}</span>}
                {profile.contact.linkedin && <span>in {profile.contact.linkedin}</span>}
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-6">
            <div className="text-4xl mb-2"><Icon name="profile" size={32} /></div>
            <p className="text-ink-400 text-sm mb-3">还没有建立职业档案</p>
            <button className="btn-primary" onClick={() => setShowProfileForm(true)}>立即创建</button>
          </div>
        )}

        {showProfileForm && (
          <ProfileForm
            initial={profile}
            onCancel={() => setShowProfileForm(false)}
            onSaved={async () => { setShowProfileForm(false); await load(); }}
          />
        )}
      </div>

      {/* 经历列表 */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-ink-100">经历池（{experiences.length}）</h2>
          <div className="flex gap-1.5 flex-wrap">
            {(['work', 'education', 'project', 'skill', 'award'] as const).map(t => (
              <button key={t} className="btn-outline text-xs px-2 py-1" onClick={() => startNew(t)}>
                <Icon name="plus" size={14} /> {TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        </div>

        {experiences.length === 0 ? (
          <div className="text-center py-8 text-ink-500 text-sm">
            还没有任何经历。先添加一条工作或项目经历，让 AI 知道你做过什么。
          </div>
        ) : (
          <div className="space-y-2">
            {experiences.map(e => (
              <div key={e.id} className="card-hover p-3 group">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="chip text-[10px]">{TYPE_LABEL[e.type]}</span>
                      <span className="text-sm font-medium text-ink-100">{e.title}</span>
                      <span className="text-xs text-ink-500">@ {e.org}</span>
                    </div>
                    <div className="text-xs text-ink-500 mt-1">{e.start} — {e.end}</div>
                    {e.bullets.length > 0 && (
                      <ul className="mt-2 text-xs text-ink-400 space-y-0.5 list-disc pl-4">
                        {e.bullets.slice(0, 3).map((b, i) => <li key={i}>{b}</li>)}
                        {e.bullets.length > 3 && <li className="text-ink-600">...还有 {e.bullets.length - 3} 条</li>}
                      </ul>
                    )}
                    {e.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {e.tags.map(t => <span key={t} className="chip text-[10px]">{t}</span>)}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0">
                    <button className="btn-ghost text-xs px-2 py-1" onClick={() => startEdit(e)}>编辑</button>
                    <button className="btn-ghost text-xs px-2 py-1 text-red-400" onClick={() => remove(e.id)}>删除</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 编辑弹层 */}
      {editing && (
        <div className="fixed inset-0 bg-ink-900/80 backdrop-blur z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={() => setEditing(null)}>
          <div className="card p-5 max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-t-2xl md:rounded-xl" onClick={e => e.stopPropagation()} style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-ink-100">{editing.id ? '编辑经历' : '新增经历'}</h3>
              <button className="btn-ghost text-xs" onClick={() => setEditing(null)}><Icon name="close" size={14} /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">类型</label>
                  <select
                    className="input"
                    value={editing.type}
                    onChange={e => setEditing({ ...editing, type: e.target.value as Experience['type'] })}
                  >
                    {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">标题 *</label>
                  <input className="input" value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} placeholder="如：高级前端工程师" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="label">组织</label>
                  <input className="input" value={editing.org} onChange={e => setEditing({ ...editing, org: e.target.value })} placeholder="公司/学校" />
                </div>
                <div>
                  <label className="label">开始</label>
                  <input className="input" value={editing.start} onChange={e => setEditing({ ...editing, start: e.target.value })} placeholder="2024-01" />
                </div>
                <div>
                  <label className="label">结束</label>
                  <input className="input" value={editing.end} onChange={e => setEditing({ ...editing, end: e.target.value })} placeholder="present 或 2024-12" />
                </div>
              </div>
              <div>
                <label className="label">量化要点（每行一条，AI 会基于此改写简历）</label>
                <textarea
                  className="textarea min-h-[100px]"
                  value={bulletsText}
                  onChange={e => setBulletsText(e.target.value)}
                  placeholder={'如：\n主导 X 系统 refactor，将首屏加载从 3.2s 降到 1.1s\n带 4 人团队，3 个月交付 Y 项目，营收 +30%'}
                />
              </div>
              <div>
                <label className="label">标签（逗号分隔，支持自动补全）</label>
                <SkillInput value={tagsText} onChange={setTagsText} placeholder="React, TypeScript, 性能优化" />
              </div>
              <div>
                <label className="label">补充描述（可选）</label>
                <textarea
                  className="textarea min-h-[60px]"
                  value={editing.description}
                  onChange={e => setEditing({ ...editing, description: e.target.value })}
                  placeholder="任何想让 AI 知道的背景信息"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button className="btn-ghost" onClick={() => setEditing(null)}>取消</button>
                <button className="btn-primary" onClick={save}>保存</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileForm({ initial, onCancel, onSaved }: { initial: CareerProfile | null; onCancel: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Partial<CareerProfile>>(
    initial ?? {
      name: '', headline: '', summary: '',
      targetRoles: [], targetCities: [], expectedSalary: '',
      contact: {}
    }
  );
  const [rolesText, setRolesText] = useState((initial?.targetRoles ?? []).join(', '));
  const [citiesText, setCitiesText] = useState((initial?.targetCities ?? []).join(', '));

  const save = async () => {
    if (!form.name?.trim()) {
      toast('请填写姓名', 'error');
      return;
    }
    await saveProfile({
      ...form,
      targetRoles: rolesText.split(',').map(s => s.trim()).filter(Boolean),
      targetCities: citiesText.split(',').map(s => s.trim()).filter(Boolean),
      contact: form.contact ?? {}
    });
    toast('档案已保存', 'success');
    onSaved();
  };

  return (
    <div className="mt-4 pt-4 border-t border-ink-700 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">姓名 *</label>
          <input className="input" value={form.name ?? ''} onChange={e => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="label">一句话定位</label>
          <input className="input" value={form.headline ?? ''} onChange={e => setForm({ ...form, headline: e.target.value })} placeholder="如：5 年经验的全栈工程师" />
        </div>
      </div>
      <div>
        <label className="label">自我介绍（长版，让 AI 更懂你）</label>
        <textarea className="textarea" value={form.summary ?? ''} onChange={e => setForm({ ...form, summary: e.target.value })} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">目标岗位（逗号分隔）</label>
          <input className="input" value={rolesText} onChange={e => setRolesText(e.target.value)} placeholder="前端工程师, 全栈工程师" />
        </div>
        <div>
          <label className="label">目标城市（逗号分隔）</label>
          <input className="input" value={citiesText} onChange={e => setCitiesText(e.target.value)} placeholder="北京, 上海, 远程" />
        </div>
      </div>
      <div>
        <label className="label">期望薪资</label>
        <input className="input" value={form.expectedSalary ?? ''} onChange={e => setForm({ ...form, expectedSalary: e.target.value })} placeholder="30-50k" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">邮箱</label>
          <input className="input" value={form.contact?.email ?? ''} onChange={e => setForm({ ...form, contact: { ...form.contact, email: e.target.value } })} />
        </div>
        <div>
          <label className="label">电话</label>
          <input className="input" value={form.contact?.phone ?? ''} onChange={e => setForm({ ...form, contact: { ...form.contact, phone: e.target.value } })} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">GitHub</label>
          <input className="input" value={form.contact?.github ?? ''} onChange={e => setForm({ ...form, contact: { ...form.contact, github: e.target.value } })} />
        </div>
        <div>
          <label className="label">网站</label>
          <input className="input" value={form.contact?.website ?? ''} onChange={e => setForm({ ...form, contact: { ...form.contact, website: e.target.value } })} />
        </div>
      </div>
      <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
        <button className="btn-ghost" onClick={onCancel}>取消</button>
        <button className="btn-primary" onClick={save}>保存档案</button>
      </div>
    </div>
  );
}
