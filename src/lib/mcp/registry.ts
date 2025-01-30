import { MCPClient, MCPTool, MCPResource, MCPServerConfig, MCPServerStatus } from '../../types/mcp';

export class MCPRegistry {
  private static instance: MCPRegistry;
  private clients: Map<string, MCPClient>;
  private serverConfigs: Map<string, MCPServerConfig>;
  private serverStatus: Map<string, MCPServerStatus & { lastPing: number }>;

  private constructor() {
    this.clients = new Map();
    this.serverConfigs = new Map();
    this.serverStatus = new Map();
  }

  public static getInstance(): MCPRegistry {
    if (!MCPRegistry.instance) {
      MCPRegistry.instance = new MCPRegistry();
    }
    return MCPRegistry.instance;
  }

  // Client Management
  public registerClient(client: MCPClient): void {
    if (this.clients.has(client.name)) {
      throw new Error(`Client ${client.name} is already registered`);
    }
    this.clients.set(client.name, client);
  }

  public unregisterClient(clientName: string): boolean {
    return this.clients.delete(clientName);
  }

  public getClient(clientName: string): MCPClient | undefined {
    return this.clients.get(clientName);
  }

  public listClients(): MCPClient[] {
    return Array.from(this.clients.values());
  }

  // Server Configuration
  public setServerConfig(serverName: string, config: MCPServerConfig): void {
    this.serverConfigs.set(serverName, config);
  }

  public removeServerConfig(serverName: string): boolean {
    return this.serverConfigs.delete(serverName);
  }

  public getServerConfig(serverName: string): MCPServerConfig | undefined {
    return this.serverConfigs.get(serverName);
  }

  public listServerConfigs(): Map<string, MCPServerConfig> {
    return new Map(this.serverConfigs);
  }

  // Server Status
  public updateServerStatus(serverName: string, status: MCPServerStatus): void {
    this.serverStatus.set(serverName, {
      ...status,
      lastPing: Date.now()
    });
  }

  public getServerStatus(serverName: string): (MCPServerStatus & { lastPing: number }) | undefined {
    return this.serverStatus.get(serverName);
  }

  public listServerStatus(): Map<string, MCPServerStatus & { lastPing: number }> {
    return new Map(this.serverStatus);
  }

  // Tool Management
  public getAvailableTools(serverName: string): MCPTool[] {
    const status = this.serverStatus.get(serverName);
    return status?.tools || [];
  }

  public findToolByName(toolName: string): { server: string; tool: MCPTool } | undefined {
    for (const [server, status] of this.serverStatus) {
      const tool = status.tools.find((t: MCPTool) => t.name === toolName);
      if (tool) {
        return { server, tool };
      }
    }
    return undefined;
  }

  // Resource Management
  public getAvailableResources(serverName: string): MCPResource[] {
    const status = this.serverStatus.get(serverName);
    return status?.resources || [];
  }

  public findResourceByUri(uri: string): { server: string; resource: MCPResource } | undefined {
    for (const [server, status] of this.serverStatus) {
      const resource = status.resources.find((r: MCPResource) => r.uri === uri);
      if (resource) {
        return { server, resource };
      }
    }
    return undefined;
  }

  // Operation Approval
  public isOperationAutoApproved(serverName: string, operation: string): boolean {
    const config = this.serverConfigs.get(serverName);
    if (!config || !config.autoApprove) {
      return false;
    }
    return config.autoApprove.includes(operation);
  }
}

export const mcpRegistry = MCPRegistry.getInstance();
