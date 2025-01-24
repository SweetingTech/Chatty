import { z } from 'zod';

export interface Settings {
  lmStudioUrl: string;
  weaviateUrl: string;
  openaiKey: string;
  claudeKey: string;
  theme: 'light' | 'dark';
  braveApiKey?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface EmbeddedDocument {
  id: string;
  title: string;
  content: string;
  embedding: number[];
  createdAt: number;
}

export type LLMProvider = 'lm-studio' | 'openai' | 'claude' | 'none';

export interface AgentLLMConfig {
  provider: LLMProvider;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AgentPersonality {
  traits: string[];
  tone: string;
  style: string;
  constraints: string[];
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  tools: string[];
  llmConfig: AgentLLMConfig;
  personality?: AgentPersonality;
  config: Record<string, unknown>;
  type: 'router' | 'builder' | 'chat' | 'custom';
  requires_approval?: boolean;
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  type: 'function' | 'api' | 'cli';
  config: Record<string, unknown>;
}

export interface API {
  id: string;
  name: string;
  description: string;
  baseUrl: string;
  authType: 'none' | 'apiKey' | 'bearer' | 'basic';
  headers: Record<string, string>;
  endpoints: APIEndpoint[];
}

export interface APIEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  description: string;
  parameters: Record<string, string>;
}

export interface MCPConnection {
  id: string;
  sourceId: string;
  targetId: string;
  type: 'api' | 'llm' | 'tool';
  metadata: Record<string, unknown>;
  createdAt: number;
}

export interface BuildRequest {
  type: 'agent' | 'tool' | 'mcp';
  purpose: string;
  requirements: string[];
  suggested_tools?: string[];
  suggested_apis?: string[];
}

export interface BuildPlan {
  id: string;
  request: BuildRequest;
  components: {
    agents?: Agent[];
    tools?: Tool[];
    mcps?: MCPConnection[];
  };
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  createdAt: number;
}

// Zod schemas for validation
export const agentLLMConfigSchema = z.object({
  provider: z.enum(['lm-studio', 'openai', 'claude', 'none']),
  model: z.string().optional(),
  temperature: z.number().min(0).max(1).optional(),
  maxTokens: z.number().positive().optional(),
});

export const agentPersonalitySchema = z.object({
  traits: z.array(z.string()),
  tone: z.string(),
  style: z.string(),
  constraints: z.array(z.string()),
});

export const agentSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  tools: z.array(z.string()),
  llmConfig: agentLLMConfigSchema,
  personality: agentPersonalitySchema.optional(),
  config: z.record(z.unknown()),
  type: z.enum(['router', 'builder', 'chat', 'custom']),
  requires_approval: z.boolean().optional(),
});