import { StateCreator } from 'zustand';
import type { AppState } from '../index';
import type { ChatMessage } from '../../types';
import { chromadb } from '../../lib/chromadb';
import { weaviateService } from '../../lib/weaviate';
import type { ChromaChatSession } from '../../lib/chromadb/types';
import { defaultAgents } from '../../lib/agents/defaults';
import { defaultTools } from '../../lib/tools/defaults';

export interface AppSlice {
  isInitialized: boolean;
  setInitialized: (value: boolean) => void;
  initializeServices: () => Promise<void>;
}

export const createAppSlice: StateCreator<AppState, [], [], AppSlice> = (set, get) => ({
  isInitialized: false,
  setInitialized: (value) => set({ isInitialized: value }),

  initializeServices: async () => {
    const { updateServiceStatus, setInitialized, updateSettings, settings } = get();

    try {
      // Initialize ChromaDB first (primary database)
      await chromadb.init();
      updateServiceStatus({ chromadb: 'online' });

      // Set up broadcast channel for cross-tab sync
      const bc = new BroadcastChannel('chatty_sync');
      bc.onmessage = async (event) => {
        if (event.data.type === 'session_update') {
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
          set({ chatSessions: transformedSessions });
        }
      };

      window.addEventListener('unload', () => bc.close());

      // Load saved settings from ChromaDB
      try {
        const savedSettings = await chromadb.getUserSettings();
        if (Object.keys(savedSettings).length > 0) {
          updateSettings(savedSettings);
        }
      } catch (error) {
        console.error('Failed to load settings from ChromaDB:', error);
      }

      // Load additional agents and tools
      const allAgents = [...defaultAgents];
      const allTools = [...defaultTools];

      try {
        const additionalAgentsCollection = await chromadb.getOrCreateCollection('additional_agents');
        const additionalAgentsResult = await additionalAgentsCollection.get();
        if (Array.isArray(additionalAgentsResult) && additionalAgentsResult.length > 0) {
          const extraAgents = additionalAgentsResult.map(doc => JSON.parse(doc.document as string));
          allAgents.push(...extraAgents);
        }

        const additionalToolsCollection = await chromadb.getOrCreateCollection('additional_tools');
        const additionalToolsResult = await additionalToolsCollection.get();
        if (Array.isArray(additionalToolsResult) && additionalToolsResult.length > 0) {
          const extraTools = additionalToolsResult.map(doc => JSON.parse(doc.document as string));
          allTools.push(...extraTools);
        }
      } catch (error) {
        console.error('Failed to load additional agents/tools from ChromaDB:', error);
      }

      // Fetch initial chat sessions from ChromaDB
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

      set({
        chatSessions: transformedSessions,
        agents: allAgents,
        tools: allTools,
      });

      try {
        await weaviateService.init();
        updateServiceStatus({ weaviate: 'online' });
      } catch (err) {
        console.warn('Weaviate initialization failed:', err);
        updateServiceStatus({ weaviate: 'error' });
      }

      try {
        const lmStudioUrl = settings.lmStudioUrl || 'http://localhost:1234';
        const response = await fetch(lmStudioUrl);
        updateServiceStatus({ lmStudio: response.ok ? 'online' : 'offline' });
      } catch (error) {
        console.error('Failed to connect to LM Studio:', error);
        updateServiceStatus({ lmStudio: 'offline' });
      }

      setInitialized(true);
    } catch (error) {
      console.error('Service initialization failed:', error);
      updateServiceStatus({ chromadb: 'error' });
      setInitialized(true); // Allow app to render with error state
      throw error;
    }
  },
});
