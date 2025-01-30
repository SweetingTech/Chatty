import { BaseAgent } from './base';
import { AgentRequest, AgentResponse, AgentConfig } from '../../types/agent';
import { MCPClient } from '../mcp';

export class RouterAgent extends BaseAgent {
  private agents: Map<string, BaseAgent>;
  private agentConfigs: Map<string, AgentConfig>;

  constructor(mcpClient: MCPClient) {
    super(mcpClient);
    this.agents = new Map();
    this.agentConfigs = new Map();
  }

  // Register an agent with the router
  registerAgent(agent: BaseAgent, config: AgentConfig): void {
    if (this.agents.has(config.id)) {
      throw new Error(`Agent with ID ${config.id} already registered`);
    }
    this.agents.set(config.id, agent);
    this.agentConfigs.set(config.id, config);
  }

  // Get registered agent by ID
  getAgent(id: string): BaseAgent | undefined {
    return this.agents.get(id);
  }

  // Get agent config by ID
  getAgentConfig(id: string): AgentConfig | undefined {
    return this.agentConfigs.get(id);
  }

  // List all registered agents
  listAgents(): AgentConfig[] {
    return Array.from(this.agentConfigs.values());
  }

  // Find the most appropriate agent for a request
  private findAppropriateAgent(request: AgentRequest): BaseAgent {
    // If agent ID is specified in the request, use that
    if (request.payload?.agentId) {
      const agent = this.getAgent(request.payload.agentId);
      if (agent) {
        return agent;
      }
    }

    // Otherwise, analyze request to determine best agent
    // This could be enhanced with more sophisticated routing logic
    for (const [id, config] of this.agentConfigs) {
      if (config.enabled && this.canHandleRequest(config, request)) {
        const agent = this.agents.get(id);
        if (agent) {
          return agent;
        }
      }
    }

    throw new Error('No suitable agent found for request');
  }

  // Check if an agent can handle a specific request
  private canHandleRequest(config: AgentConfig, request: AgentRequest): boolean {
    // Basic capability checking
    // This could be enhanced with more sophisticated matching logic
    if (request.operation) {
      // Check if agent supports the requested operation
      return config.settings?.supportedOperations?.includes(request.operation.toolName) ?? false;
    }

    // Default to true for agents that handle general requests
    return config.settings?.handleGeneral ?? false;
  }

  protected async processRequest(request: AgentRequest): Promise<AgentResponse> {
    try {
      // Find appropriate agent
      const agent = this.findAppropriateAgent(request);

      // Delegate request to agent
      const response = await agent.handleRequest(request);

      // Find agent config by searching through the map
      const agentConfig = Array.from(this.agentConfigs.entries())
        .find(([_, config]) => this.agents.get(config.id) === agent)?.[1];

      // Add routing metadata
      return {
        ...response,
        data: {
          ...response.data,
          routingInfo: {
            handledBy: agentConfig,
            timestamp: new Date().toISOString()
          }
        }
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  // Enable an agent
  enableAgent(id: string): void {
    const config = this.agentConfigs.get(id);
    if (config) {
      config.enabled = true;
      this.agentConfigs.set(id, config);
    }
  }

  // Disable an agent
  disableAgent(id: string): void {
    const config = this.agentConfigs.get(id);
    if (config) {
      config.enabled = false;
      this.agentConfigs.set(id, config);
    }
  }

  // Update agent configuration
  updateAgentConfig(id: string, updates: Partial<AgentConfig>): void {
    const config = this.agentConfigs.get(id);
    if (config) {
      this.agentConfigs.set(id, { ...config, ...updates });
    }
  }

  // Remove an agent
  removeAgent(id: string): void {
    this.agents.delete(id);
    this.agentConfigs.delete(id);
  }
}
