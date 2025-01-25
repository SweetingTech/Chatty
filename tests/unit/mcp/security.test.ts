import { MCPSecurity } from '../../../src/lib/mcp/security';
import { MCPRegistry } from '../../../src/lib/mcp/registry';
import { MCPOperation } from '../../../src/types/mcp';

jest.mock('../../../src/lib/mcp/registry');

describe('MCPSecurity', () => {
  let security: MCPSecurity;
  let mockRegistry: jest.Mocked<MCPRegistry>;

  beforeEach(() => {
    mockRegistry = {
      getServerStatus: jest.fn(),
      findToolByName: jest.fn(),
    } as any;

    security = MCPSecurity.getInstance(mockRegistry);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Policy Management', () => {
    const mockPolicy = {
      allowedOperations: ['test:*', 'specific-op'],
      allowedResources: ['test://*', 'specific://resource'],
      maxConcurrentOperations: 5,
      rateLimits: {
        operations: 10,
        timeWindow: 1000,
      },
    };

    it('sets and gets policy successfully', () => {
      security.setPolicy('test-server', mockPolicy);
      expect(security.getPolicy('test-server')).toEqual(mockPolicy);
    });

    it('removes policy successfully', () => {
      security.setPolicy('test-server', mockPolicy);
      expect(security.removePolicy('test-server')).toBe(true);
      expect(security.getPolicy('test-server')).toBeUndefined();
    });
  });

  describe('Operation Validation', () => {
    const mockPolicy = {
      allowedOperations: ['test:*', 'specific-op'],
      allowedResources: ['test://*'],
      maxConcurrentOperations: 2,
      rateLimits: {
        operations: 3,
        timeWindow: 1000,
      },
    };

    const mockOperation: MCPOperation = {
      toolName: 'test:operation',
      args: { param: 'value' },
    };

    beforeEach(() => {
      mockRegistry.getServerStatus.mockReturnValue({ 
        connected: true,
        tools: [],
        resources: []
      });
      mockRegistry.findToolByName.mockReturnValue({
        server: 'test-server',
        tool: {
          name: 'test:operation',
          description: 'Test operation',
          inputSchema: {
            type: 'object',
            properties: {
              param: { type: 'string' },
            },
          },
        },
      });

      security.setPolicy('test-server', mockPolicy);
    });

    it('validates operation successfully', async () => {
      const result = await security.validateOperation('test-server', mockOperation);
      expect(result).toBe(true);
    });

    it('fails validation for disconnected server', async () => {
      mockRegistry.getServerStatus.mockReturnValue({ 
        connected: false,
        tools: [],
        resources: []
      });
      const result = await security.validateOperation('test-server', mockOperation);
      expect(result).toBe(false);
    });

    it('fails validation for missing policy', async () => {
      security.removePolicy('test-server');
      const result = await security.validateOperation('test-server', mockOperation);
      expect(result).toBe(false);
    });

    it('fails validation for disallowed operation', async () => {
      const result = await security.validateOperation('test-server', {
        toolName: 'unauthorized:op',
        args: {},
      });
      expect(result).toBe(false);
    });

    it('enforces rate limits', async () => {
      // Perform operations up to the limit
      for (let i = 0; i < mockPolicy.rateLimits.operations; i++) {
        await security.validateOperation('test-server', mockOperation);
        security.trackOperationStart('test-server', mockOperation);
      }

      // Next operation should fail
      const result = await security.validateOperation('test-server', mockOperation);
      expect(result).toBe(false);
    });

    it('enforces concurrent operation limits', async () => {
      // Start max concurrent operations
      for (let i = 0; i < mockPolicy.maxConcurrentOperations; i++) {
        await security.validateOperation('test-server', mockOperation);
        security.trackOperationStart('test-server', mockOperation);
      }

      // Next operation should fail
      const result = await security.validateOperation('test-server', mockOperation);
      expect(result).toBe(false);
    });
  });

  describe('Resource Access Validation', () => {
    const mockPolicy = {
      allowedOperations: ['test:*'],
      allowedResources: ['test://*', 'specific://resource'],
    };

    beforeEach(() => {
      mockRegistry.getServerStatus.mockReturnValue({ 
        connected: true,
        tools: [],
        resources: []
      });
      security.setPolicy('test-server', mockPolicy);
    });

    it('validates resource access successfully', async () => {
      const result = await security.validateResourceAccess('test-server', 'test://resource');
      expect(result).toBe(true);
    });

    it('validates specific resource successfully', async () => {
      const result = await security.validateResourceAccess('test-server', 'specific://resource');
      expect(result).toBe(true);
    });

    it('fails validation for disallowed resource', async () => {
      const result = await security.validateResourceAccess('test-server', 'unauthorized://resource');
      expect(result).toBe(false);
    });

    it('fails validation for disconnected server', async () => {
      mockRegistry.getServerStatus.mockReturnValue({ 
        connected: false,
        tools: [],
        resources: []
      });
      const result = await security.validateResourceAccess('test-server', 'test://resource');
      expect(result).toBe(false);
    });
  });

  describe('Operation Tracking', () => {
    const mockOperation: MCPOperation = {
      toolName: 'test:operation',
      args: {},
    };

    it('tracks operation start and end', () => {
      security.trackOperationStart('test-server', mockOperation);
      expect(security['activeOperations'].size).toBe(1);

      security.trackOperationEnd('test-server', mockOperation);
      expect(security['activeOperations'].size).toBe(0);
    });

    it('cleans up old operation history', () => {
      const oldOperation = {
        serverName: 'test-server',
        operation: mockOperation,
        timestamp: Date.now() - 2000,
      };

      security['operationHistory'].push(oldOperation);
      security.setPolicy('test-server', {
        allowedOperations: ['test:*'],
        allowedResources: [],
        rateLimits: {
          operations: 10,
          timeWindow: 1000,
        },
      });

      security['cleanupHistory']();
      expect(security['operationHistory']).toHaveLength(0);
    });
  });
});
