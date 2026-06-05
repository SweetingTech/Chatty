import { StateCreator } from 'zustand';
import type { AppState } from '../index';
import type { ChatSession } from '../../types';
import { chromadb } from '../../lib/chromadb';
import { weaviateService } from '../../lib/weaviate';
import type { ChromaChatSession } from '../../lib/chromadb/types';

export interface ChatSlice {
  currentChatId: string | null;
  setCurrentChatId: (id: string | null) => void;
  chatSessions: ChatSession[];
  addChatSession: (session: ChatSession) => void;
  updateChatSession: (id: string, updates: Partial<ChatSession>) => void;
  deleteChatSession: (id: string) => void;
}

export const createChatSlice: StateCreator<AppState, [], [], ChatSlice> = (set, get) => ({
  currentChatId: null,
  chatSessions: [],

  setCurrentChatId: (id) => set({ currentChatId: id }),

  addChatSession: (session) => {
    set((state) => ({
      chatSessions: [session, ...state.chatSessions],
      currentChatId: session.id,
    }));
  },

  updateChatSession: (id, updates) => {
    set((state) => ({
      chatSessions: state.chatSessions.map((session) =>
        session.id === id ? { ...session, ...updates, updatedAt: Date.now() } : session
      ),
    }));
  },

  deleteChatSession: (id) => {
    set((state) => ({
      chatSessions: state.chatSessions.filter((s) => s.id !== id),
      currentChatId: state.currentChatId === id ? null : state.currentChatId,
    }));

    // Perform async cleanup without waiting
    (async () => {
      try {
        // Find session to get its documents
        const state = get();
        const session = state.chatSessions.find(s => s.id === id);

        // Delete from ChromaDB first
        await chromadb.deleteChatSession(id);

        // Then clean up any associated documents in Weaviate
        if (session) {
          // Find documents associated with this session's messages
          const messageIds = session.messages.map(m => m.id);
          for (const msgId of messageIds) {
            // Delete chunks for this message
            await weaviateService.deleteDocument(msgId);
          }
        }
      } catch (error) {
        console.error('Failed to clean up chat session:', error);
      }
    })();
  },
});
