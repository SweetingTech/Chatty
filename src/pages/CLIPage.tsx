import React, { useState, useRef, useEffect } from 'react';
import { Terminal as TerminalIcon, Send, X } from 'lucide-react';
import { useAppStore } from '../store';

interface CommandHistory {
  command: string;
  output: string;
  timestamp: number;
  status: 'success' | 'error' | 'info';
}

export function CLIPage() {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<CommandHistory[]>([]);
  const { agents, tools } = useAppStore();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  useEffect(() => {
    // Initial welcome message
    setHistory([
      {
        command: '',
        output: 'Welcome to Multi-LLM CLI. Type "help" for available commands.',
        timestamp: Date.now(),
        status: 'info',
      },
    ]);
    inputRef.current?.focus();
  }, []);

  const handleCommand = (command: string) => {
    const cmd = command.trim().toLowerCase();
    const parts = cmd.split(' ');
    const mainCommand = parts[0];

    let output = '';
    let status: CommandHistory['status'] = 'success';

    switch (mainCommand) {
      case 'help':
        output = `
Available commands:
  help                Show this help message
  clear              Clear the terminal
  list agents        List all configured agents
  list tools         List all available tools
  agent start <id>   Start an agent
  agent stop <id>    Stop an agent
  agent status <id>  Get agent status
  tool info <id>     Get tool information
`;
        break;

      case 'clear':
        setHistory([]);
        return;

      case 'list':
        if (parts[1] === 'agents') {
          output = agents.map(agent => 
            `${agent.id} - ${agent.name} (${agent.config.status || 'stopped'})`
          ).join('\n');
        } else if (parts[1] === 'tools') {
          output = tools.map(tool => 
            `${tool.id} - ${tool.name} (${tool.type})`
          ).join('\n');
        } else {
          output = 'Invalid list command. Try "list agents" or "list tools"';
          status = 'error';
        }
        break;

      case 'agent':
        const agentId = parts[2];
        const agent = agents.find(a => a.id === agentId);

        if (!agent) {
          output = `Agent not found: ${agentId}`;
          status = 'error';
          break;
        }

        switch (parts[1]) {
          case 'start':
            output = `Starting agent: ${agent.name}`;
            break;
          case 'stop':
            output = `Stopping agent: ${agent.name}`;
            break;
          case 'status':
            output = `Agent: ${agent.name}\nStatus: ${agent.config.status || 'stopped'}\nTools: ${agent.tools.join(', ')}`;
            break;
          default:
            output = 'Invalid agent command. Try "help" for usage.';
            status = 'error';
        }
        break;

      case 'tool':
        if (parts[1] === 'info') {
          const toolId = parts[2];
          const tool = tools.find(t => t.id === toolId);
          
          if (tool) {
            output = `Tool: ${tool.name}\nType: ${tool.type}\nDescription: ${tool.description}\nConfig: ${JSON.stringify(tool.config, null, 2)}`;
          } else {
            output = `Tool not found: ${toolId}`;
            status = 'error';
          }
        } else {
          output = 'Invalid tool command. Try "help" for usage.';
          status = 'error';
        }
        break;

      default:
        output = `Command not found: ${mainCommand}. Type "help" for available commands.`;
        status = 'error';
    }

    setHistory(prev => [...prev, {
      command,
      output: output.trim(),
      timestamp: Date.now(),
      status,
    }]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    handleCommand(input);
    setInput('');
  };

  return (
    <div className="h-full p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <div className="bg-gray-900 rounded-lg shadow-lg overflow-hidden">
          {/* Terminal Header */}
          <div className="bg-gray-800 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <TerminalIcon className="text-gray-400" size={20} />
              <span className="text-gray-200 font-medium">Multi-LLM CLI</span>
            </div>
            <div className="flex space-x-2">
              <div className="h-3 w-3 rounded-full bg-yellow-500" />
              <div className="h-3 w-3 rounded-full bg-green-500" />
              <div className="h-3 w-3 rounded-full bg-red-500" />
            </div>
          </div>

          {/* Terminal Body */}
          <div className="bg-gray-900 p-4 h-[600px] overflow-y-auto font-mono text-sm">
            {history.map((item, index) => (
              <div key={index} className="mb-4">
                {item.command && (
                  <div className="flex items-center space-x-2 text-gray-400">
                    <span>$</span>
                    <span>{item.command}</span>
                  </div>
                )}
                <div className={`mt-1 whitespace-pre-wrap ${
                  item.status === 'error' ? 'text-red-400' :
                  item.status === 'info' ? 'text-blue-400' :
                  'text-gray-300'
                }`}>
                  {item.output}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Command Input */}
          <form onSubmit={handleSubmit} className="bg-gray-800 p-2">
            <div className="flex items-center space-x-2">
              <span className="text-gray-400">$</span>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="flex-1 bg-transparent text-gray-200 focus:outline-none"
                placeholder="Type a command..."
              />
              <button
                type="submit"
                disabled={!input.trim()}
                className="p-1 text-gray-400 hover:text-gray-200 disabled:opacity-50"
              >
                <Send size={16} />
              </button>
            </div>
          </form>
        </div>

        {/* Command Reference */}
        <div className="mt-6 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Reference</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Agent Commands</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li><code className="text-blue-600">list agents</code> - List all agents</li>
                <li><code className="text-blue-600">agent start &lt;id&gt;</code> - Start agent</li>
                <li><code className="text-blue-600">agent stop &lt;id&gt;</code> - Stop agent</li>
                <li><code className="text-blue-600">agent status &lt;id&gt;</code> - Get status</li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Tool Commands</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li><code className="text-blue-600">list tools</code> - List all tools</li>
                <li><code className="text-blue-600">tool info &lt;id&gt;</code> - Tool details</li>
                <li><code className="text-blue-600">help</code> - Show help</li>
                <li><code className="text-blue-600">clear</code> - Clear terminal</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}