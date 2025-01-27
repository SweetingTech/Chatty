import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useAppStore } from '../store';
import { AgentCard } from '../components/AgentCard';
import { AgentForm } from '../components/AgentForm';
import { Modal } from '../components/Modal';
import type { Agent } from '../types';

export function AgentsPage() {
  const { 
    agents, 
    tools, 
    addAgent, 
    updateAgent, 
    deleteAgent,
    updateDraftAgent,
    saveDraftAgent,
    hasDraftAgent
  } = useAppStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);

  const handleCreateAgent = (agentData: Omit<Agent, 'id'>) => {
    addAgent({
      id: crypto.randomUUID(),
      ...agentData,
    });
    setIsModalOpen(false);
  };

  const handleUpdateAgent = (agentData: Omit<Agent, 'id'>) => {
    if (editingAgent) {
      updateDraftAgent(editingAgent.id, agentData);
      setEditingAgent(null);
      setIsModalOpen(false);
    }
  };

  const handleSaveAgent = async (id: string) => {
    await saveDraftAgent(id);
  };

  const handleEditAgent = (id: string) => {
    const agent = agents.find((a) => a.id === id);
    if (agent) {
      setEditingAgent(agent);
      setIsModalOpen(true);
    }
  };

  const handleStartAgent = (id: string) => {
    updateAgent(id, { config: { status: 'running' } });
  };

  const handleStopAgent = (id: string) => {
    updateAgent(id, { config: { status: 'stopped' } });
  };

  return (
    <div className="h-full p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Agents</h1>
            <p className="mt-1 text-sm text-gray-500">
              Create and manage your AI agents
            </p>
          </div>
          <button
            onClick={() => {
              setEditingAgent(null);
              setIsModalOpen(true);
            }}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus size={20} />
            <span>New Agent</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onStart={handleStartAgent}
              onStop={handleStopAgent}
              onEdit={handleEditAgent}
              onDelete={deleteAgent}
              onSave={() => handleSaveAgent(agent.id)}
              hasChanges={hasDraftAgent(agent.id)}
            />
          ))}
        </div>

        <Modal
          title={editingAgent ? 'Edit Agent' : 'Create New Agent'}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingAgent(null);
          }}
        >
          <AgentForm
            agent={editingAgent || undefined}
            availableTools={tools}
            onSubmit={editingAgent ? handleUpdateAgent : handleCreateAgent}
            onCancel={() => {
              setIsModalOpen(false);
              setEditingAgent(null);
            }}
          />
        </Modal>
      </div>
    </div>
  );
}
