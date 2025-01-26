import { CoreAgent } from './core';
import { AgentRequest } from '../../types/agent';
import { ChatMessage, ConversationState } from '../../types/chat';
import { 
  LLMConfig, 
  LLMMessage,
  LMStudioConfig,
  ClaudeConfig,
  OpenAIConfig,
  DeepseekConfig,
  ProviderType
} from '../llm/types';
import { LMStudioProvider } from '../llm/providers/lm-studio';
import { ClaudeProvider } from '../llm/providers/claude';
import { OpenAIProvider } from '../llm/providers/openai';
import { DeepseekProvider } from '../llm/providers/deepseek';
import { v4 as uuidv4 } from 'uuid';

export interface ChatAgentConfig {
  defaultProvider: ProviderType;
  llmConfig: LLMConfig | null;
}

export class ChatAgent extends CoreAgent {
  private conversationState: Map<string, ConversationState>;
  private config: ChatAgentConfig;
  private provider: ProviderType;
  private llmProvider: LMStudioProvider | ClaudeProvider | OpenAIProvider | DeepseekProvider;
  private isInitialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  // Public methods for debugging
  public getProviderInfo(): { provider: ProviderType; baseUrl?: string } {
    if (this.provider === 'lm-studio') {
      return {
        provider: this.provider,
        baseUrl: (this.llmProvider as LMStudioProvider)['baseUrl']
      };
    }
    return { provider: this.provider };
  }

  public getConfigInfo(): { defaultProvider: ProviderType; model?: string } {
    return {
      defaultProvider: this.config.defaultProvider,
      model: this.config.llmConfig?.model
    };
  }

  constructor(config: ChatAgentConfig) {
    super();
    this.conversationState = new Map();
    this.config = config;
    this.provider = config.defaultProvider;
    this.llmProvider = this.initializeProvider();
  }

  private initializeProvider(): LMStudioProvider | ClaudeProvider | OpenAIProvider | DeepseekProvider {
    const { defaultProvider, llmConfig } = this.config;

    switch (defaultProvider) {
      case 'lm-studio': {
        const config: LMStudioConfig = {
          provider: defaultProvider,
          enabled: true,
          baseUrl: (llmConfig as LMStudioConfig)?.baseUrl || 'http://localhost:1234',
          model: llmConfig?.model
        };
        return new LMStudioProvider(config);
      }
      case 'claude': {
        const config: ClaudeConfig = {
          provider: defaultProvider,
          enabled: true,
          apiKey: (llmConfig as ClaudeConfig)?.apiKey || '',
          model: llmConfig?.model
        };
        return new ClaudeProvider(config);
      }
      case 'openai': {
        const config: OpenAIConfig = {
          provider: defaultProvider,
          enabled: true,
          apiKey: (llmConfig as OpenAIConfig)?.apiKey || '',
          model: llmConfig?.model,
          organization: (llmConfig as OpenAIConfig)?.organization
        };
        return new OpenAIProvider(config);
      }
      case 'deepseek': {
        const config: DeepseekConfig = {
          provider: defaultProvider,
          enabled: true,
          apiKey: (llmConfig as DeepseekConfig)?.apiKey || '',
          model: llmConfig?.model,
          baseUrl: (llmConfig as DeepseekConfig)?.baseUrl
        };
        return new DeepseekProvider(config);
      }
      default:
        throw new Error(`Unsupported provider: ${defaultProvider}`);
    }
  }

  private createNewConversation(conversationId: string): ConversationState {
    return {
      id: conversationId,
      messages: [],
      context: {},
      tools: new Set<string>()
    };
  }

  protected async processRequest(request: AgentRequest): Promise<any> {
    try {
      console.log('ChatAgent processRequest called with:', request);
      
      if (!request.payload) {
        throw new Error('Chat request must contain a payload');
      }

      const { conversationId, message } = request.payload as { conversationId: string; message: string };
      console.log('Processing chat request:', { conversationId, message, provider: this.provider });
      
      // Get or create conversation state
      let state = this.conversationState.get(conversationId);
      if (!state) {
        state = this.createNewConversation(conversationId);
        this.conversationState.set(conversationId, state);
      }

      // Add user message to conversation history
      const userMessage: ChatMessage = {
        id: uuidv4(),
        role: 'user',
        content: message,
        timestamp: Date.now(),
        conversationId: state.id
      };
      state.messages.push(userMessage);

      // Convert chat messages to LLM format
      const llmMessages: LLMMessage[] = state.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      console.log('Sending messages to LLM:', { 
        messages: llmMessages,
        provider: this.provider,
        config: this.config,
        llmConfig: this.config.llmConfig
      });

      if (!this.llmProvider) {
        throw new Error('LLM provider not initialized');
      }

      // Get response from LLM provider
      const llmResponse = await this.llmProvider.chat(llmMessages, this.config.llmConfig || undefined);
      
      console.log('Received LLM response:', llmResponse);

      // Add assistant response to conversation history
      const assistantMessage: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: llmResponse.content,
        timestamp: Date.now(),
        conversationId: state.id
      };
      state.messages.push(assistantMessage);

      return {
        conversation: state,
        model: llmResponse.model,
        usage: llmResponse.usage
      };

    } catch (error) {
      console.error('Error processing chat request:', error);
      throw error;
    }
  }

  // Initialize the provider
  async initialize(): Promise<void> {
    // Return existing initialization if in progress
    if (this.initPromise) {
      return this.initPromise;
    }

    // Start new initialization
    this.initPromise = (async () => {
      try {
        await this.llmProvider.initialize();
        this.isInitialized = true;
      } catch (error) {
        this.isInitialized = false;
        throw error;
      } finally {
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  // Check if agent is initialized
  public isReady(): boolean {
    return this.isInitialized;
  }

  // Update the configuration and reinitialize the provider
  async updateConfig(config: ChatAgentConfig): Promise<void> {
    this.isInitialized = false;
    this.config = config;
    this.provider = config.defaultProvider;
    this.llmProvider = this.initializeProvider();
    await this.initialize();
  }
}
