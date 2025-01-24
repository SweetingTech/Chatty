import React from 'react';
import { Bot, Play, Pause, Settings, Trash2 } from 'lucide-react';
import type { Agent } from '../types';
import { SaveButton } from './SaveButton';

interface AgentCardProps {
  agent: Agent;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onSave: () => void;
  hasChanges: boolean;
}

export function AgentCard({ agent, onStart, onStop, onEdit, onDelete, onSave, hasChanges }: AgentCardProps) {
  const isRunning = agent.config.status === 'running';

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 bg-blue-50 rounded-lg flex items-center justify-center">
            <Bot className="text-blue-500" size={24} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{agent.name}</h3>
            <p className="text-sm text-gray-500">{agent.description}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => isRunning ? onStop(agent.id) : onStart(agent.id)}
            className={`p-2 rounded-lg ${
              isRunning
                ? 'text-red-600 hover:bg-red-50'
                : 'text-green-600 hover:bg-green-50'
            }`}
          >
            {isRunning ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <button
            onClick={() => onEdit(agent.id)}
            className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg"
          >
            <Settings size={20} />
          </button>
          <button
            onClick={() => onDelete(agent.id)}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Active Tools</h4>
        <div className="flex flex-wrap gap-2">
          {agent.tools.map((tool) => (
            <span
              key={tool}
              className="px-2 py-1 bg-gray-100 text-gray-600 text-sm rounded"
            >
              {tool}
            </span>
          ))}
        </div>
      </div>

      {agent.config.status === 'running' && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Runtime</span>
            <span className="text-gray-900 font-medium">2h 15m</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-gray-500">Tasks Completed</span>
            <span className="text-gray-900 font-medium">24</span>
          </div>
        </div>
      )}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <SaveButton onSave={onSave} hasChanges={hasChanges} />
      </div>
    </div>
  );
}
