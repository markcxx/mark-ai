import { create } from 'zustand';

import {
  DEFAULT_SETTINGS,
  mergeSettings,
  PRIMARY_COLOR_VALUES,
  sanitizeGeneralSettings,
  sanitizeLanguageModelSettings,
} from '@/lib/settings';
import type { GeneralSettings, LanguageModelSettings, MarkAISettings } from '@/lib/settings';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

type SettingsState = MarkAISettings & {
  isLoaded: boolean;
  saveState: SaveState;
  loadSettings: () => Promise<void>;
  resetSettings: () => Promise<void>;
  updateGeneral: (patch: Partial<GeneralSettings>) => void;
  updateLanguageModel: (patch: Partial<LanguageModelSettings>) => void;
};

const STORAGE_KEY = 'markai:settings';
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let saveVersion = 0;

const readLocalSettings = (): MarkAISettings | undefined => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object') return undefined;
    return {
      general: sanitizeGeneralSettings(parsed.general),
      languageModel: sanitizeLanguageModelSettings(parsed.languageModel),
    };
  } catch {
    return undefined;
  }
};

const writeLocalSettings = (settings: MarkAISettings) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Cloud persistence remains available when browser storage is restricted.
  }
};

export const useSettingsStore = create<SettingsState>((set, get) => {
  const persist = () => {
    if (saveTimer) clearTimeout(saveTimer);
    const version = ++saveVersion;
    const settings = { general: get().general, languageModel: get().languageModel };

    // Browser persistence and visual changes are immediate. The server write is
    // intentionally batched in the background so rapidly toggling settings does
    // not leave the dialog showing a long-running "saving" state.
    writeLocalSettings(settings);
    set({ saveState: 'saved' });
    saveTimer = setTimeout(() => {
      void fetch('/api/settings', {
        body: JSON.stringify(settings),
        headers: { 'Content-Type': 'application/json' },
        method: 'PATCH',
      }).then((response) => {
        if (!response.ok) throw new Error('Failed to save settings');
        if (version === saveVersion) set({ saveState: 'saved' });
      }).catch((error) => {
        console.error('Settings save error:', error);
        if (version === saveVersion) set({ saveState: 'error' });
      });
    }, 150);
  };

  return {
    ...DEFAULT_SETTINGS,
    isLoaded: false,
    saveState: 'idle',

    loadSettings: async () => {
      const local = readLocalSettings();
      if (local) set({ ...local });
      try {
        const response = await fetch('/api/settings', { cache: 'no-store' });
        if (!response.ok) throw new Error('Failed to load settings');
        const data = await response.json();
        const resolved = data.cloudPersistence === false && local
          ? local
          : mergeSettings(DEFAULT_SETTINGS, data.settings || {});
        set({ ...resolved, isLoaded: true, saveState: 'idle' });
        writeLocalSettings(resolved);
      } catch (error) {
        console.error('Settings load error:', error);
        set({ ...(local || DEFAULT_SETTINGS), isLoaded: true, saveState: 'error' });
      }
    },

    resetSettings: async () => {
      if (saveTimer) clearTimeout(saveTimer);
      set({ ...DEFAULT_SETTINGS, saveState: 'saving' });
      writeLocalSettings(DEFAULT_SETTINGS);
      try {
        const response = await fetch('/api/settings', {
          body: JSON.stringify({ reset: true }),
          headers: { 'Content-Type': 'application/json' },
          method: 'PATCH',
        });
        if (!response.ok) throw new Error('Failed to reset settings');
        set({ saveState: 'saved' });
      } catch (error) {
        console.error('Settings reset error:', error);
        set({ saveState: 'error' });
      }
    },

    updateGeneral: (patch) => {
      set((state) => ({ general: sanitizeGeneralSettings({ ...state.general, ...patch }, state.general) }));
      if (patch.primaryColor && typeof document !== 'undefined') {
        const color = PRIMARY_COLOR_VALUES[get().general.primaryColor];
        document.documentElement.style.setProperty('--color-primary', color);
        document.documentElement.style.setProperty('--color-primary-container', color);
      }
      persist();
    },
    updateLanguageModel: (patch) => {
      set((state) => ({
        languageModel: sanitizeLanguageModelSettings(
          { ...state.languageModel, ...patch },
          state.languageModel,
        ),
      }));
      persist();
    },
  };
});
