import React, { useEffect, useRef } from 'react';
import { useAppStore } from '../store';
import { ChatSidebar } from '../components/ChatSidebar';
import { ChatMessage } from '../components/ChatMessage';
import { ChatInput } from '../components/ChatInput';
import { ChatAgent, type ChatAgentConfig } from '../lib/agents/chat';
import type { ProviderType } from '../types';
import { weaviateService } from '../lib/weaviate';

// Internal component with all the logic
function ChatPageComponent() {
  const {
    currentChatId,
    chatSessions,
    addChatSession,
    updateChatSession,
    settings,
    llmConfigs,
  } = useAppStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatAgentRef = useRef<ChatAgent>();

  // Track initialization state
  const initializingRef = useRef(false);
  const mountedRef = useRef(false);
  const [initError, setInitError] = React.useState<string | null>(null);

  // Initialize and update chat agent when configs change
  useEffect(() => {
    // Skip initialization if already mounted (for StrictMode double-mount)
    if (mountedRef.current) return;
    mountedRef.current = true;

    const initializeAgent = async () => {
      // Prevent multiple simultaneous initializations
      if (initializingRef.current) {
        console.log('Already initializing chat agent, skipping...');
        return;
      }

      try {
        initializingRef.current = true;
        setInitError(null);

        const defaultProviderEntry = Object.entries(llmConfigs).find(
          ([_, config]) => config.isDefault
        );

        if (!defaultProviderEntry || !llmConfigs[defaultProviderEntry[0] as ProviderType].enabled) {
          throw new Error('No default provider set or provider is disabled');
        }

        const defaultProvider = defaultProviderEntry[0] as ProviderType;
        console.log('Initializing chat agent with provider:', defaultProvider);

        // Only create new agent if we don't have one or if the provider changed
        if (!chatAgentRef.current || chatAgentRef.current.getProviderInfo().provider !== defaultProvider) {
          console.log('Creating new chat agent instance...');
          
          const config: ChatAgentConfig = {
            defaultProvider,
            llmConfig: llmConfigs[defaultProvider]
          };

          const agent = new ChatAgent(config);
          await agent.initialize();
          chatAgentRef.current = agent;

          const providerInfo = agent.getProviderInfo();
          const configInfo = agent.getConfigInfo();
          console.log('Chat agent successfully initialized:', {
            provider: defaultProvider,
            providerInfo,
            configInfo
          });
        } else {
          console.log('Reusing existing chat agent instance');
        }
      } catch (error) {
        console.error('Failed to initialize chat agent:', error);
        setInitError(error instanceof Error ? error.message : 'Failed to initialize chat agent');
        chatAgentRef.current = undefined;
      } finally {
        initializingRef.current = false;
      }
    };

    initializeAgent();

    // Cleanup function - only clear on actual unmount
    return () => {
      if (!mountedRef.current) return; // Skip cleanup if not actually mounted
      console.log('Component unmounting, cleaning up chat agent');
      chatAgentRef.current = undefined;
      initializingRef.current = false;
      mountedRef.current = false;
    };
  }, [llmConfigs]); // Only depend on llmConfigs

  const currentChat = chatSessions.find((s) => s.id === currentChatId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentChat?.messages]);

  const handleSendMessage = async (content: string, files?: File[]) => {
    if (!chatAgentRef.current) {
      console.error('Chat agent not initialized');
      return;
    }

    // Create new session if none exists
    let sessionId = currentChatId;
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      const newSession = {
        id: sessionId,
        title: content.slice(0, 30) + (content.length > 30 ? '...' : ''),
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      addChatSession(newSession);
    }

    // Handle file uploads first if any
    let fileReferences = [];
    if (files && files.length > 0) {
      for (const file of files) {
        const content = await file.text();
        try {
          // Store in Weaviate with chat session reference
          await weaviateService.addDocument({
            title: file.name,
            content,
            metadata: {
              chatId: sessionId,
              type: 'chat_upload',
              timestamp: Date.now(),
              createdAt: Date.now()
            }
          });
          fileReferences.push({
            name: file.name,
            type: file.type,
            uploadedAt: Date.now()
          });
        } catch (error) {
          console.error('Failed to store file in Weaviate:', error);
        }
      }
    }

    // Add user message with file references
    const userMessage = {
      id: crypto.randomUUID(),
      role: 'user' as const,
      content,
      timestamp: Date.now(),
      conversationId: sessionId,
      files: fileReferences
    };
    updateChatSession(sessionId, {
      messages: [...(currentChat?.messages || []), userMessage],
      updatedAt: Date.now(),
    });

    try {
      // Process message through chat agent
      console.log('Sending message to agent:', { 
        sessionId, 
        content,
        providerInfo: chatAgentRef.current.getProviderInfo(),
        configInfo: chatAgentRef.current.getConfigInfo()
      });

      const agentResponse = await chatAgentRef.current.handleRequest({
        payload: {
          conversationId: sessionId,
          message: content,
        }
      });

      console.log('Received agent response:', agentResponse);

      if (agentResponse.success) {
        // Update chat session with the conversation from the agent
        updateChatSession(sessionId, {
          messages: agentResponse.data.conversation.messages,
          updatedAt: Date.now(),
        });
      } else {
        // Add error message to the chat
        const errorMessage = {
          id: crypto.randomUUID(),
          role: 'assistant' as const,
          content: `Error: ${agentResponse.error || 'Failed to process message'}`,
          timestamp: Date.now(),
          conversationId: sessionId,
        };
        updateChatSession(sessionId, {
          messages: [...(currentChat?.messages || []), errorMessage],
          updatedAt: Date.now(),
        });
        console.error('Agent processing failed:', agentResponse.error);
      }
    } catch (error) {
      // Add error message to the chat
      const errorMessage = {
        id: crypto.randomUUID(),
        role: 'assistant' as const,
        content: `Error: ${error instanceof Error ? error.message : 'Failed to process message'}`,
        timestamp: Date.now(),
        conversationId: sessionId,
      };
      updateChatSession(sessionId, {
        messages: [...(currentChat?.messages || []), errorMessage],
        updatedAt: Date.now(),
      });
      console.error('Failed to process message through agent:', error);

      // Clean up Weaviate documents if message processing failed
      if (fileReferences.length > 0) {
        try {
          await weaviateService.deleteDocumentsByChatId(sessionId);
        } catch (cleanupError) {
          console.error('Failed to clean up Weaviate documents:', cleanupError);
        }
      }
    }
  };

  return (
    <div className="h-full flex">
      <ChatSidebar />
      <div className="flex-1 flex flex-col">
        {currentChatId ? (
          <>
            <div className="flex-1 overflow-y-auto">
              {currentChat?.messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
              <div ref={messagesEndRef} />
            </div>
            <ChatInput
              onSendMessage={handleSendMessage}
              disabled={!chatAgentRef.current}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-700">
                Welcome to Multi-LLM Chat
              </h2>
              <p className="mt-2 text-gray-500">
                Select a chat from the sidebar or start a new one
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Export memoized version to prevent unnecessary re-renders
export const ChatPage = React.memo(ChatPageComponent);
