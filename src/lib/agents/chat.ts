import { BaseAgent } from './base';
import { AgentRequest, AgentResponse } from '../../types/agent';
import { ChatMessage, ConversationState } from '../../types/chat';
import { Tool } from '../tools/base';
import { MCPClient } from '../mcp';

export class ChatAgent extends BaseAgent {
  private conversationState: Map<string, ConversationState>;

  constructor(mcpClient: MCPClient) {
    super(mcpClient);
    this.conversationState = new Map();
  }

  protected async processRequest(request: AgentRequest): Promise<AgentResponse> {
    try {
      const { conversationId, message } = request.payload as ChatMessage;
      
      // Get or create conversation state
      let state = this.conversationState.get(conversationId);
      if (!state) {
        state = this.createNewConversation(conversationId);
        this.conversationState.set(conversationId, state);
      }

      // Execute MCP operation if present
      let operationResult;
      if (request.operation) {
        operationResult = await this.executeMCPOperation(request.operation);
        state.context.lastOperation = {
          name: request.operation.toolName,
          result: operationResult
        };
      }

      // Process message through conversation pipeline
      const response = await this.processMessage(state, message);

      return {
        success: true,
        message: response,
        data: {
          conversation: state,
          operationResult
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  private createNewConversation(conversationId: string): ConversationState {
    return {
      id: conversationId,
      messages: [],
      context: {},
      tools: new Set<string>()
    };
  }

  private async processMessage(state: ConversationState, message: string): Promise<string> {
    try {
      // Add message to conversation history
      const userMessage: ChatMessage = {
        conversationId: state.id,
        message,
        timestamp: new Date().toISOString()
      };
      state.messages.push(userMessage);

      // Process message through registered tools
      const toolResponses = await this.processThroughTools(state, message);
      
      // Generate response
      const response = await this.generateResponse(state, toolResponses);
      
      // Add assistant response to conversation history
      const assistantMessage: ChatMessage = {
        conversationId: state.id,
        message: response,
        timestamp: new Date().toISOString()
      };
      state.messages.push(assistantMessage);

      return response;
    } catch (error) {
      throw new Error(`Failed to process message: ${error}`);
    }
  }

  private async processThroughTools(state: ConversationState, message: string): Promise<string[]> {
    const responses: string[] = [];
    
    try {
      // Process message through each registered tool
      for (const toolName of state.tools) {
        const tool = this.getTool(toolName);
        if (tool) {
          try {
            const response = await tool.execute({
              message,
              context: state.context
            });
            
            if (response) {
              responses.push(response);
              
              // Update context with tool result
              state.context[toolName] = {
                lastResponse: response,
                timestamp: new Date().toISOString()
              };
            }
          } catch (toolError) {
            console.error(`Tool ${toolName} execution failed:`, toolError);
          }
        }
      }
      
      return responses;
    } catch (error) {
      throw new Error(`Failed to process tools: ${error}`);
    }
  }

  private async generateResponse(state: ConversationState, toolResponses: string[]): Promise<string> {
    try {
      if (toolResponses.length === 0) {
        // If no tool responses, check context for last operation
        const lastOp = state.context.lastOperation;
        if (lastOp && lastOp.result) {
          return `Operation ${lastOp.name} completed successfully: ${JSON.stringify(lastOp.result)}`;
        }
        return 'I need more information to help with that.';
      }

      // Combine tool responses into a coherent message
      return toolResponses
        .filter(response => response && response.trim())
        .join('\n\n');
    } catch (error) {
      throw new Error(`Failed to generate response: ${error}`);
    }
  }
}
