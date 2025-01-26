export type ToolType = 'function' | 'api' | 'cli';

export interface ToolConfig {
  enabled: boolean;
  [key: string]: any;
}

export interface Tool {
  id: string;
  name: string;
  type: ToolType;
  description: string;
  config: ToolConfig;
  execute: (args: Record<string, any>) => Promise<any>;
}

export interface ToolRequest {
  name: string;
  args: Record<string, any>;
}

export interface ToolResponse {
  success: boolean;
  result?: any;
  error?: string;
}
