import { create } from 'zustand';
import type { Settings, ChatSession, Agent, Tool, API, LLMConfig, ProviderType, ServiceStatus, ChatMessage } from '../types';
import { mcp, type ModelContext } from '../lib/mcp';
import { weaviateService } from '../lib/weaviate';
import { chromadb } from '../lib/chromadb';
import { defaultAgents } from '../lib/agents/defaults';
import { defaultTools } from '../lib/tools/defaults';
import type { ChromaDocument, ChromaCollectionResponse, ChromaChatSession } from '../lib/chromadb/types';

// Environment variables with proper typing
const VITE_LM_STUDIO_HOST = (import.meta.env.VITE_LM_STUDIO_HOST as string) || 'localhost';
const VITE_LM_STUDIO_PORT = (import.meta.env.VITE_LM_STUDIO_PORT as string) || '1234';
const VITE_LM_STUDIO_URL = `http://${VITE_LM_STUDIO_HOST}:${VITE_LM_STUDIO_PORT}`;

// Weaviate configuration
const WEAVIATE_HOST = (import.meta.env.WEAVIATE_HOST as string) || 'localhost';
const WEAVIATE_PORT = (import.meta.env.WEAVIATE_PORT as string) || '8080';
const WEAVIATE_URL = `http://${WEAVIATE_HOST}:${WEAVIATE_PORT}`;
const WEAVIATE_API_KEY = (import.meta.env.WEAVIATE_API_KEY as string) || '';
const WEAVIATE_SCHEMA_CLASS = (import.meta.env.WEAVIATE_SCHEMA_CLASS as string) || 'ChatSession';
const WEAVIATE_BATCH_SIZE = parseInt((import.meta.env.WEAVIATE_BATCH_SIZE as string) || '100');
const WEAVIATE_VECTORIZER_MODULE = (import.meta.env.WEAVIATE_VECTORIZER_MODULE as string) || 'text2vec-transformers';

// LLM API Keys
const VITE_OPENAI_API_KEY = (import.meta.env.VITE_OPENAI_API_KEY as string) || '';
const VITE_CLAUDE_API_KEY = (import.meta.env.VITE_CLAUDE_API_KEY as string) || '';
const VITE_BRAVE_API_KEY = (import.meta.env.VITE_BRAVE_API_KEY as string) || '';
const VITE_DEEPSEEK_API_KEY = (import.meta.env.VITE_DEEPSEEK_API_KEY as string) || '';

export interface AppState {
  // Settings
  settings: Settings;
  draftSettings: Settings | null;
  updateSettings: (settings: Partial<Settings>) => void;
  saveDraftSettings: () => Promise<void>;
  updateDraftSettings: (settings: Partial<Settings>) => void;
  hasDraftSettings: () => boolean;

  // Service Status
  serviceStatus: ServiceStatus;
  updateServiceStatus: (status: Partial<ServiceStatus>) => void;
  initializeServices: () => Promise<void>;

