import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import ErrorBoundary from '@/components/ErrorBoundary';
import './index.css';

// PWA 注册（vite-plugin-pwa 自动注入）
import { registerSW } from 'virtual:pwa-register';
import { useStore } from '@/store/useStore';

registerSW({
  onNeedRefresh() {
    useStore.getState().setPWAUpdateReady(true);
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>
);
