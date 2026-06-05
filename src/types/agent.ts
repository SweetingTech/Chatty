import { MCPClient } from './mcp';
import { Tool } from '../types/tool';

export type AgentType = 'chat' | 'router' | 'builder' | 'task' | 'integration' | 'learning';

export type AgentStatus = 'running' | 'stopped' | 'error';

export interface AgentConfig {
  status: AgentStatus;
  mcpClient: MCPClient;
  tools: Tool[];
  [key: string]: any;
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
    args: Record<string, any>;
  };
  payload?: any;
}

export interface AgentResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
  timestamp: string;
}
