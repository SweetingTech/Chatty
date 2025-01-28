export interface ChromaDocument {
  document: string;
  metadata?: Record<string, any>;
}

export interface ChromaCollectionResponse {
  ids: string[];
  documents: string[];
  metadatas: Record<string, any>[];
}

export interface ChromaChatSession {
  id: string;
  messages: any;
  metadata?: {
    createdAt: number;
    updatedAt: number;
    [key: string]: any;
  };
}

/**
 * ChromaDB v0.6.x compatible collection interface
 */
export interface ChromaCollection {
  /**
   * Get documents from the collection
   */
  get(): Promise<{
    ids: string[];
    documents: string[];
    metadatas: Record<string, any>[];
  }>;

  /**
   * Add documents to the collection
   */
  add(params: {
    ids: string[];
    metadatas: Record<string, any>[];
    documents: string[];
  }): Promise<void>;

  /**
   * Delete documents from the collection
   */
  delete(params: { ids: string[] }): Promise<void>;
}

export interface CacheEntry {
  prompt: string;
  response: string;
  timestamp: number;
  toolResults?: any[];
  mcpResults?: any[];
}

export interface ChromaDBClient {
  /**
   * Initialize the ChromaDB client
   */
  init(): Promise<void>;

  /**
   * Get a collection by name
   */
  getCollection(name: string): Promise<ChromaCollection>;

  /**
   * Create a new collection
   */
  createCollection(params: {
    name: string;
    metadata?: Record<string, any>;
  }): Promise<ChromaCollection>;

  /**
   * Get an existing collection or create a new one
   */
  getOrCreateCollection(
    name: string,
    metadata?: Record<string, any>
  ): Promise<ChromaCollection>;

  /**
   * Delete a collection
   */
  deleteCollection(name: string): Promise<void>;

  /**
   * List all collections (v0.6.x compatible)
   */
  listCollections(): Promise<{ name: string }[]>;
  
  // Chat session methods
  saveChatSession(sessionId: string, messages: any, cache?: { [key: string]: CacheEntry }): Promise<void>;
  getChatSession(sessionId: string): Promise<ChromaChatSession | null>;
  deleteChatSession(sessionId: string): Promise<void>;
  getAllChatSessions(): Promise<ChromaChatSession[]>;
  
  // Cache methods
  getCachedResponse(sessionId: string, prompt: string, tools?: any[], mcp?: any[]): Promise<string | null>;
  cacheResponse(
    sessionId: string,
    prompt: string,
    response: string,
    tools?: any[],
    mcp?: any[],
    toolResults?: any[],
    mcpResults?: any[]
  ): Promise<void>;
  cleanExpiredCache(sessionId: string): Promise<void>;
  
  // Settings methods
  getUserSettings(): Promise<Record<string, any>>;
  saveUserSettings(settings: Record<string, any>): Promise<void>;
  
  // Status
  isConnected(): boolean;
}
