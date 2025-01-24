import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Settings, ChatSession, Agent, Tool, API } from '../types';
import { mcp, type ModelContext } from '../lib/mcp';

interface AppState {
  // Settings
  settings: Settings;
  draftSettings: Settings | null;
  updateSettings: (settings: Partial<Settings>) => void;
  saveDraftSettings: () => void;
  updateDraftSettings: (settings: Partial<Settings>) => void;
  hasDraftSettings: () => boolean;
  
  // Agents
  agents: Agent[];
  draftAgents: { [id: string]: Agent | null };
  addAgent: (agent: Agent) => void;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  deleteAgent: (id: string) => void;
  updateDraftAgent: (id: string, updates: Partial<Agent>) => void;
  saveDraftAgent: (id: string) => void;
  hasDraftAgent: (id: string) => boolean;

  // APIs
  apis: API[];
  draftApis: { [id: string]: API | null };
  addAPI: (api: API) => void;
  updateAPI: (id: string, updates: Partial<API>) => void;
  deleteAPI: (id: string) => void;
  updateDraftAPI: (id: string, updates: Partial<API>) => void;
  saveDraftAPI: (id: string) => void;
  hasDraftAPI: (id: string) => boolean;

  // Tools
  tools: Tool[];
  draftTools: { [id: string]: Tool | null };
  addTool: (tool: Tool) => void;
  updateTool: (id: string, updates: Partial<Tool>) => void;
  deleteTool: (id: string) => void;
  updateDraftTool: (id: string, updates: Partial<Tool>) => void;
  saveDraftTool: (id: string) => void;
  hasDraftTool: (id: string) => boolean;

  // MCP
  draftMCPs: { [id: string]: ModelContext | null };
  updateDraftMCP: (id: string, updates: Partial<ModelContext>) => void;
  saveDraftMCP: (id: string) => void;
  hasDraftMCP: (id: string) => boolean;

  // Chat
  currentChatId: string | null;
  setCurrentChatId: (id: string | null) => void;
  chatSessions: ChatSession[];
  addChatSession: (session: ChatSession) => void;
  updateChatSession: (id: string, updates: Partial<ChatSession>) => void;
  deleteChatSession: (id: string) => void;

  // System & Workflow
  isInitialized: boolean;
  setInitialized: (value: boolean) => void;
  workflow: WorkflowState;
}

