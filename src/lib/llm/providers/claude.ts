import Anthropic from '@anthropic-ai/sdk';
import type {
  LLMProvider,
  LLMMessage,
  LLMConfig,
  LLMResponse,
  LLMStreamCallbacks,
  ClaudeConfig
} from '../types';
import { chromadb } from '../../chromadb';

interface ModelConfig {
  contextWindow: number;
  maxOutputTokens: number;
  supportsCitations: boolean;
  supportsVision: boolean;
}

type ClaudeRole = 'user' | 'assistant';

class ClaudeProvider implements LLMProvider {
  public id = 'claude';
  public name = 'Anthropic Claude';
  public description = 'Anthropic Claude models with advanced reasoning capabilities';
  public capabilities = {
    chat: true,
    completion: true,
    streaming: true,
    functionCalling: true,
    embeddings: false
  };

  private readonly modelConfigs: Record<string, ModelConfig> = {
    // Claude 3.5 Models
    'claude-3-5-sonnet-20241022': {
      contextWindow: 200000,
      maxOutputTokens: 8192,
      supportsCitations: true,
      supportsVision: true
    },
    'claude-3-5-haiku-20241022': {
      contextWindow: 200000,
      maxOutputTokens: 8192,
      supportsCitations: true,
      supportsVision: false
    },
    // Claude 3 Models
    'claude-3-opus-20240229': {
      contextWindow: 200000,
      maxOutputTokens: 4096,
      supportsCitations: false,
      supportsVision: true
    },
    'claude-3-sonnet-20240229': {
      contextWindow: 200000,
      maxOutputTokens: 4096,
      supportsCitations: false,
      supportsVision: true
    },
    'claude-3-haiku-20240307': {
      contextWindow: 200000,
      maxOutputTokens: 4096,
      supportsCitations: false,
      supportsVision: true
    }
  };

  public models = Object.keys(this.modelConfigs);
  public maxTokens = Math.max(...Object.values(this.modelConfigs).map(c => c.contextWindow));

  private client: Anthropic;
  private currentModel: string;
  private currentSessionId: string | null = null;

  constructor(config: ClaudeConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey
    });
    this.currentModel = config.model || 'claude-3-5-sonnet-20241022';
  }

  private getModelConfig(model: string): ModelConfig {
    const config = this.modelConfigs[model];
    if (!config) {
      throw new Error(`Unsupported model: ${model}`);
    }
    return config;
  }

  private convertToClaudeMessages(messages: LLMMessage[]): { role: ClaudeRole; content: string }[] {
    return messages.map(msg => {
      // Convert system messages to user messages for Claude
      const role = msg.role === 'system' ? 'user' : msg.role as ClaudeRole;
      return {
        role,
        content: msg.content
      };
    });
  }

  public async initialize(): Promise<void> {
    // No initialization needed for Claude
    return;
  }

  public async listModels(): Promise<string[]> {
    return this.models;
  }

  public async setModel(modelId: string): Promise<void> {
    if (!this.modelConfigs[modelId]) {
      throw new Error(`Model ${modelId} not found or not supported`);
    }
    this.currentModel = modelId;
  }

  public setSessionId(sessionId: string): void {
    this.currentSessionId = sessionId;
  }

  public async chat(messages: LLMMessage[], config?: LLMConfig): Promise<LLMResponse> {
    const model = config?.model || this.currentModel;
    const modelConfig = this.getModelConfig(model);

    // Check cache if session ID is set
    if (this.currentSessionId) {
      const cachedResponse = await chromadb.getCachedResponse(
        this.currentSessionId,
        JSON.stringify(messages),
        config?.tools,
        config?.mcp
      );
      if (cachedResponse) {
        return JSON.parse(cachedResponse);
      }
    }

    try {
      const claudeMessages = this.convertToClaudeMessages(messages);

      const response = await this.client.messages.create({
        model,
        max_tokens: config?.max_tokens ?? modelConfig.maxOutputTokens,
        temperature: config?.temperature ?? 0.7,
        messages: claudeMessages,
        system: config?.system,
        tools: config?.tools as any, // Type assertion since tools structure might vary
      });

      const result: LLMResponse = {
        id: response.id,
        model: response.model,
        content: response.content[0].type === 'text' ? response.content[0].text : '',
        finish_reason: response.stop_reason || undefined,
        usage: {
          prompt_tokens: response.usage.input_tokens,
          completion_tokens: response.usage.output_tokens,
          total_tokens: response.usage.input_tokens + response.usage.output_tokens
        }
      };

      // Cache response if session ID is set
      if (this.currentSessionId) {
        await chromadb.cacheResponse(
          this.currentSessionId,
          JSON.stringify(messages),
          JSON.stringify(result),
          config?.tools,
          config?.mcp
        );
      }

      return result;
    } catch (error) {
      console.error('Claude chat completion failed:', error);
      throw error;
    }
  }

  public async streamChat(
    messages: LLMMessage[],
    callbacks: LLMStreamCallbacks,
    config?: LLMConfig
  ): Promise<void> {
    const model = config?.model || this.currentModel;
    const modelConfig = this.getModelConfig(model);

    try {
      const claudeMessages = this.convertToClaudeMessages(messages);

      const stream = await this.client.messages.create({
        model,
        max_tokens: config?.max_tokens ?? modelConfig.maxOutputTokens,
        temperature: config?.temperature ?? 0.7,
        messages: claudeMessages,
        system: config?.system,
        tools: config?.tools as any,
        stream: true
      });

      let content = '';

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta') {
          const delta = chunk.delta;
          if ('text' in delta) {
            content += delta.text;
            callbacks.onChunk(delta.text);
          }
        }
      }

      // Cache the complete response if session ID is set
      if (this.currentSessionId) {
        const result: LLMResponse = {
          id: Date.now().toString(),
          model,
          content,
          finish_reason: 'stop'
        };

        await chromadb.cacheResponse(
          this.currentSessionId,
          JSON.stringify(messages),
          JSON.stringify(result),
          config?.tools,
          config?.mcp
        );
      }

      callbacks.onDone();
    } catch (error) {
      console.error('Claude stream chat completion failed:', error);
      callbacks.onError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  public async completion(prompt: string, config?: LLMConfig): Promise<LLMResponse> {
    // Convert single prompt to chat format
    const messages: LLMMessage[] = [{
      role: 'user',
      content: prompt
    }];
    return this.chat(messages, config);
  }

  public async streamCompletion(
    prompt: string,
    callbacks: LLMStreamCallbacks,
    config?: LLMConfig
  ): Promise<void> {
    // Convert single prompt to chat format
    const messages: LLMMessage[] = [{
      role: 'user',
      content: prompt
    }];
    return this.streamChat(messages, callbacks, config);
  }
}

export { ClaudeProvider };
