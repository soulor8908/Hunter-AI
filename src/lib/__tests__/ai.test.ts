import { describe, it, expect } from 'vitest';
import { stripJSON } from '../ai';

// ============ stripJSON ============
describe('stripJSON', () => {
  it('剥离 ```json 代码块包裹', () => {
    const input = '```json\n{"key": "value"}\n```';
    expect(stripJSON(input)).toBe('{"key": "value"}');
  });

  it('剥离无语言标记的代码块', () => {
    const input = '```\n[1, 2, 3]\n```';
    expect(stripJSON(input)).toBe('[1, 2, 3]');
  });

  it('代码块外有噪声文字时仍提取内部', () => {
    const input = '好的，这是结果：\n```json\n{"a": 1}\n```\n以上。';
    expect(stripJSON(input)).toBe('{"a": 1}');
  });

  it('纯 JSON（无代码块）直接 trim 返回', () => {
    expect(stripJSON('  {"a": 1}  ')).toBe('{"a": 1}');
    expect(stripJSON('[1, 2]')).toBe('[1, 2]');
  });

  it('JSON 前后有解释文字时提取首个 { 到最后 }', () => {
    const input = '分析结果：{"key": "value"} 希望有帮助';
    expect(stripJSON(input)).toBe('{"key": "value"}');
  });

  it('JSON 数组前后有文字时提取首个 [ 到最后 ]', () => {
    const input = '清单：[1, 2, 3] 完成';
    expect(stripJSON(input)).toBe('[1, 2, 3]');
  });

  it('无任何 JSON 结构时返回 trim 后原值', () => {
    expect(stripJSON('纯文本')).toBe('纯文本');
    expect(stripJSON('  没有花括号  ')).toBe('没有花括号');
  });

  it('空字符串返回空', () => {
    expect(stripJSON('')).toBe('');
    expect(stripJSON('   ')).toBe('');
  });

  it('嵌套对象正确提取', () => {
    const input = '```json\n{"outer": {"inner": [1, {"x": 2}]}}\n```';
    expect(stripJSON(input)).toBe('{"outer": {"inner": [1, {"x": 2}]}}');
  });

  it('多个代码块时取第一个', () => {
    const input = '```json\n{"first": true}\n```\n```json\n{"second": false}\n```';
    expect(stripJSON(input)).toBe('{"first": true}');
  });
});
