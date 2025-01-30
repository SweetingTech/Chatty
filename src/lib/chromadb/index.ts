import type { ChromaDBClient, ChromaCollection, ChromaChatSession, CacheEntry } from './types';

interface ChromaSessionResponse {
  messages: any[];
  metadata?: {
    cache?: Record<string, CacheEntry>;
    timestamp: number;
    id?: string;
    createdAt?: number;
    updatedAt?: number;
    [key: string]: any;
  };
}

class ChromaCollectionWrapper implements ChromaCollection {
  constructor(
    private name: string,
    private baseUrl: string,
    private browserId: string,
    private clientId: string
  ) {}

  async get() {
    const result = await fetch(`${this.baseUrl}/collections/${this.name}/get`, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Browser-ID': this.browserId,
        'X-Client-ID': this.clientId
      }
    });
    if (!result.ok) {
      throw new Error(`Failed to get documents from collection: ${this.name}`);
    }
    const data = await result.json();
    return {
      ids: data.ids,
      documents: data.documents,
      metadatas: data.metadatas
    };
  }

  async add(params: { ids: string[]; metadatas: Record<string, any>[]; documents: string[] }) {
    const response = await fetch(`${this.baseUrl}/collections/${this.name}/add`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Browser-ID': this.browserId,
        'X-Client-ID': this.clientId
      },
      body: JSON.stringify(params)
    });
    if (!response.ok) {
      throw new Error(`Failed to add documents to collection: ${this.name}`);
    }
  }

  async delete(params: { ids: string[] }) {
    const response = await fetch(`${this.baseUrl}/collections/${this.name}/delete`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Browser-ID': this.browserId,
        'X-Client-ID': this.clientId
      },
      body: JSON.stringify(params)
    });
    if (!response.ok) {
      throw new Error(`Failed to delete documents from collection: ${this.name}`);
    }
  }
}

class ChromaDBClientImpl implements ChromaDBClient {
  private baseUrl: string;
  private collections: Map<string, ChromaCollection>;
  private browserId: string;
  private clientId: string;
  private connected: boolean = false;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    const host = import.meta.env.VITE_CHROMA_HOST || 'localhost';
    const port = import.meta.env.VITE_CHROMA_PORT || '8001';
    this.baseUrl = `http://${host}:${port}`;
    this.collections = new Map();
    
    // Generate unique IDs for this browser instance
    this.browserId = localStorage.getItem('browser_id') || crypto.randomUUID();
    this.clientId = localStorage.getItem('client_id') || crypto.randomUUID();
    
