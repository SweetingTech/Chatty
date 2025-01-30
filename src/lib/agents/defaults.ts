import { Agent, LLMConfig } from '../../types';

const defaultLLMConfig: LLMConfig = {
  provider: 'none',
  enabled: true,
  isDefault: false
};
import { mcp } from '../mcp';

export const defaultAgents: Agent[] = [
  {
    id: 'chat-agent',
    name: 'Chat Agent',
    type: 'chat',
    description: 'Handles conversational interactions and message processing',
    tools: [],
    llmConfig: defaultLLMConfig,
    config: {
      status: 'running',
      mcpClient: mcp.client
    }
  },
  {
    id: 'router-agent',
    name: 'Router Agent',
    type: 'router',
    description: 'Routes requests to appropriate agents and manages workflow',
    tools: [],
    llmConfig: defaultLLMConfig,
    config: {
      status: 'stopped',
      mcpClient: mcp.client
    }
  },
  {
    id: 'builder-agent',
    name: 'Builder Agent',
    type: 'builder',
    description: 'Handles code generation and project scaffolding',
    tools: [],
    llmConfig: defaultLLMConfig,
    config: {
      status: 'stopped',
      mcpClient: mcp.client
    }
  },
  {
    id: 'task-agent',
    name: 'Task Agent',
    type: 'task',
    description: 'Manages and executes task-based operations',
    tools: [],
    llmConfig: defaultLLMConfig,
    config: {
      status: 'stopped',
      mcpClient: mcp.client
    }
  },
  {
    id: 'integration-agent',
    name: 'Integration Agent',
    type: 'integration',
    description: 'Handles external service integrations and API interactions',
    tools: [],
    llmConfig: defaultLLMConfig,
    config: {
      status: 'stopped',
      mcpClient: mcp.client
    }
  },
  {
    id: 'learning-agent',
    name: 'Learning Agent',
    type: 'learning',
    description: 'Manages learning and adaptation of the system',
    tools: [],
    llmConfig: defaultLLMConfig,
    config: {
      status: 'stopped',
      mcpClient: mcp.client
    }
  }
];
