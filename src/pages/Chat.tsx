import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/store/useStore';
import { listChats, saveChat, deleteChat, getResume, listResumes } from '@/lib/db';
import { streamChat, type ChatTurn } from '@/lib/ai';
import { SYSTEM_PROMPT, CHAT_SYSTEM_WITH_CONTEXT, fill } from '@/lib/prompts';
import { toast, cn, relativeTime } from '@/lib/utils';
import type { ChatSession, ResumeVersion } from '@/types';
import { nanoid } from 'nanoid';
import Icon from '@/components/Icon';

const SUGGESTIONS = [
  '帮我分析这份 JD 的核心考察点',
  '我的简历有哪些可以量化的地方？',
  '面试官问"为什么离开上家公司"怎么回答？',
  '如何谈薪才不会吃亏？',
  '我有个 3 年前端经验想转全栈，怎么准备？'
];

export default function Chat() {
  const aiSettings = useStore((s) => s.aiSettings);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [resumes, setResumes] = useState<ResumeVersion[]>([]);
  const [current, setCurrent] = useState<ChatSession | null>(null);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [error, setError] = useState('');
  const [resumeId, setResumeId] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const load = async () => {
    const [s, r] = await Promise.all([listChats(), listResumes()]);
    setSessions(s);
    setResumes(r);
    if (!current && s.length > 0) setCurrent(s[0]);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [current?.messages, streamText]);

  const newSession = async () => {
    const s = await saveChat({ title: '新对话 ' + relativeTime(Date.now()) });
    setCurrent(s);
    setSessions(await listChats());
    setDrawerOpen(false);
  };

  const remove = async (id: string) => {
    if (!confirm('删除这个会话？')) return;
    await deleteChat(id);
    if (current?.id === id) setCurrent(null);
    setSessions(await listChats());
  };

  const pickSession = (s: ChatSession) => {
    setCurrent(s);
    setDrawerOpen(false);
  };

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || streaming) return;
    if (!aiSettings) return;
    if (aiSettings.provider !== 'trial' && !aiSettings.apiKey) {
      toast('请先配置 API Key', 'error');
      return;
    }

    let session = current;
    if (!session) {
      session = await saveChat({ title: content.slice(0, 24) });
    }

    const userMsg = { id: nanoid(), role: 'user' as const, content, createdAt: Date.now() };
    const updatedMessages = [...session.messages, userMsg];
    setError('');
    setStreaming(true);
    setStreamText('');
    setInput('');
    abortRef.current = new AbortController();

    // 构建上下文
    let systemContent = SYSTEM_PROMPT;
    if (resumeId) {
      const r = await getResume(resumeId);
      if (r) {
        systemContent += '\n\n' + fill(CHAT_SYSTEM_WITH_CONTEXT, {
          jobTitle: r.jobTitle,
          company: r.company,
          resumeExcerpt: r.markdown.slice(0, 1500)
        });
      }
    }

    const turns: ChatTurn[] = [
      { role: 'system', content: systemContent },
      ...updatedMessages.map(m => ({ role: m.role, content: m.content }))
    ];

    let full = '';
    await streamChat(turns, aiSettings, {
      onToken: (t) => {
        full += t;
        setStreamText(full);
      },
      onDone: async (finalText) => {
        const aiMsg = { id: nanoid(), role: 'assistant' as const, content: finalText, createdAt: Date.now() };
        const saved = await saveChat({
          id: session!.id,
          title: session!.messages.length === 0 ? content.slice(0, 24) : session!.title,
          messages: [...updatedMessages, aiMsg]
        });
        setCurrent(saved);
        setStreamText('');
        setSessions(await listChats());
      },
      onError: (e) => {
        setError(e.message);
      }
    }, abortRef.current.signal);

    setStreaming(false);
  };

  const stop = () => {
    abortRef.current?.abort();
    setStreaming(false);
    if (streamText) {
      // 保留已生成内容
      const aiMsg = { id: nanoid(), role: 'assistant' as const, content: streamText, createdAt: Date.now() };
      if (current) {
        const userMsg = { id: nanoid(), role: 'user' as const, content: input || streamText, createdAt: Date.now() };
        saveChat({ id: current.id, title: current.title, messages: [...current.messages, userMsg, aiMsg] }).then(async (s) => {
          setCurrent(s);
          setSessions(await listChats());
        });
      }
      setStreamText('');
    }
  };

  return (
    <div className="flex h-[calc(100vh-7rem)] md:h-[calc(100vh-4rem)] -m-4 md:-m-8">
      {/* 桌面会话列表 */}
      <aside className="w-56 shrink-0 border-r border-ink-800 flex-col bg-ink-900/50 hidden md:flex">
        <div className="p-3">
          <button className="btn-primary w-full text-xs" onClick={newSession}><Icon name="plus" size={14} /> 新对话</button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
          {sessions.length === 0 ? (
            <div className="text-xs text-ink-600 text-center py-4">暂无对话</div>
          ) : sessions.map(s => (
            <button
              key={s.id}
              onClick={() => pickSession(s)}
              className={cn(
                'w-full text-left px-2 py-2 rounded-lg text-xs transition-colors group',
                current?.id === s.id ? 'bg-accent/10 text-accent' : 'text-ink-400 hover:bg-ink-700/50'
              )}
            >
              <div className="flex items-center justify-between">
                <span className="truncate flex-1">{s.title}</span>
                <span
                  className="opacity-0 group-hover:opacity-100 text-red-400 px-1"
                  onClick={(e) => { e.stopPropagation(); remove(s.id); }}
                ><Icon name="close" size={14} /></span>
              </div>
              <div className="text-[10px] text-ink-600">{relativeTime(s.updatedAt)}</div>
            </button>
          ))}
        </div>
      </aside>

      {/* 主对话区 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 顶栏 */}
        <div className="border-b border-ink-800 p-3 flex items-center gap-2">
          <button
            className="md:hidden btn-ghost text-xs px-2 py-1 shrink-0"
            onClick={() => setDrawerOpen(true)}
            aria-label="会话列表"
          >
            <Icon name="menu" size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-ink-100 truncate">
              {current?.title ?? '求职助手'}
            </div>
            <div className="text-[10px] text-ink-500 hidden sm:block">AI 求职教练 · 流式响应</div>
          </div>
          {resumes.length > 0 && (
            <select
              className="input text-xs w-28 sm:w-40 shrink-0"
              value={resumeId}
              onChange={e => setResumeId(e.target.value)}
            >
              <option value="">无上下文</option>
              {resumes.map(r => <option key={r.id} value={r.id}>{r.jobTitle} @ {r.company}</option>)}
            </select>
          )}
        </div>

        {/* 消息流 */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3">
          {!current?.messages.length && !streaming && (
            <div className="h-full flex flex-col items-center justify-center text-center px-4">
              <div className="text-5xl mb-3"><Icon name="sparkles" size={32} /></div>
              <h3 className="text-lg font-semibold text-ink-100 mb-1">求职教练已就绪</h3>
              <p className="text-xs text-ink-500 mb-5">选一个建议问题，或直接问我任何求职相关问题</p>
              <div className="grid gap-2 max-w-md w-full">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="card-hover p-2.5 text-left text-xs text-ink-300 hover:text-accent flex items-start gap-1.5"
                  >
                    <Icon name="chat" size={12} className="mt-0.5 shrink-0" />
                    <span>{s}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {current?.messages.map(m => (
            <Message key={m.id} role={m.role} content={m.content} />
          ))}

          {streaming && (
            <Message role="assistant" content={streamText || '...'} streaming />
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-xs text-red-300">
              <Icon name="alert" size={14} /> {error}
            </div>
          )}
        </div>

        {/* 输入框 */}
        <div className="border-t border-ink-800 p-3" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
          <div className="flex gap-2 items-end">
            <textarea
              className="input flex-1 resize-none text-base md:text-sm"
              rows={2}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="输入求职相关问题，Enter 发送"
              disabled={streaming}
            />
            {streaming ? (
              <button className="btn-outline text-xs shrink-0" onClick={stop}><Icon name="stop" size={14} /></button>
            ) : (
              <button className="btn-primary text-xs shrink-0" onClick={() => send()} disabled={!input.trim()}>
                发送 <Icon name="arrow-right" size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 移动端会话抽屉 */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-ink-900/80 backdrop-blur-sm"
          onClick={() => setDrawerOpen(false)}
        >
          <aside
            className="absolute left-0 top-0 bottom-0 w-72 max-w-[80vw] bg-ink-800 border-r border-ink-700 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 flex items-center justify-between border-b border-ink-700">
              <span className="text-sm font-semibold text-ink-100">会话</span>
              <button className="btn-ghost text-xs px-2 py-1" onClick={() => setDrawerOpen(false)}><Icon name="close" size={14} /></button>
            </div>
            <div className="p-3">
              <button className="btn-primary w-full text-xs" onClick={newSession}><Icon name="plus" size={14} /> 新对话</button>
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
              {sessions.length === 0 ? (
                <div className="text-xs text-ink-600 text-center py-4">暂无对话</div>
              ) : sessions.map(s => (
                <button
                  key={s.id}
                  onClick={() => pickSession(s)}
                  className={cn(
                    'w-full text-left px-2 py-2 rounded-lg text-xs transition-colors group',
                    current?.id === s.id ? 'bg-accent/10 text-accent' : 'text-ink-400 hover:bg-ink-700/50'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate flex-1">{s.title}</span>
                    <span
                      className="text-red-400 px-1 shrink-0"
                      onClick={(e) => { e.stopPropagation(); remove(s.id); }}
                    ><Icon name="close" size={14} /></span>
                  </div>
                  <div className="text-[10px] text-ink-600">{relativeTime(s.updatedAt)}</div>
                </button>
              ))}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function Message({ role, content, streaming }: { role: 'user' | 'assistant' | 'system'; content: string; streaming?: boolean }) {
  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="bg-accent/10 border border-accent/20 rounded-2xl rounded-tr-sm px-3 py-2 max-w-[80%] text-sm text-ink-100 whitespace-pre-wrap">
          {content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-2">
      <div className="w-7 h-7 rounded-lg bg-accent/10 border border-accent/30 flex items-center justify-center text-accent text-xs shrink-0">H</div>
      <div className={cn('flex-1 text-sm text-ink-300 whitespace-pre-wrap leading-relaxed', streaming && 'stream-cursor')}>
        {content}
      </div>
    </div>
  );
}
