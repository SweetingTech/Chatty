import { BaseTool } from './base';
import { MCPOperation } from '../../types/mcp';

export class FunctionTool extends BaseTool {
  private fn: Function;

  constructor(name: string, description: string, fn: Function, mcpClient?: any) {
    super(name, description, mcpClient);
    this.fn = fn;
  }

  async execute(params: any): Promise<any> {
    try {
      return await this.fn(params);
    } catch (error) {
      throw new Error(`Function execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  validateMCPOperation(operation: MCPOperation): boolean {
    if (!super.validateMCPOperation(operation)) {
      return false;
    }
    
    // Additional validation specific to function tools
    if (!operation.args || typeof operation.args !== 'object') {
      throw new Error('Invalid MCP operation: args must be an object');
    }

    return true;
  }
}
