import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import { useStore } from '@/store/useStore';

// 路由级拆 chunk：首屏只加载 Dashboard，其余页面按需加载
const Profile = lazy(() => import('@/pages/Profile'));
const Jobs = lazy(() => import('@/pages/Jobs'));
const ResumeGen = lazy(() => import('@/pages/ResumeGen'));
const Interview = lazy(() => import('@/pages/Interview'));
const Tracking = lazy(() => import('@/pages/Tracking'));
const Chat = lazy(() => import('@/pages/Chat'));
const Settings = lazy(() => import('@/pages/Settings'));

function PageFallback() {
  return (
    <div className="flex items-center justify-center py-16 text-ink-500 text-sm">
      <div className="animate-pulse">加载中…</div>
    </div>
  );
}

export default function App() {
  const initAISettings = useStore((s) => s.initAISettings);
  const pwaUpdateReady = useStore((s) => s.pwaUpdateReady);

  useEffect(() => {
    initAISettings();
  }, [initAISettings]);

  return (
    <Layout>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/resume" element={<ResumeGen />} />
          <Route path="/resume/:id" element={<ResumeGen />} />
          <Route path="/interview" element={<Interview />} />
          <Route path="/tracking" element={<Tracking />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>

      {pwaUpdateReady && (
        <div className="fixed bottom-24 md:bottom-6 left-4 right-4 md:right-auto md:left-6 z-50 card p-4 max-w-sm animate-glow">
          <div className="text-sm font-medium text-ink-100 mb-2">新版本已就绪</div>
          <div className="text-xs text-ink-400 mb-3">刷新页面以使用最新版本</div>
          <button
            className="btn-primary text-xs"
            onClick={() => window.location.reload()}
          >
            立即刷新
          </button>
        </div>
      )}
    </Layout>
  );
}
