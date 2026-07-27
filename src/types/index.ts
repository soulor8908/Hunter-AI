// Hunter AI 类型定义
// 数据模型遵循"职业上下文 → 一岗一简历 → 投递即学习"三角

// ============ AI 配置 ============
export type AIProvider = 'openai' | 'anthropic' | 'deepseek' | 'trial';

export interface AISettings {
  provider: AIProvider;
  apiKey: string;          // 仅存浏览器 IndexedDB，零信任
  model: string;
  baseUrl?: string;        // 自定义端点（兼容 OpenAI 协议的服务）
  temperature: number;
}

// ============ 职业档案（长期上下文） ============
export interface Experience {
  id: string;
  type: 'work' | 'education' | 'project' | 'skill' | 'award';
  title: string;           // 职位/学位/项目名/技能/奖项
  org: string;             // 公司/学校/组织
  start: string;           // YYYY-MM
  end: string;             // YYYY-MM 或 'present'
  description: string;     // 详细描述（成就量化）
  tags: string[];          // 技能标签
  bullets: string[];       // 量化要点列表
  createdAt: number;
  updatedAt: number;
}

export interface CareerProfile {
  id: string;              // 固定为 'default'
  name: string;
  headline: string;        // 一句话定位
  summary: string;         // 长版自我介绍
  targetRoles: string[];   // 目标岗位
  targetCities: string[];
  expectedSalary: string;
  contact: {
    email?: string;
    phone?: string;
    github?: string;
    website?: string;
    linkedin?: string;
  };
  createdAt: number;
  updatedAt: number;
}

// ============ 简历版本（一岗一简历） ============
export type ResumeStatus = 'draft' | 'finalized';

export interface ResumeVersion {
  id: string;
  profileId: string;
  jobTitle: string;        // 目标岗位
  company: string;
  jdText: string;          // 原始 JD
  jdAnalysis?: JDAnalysis; // AI 对 JD 的拆解
  markdown: string;        // AI 生成的简历 Markdown
  status: ResumeStatus;
  shareId?: string;        // 分享 ID（可生成独立分享网页）
  matchScore?: number;     // JD 匹配度评分 0-100
  createdAt: number;
  updatedAt: number;
}

export interface JDAnalysis {
  keywords: string[];           // 关键技能词
  responsibilities: string[];   // 核心职责
  requirements: string[];       // 硬性要求
  niceToHaves: string[];        // 加分项
  redFlags: string[];           // 警示信号
  cultureHints: string[];       // 团队文化推断
  interviewFocus: string[];     // 推测面试考察点
}

// ============ 投递追踪 ============
export type ApplicationStage =
  | 'planning'    // 准备中
  | 'submitted'   // 已投递
  | 'screening'   // 简历筛选
  | 'interview'   // 面试中
  | 'offer'       // offer
  | 'rejected'    // 拒绝
  | 'withdrawn';  // 撤回

export interface Application {
  id: string;
  resumeId?: string;       // 关联的简历版本
  company: string;
  jobTitle: string;
  jdText?: string;
  stage: ApplicationStage;
  source?: string;         // 渠道：boss/liepin/ referral...
  appliedAt?: number;
  stages: {
    stage: ApplicationStage;
    at: number;
    note?: string;
  }[];
  nextAction?: string;     // 下一步动作
  nextActionAt?: number;   // 下一步时间
  reflection?: string;     // 复盘（投递即学习）
  createdAt: number;
  updatedAt: number;
}

// ============ 面试准备 ============
export interface InterviewPrep {
  id: string;
  applicationId?: string;
  resumeId?: string;
  jobTitle: string;
  company: string;
  jdText: string;
  questions: InterviewQuestion[];
  myStories: string[];     // STAR 故事
  questionsToAsk: string[]; // 反问清单
  createdAt: number;
  updatedAt: number;
}

export interface InterviewQuestion {
  id: string;
  category: 'behavioral' | 'technical' | 'case' | 'deep' | 'culture';
  question: string;
  intent: string;          // 考察意图
  suggestedAnswer?: string; // 建议答题方向
  difficulty: 'easy' | 'medium' | 'hard';
  practiced: boolean;
}

// ============ AI 对话 ============
export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  context?: {
    resumeId?: string;
    applicationId?: string;
    interviewId?: string;
  };
  createdAt: number;
  updatedAt: number;
}

// ============ Trial 配额 ============
export interface TrialQuota {
  ip: string;
  date: string;            // YYYY-MM-DD
  used: number;
  limit: number;
}
