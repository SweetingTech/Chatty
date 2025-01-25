import { BaseTool } from '../base';
import { MCPClient, MCPOperation } from '../../../types/mcp';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface CLIConfig {
  command: string;
  args?: string[];
  cwd?: string;
  timeout?: number;
  env?: Record<string, string>;
  mcpExecutor?: string;
}

interface CLIParams {
  config: CLIConfig;
  mcpOperations?: MCPOperation[];
}

interface CLIResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  error?: string;
  code?: number;
  signal?: string;
  mcpResults?: Record<string, any>;
}

export class CLITool extends BaseTool {
  private readonly defaultTimeout = 30000; // 30 seconds
  private readonly maxTimeout = 300000; // 5 minutes
  private readonly allowedCommands: Set<string>;

  constructor(mcpClient?: MCPClient, allowedCommands: string[] = []) {
    super('cli', 'Execute CLI commands with MCP support', mcpClient);
    this.allowedCommands = new Set(allowedCommands);
  }

  async execute(params: CLIParams): Promise<CLIResult> {
    try {
      // Validate parameters
      this.validateParams(params);

      // Handle MCP operations
      const mcpResults = await this.handleMCPOperations(params);

      // Prepare command
      const command = this.prepareCommand(params, mcpResults);

      // Execute command with timeout
      const result = await this.executeCommand(command, params.config.timeout);

      return {
        success: true,
        ...result,
        mcpResults
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  private validateParams(params: CLIParams): void {
    if (!params.config) {
      throw new Error('CLI configuration is required');
    }

    if (!params.config.command) {
      throw new Error('Command is required');
    }

    // Check if command is allowed
    const baseCommand = params.config.command.split(' ')[0];
    if (this.allowedCommands.size > 0 && !this.allowedCommands.has(baseCommand)) {
      throw new Error(`Command '${baseCommand}' is not allowed`);
    }

    if (params.config.timeout) {
      if (typeof params.config.timeout !== 'number' || params.config.timeout < 0 || params.config.timeout > this.maxTimeout) {
        throw new Error(`Timeout must be between 0 and ${this.maxTimeout}ms`);
      }
    }

    if (params.config.mcpExecutor && !this.mcpEnabled) {
      throw new Error('MCP executor requested but MCP is not enabled');
    }
  }

  private async handleMCPOperations(params: CLIParams): Promise<Record<string, any>> {
    const results: Record<string, any> = {};

    if (this.mcpEnabled) {
      // Handle MCP executor if configured
      if (params.config.mcpExecutor) {
        results.executor = await this.executeMCPOperation({
          toolName: params.config.mcpExecutor,
          args: {
            command: params.config.command,
            args: params.config.args
          }
        });
      }

      // Execute additional MCP operations
      if (params.mcpOperations) {
        for (const operation of params.mcpOperations) {
          results[operation.toolName] = await this.executeMCPOperation(operation);
        }
      }
    }

    return results;
  }

  private prepareCommand(params: CLIParams, mcpResults: Record<string, any>): string {
    let command = params.config.command;

    // Add arguments if provided
    if (params.config.args && params.config.args.length > 0) {
      command += ' ' + params.config.args.map(arg => this.escapeArgument(arg)).join(' ');
    }

    // Use MCP executor command if provided
    if (mcpResults.executor?.command) {
      command = mcpResults.executor.command;
    }

    return command;
  }

  private async executeCommand(command: string, timeout?: number): Promise<Partial<CLIResult>> {
    const timeoutMs = timeout || this.defaultTimeout;

    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: timeoutMs,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 // 1MB buffer
      });

      return {
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        code: 0
      };
    } catch (error) {
      if (error instanceof Error) {
        const execError = error as any;
        if (execError.killed && execError.signal === 'SIGTERM') {
          throw new Error(`Command execution timed out after ${timeoutMs}ms`);
        }

        return {
          stdout: execError.stdout?.trim(),
          stderr: execError.stderr?.trim(),
          code: execError.code,
          signal: execError.signal
        };
      }
      throw error;
    }
  }

  private escapeArgument(arg: string): string {
    // Basic argument escaping for shell safety
    if (/[\s"'$&|<>()`;]/.test(arg)) {
      return `"${arg.replace(/"/g, '\\"')}"`;
    }
    return arg;
  }

  public validateMCPOperation(operation: MCPOperation): boolean {
    if (!super.validateMCPOperation(operation)) {
      return false;
    }

    // Validate CLI-specific MCP operations
    if (operation.toolName.startsWith('cli-')) {
      if (!operation.args.command) {
        throw new Error('CLI MCP operations require a command');
      }
    }

    return true;
  }

  // Add command to allowed list
  public allowCommand(command: string): void {
    this.allowedCommands.add(command);
  }

  // Remove command from allowed list
  public disallowCommand(command: string): void {
    this.allowedCommands.delete(command);
  }

  // Check if command is allowed
  public isCommandAllowed(command: string): boolean {
    if (this.allowedCommands.size === 0) {
      return true; // All commands allowed if no restrictions set
    }
    const baseCommand = command.split(' ')[0];
    return this.allowedCommands.has(baseCommand);
  }
}
