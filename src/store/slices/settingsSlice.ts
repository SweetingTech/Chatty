import { StateCreator } from 'zustand';
import type { AppState } from '../index';
import type { Settings, ProviderType, ServiceStatus, LLMConfig } from '../../types';
import { chromadb } from '../../lib/chromadb';
import { chromadb } from '../../lib/chromadb';

// Environment variables with proper typing
const VITE_LM_STUDIO_HOST = (import.meta.env.VITE_LM_STUDIO_HOST as string) || 'localhost';
const VITE_LM_STUDIO_PORT = (import.meta.env.VITE_LM_STUDIO_PORT as string) || '1234';
const VITE_LM_STUDIO_URL = `http://${VITE_LM_STUDIO_HOST}:${VITE_LM_STUDIO_PORT}`;

const WEAVIATE_HOST = (import.meta.env.VITE_WEAVIATE_HOST as string) || 'localhost';
const WEAVIATE_PORT = (import.meta.env.VITE_WEAVIATE_PORT as string) || '8080';
const WEAVIATE_URL = `http://${WEAVIATE_HOST}:${WEAVIATE_PORT}`;
const WEAVIATE_API_KEY = (import.meta.env.VITE_WEAVIATE_API_KEY as string) || '';
const WEAVIATE_SCHEMA_CLASS = (import.meta.env.VITE_WEAVIATE_SCHEMA_CLASS as string) || 'ChatSession';
const WEAVIATE_BATCH_SIZE = parseInt((import.meta.env.VITE_WEAVIATE_BATCH_SIZE as string) || '100');
const WEAVIATE_VECTORIZER_MODULE = (import.meta.env.VITE_WEAVIATE_VECTORIZER_MODULE as string) || 'text2vec-transformers';

const VITE_OPENAI_API_KEY = (import.meta.env.VITE_OPENAI_API_KEY as string) || '';
const VITE_CLAUDE_API_KEY = (import.meta.env.VITE_CLAUDE_API_KEY as string) || '';
const VITE_BRAVE_API_KEY = (import.meta.env.VITE_BRAVE_API_KEY as string) || '';
const VITE_DEEPSEEK_API_KEY = (import.meta.env.VITE_DEEPSEEK_API_KEY as string) || '';

export interface SettingsSlice {
  settings: Settings;
  draftSettings: Settings | null;
  updateSettings: (settings: Partial<Settings>) => void;
  saveDraftSettings: () => Promise<void>;
  updateDraftSettings: (settings: Partial<Settings>) => void;
  hasDraftSettings: () => boolean;
  getModelsForProvider: (provider: ProviderType) => string[];

  serviceStatus: ServiceStatus;
  updateServiceStatus: (status: Partial<ServiceStatus>) => void;

  llmConfigs: Record<ProviderType, LLMConfig>;
  updateLLMConfig: (provider: ProviderType, config: Partial<LLMConfig>) => void;
  setDefaultProvider: (provider: ProviderType) => void;
}

export const createSettingsSlice: StateCreator<AppState, [], [], SettingsSlice> = (set, get) => ({
  settings: {
    lmStudioUrl: VITE_LM_STUDIO_URL,
    lmStudioHost: VITE_LM_STUDIO_HOST,
    lmStudioPort: VITE_LM_STUDIO_PORT,
    weaviateUrl: WEAVIATE_URL,
    weaviateHost: WEAVIATE_HOST,
    weaviatePort: WEAVIATE_PORT,
    weaviateApiKey: WEAVIATE_API_KEY,
    weaviateSchemaClass: WEAVIATE_SCHEMA_CLASS,
    weaviateBatchSize: WEAVIATE_BATCH_SIZE,
    weaviateVectorizerModule: WEAVIATE_VECTORIZER_MODULE,
    openaiKey: VITE_OPENAI_API_KEY,
    claudeKey: VITE_CLAUDE_API_KEY,
    deepseekKey: VITE_DEEPSEEK_API_KEY,
    theme: 'light',
    braveApiKey: VITE_BRAVE_API_KEY,
    defaultLLMProvider: 'none',
  },
  draftSettings: null,
  updateSettings: async (newSettings) => {
    try {
      await chromadb.saveUserSettings({
        ...get().settings,
        ...newSettings
      });

      set((state) => ({
        settings: { ...state.settings, ...newSettings },
        draftSettings: null,
      }));

      if ('openaiKey' in newSettings) {
        get().updateLLMConfig('openai', { apiKey: newSettings.openaiKey });
      }
      if ('claudeKey' in newSettings) {
        get().updateLLMConfig('claude', { apiKey: newSettings.claudeKey });
      }
      if ('deepseekKey' in newSettings) {
        get().updateLLMConfig('deepseek', { apiKey: newSettings.deepseekKey as string });
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw error;
    }
  },
  updateDraftSettings: (updates) => set((state) => ({
    draftSettings: {
      ...(state.draftSettings || state.settings),
      ...updates
    }
  })),
  saveDraftSettings: async () => {
    const { draftSettings, updateSettings } = get();
    if (draftSettings) {
      updateSettings(draftSettings);
      set({ draftSettings: null });
      // We will handle initializeServices calling somewhere else or export it as part of AppSlice
    }
  },
  hasDraftSettings: () => {
    const { draftSettings, settings } = get();
    if (!draftSettings) return false;
    return JSON.stringify(draftSettings) !== JSON.stringify(settings);
  },
  getModelsForProvider: (provider) => {
    const { llmConfigs } = get();
    const config = llmConfigs[provider];
    return config?.availableModels || [];
  },

  serviceStatus: {
    weaviate: 'unknown',
    chromadb: 'unknown',
    lmStudio: 'unknown',
  },
  updateServiceStatus: (status) => set((state) => ({
    serviceStatus: { ...state.serviceStatus, ...status }
  })),

  llmConfigs: {
    'lm-studio': { provider: 'lm-studio', enabled: false, isDefault: false },
    'openai': { provider: 'openai', enabled: false, isDefault: false },
    'claude': { provider: 'claude', enabled: false, isDefault: false },
    'deepseek': { provider: 'deepseek', enabled: false, isDefault: false },
    'none': { provider: 'none', enabled: true, isDefault: true }
  },
  updateLLMConfig: (provider, config) => set((state) => ({
    llmConfigs: {
      ...state.llmConfigs,
      [provider]: { ...state.llmConfigs[provider], ...config }
    }
  })),
  setDefaultProvider: (provider) => set((state) => {
    const newConfigs = { ...state.llmConfigs };
    Object.keys(newConfigs).forEach((key) => {
      newConfigs[key as ProviderType] = {
        ...newConfigs[key as ProviderType],
        isDefault: key === provider
      };
    });
    return { llmConfigs: newConfigs };
  }),
});
