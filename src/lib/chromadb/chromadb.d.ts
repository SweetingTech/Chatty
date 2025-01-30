declare module 'chromadb' {
  export interface ChromaClientParams {
    path: string;
  }

  export interface CollectionParams {
    name: string;
    metadata?: Record<string, any>;
  }

  export interface GetResult {
    ids: string[];
    documents: (string | null)[];
    metadatas: Record<string, any>[];
  }

  export interface Collection {
    get(): Promise<GetResult>;
    add(params: {
      ids: string[];
      metadatas: Record<string, any>[];
      documents: string[];
    }): Promise<void>;
    delete(params: { ids: string[] }): Promise<void>;
  }

  export class ChromaClient {
    constructor(params: ChromaClientParams);
    heartbeat(): Promise<number>;
    getCollection(params: CollectionParams): Promise<Collection>;
    createCollection(params: CollectionParams): Promise<Collection>;
    deleteCollection(params: { name: string }): Promise<void>;
    listCollections(): Promise<{ name: string }[]>;
  }
}
