import { StateCreator } from 'zustand';
import type { AppState } from '../index';
import type { ModelContext } from '../../lib/mcp';

export interface MCPSlice {
  draftMCPs: { [id: string]: ModelContext | null };
  updateDraftMCP: (id: string, updates: Partial<ModelContext>) => void;
  saveDraftMCP: (id: string) => void;
  hasDraftMCP: (id: string) => boolean;
}

export const createMCPSlice: StateCreator<AppState, [], [], MCPSlice> = (set, get) => ({
  draftMCPs: {},

  updateDraftMCP: (id, updates) => set((state) => {
    // Get existing context if it exists, otherwise create new
    const currentDraft = state.draftMCPs[id] || {
      id,
      name: '',
      description: '',
      capabilities: [],
      systemPrompt: '',
      status: 'stopped'
    };

    return {
      draftMCPs: {
        ...state.draftMCPs,
        [id]: { ...currentDraft, ...updates },
      },
    };
  }),

  saveDraftMCP: (id) => {
    const { draftMCPs } = get();
    const draft = draftMCPs[id];
    if (draft) {
      // TODO: Implement actual save logic when MCP service is fully connected
      console.log('Saving MCP:', draft);

      set((state) => {
        const newDraftMCPs = { ...state.draftMCPs };
        delete newDraftMCPs[id];
        return { draftMCPs: newDraftMCPs };
      });
    }
  },

  hasDraftMCP: (id) => {
    const { draftMCPs } = get();
    return !!draftMCPs[id];
  },
});
