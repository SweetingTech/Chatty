export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  name?: string; // For function messages
}

export type ProviderType = 'lm-studio' | 'openai' | 'claude' | 'deepseek' | 'none';

export interface LLMConfig {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  // Tool use support
  tools?: any[];
  tool_choice?: {
    type: 'auto' | 'any' | 'tool';
    name?: string;
  };
  // MCP support
  mcp?: any[];
  // System prompt support
  system?: string;
  // Response format support
  response_format?: {
    type: 'text' | 'json_object';
  };
  // Citations support (for Claude 3.5)
  citations?: {
    enabled: boolean;
  };
}

export interface LLMResponse {
  id: string;
  model: string;
  content: string;
  finish_reason?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  citations?: {
    text: string;
    document: string;
    location: {
      start: number;
      end: number;
    };
  }[];
}

export interface LLMStreamCallbacks {
  onChunk: (chunk: string) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}

export interface LLMProvider {
  id: string;
  name: string;
  description: string;
  capabilities: {
    chat: boolean;
    completion: boolean;
    streaming: boolean;
    functionCalling: boolean;
    embeddings: boolean;
  };
  models: string[];
  maxTokens: number;
  initialize: () => Promise<void>;
  listModels: () => Promise<string[]>;
  setModel: (modelId: string) => Promise<void>;
  chat: (messages: LLMMessage[], config?: LLMConfig) => Promise<LLMResponse>;
  streamChat?: (
    messages: LLMMessage[],
    callbacks: LLMStreamCallbacks,
    config?: LLMConfig
  ) => Promise<void>;
  completion?: (
    prompt: string,
    config?: LLMConfig
  ) => Promise<LLMResponse>;
  streamCompletion?: (
    prompt: string,
    callbacks: LLMStreamCallbacks,
    config?: LLMConfig
  ) => Promise<void>;
}

export interface LLMProviderFactory {
  createProvider: (config: Record<string, any>) => Promise<LLMProvider>;
}

// Provider-specific types

export interface OpenAIConfig extends LLMConfig {
  provider: ProviderType;
  enabled: boolean;
  isDefault?: boolean;
  apiKey: string;
  organization?: string;
}

export interface ClaudeConfig extends LLMConfig {
  provider: ProviderType;
  enabled: boolean;
  isDefault?: boolean;
  apiKey: string;
}

export interface LMStudioConfig extends LLMConfig {
  provider: ProviderType;
  enabled: boolean;
  isDefault?: boolean;
  baseUrl?: string;
  host?: string;
  port?: string | number;
  onModelUpdate?: (modelId: string) => void;
}

export interface DeepseekConfig extends LLMConfig {
  provider: ProviderType;
  enabled: boolean;
  isDefault?: boolean;
  apiKey: string;
  baseUrl?: string;
}

// Common response format for all providers
export interface CommonLLMResponse {
  content: string;
  metadata: {
    provider: string;
    model: string;
    finish_reason?: string;
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
  };
}

// Error types
export class LLMProviderError extends Error {
  constructor(
    message: string,
    public provider: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'LLMProviderError';
  }
}

export class LLMAuthenticationError extends LLMProviderError {
  constructor(provider: string, message: string) {
    super(message, provider, 'auth_error');
    this.name = 'LLMAuthenticationError';
  }
}

export class LLMRateLimitError extends LLMProviderError {
  constructor(provider: string, message: string) {
    super(message, provider, 'rate_limit');
    this.name = 'LLMRateLimitError';
  }
}

export class LLMContextLengthError extends LLMProviderError {
  constructor(provider: string, message: string) {
    super(message, provider, 'context_length');
    this.name = 'LLMContextLengthError';
  }
}
