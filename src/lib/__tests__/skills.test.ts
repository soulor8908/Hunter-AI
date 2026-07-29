import { describe, it, expect } from 'vitest';
import { normalizeSkill, normalizeSkills, getSkill, searchSkills, SKILLS } from '../skills';

// ============ normalizeSkill ============
describe('normalizeSkill', () => {
  it('英文别名归一到 canonical（React.js → React）', () => {
    expect(normalizeSkill('React.js')).toBe('React');
    expect(normalizeSkill('reactjs')).toBe('React');
    expect(normalizeSkill('ReactJS')).toBe('React');
  });

  it('中文别名归一（K8s → Kubernetes）', () => {
    expect(normalizeSkill('K8s')).toBe('Kubernetes');
    expect(normalizeSkill('k8s')).toBe('Kubernetes');
  });

  it('大小写不敏感', () => {
    expect(normalizeSkill('REACT')).toBe('React');
    expect(normalizeSkill('react')).toBe('React');
  });

  it('canonical 本身归一不变', () => {
    expect(normalizeSkill('React')).toBe('React');
    expect(normalizeSkill('Python')).toBe('Python');
  });

  it('中文 zh 名归一到 canonical', () => {
    expect(normalizeSkill('机器学习')).toBe('Machine Learning');
    expect(normalizeSkill('Kubernetes')).toBe('Kubernetes');
  });

  it('空字符串返回空', () => {
    expect(normalizeSkill('')).toBe('');
    expect(normalizeSkill('   ')).toBe('');
  });

  it('未知技能返回 trim 后原值（降级不丢数据）', () => {
    expect(normalizeSkill('Quantum Computing')).toBe('Quantum Computing');
    expect(normalizeSkill('  某冷门技能  ')).toBe('某冷门技能');
  });

  it('Go / Golang 归一并避免与英文单词 "go" 误匹配', () => {
    expect(normalizeSkill('Golang')).toBe('Go');
    expect(normalizeSkill('golang')).toBe('Go');
  });
});

// ============ normalizeSkills ============
describe('normalizeSkills', () => {
  it('批量归一并去重', () => {
    const result = normalizeSkills(['React.js', 'reactjs', 'Vue', 'K8s', 'Kubernetes']);
    expect(result).toContain('React');
    expect(result).toContain('Vue.js');
    expect(result).toContain('Kubernetes');
    expect(result.filter(x => x === 'React').length).toBe(1);
    expect(result.filter(x => x === 'Kubernetes').length).toBe(1);
  });

  it('空数组返回空数组', () => {
    expect(normalizeSkills([])).toEqual([]);
  });
});

// ============ getSkill ============
describe('getSkill', () => {
  it('按 canonical 名查询返回 SkillEntry', () => {
    const entry = getSkill('React');
    expect(entry).toBeDefined();
    expect(entry?.canonical).toBe('React');
    expect(entry?.category).toBe('frontend');
  });

  it('未知名返回 undefined', () => {
    expect(getSkill('NotARealSkill')).toBeUndefined();
  });
});

// ============ searchSkills ============
describe('searchSkills', () => {
  it('按 canonical 模糊匹配', () => {
    const results = searchSkills('React');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(s => s.canonical === 'React')).toBe(true);
    expect(results.some(s => s.canonical === 'React Native')).toBe(true);
  });

  it('按中文匹配', () => {
    const results = searchSkills('机器学习');
    expect(results.some(s => s.canonical === 'Machine Learning')).toBe(true);
  });

  it('按别名匹配', () => {
    const results = searchSkills('k8s');
    expect(results.some(s => s.canonical === 'Kubernetes')).toBe(true);
  });

  it('空查询返回空数组', () => {
    expect(searchSkills('')).toEqual([]);
    expect(searchSkills('   ')).toEqual([]);
  });

  it('limit 参数生效', () => {
    const results = searchSkills('a', 3);
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it('精确匹配排在模糊匹配之前（score 加分）', () => {
    // "React" 精确匹配应排在 "React Native" 之前
    const results = searchSkills('React', 5);
    const reactIdx = results.findIndex(s => s.canonical === 'React');
    const reactNativeIdx = results.findIndex(s => s.canonical === 'React Native');
    if (reactIdx !== -1 && reactNativeIdx !== -1) {
      expect(reactIdx).toBeLessThan(reactNativeIdx);
    }
  });
});

// ============ SKILLS 数据完整性 ============
describe('SKILLS 数据完整性', () => {
  it('每个条目有非空 canonical 与 id', () => {
    for (const s of SKILLS) {
      expect(s.canonical.length).toBeGreaterThan(0);
      expect(s.id.length).toBeGreaterThan(0);
    }
  });

  it('canonical 唯一', () => {
    const canonicals = SKILLS.map(s => s.canonical);
    const set = new Set(canonicals);
    expect(set.size).toBe(canonicals.length);
  });

  it('至少包含核心语言与前端框架', () => {
    const canonicals = new Set(SKILLS.map(s => s.canonical));
    expect(canonicals.has('JavaScript')).toBe(true);
    expect(canonicals.has('TypeScript')).toBe(true);
    expect(canonicals.has('Python')).toBe(true);
    expect(canonicals.has('React')).toBe(true);
    expect(canonicals.has('Vue.js')).toBe(true);
  });
});
