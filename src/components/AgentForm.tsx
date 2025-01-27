import React, { useState } from 'react';
import type { Agent, Tool, LLMProvider, AgentPersonality } from '../types';

interface AgentFormProps {
  agent?: Agent;
  availableTools: Tool[];
  onSubmit: (agent: Omit<Agent, 'id'>) => void;
  onCancel: () => void;
}

export function AgentForm({ agent, availableTools, onSubmit, onCancel }: AgentFormProps) {
  const [name, setName] = useState(agent?.name || '');
  const [description, setDescription] = useState(agent?.description || '');
  const [selectedTools, setSelectedTools] = useState<string[]>(agent?.tools || []);
  const [llmProvider, setLLMProvider] = useState<LLMProvider>(agent?.llmConfig.provider || 'none');
  const [model, setModel] = useState(agent?.llmConfig.model || '');
  const [temperature, setTemperature] = useState(agent?.llmConfig.temperature?.toString() || '0.7');
  const [maxTokens, setMaxTokens] = useState(agent?.llmConfig.maxTokens?.toString() || '4096');
  const [type, setType] = useState(agent?.type || 'custom');
  const [requiresApproval, setRequiresApproval] = useState(agent?.requires_approval || false);
  const [personality, setPersonality] = useState<AgentPersonality>(
    agent?.personality || {
      traits: [],
      tone: 'professional',
      style: 'concise',
      constraints: [],
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      description,
      tools: selectedTools,
      llmConfig: {
        provider: llmProvider,
        model: model || undefined,
        temperature: temperature ? parseFloat(temperature) : undefined,
        maxTokens: maxTokens ? parseInt(maxTokens, 10) : undefined,
      },
      personality,
      config: {
        status: 'stopped',
        ...agent?.config,
      },
      type,
      requires_approval: requiresApproval,
    });
  };

  const toggleTool = (toolId: string) => {
    setSelectedTools((current) =>
      current.includes(toolId)
        ? current.filter((id) => id !== toolId)
        : [...current, toolId]
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Type</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as Agent['type'])}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        >
          <option value="custom">Custom</option>
          <option value="chat">Chat</option>
          <option value="router">Router</option>
          <option value="builder">Builder</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">LLM Provider</label>
        <select
          value={llmProvider}
          onChange={(e) => setLLMProvider(e.target.value as LLMProvider)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        >
          <option value="none">None</option>
          <option value="lm-studio">LM Studio</option>
          <option value="openai">OpenAI</option>
          <option value="claude">Claude</option>
          <option value="deepseek">Deepseek</option>
        </select>
      </div>

      {llmProvider !== 'none' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700">Model</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Temperature</label>
              <input
                type="number"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
                step="0.1"
                min="0"
                max="1"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Max Tokens</label>
              <input
                type="number"
                value={maxTokens}
                onChange={(e) => setMaxTokens(e.target.value)}
                min="1"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>
        </>
      )}

      <div>
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={requiresApproval}
            onChange={(e) => setRequiresApproval(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-700">
            Requires approval for actions
          </span>
        </label>
      </div>

      {type === 'chat' && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Personality</h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Traits</label>
            <input
              type="text"
              value={personality.traits.join(', ')}
              onChange={(e) => setPersonality({
                ...personality,
                traits: e.target.value.split(',').map(t => t.trim()),
              })}
              placeholder="friendly, helpful, professional"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Tone</label>
            <select
              value={personality.tone}
              onChange={(e) => setPersonality({
                ...personality,
                tone: e.target.value,
              })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="professional">Professional</option>
              <option value="casual">Casual</option>
              <option value="friendly">Friendly</option>
              <option value="formal">Formal</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Style</label>
            <select
              value={personality.style}
              onChange={(e) => setPersonality({
                ...personality,
                style: e.target.value,
              })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="concise">Concise</option>
              <option value="detailed">Detailed</option>
              <option value="technical">Technical</option>
              <option value="simple">Simple</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Constraints</label>
            <input
              type="text"
              value={personality.constraints.join(', ')}
              onChange={(e) => setPersonality({
                ...personality,
                constraints: e.target.value.split(',').map(c => c.trim()),
              })}
              placeholder="no emojis, formal language only"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Tools
        </label>
        <div className="space-y-2">
          {availableTools.map((tool) => (
            <label
              key={tool.id}
              className="flex items-center space-x-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={selectedTools.includes(tool.id)}
                onChange={() => toggleTool(tool.id)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <div className="flex-1">
                <p className="font-medium text-gray-900">{tool.name}</p>
                <p className="text-sm text-gray-500">{tool.description}</p>
              </div>
              <span className="text-xs font-medium text-gray-500 uppercase">
                {tool.type}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md border border-gray-300"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
        >
          {agent ? 'Update Agent' : 'Create Agent'}
        </button>
      </div>
    </form>
  );
}
