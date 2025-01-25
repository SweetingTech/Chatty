import { MCPOperation } from './mcp';

export interface AgentConfig {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  settings?: Record<string, any>;
}

export interface AgentContext {
  message: string;
  metadata?: Record<string, any>;
  timestamp?: number;
}

export interface AgentRequest {
  operation: MCPOperation;
  payload: any;
}

export interface AgentResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
  timestamp: string;
}
