import { StateCreator } from 'zustand';
import type { AppState } from '../index';
import type { Tool } from '../../types';
import { defaultTools } from '../../lib/tools/defaults';
import { chromadb } from '../../lib/chromadb';

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

  updateTool: async (id, updates) => {
    const tool = get().tools.find((t) => t.id === id);
    if (!tool) return;

    const baseTool = defaultTools.find((t) => t.id === id);
    if (baseTool) {
      const updatedTool = { ...tool, ...updates };
      const changes = Object.entries(updatedTool).reduce((acc, [key, value]) => {
        const k = key as keyof Tool;
        if (JSON.stringify(value) !== JSON.stringify(baseTool[k])) {
          acc[k] = value;
        }
        return acc;
      }, {} as Record<keyof Tool | string, unknown>);

      if (Object.keys(changes).length > 0) {
        try {
          const collection = await chromadb.getOrCreateCollection('tool_modifications', {
            description: 'Stores modifications to default tools',
          });
          await collection.add({
            ids: [id],
            metadatas: [{ timestamp: Date.now() }],
            documents: [JSON.stringify({ targetId: id, changes })],
          });
        } catch (error) {
          console.error('Failed to save tool modifications:', error);
        }
      }
    }

    set((state) => ({
      tools: state.tools.map((t) => (t.id === id ? { ...t, ...updates } : t)),
      draftTools: { ...state.draftTools, [id]: null },
    }));
  },

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
      const draftVal = (draft as any)[key];
      const baseVal = (baseTool as any)[key];

      // Handle nested objects/arrays
      if (typeof draftVal === 'object' && draftVal !== null) {
        if (JSON.stringify(draftVal) !== JSON.stringify(baseVal)) {
          acc[key] = draftVal;
        }
      } else if (draftVal !== baseVal) {
        acc[key] = draftVal;
      }
      return acc;
    }, {} as Record<string, any>);

    return Object.keys(diff).length > 0;
  },
});
