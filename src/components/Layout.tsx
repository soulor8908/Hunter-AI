import { useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import Icon, { type IconName } from '@/components/Icon';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  desc: string;
}

const NAV: NavItem[] = [
  { to: '/', label: '总览', icon: 'dashboard', desc: 'Dashboard' },
  { to: '/profile', label: '职业档案', icon: 'profile', desc: '长期上下文' },
  { to: '/jobs', label: 'JD 匹配', icon: 'jobs', desc: '推荐 + 投递池' },
  { to: '/resume', label: '简历生成', icon: 'resume', desc: '一岗一简历' },
  { to: '/interview', label: '面试准备', icon: 'interview', desc: '投递即学习' },
  { to: '/tracking', label: '投递追踪', icon: 'tracking', desc: 'Pipeline' },
  { to: '/chat', label: '求职助手', icon: 'chat', desc: 'AI Chat' },
  { to: '/settings', label: '设置', icon: 'settings', desc: 'API Key' }
];

// 移动端底部 Tab：5 个核心入口（拇指可达）
const MOBILE_PRIMARY: string[] = ['/', '/jobs', '/resume', '/tracking', '/chat'];

export default function Layout({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const nav = useNavigate();
  const [navMapOpen, setNavMapOpen] = useState(false);
  const current = NAV.find((n) => n.to === loc.pathname) ?? NAV[0];

  const go = (to: string) => {
    setNavMapOpen(false);
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
              <Icon name={item.icon} size={18} className="shrink-0" />
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
        <header
          className="md:hidden sticky top-0 z-30 bg-ink-900/95 backdrop-blur border-b border-ink-800 px-3 py-3 flex items-center gap-2"
          style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
        >
          <button
            onClick={() => setNavMapOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-ink-700 text-ink-300 shrink-0"
            aria-label="导航地图"
          >
            <Icon name="menu" size={18} />
          </button>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-7 h-7 rounded-md bg-accent/10 border border-accent/30 flex items-center justify-center text-accent font-bold text-sm shrink-0">
              H
            </div>
            <div className="min-w-0">
              <div className="font-bold text-ink-100 text-sm truncate">Hunter AI</div>
              <div className="text-[10px] text-ink-500 truncate">{current.label} · {current.desc}</div>
            </div>
          </div>
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
              <Icon name={item.icon} size={20} />
              <span className="leading-none">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* 全屏导航地图 */}
      {navMapOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-ink-900/95 backdrop-blur-sm flex flex-col"
          onClick={() => setNavMapOpen(false)}
        >
          <div
            className="flex-1 flex flex-col p-4 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}
          >
            {/* 顶栏 */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-accent/10 border border-accent/30 flex items-center justify-center text-accent font-bold">
                  H
                </div>
                <div>
                  <div className="text-base font-bold text-ink-100">Hunter AI</div>
                  <div className="text-[10px] text-ink-500 tracking-wider">JOB HUNT OS · 站点地图</div>
                </div>
              </div>
              <button
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-ink-700 text-ink-300"
                onClick={() => setNavMapOpen(false)}
                aria-label="关闭"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            {/* 当前位置提示 */}
            <div className="mb-4 px-3 py-2 rounded-lg bg-ink-800/60 border border-ink-700">
              <div className="text-[10px] text-ink-500 mb-0.5">当前页面</div>
              <div className="flex items-center gap-2">
                <Icon name={current.icon} size={14} className="text-accent" />
                <span className="text-sm font-medium text-accent">{current.label}</span>
                <span className="text-[10px] text-ink-500">· {current.desc}</span>
              </div>
            </div>

            {/* 全部页面网格 */}
            <div className="text-[10px] text-ink-500 px-1 mb-2">全部页面</div>
            <div className="grid grid-cols-2 gap-2.5">
              {NAV.map((item) => {
                const active = item.to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(item.to);
                return (
                  <button
                    key={item.to}
                    onClick={() => go(item.to)}
                    className={cn(
                      'flex flex-col items-start justify-between p-3 rounded-xl border transition-all min-h-[88px] text-left',
                      active
                        ? 'border-accent bg-accent/10 text-ink-100'
                        : 'border-ink-700 bg-ink-800/40 text-ink-300 hover:border-ink-600 hover:bg-ink-700/40'
                    )}
                  >
                    <div className={cn('flex items-center justify-center w-9 h-9 rounded-lg mb-2', active ? 'bg-accent/20 text-accent' : 'bg-ink-700/60 text-ink-400')}>
                      <Icon name={item.icon} size={18} />
                    </div>
                    <div className="w-full">
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-medium truncate">{item.label}</span>
                        {active && <Icon name="check" size={12} className="text-accent shrink-0" />}
                      </div>
                      <div className="text-[10px] text-ink-500 truncate">{item.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* 底部说明 */}
            <div className="mt-auto pt-6 pb-2 text-center text-[10px] text-ink-600">
              底部 Tab 栏可快速切换 5 个核心页面
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
