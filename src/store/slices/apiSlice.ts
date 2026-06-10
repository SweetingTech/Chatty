import { StateCreator } from 'zustand';
import type { AppState } from '../index';
import type { API } from '../../types';

export interface APISlice {
  apis: API[];
  draftApis: { [id: string]: API | null };
  addAPI: (api: API) => void;
  updateAPI: (id: string, updates: Partial<API>) => void;
  deleteAPI: (id: string) => void;
  updateDraftAPI: (id: string, updates: Partial<API>) => void;
  saveDraftAPI: (id: string) => void;
  hasDraftAPI: (id: string) => boolean;
}

export const createAPISlice: StateCreator<AppState, [], [], APISlice> = (set, get) => ({
  apis: [],
  draftApis: {},

  addAPI: (api) => set((state) => ({ apis: [...state.apis, api] })),

  updateAPI: (id, updates) => set((state) => ({
    apis: state.apis.map((api) =>
      api.id === id ? { ...api, ...updates } : api
    )
  })),

  deleteAPI: (id) => set((state) => {
    const newDraftApis = { ...state.draftApis };
    delete newDraftApis[id];
    return {
      apis: state.apis.filter((a) => a.id !== id),
      draftApis: newDraftApis,
    };
  }),

  updateDraftAPI: (id, updates) => set((state) => {
    const baseAPI = state.apis.find(a => a.id === id);
    if (!baseAPI) return state;

    const currentDraft = state.draftApis[id] || baseAPI;
    return {
      draftApis: {
        ...state.draftApis,
        [id]: { ...currentDraft, ...updates },
      },
    };
  }),

  saveDraftAPI: (id) => {
    const { draftApis, updateAPI } = get();
    const draft = draftApis[id];
    if (draft) {
      updateAPI(id, draft);
      set((state) => {
        const newDraftApis = { ...state.draftApis };
        delete newDraftApis[id];
        return { draftApis: newDraftApis };
      });
    }
  },

  hasDraftAPI: (id) => {
    const { draftApis, apis } = get();
    const draft = draftApis[id];
    const baseAPI = apis.find(a => a.id === id);
    if (!draft || !baseAPI) return false;
    return JSON.stringify(draft) !== JSON.stringify(baseAPI);
  },
});
