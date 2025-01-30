import type { MCPRegistry, MCPOperation, MCPSecurityPolicy } from '../../types/mcp';
import { mcpRegistry } from './registry';

interface OperationRecord {
  serverName: string;
  operation: MCPOperation;
  timestamp: number;
}

export class MCPSecurity {
  private static instance: MCPSecurity;
  private registry: MCPRegistry;
  private policies: Map<string, MCPSecurityPolicy>;
  private activeOperations: Set<string>;
  private operationHistory: OperationRecord[];

  private constructor(registry: MCPRegistry) {
    this.registry = registry;
    this.policies = new Map();
    this.activeOperations = new Set();
    this.operationHistory = [];
  }

  public static getInstance(registry: MCPRegistry): MCPSecurity {
    if (!MCPSecurity.instance) {
      MCPSecurity.instance = new MCPSecurity(registry);
    }
    return MCPSecurity.instance;
  }

  // Policy Management
  public setPolicy(serverName: string, policy: MCPSecurityPolicy): void {
    this.policies.set(serverName, policy);
  }

  public getPolicy(serverName: string): MCPSecurityPolicy | undefined {
    return this.policies.get(serverName);
  }

  public removePolicy(serverName: string): boolean {
    return this.policies.delete(serverName);
  }

  // Operation Validation
  public async validateOperation(serverName: string, operation: MCPOperation): Promise<boolean> {
    // Check server connection
    const status = this.registry.getServerStatus(serverName);
    if (!status?.connected) {
      return false;
    }

    // Check policy exists
    const policy = this.policies.get(serverName);
    if (!policy) {
      return false;
    }

    // Check operation is allowed
    const isAllowed = policy.allowedOperations.some(pattern => {
      if (pattern.endsWith('*')) {
        const prefix = pattern.slice(0, -1);
        return operation.toolName.startsWith(prefix);
      }
      return pattern === operation.toolName;
    });

    if (!isAllowed) {
      return false;
    }

    // Check rate limits
    if (policy.rateLimits) {
      this.cleanupHistory();
      const recentOps = this.operationHistory.filter(
        op => op.serverName === serverName &&
        op.timestamp > Date.now() - policy.rateLimits!.timeWindow
      );
      if (recentOps.length >= policy.rateLimits.operations) {
        return false;
      }
    }

    // Check concurrent operation limits
    if (policy.maxConcurrentOperations !== undefined) {
      const currentOps = Array.from(this.activeOperations)
        .filter(key => key.startsWith(serverName + ':'))
        .length;
      if (currentOps >= policy.maxConcurrentOperations) {
        return false;
      }
    }

    return true;
  }

  // Resource Access Validation
  public async validateResourceAccess(serverName: string, uri: string): Promise<boolean> {
    // Check server connection
    const status = this.registry.getServerStatus(serverName);
    if (!status?.connected) {
      return false;
    }

    // Check policy exists
    const policy = this.policies.get(serverName);
    if (!policy) {
      return false;
    }

    // Check resource is allowed
    return policy.allowedResources.some(pattern => {
      if (pattern.endsWith('*')) {
        const prefix = pattern.slice(0, -1);
        return uri.startsWith(prefix);
      }
      return pattern === uri;
    });
  }

  // Operation Tracking
  public trackOperationStart(serverName: string, operation: MCPOperation): void {
    const key = `${serverName}:${operation.toolName}`;
    this.activeOperations.add(key);
    this.operationHistory.push({
      serverName,
      operation,
      timestamp: Date.now()
    });
  }

  public trackOperationEnd(serverName: string, operation: MCPOperation): void {
    const key = `${serverName}:${operation.toolName}`;
    this.activeOperations.delete(key);
  }

  // Cleanup
  private cleanupHistory(): void {
    const policy = Array.from(this.policies.values()).find(p => p.rateLimits);
    if (!policy?.rateLimits) return;

    const cutoff = Date.now() - policy.rateLimits.timeWindow;
    this.operationHistory = this.operationHistory.filter(op => op.timestamp > cutoff);
  }
}

export const mcpSecurity = MCPSecurity.getInstance(mcpRegistry);