interface WorkflowState {
  // Workflow-specific access to core state
  agents: Agent[];
  tools: Tool[];
  chatSessions: ChatSession[];
  currentChatId: string | null;
  // Agent workflow methods
  updateDraftAgent: (id: string, updates: Partial<Agent>) => void;
  saveDraftAgent: (id: string) => void;
  hasDraftAgent: (id: string) => boolean;
  addAgent: (agent: Agent) => void;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  deleteAgent: (id: string) => void;
  // Chat workflow methods
  setCurrentChatId: (id: string | null) => void;
  addChatSession: (session: ChatSession) => void;
  updateChatSession: (id: string, updates: Partial<ChatSession>) => void;
  deleteChatSession: (id: string) => void;
  // Tool workflow methods
  addTool: (tool: Tool) => void;
  updateTool: (id: string, updates: Partial<Tool>) => void;
  deleteTool: (id: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => {
      const state = {
        settings: {
          lmStudioUrl: '',
          weaviateUrl: '',
          openaiKey: '',
          claudeKey: '',
          theme: 'light' as const,
        } satisfies Settings,
        draftSettings: null,
        updateSettings: (newSettings: Partial<Settings>) =>
          set((state) => ({
            settings: { ...state.settings, ...newSettings },
            draftSettings: null,
            isInitialized: true,
          })),
        saveDraftSettings: async () => {
          try {
            // Simulate async operation (e.g., API call or local storage update)
            await new Promise((resolve) => setTimeout(resolve, 100));
            
            set((state) => ({
              settings: state.draftSettings ? { ...state.settings, ...state.draftSettings } : state.settings,
              draftSettings: null,
            }));
          } catch (error) {
            console.error('Failed to save settings:', error);
            throw error;
          }
        },
        updateDraftSettings: (newSettings: Partial<Settings>) =>
          set((state) => ({
            draftSettings: { ...state.settings, ...(state.draftSettings || {}), ...newSettings },
          })),
        hasDraftSettings: () => {
          const state = get();
          return state.draftSettings !== null;
        },
        currentChatId: null,
        setCurrentChatId: (id: string | null) => set({ currentChatId: id }),
        chatSessions: [],
        addChatSession: (session: ChatSession) =>
          set((state) => ({
            chatSessions: [...state.chatSessions, session],
            currentChatId: session.id,
          })),
        updateChatSession: (id: string, updates: Partial<ChatSession>) =>
          set((state) => ({
            chatSessions: state.chatSessions.map((session) =>
              session.id === id ? { ...session, ...updates } : session
            ),
          })),
        deleteChatSession: (id: string) =>
          set((state) => ({
            chatSessions: state.chatSessions.filter((session) => session.id !== id),
            currentChatId: state.currentChatId === id ? null : state.currentChatId,
          })),
        agents: [],
        draftAgents: {},
        addAgent: (agent: Agent) =>
          set((state) => ({
            agents: [...state.agents, agent],
          })),
        updateAgent: (id: string, updates: Partial<Agent>) =>
          set((state) => ({
            agents: state.agents.map((agent) =>
              agent.id === id ? { ...agent, ...updates } : agent
            ),
            draftAgents: {
              ...state.draftAgents,
              [id]: null
            }
          })),
        updateDraftAgent: (id: string, updates: Partial<Agent>) =>
          set((state) => {
            const agent = state.agents.find(a => a.id === id);
            if (!agent) return state;
            
            const currentDraft = state.draftAgents?.[id] || agent;
            return {
              draftAgents: {
                ...(state.draftAgents || {}),
                [id]: { ...currentDraft, ...updates }
              }
            };
          }),
        saveDraftAgent: (id: string) =>
          set((state) => {
            const draftAgent = state.draftAgents[id];
            if (!draftAgent) return state;
            
            return {
              agents: state.agents.map((agent) =>
                agent.id === id ? { ...agent, ...draftAgent } : agent
              ),
              draftAgents: {
                ...state.draftAgents,
                [id]: null
              }
            };
          }),
        hasDraftAgent: (id: string) => {
          const state = get();
          return state.draftAgents[id] !== null && state.draftAgents[id] !== undefined;
        },
        deleteAgent: (id: string) =>
          set((state) => ({
            agents: state.agents.filter((agent) => agent.id !== id),
          })),
        // Tools state
        tools: [],
        draftTools: {},
        addTool: (tool: Tool) =>
          set((state) => ({
            tools: [...state.tools, tool],
          })),
        updateTool: (id: string, updates: Partial<Tool>) =>
          set((state) => ({
            tools: state.tools.map((tool) =>
              tool.id === id ? { ...tool, ...updates } : tool
            ),
            draftTools: {
              ...state.draftTools,
              [id]: null
            }
          })),
        deleteTool: (id: string) =>
          set((state) => ({
            tools: state.tools.filter((tool) => tool.id !== id),
            draftTools: {
              ...state.draftTools,
              [id]: null
            }
          })),
        updateDraftTool: (id: string, updates: Partial<Tool>) =>
          set((state) => {
            const tool = state.tools.find(t => t.id === id);
            if (!tool) return state;
            
            const currentDraft = state.draftTools?.[id] || tool;
            return {
              draftTools: {
                ...(state.draftTools || {}),
                [id]: { ...currentDraft, ...updates }
              }
            };
          }),
        saveDraftTool: (id: string) =>
          set((state) => {
            const draftTool = state.draftTools[id];
            if (!draftTool) return state;
            
            return {
              tools: state.tools.map((tool) =>
                tool.id === id ? { ...tool, ...draftTool } : tool
              ),
              draftTools: {
                ...state.draftTools,
                [id]: null
              }
            };
          }),
        hasDraftTool: (id: string) => {
          const state = get();
          return state.draftTools[id] !== null && state.draftTools[id] !== undefined;
        },
        apis: [],
        draftApis: {},
        addAPI: (api: API) =>
          set((state) => ({
            apis: [...state.apis, api],
          })),
        updateAPI: (id: string, updates: Partial<API>) =>
          set((state) => ({
            apis: state.apis.map((api) =>
              api.id === id ? { ...api, ...updates } : api
            ),
            draftApis: {
              ...state.draftApis,
              [id]: null
            }
          })),
        deleteAPI: (id: string) =>
          set((state) => ({
            apis: state.apis.filter((api) => api.id !== id),
          })),
        updateDraftAPI: (id: string, updates: Partial<API>) =>
          set((state) => {
            const api = state.apis.find(a => a.id === id);
            if (!api) return state;
            
            const currentDraft = state.draftApis?.[id] || api;
            return {
              draftApis: {
                ...(state.draftApis || {}),
                [id]: { ...currentDraft, ...updates }
              }
            };
          }),
        saveDraftAPI: (id: string) =>
          set((state) => {
            const draftAPI = state.draftApis[id];
            if (!draftAPI) return state;
            
            return {
              apis: state.apis.map((api) =>
                api.id === id ? { ...api, ...draftAPI } : api
              ),
              draftApis: {
                ...state.draftApis,
                [id]: null
              }
            };
          }),
        hasDraftAPI: (id: string) => {
          const state = get();
          return state.draftApis[id] !== null && state.draftApis[id] !== undefined;
        },
        // MCP state
        draftMCPs: {},
        updateDraftMCP: (id: string, updates: Partial<ModelContext>) =>
          set((state) => {
            const context = mcp.getContext(id);
            if (!context) return state;
            
            const currentDraft = state.draftMCPs?.[id] || context;
            return {
              draftMCPs: {
                ...(state.draftMCPs || {}),
                [id]: { ...currentDraft, ...updates }
              }
            };
          }),
        saveDraftMCP: (id: string) =>
          set((state) => {
            const draftMCP = state.draftMCPs[id];
            if (!draftMCP) return state;
            
            mcp.updateContext(id, draftMCP);
            return {
              draftMCPs: {
                ...state.draftMCPs,
                [id]: null
              }
            };
          }),
        hasDraftMCP: (id: string) => {
          const state = get();
          return state.draftMCPs[id] !== null && state.draftMCPs[id] !== undefined;
        },
        isInitialized: false,
        setInitialized: (value: boolean) => set({ isInitialized: value }),
      };

      return {
        ...state,
        workflow: {
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
          deleteTool: state.deleteTool
        }
      };
    },
    {
      name: 'multi-llm-app-storage',
      version: 1,
    }
  )
);
