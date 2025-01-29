//Updated by: D
import React from 'react';
import { useAppStore } from '../store';
import type { Agent } from '../types';
import { ChatAgentForm } from '../components/ChatAgentForm';
import { SaveButton } from '../components/SaveButton';

export function ChatConfigPage() {
  const { 
    agents, 
    updateDraftAgent, 
    saveDraftAgent, 
    hasDraftAgent,
    setDefaultProvider 
  } = useAppStore();
  const chatAgent = agents.find(a => a.type === 'chat');

  const handleUpdateChatAgent = (agentData: Omit<Agent, 'id'>) => {
    if (chatAgent) {
      // When provider changes, update default provider in settings
      if (agentData.llmConfig.provider !== chatAgent.llmConfig.provider) {
        setDefaultProvider(agentData.llmConfig.provider);
      }
      updateDraftAgent(chatAgent.id, agentData);
    }
  };

  if (!chatAgent) {
    return (
      <div className="h-full p-8 bg-gray-50">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-gray-900">Chat Agent Not Found</h2>
          <p className="mt-2 text-gray-600">
            Please create a chat agent first from the Agents page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full p-8 bg-gray-50">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Chat Agent Configuration</h1>
          <p className="mt-1 text-sm text-gray-500">
            Customize your chat agent's name, personality, and language model
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <ChatAgentForm
            agent={chatAgent}
            onSubmit={handleUpdateChatAgent}
          />
          <div className="mt-6">
            <SaveButton 
              onSave={async () => chatAgent && await saveDraftAgent(chatAgent.id)}
              hasChanges={chatAgent ? hasDraftAgent(chatAgent.id) : false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
