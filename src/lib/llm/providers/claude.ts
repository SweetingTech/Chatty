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
  supportsFunctionCalling: boolean;
  supportsVision: boolean;
  supportsJson: boolean;
  supportsReasoning: boolean;
}

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
    'claude-3-opus-20240229': {
      contextWindow: 200000,
      maxOutputTokens: 4096,
      supportsFunctionCalling: true,
      supportsVision: true,
      supportsJson: true,
      supportsReasoning: true
    },
    'claude-3-sonnet-20240229': {
      contextWindow: 200000,
      maxOutputTokens: 4096,
      supportsFunctionCalling: true,
      supportsVision: true,
      supportsJson: true,
      supportsReasoning: true
    },
    'claude-3-haiku-20240307': {
      contextWindow: 200000,
      maxOutputTokens: 4096,
      supportsFunctionCalling: true,
      supportsVision: true,
      supportsJson: true,
      supportsReasoning: true
    }
  };

  public models = Object.keys(this.modelConfigs);
  public maxTokens = Math.max(...Object.values(this.modelConfigs).map(c => c.contextWindow));

  private currentModel: string;
  private currentSessionId: string | null = null;

  constructor(config: ClaudeConfig) {
    this.currentModel = config.model || 'claude-3-opus-20240229';
  }

  private getModelConfig(model: string): ModelConfig {
    const config = this.modelConfigs[model];
    if (!config) {
      throw new Error(`Unsupported model: ${model}`);
    }
    return config;
  }

  public async initialize(): Promise<void> {
    try {
      // Fetch available models from FastAPI
      const response = await fetch('http://localhost:8001/anthropic/models');
      
      if (!response.ok) {
        let errorDetails;
        try {
          const errorJson = await response.json();
          errorDetails = errorJson.detail || await response.text();
        } catch {
          errorDetails = await response.text();
        }
        throw new Error(`Failed to fetch Claude models. HTTP ${response.status}: ${errorDetails}`);
      }

      const data = await response.json();
      
      // Validate response structure
      if (!data || !Array.isArray(data.data)) {
        throw new Error('Invalid response format from Claude models endpoint');
      }
      
      // Update our models list with any new models from the API
      const apiModels = data.data.map((model: any) => model.id);
      console.log('Available Claude models:', apiModels);

      for (const modelId of apiModels) {
        if (!this.modelConfigs[modelId]) {
          // Add new model with default capabilities
          this.modelConfigs[modelId] = {
            contextWindow: 200000,
            maxOutputTokens: 4096,
            supportsFunctionCalling: true,
            supportsVision: true,
            supportsJson: true,
            supportsReasoning: true
          };
        }
      }
      
      // Update models list
      this.models = Object.keys(this.modelConfigs);

      if (this.models.length === 0) {
        throw new Error('No models available in Claude');
      }

      console.log('Claude provider initialized with models:', this.models);
    } catch (error) {
      console.error('Failed to initialize Claude provider:', error);
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

  private convertToClaudeMessages(messages: LLMMessage[]): { role: string; content: string }[] {
    return messages.map(msg => {
      // Convert system messages to user messages for Claude
      const role = msg.role === 'system' ? 'user' : msg.role;
      return {
        role,
        content: msg.content
      };
    });
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

      // Convert messages to Claude format
      const claudeMessages = this.convertToClaudeMessages(messages);

      // Prepare request payload
      const payload = {
        messages: claudeMessages,
        model,
        temperature: config?.temperature ?? 0.7,
        max_tokens: config?.max_tokens ?? modelConfig.maxOutputTokens,
        tools: config?.tools,
        tool_choice: config?.tool_choice,
        response_format: modelConfig.supportsJson && config?.response_format ? config.response_format : undefined
      };

      console.log('Claude chat request payload:', payload);

      // Call FastAPI endpoint
      const response = await fetch('http://localhost:8001/llm/claude', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorDetails;
        try {
          const errorJson = await response.json();
          errorDetails = errorJson.detail || await response.text();
        } catch {
          errorDetails = await response.text();
        }
        throw new Error(`Claude API call failed. HTTP ${response.status}: ${errorDetails}`);
      }

      const result = await response.json();
      console.log('Claude chat response:', result);

      // Validate response format
      if (!result.choices?.[0]?.message?.content) {
        throw new Error('Invalid response format from Claude API');
      }

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

      // Convert messages to Claude format
      const claudeMessages = this.convertToClaudeMessages(messages);

      // Call FastAPI streaming endpoint
      const response = await fetch('http://localhost:8001/llm/claude', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: claudeMessages,
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
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                const text = parsed.delta.text;
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
