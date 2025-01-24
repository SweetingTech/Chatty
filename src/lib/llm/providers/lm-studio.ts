import type {
  LLMProvider,
  LLMMessage,
  LLMConfig,
  LLMResponse,
  LLMStreamCallbacks,
  LMStudioConfig
} from '../types';

class LMStudioProvider implements LLMProvider {
  public id = 'lm-studio';
  public name = 'LM Studio';
  public description = 'Local LLM inference using LM Studio';
  public capabilities = {
    chat: true,
    completion: true,
    streaming: true,
    functionCalling: false,
    embeddings: false
  };
  public models: string[] = [];
  public maxTokens = 4096;

  private baseUrl: string;
  private currentModel: string | null = null;

  constructor(config: LMStudioConfig) {
    this.baseUrl = config.baseUrl;
    if (config.model) {
      this.currentModel = config.model;
    }
  }

  public async initialize(): Promise<void> {
    try {
      const models = await this.listModels();
      if (models.length > 0 && !this.currentModel) {
        await this.setModel(models[0]);
      }
    } catch (error) {
      console.error('Failed to initialize LM Studio provider:', error);
      throw error;
    }
  }

  public async listModels(): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}/v1/models`);
    if (!response.ok) {
      throw new Error(`Failed to list models: ${response.statusText}`);
    }
    const data = await response.json();
    this.models = data.data.map((model: any) => model.id);
    return this.models;
  }

  public async setModel(modelId: string): Promise<void> {
    if (!this.models.includes(modelId)) {
      const models = await this.listModels();
      if (!models.includes(modelId)) {
        throw new Error(`Model ${modelId} not found`);
      }
    }
    this.currentModel = modelId;
  }

  public async chat(messages: LLMMessage[], config?: LLMConfig): Promise<LLMResponse> {
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        model: config?.model || this.currentModel,
        temperature: config?.temperature ?? 0.7,
        max_tokens: config?.max_tokens ?? this.maxTokens,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Chat completion failed: ${response.statusText}`);
    }

    const result = await response.json();
    return {
      id: result.id,
      model: result.model,
      content: result.choices[0].message.content,
      finish_reason: result.choices[0].finish_reason,
      usage: result.usage,
    };
  }

  public async streamChat(
    messages: LLMMessage[],
    callbacks: LLMStreamCallbacks,
    config?: LLMConfig
  ): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages,
          model: config?.model || this.currentModel,
          temperature: config?.temperature ?? 0.7,
          max_tokens: config?.max_tokens ?? this.maxTokens,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Stream chat completion failed: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          callbacks.onDone();
          break;
        }

        const chunk = decoder.decode(value);
        const lines = chunk
          .split('\n')
          .filter(line => line.trim().startsWith('data: '))
          .map(line => line.replace('data: ', '').trim())
          .filter(line => line !== '[DONE]' && line.length > 0);

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.choices?.[0]?.delta?.content) {
              callbacks.onChunk(parsed.choices[0].delta.content);
            }
          } catch (e) {
            console.warn('Failed to parse SSE message:', line);
          }
        }
      }
    } catch (error) {
      callbacks.onError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  public async completion(prompt: string, config?: LLMConfig): Promise<LLMResponse> {
    const response = await fetch(`${this.baseUrl}/v1/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        model: config?.model || this.currentModel,
        temperature: config?.temperature ?? 0.7,
        max_tokens: config?.max_tokens ?? this.maxTokens,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Completion failed: ${response.statusText}`);
    }

    const result = await response.json();
    return {
      id: result.id,
      model: result.model,
      content: result.choices[0].text,
      finish_reason: result.choices[0].finish_reason,
      usage: result.usage,
    };
  }

  public async streamCompletion(
    prompt: string,
    callbacks: LLMStreamCallbacks,
    config?: LLMConfig
  ): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          model: config?.model || this.currentModel,
          temperature: config?.temperature ?? 0.7,
          max_tokens: config?.max_tokens ?? this.maxTokens,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Stream completion failed: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          callbacks.onDone();
          break;
        }

        const chunk = decoder.decode(value);
        const lines = chunk
          .split('\n')
          .filter(line => line.trim().startsWith('data: '))
          .map(line => line.replace('data: ', '').trim())
          .filter(line => line !== '[DONE]' && line.length > 0);

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.choices?.[0]?.text) {
              callbacks.onChunk(parsed.choices[0].text);
            }
          } catch (e) {
            console.warn('Failed to parse SSE message:', line);
          }
        }
      }
    } catch (error) {
      callbacks.onError(error instanceof Error ? error : new Error(String(error)));
    }
  }
}

export { LMStudioProvider };
