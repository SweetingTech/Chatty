import type {
  LLMProvider,
  LLMProviderFactory,
  OpenAIConfig,
  ClaudeConfig,
  LMStudioConfig,
  DeepseekConfig
} from './types';
import { LLMAuthenticationError } from './errors';
import { OpenAIProvider } from './providers/openai.ts';
import { ClaudeProvider } from './providers/claude.ts';
import { LMStudioProvider } from './providers/lm-studio.ts';
import { DeepseekProvider } from './providers/deepseek.ts';

class LLMProviderRegistry {
  private static instance: LLMProviderRegistry;
  private providers: Map<string, LLMProviderFactory> = new Map();
  private activeProviders: Map<string, LLMProvider> = new Map();

  private constructor() {
    // Register default providers
    this.registerProvider('openai', {
      createProvider: async (config: Record<string, any>) => {
        const openaiConfig = config as OpenAIConfig;
        if (!openaiConfig.apiKey) {
          throw new LLMAuthenticationError('openai', 'OpenAI API key is required');
        }
        return new OpenAIProvider(openaiConfig);
      }
    });

    this.registerProvider('claude', {
      createProvider: async (config: Record<string, any>) => {
        const claudeConfig = config as ClaudeConfig;
        if (!claudeConfig.apiKey) {
          throw new LLMAuthenticationError('claude', 'Claude API key is required');
        }
        return new ClaudeProvider(claudeConfig);
      }
    });

    this.registerProvider('lm-studio', {
      createProvider: async (config: Record<string, any>) => {
        const lmStudioConfig = config as LMStudioConfig;
        if (!lmStudioConfig.baseUrl) {
          throw new LLMAuthenticationError('lm-studio', 'LM Studio base URL is required');
        }
        return new LMStudioProvider(lmStudioConfig);
      }
    });

    this.registerProvider('deepseek', {
      createProvider: async (config: Record<string, any>) => {
        const deepseekConfig = config as DeepseekConfig;
        if (!deepseekConfig.apiKey) {
          throw new LLMAuthenticationError('deepseek', 'Deepseek API key is required');
        }
        return new DeepseekProvider(deepseekConfig);
      }
    });
  }

  public static getInstance(): LLMProviderRegistry {
    if (!LLMProviderRegistry.instance) {
      LLMProviderRegistry.instance = new LLMProviderRegistry();
    }
    return LLMProviderRegistry.instance;
  }

  public registerProvider(id: string, factory: LLMProviderFactory): void {
    this.providers.set(id, factory);
  }

  public async createProvider(id: string, config: Record<string, any>): Promise<LLMProvider> {
    const factory = this.providers.get(id);
    if (!factory) {
      throw new Error(`Provider not found: ${id}`);
    }

    // Check if provider already exists
    let provider = this.activeProviders.get(id);
    if (!provider) {
      provider = await factory.createProvider(config);
      await provider.initialize();
      this.activeProviders.set(id, provider);
    }

    return provider;
  }

  public getProvider(id: string): LLMProvider | undefined {
    return this.activeProviders.get(id);
  }

  public async initializeProvider(id: string): Promise<void> {
    const provider = this.activeProviders.get(id);
    if (provider) {
      await provider.initialize();
    }
  }

  public getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  public getActiveProviders(): string[] {
    return Array.from(this.activeProviders.keys());
  }

  public async destroyProvider(id: string): Promise<void> {
    this.activeProviders.delete(id);
  }

  public async destroyAllProviders(): Promise<void> {
    this.activeProviders.clear();
  }
}

export const llmProviderRegistry = LLMProviderRegistry.getInstance();
