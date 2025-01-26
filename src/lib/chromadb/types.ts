export interface ChromaDocument {
  document: string;
  metadata: any;
}

export interface ChromaCollection {
  get(): Promise<ChromaDocument[]>;
  add(params: {
    ids: string[];
    metadatas: Record<string, any>[];
    documents: string[];
  }): Promise<void>;
  delete(params: { ids: string[] }): Promise<void>;
}

export interface ChromaDBClient {
  init(): Promise<void>;
  getCollection(name: string): Promise<ChromaCollection>;
  createCollection(params: {
    name: string;
    metadata?: Record<string, any>;
  }): Promise<ChromaCollection>;
  getOrCreateCollection(
    name: string,
    metadata?: Record<string, any>
  ): Promise<ChromaCollection>;
  deleteCollection(name: string): Promise<void>;
  listCollections(): Promise<{ name: string }[]>;
}
