import { MCPRegistry } from '../../../src/lib/mcp/registry';
import { MCPClient, MCPTool, MCPResource } from '../../../src/types/mcp';

describe('MCPRegistry', () => {
  let registry: MCPRegistry;
  let mockClient: MCPClient;

  beforeEach(() => {
    registry = MCPRegistry.getInstance();
    // @ts-ignore: clearing state for true test isolation
    registry.clients.clear();
    // @ts-ignore: clearing state for true test isolation
    registry.serverConfigs.clear();
    // @ts-ignore: clearing state for true test isolation
    registry.serverStatus.clear();
    mockClient = {
      name: 'test-client',
      callTool: jest.fn(),
      readResource: jest.fn(),
      execute: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Client Management', () => {
    it('registers a client successfully', () => {
      registry.registerClient(mockClient);
      expect(registry.getClient('test-client')).toBe(mockClient);
    });

    it('throws error when registering duplicate client', () => {
      registry.registerClient(mockClient);
      expect(() => registry.registerClient(mockClient)).toThrow();
    });

    it('unregisters a client successfully', () => {
      registry.registerClient(mockClient);
      expect(registry.unregisterClient('test-client')).toBe(true);
      expect(registry.getClient('test-client')).toBeUndefined();
    });

    it('lists all registered clients', () => {
      registry.registerClient(mockClient);
      const clients = registry.listClients();
      expect(clients).toHaveLength(1);
      expect(clients[0]).toBe(mockClient);
    });
  });

  describe('Server Configuration', () => {
    const mockConfig = {
      command: 'node',
      args: ['server.js'],
      env: { PORT: '3000' },
    };

    it('sets server configuration', () => {
      registry.setServerConfig('test-server', mockConfig);
      expect(registry.getServerConfig('test-server')).toEqual(mockConfig);
    });

    it('removes server configuration', () => {
      registry.setServerConfig('test-server', mockConfig);
      expect(registry.removeServerConfig('test-server')).toBe(true);
      expect(registry.getServerConfig('test-server')).toBeUndefined();
    });

    it('lists all server configurations', () => {
      registry.setServerConfig('test-server', mockConfig);
      const configs = registry.listServerConfigs();
      expect(configs.get('test-server')).toEqual(mockConfig);
    });
  });

  describe('Server Status', () => {
    const mockStatus = {
      connected: true,
      tools: [] as MCPTool[],
      resources: [] as MCPResource[],
    };

    it('updates server status', () => {
      registry.updateServerStatus('test-server', mockStatus);
      expect(registry.getServerStatus('test-server')).toEqual({
        ...mockStatus,
      });
    });

    it('lists all server statuses', () => {
      registry.updateServerStatus('test-server', mockStatus);
      const statuses = registry.listServerStatus();
      expect(statuses.get('test-server')).toEqual({
        ...mockStatus,
      });
    });
  });

  describe('Tool Management', () => {
    const mockTool: MCPTool = {
      name: 'test-tool',
      description: 'Test tool',
      inputSchema: {},
    };

    beforeEach(() => {
      registry.updateServerStatus('test-server', {
        connected: true,
        tools: [mockTool],
        resources: [],
      });
    });

    it('gets available tools for server', () => {
      const tools = registry.getAvailableTools('test-server');
      expect(tools).toEqual([mockTool]);
    });

    it('finds tool by name', () => {
      const result = registry.findToolByName('test-tool');
      expect(result).toEqual({
        server: 'test-server',
        tool: mockTool,
      });
    });

    it('returns undefined for non-existent tool', () => {
      const result = registry.findToolByName('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('Resource Management', () => {
    const mockResource: MCPResource = {
      uri: 'test://resource',
      name: 'Test Resource',
    };

    beforeEach(() => {
      registry.updateServerStatus('test-server', {
        connected: true,
        tools: [],
        resources: [mockResource],
      });
    });

    it('gets available resources for server', () => {
      const resources = registry.getAvailableResources('test-server');
      expect(resources).toEqual([mockResource]);
    });

    it('finds resource by URI', () => {
      const result = registry.findResourceByUri('test://resource');
      expect(result).toEqual({
        server: 'test-server',
        resource: mockResource,
      });
    });

    it('returns undefined for non-existent resource', () => {
      const result = registry.findResourceByUri('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('Operation Approval', () => {
    beforeEach(() => {
      registry.setServerConfig('test-server', {
        command: 'node',
        args: [],
        autoApprove: ['approved-op'],
      });
    });

    it('returns true for auto-approved operations', () => {
      expect(registry.isOperationAutoApproved('test-server', 'approved-op')).toBe(true);
    });

    it('returns false for non-auto-approved operations', () => {
      expect(registry.isOperationAutoApproved('test-server', 'non-approved-op')).toBe(false);
    });

    it('returns false for non-existent server', () => {
      expect(registry.isOperationAutoApproved('non-existent', 'op')).toBe(false);
    });
  });
});
