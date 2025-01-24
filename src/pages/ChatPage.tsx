import React, { useEffect, useRef } from 'react';
import { useAppStore } from '../store';
import { ChatSidebar } from '../components/ChatSidebar';
import { ChatMessage } from '../components/ChatMessage';
import { ChatInput } from '../components/ChatInput';
import { chromadb } from '../lib/chromadb';
import { mcp } from '../lib/mcp';
import { setupRootMCPs } from '../lib/mcp/providers';

export function ChatPage() {
  const {
    currentChatId,
    chatSessions,
    addChatSession,
    updateChatSession,
    settings,
  } = useAppStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mcpRef = useRef<ReturnType<typeof setupRootMCPs>>();

  useEffect(() => {
    chromadb.init().catch(console.error);
    // Initialize root MCPs
    mcpRef.current = setupRootMCPs();
  }, []);

  const currentChat = chatSessions.find((s) => s.id === currentChatId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentChat?.messages]);

  const handleSendMessage = async (content: string, files?: File[]) => {
    if (!currentChatId) {
      const newSession = {
        id: crypto.randomUUID(),
        title: content.slice(0, 30) + (content.length > 30 ? '...' : ''),
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      addChatSession(newSession);
    }

    const newMessage = {
      id: crypto.randomUUID(),
      role: 'user' as const,
      content,
      timestamp: Date.now(),
    };

    const updatedMessages = [...(currentChat?.messages || []), newMessage];

    updateChatSession(currentChatId!, {
      messages: updatedMessages,
      updatedAt: Date.now(),
    });

    // Save to ChromaDB
    await chromadb.saveChatSession(currentChatId!, updatedMessages);

    // Route through appropriate MCP based on settings
    let selectedMCP = mcpRef.current?.lmStudioMCP;
    if (settings.openaiKey) {
      selectedMCP = mcpRef.current?.openAIMCP;
    } else if (settings.claudeKey) {
      selectedMCP = mcpRef.current?.claudeMCP;
    }

    if (selectedMCP) {
      // Add to MCP context
      mcp.updateContext(selectedMCP.id, [...selectedMCP.context, content]);
      
      // Get response through MCP
      const mcpResponse = mcp.addResponse(selectedMCP.id, 'This is a placeholder response. LLM integration coming soon...');

      // Update chat with MCP response
      const llmResponse = {
        id: crypto.randomUUID(),
        role: 'assistant' as const,
        content: mcpResponse.content,
        timestamp: Date.now(),
      };

      updateChatSession(currentChatId!, {
        messages: [...updatedMessages, llmResponse],
        updatedAt: Date.now(),
      });
    }
  };

  if (!currentChatId) {
    return (
      <div className="h-full flex">
        <ChatSidebar />
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
      </div>
    );
  }

  return (
    <div className="h-full flex">
      <ChatSidebar />
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto">
          {currentChat?.messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
          <div ref={messagesEndRef} />
        </div>
        <ChatInput
          onSendMessage={handleSendMessage}
          disabled={!settings.lmStudioUrl && !settings.openaiKey && !settings.claudeKey}
        />
      </div>
    </div>
  );
}