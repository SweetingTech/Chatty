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

  private currentModel: string;
  private currentSessionId: string | null = null;

  constructor(config: OpenAIConfig) {
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
    try {
      // Fetch available models from FastAPI
      const response = await fetch('http://localhost:8001/openai/models');
      const data = await response.json();
      
      // Update our models list with any new models from the API
      const apiModels = data.models.map((model: any) => model.id);
      for (const modelId of apiModels) {
        if (!this.modelConfigs[modelId]) {
          // Add new model with default capabilities based on model name
          const isGPT4 = modelId.includes('gpt-4');
          this.modelConfigs[modelId] = {
            contextWindow: isGPT4 ? 128000 : 16385,
            maxOutputTokens: 4096,
            supportsFunctionCalling: true,
            supportsVision: false,
            supportsJson: true,
            supportsReasoning: false
          };
        }
      }
      
      // Update models list
      this.models = Object.keys(this.modelConfigs);
    } catch (error) {
      console.error('Failed to fetch OpenAI models:', error);
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
      // Add system message for reasoning models if not present
      if (modelConfig.supportsReasoning && !messages.some(m => m.role === 'system')) {
        messages = [
          {
            role: 'system',
            content: 'You are a reasoning model that excels at complex, multi-step tasks. Think carefully and break down problems into steps before responding.'
          },
          ...messages
        ];
      }

      // Convert messages to OpenAI format
      const openaiMessages = this.convertToOpenAIMessages(messages);

      // Call FastAPI endpoint
      const response = await fetch('http://localhost:8001/llm/openai', {
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
      // Add system message for reasoning models if not present
      if (modelConfig.supportsReasoning && !messages.some(m => m.role === 'system')) {
        messages = [
          {
            role: 'system',
            content: 'You are a reasoning model that excels at complex, multi-step tasks. Think carefully and break down problems into steps before responding.'
          },
          ...messages
        ];
      }

      // Convert messages to OpenAI format
      const openaiMessages = this.convertToOpenAIMessages(messages);

      // Call FastAPI streaming endpoint
      const response = await fetch('http://localhost:8001/llm/openai', {
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
