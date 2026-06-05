import { StateCreator } from 'zustand';
import type { AppState } from '../index';
import type { Agent } from '../../types';
import { defaultAgents } from '../../lib/agents/defaults';

export interface AgentSlice {
  agents: Agent[];
  draftAgents: { [id: string]: Agent | null };
  addAgent: (agent: Agent) => void;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  deleteAgent: (id: string) => void;
  updateDraftAgent: (id: string, updates: Partial<Agent>) => void;
  saveDraftAgent: (id: string) => void;
  hasDraftAgent: (id: string) => boolean;
}

export const createAgentSlice: StateCreator<AppState, [], [], AgentSlice> = (set, get) => ({
  agents: defaultAgents,
  draftAgents: {},

  addAgent: (agent) => set((state) => ({ agents: [...state.agents, agent] })),

  updateAgent: (id, updates) => set((state) => ({
    agents: state.agents.map((agent) =>
      agent.id === id ? { ...agent, ...updates } : agent
    )
  })),

  deleteAgent: (id) => set((state) => {
    const newDraftAgents = { ...state.draftAgents };
    delete newDraftAgents[id];
    return {
      agents: state.agents.filter((a) => a.id !== id),
      draftAgents: newDraftAgents,
    };
  }),

  updateDraftAgent: (id, updates) => set((state) => {
    const baseAgent = state.agents.find(a => a.id === id);
    if (!baseAgent) return state;

    const currentDraft = state.draftAgents[id] || baseAgent;
    return {
      draftAgents: {
        ...state.draftAgents,
        [id]: { ...currentDraft, ...updates },
      },
    };
  }),

  saveDraftAgent: (id) => {
    const { draftAgents, updateAgent } = get();
    const draft = draftAgents[id];
    if (draft) {
      updateAgent(id, draft);
      set((state) => {
        const newDraftAgents = { ...state.draftAgents };
        delete newDraftAgents[id];
        return { draftAgents: newDraftAgents };
      });
    }
  },

  hasDraftAgent: (id) => {
    const { draftAgents, agents } = get();
    const draft = draftAgents[id];
    const baseAgent = agents.find(a => a.id === id);
    if (!draft || !baseAgent) return false;

    // Deep compare draft with base agent
    const diff = Object.keys(draft).reduce((acc, key) => {
      const draftVal = (draft as any)[key];
      const baseVal = (baseAgent as any)[key];

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
