import { describe, it, expect } from 'vitest';
import {
  cosineSimilarity,
  hashText,
  buildProfileText,
  buildJobLeadText,
  collectSkillTags,
  extractJDKeywords,
  scoreLead,
  rankLeads
} from '../matching';
import type { CareerProfile, Experience, JobLead } from '@/types';

// ============ cosineSimilarity ============
describe('cosineSimilarity', () => {
  it('相同向量返回 1', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 6);
  });

  it('正交向量返回 0', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 6);
  });

  it('空向量返回 0', () => {
    expect(cosineSimilarity([], [])).toBe(0);
    expect(cosineSimilarity([1, 2], [])).toBe(0);
  });

  it('长度不一致返回 0', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2])).toBe(0);
  });

  it('零向量返回 0（避免除零）', () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
  });
});

// ============ hashText ============
describe('hashText', () => {
  it('相同输入产生相同哈希', () => {
    expect(hashText('hello')).toBe(hashText('hello'));
  });

  it('不同输入产生不同哈希', () => {
    expect(hashText('hello')).not.toBe(hashText('world'));
  });

  it('返回十六进制字符串', () => {
    expect(hashText('test')).toMatch(/^[0-9a-f]+$/);
  });
});

// ============ buildProfileText ============
describe('buildProfileText', () => {
  const baseProfile: CareerProfile = {
    id: 'default',
    name: '张三',
    headline: '前端工程师',
    summary: '5 年前端经验',
    targetRoles: ['前端工程师'],
    targetCities: ['北京'],
    expectedSalary: '30-50k',
    contact: {},
    createdAt: 0,
    updatedAt: 0
  };

  it('包含 headline / summary / 目标岗位 / 城市 / 薪资', () => {
    const text = buildProfileText(baseProfile, []);
    expect(text).toContain('前端工程师');
    expect(text).toContain('5 年前端经验');
    expect(text).toContain('北京');
    expect(text).toContain('30-50k');
  });

  it('经历以 title @ org 格式拼接', () => {
    const exp: Experience = {
      id: 'e1',
      type: 'work',
      title: '高级前端',
      org: '字节跳动',
      start: '2020-01',
      end: 'present',
      description: '',
      tags: ['React'],
      bullets: ['业绩 +30%'],
      createdAt: 0,
      updatedAt: 0
    };
    const text = buildProfileText(baseProfile, [exp]);
    expect(text).toContain('高级前端 @ 字节跳动');
    expect(text).toContain('[React]');
    expect(text).toContain('- 业绩 +30%');
  });

  it('空字段不产生噪声', () => {
    const text = buildProfileText({ ...baseProfile, summary: '', expectedSalary: '' }, []);
    expect(text).not.toContain('简介：');
    expect(text).not.toContain('期望薪资：');
  });
});

// ============ buildJobLeadText ============
describe('buildJobLeadText', () => {
  it('拼接岗位/公司/城市/薪资/JD', () => {
    const text = buildJobLeadText({
      jobTitle: '前端工程师',
      company: '美团',
      jdText: '负责 Web 开发',
      city: '北京',
      salary: '30-50k'
    });
    expect(text).toContain('前端工程师 @ 美团');
    expect(text).toContain('城市：北京');
    expect(text).toContain('薪资：30-50k');
    expect(text).toContain('JD：');
  });

  it('JD 超长会被截断到 2000 字符', () => {
    const long = 'x'.repeat(5000);
    const text = buildJobLeadText({
      jobTitle: 'T',
      company: 'C',
      jdText: long,
      city: '',
      salary: ''
    });
    // JD: 前缀 + 2000 字符
    expect(text.length).toBeLessThan(long.length);
  });
});

// ============ collectSkillTags / extractJDKeywords ============
describe('collectSkillTags / extractJDKeywords', () => {
  it('归一化技能别名到 canonical', () => {
    const exps: Experience[] = [
      { id: 'e1', type: 'work', title: '', org: '', start: '', end: '', description: '', tags: ['React.js', 'reactjs', 'Vue', '未知技能'], bullets: [], createdAt: 0, updatedAt: 0 }
    ];
    const tags = collectSkillTags(exps);
    expect(tags.has('React')).toBe(true);
    expect(tags.has('Vue.js')).toBe(true);
    expect(tags.has('未知技能')).toBe(true); // 未知降级保留原值
    expect(tags.size).toBe(3); // React.js 与 reactjs 归并
  });

  it('从 JD keywords 提取并归一化', () => {
    const lead: JobLead = {
      id: 'j1',
      jobTitle: 'T',
      company: 'C',
      jdText: '',
      source: 'manual',
      status: 'new',
      importedAt: 0,
      updatedAt: 0,
      jdAnalysis: { keywords: ['K8s', 'Golang', 'reactjs'], responsibilities: [], requirements: [], niceToHaves: [], redFlags: [], cultureHints: [], interviewFocus: [] }
    };
    const kws = extractJDKeywords(lead.jdAnalysis);
    expect(kws.has('Kubernetes')).toBe(true);
    expect(kws.has('Go')).toBe(true);
    expect(kws.has('React')).toBe(true);
  });
});

