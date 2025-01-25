import { BaseTool } from '../base';
import { MCPClient, MCPOperation } from '../../../types/mcp';

interface APIConfig {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  timeout?: number;
  mcpAuth?: string;
  mcpCache?: string;
  mcpProxy?: string;
}

interface APIParams {
  config: APIConfig;
  body?: any;
  query?: Record<string, string>;
  mcpOperations?: MCPOperation[];
}

interface APIResult {
  success: boolean;
  status?: number;
  data?: any;
  error?: string;
  headers?: Record<string, string>;
  mcpResults?: Record<string, any>;
}

interface APIRequest extends RequestInit {
  url: string;
}

export class APITool extends BaseTool {
  private readonly defaultTimeout = 30000; // 30 seconds
  private readonly maxTimeout = 300000; // 5 minutes

  constructor(mcpClient?: MCPClient) {
    super('api', 'Execute API requests with MCP support', mcpClient);
  }

  async execute(params: APIParams): Promise<APIResult> {
    try {
      // Validate parameters
      this.validateParams(params);

      // Handle MCP operations (auth, cache, proxy)
      const mcpResults = await this.handleMCPOperations(params);

      // Prepare request
      const request = await this.prepareRequest(params, mcpResults);

      // Execute request with timeout
      const response = await this.executeRequest(request, params.config.timeout);

      // Process response
      const result = await this.processResponse(response);

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

  private validateParams(params: APIParams): void {
    if (!params.config) {
      throw new Error('API configuration is required');
    }

    if (!params.config.endpoint) {
      throw new Error('API endpoint is required');
    }

    if (!params.config.method) {
      throw new Error('API method is required');
    }

    if (params.config.timeout) {
      if (typeof params.config.timeout !== 'number' || params.config.timeout < 0 || params.config.timeout > this.maxTimeout) {
        throw new Error(`Timeout must be between 0 and ${this.maxTimeout}ms`);
      }
    }

    if (params.config.mcpAuth && !this.mcpEnabled) {
      throw new Error('MCP auth requested but MCP is not enabled');
    }

    if (params.config.mcpCache && !this.mcpEnabled) {
      throw new Error('MCP cache requested but MCP is not enabled');
    }

    if (params.config.mcpProxy && !this.mcpEnabled) {
      throw new Error('MCP proxy requested but MCP is not enabled');
    }
  }

  private async handleMCPOperations(params: APIParams): Promise<Record<string, any>> {
    const results: Record<string, any> = {};

    if (this.mcpEnabled) {
      // Handle authentication
      if (params.config.mcpAuth) {
        results.auth = await this.executeMCPOperation({
          toolName: params.config.mcpAuth,
          args: { endpoint: params.config.endpoint }
        });
      }

      // Handle caching
      if (params.config.mcpCache) {
        const cacheKey = this.generateCacheKey(params);
        results.cache = await this.executeMCPOperation({
          toolName: params.config.mcpCache,
          args: { key: cacheKey }
        });

        if (results.cache.hit) {
          return { cache: results.cache };
        }
      }

      // Handle proxy configuration
      if (params.config.mcpProxy) {
        results.proxy = await this.executeMCPOperation({
          toolName: params.config.mcpProxy,
          args: { endpoint: params.config.endpoint }
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

  private async prepareRequest(params: APIParams, mcpResults: Record<string, any>): Promise<APIRequest> {
    const headers = new Headers(params.config.headers || {});

    // Add auth headers if provided by MCP
    if (mcpResults.auth?.headers) {
      Object.entries(mcpResults.auth.headers).forEach(([key, value]) => {
        headers.set(key, value as string);
      });
    }

    // Prepare URL with query parameters
    let url = params.config.endpoint;
    if (params.query) {
      const queryString = new URLSearchParams(params.query).toString();
      url += (url.includes('?') ? '&' : '?') + queryString;
    }

    // Use proxy URL if provided by MCP
    if (mcpResults.proxy?.url) {
      url = mcpResults.proxy.url;
    }

    return {
      url,
      method: params.config.method,
      headers,
      body: params.body ? JSON.stringify(params.body) : undefined
    };
  }

  private async executeRequest(request: APIRequest, timeout?: number): Promise<Response> {
    const controller = new AbortController();
    const timeoutMs = timeout || this.defaultTimeout;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const { url, ...init } = request;
      const response = await fetch(url, {
        ...init,
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async processResponse(response: Response): Promise<Partial<APIResult>> {
    const result: Partial<APIResult> = {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries())
    };

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      result.data = await response.json();
    } else {
      result.data = await response.text();
    }

    return result;
  }

  private generateCacheKey(params: APIParams): string {
    const parts = [
      params.config.method,
      params.config.endpoint,
      params.query ? new URLSearchParams(params.query).toString() : '',
      params.body ? JSON.stringify(params.body) : ''
    ];
    return parts.join('|');
  }

  public validateMCPOperation(operation: MCPOperation): boolean {
    if (!super.validateMCPOperation(operation)) {
      return false;
    }

    // Validate API-specific MCP operations
    if (operation.toolName.startsWith('api-')) {
      if (!operation.args.endpoint) {
        throw new Error('API MCP operations require an endpoint');
      }
    }

    return true;
  }
}
