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
