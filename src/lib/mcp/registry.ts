import { MCPClient, MCPTool, MCPResource } from '../../types/mcp';
import { EventEmitter } from 'events';

interface MCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
  disabled?: boolean;
  autoApprove?: string[];
}

interface MCPServerStatus {
  connected: boolean;
  lastError?: string;
  lastPing?: number;
  tools: MCPTool[];
  resources: MCPResource[];
}

export class MCPRegistry extends EventEmitter {
  private static instance: MCPRegistry;
  private clients: Map<string, MCPClient> = new Map();
  private serverConfigs: Map<string, MCPServerConfig> = new Map();
  private serverStatus: Map<string, MCPServerStatus> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;

  private constructor() {
    super();
    this.startHealthCheck();
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
      throw new Error(`MCP client with name ${client.name} already registered`);
    }
    this.clients.set(client.name, client);
    this.emit('clientRegistered', client.name);
  }

  public getClient(name: string): MCPClient | undefined {
    return this.clients.get(name);
  }

  public listClients(): MCPClient[] {
    return Array.from(this.clients.values());
  }

  public unregisterClient(name: string): boolean {
    const result = this.clients.delete(name);
    if (result) {
      this.emit('clientUnregistered', name);
    }
    return result;
  }

  // Server Configuration Management
  public setServerConfig(name: string, config: MCPServerConfig): void {
    this.serverConfigs.set(name, config);
    this.emit('serverConfigUpdated', name);
  }

  public getServerConfig(name: string): MCPServerConfig | undefined {
    return this.serverConfigs.get(name);
  }

  public listServerConfigs(): Map<string, MCPServerConfig> {
    return new Map(this.serverConfigs);
  }

  public removeServerConfig(name: string): boolean {
    const result = this.serverConfigs.delete(name);
    if (result) {
      this.emit('serverConfigRemoved', name);
    }
    return result;
  }

  // Server Status Management
  public updateServerStatus(name: string, status: Partial<MCPServerStatus>): void {
    const currentStatus = this.serverStatus.get(name) || {
      connected: false,
      tools: [],
      resources: []
    };
    
    this.serverStatus.set(name, {
      ...currentStatus,
      ...status,
      lastPing: Date.now()
    });

    this.emit('serverStatusUpdated', name);
  }

  public getServerStatus(name: string): MCPServerStatus | undefined {
    return this.serverStatus.get(name);
  }

  public listServerStatus(): Map<string, MCPServerStatus> {
    return new Map(this.serverStatus);
  }

  // Tool Management
  public getAvailableTools(serverName: string): MCPTool[] {
    return this.serverStatus.get(serverName)?.tools || [];
  }

  public findToolByName(toolName: string): { server: string; tool: MCPTool } | undefined {
    for (const [server, status] of this.serverStatus) {
      const tool = status.tools.find(t => t.name === toolName);
      if (tool) {
        return { server, tool };
      }
    }
    return undefined;
  }

  // Resource Management
  public getAvailableResources(serverName: string): MCPResource[] {
    return this.serverStatus.get(serverName)?.resources || [];
  }

  public findResourceByUri(uri: string): { server: string; resource: MCPResource } | undefined {
    for (const [server, status] of this.serverStatus) {
      const resource = status.resources.find(r => r.uri === uri);
      if (resource) {
        return { server, resource };
      }
    }
    return undefined;
  }

  // Health Check System
  private startHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(() => {
      const now = Date.now();
      for (const [name, status] of this.serverStatus) {
        if (status.lastPing && now - status.lastPing > 30000) { // 30 seconds timeout
          this.updateServerStatus(name, {
            connected: false,
            lastError: 'Server health check timeout'
          });
        }
      }
    }, 10000); // Check every 10 seconds
  }

  // Operation Approval
  public isOperationAutoApproved(serverName: string, operation: string): boolean {
    const config = this.serverConfigs.get(serverName);
    return config?.autoApprove?.includes(operation) || false;
  }

  // Cleanup
  public dispose(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    this.removeAllListeners();
    this.clients.clear();
    this.serverConfigs.clear();
    this.serverStatus.clear();
  }
}
