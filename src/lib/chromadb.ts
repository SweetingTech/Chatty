import { 
  ChromaDBClient as IChromaDBClient, 
  ChromaCollection, 
  ChromaDocument,
  ChromaChatSession,
  CacheEntry
} from './chromadb/types';

interface ChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface ChatSession {
  id: string;
  messages: ChatMessage[];
  cache: Record<string, CacheEntry>;
  createdAt: number;
  updatedAt: number;
}

/**
 * Local representation of collection metadata separate from ChromaCollection interface
 */
interface LocalCollection {
  name: string;
  metadata?: Record<string, any>;
  documents?: ChromaDocument[];
}

export class ChromaDBClient implements IChromaDBClient {
  private static instance: ChromaDBClient;
  private isInitialized = false;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
  private baseUrl: string;
  private collections: Map<string, LocalCollection>; // local cache
  private retryAttempts = 3;
  private retryDelay = 1000; // 1 second
  private browserId: string | null = null;
  private clientId: string | null = null;

  private constructor() {
    const host = import.meta.env.VITE_CHROMA_HOST || 'localhost';
    const port = import.meta.env.VITE_CHROMA_PORT || '8001';
    this.baseUrl = `http://${host}:${port}`;
    this.collections = new Map();

    // Broadcast channel for cross-tab sync
    try {
      const bc = new BroadcastChannel('chatty_sync');
      bc.onmessage = async (event) => {
        if (event.data.type === 'session_update') {
          // Clear local cache so we fetch again
          this.collections.clear();
        }
      };
      window.addEventListener('unload', () => bc.close());
    } catch (error) {
      console.warn('BroadcastChannel not supported:', error);
    }
  }

  public static getInstance(): ChromaDBClient {
    if (!ChromaDBClient.instance) {
      ChromaDBClient.instance = new ChromaDBClient();
    }
    return ChromaDBClient.instance;
  }

  private getBrowserId(): string {
    if (!this.browserId) {
      this.browserId = localStorage.getItem('chatty_browser_id');
      if (!this.browserId) {
        this.browserId = `browser_${crypto.randomUUID()}`;
        localStorage.setItem('chatty_browser_id', this.browserId);
      }
    }
    return this.browserId;
  }

  private getClientId(): string {
    if (!this.clientId) {
      this.clientId = `client_${crypto.randomUUID()}`;
    }
    return this.clientId;
  }

