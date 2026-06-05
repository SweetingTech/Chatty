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

    // Dynamic workflow property using getters to ensure it's always up-to-date
    get workflow(): WorkflowState {
      const state = get();
      return {
        agents: state.agents,
        tools: state.tools,
        chatSessions: state.chatSessions,
        currentChatId: state.currentChatId,

        updateDraftAgent: state.updateDraftAgent,
        saveDraftAgent: state.saveDraftAgent,
        hasDraftAgent: state.hasDraftAgent,
        addAgent: state.addAgent,
        updateAgent: state.updateAgent,
        deleteAgent: state.deleteAgent,

        setCurrentChatId: state.setCurrentChatId,
        addChatSession: state.addChatSession,
        updateChatSession: state.updateChatSession,
        deleteChatSession: state.deleteChatSession,

        addTool: state.addTool,
        updateTool: state.updateTool,
        deleteTool: state.deleteTool,
      };
    }
  };
});
