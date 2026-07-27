import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import Profile from '@/pages/Profile';
import ResumeGen from '@/pages/ResumeGen';
import Interview from '@/pages/Interview';
import Tracking from '@/pages/Tracking';
import Chat from '@/pages/Chat';
import Settings from '@/pages/Settings';
import { useStore } from '@/store/useStore';

export default function App() {
  const initAISettings = useStore((s) => s.initAISettings);
  const pwaUpdateReady = useStore((s) => s.pwaUpdateReady);

  useEffect(() => {
    initAISettings();
  }, [initAISettings]);

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/resume" element={<ResumeGen />} />
        <Route path="/resume/:id" element={<ResumeGen />} />
        <Route path="/interview" element={<Interview />} />
        <Route path="/tracking" element={<Tracking />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

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
