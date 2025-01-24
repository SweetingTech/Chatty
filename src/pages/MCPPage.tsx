import React, { useState, useEffect } from 'react';
import { Plus, Trash2, GitMerge, Network, Settings2, ArrowRight, Check } from 'lucide-react';
import { mcp, type ModelContext, type ModelResponse } from '../lib/mcp';
import { Modal } from '../components/Modal';
import { SaveButton } from '../components/SaveButton';
import { useAppStore } from '../store';
import { addAPItoMCP, removeAPIFromMCP, getBaseAPIs } from '../lib/mcp/providers';
import type { API } from '../types';

interface MCPFormData {
  model: string;
  initialContext: string;
  metadata: string;
  selectedApis: string[];
}

export function MCPPage() {
  const [contexts, setContexts] = useState<ModelContext[]>(mcp.getAllContexts());
  const [selectedContexts, setSelectedContexts] = useState<Set<string>>(new Set());
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingContext, setEditingContext] = useState<ModelContext | null>(null);
  const [apis, setApis] = useState<API[]>(getBaseAPIs());
  const [formData, setFormData] = useState<MCPFormData>({
    model: '',
    initialContext: '',
    metadata: '{}',
    selectedApis: [],
  });
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'contexts' | 'responses'>('contexts');
  const { 
    settings,
    updateDraftMCP,
    saveDraftMCP,
    hasDraftMCP
  } = useAppStore();

  useEffect(() => {
    refreshContexts();
  }, []);

  const refreshContexts = () => {
    setContexts(mcp.getAllContexts());
  };

  const handleCreateContext = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const metadata = JSON.parse(formData.metadata);
      const context = mcp.createContext(formData.model, [formData.initialContext], metadata);
      
      // Add selected APIs
      formData.selectedApis.forEach((apiId: string) => {
        const api = apis.find(a => a.id === apiId);
        if (api) {
          addAPItoMCP(context.id, api);
        }
      });

      refreshContexts();
      setIsCreateModalOpen(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create context');
    }
  };

  const handleUpdateContext = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContext) return;

    try {
      const metadata = JSON.parse(formData.metadata);
      updateDraftMCP(editingContext.id, {
        context: [formData.initialContext],
        metadata
      });
      
      // Update APIs
      const currentApis = editingContext.metadata.apis || [];
      const apisToRemove = currentApis.filter(
        (apiId: string) => !formData.selectedApis.includes(apiId)
      );
      const apisToAdd = formData.selectedApis.filter(
        (apiId: string) => !currentApis.includes(apiId)
      );

      apisToRemove.forEach((apiId: string) => removeAPIFromMCP(editingContext.id, apiId));
      apisToAdd.forEach((apiId: string) => {
        const api = apis.find(a => a.id === apiId);
        if (api) {
          addAPItoMCP(editingContext.id, api);
        }
      });

      refreshContexts();
      setIsEditModalOpen(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update context');
    }
  };

  const handleDeleteContext = (id: string) => {
    try {
      mcp.deleteContext(id);
      refreshContexts();
      setSelectedContexts((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete context');
    }
  };

  const handleMergeContexts = () => {
    try {
      mcp.mergeContexts(Array.from(selectedContexts));
      refreshContexts();
      setSelectedContexts(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to merge contexts');
    }
  };

  const handleEditContext = (context: ModelContext) => {
    setEditingContext(context);
    setFormData({
      model: context.model,
      initialContext: context.context.join('\n'),
      metadata: JSON.stringify(context.metadata, null, 2),
      selectedApis: context.metadata.apis || [],
    });
    setIsEditModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      model: '',
      initialContext: '',
      metadata: '{}',
      selectedApis: [],
    });
    setError(null);
    setEditingContext(null);
  };

  const toggleContextSelection = (id: string) => {
    setSelectedContexts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const renderForm = (onSubmit: (e: React.FormEvent) => void) => (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700">Model</label>
        <select
          value={formData.model}
          onChange={(e) => setFormData({ ...formData, model: e.target.value })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          required
        >
          <option value="">Select a model</option>
          {settings.lmStudioUrl && <option value="lm-studio">LM Studio</option>}
          {settings.openaiKey && <option value="openai">OpenAI</option>}
          {settings.claudeKey && <option value="claude">Claude</option>}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Initial Context
        </label>
        <textarea
          value={formData.initialContext}
          onChange={(e) => setFormData({ ...formData, initialContext: e.target.value })}
          rows={4}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Metadata (JSON)
        </label>
        <textarea
          value={formData.metadata}
          onChange={(e) => setFormData({ ...formData, metadata: e.target.value })}
          rows={4}
          className="mt-1 block w-full font-mono text-sm rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          API Integrations
        </label>
        <div className="mt-2 space-y-2">
          {apis.map((api) => (
            <label
              key={api.id}
              className="flex items-center space-x-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={formData.selectedApis.includes(api.id)}
                onChange={(e) => {
                  const newApis = e.target.checked
                    ? [...formData.selectedApis, api.id]
                    : formData.selectedApis.filter(id => id !== api.id);
                  setFormData({ ...formData, selectedApis: newApis });
                }}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <div className="flex-1">
                <p className="font-medium text-gray-900">{api.name}</p>
                <p className="text-sm text-gray-500">{api.description}</p>
              </div>
              <span className="text-xs font-medium text-gray-500 uppercase">
                {api.authType}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={() => {
            setIsCreateModalOpen(false);
            setIsEditModalOpen(false);
            resetForm();
          }}
          className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md border border-gray-300"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
        >
          {editingContext ? 'Update Context' : 'Create Context'}
        </button>
      </div>
    </form>
  );

  return (
    <div className="h-full p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Model Context Protocol
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage and coordinate model contexts across different LLMs
            </p>
          </div>
          <div className="flex space-x-3">
            {selectedContexts.size >= 2 && (
              <button
                onClick={handleMergeContexts}
                className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                <GitMerge size={20} />
                <span>Merge Selected</span>
              </button>
            )}
            <button
              onClick={() => {
                resetForm();
                setIsCreateModalOpen(true);
              }}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus size={20} />
              <span>New Context</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('contexts')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'contexts'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Contexts
            </button>
            <button
              onClick={() => setActiveTab('responses')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'responses'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Responses
            </button>
          </nav>
        </div>

        {activeTab === 'contexts' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {contexts.map((context) => (
              <div
                key={context.id}
                className={`bg-white rounded-lg border p-6 ${
                  selectedContexts.has(context.id)
                    ? 'border-blue-500 ring-2 ring-blue-200'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 bg-blue-50 rounded-lg flex items-center justify-center">
                      <Network className="text-blue-500" size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {context.model}
                      </h3>
                      <p className="text-sm text-gray-500">
                        Created {new Date(context.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={selectedContexts.has(context.id)}
                      onChange={() => toggleContextSelection(context.id)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <button
                      onClick={() => handleEditContext(context)}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                      <Settings2 size={20} />
                    </button>
                    <button
                      onClick={() => handleDeleteContext(context.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                      Context Items
                    </h4>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <pre className="text-sm text-gray-600 whitespace-pre-wrap">
                        {context.context.join('\n')}
                      </pre>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                      Metadata
                    </h4>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <pre className="text-sm text-gray-600">
                        {JSON.stringify(context.metadata, null, 2)}
                      </pre>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Responses</span>
                      <span className="text-gray-900 font-medium">
                        {mcp.getResponses(context.id).length}
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-200">
                    <SaveButton 
                      onSave={() => saveDraftMCP(context.id)}
                      hasChanges={hasDraftMCP(context.id)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {contexts.map((context) => {
              const responses = mcp.getResponses(context.id);
              return responses.length > 0 ? (
                <div key={context.id} className="bg-white rounded-lg shadow-sm border border-gray-200">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center space-x-3">
                      <Network className="text-blue-500" size={20} />
                      <h3 className="font-medium text-gray-900">{context.model}</h3>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-200">
                    {responses.map((response) => (
                      <div key={response.id} className="p-6">
                        <div className="flex items-start space-x-3">
                          <ArrowRight className="text-gray-400 mt-1" size={16} />
                          <div className="flex-1">
                            <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                              {response.content}
                            </pre>
                            <div className="mt-2 flex items-center text-xs text-gray-500">
                              <span>{new Date(response.timestamp).toLocaleString()}</span>
                              {response.metadata.status === 'success' && (
                                <span className="ml-2 flex items-center text-green-600">
                                  <Check size={12} className="mr-1" />
                                  Success
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null;
            })}
          </div>
        )}

        <Modal
          title="Create New Context"
          isOpen={isCreateModalOpen}
          onClose={() => {
            setIsCreateModalOpen(false);
            resetForm();
          }}
        >
          {renderForm(handleCreateContext)}
        </Modal>

        <Modal
          title="Edit Context"
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            resetForm();
          }}
        >
          {renderForm(handleUpdateContext)}
        </Modal>
      </div>
    </div>
  );
}