  public async init(): Promise<void> {
    if (this.isInitialized) return;
    try {
      const response = await this.retryOperation(() =>
        fetch(`${this.baseUrl}/heartbeat`, {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-Browser-ID': this.getBrowserId(),
            'X-Client-ID': this.getClientId()
          },
          mode: 'cors'
        })
      );

      if (!response.ok) {
        const errorDetails = await response.text();
        throw new Error(`Failed to connect to ChromaDB. HTTP ${response.status}: ${errorDetails}`);
      }

      await this.loadCollections();
      this.isInitialized = true;
      console.log('Successfully connected to ChromaDB');
    } catch (error) {
      console.error('Failed to initialize ChromaDB:', error);
      this.isInitialized = false;
      throw error;
    }
  }

  public isConnected(): boolean {
    return this.isInitialized;
  }

  private async retryOperation<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < this.retryAttempts) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
        }
      }
    }

    throw lastError || new Error('Operation failed after retries');
  }

  private async loadCollections(): Promise<void> {
    const response = await this.retryOperation(() =>
      fetch(`${this.baseUrl}/collections`, {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Browser-ID': this.getBrowserId(),
          'X-Client-ID': this.getClientId()
        },
        mode: 'cors'
      })
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to load collections. HTTP ${response.status}: ${errorDetails}`);
    }

    const data = await response.json();
    if (Array.isArray(data)) {
      this.collections.clear();
      data.forEach((item: any) => {
        if (item?.name && typeof item.name === 'string') {
          this.collections.set(item.name, {
            name: item.name,
            metadata: item.metadata || {},
            documents: item.documents || []
          });
        }
      });
    }
  }

  public async getCollection(name: string): Promise<ChromaCollection> {
    if (!this.isInitialized) {
      throw new Error('ChromaDB not initialized');
    }

    if (!this.collections.has(name)) {
      await this.loadCollections();
    }

    if (!this.collections.has(name)) {
      throw new Error(`Collection "${name}" does not exist on this server.`);
    }

    return this.makeCollectionClient(name);
  }

  public async createCollection(params: { name: string; metadata?: Record<string, any> }): Promise<ChromaCollection> {
    if (!this.isInitialized) {
      throw new Error('ChromaDB not initialized');
    }

    const response = await this.retryOperation(() =>
      fetch(`${this.baseUrl}/collections`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Browser-ID': this.getBrowserId(),
          'X-Client-ID': this.getClientId()
        },
        mode: 'cors',
        body: JSON.stringify(params)
      })
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to create collection: HTTP ${response.status}: ${errorDetails}`);
    }

    await this.loadCollections();
    return this.makeCollectionClient(params.name);
  }

  public async deleteCollection(name: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('ChromaDB not initialized');
    }

    const response = await this.retryOperation(() =>
      fetch(`${this.baseUrl}/collections/${name}`, {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Browser-ID': this.getBrowserId(),
          'X-Client-ID': this.getClientId()
        },
        mode: 'cors'
      })
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to delete collection "${name}". HTTP ${response.status}: ${errorDetails}`);
    }

    this.collections.delete(name);
  }

  public async listCollections(): Promise<{ name: string }[]> {
    if (!this.isInitialized) {
      throw new Error('ChromaDB not initialized');
    }

    await this.loadCollections();
    return Array.from(this.collections.values()).map(({ name }) => ({ name }));
  }

  public async getOrCreateCollection(name: string, metadata?: Record<string, any>): Promise<ChromaCollection> {
    try {
      return await this.getCollection(name);
    } catch (error: any) {
      if (error.message && error.message.includes('does not exist on this server')) {
        return this.createCollection({ name, metadata });
      }
      throw error;
    }
  }

  private makeCollectionClient(name: string): ChromaCollection {
    const baseUrl = this.baseUrl;
    const browserId = this.getBrowserId();
    const clientId = this.getClientId();

    return {
      get: async () => {
        const response = await fetch(`${baseUrl}/collections/${name}/get`, {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-Browser-ID': browserId,
            'X-Client-ID': clientId
          },
          mode: 'cors'
        });
        if (!response.ok) {
          const errorDetails = await response.text();
          throw new Error(`Failed to get documents from collection "${name}". HTTP ${response.status}: ${errorDetails}`);
        }
        return response.json();
      },
      add: async ({ ids, metadatas, documents }) => {
        const response = await fetch(`${baseUrl}/collections/${name}/add`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-Browser-ID': browserId,
            'X-Client-ID': clientId
          },
          mode: 'cors',
          body: JSON.stringify({ ids, metadatas, documents })
        });
        if (!response.ok) {
          const errorDetails = await response.text();
          throw new Error(`Failed to add documents to collection "${name}". HTTP ${response.status}: ${errorDetails}`);
        }
      },
      delete: async ({ ids }) => {
        const response = await fetch(`${baseUrl}/collections/${name}/delete`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-Browser-ID': browserId,
            'X-Client-ID': clientId
          },
          mode: 'cors',
          body: JSON.stringify({ ids })
        });
        if (!response.ok) {
          const errorDetails = await response.text();
          throw new Error(`Failed to delete documents from collection "${name}". HTTP ${response.status}: ${errorDetails}`);
        }
      }
    };
  }

  private hashPrompt(prompt: string, tools?: any[], mcp?: any[]): string {
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
    return (Date.now() - entry.timestamp) < this.CACHE_TTL;
  }

  public async saveChatSession(
    sessionId: string,
    messages: string | ChatMessage[],
    _cache?: Record<string, CacheEntry>
  ) {
    if (!this.isInitialized) {
      throw new Error('ChromaDB not initialized');
    }

    const collection = await this.getOrCreateCollection('chat_sessions');
    const data = {
      ids: [sessionId],
      metadatas: [{
        timestamp: Date.now(),
        type: 'chat_session',
        updatedAt: Date.now()
      }],
      documents: [typeof messages === 'string' ? messages : JSON.stringify(messages)]
    };

    try {
      await collection.delete({ ids: [sessionId] });
    } catch (error) {
      console.warn('No existing session to delete or error ignoring:', error);
    }

    await collection.add(data);
    console.log('Successfully saved chat session:', sessionId);

    try {
      const bc = new BroadcastChannel('chatty_sync');
      bc.postMessage({
        type: 'session_update',
        sessionId,
        timestamp: Date.now()
      });
      bc.close();
    } catch (error) {
      console.warn('Failed to broadcast session update:', error);
    }
  }

  public async getChatSession(sessionId: string): Promise<ChromaChatSession | null> {
    if (!this.isInitialized) {
      throw new Error('ChromaDB not initialized');
    }

    const response = await this.retryOperation(() =>
      fetch(`${this.baseUrl}/sessions/${sessionId}`, {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Browser-ID': this.getBrowserId(),
          'X-Client-ID': this.getClientId()
        },
        mode: 'cors'
      })
    );

    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to get chat session. HTTP ${response.status}: ${errorDetails}`);
    }

    const data = await response.json();
    console.log('Successfully retrieved chat session:', sessionId);
    return {
      id: sessionId,
      messages: data.messages,
      metadata: {
        createdAt: data.metadata.timestamp,
        updatedAt: data.metadata.timestamp
      }
    };
  }

  public async deleteChatSession(sessionId: string) {
    if (!this.isInitialized) throw new Error('ChromaDB not initialized');

    const response = await this.retryOperation(() =>
      fetch(`${this.baseUrl}/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Browser-ID': this.getBrowserId(),
          'X-Client-ID': this.getClientId()
        },
        mode: 'cors'
      })
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to delete chat session. HTTP ${response.status}: ${errorDetails}`);
    }
    console.log('Successfully deleted chat session:', sessionId);
  }

  public async getUserSettings(): Promise<Record<string, any>> {
    if (!this.isInitialized) throw new Error('ChromaDB not initialized');

    const response = await this.retryOperation(() =>
      fetch(`${this.baseUrl}/collections/user_settings/get`, {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Browser-ID': this.getBrowserId(),
          'X-Client-ID': this.getClientId()
        },
        mode: 'cors'
      })
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to get user settings. HTTP ${response.status}: ${errorDetails}`);
    }
    const data = await response.json();

    if (Array.isArray(data) && data.length > 0) {
      return JSON.parse(data[0].document);
    }
    return {};
  }

  public async saveUserSettings(settings: Record<string, any>): Promise<void> {
    if (!this.isInitialized) throw new Error('ChromaDB not initialized');

    const response = await this.retryOperation(() =>
      fetch(`${this.baseUrl}/collections/user_settings/add`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Browser-ID': this.getBrowserId(),
          'X-Client-ID': this.getClientId()
        },
        mode: 'cors',
        body: JSON.stringify({
          ids: ['api_keys'],
          metadatas: [{ timestamp: Date.now(), type: 'settings' }],
          documents: [JSON.stringify(settings)]
        })
      })
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to save user settings. HTTP ${response.status}: ${errorDetails}`);
    }
  }

  public async getAllChatSessions(): Promise<ChromaChatSession[]> {
    if (!this.isInitialized) throw new Error('ChromaDB not initialized');

    const response = await this.retryOperation(() =>
      fetch(`${this.baseUrl}/sessions`, {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Browser-ID': this.getBrowserId(),
          'X-Client-ID': this.getClientId()
        },
        mode: 'cors'
      })
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to get chat sessions. HTTP ${response.status}: ${errorDetails}`);
    }
    const data = await response.json();
    return data.map((item: any) => ({
      id: item.id,
      messages: item.messages,
      metadata: {
        createdAt: item.metadata.timestamp,
        updatedAt: item.metadata.timestamp
      }
    }));
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
    const cacheEntry = (session as any).cache?.[promptHash];
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
    if (!session) throw new Error('Session not found');

    const promptHash = this.hashPrompt(prompt, tools, mcp);
    const cache = (session as any).cache || {};
    cache[promptHash] = {
      prompt,
      response,
      timestamp: Date.now(),
      toolResults,
      mcpResults
    };
    await this.saveChatSession(sessionId, session.messages, cache);
  }

  public async cleanExpiredCache(sessionId: string): Promise<void> {
    const session = await this.getChatSession(sessionId);
    if (!session) return;

    const now = Date.now();
    const cache = (session as any).cache || {};
    const newCache: Record<string, CacheEntry> = {};
    
    for (const [hash, entry] of Object.entries(cache)) {
      if (this.isCacheValid(entry as CacheEntry)) {
        newCache[hash] = entry as CacheEntry;
      }
    }
    
    await this.saveChatSession(sessionId, session.messages, newCache);
  }
}

export const chromadb = ChromaDBClient.getInstance();
