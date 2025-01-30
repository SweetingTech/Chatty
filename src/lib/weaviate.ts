import weaviate, { WeaviateClient, ApiKey } from 'weaviate-ts-client';
import { useAppStore } from '../store';

export interface DocumentMetadata {
  createdAt: number;
  type: string;
  tags?: string[];
  chatId?: string;
  timestamp?: number;
}

export interface Document {
  title: string;
  content: string;
  vector?: number[];
  metadata: DocumentMetadata;
  _additional?: {
    id: string;
  };
}

export interface WeaviateDocument extends Document {
  _additional: {
    id: string;
  };
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

  public async init(url: string, apiKey?: string) {
    if (!url) {
      throw new Error('Missing Weaviate URL');
    }

    try {
      // Parse the URL to get scheme and host
      const parsedUrl = new URL(url);
      
      const clientConfig: any = {
        scheme: parsedUrl.protocol.replace(':', ''),
        host: parsedUrl.host,
      };

      // Add API key if provided
      if (apiKey) {
        clientConfig.apiKey = new ApiKey(apiKey);
      }

      this.client = weaviate.client(clientConfig);

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

  private async retryOperation<T>(operation: () => Promise<T>, maxRetries = 3, delay = 1000): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxRetries) throw error;
        console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error('Operation failed after max retries');
  }

  public async deleteDocumentsByChatId(chatId: string) {
    if (!this.client) throw new Error('Weaviate client not initialized');

    try {
      // First get all documents with this chatId using the correct where filter structure
      const result = await this.retryOperation(async () => {
        const query = await this.client!.graphql
          .get()
          .withClassName('Document')
          .withFields('_additional { id }')
          .withWhere({
            operator: 'Equal',
            path: ['metadata', 'chatId'],
            valueString: chatId
          })
          .do();
        return query;
      });

      // Check if we got any documents back
      const documents = result.data.Get.Document;
      if (!documents || documents.length === 0) {
        console.log(`No documents found for chatId: ${chatId}`);
        return;
      }

      // Delete each document with retry logic
      for (const doc of documents) {
        await this.retryOperation(async () => {
          await this.deleteDocument(doc._additional.id);
        });
      }

      console.log(`Successfully deleted ${documents.length} documents for chatId: ${chatId}`);
    } catch (error) {
      console.error('Failed to delete documents by chatId:', error);
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
