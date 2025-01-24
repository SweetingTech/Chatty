import React, { useState } from 'react';
import { useAppStore } from '../store';
import type { Agent } from '../types';
import { AgentForm } from '../components/AgentForm';
import { SaveButton } from '../components/SaveButton';

export function ChatConfigPage() {
  const { agents, tools, updateDraftAgent, saveDraftAgent, hasDraftAgent } = useAppStore();
  const chatAgent = agents.find(a => a.type === 'chat');

  const handleUpdateChatAgent = (agentData: Omit<Agent, 'id'>) => {
    if (chatAgent) {
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
            Customize the behavior and personality of your chat agent
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <AgentForm
            agent={chatAgent}
            availableTools={tools}
            onSubmit={handleUpdateChatAgent}
            onCancel={() => {}}
          />
          <div className="mt-6">
            <SaveButton 
              onSave={() => chatAgent && saveDraftAgent(chatAgent.id)}
              hasChanges={chatAgent ? hasDraftAgent(chatAgent.id) : false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
