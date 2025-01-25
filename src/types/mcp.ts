export interface MCPClient {
  name: string;
  callTool(toolName: string, args: Record<string, any>): Promise<any>;
  readResource(uri: string): Promise<any>;
  execute(toolName: string, args: Record<string, any>): Promise<any>;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPOperation {
  toolName: string;
  args: Record<string, any>;
}

export interface ModelContext {
  id: string;
  model: string;
  context: string[];
  metadata: Record<string, any>;
  createdAt: number;
}

export interface ModelResponse {
  id: string;
  content: string;
  timestamp: number;
  metadata: Record<string, any>;
}

export interface MCPServerStatus {
  connected: boolean;
  tools: MCPTool[];
  resources: MCPResource[];
}
