// Hunter AI — 匹配引擎
// 卡帕西式：纯函数，无副作用，可测试。
// 评分组合：语义相似度（embedding cosine）+ 硬技能命中 + 城市硬过滤 + 薪资带匹配
import type { CareerProfile, Experience, JobLead } from '@/types';

/**
 * 余弦相似度。空向量返回 0。
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length === 0 || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}

/**
 * 用 djb2 哈希文本，用于判断 embedding 是否需要重算。
 */
export function hashText(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h) + text.charCodeAt(i);
    h = h & 0xffffffff;
  }
  return (h >>> 0).toString(16);
}

/**
 * 拼接画像为 embedding 输入文本。结构化，避免噪声。
 */
export function buildProfileText(p: CareerProfile, experiences: Experience[]): string {
  const parts: string[] = [];
  if (p.headline) parts.push(`定位：${p.headline}`);
  if (p.summary) parts.push(`简介：${p.summary}`);
  if (p.targetRoles?.length) parts.push(`目标岗位：${p.targetRoles.join('、')}`);
  if (p.targetCities?.length) parts.push(`目标城市：${p.targetCities.join('、')}`);
  if (p.expectedSalary) parts.push(`期望薪资：${p.expectedSalary}`);

  const expText = experiences
    .map(e => {
      const tags = e.tags?.length ? `[${e.tags.join(',')}]` : '';
      const bullets = e.bullets?.length ? '\n' + e.bullets.map(b => `- ${b}`).join('\n') : '';
      return `${e.title} @ ${e.org}${tags}（${e.start ?? ''} ~ ${e.end ?? ''}）${bullets}`;
    })
    .join('\n\n');
  if (expText) parts.push(`经历：\n${expText}`);

  return parts.join('\n\n');
}

/**
 * 拼接 JobLead 为 embedding 输入文本。
 */
export function buildJobLeadText(j: Pick<JobLead, 'jobTitle' | 'company' | 'jdText' | 'city' | 'salary'>): string {
  const parts: string[] = [];
  parts.push(`${j.jobTitle} @ ${j.company}`);
  if (j.city) parts.push(`城市：${j.city}`);
  if (j.salary) parts.push(`薪资：${j.salary}`);
  if (j.jdText) parts.push(`JD：${j.jdText.slice(0, 2000)}`); // 截断防止超 token
  return parts.join('\n');
}

/**
 * 技能标签集合（从经历 tags 汇总）。
 */
export function collectSkillTags(experiences: Experience[]): Set<string> {
  const set = new Set<string>();
  for (const e of experiences) {
    for (const t of e.tags ?? []) {
      set.add(t.toLowerCase().trim());
    }
  }
  return set;
}

/**
 * 从 JD 分析的 keywords 中提取技能词。
 */
export function extractJDKeywords(jdAnalysis: JobLead['jdAnalysis']): Set<string> {
  const set = new Set<string>();
  if (!jdAnalysis) return set;
  for (const k of jdAnalysis.keywords ?? []) {
    set.add(k.toLowerCase().trim());
  }
  return set;
}

/**
 * 薪资带解析："30-50k" / "30k-50k" / "30000-50000" → [下限, 上限]（元/月）
 */
function parseSalaryRange(s: string): [number, number] | null {
  if (!s) return null;
  const cleaned = s.toLowerCase().replace(/\s/g, '');
  // 提取所有数字+可选k
  const matches = cleaned.match(/(\d+(?:\.\d+)?)(k?)/g);
  if (!matches || matches.length < 2) return null;
  const nums = matches.map(m => {
    const n = parseFloat(m);
    return m.includes('k') ? n * 1000 : n;
  });
  nums.sort((a, b) => a - b);
  return [nums[0], nums[nums.length - 1]];
}

/**
 * 城市匹配：JD city 在目标城市列表中（含"远程"通配）。
 */
function cityMatch(jdCity: string | undefined, targetCities: string[]): boolean {
  if (!targetCities?.length) return true; // 未设目标 = 不硬过滤
  if (!jdCity) return true; // JD 没写城市 = 不过滤
  const jd = jdCity.toLowerCase().trim();
  if (jd.includes('远程') || jd.includes('remote')) return true;
  return targetCities.some(c => jd.includes(c.toLowerCase().trim()));
}

export interface MatchResult {
  score: number;          // 0-100
  reasons: string[];      // 匹配理由（展示给用户）
  gaps: string[];         // 差距（展示给用户）
}

