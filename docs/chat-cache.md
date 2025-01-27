# ChatCache and Agent Tools System

~~This document provides a **unified reference** for two major components:~~

~~1. **Agent Tools System**: A standardized framework to extend agent capabilities through Functions, APIs, and CLI commands, optionally enhanced via [Model Context Protocol (MCP)](https://example.org/mcp).~~
~~2. **ChatCache**: A universal prompt caching mechanism that optimizes prompt usage across multiple Large Language Models (LLMs).~~

This document now provides documentation for:
1. **Chat Session Storage**: Implementation of cross-browser chat persistence using ChromaDB
2. **Agent Tools System**: A standardized framework to extend agent capabilities (preserved for reference)
3. **ChatCache**: A universal prompt caching mechanism (preserved for reference)

# Part 0: Chat Session Storage and Cross-Browser Support

## Storage Architecture

Chat sessions in Chatty are stored using ChromaDB, a vector database that provides persistent storage and efficient retrieval of chat history. Each session contains:

- Document: JSON array of messages
- Metadata: Session information including timestamps and browser/client IDs
- ID: Unique session identifier

## Cross-Browser Support

Chat sessions are synchronized across different browsers through:
- Browser identification via headers (`X-Browser-ID`, `X-Client-ID`)
- Session merging on save
- Timestamp-based message ordering
- Metadata tracking of browser access

### Session Structure

Each chat session contains:
- Messages array with:
  - Message ID
  - Role (user/assistant)
  - Content
  - Timestamp
- Metadata including:
  - Last updated timestamp
  - Browser and client identifiers
  - Message count
  - Update count
  - List of browsers that have accessed this session
  - List of clients that have accessed this session

### Implementation Details

```typescript
interface ChatMessage {
  id: string;
  role: string;
  content: string;
  timestamp: number;
}

interface SessionMetadata {
  timestamp: number;
  last_updated: number;
  type: "chat_session";
  client_id: string;
  browser_id: string;
  update_count: number;
  message_count: number;
  browsers: string[];
  clients: string[];
}
```

### Key Operations

1. Save Session:
   - Merges new messages with existing ones
   - Updates browser/client tracking
   - Maintains message order by timestamp
   - Updates metadata

2. Retrieve Session:
   - Returns messages sorted by timestamp
   - Updates access tracking metadata
   - Maintains browser history

3. List Sessions:
   - Returns all sessions sorted by last update
   - Includes browser access history
   - Updates listing metadata

4. Delete Session:
   - Removes session and associated data

## Database Usage

Chatty uses:
- ChromaDB for chat session storage and retrieval
- Weaviate for embeddings and semantic search

---

# Part 1: Agent Tools System

[Original content preserved below]

### Overview

The **Agent Tools System** provides a standardized approach to add new capabilities (called "tools") to an AI agent. Tools can be:
- **Functions**: Internal JavaScript/TypeScript functions,
- **APIs**: Integrations with external services,
- **CLI Commands**: System-level command execution,
- **MCP Servers**: Add-on services that can handle specialized tasks (e.g., file system, auth, caching, secure shell).

### Tool Types

#### 1. Functions

- **Purpose**: Execute JavaScript/TypeScript code.
- **Configuration**:

  ```typescript
  {
    type: 'function',
    config: {
      function: string,
      parameters: Record<string, unknown>,
      mcp_requirements?: string[] // MCPs required by this function
    }
  }
  ```

- **Security**:
  - Input validation
  - Type checking
  - Execution sandboxing
  - Error handling
  - MCP permission validation

#### 2. APIs

- **Purpose**: Integrate with external services.
- **Configuration**:

  ```typescript
  {
    type: 'api',
    config: {
      endpoint: string,
      method: string,
      headers: Record<string, string>,
      timeout: number,
      mcp_integrations?: {
        // MCP integrations for enhanced API functionality
        auth?: string,    // e.g., "oauth-mcp"
        cache?: string,   // e.g., "redis-mcp"
        proxy?: string    // e.g., "proxy-mcp"
      }
    }
  }
  ```

- **Features**:
  - Request validation
  - Response parsing
  - Error handling
  - Rate limiting
  - MCP-powered capabilities (auth, caching, proxy, etc.)

#### 3. CLI Commands

- **Purpose**: Execute system commands on the local environment.
- **Configuration**:

  ```typescript
  {
    type: 'cli',
    config: {
      command: string,
      timeout: number,
      mcp_executor?: string // MCP to handle command execution
    }
  }
  ```

- **Security**:
  - Command whitelist
  - Argument sanitization
  - Resource limits
  - Output buffering
  - MCP permission checks

### Tool Schema

```typescript
interface Tool {
  id: string;
  name: string;
  description: string;
  type: 'function' | 'api' | 'cli';
  config: Record<string, unknown>;
  mcp_capabilities?: {
    required: string[];    // Required MCP servers
    optional: string[];    // Optional MCP enhancements
    permissions: string[]; // Required MCP permissions
  };
}
```

### Tool Templates

Below are **example JSON templates** for each tool type. These can be expanded as needed.

#### Function Template with MCP Integration

```json
{
  "schema": "1.0.0",
  "type": "tool",
  "metadata": {
    "name": "File Search Tool",
    "description": "Search files with MCP filesystem capabilities",
    "version": "1.0.0",
    "author": "Author Name",
    "tags": ["filesystem", "search"]
  },
  "configuration": {
    "type": "function",
    "config": {
      "mcp_requirements": ["filesystem"]
    },
    "permissions": ["read"],
    "requirements": []
  },
  "implementation": {
    "code": "// Tool implementation using MCP filesystem",
    "dependencies": ["@modelcontextprotocol/sdk"],
    "exports": []
  }
}
```

#### API Template with MCP Enhancement

```json
{
  "schema": "1.0.0",
  "type": "tool",
  "metadata": {
    "name": "Enhanced API Tool",
    "description": "API Integration with MCP capabilities"
  },
  "configuration": {
    "type": "api",
    "config": {
      "endpoint": "",
      "method": "GET",
      "headers": {},
      "timeout": 30000,
      "mcp_integrations": {
        "auth": "oauth-mcp",
        "cache": "redis-mcp"
      }
    }
  }
}
```

#### CLI Template with MCP Execution

```json
{
  "schema": "1.0.0",
  "type": "tool",
  "metadata": {
    "name": "Secure CLI Tool",
    "description": "Command Line Tool with MCP security"
  },
  "configuration": {
    "type": "cli",
    "config": {
      "command": "",
      "timeout": 30000,
      "mcp_executor": "secure-shell-mcp"
    }
  }
}
```

### Tool Execution

Below are TypeScript code snippets demonstrating how each tool type might be executed, including optional MCP integration.

#### Function Execution with MCP

```typescript
private async executeFunction(tool: Tool, input: unknown): Promise<unknown> {
  // Validate MCP requirements
  await this.validateMCPRequirements(tool.mcp_capabilities?.required);
  
  // Validate input
  const validatedInput = validateFunctionInput(input, tool.config.parameters);
  
  // Execute function with MCP context
  const mcpContext = await this.getMCPContext(tool.mcp_capabilities);
  const func = new Function(...params, tool.config.function);
  return func(...args, mcpContext);
}
```

#### API Execution with MCP

```typescript
private async executeAPI(tool: Tool, input: unknown): Promise<unknown> {
  // Set up MCP integrations
  const mcpIntegrations = await this.setupMCPIntegrations(tool.config.mcp_integrations);
  
  // Build request with MCP enhancements
  const request = buildAPIRequest(tool.config, input, mcpIntegrations);
  
  // Execute request
  const response = await fetch(request);
  return parseResponse(response);
}
```

#### CLI Execution with MCP

```typescript
private async executeCLI(tool: Tool, input: unknown): Promise<unknown> {
  // Get MCP executor if configured
  const executor = tool.config.mcp_executor 
    ? await this.getMCPExecutor(tool.config.mcp_executor)
    : null;
    
  // Sanitize command
  const command = sanitizeCommand(tool.config.command);
  const args = sanitizeArgs(input);
  
  // Execute command through MCP or directly
  return executor 
    ? executor.execute(command, args)
    : executeCommand(command, args);
}
```

### Security Considerations (Tools)

- **Input Validation**: Type checking, schema validation, sanitization, size limits, MCP permission checks.  
- **Execution Safety**: Resource/time limits, error handling, output validation, MCP sandbox boundaries.  
- **Access Control**: Tool permissions, user restrictions, rate limiting, audit logging, MCP access management.

### Best Practices (Tools)

1. **Tool Development**:  
   - Provide clear documentation and schemas  
   - Validate inputs thoroughly  
   - Handle errors gracefully  
   - Optimize for performance  
   - Test with integrated MCP capabilities  

2. **Security**:  
   - Sanitize all external inputs  
   - Implement timeouts for long-running tasks  
   - Monitor tool usage  
   - Always verify MCP permissions  

3. **Maintenance**:  
   - Keep tooling under version control  
   - Maintain unit/integration tests  
   - Update documentation frequently  
   - Provide backward compatibility or version migrations  
   - Perform MCP health checks regularly  

---

## Part 2: ChatCache - Universal Prompt Caching System

### Overview

**ChatCache** is a **universal** caching mechanism designed to optimize prompt usage for any local LLM. By caching prompt segments or prefix states, ChatCache reduces repeated computations and speeds up response times across multiple conversation turns or different tasks.

### Key Features

- **LLM Backend Agnostic**: Through adapter classes (e.g., HuggingFaceAdapter), ChatCache supports diverse model architectures (GPT-NeoX, LLaMA, GPT4All, etc.).
- **Asynchronous Cache Population**: Optionally compute prefix states in the background to avoid blocking user requests.
- **Cache Hit Ratio Monitoring**: Track how often requests leverage cached data to evaluate performance gains.
- **Cache Warmup**: Pre-populate frequently used modules at startup to reduce initial latency.
- **Advanced Cache Keying**: Incorporate parameters (e.g., dynamic placeholders) or text hashes into keys for precise cache entries.
- **Special Token Handling**: Optionally remove or manage tokens like `[CLS]`, `[SEP]`, `[BOS]`, etc.
- **Hash-Based Versioning**: Automatically invalidate cache entries when prompt text changes.

### How It Works

1. **Define Prompt Modules**: Store reusable segments (like “intro”, “context”, “instructions”) in a schema or JSON file.  
2. **Cache Lookup**: For each module, ChatCache checks if the precomputed prefix tokens (or states) exist.  
3. **Asynchronous Population** (optional): If a cache miss occurs, ChatCache can trigger a background task to compute and store the missing data while the request proceeds.  
4. **Final Prompt Assembly**: Cached prefix data + new user query tokens are concatenated and passed to the LLM via an adapter.  
5. **Monitoring**: Logs hits/misses, providing insights into effectiveness.  

### Code Snippet (Conceptual Flow)

```python
# 1) Instantiate the cache (with or without async support)
prompt_cache = UniversalPromptCache(enable_async=True)

# 2) Load or define prompt modules (e.g., from a JSON schema)
schema = {
    "modules": {
        "intro": "Welcome to the system. How can I help?",
        "context": "Here is some shared context."
    }
}

# 3) Retrieve or compute prefix tokens
for module_name, module_text in schema["modules"].items():
    text_hash = compute_hash_for_text(module_text)
    cached_data = prompt_cache.load(module_name, text_hash=text_hash)
    if not cached_data:
        # If not found or version mismatch, compute asynchronously
        prompt_cache.async_populate(module_name, module_text, adapter.compute_prefix_data)

# 4) Construct final prompt + user query and call the adapter
user_query = "Tell me more about advanced caching strategies."
# Combine cached prefix tokens + new query tokens -> pass to LLM
```

### Advanced Features & Considerations

1. **Asynchronous Cache Population**  
   - Improves responsiveness by offloading expensive prefix computation to a background thread or event loop.

2. **Cache Hit Ratio Monitoring**  
   - Tracks how many requests benefit from existing cache entries. Helps tune schema design.

3. **Cache Warmup**  
   - Precomputes frequently used modules at application startup (e.g., “intro” module).

4. **Advanced Keying**  
   - Uses a composite key of `module_name` + parameter values.  
   - E.g., `intro__{"user_type":"admin"}` to differentiate user-specific intros.

5. **Handling Special Tokens**  
   - Option to strip `[BOS]`, `[EOS]`, etc., from cached data so each LLM run remains consistent.

6. **Adapter-Specific Optimizations**  
   - For models with **absolute positional embeddings**, one might store partial `past_key_values`.  
   - For relative embeddings (RoPE, ALiBi), storing raw tokens is safer and more universal.

7. **Testing & Benchmarking**  
   - Measure **Time to First Token (TTFT)** or total generation time, with/without caching.  
   - Maintain unit tests for prompt assembly logic.

8. **Security Considerations**  
   - If module definitions come from untrusted sources, validate or sanitize text before caching.  
   - Enforce version checks or digital signatures.

9. **Versioning & Migration**  
   - Each cached entry includes a hash of the text or module definition.  
   - Changing the module text invalidates old entries automatically.  
   - For major changes in model architecture or data format, plan for a structured migration.

### Example: ChatCache + Tools System Synergy

- If a “Function Tool” frequently requires the same prompt context, you can define that context in a ChatCache module and leverage the cached prefix tokens before calling the function.  
- If an “API Tool” uses the same boilerplate for requests, ChatCache can store the repeated tokens used in each prompt.

---

## Putting It All Together

~~By combining the **Agent Tools System** with **ChatCache**, you can:~~

By combining **ChromaDB Storage**, the **Agent Tools System**, and **ChatCache**, you can:

1. **Store and Sync** chat sessions across browsers with ChromaDB
2. **Extend** your AI agent's capabilities (Functions, APIs, CLI) with robust security and standard practices
3. **Optimize** repeated or modular prompt segments using ChatCache, minimizing redundant computation
4. **Enhance** synergy through MCP servers, which can handle advanced tasks like filesystem access, caching, secure shell, or OAuth workflows

### Best Practices Recap

- **ChromaDB Storage**:
  - Use proper browser/client identification
  - Implement robust session merging
  - Maintain accurate timestamps
  - Track browser access history

[Rest of the original best practices remain unchanged...]

---

## Final Notes

[Original final notes preserved with additions...]

- **Scalability**: For high-traffic scenarios, consider distributing the cache (e.g., via Redis) and load-balancing tool usage
- **Security & Audit**: Implement thorough logging, error reporting, and user access checks for both Tools and ChatCache
- **Cross-Browser Support**: Ensure proper handling of browser identification and session merging
- **Ongoing Maintenance**: Keep your schemas, cache logic, and adapters up to date as you adopt new LLM models or add new Tools
- **Extensions**: Feel free to customize the blueprint here for specialized usage

Enjoy building powerful, **modular** agent capabilities with **fast** and **efficient** prompt caching and **reliable** cross-browser chat persistence!
