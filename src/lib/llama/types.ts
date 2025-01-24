import type { Agent, Tool, LLMProvider } from '../../types';

export interface LlamaContext {
  id: string;
  variables: Record<string, unknown>;
  memory: unknown[];
  created_at: number;
  updated_at: number;
}

export interface LlamaToolCall {
  tool_id: string;
  input: unknown;
  output: unknown;
  error?: string;
  timestamp: number;
}

export interface LlamaAgentState {
  id: string;
  agent_id: string;
  context: LlamaContext;
  tool_calls: LlamaToolCall[];
  created_at: number;
  updated_at: number;
}

export interface LlamaAgentResponse {
  content: string;
  tool_calls?: LlamaToolCall[];
  context_updates?: Partial<LlamaContext>;
  error?: string;
}

export interface LlamaAgentConfig {
  provider: LLMProvider;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  tools?: string[];
}