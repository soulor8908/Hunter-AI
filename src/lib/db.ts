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
  ResumeVersion
} from '@/types';

const DB_NAME = 'hunter-ai';
const DB_VERSION = 1;

interface HunterDB extends DBSchema {
  profile: { key: string; value: CareerProfile };
  experience: { key: string; value: Experience; indexes: { 'by-type': string } };
  resume: { key: string; value: ResumeVersion; indexes: { 'by-profile': string } };
  application: { key: string; value: Application; indexes: { 'by-stage': string } };
  interview: { key: string; value: InterviewPrep };
  chat: { key: string; value: ChatSession };
  aiSettings: { key: string; value: AISettings & { id: string } };
}

let dbPromise: Promise<IDBPDatabase<HunterDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<HunterDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('profile')) {
          db.createObjectStore('profile', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('experience')) {
          const s = db.createObjectStore('experience', { keyPath: 'id' });
          s.createIndex('by-type', 'type');
        }
        if (!db.objectStoreNames.contains('resume')) {
          const s = db.createObjectStore('resume', { keyPath: 'id' });
          s.createIndex('by-profile', 'profileId');
        }
        if (!db.objectStoreNames.contains('application')) {
          const s = db.createObjectStore('application', { keyPath: 'id' });
          s.createIndex('by-stage', 'stage');
        }
        if (!db.objectStoreNames.contains('interview')) {
          db.createObjectStore('interview', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('chat')) {
          db.createObjectStore('chat', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('aiSettings')) {
          db.createObjectStore('aiSettings', { keyPath: 'id' });
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
  const [profile, experiences, resumes, applications, interviews, chats] = await Promise.all([
    db.get('profile', 'default'),
    db.getAll('experience'),
    db.getAll('resume'),
    db.getAll('application'),
    db.getAll('interview'),
    db.getAll('chat')
  ]);
  return JSON.stringify({
    version: DB_VERSION,
    exportedAt: new Date().toISOString(),
    profile,
    experiences,
    resumes,
    applications,
    interviews,
    chats
  }, null, 2);
}

export async function importAll(json: string): Promise<void> {
  const db = await getDB();
  const data = JSON.parse(json);
  const tx = db.transaction(['profile', 'experience', 'resume', 'application', 'interview', 'chat'], 'readwrite');
  if (data.profile) await tx.objectStore('profile').put(data.profile);
  for (const e of data.experiences ?? []) await tx.objectStore('experience').put(e);
  for (const r of data.resumes ?? []) await tx.objectStore('resume').put(r);
  for (const a of data.applications ?? []) await tx.objectStore('application').put(a);
  for (const i of data.interviews ?? []) await tx.objectStore('interview').put(i);
  for (const c of data.chats ?? []) await tx.objectStore('chat').put(c);
  await tx.done;
}
