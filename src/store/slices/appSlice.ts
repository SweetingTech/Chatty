import { StateCreator } from 'zustand';
import type { AppState } from '../index';
import type { ChatMessage } from '../../types';
import { chromadb } from '../../lib/chromadb';
import { weaviateService } from '../../lib/weaviate';
import type { ChromaChatSession } from '../../lib/chromadb/types';

export interface AppSlice {
  isInitialized: boolean;
  setInitialized: (value: boolean) => void;
  initializeServices: () => Promise<void>;
}

export const createAppSlice: StateCreator<AppState, [], [], AppSlice> = (set, get) => ({
  isInitialized: false,
  setInitialized: (value) => set({ isInitialized: value }),

  initializeServices: async () => {
    const { updateServiceStatus, setInitialized } = get();

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
          set({ chatSessions: transformedSessions });
        }
      };

      // Clean up broadcast channel on window unload
      window.addEventListener('unload', () => bc.close());

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

      set({ chatSessions: transformedSessions });

      try {
        await weaviateService.init();
        updateServiceStatus({ weaviate: 'online' });
      } catch (err) {
        console.warn('Weaviate initialization failed:', err);
        updateServiceStatus({ weaviate: 'error' });
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
