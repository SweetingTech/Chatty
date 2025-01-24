import { nanoid } from 'nanoid';
import type { Tool, Agent, MCPConnection } from '../../types';
import toolTemplate from '../../templates/tool-template.json';
import agentTemplate from '../../templates/agent-template.json';
import mcpTemplate from '../../templates/mcp-template.json';

export class BuilderAgent {
  private static instance: BuilderAgent;

  private constructor() {}

  public static getInstance(): BuilderAgent {
    if (!BuilderAgent.instance) {
      BuilderAgent.instance = new BuilderAgent();
    }
    return BuilderAgent.instance;
  }

  public async createTool(config: Partial<typeof toolTemplate>): Promise<Tool> {
    try {
      // Merge with template
      const toolConfig = {
        ...toolTemplate,
        ...config,
        metadata: {
          ...toolTemplate.metadata,
          ...config.metadata,
        },
      };

      // Validate configuration
      this.validateToolConfig(toolConfig);

      // Create tool
      const tool: Tool = {
        id: nanoid(),
        name: toolConfig.metadata.name,
        description: toolConfig.metadata.description,
        type: toolConfig.configuration.type,
        config: toolConfig.configuration.config,
      };

      return tool;
    } catch (error) {
      console.error('Failed to create tool:', error);
      throw error;
    }
  }

  public async createAgent(config: Partial<typeof agentTemplate>): Promise<Agent> {
    try {
      // Merge with template
      const agentConfig = {
        ...agentTemplate,
        ...config,
        metadata: {
          ...agentTemplate.metadata,
          ...config.metadata,
        },
      };

      // Validate configuration
      this.validateAgentConfig(agentConfig);

      // Create agent
      const agent: Agent = {
        id: nanoid(),
        name: agentConfig.metadata.name,
        description: agentConfig.metadata.description,
        tools: agentConfig.configuration.tools,
        config: {
          status: 'stopped',
          ...agentConfig.configuration,
        },
      };

      return agent;
    } catch (error) {
      console.error('Failed to create agent:', error);
      throw error;
    }
  }

  public async createMCP(config: Partial<typeof mcpTemplate>): Promise<MCPConnection> {
    try {
      // Merge with template
      const mcpConfig = {
        ...mcpTemplate,
        ...config,
        metadata: {
          ...mcpTemplate.metadata,
          ...config.metadata,
        },
      };

      // Validate configuration
      this.validateMCPConfig(mcpConfig);

      // Create MCP connection
      const mcp: MCPConnection = {
        id: nanoid(),
        sourceId: mcpConfig.configuration.model,
        targetId: '',
        type: 'llm',
        metadata: mcpConfig.metadata,
        createdAt: Date.now(),
      };

      return mcp;
    } catch (error) {
      console.error('Failed to create MCP:', error);
      throw error;
    }
  }

  private validateToolConfig(config: typeof toolTemplate) {
    if (!config.metadata.name) throw new Error('Tool name is required');
    if (!config.metadata.description) throw new Error('Tool description is required');
    if (!config.configuration.type) throw new Error('Tool type is required');
  }

  private validateAgentConfig(config: typeof agentTemplate) {
    if (!config.metadata.name) throw new Error('Agent name is required');
    if (!config.metadata.description) throw new Error('Agent description is required');
    if (!Array.isArray(config.configuration.tools)) {
      throw new Error('Agent tools must be an array');
    }
  }

  private validateMCPConfig(config: typeof mcpTemplate) {
    if (!config.metadata.name) throw new Error('MCP name is required');
    if (!config.metadata.description) throw new Error('MCP description is required');
    if (!config.configuration.model) throw new Error('MCP model is required');
  }
}

export const builderAgent = BuilderAgent.getInstance();