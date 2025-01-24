import OpenAI from 'openai';
import type {
  LLMProvider,
  LLMMessage,
  LLMConfig,
  LLMResponse,
  LLMStreamCallbacks,
  DeepseekConfig
} from '../types';
import { chromadb } from '../../chromadb';

interface ModelConfig {
  contextWindow: number;
  maxOutputTokens: number;
  supportsFunctionCalling: boolean;
  supportsVision: boolean;
  supportsJson: boolean;
}

class DeepseekProvider implements LLMProvider {
  public id = 'deepseek';
  public name = 'Deepseek';
  public description = 'Deepseek Code and Chat models';
  public capabilities = {
    chat: true,
    completion: true,
    streaming: true,
    functionCalling: true,
    embeddings: false
  };

  private readonly modelConfigs: Record<string, ModelConfig> = {
    // Code Models
    'deepseek-coder-33b-instruct': {
      contextWindow: 32768,
      maxOutputTokens: 8192,
      supportsFunctionCalling: true,
      supportsVision: false,
      supportsJson: true
    },
    'deepseek-coder-6.7b-instruct': {
      contextWindow: 16384,
      maxOutputTokens: 4096,
      supportsFunctionCalling: true,
      supportsVision: false,
      supportsJson: true
    },
    // Chat Models
    'deepseek-chat': {
      contextWindow: 32768,
      maxOutputTokens: 8192,
      supportsFunctionCalling: true,
      supportsVision: false,
      supportsJson: true
    },
    'deepseek-chat-medium': {
      contextWindow: 16384,
      maxOutputTokens: 4096,
      supportsFunctionCalling: true,
      supportsVision: false,
      supportsJson: true
    }
  };

  public models = Object.keys(this.modelConfigs);
  public maxTokens = Math.max(...Object.values(this.modelConfigs).map(c => c.contextWindow));

  private client: OpenAI;
  private currentModel: string;
  private currentSessionId: string | null = null;

  constructor(config: DeepseekConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || 'https://api.deepseek.com/v1'
    });
    this.currentModel = config.model || 'deepseek-chat';
  }

  private getModelConfig(model: string): ModelConfig {
    const config = this.modelConfigs[model];
    if (!config) {
      throw new Error(`Unsupported model: ${model}`);
    }
    return config;
  }

  private convertToOpenAIMessages(messages: LLMMessage[]): OpenAI.Chat.ChatCompletionMessageParam[] {
    return messages.map(msg => {
      if (msg.role === 'function') {
        return {
          role: msg.role,
          content: msg.content,
          name: msg.name || 'function'
        } as OpenAI.Chat.ChatCompletionFunctionMessageParam;
      }
      return {
        role: msg.role,
        content: msg.content
      } as OpenAI.Chat.ChatCompletionUserMessageParam | OpenAI.Chat.ChatCompletionSystemMessageParam | OpenAI.Chat.ChatCompletionAssistantMessageParam;
    });
  }

  public async initialize(): Promise<void> {
    // No initialization needed for Deepseek
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
      const openaiMessages = this.convertToOpenAIMessages(messages);

      const response = await this.client.chat.completions.create({
        model,
        messages: openaiMessages,
        temperature: config?.temperature ?? 0.7,
        max_tokens: config?.max_tokens ?? modelConfig.maxOutputTokens,
        tools: config?.tools as any,
        tool_choice: config?.tool_choice as any,
        response_format: modelConfig.supportsJson && config?.response_format ? {
          type: config.response_format.type as 'text' | 'json_object'
        } : undefined
      });

      const result: LLMResponse = {
        id: response.id,
        model: response.model,
        content: response.choices[0].message.content || '',
        finish_reason: response.choices[0].finish_reason || undefined,
        usage: response.usage ? {
          prompt_tokens: response.usage.prompt_tokens,
          completion_tokens: response.usage.completion_tokens,
          total_tokens: response.usage.total_tokens
        } : undefined
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
      console.error('Deepseek chat completion failed:', error);
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
      const openaiMessages = this.convertToOpenAIMessages(messages);

      const stream = await this.client.chat.completions.create({
        model,
        messages: openaiMessages,
        temperature: config?.temperature ?? 0.7,
        max_tokens: config?.max_tokens ?? modelConfig.maxOutputTokens,
        tools: config?.tools as any,
        tool_choice: config?.tool_choice as any,
        response_format: modelConfig.supportsJson && config?.response_format ? {
          type: config.response_format.type as 'text' | 'json_object'
        } : undefined,
        stream: true
      });

      let content = '';

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          content += delta;
          callbacks.onChunk(delta);
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
      console.error('Deepseek stream chat completion failed:', error);
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

export { DeepseekProvider };
