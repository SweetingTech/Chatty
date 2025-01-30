import { MCPClient, MCPOperation, MCPTool, MCPResource } from '../../types/mcp';
import { MCPRegistry } from './registry';
import { MCPSecurity } from './security';
import { EventEmitter } from 'events';

interface MCPClientConfig {
  name: string;
  serverName: string;
  autoApprove?: boolean;
  timeout?: number;
}

interface MCPClientEvents {
  'operation:start': (operation: MCPOperation) => void;
  'operation:end': (operation: MCPOperation, result: any) => void;
  'operation:error': (operation: MCPOperation, error: Error) => void;
  'resource:access': (uri: string) => void;
  'resource:error': (uri: string, error: Error) => void;
}

export class MCPClientImpl extends EventEmitter implements MCPClient {
  private readonly defaultTimeout = 30000; // 30 seconds
  private pendingOperations: Set<string> = new Set();

  constructor(
    private config: MCPClientConfig,
    private registry: MCPRegistry,
    private security: MCPSecurity
  ) {
    super();
  }

  get name(): string {
    return this.config.name;
  }

  public async callTool(toolName: string, args: Record<string, any>): Promise<any> {
    const operation: MCPOperation = { toolName, args };
    return this.execute(toolName, args);
  }

  public async readResource(uri: string): Promise<any> {
    try {
      // Validate resource access
      const isAllowed = await this.security.validateResourceAccess(
        this.config.serverName,
        uri
      );

      if (!isAllowed) {
        throw new Error(`Access to resource ${uri} denied`);
      }

      // Find resource in registry
      const resourceInfo = this.registry.findResourceByUri(uri);
      if (!resourceInfo) {
        throw new Error(`Resource ${uri} not found`);
      }

      this.emit('resource:access', uri);

      // Get server status
      const serverStatus = this.registry.getServerStatus(this.config.serverName);
      if (!serverStatus?.connected) {
        throw new Error(`Server ${this.config.serverName} is not connected`);
      }

      // TODO: Implement actual resource reading logic
      // This would typically involve communicating with the MCP server
      // For now, we'll return a placeholder
      return {
        uri,
        content: `Content of ${uri}`,
        timestamp: Date.now()
      };
    } catch (error) {
      this.emit('resource:error', uri, error as Error);
      throw error;
    }
  }

  public async execute(toolName: string, args: Record<string, any>): Promise<any> {
    const operation: MCPOperation = { toolName, args };
    const operationId = this.getOperationId(operation);

    try {
      // Check if operation is already in progress
      if (this.pendingOperations.has(operationId)) {
        throw new Error(`Operation ${toolName} is already in progress`);
      }

      // Validate operation
      const isAllowed = await this.security.validateOperation(
        this.config.serverName,
        operation
      );

      if (!isAllowed) {
        throw new Error(`Operation ${toolName} is not allowed`);
      }

      // Check auto-approval
      if (!this.config.autoApprove && !this.registry.isOperationAutoApproved(this.config.serverName, toolName)) {
        // TODO: Implement approval workflow
        // For now, we'll auto-approve everything
        console.warn(`Auto-approving operation ${toolName} (approval workflow not implemented)`);
      }

      // Track operation start
      this.pendingOperations.add(operationId);
      this.security.trackOperationStart(this.config.serverName, operation);
      this.emit('operation:start', operation);

      // Get server status
      const serverStatus = this.registry.getServerStatus(this.config.serverName);
      if (!serverStatus?.connected) {
        throw new Error(`Server ${this.config.serverName} is not connected`);
      }

      // Find tool in registry
      const toolInfo = this.registry.findToolByName(toolName);
      if (!toolInfo) {
        throw new Error(`Tool ${toolName} not found`);
      }

      // Execute operation with timeout
      const result = await this.executeWithTimeout(operation);

      // Track operation completion
      this.emit('operation:end', operation, result);
      return result;
    } catch (error) {
      this.emit('operation:error', operation, error as Error);
      throw error;
    } finally {
      this.pendingOperations.delete(operationId);
      this.security.trackOperationEnd(this.config.serverName, operation);
    }
  }

  private async executeWithTimeout(operation: MCPOperation): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeoutMs = this.config.timeout || this.defaultTimeout;
      const timeoutId = setTimeout(() => {
        reject(new Error(`Operation ${operation.toolName} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      // TODO: Implement actual execution logic
      // This would typically involve communicating with the MCP server
      // For now, we'll return a placeholder result
      resolve({
        success: true,
        result: `Executed ${operation.toolName} with args ${JSON.stringify(operation.args)}`,
        timestamp: Date.now()
      });

      clearTimeout(timeoutId);
    });
  }

  private getOperationId(operation: MCPOperation): string {
    return `${this.config.serverName}:${operation.toolName}:${JSON.stringify(operation.args)}`;
  }

  // Event handling with type safety
  public on<K extends keyof MCPClientEvents>(
    event: K,
    listener: MCPClientEvents[K]
  ): this {
    return super.on(event, listener);
  }

  public emit<K extends keyof MCPClientEvents>(
    event: K,
    ...args: Parameters<MCPClientEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }
}
