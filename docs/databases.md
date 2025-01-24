# Database Architecture

## Overview

The Multi-LLM application uses multiple databases for different purposes:

1. ChromaDB - Chat History and Context Storage
2. Weaviate - Vector Database for Embeddings
3. Local Storage - Application State

## ChromaDB

### Purpose
- Stores chat history
- Maintains conversation context
- Enables semantic search across conversations

### Collections

1. `chat_sessions`
   - Stores complete chat sessions
   - Schema:
     ```typescript
     {
       id: string;           // Session ID
       messages: Message[];  // Array of chat messages
       metadata: {
         timestamp: number;
         title: string;
         tags?: string[];
       }
     }
     ```

### Default Configuration
- Port: 8000
- URL: http://localhost:8000
- Data Directory: ./chroma_data

### Access Methods
```typescript
const chromadb = ChromaDBClient.getInstance();
await chromadb.init();
await chromadb.saveChatSession(sessionId, messages);
await chromadb.getChatSession(sessionId);
```

## Weaviate

### Purpose
- Vector database for document embeddings
- Semantic search capabilities
- Document metadata storage

### Schema

1. `Document` Class
   ```typescript
   {
     title: string;      // Document title
     content: string;    // Document content
     vector: number[];   // Embedding vector
     metadata: {
       createdAt: number;
       type: string;
       tags?: string[];
     }
   }
   ```

### Default Configuration
- Port: 8080
- URL: http://localhost:8080
- Authentication: None (development)

### Access Methods
```typescript
const weaviate = WeaviateService.getInstance();
await weaviate.init(url);
await weaviate.addDocument(document);
await weaviate.searchDocuments(query);
```

## Local Storage (Zustand)

### Purpose
- Application state management
- User settings
- Cache for frequently accessed data

### Stores

1. Settings Store
   ```typescript
   {
     lmStudioUrl: string;
     weaviateUrl: string;
     openaiKey: string;
     claudeKey: string;
     theme: 'light' | 'dark';
   }
   ```

2. Chat Store
   ```typescript
   {
     currentChatId: string | null;
     chatSessions: ChatSession[];
   }
   ```

3. Agent Store
   ```typescript
   {
     agents: Agent[];
     tools: Tool[];
   }
   ```

### Access Methods
```typescript
const { settings, updateSettings } = useAppStore();
const { agents, addAgent, updateAgent } = useAppStore();
```

## Database Connections

### Development Environment
1. ChromaDB
   - Start automatically with application
   - No additional setup required

2. Weaviate
   - Requires local installation or Docker
   - Configuration in settings page

### Production Environment
1. ChromaDB
   - Deployed as part of the application
   - Persistent storage configuration required

2. Weaviate
   - Separate deployment required
   - Authentication and SSL configuration recommended

## Backup and Recovery

### ChromaDB
- Backup Location: ./chroma_backups
- Automatic backups: Daily
- Retention: 7 days

### Weaviate
- Backup through Weaviate backup API
- Regular snapshots recommended
- Backup before schema changes

## Security Considerations

1. ChromaDB
   - Local only, no external access
   - Data encryption at rest recommended

2. Weaviate
   - API key authentication in production
   - Network security (firewall rules)
   - Regular security updates

3. Local Storage
   - Sensitive data encryption
   - Regular data cleanup