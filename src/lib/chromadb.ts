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

interface ChromaCollectionStub {
  get(): Promise<any[]>;
  add(data: {
    ids: string[];
    metadatas: Record<string, any>[];
    documents: string[];
  }): Promise<void>;
  delete(data: { ids: string[] }): Promise<void>;
}

interface ChromaCollection {
  name: string;
  metadata?: Record<string, any>;
  documents: any[];
}

class ChromaDBClient {
  private static instance: ChromaDBClient;
  private isInitialized = false;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
  private baseUrl: string;
  private collections: Map<string, ChromaCollection>;
  private retryAttempts = 3;
  private retryDelay = 1000; // 1 second

  private constructor() {
    // Add VITE_ prefix for frontend access
    const host = import.meta.env.VITE_CHROMA_HOST || 'localhost';
    const port = import.meta.env.VITE_CHROMA_PORT || '8001';
    this.baseUrl = `http://${host}:${port}`;
    this.collections = new Map();
  }

  public static getInstance(): ChromaDBClient {
    if (!ChromaDBClient.instance) {
      ChromaDBClient.instance = new ChromaDBClient();
    }
    return ChromaDBClient.instance;
  }

  public async init() {
    if (this.isInitialized) return;

    try {
      // Test connection with a heartbeat
      const response = await this.retryOperation(() => 
        fetch(`${this.baseUrl}/heartbeat`, {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          mode: 'cors'
        })
      );
      
      if (!response.ok) {
        throw new Error('Failed to connect to ChromaDB');
      }

      // Load existing collections
      await this.loadCollections();

      this.isInitialized = true;
      console.log('Successfully connected to ChromaDB');
    } catch (error) {
      console.error('Failed to initialize ChromaDB:', error);
      this.isInitialized = false;
      throw error;
    }
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

  private async loadCollections() {
    try {
      const response = await this.retryOperation(() =>
        fetch(`${this.baseUrl}/collections`, {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          mode: 'cors'
        })
      );
      
      if (!response.ok) {
        throw new Error('Failed to load collections');
      }

      const collections = await response.json();
      if (Array.isArray(collections)) {
        collections.forEach((collection: unknown) => {
          if (this.isValidCollection(collection)) {
            this.collections.set(collection.name, collection);
          }
        });
      }
    } catch (error) {
      console.error('Failed to load collections:', error);
      throw error;
    }
  }

  private isValidCollection(collection: unknown): collection is ChromaCollection {
    return (
      typeof collection === 'object' &&
      collection !== null &&
      'name' in collection &&
      typeof (collection as ChromaCollection).name === 'string' &&
      'documents' in collection &&
      Array.isArray((collection as ChromaCollection).documents)
    );
  }

  public async getOrCreateCollection(name: string, metadata?: Record<string, any>): Promise<ChromaCollectionStub> {
    if (!this.isInitialized) {
      throw new Error('ChromaDB not initialized');
    }

    try {
      // Check if collection exists in local cache
      let collection = this.collections.get(name);
      
      if (!collection) {
        // If not in cache, try to fetch from server
        const response = await this.retryOperation(() =>
          fetch(`${this.baseUrl}/collections`, {
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            },
            mode: 'cors'
          })
        );

        if (!response.ok) {
          throw new Error('Failed to fetch collections');
        }

        const collections = await response.json();
        collection = collections.find((c: any) => c.name === name);

        if (!collection) {
          throw new Error(`Collection ${name} not found. Please run npm run init-db to initialize the database.`);
        }

        // Add to local cache
        if (this.isValidCollection(collection)) {
          this.collections.set(name, collection);
        }
      }

      // Capture baseUrl in closure for collection operations
      const baseUrl = this.baseUrl;

      // Return a stub that implements the ChromaCollectionStub interface
      return {
        async get() {
          const response = await fetch(`${baseUrl}/collections/${name}/get`, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            },
            mode: 'cors'
          });
          if (!response.ok) throw new Error(`Failed to get documents from collection: ${name}`);
          return response.json();
        },

        async add({ ids, metadatas, documents }) {
          const response = await fetch(`${baseUrl}/collections/${name}/add`, {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            },
            mode: 'cors',
            body: JSON.stringify({ ids, metadatas, documents })
          });
          if (!response.ok) throw new Error(`Failed to add documents to collection: ${name}`);
        },

        async delete({ ids }) {
          const response = await fetch(`${baseUrl}/collections/${name}/delete`, {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            },
            mode: 'cors',
            body: JSON.stringify({ ids })
          });
          if (!response.ok) throw new Error(`Failed to delete documents from collection: ${name}`);
        }
      };
    } catch (error) {
      console.error(`Failed to get collection ${name}:`, error);
      throw error;
    }
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
    return Date.now() - entry.timestamp < this.CACHE_TTL;
  }

  public async saveChatSession(sessionId: string, messages: ChatMessage[], _cache?: { [key: string]: CacheEntry }) {
    if (!this.isInitialized) {
      throw new Error('ChromaDB not initialized');
    }

    try {
      const response = await this.retryOperation(() =>
        fetch(`${this.baseUrl}/sessions/${sessionId}`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          mode: 'cors',
          body: JSON.stringify(messages),
        })
      );

      if (!response.ok) throw new Error('Failed to save chat session');
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
      const response = await this.retryOperation(() =>
        fetch(`${this.baseUrl}/sessions/${sessionId}`, {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          mode: 'cors'
        })
      );

      if (response.status === 404) return null;
      if (!response.ok) throw new Error('Failed to get chat session');

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
    if (!this.isInitialized) throw new Error('ChromaDB not initialized');

    try {
      const response = await this.retryOperation(() =>
        fetch(`${this.baseUrl}/sessions/${sessionId}`, {
          method: 'DELETE',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          mode: 'cors'
        })
      );

      if (!response.ok) throw new Error('Failed to delete chat session');
      console.log('Successfully deleted chat session:', sessionId);
    } catch (error) {
      console.error('Failed to delete chat session:', error);
      throw error;
    }
  }

  public async getAllChatSessions(): Promise<ChatSession[]> {
    if (!this.isInitialized) throw new Error('ChromaDB not initialized');

    try {
      const response = await this.retryOperation(() =>
        fetch(`${this.baseUrl}/sessions`, {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          mode: 'cors'
        })
      );

      if (!response.ok) throw new Error('Failed to get chat sessions');
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
    if (!session) throw new Error('Session not found');

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
