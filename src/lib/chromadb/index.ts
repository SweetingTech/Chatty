import type { ChromaDBClient, ChromaCollection } from './types';

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
    return data.documents.map((doc: string | null, i: number) => ({
      document: doc as string,
      metadata: data.metadatas[i]
    }));
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
    } catch (error) {
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
}

export const chromadb: ChromaDBClient = new ChromaDBClientImpl();
