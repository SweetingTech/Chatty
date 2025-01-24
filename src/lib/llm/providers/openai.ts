import OpenAI from 'openai';
import type {
  LLMProvider,
  LLMMessage,
  LLMConfig,
  LLMResponse,
  LLMStreamCallbacks,
  OpenAIConfig
} from '../types';
import { chromadb } from '../../chromadb';

interface ModelConfig {
  contextWindow: number;
  maxOutputTokens: number;
  supportsFunctionCalling: boolean;
  supportsVision: boolean;
  supportsJson: boolean;
  supportsReasoning: boolean;
}

type OpenAIRole = 'system' | 'user' | 'assistant' | 'function';

class OpenAIProvider implements LLMProvider {
  public id = 'openai';
  public name = 'OpenAI';
  public description = 'OpenAI GPT and O1 models';
  public capabilities = {
    chat: true,
    completion: true,
    streaming: true,
    functionCalling: true,
    embeddings: false
  };

  private readonly modelConfigs: Record<string, ModelConfig> = {
    // O1 Models
    'o1': {
      contextWindow: 200000,
      maxOutputTokens: 100000,
      supportsFunctionCalling: true,
      supportsVision: true,
      supportsJson: true,
      supportsReasoning: true
    },
    'o1-mini': {
      contextWindow: 128000,
      maxOutputTokens: 65536,
      supportsFunctionCalling: true,
      supportsVision: true,
      supportsJson: true,
      supportsReasoning: true
    },
    'o1-preview': {
      contextWindow: 128000,
      maxOutputTokens: 32768,
      supportsFunctionCalling: true,
      supportsVision: true,
      supportsJson: true,
      supportsReasoning: true
    },
    // GPT-4 Turbo
    'gpt-4-turbo': {
      contextWindow: 128000,
      maxOutputTokens: 4096,
      supportsFunctionCalling: true,
      supportsVision: false,
      supportsJson: true,
      supportsReasoning: false
    },
    'gpt-4-0125-preview': {
      contextWindow: 128000,
      maxOutputTokens: 4096,
      supportsFunctionCalling: true,
      supportsVision: false,
      supportsJson: true,
      supportsReasoning: false
    },
    'gpt-4-1106-preview': {
      contextWindow: 128000,
      maxOutputTokens: 4096,
      supportsFunctionCalling: true,
      supportsVision: false,
      supportsJson: true,
      supportsReasoning: false
    },
    // GPT-4
    'gpt-4': {
      contextWindow: 8192,
      maxOutputTokens: 8192,
      supportsFunctionCalling: true,
      supportsVision: false,
      supportsJson: false,
      supportsReasoning: false
    },
    'gpt-4-0613': {
      contextWindow: 8192,
      maxOutputTokens: 8192,
      supportsFunctionCalling: true,
      supportsVision: false,
      supportsJson: false,
      supportsReasoning: false
    },
    // GPT-3.5 Turbo
    'gpt-3.5-turbo-0125': {
      contextWindow: 16385,
      maxOutputTokens: 4096,
      supportsFunctionCalling: true,
      supportsVision: false,
      supportsJson: true,
      supportsReasoning: false
    },
    'gpt-3.5-turbo-1106': {
      contextWindow: 16385,
      maxOutputTokens: 4096,
      supportsFunctionCalling: true,
      supportsVision: false,
      supportsJson: true,
      supportsReasoning: false
    },
    'gpt-3.5-turbo-instruct': {
      contextWindow: 4096,
      maxOutputTokens: 4096,
      supportsFunctionCalling: false,
      supportsVision: false,
      supportsJson: false,
      supportsReasoning: false
    }
  };

  public models = Object.keys(this.modelConfigs);
  public maxTokens = Math.max(...Object.values(this.modelConfigs).map(c => c.contextWindow));

  private client: OpenAI;
  private currentModel: string;
  private currentSessionId: string | null = null;

  constructor(config: OpenAIConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      organization: config.organization
    });
    this.currentModel = config.model || 'gpt-3.5-turbo-0125';
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
      const role = msg.role as OpenAIRole;
      if (role === 'function') {
        return {
          role,
          content: msg.content,
          name: msg.name || 'function'
        } as OpenAI.Chat.ChatCompletionFunctionMessageParam;
      }
      return {
        role,
        content: msg.content
      } as OpenAI.Chat.ChatCompletionUserMessageParam | OpenAI.Chat.ChatCompletionSystemMessageParam | OpenAI.Chat.ChatCompletionAssistantMessageParam;
    });
  }

  public async initialize(): Promise<void> {
    // No initialization needed for OpenAI
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

      // Add system message for O1 models if not present
      if (modelConfig.supportsReasoning && !messages.some(m => m.role === 'system')) {
        openaiMessages.unshift({
          role: 'system',
          content: 'You are a reasoning model that excels at complex, multi-step tasks. Think carefully and break down problems into steps before responding.'
        });
      }

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
      console.error('OpenAI chat completion failed:', error);
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

      // Add system message for O1 models if not present
      if (modelConfig.supportsReasoning && !messages.some(m => m.role === 'system')) {
        openaiMessages.unshift({
          role: 'system',
          content: 'You are a reasoning model that excels at complex, multi-step tasks. Think carefully and break down problems into steps before responding.'
        });
      }

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
      console.error('OpenAI stream chat completion failed:', error);
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

export { OpenAIProvider };
