import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MessageSquare, Database, LayoutDashboard, Bot, PenTool as Tool, Terminal, Settings as SettingsIcon, Network, Globe, Sliders } from 'lucide-react';
import { useAppStore } from '../store';
import type { Settings } from '../types';

const navItems = [
  { path: '/', icon: MessageSquare, label: 'Chat' },
  { path: '/chat-config', icon: Sliders, label: 'Chat Config' },
  { path: '/embeddings', icon: Database, label: 'Embeddings' },
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/agents', icon: Bot, label: 'Agents' },
  { path: '/tools', icon: Tool, label: 'Tools' },
  { path: '/apis', icon: Globe, label: 'APIs' },
  { path: '/mcp', icon: Network, label: 'MCP' },
  { path: '/cli', icon: Terminal, label: 'CLI' },
  { path: '/settings', icon: SettingsIcon, label: 'Settings' },
];

const getSystemStatus = (settings: Settings, activeAgents: number) => {
  if (!settings.lmStudioUrl && !settings.openaiKey && !settings.claudeKey) {
    return { color: 'text-red-500', message: 'No LLM configured' };
  }
  if (activeAgents > 0) {
    return { color: 'text-green-500', message: `${activeAgents} agents running` };
  }
  return { color: 'text-yellow-500', message: 'System idle' };
};

function LayoutComponent({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { settings, agents } = useAppStore();
  const activeAgents = React.useMemo(() => 
    agents.filter(a => a.config.status === 'running').length,
    [agents]
  );

  const status = React.useMemo(() => 
    getSystemStatus(settings, activeAgents),
    [settings, activeAgents]
  );

  return (
    <div className="flex h-screen bg-gray-100">
      <nav className="w-64 bg-white shadow-md flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-800">Multi-LLM App</h1>
          <div className="mt-2 flex items-center space-x-2 text-sm">
            <div className={`flex items-center space-x-1 ${status.color}`}>
              <span className="block w-2 h-2 rounded-full bg-current" />
              <span>{status.message}</span>
            </div>
          </div>
        </div>

        <ul className="flex-1 space-y-1 p-4 overflow-y-auto">
          {navItems.map(({ path, icon: Icon, label }) => (
            <li key={path}>
              <Link
                to={path}
                className={`flex items-center space-x-3 px-4 py-2 rounded-lg transition-colors ${
                  location.pathname === path
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon size={20} />
                <span>{label}</span>
              </Link>
            </li>
          ))}
        </ul>

        <div className="p-4 border-t border-gray-200">
          <div className="text-xs text-gray-500">
            <div>Version 1.0.0</div>
            <div className="mt-1">© 2024 Multi-LLM</div>
          </div>
        </div>
      </nav>

      <main className="flex-1 overflow-auto">
        <div className="h-full">{children}</div>
      </main>
    </div>
  );
}

export const Layout = React.memo(LayoutComponent);
