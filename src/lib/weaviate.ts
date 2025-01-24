import weaviate, { WeaviateClient, ApiKey } from 'weaviate-ts-client';
import { useAppStore } from '../store';

interface DocumentMetadata {
  createdAt: number;
  type: string;
  tags?: string[];
}

interface Document {
  title: string;
  content: string;
  vector?: number[];
  metadata: DocumentMetadata;
}

class WeaviateService {
  private static instance: WeaviateService;
  private client: WeaviateClient | null = null;

  private constructor() {}

  public static getInstance(): WeaviateService {
    if (!WeaviateService.instance) {
      WeaviateService.instance = new WeaviateService();
    }
    return WeaviateService.instance;
  }

  public async init(url: string) {
    if (!url) {
      throw new Error('Missing Weaviate URL');
    }

    try {
      // Parse the URL to get scheme and host
      const parsedUrl = new URL(url);
      
      this.client = weaviate.client({
        scheme: parsedUrl.protocol.replace(':', ''),
        host: parsedUrl.host,
      });

      // Verify connection by getting schema
      await this.client.schema.getter().do();
      console.log('Successfully connected to Weaviate');
    } catch (error) {
      console.error('Failed to initialize Weaviate:', error);
      throw error;
    }
  }

  public async addDocument(document: Document) {
    if (!this.client) throw new Error('Weaviate client not initialized');

    try {
      const result = await this.client.data
        .creator()
        .withClassName('Document')
        .withProperties({
          title: document.title,
          content: document.content,
          metadata: document.metadata,
        })
        .do();

      return result;
    } catch (error) {
      console.error('Failed to add document:', error);
      throw error;
    }
  }

  public async searchDocuments(query: string) {
    if (!this.client) throw new Error('Weaviate client not initialized');

    try {
      const result = await this.client.graphql
        .get()
        .withClassName('Document')
        .withFields('title content metadata { createdAt type tags } _additional { id }')
        .withNearText({ concepts: [query] })
        .withLimit(10)
        .do();

      return result.data.Get.Document;
    } catch (error) {
      console.error('Failed to search documents:', error);
      throw error;
    }
  }

  public async deleteDocument(id: string) {
    if (!this.client) throw new Error('Weaviate client not initialized');

    try {
      await this.client.data.deleter().withId(id).do();
    } catch (error) {
      console.error('Failed to delete document:', error);
      throw error;
    }
  }

  public async getAllDocuments() {
    if (!this.client) throw new Error('Weaviate client not initialized');

    try {
      const result = await this.client.graphql
        .get()
        .withClassName('Document')
        .withFields('title content metadata { createdAt type tags } _additional { id }')
        .withLimit(100)
        .do();

      return result.data.Get.Document;
    } catch (error) {
      console.error('Failed to get documents:', error);
      throw error;
    }
  }
}

export const weaviateService = WeaviateService.getInstance();
