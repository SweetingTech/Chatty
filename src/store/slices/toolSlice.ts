import { StateCreator } from 'zustand';
import type { AppState } from '../index';
import type { Tool } from '../../types';
import { defaultTools } from '../../lib/tools/defaults';

export interface ToolSlice {
  tools: Tool[];
  draftTools: { [id: string]: Tool | null };
  addTool: (tool: Tool) => void;
  updateTool: (id: string, updates: Partial<Tool>) => void;
  deleteTool: (id: string) => void;
  updateDraftTool: (id: string, updates: Partial<Tool>) => void;
  saveDraftTool: (id: string) => void;
  hasDraftTool: (id: string) => boolean;
}

export const createToolSlice: StateCreator<AppState, [], [], ToolSlice> = (set, get) => ({
  tools: defaultTools,
  draftTools: {},

  addTool: (tool) => set((state) => ({ tools: [...state.tools, tool] })),

  updateTool: (id, updates) => set((state) => ({
    tools: state.tools.map((tool) =>
      tool.id === id ? { ...tool, ...updates } : tool
    )
  })),

  deleteTool: (id) => set((state) => {
    const newDraftTools = { ...state.draftTools };
    delete newDraftTools[id];
    return {
      tools: state.tools.filter((t) => t.id !== id),
      draftTools: newDraftTools,
    };
  }),

  updateDraftTool: (id, updates) => set((state) => {
    const baseTool = state.tools.find(t => t.id === id);
    if (!baseTool) return state;

    const currentDraft = state.draftTools[id] || baseTool;
    return {
      draftTools: {
        ...state.draftTools,
        [id]: { ...currentDraft, ...updates },
      },
    };
  }),

  saveDraftTool: (id) => {
    const { draftTools, updateTool } = get();
    const draft = draftTools[id];
    if (draft) {
      updateTool(id, draft);
      set((state) => {
        const newDraftTools = { ...state.draftTools };
        delete newDraftTools[id];
        return { draftTools: newDraftTools };
      });
    }
  },

  hasDraftTool: (id) => {
    const { draftTools, tools } = get();
    const draft = draftTools[id];
    const baseTool = tools.find(t => t.id === id);
    if (!draft || !baseTool) return false;

    // Deep compare draft with base tool
    const diff = Object.keys(draft).reduce((acc, key) => {
      const k = key as keyof Tool;
      const draftVal = draft[k];
      const baseVal = baseTool[k];

      // Handle nested objects/arrays
      if (typeof draftVal === 'object' && draftVal !== null) {
        if (JSON.stringify(draftVal) !== JSON.stringify(baseVal)) {
          acc[k] = draftVal;
        }
      } else if (draftVal !== baseVal) {
        acc[k] = draftVal;
      }
      return acc;
    }, {} as Record<keyof Tool | string, unknown>);

    return Object.keys(diff).length > 0;
  },
});
