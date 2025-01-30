import { nanoid } from 'nanoid';
import type { Agent, Tool } from '../../types';
import type { LlamaAgentState, LlamaAgentResponse, LlamaToolCall } from './types';
import { llamaRegistry } from './LlamaRegistry';

export class LlamaAgent {
  private agent: Agent;
  private tools: Tool[];
  private state?: LlamaAgentState;

  constructor(agent: Agent) {
    this.agent = agent;
    this.tools = agent.tools
      .map(toolId => llamaRegistry.getTool(toolId))
      .filter((tool): tool is Tool => !!tool);
  }

  public async initialize(): Promise<void> {
    this.state = llamaRegistry.createState(this.agent.id);
  }

  public async process(input: string): Promise<LlamaAgentResponse> {
    if (!this.state) {
      throw new Error('Agent not initialized');
    }

    try {
      // Process input based on agent type and configuration
      switch (this.agent.type) {
        case 'chat':
          return this.handleChatInput(input);
        case 'router':
          return this.handleRoutingInput(input);
        case 'builder':
          return this.handleBuilderInput(input);
        default:
          return this.handleCustomInput(input);
      }
    } catch (error) {
      return {
        content: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async handleChatInput(input: string): Promise<LlamaAgentResponse> {
    // Implement chat processing logic
    // This is a placeholder implementation
    return {
      content: `Processed chat input: ${input}`,
      tool_calls: [],
      context_updates: {
        variables: {
          last_input: input,
        },
      },
    };
  }

  private async handleRoutingInput(input: string): Promise<LlamaAgentResponse> {
    // Implement routing logic
    // This is a placeholder implementation
    return {
      content: `Routing input: ${input}`,
      context_updates: {
        variables: {
          route: 'default',
        },
      },
    };
  }

  private async handleBuilderInput(input: string): Promise<LlamaAgentResponse> {
    // Implement builder logic
    // This is a placeholder implementation
    return {
      content: `Building from input: ${input}`,
      context_updates: {
        variables: {
          build_plan: {},
        },
      },
    };
  }

  private async handleCustomInput(input: string): Promise<LlamaAgentResponse> {
    // Implement custom input handling
    // This is a placeholder implementation
    return {
      content: `Custom processing: ${input}`,
    };
  }

  private async executeTool(tool: Tool, input: unknown): Promise<LlamaToolCall> {
    const toolCall: LlamaToolCall = {
      tool_id: tool.id,
      input,
      output: null,
      timestamp: Date.now(),
    };

    try {
      // Execute tool based on type
      switch (tool.type) {
        case 'function':
          toolCall.output = await this.executeFunction(tool, input);
          break;
        case 'api':
          toolCall.output = await this.executeAPI(tool, input);
          break;
        case 'cli':
          toolCall.output = await this.executeCLI(tool, input);
          break;
      }
    } catch (error) {
      toolCall.error = error instanceof Error ? error.message : 'Tool execution failed';
    }

    // Update agent state with tool call
    if (this.state) {
      this.state.tool_calls.push(toolCall);
      llamaRegistry.updateState(this.state.id, { tool_calls: this.state.tool_calls });
    }

    return toolCall;
  }

  private async executeFunction(tool: Tool, input: unknown): Promise<unknown> {
    if (!tool.config.function) {
      throw new Error('Function configuration missing');
    }

    try {
      // Validate input against function parameters
      const params = tool.config.parameters as Record<string, unknown>;
      const validatedInput = this.validateFunctionInput(input, params);

      // Execute the function
      const func = new Function(...Object.keys(params), tool.config.function as string);
      return func(...Object.values(validatedInput));
    } catch (error) {
      throw new Error(`Function execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async executeAPI(tool: Tool, input: unknown): Promise<unknown> {
    if (!tool.config.endpoint) {
      throw new Error('API endpoint configuration missing');
    }

    const config = tool.config;
    const endpoint = config.endpoint as string;
    const method = (config.method as string || 'GET').toUpperCase();
    const headers = config.headers as Record<string, string> || {};
    const timeout = config.timeout as number || 30000;

    try {
      // Build request URL with query parameters for GET requests
      let url = endpoint;
      if (method === 'GET' && typeof input === 'object' && input !== null) {
        const params = new URLSearchParams();
        Object.entries(input as Record<string, string>).forEach(([key, value]) => {
          params.append(key, value);
        });
        url += `?${params.toString()}`;
      }

      // Make the API request
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: method !== 'GET' ? JSON.stringify(input) : undefined,
        signal: AbortSignal.timeout(timeout),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      // Parse response based on content type
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return response.json();
      } else {
        return response.text();
      }
    } catch (error) {
      throw new Error(`API execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async executeCLI(tool: Tool, input: unknown): Promise<unknown> {
    if (!tool.config.command) {
      throw new Error('CLI command configuration missing');
    }

    try {
      // Validate and sanitize command input
      const command = this.sanitizeCommand(tool.config.command as string);
      const args = this.sanitizeCommandArgs(input);

      // Execute command
      const { exec } = await import('child_process');
      
      return new Promise((resolve, reject) => {
        exec(`${command} ${args.join(' ')}`, {
          timeout: tool.config.timeout as number || 30000,
          maxBuffer: 1024 * 1024, // 1MB output buffer
        }, (error, stdout, stderr) => {
          if (error) {
            reject(new Error(`Command execution failed: ${error.message}`));
            return;
          }

          resolve({
            stdout: stdout.trim(),
            stderr: stderr.trim(),
          });
        });
      });
    } catch (error) {
      throw new Error(`CLI execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private validateFunctionInput(input: unknown, params: Record<string, unknown>): Record<string, unknown> {
    if (typeof input !== 'object' || input === null) {
      throw new Error('Invalid function input: must be an object');
    }

    const validatedInput: Record<string, unknown> = {};
    const inputObj = input as Record<string, unknown>;

    // Validate each parameter
    for (const [key, schema] of Object.entries(params)) {
      if (!(key in inputObj)) {
        throw new Error(`Missing required parameter: ${key}`);
      }

      // Basic type validation
      const value = inputObj[key];
      const expectedType = (schema as { type: string }).type;
      if (typeof value !== expectedType) {
        throw new Error(`Invalid type for parameter ${key}: expected ${expectedType}, got ${typeof value}`);
      }

      validatedInput[key] = value;
    }

    return validatedInput;
  }

  private sanitizeCommand(command: string): string {
    // Basic command sanitization
    const sanitized = command
      .replace(/[;&|`$]/g, '') // Remove shell metacharacters
      .trim();

    // Whitelist of allowed commands
    const allowedCommands = ['node', 'npm', 'python', 'python3'];
    const commandName = sanitized.split(' ')[0];

    if (!allowedCommands.includes(commandName)) {
      throw new Error(`Command not allowed: ${commandName}`);
    }

    return sanitized;
  }

  private sanitizeCommandArgs(input: unknown): string[] {
    if (!Array.isArray(input)) {
      throw new Error('Command arguments must be an array');
    }

    return input.map(arg => {
      if (typeof arg !== 'string') {
        throw new Error('Command arguments must be strings');
      }

      // Sanitize individual arguments
      return arg
        .replace(/[;&|`$]/g, '') // Remove shell metacharacters
        .trim()
        .replace(/\s+/g, ' '); // Normalize whitespace
    });
  }

  public getState(): LlamaAgentState | undefined {
    return this.state;
  }
}