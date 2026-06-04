import { create } from 'zustand';
import type { Agent, ChatSession, Tool } from '../types';

import { createSettingsSlice, type SettingsSlice } from './slices/settingsSlice';
import { createAgentSlice, type AgentSlice } from './slices/agentSlice';
import { createAPISlice, type APISlice } from './slices/apiSlice';
import { createToolSlice, type ToolSlice } from './slices/toolSlice';
import { createMCPSlice, type MCPSlice } from './slices/mcpSlice';
import { createChatSlice, type ChatSlice } from './slices/chatSlice';
import { createAppSlice, type AppSlice } from './slices/appSlice';

export interface WorkflowState {
  agents: Agent[];
  tools: Tool[];
  chatSessions: ChatSession[];
  currentChatId: string | null;

  updateDraftAgent: (id: string, updates: Partial<Agent>) => void;
  saveDraftAgent: (id: string) => void;
  hasDraftAgent: (id: string) => boolean;
  addAgent: (agent: Agent) => void;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  deleteAgent: (id: string) => void;

  setCurrentChatId: (id: string | null) => void;
  addChatSession: (session: ChatSession) => void;
  updateChatSession: (id: string, updates: Partial<ChatSession>) => void;
  deleteChatSession: (id: string) => void;

  addTool: (tool: Tool) => void;
  updateTool: (id: string, updates: Partial<Tool>) => void;
  deleteTool: (id: string) => void;
}

export type AppState = SettingsSlice &
  AgentSlice &
  APISlice &
  ToolSlice &
  MCPSlice &
  ChatSlice &
  AppSlice & {
    workflow: WorkflowState;
  };

export const useAppStore = create<AppState>((set, get, store) => {
  return {
    ...createSettingsSlice(set, get, store),
    ...createAgentSlice(set, get, store),
    ...createAPISlice(set, get, store),
    ...createToolSlice(set, get, store),
    ...createMCPSlice(set, get, store),
    ...createChatSlice(set, get, store),
    ...createAppSlice(set, get, store),

    // Reactivity workaround: We shouldn't use getters on the root of Zustand stores
    // because `set` merges state with Object.assign, freezing the getter into a static value.
    // However, the interface requires the `workflow` namespace.
    // The correct pattern for namespaced actions is defining them explicitly,
    // and using getters for state only inside the store initialization context.
    workflow: {
      get agents() { return get().agents; },
      get tools() { return get().tools; },
      get chatSessions() { return get().chatSessions; },
      get currentChatId() { return get().currentChatId; },

      updateDraftAgent: (id, updates) => get().updateDraftAgent(id, updates),
      saveDraftAgent: (id) => get().saveDraftAgent(id),
      hasDraftAgent: (id) => get().hasDraftAgent(id),
      addAgent: (agent) => get().addAgent(agent),
      updateAgent: (id, updates) => get().updateAgent(id, updates),
      deleteAgent: (id) => get().deleteAgent(id),

      setCurrentChatId: (id) => get().setCurrentChatId(id),
      addChatSession: (session) => get().addChatSession(session),
      updateChatSession: (id, updates) => get().updateChatSession(id, updates),
      deleteChatSession: (id) => get().deleteChatSession(id),

      addTool: (tool) => get().addTool(tool),
      updateTool: (id, updates) => get().updateTool(id, updates),
      deleteTool: (id) => get().deleteTool(id),
    }
  };
});
