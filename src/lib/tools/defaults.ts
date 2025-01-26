import { Tool } from '../../types/tool';

export const defaultTools: Tool[] = [
  {
    id: 'execute-command',
    name: 'Execute Command',
    type: 'cli',
    description: 'Executes CLI commands on the system',
    config: {
      enabled: true,
      requiresApproval: true
    },
    execute: async (_args: Record<string, any>) => {
      // Implementation handled by MCP
      return { success: true };
    }
  },
  {
    id: 'read-file',
    name: 'Read File',
    type: 'function',
    description: 'Reads content from a file at the specified path',
    config: {
      enabled: true,
      requiresApproval: false
    },
    execute: async (_args: Record<string, any>) => {
      // Implementation handled by MCP
      return { success: true };
    }
  },
  {
    id: 'write-file',
    name: 'Write File',
    type: 'function',
    description: 'Writes content to a file at the specified path',
    config: {
      enabled: true,
      requiresApproval: true
    },
    execute: async (_args: Record<string, any>) => {
      // Implementation handled by MCP
      return { success: true };
    }
  },
  {
    id: 'search-files',
    name: 'Search Files',
    type: 'function',
    description: 'Performs regex search across files in a directory',
    config: {
      enabled: true,
      requiresApproval: false
    },
    execute: async (_args: Record<string, any>) => {
      // Implementation handled by MCP
      return { success: true };
    }
  },
  {
    id: 'list-files',
    name: 'List Files',
    type: 'function',
    description: 'Lists files and directories in the specified path',
    config: {
      enabled: true,
      requiresApproval: false
    },
    execute: async (_args: Record<string, any>) => {
      // Implementation handled by MCP
      return { success: true };
    }
  },
  {
    id: 'browser-action',
    name: 'Browser Action',
    type: 'function',
    description: 'Controls a Puppeteer browser instance',
    config: {
      enabled: true,
      requiresApproval: false
    },
    execute: async (_args: Record<string, any>) => {
      // Implementation handled by MCP
      return { success: true };
    }
  }
];
