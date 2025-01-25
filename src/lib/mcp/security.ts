import { MCPOperation, MCPTool, MCPResource } from '../../types/mcp';
import { MCPRegistry } from './registry';

interface SecurityPolicy {
  allowedOperations: string[];
  allowedResources: string[];
  maxConcurrentOperations?: number;
  rateLimits?: {
    operations: number;
    timeWindow: number;
  };
}

interface OperationRequest {
  serverName: string;
  operation: MCPOperation;
  timestamp: number;
}

export class MCPSecurity {
  private static instance: MCPSecurity;
  private policies: Map<string, SecurityPolicy> = new Map();
  private operationHistory: OperationRequest[] = [];
  private activeOperations: Set<string> = new Set();

  private constructor(private registry: MCPRegistry) {}

  public static getInstance(registry: MCPRegistry): MCPSecurity {
    if (!MCPSecurity.instance) {
      MCPSecurity.instance = new MCPSecurity(registry);
    }
    return MCPSecurity.instance;
  }

  // Policy Management
  public setPolicy(serverName: string, policy: SecurityPolicy): void {
    this.policies.set(serverName, policy);
  }

  public getPolicy(serverName: string): SecurityPolicy | undefined {
    return this.policies.get(serverName);
  }

  public removePolicy(serverName: string): boolean {
    return this.policies.delete(serverName);
  }

  // Operation Validation
  public async validateOperation(serverName: string, operation: MCPOperation): Promise<boolean> {
    try {
      // Check server status
      const serverStatus = this.registry.getServerStatus(serverName);
      if (!serverStatus?.connected) {
        throw new Error(`Server ${serverName} is not connected`);
      }

      // Check policy
      const policy = this.getPolicy(serverName);
      if (!policy) {
        throw new Error(`No security policy defined for server ${serverName}`);
      }

      // Check operation allowlist
      if (!this.isOperationAllowed(policy, operation)) {
        throw new Error(`Operation ${operation.toolName} is not allowed by policy`);
      }

      // Check rate limits
      if (!this.checkRateLimits(serverName, policy)) {
        throw new Error('Rate limit exceeded');
      }

      // Check concurrent operations
      if (!this.checkConcurrentOperations(serverName, policy)) {
        throw new Error('Maximum concurrent operations exceeded');
      }

      // Validate operation against tool schema
      if (!this.validateToolSchema(serverName, operation)) {
        throw new Error('Operation validation failed: invalid parameters');
      }

      return true;
    } catch (error) {
      console.error(`Operation validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  // Resource Access Validation
  public async validateResourceAccess(serverName: string, uri: string): Promise<boolean> {
    try {
      // Check server status
      const serverStatus = this.registry.getServerStatus(serverName);
      if (!serverStatus?.connected) {
        throw new Error(`Server ${serverName} is not connected`);
      }

      // Check policy
      const policy = this.getPolicy(serverName);
      if (!policy) {
        throw new Error(`No security policy defined for server ${serverName}`);
      }

      // Check resource allowlist
      if (!this.isResourceAllowed(policy, uri)) {
        throw new Error(`Resource ${uri} is not allowed by policy`);
      }

      return true;
    } catch (error) {
      console.error(`Resource access validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  // Operation Tracking
  public trackOperationStart(serverName: string, operation: MCPOperation): void {
    const operationId = this.getOperationId(serverName, operation);
    this.activeOperations.add(operationId);
    this.operationHistory.push({
      serverName,
      operation,
      timestamp: Date.now()
    });

    // Clean up old history
    this.cleanupHistory();
  }

  public trackOperationEnd(serverName: string, operation: MCPOperation): void {
    const operationId = this.getOperationId(serverName, operation);
    this.activeOperations.delete(operationId);
  }

  // Private Helper Methods
  private isOperationAllowed(policy: SecurityPolicy, operation: MCPOperation): boolean {
    return policy.allowedOperations.some(pattern => {
      if (pattern.endsWith('*')) {
        const prefix = pattern.slice(0, -1);
        return operation.toolName.startsWith(prefix);
      }
      return pattern === operation.toolName;
    });
  }

  private isResourceAllowed(policy: SecurityPolicy, uri: string): boolean {
    return policy.allowedResources.some(pattern => {
      if (pattern.endsWith('*')) {
        const prefix = pattern.slice(0, -1);
        return uri.startsWith(prefix);
      }
      return pattern === uri;
    });
  }

  private checkRateLimits(serverName: string, policy: SecurityPolicy): boolean {
    if (!policy.rateLimits) {
      return true;
    }

    const { operations, timeWindow } = policy.rateLimits;
    const now = Date.now();
    const windowStart = now - timeWindow;

    const recentOperations = this.operationHistory.filter(
      op => op.serverName === serverName && op.timestamp >= windowStart
    );

    return recentOperations.length < operations;
  }

  private checkConcurrentOperations(serverName: string, policy: SecurityPolicy): boolean {
    if (!policy.maxConcurrentOperations) {
      return true;
    }

    const currentOperations = Array.from(this.activeOperations)
      .filter(id => id.startsWith(serverName + ':'))
      .length;

    return currentOperations < policy.maxConcurrentOperations;
  }

  private validateToolSchema(serverName: string, operation: MCPOperation): boolean {
    const tool = this.registry.findToolByName(operation.toolName)?.tool;
    if (!tool) {
      return false;
    }

    // Validate against tool's input schema
    if (!tool.inputSchema || typeof tool.inputSchema !== 'object') {
      return true; // No schema validation required
    }
    return this.validateAgainstSchema(operation.args, tool.inputSchema as Record<string, any>);
  }

  private validateAgainstSchema(value: any, schema: Record<string, any>): boolean {
    // Basic schema validation
    if (!schema || typeof schema !== 'object') {
      return true;
    }

    try {
      if (schema.type === 'object') {
        if (typeof value !== 'object' || value === null) {
          return false;
        }

        // Check required properties
        if (schema.required) {
          for (const prop of schema.required) {
            if (!(prop in value)) {
              return false;
            }
          }
        }

        // Validate properties
        if (schema.properties && typeof schema.properties === 'object') {
          const properties = schema.properties as Record<string, any>;
          for (const [prop, propSchema] of Object.entries(properties)) {
            if (prop in value && !this.validateAgainstSchema(value[prop], propSchema as Record<string, any>)) {
              return false;
            }
          }
        }
      } else if (schema.type === 'array') {
        if (!Array.isArray(value)) {
          return false;
        }

        // Validate array items
        if (schema.items && typeof schema.items === 'object') {
          if (value.some(item => !this.validateAgainstSchema(item, schema.items as Record<string, any>))) {
            return false;
          }
        }
      } else if (schema.type) {
        // Basic type validation
        const jsType = this.getJsType(schema.type);
        if (typeof value !== jsType) {
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Schema validation error:', error);
      return false;
    }
  }

  private getJsType(schemaType: string): string {
    const typeMap: Record<string, string> = {
      string: 'string',
      number: 'number',
      integer: 'number',
      boolean: 'boolean',
      object: 'object'
    };
    return typeMap[schemaType] || 'object';
  }

  private getOperationId(serverName: string, operation: MCPOperation): string {
    return `${serverName}:${operation.toolName}:${Date.now()}`;
  }

  private cleanupHistory(): void {
    const now = Date.now();
    const maxAge = Math.max(
      ...Array.from(this.policies.values())
        .map(p => p.rateLimits?.timeWindow || 0)
    );

    this.operationHistory = this.operationHistory.filter(
      op => now - op.timestamp <= maxAge
    );
  }
}
