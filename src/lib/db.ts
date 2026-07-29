// Hunter AI — IndexedDB 数据层
// 本地优先：所有数据存浏览器，不上云。用户隐私第一。
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { nanoid } from 'nanoid';
import type {
  AISettings,
  Application,
  CareerProfile,
  ChatSession,
  Experience,
  InterviewPrep,
  JobLead,
  ResumeVersion
} from '@/types';

const DB_NAME = 'hunter-ai';
const DB_VERSION = 2;

interface HunterDB extends DBSchema {
  profile: { key: string; value: CareerProfile };
  experience: { key: string; value: Experience; indexes: { 'by-type': string } };
  resume: { key: string; value: ResumeVersion; indexes: { 'by-profile': string } };
  application: { key: string; value: Application; indexes: { 'by-stage': string } };
  interview: { key: string; value: InterviewPrep };
  chat: { key: string; value: ChatSession };
  aiSettings: { key: string; value: AISettings & { id: string } };
  jobLead: { key: string; value: JobLead; indexes: { 'by-status': string } };
}

let dbPromise: Promise<IDBPDatabase<HunterDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<HunterDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // v1 初始 stores
        if (oldVersion < 1) {
          db.createObjectStore('profile', { keyPath: 'id' });
          const exp = db.createObjectStore('experience', { keyPath: 'id' });
          exp.createIndex('by-type', 'type');
          const res = db.createObjectStore('resume', { keyPath: 'id' });
          res.createIndex('by-profile', 'profileId');
          const app = db.createObjectStore('application', { keyPath: 'id' });
          app.createIndex('by-stage', 'stage');
          db.createObjectStore('interview', { keyPath: 'id' });
          db.createObjectStore('chat', { keyPath: 'id' });
          db.createObjectStore('aiSettings', { keyPath: 'id' });
        }
        // v2: 加 jobLead store（JD 池 + 匹配推荐）
        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains('jobLead')) {
            const s = db.createObjectStore('jobLead', { keyPath: 'id' });
            s.createIndex('by-status', 'status');
          }
        }
      }
    });
  }
  return dbPromise;
}

// ============ 职业档案 ============
export async function getProfile(): Promise<CareerProfile | undefined> {
  const db = await getDB();
  return db.get('profile', 'default');
}

export async function saveProfile(p: Partial<CareerProfile>): Promise<CareerProfile> {
  const db = await getDB();
  const now = Date.now();
  const existing = await db.get('profile', 'default');
  const merged: CareerProfile = {
    id: 'default',
    name: p.name ?? existing?.name ?? '',
    headline: p.headline ?? existing?.headline ?? '',
    summary: p.summary ?? existing?.summary ?? '',
    targetRoles: p.targetRoles ?? existing?.targetRoles ?? [],
    targetCities: p.targetCities ?? existing?.targetCities ?? [],
    expectedSalary: p.expectedSalary ?? existing?.expectedSalary ?? '',
    contact: p.contact ?? existing?.contact ?? {},
    // embedding 字段：显式传入时更新，否则保留旧值
    embedding: p.embedding !== undefined ? p.embedding : existing?.embedding,
    embeddingTextHash: p.embeddingTextHash !== undefined ? p.embeddingTextHash : existing?.embeddingTextHash,
    embeddingUpdatedAt: p.embeddingUpdatedAt !== undefined ? p.embeddingUpdatedAt : existing?.embeddingUpdatedAt,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };
  await db.put('profile', merged);
  return merged;
}

