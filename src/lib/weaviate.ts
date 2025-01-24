import weaviate, { WeaviateClient, ApiKey } from 'weaviate-ts-client';
import { useAppStore } from '../store';

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
    try {
      this.client = weaviate.client({
        scheme: 'http',
        host: url.replace(/^https?:\/\//, ''),
      });

      // Ensure the schema exists
      await this.createSchema();
    } catch (error) {
      console.error('Failed to initialize Weaviate:', error);
      throw error;
    }
  }

  private async createSchema() {
    if (!this.client) throw new Error('Weaviate client not initialized');

    try {
      const schemaExists = await this.client.schema
        .classGetter()
        .withClassName('Document')
        .do();

      if (!schemaExists) {
        await this.client.schema
          .classCreator()
          .withClass({
            class: 'Document',
            description: 'A document with embeddings',
            properties: [
              {
                name: 'title',
                dataType: ['text'],
                description: 'The title of the document',
              },
              {
                name: 'content',
                dataType: ['text'],
                description: 'The content of the document',
              },
              {
                name: 'createdAt',
                dataType: ['number'],
                description: 'Timestamp when the document was created',
              },
            ],
            vectorizer: 'text2vec-transformers',
          })
          .do();
      }
    } catch (error) {
      console.error('Failed to create schema:', error);
      throw error;
    }
  }

  public async addDocument(document: {
    title: string;
    content: string;
    createdAt: number;
  }) {
    if (!this.client) throw new Error('Weaviate client not initialized');

    try {
      const result = await this.client.data
        .creator()
        .withClassName('Document')
        .withProperties({
          title: document.title,
          content: document.content,
          createdAt: document.createdAt,
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
        .withFields(['title', 'content', 'createdAt', '_additional { id }'])
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
        .withFields(['title', 'content', 'createdAt', '_additional { id }'])
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