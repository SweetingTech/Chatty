import { MCPClient, MCPOperation } from '../../types/mcp';
import { Tool } from '../tools/base';
import { AgentRequest, AgentResponse } from '../../types/agent';

export abstract class BaseAgent {
  private tools: Map<string, Tool>;
  private mcpClient: MCPClient;

  constructor(mcpClient: MCPClient) {
    this.tools = new Map();
    this.mcpClient = mcpClient;
  }

  // Register a tool with the agent
  registerTool(name: string, tool: Tool): void {
    if (this.tools.has(name)) {
      throw new Error(`Tool ${name} already registered`);
    }
    this.tools.set(name, tool);
  }

  // Get a registered tool by name
  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  // Execute an MCP operation
  protected async executeMCPOperation(operation: MCPOperation): Promise<any> {
    try {
      return await this.mcpClient.execute(operation.toolName, operation.args);
    } catch (error) {
      throw new Error(`MCP operation failed: ${error}`);
    }
  }

  // Main request handler
  async handleRequest(request: AgentRequest): Promise<AgentResponse> {
    try {
      // Validate request
      this.validateRequest(request);

      // Process request
      const result = await this.processRequest(request);

      return {
        success: true,
        message: 'Operation completed successfully',
        data: result,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        message: 'Operation failed',
        error: errorMessage,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Abstract method for request processing
  protected abstract processRequest(request: AgentRequest): Promise<any>;

  // Validate request structure and permissions
  private validateRequest(request: AgentRequest): void {
    // Allow requests with either operation or payload
    if (!request.operation && !request.payload) {
      throw new Error('Request must contain either operation or payload');
    }
    // Additional validation logic here
  }

  // Security controls
  protected checkPermissions(operation: string): boolean {
    // Implement permission checking logic
    return true;
  }
}