// ============ 经历 ============
export async function listExperiences(): Promise<Experience[]> {
  const db = await getDB();
  const all = await db.getAll('experience');
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveExperience(e: Partial<Experience> & { type: Experience['type']; title: string }): Promise<Experience> {
  const db = await getDB();
  const now = Date.now();
  const id = e.id ?? nanoid();
  const existing = e.id ? await db.get('experience', e.id) : undefined;
  const merged: Experience = {
    id,
    type: e.type,
    title: e.title,
    org: e.org ?? existing?.org ?? '',
    start: e.start ?? existing?.start ?? '',
    end: e.end ?? existing?.end ?? '',
    description: e.description ?? existing?.description ?? '',
    tags: e.tags ?? existing?.tags ?? [],
    bullets: e.bullets ?? existing?.bullets ?? [],
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };
  await db.put('experience', merged);
  return merged;
}

export async function deleteExperience(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('experience', id);
}

// ============ 简历版本 ============
export async function listResumes(): Promise<ResumeVersion[]> {
  const db = await getDB();
  const all = await db.getAll('resume');
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getResume(id: string): Promise<ResumeVersion | undefined> {
  const db = await getDB();
  return db.get('resume', id);
}

export async function saveResume(r: Partial<ResumeVersion> & { jobTitle: string; company: string; jdText: string }): Promise<ResumeVersion> {
  const db = await getDB();
  const now = Date.now();
  const id = r.id ?? nanoid();
  const existing = r.id ? await db.get('resume', r.id) : undefined;
  const merged: ResumeVersion = {
    id,
    profileId: r.profileId ?? existing?.profileId ?? 'default',
    jobTitle: r.jobTitle,
    company: r.company,
    jdText: r.jdText,
    jdAnalysis: r.jdAnalysis ?? existing?.jdAnalysis,
    markdown: r.markdown ?? existing?.markdown ?? '',
    status: r.status ?? existing?.status ?? 'draft',
    shareId: r.shareId ?? existing?.shareId,
    matchScore: r.matchScore ?? existing?.matchScore,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };
  await db.put('resume', merged);
  return merged;
}

export async function deleteResume(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('resume', id);
}

// ============ 投递 ============
export async function listApplications(): Promise<Application[]> {
  const db = await getDB();
  const all = await db.getAll('application');
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveApplication(a: Partial<Application> & { company: string; jobTitle: string; stage: Application['stage'] }): Promise<Application> {
  const db = await getDB();
  const now = Date.now();
  const id = a.id ?? nanoid();
  const existing = a.id ? await db.get('application', a.id) : undefined;
  const prevStage = existing?.stage;
  const newStage = a.stage ?? prevStage ?? 'planning';
  const stages = existing?.stages ?? [];

  // 阶段切换时记录历史
  if (a.stage && a.stage !== prevStage) {
    stages.push({ stage: a.stage, at: now, note: a.reflection });
  }

  const merged: Application = {
    id,
    resumeId: a.resumeId ?? existing?.resumeId,
    company: a.company,
    jobTitle: a.jobTitle,
    jdText: a.jdText ?? existing?.jdText,
    stage: newStage,
    source: a.source ?? existing?.source,
    appliedAt: a.appliedAt ?? existing?.appliedAt ?? (newStage !== 'planning' ? now : undefined),
    stages,
    nextAction: a.nextAction ?? existing?.nextAction,
    nextActionAt: a.nextActionAt ?? existing?.nextActionAt,
    reflection: a.reflection ?? existing?.reflection,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };
  await db.put('application', merged);
  return merged;
}

export async function deleteApplication(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('application', id);
}

// ============ 面试准备 ============
export async function listInterviews(): Promise<InterviewPrep[]> {
  const db = await getDB();
  const all = await db.getAll('interview');
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveInterview(i: Partial<InterviewPrep> & { jobTitle: string; company: string; jdText: string }): Promise<InterviewPrep> {
  const db = await getDB();
  const now = Date.now();
  const id = i.id ?? nanoid();
  const existing = i.id ? await db.get('interview', i.id) : undefined;
  const merged: InterviewPrep = {
    id,
    applicationId: i.applicationId ?? existing?.applicationId,
    resumeId: i.resumeId ?? existing?.resumeId,
    jobTitle: i.jobTitle,
    company: i.company,
    jdText: i.jdText,
    questions: i.questions ?? existing?.questions ?? [],
    myStories: i.myStories ?? existing?.myStories ?? [],
    questionsToAsk: i.questionsToAsk ?? existing?.questionsToAsk ?? [],
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };
  await db.put('interview', merged);
  return merged;
}

export async function deleteInterview(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('interview', id);
}

// ============ 聊天会话 ============
export async function listChats(): Promise<ChatSession[]> {
  const db = await getDB();
  const all = await db.getAll('chat');
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveChat(c: Partial<ChatSession> & { title: string }): Promise<ChatSession> {
  const db = await getDB();
  const now = Date.now();
  const id = c.id ?? nanoid();
  const existing = c.id ? await db.get('chat', c.id) : undefined;
  const merged: ChatSession = {
    id,
    title: c.title,
    messages: c.messages ?? existing?.messages ?? [],
    context: c.context ?? existing?.context,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };
  await db.put('chat', merged);
  return merged;
}

export async function deleteChat(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('chat', id);
}

// ============ AI 设置（仅存浏览器） ============
export async function getAISettings(): Promise<AISettings> {
  const db = await getDB();
  const row = await db.get('aiSettings', 'default');
  return row ?? { provider: 'trial', apiKey: '', model: 'deepseek-chat', temperature: 0.7 };
}

export async function saveAISettings(s: AISettings): Promise<void> {
  const db = await getDB();
  await db.put('aiSettings', { ...s, id: 'default' });
}

// ============ 导出/导入（用户主权） ============
export async function exportAll(): Promise<string> {
  const db = await getDB();
  const [profile, experiences, resumes, applications, interviews, chats, jobLeads] = await Promise.all([
    db.get('profile', 'default'),
    db.getAll('experience'),
    db.getAll('resume'),
    db.getAll('application'),
    db.getAll('interview'),
    db.getAll('chat'),
    db.getAll('jobLead')
  ]);
  return JSON.stringify({
    version: DB_VERSION,
    exportedAt: new Date().toISOString(),
    profile,
    experiences,
    resumes,
    applications,
    interviews,
    chats,
    jobLeads
  }, null, 2);
}

/**
 * 校验导入文件结构。返回错误消息字符串；通过校验返回 null。
 * 不做深度类型校验（避免运行时开销），只挡明显畸形数据，防止后续渲染崩溃。
 */
function validateBackup(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return '文件根节点不是对象';
  const d = data as Record<string, unknown>;
  if (typeof d.version !== 'number') return '缺少 version 字段或类型错误';
  if (d.version > DB_VERSION) return `文件版本 v${d.version} 高于当前支持 v${DB_VERSION}，请升级应用`;
  const arrStores = ['experiences', 'resumes', 'applications', 'interviews', 'chats', 'jobLeads'];
  for (const k of arrStores) {
    if (k in d && !Array.isArray(d[k])) return `字段 "${k}" 必须为数组`;
  }
  return null;
}

export async function importAll(json: string): Promise<void> {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('JSON 解析失败：文件不是合法的 JSON');
  }
  const err = validateBackup(data);
  if (err) throw new Error(`备份文件格式无效：${err}`);

  const d = data as {
    profile?: CareerProfile;
    experiences?: Experience[];
    resumes?: ResumeVersion[];
    applications?: Application[];
    interviews?: InterviewPrep[];
    chats?: ChatSession[];
    jobLeads?: JobLead[];
  };

  const db = await getDB();
  const tx = db.transaction(['profile', 'experience', 'resume', 'application', 'interview', 'chat', 'jobLead'], 'readwrite');
  if (d.profile) await tx.objectStore('profile').put(d.profile);
  for (const e of d.experiences ?? []) await tx.objectStore('experience').put(e);
  for (const r of d.resumes ?? []) await tx.objectStore('resume').put(r);
  for (const a of d.applications ?? []) await tx.objectStore('application').put(a);
  for (const i of d.interviews ?? []) await tx.objectStore('interview').put(i);
  for (const c of d.chats ?? []) await tx.objectStore('chat').put(c);
  for (const j of d.jobLeads ?? []) await tx.objectStore('jobLead').put(j);
  await tx.done;
}

// ============ JD 池（JobLead） ============
export async function listJobLeads(): Promise<JobLead[]> {
  const db = await getDB();
  const all = await db.getAll('jobLead');
  return all.sort((a, b) => b.importedAt - a.importedAt);
}

export async function getJobLead(id: string): Promise<JobLead | undefined> {
  const db = await getDB();
  return db.get('jobLead', id);
}

export async function saveJobLead(j: Partial<JobLead> & { jobTitle: string; company: string; jdText: string }): Promise<JobLead> {
  const db = await getDB();
  const now = Date.now();
  const id = j.id ?? nanoid();
  const existing = j.id ? await db.get('jobLead', j.id) : undefined;
  const merged: JobLead = {
    id,
    jobTitle: j.jobTitle,
    company: j.company,
    jdText: j.jdText,
    source: j.source ?? existing?.source ?? 'manual',
    sourceUrl: j.sourceUrl ?? existing?.sourceUrl,
    city: j.city ?? existing?.city,
    salary: j.salary ?? existing?.salary,
    jdAnalysis: j.jdAnalysis ?? existing?.jdAnalysis,
    embedding: j.embedding ?? existing?.embedding,
    matchScore: j.matchScore ?? existing?.matchScore,
    matchReasons: j.matchReasons ?? existing?.matchReasons,
    status: j.status ?? existing?.status ?? 'new',
    fromSharedPool: j.fromSharedPool ?? existing?.fromSharedPool,
    importedAt: existing?.importedAt ?? now,
    updatedAt: now
  };
  await db.put('jobLead', merged);
  return merged;
}

export async function deleteJobLead(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('jobLead', id);
}
