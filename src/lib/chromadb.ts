import { ChromaClient, Collection } from 'chromadb';

class ChromaDBClient {
  private static instance: ChromaDBClient;
  private client: ChromaClient;
  private chatCollection: Collection | null = null;

  private constructor() {
    this.client = new ChromaClient();
  }

  public static getInstance(): ChromaDBClient {
    if (!ChromaDBClient.instance) {
      ChromaDBClient.instance = new ChromaDBClient();
    }
    return ChromaDBClient.instance;
  }

  public async init() {
    try {
      this.chatCollection = await this.client.getOrCreateCollection({
        name: 'chat_sessions',
      });
    } catch (error) {
      console.error('Failed to initialize ChromaDB:', error);
      throw error;
    }
  }

  public async saveChatSession(sessionId: string, messages: any[]) {
    if (!this.chatCollection) {
      throw new Error('ChromaDB not initialized');
    }

    try {
      await this.chatCollection.add({
        ids: [sessionId],
        metadatas: [{ timestamp: Date.now() }],
        documents: [JSON.stringify(messages)],
      });
    } catch (error) {
      console.error('Failed to save chat session:', error);
      throw error;
    }
  }

  public async getChatSession(sessionId: string) {
    if (!this.chatCollection) {
      throw new Error('ChromaDB not initialized');
    }

    try {
      const result = await this.chatCollection.get({
        ids: [sessionId],
      });

      if (result.documents.length === 0) {
        return null;
      }

      return JSON.parse(result.documents[0]);
    } catch (error) {
      console.error('Failed to get chat session:', error);
      throw error;
    }
  }

  public async deleteChatSession(sessionId: string) {
    if (!this.chatCollection) {
      throw new Error('ChromaDB not initialized');
    }

    try {
      await this.chatCollection.delete({
        ids: [sessionId],
      });
    } catch (error) {
      console.error('Failed to delete chat session:', error);
      throw error;
    }
  }
}

export const chromadb = ChromaDBClient.getInstance();