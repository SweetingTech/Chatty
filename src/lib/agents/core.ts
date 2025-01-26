import { AgentRequest, AgentResponse } from '../../types/agent';

export abstract class CoreAgent {
  protected abstract processRequest(request: AgentRequest): Promise<AgentResponse>;

  async handleRequest(request: AgentRequest): Promise<AgentResponse> {
    try {
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
}