    // Store IDs for future use
    localStorage.setItem('browser_id', this.browserId);
    localStorage.setItem('client_id', this.clientId);
  }

  async init(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/heartbeat`, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Browser-ID': this.browserId,
          'X-Client-ID': this.clientId
        }
      });
      if (!response.ok) {
        throw new Error('Failed to connect to ChromaDB');
      }
      this.connected = true;
    } catch (error) {
      this.connected = false;
      console.error('Failed to connect to ChromaDB:', error);
      throw error;
    }
  }

  async getCollection(name: string): Promise<ChromaCollection> {
    if (this.collections.has(name)) {
      return this.collections.get(name)!;
    }

    const response = await fetch(`${this.baseUrl}/collections/${name}`, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Browser-ID': this.browserId,
        'X-Client-ID': this.clientId
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get collection: ${name}`);
    }

    const wrapper = new ChromaCollectionWrapper(name, this.baseUrl, this.browserId, this.clientId);
    this.collections.set(name, wrapper);
    return wrapper;
  }

  async createCollection(params: { name: string; metadata?: Record<string, any> }): Promise<ChromaCollection> {
    const response = await fetch(`${this.baseUrl}/collections`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Browser-ID': this.browserId,
        'X-Client-ID': this.clientId
      },
      body: JSON.stringify(params)
    });

    if (!response.ok) {
      throw new Error(`Failed to create collection: ${params.name}`);
    }

    return this.getCollection(params.name);
  }

  async getOrCreateCollection(name: string, metadata?: Record<string, any>): Promise<ChromaCollection> {
    try {
      return await this.getCollection(name);
    } catch (error) {
      return await this.createCollection({ name, metadata });
    }
  }

  async deleteCollection(name: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/collections/${name}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Browser-ID': this.browserId,
        'X-Client-ID': this.clientId
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to delete collection: ${name}`);
    }

    this.collections.delete(name);
  }

  async listCollections(): Promise<{ name: string }[]> {
    const response = await fetch(`${this.baseUrl}/collections`, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Browser-ID': this.browserId,
        'X-Client-ID': this.clientId
      }
    });

    if (!response.ok) {
      throw new Error('Failed to list collections');
    }

    return response.json();
  }

  async saveChatSession(sessionId: string, messages: any, cache?: { [key: string]: CacheEntry }): Promise<void> {
    const timestamp = Date.now();
    const metadata = {
      cache,
      timestamp,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Browser-ID': this.browserId,
        'X-Client-ID': this.clientId
      },
      body: JSON.stringify({ messages, metadata })
    });

    if (!response.ok) {
      throw new Error(`Failed to save chat session: ${sessionId}`);
    }
  }

  async getChatSession(sessionId: string): Promise<ChromaChatSession | null> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}`, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Browser-ID': this.browserId,
        'X-Client-ID': this.clientId
      }
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Failed to get chat session: ${sessionId}`);
    }

    const data = await response.json() as ChromaSessionResponse;
    const timestamp = data.metadata?.timestamp || Date.now();
    
    return {
      id: sessionId,
      messages: data.messages,
      metadata: {
        ...data.metadata,
        createdAt: data.metadata?.createdAt || timestamp,
        updatedAt: data.metadata?.updatedAt || timestamp
      }
    };
  }

  async deleteChatSession(sessionId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Browser-ID': this.browserId,
        'X-Client-ID': this.clientId
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to delete chat session: ${sessionId}`);
    }
  }

  async getAllChatSessions(): Promise<ChromaChatSession[]> {
    const response = await fetch(`${this.baseUrl}/sessions`, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Browser-ID': this.browserId,
        'X-Client-ID': this.clientId
      }
    });

    if (!response.ok) {
      throw new Error('Failed to get chat sessions');
    }

    const data = await response.json() as ChromaSessionResponse[];
    return data.map(session => {
      const timestamp = session.metadata?.timestamp || Date.now();
      return {
        id: session.metadata?.id || '',
        messages: session.messages,
        metadata: {
          ...session.metadata,
          createdAt: session.metadata?.createdAt || timestamp,
          updatedAt: session.metadata?.updatedAt || timestamp
        }
      };
    });
  }

  async getCachedResponse(sessionId: string, prompt: string, tools?: any[], mcp?: any[]): Promise<string | null> {
    const session = await this.getChatSession(sessionId);
    if (!session?.metadata?.cache) {
      return null;
    }

    const hash = this.hashPrompt(prompt, tools, mcp);
    const cache = session.metadata.cache[hash] as CacheEntry | undefined;
    if (cache && this.isCacheValid(cache)) {
      return cache.response;
    }

    return null;
  }

  async cacheResponse(
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

    const hash = this.hashPrompt(prompt, tools, mcp);
    const cache = session.metadata?.cache || {};
    cache[hash] = {
      prompt,
      response,
      timestamp: Date.now(),
      toolResults,
      mcpResults
    };

    await this.saveChatSession(sessionId, session.messages, cache);
  }

  async cleanExpiredCache(sessionId: string): Promise<void> {
    const session = await this.getChatSession(sessionId);
    if (!session?.metadata?.cache) {
      return;
    }

    const cache = session.metadata.cache;
    const newCache: Record<string, CacheEntry> = {};
    
    for (const [hash, entry] of Object.entries(cache)) {
      if (this.isCacheValid(entry as CacheEntry)) {
        newCache[hash] = entry as CacheEntry;
      }
    }

    await this.saveChatSession(sessionId, session.messages, newCache);
  }

  async getUserSettings(): Promise<Record<string, any>> {
    const collection = await this.getOrCreateCollection('user_settings');
    const result = await collection.get();
    if (result.documents.length === 0) {
      return {};
    }
    return JSON.parse(result.documents[0]);
  }

  async saveUserSettings(settings: Record<string, any>): Promise<void> {
    const collection = await this.getOrCreateCollection('user_settings');
    await collection.add({
      ids: ['settings'],
      metadatas: [{ timestamp: Date.now() }],
      documents: [JSON.stringify(settings)]
    });
  }

  isConnected(): boolean {
    return this.connected;
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
}

export const chromadb: ChromaDBClient = new ChromaDBClientImpl();
