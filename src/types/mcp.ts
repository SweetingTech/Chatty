export interface MCPClient {
  name: string;
  callTool: (toolName: string, args: Record<string, any>) => Promise<any>;
  readResource: (uri: string) => Promise<any>;
  execute: (toolName: string, args: Record<string, any>) => Promise<any>;
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

export interface MCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
  autoApprove?: string[];
}

export interface MCPServerStatus {
  connected: boolean;
  tools: MCPTool[];
  resources: MCPResource[];
}

export interface MCPServerInfo {
  name: string;
  version: string;
  capabilities: {
    tools: Record<string, any>;
    resources: Record<string, any>;
  };
}

export interface MCPError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export interface MCPResponse<T = any> {
  success: boolean;
  data?: T;
  error?: MCPError;
}

export type ModelContext = MCPContext;

export interface MCPContext {
  id: string;
  model: string;
  context: string[];
  metadata: Record<string, any>;
  createdAt: number;
}

export interface MCPOperation {
  toolName: string;
  args: Record<string, any>;
}

export interface MCPSecurityPolicy {
  allowedOperations: string[];
  allowedResources: string[];
  maxConcurrentOperations?: number;
  rateLimits?: {
    operations: number;
    timeWindow: number;
  };
}

export interface MCPRegistry {
  registerClient(client: MCPClient): void;
  unregisterClient(clientName: string): boolean;
  getClient(clientName: string): MCPClient | undefined;
  listClients(): MCPClient[];
  
  setServerConfig(serverName: string, config: MCPServerConfig): void;
  removeServerConfig(serverName: string): boolean;
  getServerConfig(serverName: string): MCPServerConfig | undefined;
  listServerConfigs(): Map<string, MCPServerConfig>;
  
  updateServerStatus(serverName: string, status: MCPServerStatus): void;
  getServerStatus(serverName: string): MCPServerStatus | undefined;
  listServerStatus(): Map<string, MCPServerStatus>;
  
  getAvailableTools(serverName: string): MCPTool[];
  findToolByName(toolName: string): { server: string; tool: MCPTool } | undefined;
  
  getAvailableResources(serverName: string): MCPResource[];
  findResourceByUri(uri: string): { server: string; resource: MCPResource } | undefined;
  
  isOperationAutoApproved(serverName: string, operation: string): boolean;
}
