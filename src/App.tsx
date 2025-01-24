import React from 'react';
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

function App() {
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