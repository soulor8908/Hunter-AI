// Hunter AI — 技能标签输入（带 O*NET 词库自动补全）
import { useMemo, useRef, useState } from 'react';
import { searchSkills, type SkillEntry } from '@/lib/skills';
import { cn } from '@/lib/utils';

interface SkillInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export default function SkillInput({ value, onChange, placeholder }: SkillInputProps) {
  const [focused, setFocused] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  // 解析当前正在输入的词（最后一个逗号后的部分）
  const { currentWord, prefix } = useMemo(() => {
    const parts = value.split(/[,，]/);
    const last = parts[parts.length - 1].trim();
    return { currentWord: last, prefix: parts.slice(0, -1) };
  }, [value]);

  const suggestions: SkillEntry[] = useMemo(() => {
    if (!focused || !currentWord) return [];
    return searchSkills(currentWord, 6);
  }, [currentWord, focused]);

  const applySuggestion = (s: SkillEntry) => {
    const newParts = [...prefix, s.canonical];
    onChange(newParts.join(', ') + ', ');
    setActiveIdx(-1);
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      applySuggestion(suggestions[activeIdx]);
    } else if (e.key === 'Escape') {
      setActiveIdx(-1);
      inputRef.current?.blur();
    }
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        className="input"
        value={value}
        onChange={e => { onChange(e.target.value); setActiveIdx(-1); }}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        onKeyDown={onKeyDown}
        placeholder={placeholder ?? '输入技能，逗号分隔（如 React, TypeScript）'}
        autoComplete="off"
      />
      {focused && suggestions.length > 0 && (
        <div className="absolute z-30 left-0 right-0 mt-1 card p-1 max-h-60 overflow-y-auto shadow-xl">
          {suggestions.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onMouseDown={e => { e.preventDefault(); applySuggestion(s); }}
              className={cn(
                'w-full text-left px-2.5 py-1.5 rounded-md text-sm flex items-center justify-between gap-2',
                i === activeIdx ? 'bg-accent/10 text-accent' : 'text-ink-300 hover:bg-ink-700/50'
              )}
            >
              <div className="min-w-0">
                <span className="font-medium">{s.canonical}</span>
                {s.zh !== s.canonical && <span className="text-ink-500 ml-1.5 text-xs">{s.zh}</span>}
              </div>
              <span className="text-[10px] text-ink-600 shrink-0">{s.aliases.slice(0, 2).join(' · ')}</span>
            </button>
          ))}
          <div className="text-[10px] text-ink-600 px-2.5 py-1 border-t border-ink-700 mt-1">
            ↑↓ 选择 · Enter 确认 · Esc 关闭 · 数据来源 O*NET
          </div>
        </div>
      )}
    </div>
  );
}
