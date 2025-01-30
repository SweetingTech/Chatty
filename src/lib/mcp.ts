import { MCPClient, MCPOperation, MCPTool, MCPResource, MCPServerStatus } from '../types/mcp';
import { MCPRegistry } from './mcp/registry';
import { MCPSecurity } from './mcp/security';

export type { MCPClient, MCPOperation, MCPTool, MCPResource, MCPServerStatus };

interface ModelContext {
  id: string;
  model: string;
  context: string[];
  metadata: Record<string, any>;
  createdAt: number;
}

interface ModelResponse {
  id: string;
  content: string;
  timestamp: number;
  metadata: Record<string, any>;
}

// Context and response storage
const contexts = new Map<string, ModelContext>();
const responses = new Map<string, ModelResponse[]>();

// Get MCP configuration from environment variables
const mcpHost = import.meta.env.VITE_MCP_HOST || 'localhost';
const mcpPort = import.meta.env.VITE_MCP_PORT || '3001';
const mcpClientName = import.meta.env.VITE_MCP_CLIENT_NAME || 'default-client';
const mcpBaseUrl = `http://${mcpHost}:${mcpPort}`;

export class MCPClientImpl implements MCPClient {
  private baseUrl: string;
  readonly name: string;

  constructor(baseUrl: string, name: string) {
    this.baseUrl = baseUrl;
    this.name = name;
  }

  async callTool(toolName: string, args: Record<string, any>): Promise<any> {
    const response = await fetch(`${this.baseUrl}/tools/${toolName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
    });

    if (!response.ok) {
      throw new Error(`MCP tool call failed: ${response.statusText}`);
    }

    return response.json();
  }

  async readResource(uri: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/resources/${encodeURIComponent(uri)}`);

    if (!response.ok) {
      throw new Error(`MCP resource read failed: ${response.statusText}`);
    }

    return response.json();
  }

  async execute(toolName: string, args: Record<string, any>): Promise<any> {
    const response = await fetch(`${this.baseUrl}/execute/${toolName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
    });

    if (!response.ok) {
      throw new Error(`MCP execute failed: ${response.statusText}`);
    }

    return response.json();
  }
}

// Create singleton instances
const registry = MCPRegistry.getInstance();
const security = MCPSecurity.getInstance(registry);

// Export MCP interface
export const mcp = {
  registry,
  security,
  client: new MCPClientImpl(mcpBaseUrl, mcpClientName),

  // Context Management
  getAllContexts(): ModelContext[] {
    return Array.from(contexts.values());
  },

  createContext(model: string, initialContext: string[], metadata: Record<string, any>): ModelContext {
    const context: ModelContext = {
      id: crypto.randomUUID(),
      model,
      context: initialContext,
      metadata,
      createdAt: Date.now(),
    };
    contexts.set(context.id, context);
    return context;
  },

  deleteContext(id: string): void {
    contexts.delete(id);
    responses.delete(id);
  },

  mergeContexts(contextIds: string[]): ModelContext {
    const contextsToMerge = contextIds.map(id => contexts.get(id)).filter(Boolean) as ModelContext[];
    if (contextsToMerge.length < 2) {
      throw new Error('At least two contexts are required for merging');
    }

    const mergedContext: ModelContext = {
      id: crypto.randomUUID(),
      model: contextsToMerge[0].model,
      context: contextsToMerge.flatMap(ctx => ctx.context),
      metadata: contextsToMerge.reduce((acc, ctx) => ({ ...acc, ...ctx.metadata }), {}),
      createdAt: Date.now(),
    };

    contexts.set(mergedContext.id, mergedContext);
    return mergedContext;
  },

  // Response Management
  getResponses(contextId: string): ModelResponse[] {
    return responses.get(contextId) || [];
  },

  addResponse(contextId: string, content: string, metadata: Record<string, any> = {}): ModelResponse {
    const response: ModelResponse = {
      id: crypto.randomUUID(),
      content,
      timestamp: Date.now(),
      metadata,
    };

    const contextResponses = responses.get(contextId) || [];
    responses.set(contextId, [...contextResponses, response]);
    return response;
  },
};

export type { ModelContext, ModelResponse };
