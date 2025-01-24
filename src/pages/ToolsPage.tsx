import React, { useState } from 'react';
import { Plus, Terminal, Globe, Code } from 'lucide-react';
import { useAppStore } from '../store';
import { ToolCard } from '../components/ToolCard';
import { ToolForm } from '../components/ToolForm';
import { Modal } from '../components/Modal';
import type { Tool } from '../types';

export function ToolsPage() {
  const { 
    tools, 
    addTool, 
    updateTool, 
    deleteTool,
    updateDraftTool,
    saveDraftTool,
    hasDraftTool
  } = useAppStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTool, setEditingTool] = useState<Tool | null>(null);

  const handleCreateTool = (toolData: Omit<Tool, 'id'>) => {
    addTool({
      id: crypto.randomUUID(),
      ...toolData,
    });
    setIsModalOpen(false);
  };

  const handleUpdateTool = (toolData: Omit<Tool, 'id'>) => {
    if (editingTool) {
      updateDraftTool(editingTool.id, toolData);
      setEditingTool(null);
      setIsModalOpen(false);
    }
  };

  const handleSaveTool = (id: string) => {
    saveDraftTool(id);
  };

  const handleEditTool = (id: string) => {
    const tool = tools.find((t) => t.id === id);
    if (tool) {
      setEditingTool(tool);
      setIsModalOpen(true);
    }
  };

  const getToolsByType = () => {
    return {
      function: tools.filter((tool) => tool.type === 'function'),
      api: tools.filter((tool) => tool.type === 'api'),
      cli: tools.filter((tool) => tool.type === 'cli'),
    };
  };

  const toolsByType = getToolsByType();

  return (
    <div className="h-full p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tools</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage your custom tools and integrations
            </p>
          </div>
          <button
            onClick={() => {
              setEditingTool(null);
              setIsModalOpen(true);
            }}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus size={20} />
            <span>New Tool</span>
          </button>
        </div>

        {/* Functions */}
        <div>
          <div className="flex items-center space-x-2 mb-4">
            <Code className="text-purple-500" size={24} />
            <h2 className="text-lg font-semibold text-gray-900">Functions</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {toolsByType.function.map((tool) => (
              <ToolCard
                key={tool.id}
                tool={tool}
                onEdit={handleEditTool}
                onDelete={deleteTool}
                onSave={() => handleSaveTool(tool.id)}
                hasChanges={hasDraftTool(tool.id)}
              />
            ))}
          </div>
        </div>

        {/* APIs */}
        <div>
          <div className="flex items-center space-x-2 mb-4">
            <Globe className="text-blue-500" size={24} />
            <h2 className="text-lg font-semibold text-gray-900">APIs</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {toolsByType.api.map((tool) => (
              <ToolCard
                key={tool.id}
                tool={tool}
                onEdit={handleEditTool}
                onDelete={deleteTool}
                onSave={() => handleSaveTool(tool.id)}
                hasChanges={hasDraftTool(tool.id)}
              />
            ))}
          </div>
        </div>

        {/* CLI Commands */}
        <div>
          <div className="flex items-center space-x-2 mb-4">
            <Terminal className="text-green-500" size={24} />
            <h2 className="text-lg font-semibold text-gray-900">CLI Commands</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {toolsByType.cli.map((tool) => (
              <ToolCard
                key={tool.id}
                tool={tool}
                onEdit={handleEditTool}
                onDelete={deleteTool}
                onSave={() => handleSaveTool(tool.id)}
                hasChanges={hasDraftTool(tool.id)}
              />
            ))}
          </div>
        </div>

        <Modal
          title={editingTool ? 'Edit Tool' : 'Create New Tool'}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingTool(null);
          }}
        >
          <ToolForm
            tool={editingTool || undefined}
            onSubmit={editingTool ? handleUpdateTool : handleCreateTool}
            onCancel={() => {
              setIsModalOpen(false);
              setEditingTool(null);
            }}
          />
        </Modal>
      </div>
    </div>
  );
}
