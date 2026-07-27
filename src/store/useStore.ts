// Hunter AI — 全局状态（zustand）
// 仅放真正全局的状态：AI 设置、当前页面 loading、PWA 更新提示
import { create } from 'zustand';
import type { AISettings } from '@/types';
import { getAISettings, saveAISettings } from '@/lib/db';

interface AppState {
  aiSettings: AISettings | null;
  loadingAI: boolean;
  pwaUpdateReady: boolean;
  initAISettings: () => Promise<void>;
  updateAISettings: (s: AISettings) => Promise<void>;
  setLoadingAI: (v: boolean) => void;
  setPWAUpdateReady: (v: boolean) => void;
}

export const useStore = create<AppState>((set) => ({
  aiSettings: null,
  loadingAI: false,
  pwaUpdateReady: false,
  initAISettings: async () => {
    const s = await getAISettings();
    set({ aiSettings: s });
  },
  updateAISettings: async (s) => {
    await saveAISettings(s);
    set({ aiSettings: s });
  },
  setLoadingAI: (v) => set({ loadingAI: v }),
  setPWAUpdateReady: (v) => set({ pwaUpdateReady: v })
}));