// ============ scoreLead ============
describe('scoreLead', () => {
  const profile: CareerProfile = {
    id: 'default',
    name: 'T',
    headline: '前端',
    summary: '',
    targetRoles: ['前端工程师'],
    targetCities: ['北京'],
    expectedSalary: '30-50k',
    contact: {},
    createdAt: 0,
    updatedAt: 0
  };
  const exps: Experience[] = [
    { id: 'e1', type: 'work', title: '前端', org: 'X', start: '2020-01', end: 'present', description: '', tags: ['React', 'TypeScript'], bullets: [], createdAt: 0, updatedAt: 0 }
  ];

  it('城市不匹配硬过滤返回 0 分', () => {
    const lead: JobLead = {
      id: 'j1', jobTitle: '前端工程师', company: 'C', jdText: '', source: 'manual', status: 'new',
      city: '上海', importedAt: Date.now(), updatedAt: 0
    };
    const r = scoreLead(lead, profile, exps);
    expect(r.score).toBe(0);
    expect(r.gaps.length).toBeGreaterThan(0);
  });

  it('远程岗位不被城市过滤', () => {
    const lead: JobLead = {
      id: 'j1', jobTitle: '前端工程师', company: 'C', jdText: '', source: 'manual', status: 'new',
      city: '远程', importedAt: Date.now(), updatedAt: 0
    };
    const r = scoreLead(lead, profile, exps);
    expect(r.score).toBeGreaterThan(0);
  });

  it('评分在 0-100 区间', () => {
    const lead: JobLead = {
      id: 'j1', jobTitle: '前端工程师', company: 'C', jdText: '', source: 'manual', status: 'new',
      city: '北京', salary: '35-55k', importedAt: Date.now(), updatedAt: 0,
      jdAnalysis: { keywords: ['React', 'TypeScript', 'Vue'], responsibilities: [], requirements: [], niceToHaves: [], redFlags: [], cultureHints: [], interviewFocus: [] }
    };
    const r = scoreLead(lead, profile, exps);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it('技能命中会生成 reasons', () => {
    const lead: JobLead = {
      id: 'j1', jobTitle: '前端工程师', company: 'C', jdText: '', source: 'manual', status: 'new',
      city: '北京', importedAt: Date.now(), updatedAt: 0,
      jdAnalysis: { keywords: ['React', 'TypeScript'], responsibilities: [], requirements: [], niceToHaves: [], redFlags: [], cultureHints: [], interviewFocus: [] }
    };
    const r = scoreLead(lead, profile, exps);
    expect(r.reasons.some(r => r.includes('命中'))).toBe(true);
  });
});

// ============ rankLeads ============
describe('rankLeads', () => {
  const profile: CareerProfile = {
    id: 'default', name: 'T', headline: '', summary: '', targetRoles: ['前端工程师'],
    targetCities: [], expectedSalary: '', contact: {}, createdAt: 0, updatedAt: 0
  };

  it('按分数降序排序', () => {
    const leads: JobLead[] = [
      { id: 'j1', jobTitle: '后端', company: 'C', jdText: '', source: 'manual', status: 'new', importedAt: Date.now(), updatedAt: 0 },
      { id: 'j2', jobTitle: '前端工程师', company: 'C', jdText: '', source: 'manual', status: 'new', importedAt: Date.now(), updatedAt: 0 }
    ];
    const ranked = rankLeads(leads, profile, []);
    // 前端标题命中目标岗位，分数应更高
    expect(ranked[0].jobTitle).toBe('前端工程师');
  });

  it('0 分 lead 被过滤掉', () => {
    const leads: JobLead[] = [
      { id: 'j1', jobTitle: '前端', company: 'C', jdText: '', source: 'manual', status: 'new', city: '北京', importedAt: Date.now(), updatedAt: 0 },
      { id: 'j2', jobTitle: '前端', company: 'C', jdText: '', source: 'manual', status: 'new', city: '深圳', importedAt: 0, updatedAt: 0 }
    ];
    const targetProfile = { ...profile, targetCities: ['北京'] };
    const ranked = rankLeads(leads, targetProfile, []);
    expect(ranked.length).toBe(1);
    expect(ranked[0].id).toBe('j1');
  });
});
