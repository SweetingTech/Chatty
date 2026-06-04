import { MCPClient } from './mcp';
import { Tool } from '../types/tool';

export type AgentType = 'chat' | 'router' | 'builder' | 'task' | 'integration' | 'learning';

export type AgentStatus = 'running' | 'stopped' | 'error';

export interface AgentConfig {
  status: AgentStatus;
  mcpClient: MCPClient;
  tools: Tool[];
  [key: string]: unknown;
}

export interface Agent {
  id: string;
  name: string;
  type: AgentType;
  description: string;
  config: AgentConfig;
}

export interface AgentRequest {
  operation?: {
    toolName: string;
    args: Record<string, unknown>;
  };
  payload?: unknown;
}

export interface AgentResponse {
  success: boolean;
  message: string;
  data?: unknown;
  error?: string;
  timestamp: string;
}