/**
 * 组合评分：embedding 余弦（0.5）+ 技能命中（0.2）+ 城市硬过滤（0.15）+ 薪资带（0.1）+ 新鲜度（0.05）
 * 硬过滤不通过直接 0 分。
 */
export function scoreLead(
  lead: JobLead,
  profile: CareerProfile,
  experiences: Experience[],
  profileEmbedding?: number[]
): MatchResult {
  const reasons: string[] = [];
  const gaps: string[] = [];

  // 硬过滤：城市
  if (!cityMatch(lead.city, profile.targetCities ?? [])) {
    return { score: 0, reasons: [], gaps: [`城市不匹配（JD: ${lead.city ?? '未知'}）`] };
  }

  // 1. 语义相似度
  let semScore = 0.5;
  if (profileEmbedding && lead.embedding && profileEmbedding.length === lead.embedding.length) {
    const cos = cosineSimilarity(profileEmbedding, lead.embedding);
    semScore = Math.max(0, Math.min(1, (cos + 0.1) / 1.1)); // 余弦通常 0.3-0.8，做线性拉伸
    if (semScore > 0.6) reasons.push('职责与画像语义高度相关');
  } else {
    // 没有 embedding 时退化：标题命中
    const titleMatch = (profile.targetRoles ?? []).some(r =>
      lead.jobTitle.toLowerCase().includes(r.toLowerCase()) ||
      r.toLowerCase().includes(lead.jobTitle.toLowerCase())
    );
    semScore = titleMatch ? 0.7 : 0.4;
  }

  // 2. 技能命中
  const profileTags = collectSkillTags(experiences);
  const jdKeywords = extractJDKeywords(lead.jdAnalysis);
  let skillOverlap = 0.5;
  if (jdKeywords.size > 0 && profileTags.size > 0) {
    let hit = 0;
    for (const k of jdKeywords) {
      if (profileTags.has(k)) hit++;
    }
    skillOverlap = hit / jdKeywords.size;
    if (hit > 0) {
      const hitKeywords = [...jdKeywords].filter(k => profileTags.has(k)).slice(0, 3);
      reasons.push(`命中 ${hit}/${jdKeywords.size} 项 JD 技能词（${hitKeywords.join('、')}）`);
    }
    if (skillOverlap < 0.3) {
      gaps.push(`技能覆盖率较低（${Math.round(skillOverlap * 100)}%）`);
    }
  }

  // 3. 薪资带
  let salaryScore = 0.5;
  if (profile.expectedSalary && lead.salary) {
    const want = parseSalaryRange(profile.expectedSalary);
    const offer = parseSalaryRange(lead.salary);
    if (want && offer) {
      // 区间有交集 +1，offer 下限 >= want 下限 +0.5
      const overlap = Math.min(want[1], offer[1]) >= Math.max(want[0], offer[0]);
      const aboveFloor = offer[0] >= want[0];
      salaryScore = overlap ? (aboveFloor ? 1 : 0.8) : 0;
      if (aboveFloor) reasons.push('薪资达到期望下限');
      else if (!overlap) gaps.push('薪资低于期望');
    }
  }

  // 4. 新鲜度衰减
  const ageDays = (Date.now() - lead.importedAt) / 86400000;
  const freshScore = Math.max(0, 1 - ageDays / 30); // 30 天线性衰减到 0

  // 组合
  const final = semScore * 0.5 + skillOverlap * 0.2 + salaryScore * 0.15 + 0.15 + freshScore * 0.05;

  return {
    score: Math.round(Math.max(0, Math.min(100, final * 100))),
    reasons: reasons.length ? reasons : ['综合语义匹配'],
    gaps
  };
}

/**
 * 批量评分并排序。
 */
export function rankLeads(
  leads: JobLead[],
  profile: CareerProfile,
  experiences: Experience[],
  profileEmbedding?: number[]
): Array<JobLead & { matchScore: number; matchReasons: string[]; matchGaps: string[] }> {
  return leads
    .map(lead => {
      const r = scoreLead(lead, profile, experiences, profileEmbedding);
      return { ...lead, matchScore: r.score, matchReasons: r.reasons, matchGaps: r.gaps };
    })
    .filter(l => l.matchScore > 0) // 硬过滤掉的剔除
    .sort((a, b) => b.matchScore - a.matchScore);
}
