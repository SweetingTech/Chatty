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
import { Loader2, AlertCircle } from 'lucide-react';

function App() {
  const { initializeServices } = useAppStore();
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        setInitError(null);
        await initializeServices();
      } catch (error) {
        console.error('Failed to initialize services:', error);
        setInitError(error instanceof Error ? error.message : 'Unknown initialization error');
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

  if (initError) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md p-6 bg-white rounded-lg shadow-lg border border-red-100">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Service Initialization Failed
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            The application failed to connect to required background services. Some features may be unavailable.
          </p>
          <div className="bg-red-50 text-red-700 text-sm p-3 rounded text-left font-mono mb-4 break-words">
            {initError}
          </div>
          <button
            onClick={() => {
              setInitError(null);
              setIsInitializing(true);
              initializeServices()
                .catch((e) => setInitError(e instanceof Error ? e.message : 'Error'))
                .finally(() => setIsInitializing(false));
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Retry Connection
          </button>
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
