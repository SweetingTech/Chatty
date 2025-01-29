import React, { useState, useEffect } from 'react';
import type { Agent, ProviderType, AgentPersonality } from '../types';
import { useAppStore } from '../store';

interface ChatAgentFormProps {
  agent: Agent;
  onSubmit: (agent: Omit<Agent, 'id'>) => void;
}

export function ChatAgentForm({ agent, onSubmit }: ChatAgentFormProps) {
  const { llmConfigs, settings } = useAppStore();
  const [name, setName] = useState(agent?.name || '');
  const [description, setDescription] = useState(agent?.description || '');
  const [llmProvider, setLLMProvider] = useState<ProviderType>(settings.defaultLLMProvider as ProviderType || 'none');
  const [model, setModel] = useState(agent?.llmConfig.model || '');
  const [temperature, setTemperature] = useState(agent?.llmConfig.temperature?.toString() || '0.7');
  const [maxTokens, setMaxTokens] = useState(agent?.llmConfig.maxTokens?.toString() || '4096');
  const [personality, setPersonality] = useState<AgentPersonality>(
    agent?.personality || {
      traits: [],
      tone: 'professional',
      style: 'concise',
      constraints: [],
    }
  );

  // Update provider when default changes in settings
  useEffect(() => {
    if (settings.defaultLLMProvider) {
      setLLMProvider(settings.defaultLLMProvider as ProviderType);
    }
  }, [settings.defaultLLMProvider]);

  // Get available models from llmConfigs
  const getModelsForProvider = (provider: ProviderType): string[] => {
    return llmConfigs[provider]?.availableModels || [];
  };

  // Update model when provider changes or when llmConfigs changes
  useEffect(() => {
    const models = getModelsForProvider(llmProvider);
    if (models.length > 0 && !models.includes(model)) {
      setModel(models[0]);
    }
  }, [llmProvider, llmConfigs]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      description,
      tools: [], // Chat agent doesn't use tools
      llmConfig: {
        provider: llmProvider,
        model: model || undefined,
        temperature: temperature ? parseFloat(temperature) : undefined,
        maxTokens: maxTokens ? parseInt(maxTokens, 10) : undefined,
        enabled: true,
      },
      personality,
      config: {
        status: 'stopped',
        ...agent?.config,
      },
      type: 'chat',
      requires_approval: false,
    });
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
        <p className="mt-1 text-sm text-gray-500">
          This is the name your chat agent will respond to
        </p>
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
        <label className="block text-sm font-medium text-gray-700">LLM Provider</label>
        <select
          value={llmProvider}
          onChange={(e) => setLLMProvider(e.target.value as ProviderType)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        >
          <option value="none">None</option>
          {Object.entries(llmConfigs)
            .filter(([key, config]) => config.enabled && key !== 'none')
            .map(([key, config]) => (
              <option key={key} value={key}>
                {key === 'openai' ? 'OpenAI' :
                 key === 'claude' ? 'Claude' :
                 key === 'deepseek' ? 'Deepseek' :
                 key === 'lm-studio' ? 'LM Studio' : key}
              </option>
            ))}
        </select>
      </div>

      {llmProvider !== 'none' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700">Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              {getModelsForProvider(llmProvider).map(modelName => (
                <option key={modelName} value={modelName}>
                  {modelName}
                </option>
              ))}
            </select>
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

      <div className="flex justify-end">
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
        >
          Update Chat Agent
        </button>
      </div>
    </form>
  );
}
