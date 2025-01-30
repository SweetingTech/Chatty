import { MCPClient, MCPOperation } from '../../types/mcp';

export interface Tool {
  name: string;
  description: string;
  mcpEnabled: boolean;
  mcpClient?: MCPClient;
  
  execute(params: any): Promise<any>;
  validateMCPOperation?(operation: MCPOperation): boolean;
  executeMCPOperation?(operation: MCPOperation): Promise<any>;
}

export abstract class BaseTool implements Tool {
  name: string;
  description: string;
  mcpEnabled: boolean;
  mcpClient?: MCPClient;

  constructor(name: string, description: string, mcpClient?: MCPClient) {
    this.name = name;
    this.description = description;
    this.mcpEnabled = !!mcpClient;
    this.mcpClient = mcpClient;
  }

  abstract execute(params: any): Promise<any>;

  validateMCPOperation(operation: MCPOperation): boolean {
    if (!this.mcpEnabled || !this.mcpClient) {
      throw new Error('MCP operations not enabled for this tool');
    }
    
    if (!operation.toolName || !operation.args) {
      throw new Error('Invalid MCP operation: missing required fields');
    }

    return true;
  }

  async executeMCPOperation(operation: MCPOperation): Promise<any> {
    if (!this.validateMCPOperation(operation)) {
      throw new Error('MCP operation validation failed');
    }

    try {
      return await this.mcpClient!.execute(operation.toolName, operation.args);
    } catch (error) {
      throw new Error(`MCP operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