  // LLM Providers
  llmConfigs: Record<ProviderType, LLMConfig>;
  updateLLMConfig: (provider: ProviderType, config: Partial<LLMConfig>) => void;
  setDefaultProvider: (provider: ProviderType) => void;

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

export const useAppStore = create<AppState>((set, get) => {
  const getState = get;
  const setState = (fn: (state: AppState) => Partial<AppState>) => {
    const updates = fn(getState());
    set((state) => ({ ...state, ...updates }));
    return updates;
  };
  const storeState: AppState = {
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
      defaultLLMProvider: 'lm-studio',
    },
    draftSettings: null,
    serviceStatus: {
      weaviate: 'offline',
      chromadb: 'offline',
      lmStudio: 'offline',
    },
    llmConfigs: {
      'lm-studio': {
        provider: 'lm-studio',
        enabled: true,
        isDefault: true,
        model: 'default',
        temperature: 0.7,
        maxTokens: 2000,
      },
      'openai': {
        provider: 'openai',
        enabled: true,
        isDefault: false,
        apiKey: VITE_OPENAI_API_KEY,
        model: 'gpt-3.5-turbo-0125', // Updated to use the latest model
        temperature: 0.7,
        maxTokens: 2000,
      },
      'claude': {
        provider: 'claude',
        enabled: true,
        isDefault: false,
        apiKey: VITE_CLAUDE_API_KEY,
        model: 'claude-2',
        temperature: 0.7,
        maxTokens: 2000,
      },
      'deepseek': {
        provider: 'deepseek',
        enabled: true,
        isDefault: false,
        apiKey: VITE_DEEPSEEK_API_KEY,
        model: 'deepseek-chat',
        temperature: 0.7,
        maxTokens: 2000,
      },
      'none': {
        provider: 'none',
        enabled: true,
        isDefault: false,
      },
    },
    updateSettings: async (newSettings: Partial<Settings>) => {
      try {
        // Save settings to ChromaDB
        await chromadb.saveUserSettings({
          ...getState().settings,
          ...newSettings
        });

        // Update store state
        setState((state) => ({
          settings: { ...state.settings, ...newSettings },
          draftSettings: null,
          isInitialized: true,
        }));

        // Update LLM configs if API keys changed
        if ('openaiKey' in newSettings) {
          getState().updateLLMConfig('openai', { apiKey: newSettings.openaiKey });
        }
        if ('claudeKey' in newSettings) {
          getState().updateLLMConfig('claude', { apiKey: newSettings.claudeKey });
        }
        if ('deepseekKey' in newSettings) {
          getState().updateLLMConfig('deepseek', { apiKey: newSettings.deepseekKey as string });
        }
      } catch (error) {
        console.error('Failed to save settings:', error);
        throw error;
      }
    },
    saveDraftSettings: async () => {
      try {
        const state = getState();
        if (state.draftSettings) {
          await state.updateSettings(state.draftSettings);
        }
      } catch (error) {
        console.error('Failed to save draft settings:', error);
        throw error;
      }
    },
    updateDraftSettings: (newSettings: Partial<Settings>) => {
      setState((state) => ({
        draftSettings: { ...state.settings, ...(state.draftSettings || {}), ...newSettings },
      }));
    },
    hasDraftSettings: () => {
      const state = getState();
      return state.draftSettings !== null;
    },
    updateServiceStatus: (status: Partial<ServiceStatus>) => {
      setState((state) => ({
        serviceStatus: { ...state.serviceStatus, ...status },
      }));
    },
    initializeServices: async () => {
      const state = getState();
      const { settings, updateServiceStatus, updateSettings } = state;

      try {
        // Initialize ChromaDB first (primary database)
        await chromadb.init();
        updateServiceStatus({ chromadb: 'online' });

        // Set up broadcast channel for cross-tab sync
        const bc = new BroadcastChannel('chatty_sync');
        bc.onmessage = async (event) => {
          if (event.data.type === 'session_update') {
            // Fetch updated sessions when we receive a broadcast
            const sessions = await chromadb.getAllChatSessions() as ChromaChatSession[];
            const transformedSessions = sessions.map((session: ChromaChatSession) => {
              let messages: ChatMessage[] = [];
              try {
                if (typeof session.messages === 'string') {
                  messages = JSON.parse(session.messages) as ChatMessage[];
                } else if (Array.isArray(session.messages)) {
                  messages = session.messages as ChatMessage[];
                }
              } catch (err) {
                console.error('Failed to parse messages:', err);
              }
              const firstMessage = messages[0];
              return {
                id: session.id,
                title: firstMessage?.content?.slice(0, 30) + '...' || 'Chat Session',
                messages,
                createdAt: session.metadata?.timestamp || Date.now(),
                updatedAt: session.metadata?.timestamp || Date.now(),
              };
            });
            setState((st) => ({ ...st, chatSessions: transformedSessions }));
          }
        };

        // Clean up broadcast channel on window unload
        window.addEventListener('unload', () => bc.close());

        // Also set up periodic polling as a fallback
        const pollInterval = setInterval(async () => {
          try {
            if (chromadb.isConnected()) {
              const sessions = await chromadb.getAllChatSessions() as ChromaChatSession[];
              const transformedSessions = sessions.map((session: ChromaChatSession) => {
                let messages: ChatMessage[] = [];
                try {
                  if (typeof session.messages === 'string') {
                    messages = JSON.parse(session.messages) as ChatMessage[];
                  } else if (Array.isArray(session.messages)) {
                    messages = session.messages as ChatMessage[];
                  }
                } catch (err) {
                  console.error('Failed to parse messages:', err);
                }
                const firstMessage = messages[0];
                return {
                  id: session.id,
                  title: firstMessage?.content?.slice(0, 30) + '...' || 'Chat Session',
                  messages,
                  createdAt: session.metadata?.createdAt || Date.now(),
                  updatedAt: session.metadata?.updatedAt || Date.now(),
                };
              });

              // Only update if there are changes
              const currentSessions = getState().chatSessions;
              if (JSON.stringify(currentSessions) !== JSON.stringify(transformedSessions)) {
                setState((st) => ({
                  ...st,
                  chatSessions: transformedSessions,
                }));
              }
            }
          } catch (error) {
            console.error('Failed to poll chat sessions:', error);
          }
        }, 2000); // Poll every 2 seconds

        // Clean up interval on window unload
        window.addEventListener('unload', () => clearInterval(pollInterval));

        // Load saved settings from ChromaDB
        try {
          const savedSettings = await chromadb.getUserSettings();
          if (Object.keys(savedSettings).length > 0) {
            updateSettings(savedSettings);
          }
        } catch (error) {
          console.error('Failed to load settings from ChromaDB:', error);
        }

        // Start with default agents and tools
        const allAgents = [...defaultAgents];
        const allTools = [...defaultTools];

        try {
          // Load additional agents from ChromaDB
          const additionalAgentsCollection = await chromadb.getOrCreateCollection('additional_agents');
          const additionalAgentsResult = await additionalAgentsCollection.get();
          if (Array.isArray(additionalAgentsResult) && additionalAgentsResult.length > 0) {
            const extraAgents = additionalAgentsResult.map(doc => JSON.parse(doc.document));
            allAgents.push(...extraAgents);
          }

          // Load additional tools from ChromaDB
          const additionalToolsCollection = await chromadb.getOrCreateCollection('additional_tools');
          const additionalToolsResult = await additionalToolsCollection.get();
          if (Array.isArray(additionalToolsResult) && additionalToolsResult.length > 0) {
            const extraTools = additionalToolsResult.map(doc => JSON.parse(doc.document));
            allTools.push(...extraTools);
          }

          // Load chat sessions
          const sessions = await chromadb.getAllChatSessions() as ChromaChatSession[];
          console.log('Loaded chat sessions from ChromaDB:', sessions);

          const transformedSessions = sessions.map((session: ChromaChatSession) => {
            let messages: ChatMessage[] = [];
            try {
              if (typeof session.messages === 'string') {
                messages = JSON.parse(session.messages) as ChatMessage[];
              } else if (Array.isArray(session.messages)) {
                messages = session.messages as ChatMessage[];
              }
            } catch (err) {
              console.error('Failed to parse messages:', err);
            }
            const firstMessage = messages[0];
            return {
              id: session.id,
              title: firstMessage?.content?.slice(0, 30) + '...' || 'Chat Session',
              messages,
              createdAt: session.metadata?.createdAt || Date.now(),
              updatedAt: session.metadata?.updatedAt || Date.now(),
            };
          });

          // Update store with all loaded data
          setState((st) => ({
            ...st,
            agents: allAgents,
            tools: allTools,
            chatSessions: transformedSessions,
          }));

        } catch (error) {
          console.error('Failed to load data from ChromaDB:', error);
          updateServiceStatus({ chromadb: 'offline' });
        }
      } catch (error) {
        console.error('Failed to connect to ChromaDB:', error);
        updateServiceStatus({ chromadb: 'offline' });
      }

      // Initialize Weaviate last (only for embeddings)
      try {
        if (settings.weaviateUrl) {
          await weaviateService.init(settings.weaviateUrl, settings.weaviateApiKey);
          updateServiceStatus({ weaviate: 'online' });
        } else {
          console.warn('Weaviate URL not configured');
        }
      } catch (error) {
        console.error('Failed to initialize Weaviate:', error);
        updateServiceStatus({ weaviate: 'offline' });
      }

      try {
        const lmStudioUrl = settings.lmStudioUrl || VITE_LM_STUDIO_URL;
        const response = await fetch(lmStudioUrl);
        updateServiceStatus({ lmStudio: response.ok ? 'online' : 'offline' });
      } catch (error) {
        console.error('Failed to connect to LM Studio:', error);
        updateServiceStatus({ lmStudio: 'offline' });
      }
    },
    updateLLMConfig: (provider: ProviderType, config: Partial<LLMConfig>) => {
      setState((st) => ({
        llmConfigs: {
          ...st.llmConfigs,
          [provider]: { ...st.llmConfigs[provider], ...config },
        },
      }));
    },
    setDefaultProvider: (provider: ProviderType) => {
      setState((st) => {
        const updatedConfigs = Object.entries(st.llmConfigs).reduce(
          (acc, [key, cfg]) => ({
            ...acc,
            [key]: { ...cfg, isDefault: false },
          }),
          {} as Record<ProviderType, LLMConfig>
        );

        updatedConfigs[provider] = {
          ...updatedConfigs[provider],
          isDefault: true,
        };

        return {
          settings: {
            ...st.settings,
            defaultLLMProvider: provider,
          },
          llmConfigs: updatedConfigs,
        };
      });
    },
    currentChatId: null,
    setCurrentChatId: (id: string | null) => {
      set((state) => ({ ...state, currentChatId: id }));
    },
    chatSessions: [],
    addChatSession: async (session: ChatSession) => {
      try {
        await chromadb.saveChatSession(session.id, JSON.stringify(session.messages));
        setState((st) => ({
          chatSessions: [...st.chatSessions, session],
          currentChatId: session.id,
        }));
      } catch (error) {
        console.error('Failed to save chat session to ChromaDB:', error);
        throw error;
      }
    },
    updateChatSession: async (id: string, updates: Partial<ChatSession>) => {
      try {
        const state = getState();
        const existingSession = state.chatSessions.find((s) => s.id === id);
        if (!existingSession) return;

        const updatedSession = { ...existingSession, ...updates };
        await chromadb.saveChatSession(id, JSON.stringify(updatedSession.messages));

        setState((ss) => ({
          chatSessions: ss.chatSessions.map((session) =>
            session.id === id ? updatedSession : session
          ),
        }));
      } catch (error) {
        console.error('Failed to update chat session in ChromaDB:', error);
        throw error;
      }
    },
    deleteChatSession: async (id: string) => {
      try {
        // Delete from ChromaDB first
        await chromadb.deleteChatSession(id);

        // Then clean up any associated documents in Weaviate
        try {
          await weaviateService.deleteDocumentsByChatId(id);
        } catch (weaviateError) {
          console.error('Failed to clean up Weaviate documents:', weaviateError);
          // Continue with chat deletion even if Weaviate cleanup fails
        }

        // Finally update the store state
        setState((st) => ({
          chatSessions: st.chatSessions.filter((s) => s.id !== id),
          currentChatId: st.currentChatId === id ? null : st.currentChatId,
        }));
      } catch (error) {
        console.error('Failed to delete chat session from ChromaDB:', error);
        throw error;
      }
    },
    agents: [],
    draftAgents: {},
    addAgent: (agent: Agent) => {
      setState((st) => ({
        agents: [...st.agents, agent],
      }));
    },
    updateAgent: async (id: string, updates: Partial<Agent>) => {
      const state = getState();
      const agent = state.agents.find((a) => a.id === id);
      if (!agent) return;

      const baseAgent = defaultAgents.find((a) => a.id === id);
      if (!baseAgent) return;

      const updatedAgent = { ...agent, ...updates };
      const changes = Object.entries(updatedAgent).reduce((acc, [key, value]) => {
        if (JSON.stringify(value) !== JSON.stringify((baseAgent as any)[key])) {
          acc[key] = value;
        }
        return acc;
      }, {} as Record<string, any>);

      if (Object.keys(changes).length > 0) {
        try {
          const collection = await chromadb.getOrCreateCollection('agent_modifications', {
            description: 'Stores modifications to default agents',
          });
          await collection.add({
            ids: [id],
            metadatas: [{ timestamp: Date.now() }],
            documents: [JSON.stringify({ targetId: id, changes })],
          });
        } catch (error) {
          console.error('Failed to save agent modifications:', error);
        }
      }

      setState((sts) => ({
        agents: sts.agents.map((g) => (g.id === id ? { ...g, ...updates } : g)),
        draftAgents: { ...sts.draftAgents, [id]: null },
      }));
    },
    updateDraftAgent: (id: string, updates: Partial<Agent>) => {
      setState((st) => {
        const ag = st.agents.find((a) => a.id === id);
        if (!ag) return st;

        const currentDraft = st.draftAgents[id] || ag;
        return {
          draftAgents: {
            ...st.draftAgents,
            [id]: { ...currentDraft, ...updates },
          },
        };
      });
    },
    saveDraftAgent: (id: string) => {
      setState((st) => {
        const draftAgent = st.draftAgents[id];
        if (!draftAgent) return st;

        return {
          agents: st.agents.map((a) => (a.id === id ? { ...a, ...draftAgent } : a)),
          draftAgents: { ...st.draftAgents, [id]: null },
        };
      });
    },
    hasDraftAgent: (id: string) => {
      const state = getState();
      return state.draftAgents[id] !== null && state.draftAgents[id] !== undefined;
    },
    deleteAgent: (id: string) => {
      setState((st) => ({
        agents: st.agents.filter((a) => a.id !== id),
      }));
    },
    tools: [],
    draftTools: {},
    addTool: (tool: Tool) => {
      setState((st) => ({
        tools: [...st.tools, tool],
      }));
    },
    updateTool: async (id: string, updates: Partial<Tool>) => {
      const state = getState();
      const tool = state.tools.find((t) => t.id === id);
      if (!tool) return;

      const baseTool = defaultTools.find((t) => t.id === id);
      if (!baseTool) return;

      const updatedTool = { ...tool, ...updates };
      const changes = Object.entries(updatedTool).reduce((acc, [key, value]) => {
        if (JSON.stringify(value) !== JSON.stringify((baseTool as any)[key])) {
          acc[key] = value;
        }
        return acc;
      }, {} as Record<string, any>);

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

      setState((sts) => ({
        tools: sts.tools.map((tl) => (tl.id === id ? { ...tl, ...updates } : tl)),
        draftTools: { ...sts.draftTools, [id]: null },
      }));
    },
    deleteTool: (id: string) => {
      setState((st) => ({
        tools: st.tools.filter((t) => t.id !== id),
        draftTools: { ...st.draftTools, [id]: null },
      }));
    },
    updateDraftTool: (id: string, updates: Partial<Tool>) => {
      setState((st) => {
        const tl = st.tools.find((t) => t.id === id);
        if (!tl) return st;

        const currentDraft = st.draftTools[id] || tl;
        return {
          draftTools: {
            ...st.draftTools,
            [id]: { ...currentDraft, ...updates },
          },
        };
      });
    },
    saveDraftTool: (id: string) => {
      setState((st) => {
        const draftTool = st.draftTools[id];
        if (!draftTool) return st;

        return {
          tools: st.tools.map((tl) => (tl.id === id ? { ...tl, ...draftTool } : tl)),
          draftTools: { ...st.draftTools, [id]: null },
        };
      });
    },
    hasDraftTool: (id: string) => {
      const state = getState();
      return state.draftTools[id] !== null && state.draftTools[id] !== undefined;
    },
    apis: [],
    draftApis: {},
    addAPI: (api: API) => {
      setState((st) => ({
        apis: [...st.apis, api],
      }));
    },
    updateAPI: (id: string, updates: Partial<API>) => {
      setState((st) => ({
        apis: st.apis.map((a) => (a.id === id ? { ...a, ...updates } : a)),
        draftApis: { ...st.draftApis, [id]: null },
      }));
    },
    deleteAPI: (id: string) => {
      setState((st) => ({
        apis: st.apis.filter((a) => a.id !== id),
      }));
    },
    updateDraftAPI: (id: string, updates: Partial<API>) => {
      setState((st) => {
        const api = st.apis.find((a) => a.id === id);
        if (!api) return st;

        const currentDraft = st.draftApis[id] || api;
        return {
          draftApis: {
            ...st.draftApis,
            [id]: { ...currentDraft, ...updates },
          },
        };
      });
    },
    saveDraftAPI: (id: string) => {
      setState((st) => {
        const draftAPI = st.draftApis[id];
        if (!draftAPI) return st;

        return {
          apis: st.apis.map((a) => (a.id === id ? { ...a, ...draftAPI } : a)),
          draftApis: { ...st.draftApis, [id]: null },
        };
      });
    },
    hasDraftAPI: (id: string) => {
      const state = getState();
      return state.draftApis[id] !== null && state.draftApis[id] !== undefined;
    },
    draftMCPs: {},
    updateDraftMCP: (id: string, updates: Partial<ModelContext>) => {
      setState((st) => {
        const contexts = mcp.getAllContexts();
        const context = contexts.find((c) => c.id === id);
        if (!context) return st;

        const currentDraft = st.draftMCPs[id] || context;
        return {
          draftMCPs: {
            ...st.draftMCPs,
            [id]: { ...currentDraft, ...updates },
          },
        };
      });
    },
    saveDraftMCP: async (id: string) => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 100));
        setState((st) => {
          const draftMCP = st.draftMCPs[id];
          if (!draftMCP) return st;

          mcp.deleteContext(id);
          mcp.createContext(draftMCP.model, draftMCP.context, draftMCP.metadata);

          return {
            draftMCPs: { ...st.draftMCPs, [id]: null },
          };
        });
      } catch (error) {
        console.error('Failed to save MCP draft:', error);
        throw error;
      }
    },
    hasDraftMCP: (id: string) => {
      const state = getState();
      return state.draftMCPs[id] !== null && state.draftMCPs[id] !== undefined;
    },
    isInitialized: false,
    setInitialized: (value: boolean) => {
      set((state) => ({ ...state, isInitialized: value }));
    },
    workflow: {
      get agents() { return getState().agents; },
      get tools() { return getState().tools; },
      get chatSessions() { return getState().chatSessions; },
      get currentChatId() { return getState().currentChatId; },
      updateDraftAgent: (id: string, updates: Partial<Agent>) => getState().updateDraftAgent(id, updates),
      saveDraftAgent: (id: string) => getState().saveDraftAgent(id),
      hasDraftAgent: (id: string) => getState().hasDraftAgent(id),
      addAgent: (agent: Agent) => getState().addAgent(agent),
      updateAgent: (id: string, updates: Partial<Agent>) => getState().updateAgent(id, updates),
      deleteAgent: (id: string) => getState().deleteAgent(id),
      setCurrentChatId: (id: string | null) => getState().setCurrentChatId(id),
      addChatSession: (session: ChatSession) => getState().addChatSession(session),
      updateChatSession: (id: string, updates: Partial<ChatSession>) => getState().updateChatSession(id, updates),
      deleteChatSession: (id: string) => getState().deleteChatSession(id),
      addTool: (tool: Tool) => getState().addTool(tool),
      updateTool: (id: string, updates: Partial<Tool>) => getState().updateTool(id, updates),
      deleteTool: (id: string) => getState().deleteTool(id)
    }
  };
  return storeState;
});
