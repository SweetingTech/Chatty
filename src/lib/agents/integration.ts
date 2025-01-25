import { BaseAgent } from './base';
import { AgentRequest, AgentResponse } from '../../types/agent';
import { MCPClient } from '../mcp';

interface IntegrationConfig {
  id: string;
  name: string;
  type: 'api' | 'database' | 'service' | 'custom';
  endpoint?: string;
  credentials?: Record<string, string>;
  settings: Record<string, any>;
  status: 'connected' | 'disconnected' | 'error';
  lastError?: string;
}

interface IntegrationOperation {
  id: string;
  type: string;
  params: Record<string, any>;
  result?: any;
  error?: string;
  timestamp: string;
}

export class IntegrationAgent extends BaseAgent {
  private integrations: Map<string, IntegrationConfig>;
  private operationHistory: Map<string, IntegrationOperation[]>;

  constructor(mcpClient: MCPClient) {
    super(mcpClient);
    this.integrations = new Map();
    this.operationHistory = new Map();
  }

  // Register a new integration
  registerIntegration(config: IntegrationConfig): void {
    if (this.integrations.has(config.id)) {
      throw new Error(`Integration ${config.id} already registered`);
    }
    this.integrations.set(config.id, config);
    this.operationHistory.set(config.id, []);
  }

  // Get integration by ID
  getIntegration(id: string): IntegrationConfig | undefined {
    return this.integrations.get(id);
  }

  // List all integrations
  listIntegrations(): IntegrationConfig[] {
    return Array.from(this.integrations.values());
  }

  // Get operation history for an integration
  getOperationHistory(integrationId: string): IntegrationOperation[] {
    return this.operationHistory.get(integrationId) || [];
  }

  protected async processRequest(request: AgentRequest): Promise<AgentResponse> {
    try {
      const { integrationId, action } = request.payload;

      // Process integration action
      switch (action) {
        case 'connect':
          return await this.connectIntegration(integrationId, request);
        case 'execute':
          return await this.executeOperation(integrationId, request);
        case 'status':
          return await this.getIntegrationStatus(integrationId);
        case 'disconnect':
          return await this.disconnectIntegration(integrationId);
        default:
          throw new Error(`Unknown integration action: ${action}`);
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  // Connect to an integration
  private async connectIntegration(integrationId: string, request: AgentRequest): Promise<AgentResponse> {
    const integration = this.getIntegration(integrationId);
    if (!integration) {
      throw new Error(`Integration ${integrationId} not found`);
    }

    try {
      // Execute MCP connection operation if present
      if (request.operation) {
        const result = await this.executeMCPOperation(request.operation);
        integration.settings.connectionDetails = result;
      }

      integration.status = 'connected';
      integration.lastError = undefined;

      return {
        success: true,
        message: `Successfully connected to ${integration.name}`,
        data: { integration },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      integration.status = 'error';
      integration.lastError = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    }
  }

  // Execute an operation on an integration
  private async executeOperation(integrationId: string, request: AgentRequest): Promise<AgentResponse> {
    const integration = this.getIntegration(integrationId);
    if (!integration) {
      throw new Error(`Integration ${integrationId} not found`);
    }

    if (integration.status !== 'connected') {
      throw new Error(`Integration ${integrationId} is not connected`);
    }

    const operation: IntegrationOperation = {
      id: request.payload.operationId || `op-${Date.now()}`,
      type: request.payload.operationType,
      params: request.payload.params || {},
      timestamp: new Date().toISOString()
    };

    try {
      // Execute MCP operation
      if (request.operation) {
        operation.result = await this.executeMCPOperation(request.operation);
      }

      // Add to operation history
      const history = this.operationHistory.get(integrationId) || [];
      history.push(operation);
      this.operationHistory.set(integrationId, history);

      return {
        success: true,
        message: `Operation ${operation.type} executed successfully`,
        data: { integration, operation },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      operation.error = error instanceof Error ? error.message : 'Unknown error';
      
      // Add failed operation to history
      const history = this.operationHistory.get(integrationId) || [];
      history.push(operation);
      this.operationHistory.set(integrationId, history);

      throw error;
    }
  }

  // Get integration status
  private async getIntegrationStatus(integrationId: string): Promise<AgentResponse> {
    const integration = this.getIntegration(integrationId);
    if (!integration) {
      throw new Error(`Integration ${integrationId} not found`);
    }

    const history = this.getOperationHistory(integrationId);
    const recentOperations = history.slice(-5); // Get last 5 operations

    return {
      success: true,
      message: `Integration status: ${integration.status}`,
      data: {
        integration,
        recentOperations,
        operationCount: history.length
      },
      timestamp: new Date().toISOString()
    };
  }

  // Disconnect from an integration
  private async disconnectIntegration(integrationId: string): Promise<AgentResponse> {
    const integration = this.getIntegration(integrationId);
    if (!integration) {
      throw new Error(`Integration ${integrationId} not found`);
    }

    integration.status = 'disconnected';
    integration.lastError = undefined;

    return {
      success: true,
      message: `Successfully disconnected from ${integration.name}`,
      data: { integration },
      timestamp: new Date().toISOString()
    };
  }

  // Update integration configuration
  updateIntegrationConfig(id: string, updates: Partial<IntegrationConfig>): void {
    const integration = this.getIntegration(id);
    if (integration) {
      this.integrations.set(id, { ...integration, ...updates });
    }
  }

  // Remove an integration
  removeIntegration(id: string): void {
    this.integrations.delete(id);
    this.operationHistory.delete(id);
  }

  // Clear operation history for an integration
  clearOperationHistory(integrationId: string): void {
    this.operationHistory.set(integrationId, []);
  }
}
