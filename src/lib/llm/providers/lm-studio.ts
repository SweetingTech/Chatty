import type {
  LLMProvider,
  LLMMessage,
  LLMConfig,
  LLMResponse,
  LLMStreamCallbacks,
  LMStudioConfig
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

class LMStudioProvider implements LLMProvider {
  public id = 'lm-studio';
  public name = 'LM Studio';
  public description = 'Local LM Studio models';
  public capabilities = {
    chat: true,
    completion: true,
    streaming: true,
    functionCalling: true,
    embeddings: false
  };

  private modelConfigs: Record<string, ModelConfig> = {};
  public models: string[] = [];
  public maxTokens = 32768;

  private currentModel: string = '';
  private currentSessionId: string | null = null;
  private onModelUpdate?: (modelId: string) => void;

  constructor(config: LMStudioConfig) {
    this.onModelUpdate = config.onModelUpdate;
  }

  private getModelConfig(model: string | undefined): ModelConfig {
    if (!model || !this.modelConfigs[model]) {
      // If no model specified or invalid model, use the current model
      if (!this.currentModel || !this.modelConfigs[this.currentModel]) {
        throw new Error('No valid model available. Please ensure LM Studio is running and has a model loaded.');
      }
      return this.modelConfigs[this.currentModel];
    }
    return this.modelConfigs[model];
  }

  public async initialize(): Promise<void> {
    try {
      // Fetch available models from FastAPI
      const response = await fetch('http://localhost:8001/lmstudio/models');
      if (response.status < 200 || response.status >= 300) {
        const errorDetails = await response.text();
        throw new Error(`Failed to fetch models. HTTP ${response.status}: ${errorDetails}`);
      }

      const data = await response.json();
      console.log('Raw LM Studio models response:', data);
      if (!data.models || !Array.isArray(data.models)) {
        throw new Error('Invalid response format from LM Studio API');
      }

      // Clear existing configs
      this.modelConfigs = {};
      
      // Update our models list with models from the API
      const apiModels = data.models.map((model: any) => model.id);
      console.log('Available LM Studio models:', apiModels);

      for (const modelId of apiModels) {
        // Add new model with default capabilities
        this.modelConfigs[modelId] = {
          contextWindow: 32768,
          maxOutputTokens: 8192,
          supportsFunctionCalling: true,
          supportsVision: false,
          supportsJson: true,
          supportsReasoning: false
        };
      }
      
      // Update models list
      this.models = Object.keys(this.modelConfigs);

      if (this.models.length === 0) {
        throw new Error('No models available in LM Studio');
      }

      // Set current model to first available if none set
      if (!this.currentModel || !this.modelConfigs[this.currentModel]) {
        this.currentModel = this.models[0];
        console.log('Setting current model to:', this.currentModel);
        
        // Notify store of model update
        if (this.onModelUpdate) {
          this.onModelUpdate(this.currentModel);
        }
      }

    } catch (error) {
      console.error('Failed to initialize LM Studio provider:', error);
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
    const model = config?.model || this.currentModel || this.models[0];
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
      const requestPayload = {
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content,
          name: msg.name || undefined
        })),
        model,
        temperature: config?.temperature ?? 0.7,
        max_tokens: config?.max_tokens ?? modelConfig.maxOutputTokens,
        tools: config?.tools,
        tool_choice: config?.tool_choice,
        response_format: modelConfig.supportsJson && config?.response_format ? config.response_format : undefined
      };

      console.log('LM Studio chat request payload:', requestPayload);

      // Call FastAPI endpoint
      const response = await fetch('http://localhost:8001/llm/lmstudio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      });

      if (response.status < 200 || response.status >= 300) {
        const errorDetails = await response.text();
        throw new Error(`Chat API call failed. HTTP ${response.status}: ${errorDetails}`);
      }

      try {
        const result = await response.json();
        console.log('LM Studio chat response:', result);
        console.log('(Debug) result type:', typeof result);

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

        if (!result.id || !result.model || !result.content) {
          throw new Error('Invalid response format from LM Studio API');
        }

        return {
          id: result.id,
          model: result.model,
          content: result.content,
          finish_reason: result.finish_reason || 'stop',
          usage: result.usage || undefined
        };
      } catch (error) {
        throw new Error(`Failed to parse LM Studio response: ${error}`);
      }
    } catch (error) {
      console.error('LM Studio chat completion failed:', error);
      throw error;
    }
  }

  public async streamChat(
    messages: LLMMessage[],
    callbacks: LLMStreamCallbacks,
    config?: LLMConfig
  ): Promise<void> {
    const model = config?.model || this.currentModel || this.models[0];
    const modelConfig = this.getModelConfig(model);

    try {
      // Call FastAPI streaming endpoint
      const response = await fetch('http://localhost:8001/llm/lmstudio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content,
            name: msg.name || undefined
          })),
          model,
          temperature: config?.temperature ?? 0.7,
          max_tokens: config?.max_tokens ?? modelConfig.maxOutputTokens,
          tools: config?.tools,
          tool_choice: config?.tool_choice,
          response_format: modelConfig.supportsJson && config?.response_format ? config.response_format : undefined,
          stream: true
        }),
      });

      if (response.status < 200 || response.status >= 300) {
        const errorDetails = await response.text();
        throw new Error(`Stream chat API call failed. HTTP ${response.status}: ${errorDetails}`);
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
      console.error('LM Studio stream chat completion failed:', error);
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

export { LMStudioProvider };
