import React from 'react';
import { Settings2, Trash2, Terminal, Globe, Code } from 'lucide-react';
import type { Tool } from '../types';
import { SaveButton } from './SaveButton';

interface ToolCardProps {
  tool: Tool;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onSave: () => void;
  hasChanges: boolean;
}

export function ToolCard({ tool, onEdit, onDelete, onSave, hasChanges }: ToolCardProps) {
  const getIcon = () => {
    switch (tool.type) {
      case 'function':
        return <Code className="text-purple-500" size={24} />;
      case 'api':
        return <Globe className="text-blue-500" size={24} />;
      case 'cli':
        return <Terminal className="text-green-500" size={24} />;
      default:
        return <Settings2 className="text-gray-500" size={24} />;
    }
  };

  const getTypeColor = () => {
    switch (tool.type) {
      case 'function':
        return 'bg-purple-50 text-purple-700';
      case 'api':
        return 'bg-blue-50 text-blue-700';
      case 'cli':
        return 'bg-green-50 text-green-700';
      default:
        return 'bg-gray-50 text-gray-700';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 bg-gray-50 rounded-lg flex items-center justify-center">
            {getIcon()}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{tool.name}</h3>
            <p className="text-sm text-gray-500">{tool.description}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onEdit(tool.id)}
            className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg"
          >
            <Settings2 size={20} />
          </button>
          <button
            onClick={() => onDelete(tool.id)}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <span
            className={`px-2 py-1 text-xs font-medium rounded ${getTypeColor()}`}
          >
            {tool.type.toUpperCase()}
          </span>
          <span className="text-sm text-gray-500">
            {Object.keys(tool.config).length} Parameters
          </span>
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-gray-200">
        <SaveButton onSave={onSave} hasChanges={hasChanges} />
      </div>
    </div>
  );
}
