import { BaseTool } from './base';
import { MCPOperation } from '../../types/mcp';
import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';

export class APITool extends BaseTool {
  private baseUrl: string;
  private defaultConfig: AxiosRequestConfig;

  constructor(
    name: string,
    description: string,
    baseUrl: string,
    config: AxiosRequestConfig = {},
    mcpClient?: any
  ) {
    super(name, description, mcpClient);
    this.baseUrl = baseUrl;
    this.defaultConfig = config;
  }

  async execute(params: {
    endpoint: string;
    method?: string;
    data?: unknown;
    config?: AxiosRequestConfig;
  }): Promise<unknown> {
    const { endpoint, method = 'GET', data, config } = params;
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const response: AxiosResponse = await axios({
        url,
        method,
        data,
        ...this.defaultConfig,
        ...config
      });
      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        throw new Error(`API request failed: ${axiosError.response?.status} - ${axiosError.message}`);
      }
      if (error instanceof Error) {
        throw new Error(`API request failed: ${error.message}`);
      }
      throw new Error('API request failed: Unknown error');
    }
  }

  validateMCPOperation(operation: MCPOperation): boolean {
    if (!super.validateMCPOperation(operation)) {
      return false;
    }

    // Additional validation specific to API tools
    if (!operation.args || typeof operation.args !== 'object') {
      throw new Error('Invalid MCP operation: args must be an object');
    }

    if (!operation.args.endpoint || typeof operation.args.endpoint !== 'string') {
      throw new Error('Invalid MCP operation: endpoint must be a string');
    }

    return true;
  }
}
