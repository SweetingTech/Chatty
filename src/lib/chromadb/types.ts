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

export interface ChromaCollection {
  get(): Promise<ChromaDocument[]>;
  add(params: {
    ids: string[];
    metadatas: Record<string, any>[];
    documents: string[];
  }): Promise<void>;
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
