// Updated ChatAgent to remove direct access to LMStudioProvider's private baseUrl property

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
import { chromadb } from '../chromadb';

export interface ChatAgentConfig {
  defaultProvider: ProviderType;
  llmConfig: LLMConfig | null;
}

export class ChatAgent extends CoreAgent {
  private conversationState: Map<string, ConversationState>;
  private config: ChatAgentConfig;
  private provider: ProviderType;
  private llmProvider: LMStudioProvider | ClaudeProvider | OpenAIProvider | DeepseekProvider;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  /**
   * For debugging, we just return the provider type.
   * Private provider details aren't directly accessible.
   */
  public getProviderInfo(): { provider: ProviderType } {
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

  /**
   * Attempt to retrieve an existing conversation from ChromaDB.
   * Returns a valid ConversationState if found, or null if not found.
   */
  private async hydrateChatSession(conversationId: string): Promise<ConversationState | null> {
    console.log('Attempting to hydrate conversation from ChromaDB:', conversationId);
    try {
      const existingSession = await chromadb.getChatSession(conversationId);
      if (!existingSession) {
        return null;
      }

      const convState: ConversationState = {
        id: existingSession.id,
        messages: existingSession.messages.map((m: ChatMessage) => ({
          ...m,
          conversationId: existingSession.id
        })),
        context: {},
        tools: new Set<string>()
      };
      return convState;
    } catch (error) {
      console.error('Failed to hydrate conversation:', error);
      return null;
    }
  }

  private initializeProvider():
    | LMStudioProvider
    | ClaudeProvider
    | OpenAIProvider
    | DeepseekProvider {
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

      const { conversationId, message } = request.payload as {
        conversationId: string;
        message: string;
      };
      console.log('Processing chat request:', {
        conversationId,
        message,
        provider: this.provider
      });

      // Get or create conversation state
      let state = this.conversationState.get(conversationId);
      if (!state) {
        const hydrated = await this.hydrateChatSession(conversationId);
        if (hydrated) {
          state = hydrated;
        } else {
          state = this.createNewConversation(conversationId);
        }
        this.conversationState.set(conversationId, state);
      }

      // Add user message
      const userMessage: ChatMessage = {
        id: uuidv4(),
        role: 'user',
        content: message,
        timestamp: Date.now(),
        conversationId: state.id
      };
      state.messages.push(userMessage);

      // Convert chat messages to LLM format
      const llmMessages: LLMMessage[] = state.messages.map((msg: ChatMessage) => ({
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

      // Set session ID and get response from LLM provider
      if ('setSessionId' in this.llmProvider) {
        this.llmProvider.setSessionId(conversationId);
      }
      const llmResponse = await this.llmProvider.chat(
        llmMessages,
        this.config.llmConfig || undefined
      );

      console.log('Received LLM response:', llmResponse);

      // Add assistant response
      const assistantMessage: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: llmResponse.content,
        timestamp: Date.now(),
        conversationId: state.id
      };
      state.messages.push(assistantMessage);

      // Save to ChromaDB
      await chromadb.saveChatSession(conversationId, state.messages);

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

  // Initialize
  async initialize(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

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

  public isReady(): boolean {
    return this.isInitialized;
  }

  async updateConfig(config: ChatAgentConfig): Promise<void> {
    this.isInitialized = false;
    this.config = config;
    this.provider = config.defaultProvider;
    this.llmProvider = this.initializeProvider();
    await this.initialize();
  }
}
