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
    // Build baseUrl from host and port if provided, otherwise use baseUrl
    if (config.host && config.port) {
      this.baseUrl = `http://${config.host}:${config.port}`;
    } else {
      this.baseUrl = config.baseUrl || 'http://localhost:1234';
    }
    if (config.model) {
      this.currentModel = config.model;
    }
  }

  public async initialize(): Promise<void> {
    try {
      console.log('Initializing LM Studio provider...', {
        baseUrl: this.baseUrl,
        currentModel: this.currentModel
      });

      // First check if LM Studio is accessible
      try {
        const healthCheck = await fetch(this.baseUrl);
        console.log('LM Studio health check:', {
          status: healthCheck.status,
          ok: healthCheck.ok
        });
      } catch (error) {
        console.error('LM Studio health check failed:', error);
        throw new Error(`Failed to connect to LM Studio at ${this.baseUrl}`);
      }

      // Get available models
      const models = await this.listModels();
      console.log('Available models:', models);

      if (models.length === 0) {
        throw new Error('No models available in LM Studio. Please load a model first.');
      }

      // If no model is set, use the first available one
      if (!this.currentModel) {
        console.log('No model configured, setting default model:', models[0]);
        await this.setModel(models[0]);
      } else {
        // If model is set, verify it exists
        if (!models.includes(this.currentModel)) {
          console.log('Configured model not found:', this.currentModel);
          console.log('Available models:', models);
          console.log('Using first available model:', models[0]);
          await this.setModel(models[0]);
        } else {
          console.log('Using configured model:', this.currentModel);
          await this.setModel(this.currentModel); // Re-set to verify it works
        }
      }

      // Verify the model is working with a test request
      try {
        const testResponse = await this.chat([{ role: 'user', content: 'test' }]);
        console.log('Model test successful:', testResponse);
      } catch (error) {
        console.error('Model test failed:', error);
        throw new Error('Failed to verify model is working');
      }

    } catch (error) {
      console.error('Failed to initialize LM Studio provider:', error);
      throw error;
    }
  }

  public async listModels(): Promise<string[]> {
    console.log('Fetching models from LM Studio...');
    const response = await fetch(`${this.baseUrl}/v1/models`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to list models:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`Failed to list models: ${response.statusText}. Details: ${errorText}`);
    }

    const data = await response.json();
    console.log('Received models from LM Studio:', data);
    
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

  private async ensureConnection(): Promise<void> {
    try {
      const response = await fetch(this.baseUrl);
      if (!response.ok) {
        throw new Error(`LM Studio is not accessible at ${this.baseUrl}`);
      }
    } catch (error) {
      console.error('Failed to connect to LM Studio:', error);
      throw new Error(`Failed to connect to LM Studio at ${this.baseUrl}`);
    }
  }

  public async chat(messages: LLMMessage[], config?: LLMConfig): Promise<LLMResponse> {
    console.log('LMStudioProvider chat called with:', {
      messages,
      config,
      currentModel: this.currentModel,
      baseUrl: this.baseUrl
    });

    try {
      // Ensure connection is active
      await this.ensureConnection();

      // Verify model is still valid
      const models = await this.listModels();
      if (!models.includes(this.currentModel!)) {
        console.warn('Current model no longer available, reinitializing...');
        await this.initialize();
      }

      const requestBody = {
        messages,
        model: config?.model || this.currentModel,
        temperature: config?.temperature ?? 0.7,
        max_tokens: config?.max_tokens ?? this.maxTokens,
        stream: false,
        // Add parameters to help maintain connection
        keep_alive: true,
        timeout: 30000
      };

      console.log('Sending request to LM Studio:', {
        url: `${this.baseUrl}/v1/chat/completions`,
        body: requestBody
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Connection': 'keep-alive'
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      console.log('Received response from LM Studio:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('LM Studio error response:', errorText);
        throw new Error(`Chat completion failed: ${response.statusText}. Details: ${errorText}`);
      }

      const result = await response.json();
      console.log('Parsed response from LM Studio:', result);

      return {
        id: result.id,
        model: result.model,
        content: result.choices[0].message.content,
        finish_reason: result.choices[0].finish_reason,
        usage: result.usage,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timed out after 30 seconds');
      }
      console.error('Error in LM Studio chat:', error);
      throw error;
    }
  }

  public async streamChat(
    messages: LLMMessage[],
    callbacks: LLMStreamCallbacks,
    config?: LLMConfig
  ): Promise<void> {
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        // Ensure connection before starting stream
        await this.ensureConnection();

        // Verify model is still valid
        const models = await this.listModels();
        if (!models.includes(this.currentModel!)) {
          console.warn('Current model no longer available, reinitializing...');
          await this.initialize();
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Connection': 'keep-alive',
            'Keep-Alive': 'timeout=30, max=100'
          },
          body: JSON.stringify({
            messages,
            model: config?.model || this.currentModel,
            temperature: config?.temperature ?? 0.7,
            max_tokens: config?.max_tokens ?? this.maxTokens,
            stream: true,
            keep_alive: true,
            timeout: 30000
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Stream chat completion failed: ${response.statusText}. Details: ${errorText}`);
        }

        if (!response.body) {
          throw new Error('Response body is null');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              if (buffer.length > 0) {
                // Process any remaining data in buffer
                this.processStreamData(buffer, callbacks);
              }
              callbacks.onDone();
              return; // Successfully completed
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            
            // Keep the last line in buffer if it's incomplete
            buffer = lines.pop() || '';

            // Process complete lines
            for (const line of lines) {
              if (line.trim()) {
                this.processStreamData(line, callbacks);
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      } catch (error) {
        console.error(`Stream attempt ${retryCount + 1} failed:`, error);
        
        if (error instanceof Error && error.name === 'AbortError') {
          callbacks.onError(new Error('Request timed out after 30 seconds'));
          return;
        }

        if (retryCount === maxRetries - 1) {
          // Last attempt failed
          callbacks.onError(error instanceof Error ? error : new Error(String(error)));
          return;
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        retryCount++;
      }
    }
  }

  private processStreamData(line: string, callbacks: LLMStreamCallbacks): void {
    if (!line.trim().startsWith('data:')) return;
    
    const data = line.replace('data:', '').trim();
    if (data === '[DONE]') return;

    try {
      const parsed = JSON.parse(data);
      if (parsed.choices?.[0]?.delta?.content) {
        callbacks.onChunk(parsed.choices[0].delta.content);
      }
    } catch (e) {
      console.warn('Failed to parse SSE message:', line);
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
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        // Ensure connection before starting stream
        await this.ensureConnection();

        // Verify model is still valid
        const models = await this.listModels();
        if (!models.includes(this.currentModel!)) {
          console.warn('Current model no longer available, reinitializing...');
          await this.initialize();
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(`${this.baseUrl}/v1/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Connection': 'keep-alive',
            'Keep-Alive': 'timeout=30, max=100'
          },
          body: JSON.stringify({
            prompt,
            model: config?.model || this.currentModel,
            temperature: config?.temperature ?? 0.7,
            max_tokens: config?.max_tokens ?? this.maxTokens,
            stream: true,
            keep_alive: true,
            timeout: 30000
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Stream completion failed: ${response.statusText}. Details: ${errorText}`);
        }

        if (!response.body) {
          throw new Error('Response body is null');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              if (buffer.length > 0) {
                // Process any remaining data in buffer
                this.processCompletionData(buffer, callbacks);
              }
              callbacks.onDone();
              return; // Successfully completed
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            
            // Keep the last line in buffer if it's incomplete
            buffer = lines.pop() || '';

            // Process complete lines
            for (const line of lines) {
              if (line.trim()) {
                this.processCompletionData(line, callbacks);
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      } catch (error) {
        console.error(`Stream attempt ${retryCount + 1} failed:`, error);
        
        if (error instanceof Error && error.name === 'AbortError') {
          callbacks.onError(new Error('Request timed out after 30 seconds'));
          return;
        }

        if (retryCount === maxRetries - 1) {
          // Last attempt failed
          callbacks.onError(error instanceof Error ? error : new Error(String(error)));
          return;
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        retryCount++;
      }
    }
  }

  private processCompletionData(line: string, callbacks: LLMStreamCallbacks): void {
    if (!line.trim().startsWith('data:')) return;
    
    const data = line.replace('data:', '').trim();
    if (data === '[DONE]') return;

    try {
      const parsed = JSON.parse(data);
      if (parsed.choices?.[0]?.text) {
        callbacks.onChunk(parsed.choices[0].text);
      }
    } catch (e) {
      console.warn('Failed to parse SSE message:', line);
    }
  }
}

export { LMStudioProvider };
