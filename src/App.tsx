import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ChatPage } from './pages/ChatPage';
import { ChatConfigPage } from './pages/ChatConfigPage';
import { EmbeddingsPage } from './pages/EmbeddingsPage';
import { DashboardPage } from './pages/DashboardPage';
import { AgentsPage } from './pages/AgentsPage';
import { ToolsPage } from './pages/ToolsPage';
import { APIPage } from './pages/APIPage';
import { MCPPage } from './pages/MCPPage';
import { CLIPage } from './pages/CLIPage';
import { SettingsPage } from './pages/SettingsPage';
import { useAppStore } from './store';
import { Loader2 } from 'lucide-react';

function App() {
  const { initializeServices, serviceStatus } = useAppStore();
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        await initializeServices();
      } catch (error) {
        console.error('Failed to initialize services:', error);
      } finally {
        setIsInitializing(false);
      }
    };

    init();
  }, [initializeServices]);

  if (isInitializing) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900">
            Initializing Services...
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Please wait while we connect to required services
          </p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<ChatPage />} />
          <Route path="/chat-config" element={<ChatConfigPage />} />
          <Route path="/embeddings" element={<EmbeddingsPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/agents" element={<AgentsPage />} />
          <Route path="/tools" element={<ToolsPage />} />
          <Route path="/apis" element={<APIPage />} />
          <Route path="/mcp" element={<MCPPage />} />
          <Route path="/cli" element={<CLIPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
