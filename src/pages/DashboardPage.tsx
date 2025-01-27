import React, { useEffect } from 'react';
import { useAppStore } from '../store';
import { StatusCard, ServiceStatusType } from '../components/StatusCard';
import { StatsCard } from '../components/StatsCard';
import { MessageSquare, Database, Bot, Terminal } from 'lucide-react';

export function DashboardPage() {
  const { settings, chatSessions, serviceStatus, initializeServices } = useAppStore();

  useEffect(() => {
    // Initialize all services when dashboard mounts or settings change
    initializeServices().catch(console.error);
  }, [settings.weaviateUrl, settings.lmStudioUrl]);

  const getServiceCards = () => [
    {
      title: 'LM Studio',
      status: serviceStatus.lmStudio,
      description: serviceStatus.lmStudio === 'online' 
        ? 'Local LLM server is running and ready'
        : 'Local LLM server is not connected',
    },
    {
      title: 'OpenAI',
      status: settings.openaiKey ? ('online' as ServiceStatusType) : ('offline' as ServiceStatusType),
      description: settings.openaiKey
        ? 'API key configured and ready'
        : 'API key not configured',
    },
    {
      title: 'Claude',
      status: settings.claudeKey ? ('online' as ServiceStatusType) : ('offline' as ServiceStatusType),
      description: settings.claudeKey
        ? 'API key configured and ready'
        : 'API key not configured',
    },
    {
      title: 'Deepseek',
      status: settings.deepseekKey ? ('online' as ServiceStatusType) : ('offline' as ServiceStatusType),
      description: settings.deepseekKey
        ? 'API key configured and ready'
        : 'API key not configured',
    },
    {
      title: 'Weaviate',
      status: serviceStatus.weaviate,
      description: serviceStatus.weaviate === 'online'
        ? 'Vector database is connected'
        : 'Vector database is not connected',
    },
    {
      title: 'ChromaDB',
      status: serviceStatus.chromadb,
      description: serviceStatus.chromadb === 'online'
        ? 'Local database is running'
        : 'Local database is not connected',
      stats: [
        {
          label: 'Chat Sessions',
          value: chatSessions.length,
        },
        {
          label: 'Storage Used',
          value: '23 MB',
        },
      ],
    },
  ];

  return (
    <div className="h-full p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Monitor your LLM services and system statistics
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard
            title="Total Chat Sessions"
            value={chatSessions.length}
            icon={<MessageSquare className="text-blue-500" size={24} />}
            change={{ value: '+12%', type: 'increase' }}
          />
          <StatsCard
            title="Embedded Documents"
            value="124"
            icon={<Database className="text-blue-500" size={24} />}
            change={{ value: '+8%', type: 'increase' }}
          />
          <StatsCard
            title="Active Agents"
            value="3"
            icon={<Bot className="text-blue-500" size={24} />}
            change={{ value: '+2', type: 'increase' }}
          />
          <StatsCard
            title="CLI Commands Run"
            value="256"
            icon={<Terminal className="text-blue-500" size={24} />}
            change={{ value: '+15%', type: 'increase' }}
          />
        </div>

        {/* Service Status */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Service Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {getServiceCards().map((card, index) => (
              <StatusCard key={index} {...card} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
