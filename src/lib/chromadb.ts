interface CacheEntry {
  prompt: string;
  response: string;
  timestamp: number;
  toolResults?: any[];
  mcpResults?: any[];
}

interface ChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface ChatSession {
  id: string;
  messages: ChatMessage[];
  cache: {
    [promptHash: string]: CacheEntry;
  };
  createdAt: number;
  updatedAt: number;
}

class ChromaDBClient {
  private static instance: ChromaDBClient;
  private isInitialized = false;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
  private baseUrl: string;

  private constructor() {
    this.baseUrl = import.meta.env.VITE_CHROMA_URL;
  }

  public static getInstance(): ChromaDBClient {
    if (!ChromaDBClient.instance) {
      ChromaDBClient.instance = new ChromaDBClient();
    }
    return ChromaDBClient.instance;
  }

  public async init() {
    if (this.isInitialized) {
      return;
    }

    try {
      // Test connection with a heartbeat
      const response = await fetch(`${this.baseUrl}/heartbeat`);
      if (!response.ok) {
        throw new Error('Failed to connect to ChromaDB');
      }

      this.isInitialized = true;
      console.log('Successfully connected to ChromaDB');
    } catch (error) {
      console.error('Failed to initialize ChromaDB:', error);
      this.isInitialized = false;
      throw error;
    }
  }

  private hashPrompt(prompt: string, tools?: any[], mcp?: any[]): string {
    // Simple hash function for now - in production use a proper hashing algorithm
    const content = JSON.stringify({ prompt, tools, mcp });
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  private isCacheValid(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp < this.CACHE_TTL;
  }

  public async saveChatSession(sessionId: string, messages: ChatMessage[], cache?: { [key: string]: CacheEntry }) {
    if (!this.isInitialized) {
      throw new Error('ChromaDB not initialized');
    }

    try {
      const response = await fetch(`${this.baseUrl}/sessions/${sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });

      if (!response.ok) {
        throw new Error('Failed to save chat session');
      }

      console.log('Successfully saved chat session:', sessionId);
    } catch (error) {
      console.error('Failed to save chat session:', error);
      throw error;
    }
  }

  public async getChatSession(sessionId: string): Promise<ChatSession | null> {
    if (!this.isInitialized) {
      throw new Error('ChromaDB not initialized');
    }

    try {
      const response = await fetch(`${this.baseUrl}/sessions/${sessionId}`);
      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        throw new Error('Failed to get chat session');
      }

      const data = await response.json();
      console.log('Successfully retrieved chat session:', sessionId);
      return {
        id: sessionId,
        messages: data.messages,
        cache: {},
        createdAt: data.metadata.timestamp,
        updatedAt: data.metadata.timestamp,
      };
    } catch (error) {
      console.error('Failed to get chat session:', error);
      throw error;
    }
  }

  public async deleteChatSession(sessionId: string) {
    if (!this.isInitialized) {
      throw new Error('ChromaDB not initialized');
    }

    try {
      const response = await fetch(`${this.baseUrl}/sessions/${sessionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete chat session');
      }

      console.log('Successfully deleted chat session:', sessionId);
    } catch (error) {
      console.error('Failed to delete chat session:', error);
      throw error;
    }
  }

  public async getAllChatSessions(): Promise<ChatSession[]> {
    if (!this.isInitialized) {
      throw new Error('ChromaDB not initialized');
    }

    try {
      const response = await fetch(`${this.baseUrl}/sessions`);
      if (!response.ok) {
        throw new Error('Failed to get chat sessions');
      }

      const data = await response.json();
      return data.map((item: any) => ({
        id: item.id,
        messages: item.messages,
        cache: {},
        createdAt: item.metadata.timestamp,
        updatedAt: item.metadata.timestamp,
      }));
    } catch (error) {
      console.error('Failed to get all chat sessions:', error);
      throw error;
    }
  }

  public async getCachedResponse(
    sessionId: string,
    prompt: string,
    tools?: any[],
    mcp?: any[]
  ): Promise<string | null> {
    const session = await this.getChatSession(sessionId);
    if (!session) return null;

    const promptHash = this.hashPrompt(prompt, tools, mcp);
    const cacheEntry = session.cache[promptHash];

    if (cacheEntry && this.isCacheValid(cacheEntry)) {
      return cacheEntry.response;
    }

    return null;
  }

  public async cacheResponse(
    sessionId: string,
    prompt: string,
    response: string,
    tools?: any[],
    mcp?: any[],
    toolResults?: any[],
    mcpResults?: any[]
  ): Promise<void> {
    const session = await this.getChatSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const promptHash = this.hashPrompt(prompt, tools, mcp);
    session.cache[promptHash] = {
      prompt,
      response,
      timestamp: Date.now(),
      toolResults,
      mcpResults
    };

    await this.saveChatSession(sessionId, session.messages, session.cache);
  }

  public async cleanExpiredCache(sessionId: string): Promise<void> {
    const session = await this.getChatSession(sessionId);
    if (!session) return;

    const now = Date.now();
    const newCache: { [key: string]: CacheEntry } = {};

    // Only keep valid cache entries
    for (const [hash, entry] of Object.entries(session.cache)) {
      if (now - entry.timestamp < this.CACHE_TTL) {
        newCache[hash] = entry;
      }
    }

    session.cache = newCache;
    await this.saveChatSession(sessionId, session.messages, session.cache);
  }

  public isConnected(): boolean {
    return this.isInitialized;
  }
}

export const chromadb = ChromaDBClient.getInstance();
