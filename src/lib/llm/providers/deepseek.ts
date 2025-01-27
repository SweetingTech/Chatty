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

  private currentModel: string;
  private currentSessionId: string | null = null;

  constructor(config: DeepseekConfig) {
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
    try {
      // Fetch available models from FastAPI
      const response = await fetch('http://localhost:8001/deepseek/models');
      const data = await response.json();
      
      // Update our models list with any new models from the API
      const apiModels = data.models.map((model: any) => model.id);
      for (const modelId of apiModels) {
        if (!this.modelConfigs[modelId]) {
          // Add new model with default capabilities
          this.modelConfigs[modelId] = {
            contextWindow: 32768,
            maxOutputTokens: 8192,
            supportsFunctionCalling: true,
            supportsVision: false,
            supportsJson: true
          };
        }
      }
      
      // Update models list
      this.models = Object.keys(this.modelConfigs);
    } catch (error) {
      console.error('Failed to fetch Deepseek models:', error);
      throw error;
    }
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
      // Convert messages to OpenAI format
      const openaiMessages = this.convertToOpenAIMessages(messages);

      // Call FastAPI endpoint
      const response = await fetch('http://localhost:8001/llm/deepseek', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: openaiMessages,
          model,
          temperature: config?.temperature ?? 0.7,
          max_tokens: config?.max_tokens ?? modelConfig.maxOutputTokens,
          tools: config?.tools,
          tool_choice: config?.tool_choice,
          response_format: modelConfig.supportsJson && config?.response_format ? config.response_format : undefined
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      const result = await response.json();

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
      // Convert messages to OpenAI format
      const openaiMessages = this.convertToOpenAIMessages(messages);

      // Call FastAPI streaming endpoint
      const response = await fetch('http://localhost:8001/llm/deepseek', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: openaiMessages,
          model,
          temperature: config?.temperature ?? 0.7,
          max_tokens: config?.max_tokens ?? modelConfig.maxOutputTokens,
          tools: config?.tools,
          tool_choice: config?.tool_choice,
          response_format: modelConfig.supportsJson && config?.response_format ? config.response_format : undefined,
          stream: true
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      let content = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Decode the chunk and add it to our buffer
        buffer += new TextDecoder().decode(value);

        // Process any complete lines in the buffer
        while (buffer.includes('\n')) {
          const lineEnd = buffer.indexOf('\n');
          const line = buffer.slice(0, lineEnd).trim();
          buffer = buffer.slice(lineEnd + 1);

          if (line.startsWith('data: ')) {
            const data = line.slice(5).trim();
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const text = parsed.choices[0]?.delta?.content || '';
              if (text) {
                content += text;
                callbacks.onChunk(text);
              }
            } catch (e) {
              console.warn('Failed to parse streaming response:', e);
            }
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
