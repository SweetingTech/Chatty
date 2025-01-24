import React, { useState } from 'react';
import type { Tool } from '../types';

interface ToolFormProps {
  tool?: Tool;
  onSubmit: (tool: Omit<Tool, 'id'>) => void;
  onCancel: () => void;
}

export function ToolForm({ tool, onSubmit, onCancel }: ToolFormProps) {
  const [name, setName] = useState(tool?.name || '');
  const [description, setDescription] = useState(tool?.description || '');
  const [type, setType] = useState<Tool['type']>(tool?.type || 'function');
  const [config, setConfig] = useState<string>(
    JSON.stringify(tool?.config || {}, null, 2)
  );
  const [configError, setConfigError] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsedConfig = JSON.parse(config);
      onSubmit({
        name,
        description,
        type,
        config: parsedConfig,
      });
    } catch (err) {
      setConfigError('Invalid JSON configuration');
    }
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
          onChange={(e) => setType(e.target.value as Tool['type'])}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        >
          <option value="function">Function</option>
          <option value="api">API</option>
          <option value="cli">CLI</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Configuration (JSON)
        </label>
        <textarea
          value={config}
          onChange={(e) => {
            setConfig(e.target.value);
            setConfigError('');
          }}
          rows={8}
          className={`mt-1 block w-full font-mono text-sm rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
            configError ? 'border-red-300' : 'border-gray-300'
          }`}
          required
        />
        {configError && (
          <p className="mt-1 text-sm text-red-600">{configError}</p>
        )}
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
          {tool ? 'Update Tool' : 'Create Tool'}
        </button>
      </div>
    </form>
  );
}