import { type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
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
  { to: '/resume', label: '简历生成', icon: '✦', desc: '一岗一简历' },
  { to: '/interview', label: '面试准备', icon: '◈', desc: '投递即学习' },
  { to: '/tracking', label: '投递追踪', icon: '▤', desc: 'Pipeline' },
  { to: '/chat', label: '求职助手', icon: '✧', desc: 'AI Chat' },
  { to: '/settings', label: '设置', icon: '⚙', desc: 'API Key' }
];

export default function Layout({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const current = NAV.find((n) => n.to === loc.pathname) ?? NAV[0];

  return (
    <div className="min-h-screen flex">
      {/* 侧边栏 */}
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
        {/* 顶栏（移动端可见） */}
        <header className="md:hidden sticky top-0 z-30 bg-ink-900/95 backdrop-blur border-b border-ink-800 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-accent/10 border border-accent/30 flex items-center justify-center text-accent font-bold text-sm">
              H
            </div>
            <span className="font-bold text-ink-100">Hunter AI</span>
          </div>
          <select
            value={current.to}
            onChange={(e) => (window.location.href = e.target.value)}
            className="bg-ink-800 border border-ink-700 rounded-md text-xs px-2 py-1 text-ink-300"
          >
            {NAV.map((n) => (
              <option key={n.to} value={n.to}>{n.label}</option>
            ))}
          </select>
        </header>

        <main className="flex-1 p-5 md:p-8 max-w-6xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
