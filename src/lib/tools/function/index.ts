import { BaseTool } from '../base';
import { MCPClient, MCPOperation } from '../../../types/mcp';

interface FunctionParams {
  code: string;
  args?: Record<string, any>;
  context?: Record<string, any>;
  timeout?: number;
  mcpOperations?: MCPOperation[];
}

interface FunctionResult {
  success: boolean;
  result?: any;
  error?: string;
  mcpResults?: Record<string, any>;
}

interface FunctionContext {
  args: Record<string, any>;
  console: {
    log: (...args: any[]) => void;
    error: (...args: any[]) => void;
    warn: (...args: any[]) => void;
  };
  mcp?: {
    execute: (toolName: string, args: Record<string, any>) => Promise<any>;
  };
  [key: string]: any;
}

export class FunctionTool extends BaseTool {
  private readonly defaultTimeout = 5000; // 5 seconds
  private readonly maxTimeout = 30000; // 30 seconds

  constructor(mcpClient?: MCPClient) {
    super('function', 'Execute JavaScript/TypeScript functions with MCP support', mcpClient);
  }

  async execute(params: FunctionParams): Promise<FunctionResult> {
    try {
      // Validate parameters
      this.validateParams(params);

      // Set up execution context
      const context = await this.prepareContext(params);

      // Execute MCP operations if present
      const mcpResults = await this.executeMCPOperations(params.mcpOperations);

      // Create sandbox environment
      const sandbox = this.createSandbox(context, mcpResults);

      // Execute function with timeout
      const result = await this.executeWithTimeout(params.code, sandbox, params.timeout);

      return {
        success: true,
        result,
        mcpResults
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  private validateParams(params: FunctionParams): void {
    if (!params.code || typeof params.code !== 'string') {
      throw new Error('Invalid function code');
    }

    if (params.timeout) {
      if (typeof params.timeout !== 'number' || params.timeout < 0 || params.timeout > this.maxTimeout) {
        throw new Error(`Timeout must be between 0 and ${this.maxTimeout}ms`);
      }
    }

    if (params.args && typeof params.args !== 'object') {
      throw new Error('Args must be an object');
    }

    if (params.context && typeof params.context !== 'object') {
      throw new Error('Context must be an object');
    }

    if (params.mcpOperations) {
      if (!Array.isArray(params.mcpOperations)) {
        throw new Error('MCP operations must be an array');
      }
      params.mcpOperations.forEach(op => {
        if (!op.toolName || typeof op.args !== 'object') {
          throw new Error('Invalid MCP operation format');
        }
      });
    }
  }

  private async prepareContext(params: FunctionParams): Promise<FunctionContext> {
    const context: FunctionContext = {
      ...params.context,
      args: params.args || {},
      console: {
        log: (...args: any[]) => console.log('[Function Tool]', ...args),
        error: (...args: any[]) => console.error('[Function Tool]', ...args),
        warn: (...args: any[]) => console.warn('[Function Tool]', ...args)
      }
    };

    if (this.mcpEnabled) {
      context.mcp = {
        execute: async (toolName: string, args: Record<string, any>) => {
          return this.executeMCPOperation({ toolName, args });
        }
      };
    }

    return context;
  }

  private async executeMCPOperations(operations?: MCPOperation[]): Promise<Record<string, any> | undefined> {
    if (!operations || operations.length === 0) {
      return undefined;
    }

    if (!this.mcpEnabled) {
      throw new Error('MCP operations requested but MCP is not enabled');
    }

    const results: Record<string, any> = {};
    for (const operation of operations) {
      try {
        results[operation.toolName] = await this.executeMCPOperation(operation);
      } catch (error) {
        throw new Error(`Failed to execute MCP operation ${operation.toolName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return results;
  }

  private createSandbox(context: FunctionContext, mcpResults?: Record<string, any>): Record<string, any> {
    return {
      ...context,
      mcpResults,
      setTimeout: (fn: Function, ms: number) => {
        if (ms > this.maxTimeout) {
          throw new Error(`setTimeout duration cannot exceed ${this.maxTimeout}ms`);
        }
        return setTimeout(fn, ms);
      },
      setInterval: (fn: Function, ms: number) => {
        if (ms > this.maxTimeout) {
          throw new Error(`setInterval duration cannot exceed ${this.maxTimeout}ms`);
        }
        return setInterval(fn, ms);
      },
      clearTimeout,
      clearInterval,
      // Add other safe globals as needed
    };
  }

  private executeWithTimeout(code: string, sandbox: Record<string, any>, timeout?: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeoutMs = timeout || this.defaultTimeout;
      let timeoutId: NodeJS.Timeout;

      const wrappedCode = `
        (async function() {
          try {
            with (sandbox) {
              ${code}
            }
          } catch (error) {
            throw error;
          }
        })()
      `;

      const executionPromise = new Promise((innerResolve, innerReject) => {
        try {
          const fn = new Function('sandbox', wrappedCode);
          const result = fn(sandbox);
          innerResolve(result);
        } catch (error) {
          innerReject(error);
        }
      });

      timeoutId = setTimeout(() => {
        reject(new Error(`Function execution timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      executionPromise
        .then(resolve)
        .catch(reject)
        .finally(() => clearTimeout(timeoutId));
    });
  }

  public validateMCPOperation(operation: MCPOperation): boolean {
    if (!super.validateMCPOperation(operation)) {
      return false;
    }

    // Add function-specific MCP validation if needed
    return true;
  }
}
