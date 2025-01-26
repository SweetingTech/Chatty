import { ChromaClient } from 'chromadb';
import type { ChromaDBClient, ChromaCollection } from './types';

class ChromaDBClientImpl implements ChromaDBClient {
  private client: ChromaClient;
  private collections: Map<string, ChromaCollection>;

  constructor() {
    this.client = new ChromaClient({
      path: import.meta.env.VITE_CHROMA_URL
    });
    this.collections = new Map();
  }

  async init(): Promise<void> {
    try {
      await this.client.heartbeat();
    } catch (error) {
      console.error('Failed to connect to ChromaDB:', error);
      throw error;
    }
  }

  async getCollection(name: string): Promise<ChromaCollection> {
    if (this.collections.has(name)) {
      return this.collections.get(name)!;
    }

    const collection = await this.client.getCollection({ name });
    const wrapper: ChromaCollection = {
      async get() {
        const result = await collection.get();
        return result.documents.map((doc: string | null, i: number) => ({
          document: doc as string,
          metadata: result.metadatas[i]
        }));
      },
      async add(params: { ids: string[]; metadatas: Record<string, any>[]; documents: string[] }) {
        await collection.add(params);
      },
      async delete(params) {
        await collection.delete(params);
      }
    };

    this.collections.set(name, wrapper);
    return wrapper;
  }

  async createCollection(params: { name: string; metadata?: Record<string, any> }): Promise<ChromaCollection> {
    const collection = await this.client.createCollection(params);
    const wrapper: ChromaCollection = {
      async get() {
        const result = await collection.get();
        return result.documents.map((doc: string | null, i: number) => ({
          document: doc as string,
          metadata: result.metadatas[i]
        }));
      },
      async add(params: { ids: string[]; metadatas: Record<string, any>[]; documents: string[] }) {
        await collection.add(params);
      },
      async delete(params) {
        await collection.delete(params);
      }
    };

    this.collections.set(params.name, wrapper);
    return wrapper;
  }

  async getOrCreateCollection(name: string, metadata?: Record<string, any>): Promise<ChromaCollection> {
    try {
      return await this.getCollection(name);
    } catch (error) {
      return await this.createCollection({ name, metadata });
    }
  }

  async deleteCollection(name: string): Promise<void> {
    await this.client.deleteCollection({ name });
    this.collections.delete(name);
  }

  async listCollections(): Promise<{ name: string }[]> {
    return await this.client.listCollections();
  }
}

export const chromadb: ChromaDBClient = new ChromaDBClientImpl();
