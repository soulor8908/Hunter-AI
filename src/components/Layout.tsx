import { useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  desc: string;
}

const NAV: NavItem[] = [
  { to: '/', label: '总览', icon: '◈', desc: 'Dashboard' },
  { to: '/profile', label: '职业档案', icon: '◉', desc: '长期上下文' },
  { to: '/jobs', label: 'JD 匹配', icon: '⌖', desc: '推荐 + 投递池' },
  { to: '/resume', label: '简历生成', icon: '✦', desc: '一岗一简历' },
  { to: '/interview', label: '面试准备', icon: '◈', desc: '投递即学习' },
  { to: '/tracking', label: '投递追踪', icon: '▤', desc: 'Pipeline' },
  { to: '/chat', label: '求职助手', icon: '✧', desc: 'AI Chat' },
  { to: '/settings', label: '设置', icon: '⚙', desc: 'API Key' }
];

// 移动端底部 Tab：5 个核心入口（拇指可达）
const MOBILE_PRIMARY: string[] = ['/', '/jobs', '/resume', '/tracking', '/chat'];
// 溢出菜单：档案 + 面试 + 设置
const MOBILE_OVERFLOW: string[] = ['/profile', '/interview', '/settings'];

export default function Layout({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const nav = useNavigate();
  const [overflowOpen, setOverflowOpen] = useState(false);
  const current = NAV.find((n) => n.to === loc.pathname) ?? NAV[0];
  const activeOverflow = MOBILE_OVERFLOW.includes(loc.pathname);

  const go = (to: string) => {
    setOverflowOpen(false);
    nav(to);
  };

  return (
    <div className="min-h-screen flex">
      {/* 桌面侧边栏 */}
      <aside className="w-60 shrink-0 border-r border-ink-800 bg-ink-900/80 backdrop-blur sticky top-0 h-screen overflow-y-auto hidden md:block">
        <div className="p-5 border-b border-ink-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/30 flex items-center justify-center text-accent font-bold">
              H
            </div>
            <div>
              <div className="text-sm font-bold text-ink-100">Hunter AI</div>
              <div className="text-[10px] text-ink-500 tracking-wider">JOB HUNT OS</div>
            </div>
          </div>
        </div>

        <nav className="p-3 space-y-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(isActive ? 'nav-item-active' : 'nav-item')
              }
            >
              <span className="text-base w-4 text-center">{item.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="truncate">{item.label}</div>
                <div className="text-[10px] text-ink-500 truncate">{item.desc}</div>
              </div>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 mt-4 border-t border-ink-800">
          <div className="text-[10px] text-ink-500 leading-relaxed px-2">
            本地优先 · 数据存浏览器<br />
            <span className="text-accent/70">IndexedDB · 零信任</span>
          </div>
        </div>
      </aside>

      {/* 主内容 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 移动端顶栏 */}
        <header className="md:hidden sticky top-0 z-30 bg-ink-900/95 backdrop-blur border-b border-ink-800 px-4 py-3 flex items-center justify-between" style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-md bg-accent/10 border border-accent/30 flex items-center justify-center text-accent font-bold text-sm shrink-0">
              H
            </div>
            <div className="min-w-0">
              <div className="font-bold text-ink-100 text-sm truncate">Hunter AI</div>
              <div className="text-[10px] text-ink-500 truncate">{current.label}</div>
            </div>
          </div>
          <button
            onClick={() => setOverflowOpen(true)}
            className={cn(
              'w-9 h-9 flex items-center justify-center rounded-lg border text-lg shrink-0',
              activeOverflow
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-ink-700 text-ink-300'
            )}
            aria-label="更多"
          >
            ⋯
          </button>
        </header>

        <main className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full pb-24 md:pb-8">
          {children}
        </main>
      </div>

      {/* 移动端底部 Tab Bar */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-ink-900/95 backdrop-blur border-t border-ink-800 flex items-stretch"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {MOBILE_PRIMARY.map((to) => {
          const item = NAV.find((n) => n.to === to)!;
          const active = to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] min-h-[48px] transition-colors',
                active ? 'text-accent' : 'text-ink-500'
              )}
            >
              <span className="text-base leading-none">{item.icon}</span>
              <span className="leading-none">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* 移动端溢出菜单（档案 / 设置） */}
      {overflowOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-ink-900/80 backdrop-blur-sm flex items-end"
          onClick={() => setOverflowOpen(false)}
        >
          <div
            className="w-full bg-ink-800 border-t border-ink-700 rounded-t-2xl p-4 space-y-1"
            style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[10px] text-ink-500 px-2 pb-2">更多</div>
            {MOBILE_OVERFLOW.map((to) => {
              const item = NAV.find((n) => n.to === to)!;
              const active = loc.pathname === to;
              return (
                <button
                  key={to}
                  onClick={() => go(to)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm min-h-[44px]',
                    active ? 'bg-accent/10 text-accent' : 'text-ink-300 hover:bg-ink-700/50'
                  )}
                >
                  <span className="text-base w-5 text-center">{item.icon}</span>
                  <div className="text-left">
                    <div>{item.label}</div>
                    <div className="text-[10px] text-ink-500">{item.desc}</div>
                  </div>
                </button>
              );
            })}
            <button
              onClick={() => setOverflowOpen(false)}
              className="w-full text-center text-xs text-ink-500 py-2 mt-2"
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
