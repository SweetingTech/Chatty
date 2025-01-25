import { MCPRegistry } from '../../../src/lib/mcp/registry';
import { MCPSecurity } from '../../../src/lib/mcp/security';
import { MCPClientImpl } from '../../../src/lib/mcp/client';
import { MCPOperation, MCPTool } from '../../../src/types/mcp';

describe('MCP System Integration', () => {
  let registry: MCPRegistry;
  let security: MCPSecurity;
  let client: MCPClientImpl;

  const mockTool: MCPTool = {
    name: 'test:operation',
    description: 'Test operation',
    inputSchema: {
      type: 'object',
      properties: {
        param: { type: 'string' },
      },
      required: ['param'],
    },
  };

  beforeEach(() => {
    // Initialize components
    registry = MCPRegistry.getInstance();
    security = MCPSecurity.getInstance(registry);
    client = new MCPClientImpl(
      {
        name: 'test-client',
        serverName: 'test-server',
        autoApprove: false,
      },
      registry,
      security
    );

    // Set up server status
    registry.updateServerStatus('test-server', {
      connected: true,
      tools: [mockTool],
      resources: [],
    });

    // Set up security policy
    security.setPolicy('test-server', {
      allowedOperations: ['test:*'],
      allowedResources: ['test://*'],
      maxConcurrentOperations: 2,
      rateLimits: {
        operations: 5,
        timeWindow: 1000,
      },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Operation Flow', () => {
    const mockOperation: MCPOperation = {
      toolName: 'test:operation',
      args: { param: 'test-value' },
    };

    it('successfully executes valid operation through entire system', async () => {
      const operationStartSpy = jest.fn();
      const operationEndSpy = jest.fn();
      client.on('operation:start', operationStartSpy);
      client.on('operation:end', operationEndSpy);

      const result = await client.execute(mockOperation.toolName, mockOperation.args);

      expect(result).toBeDefined();
      expect(operationStartSpy).toHaveBeenCalledWith(mockOperation);
      expect(operationEndSpy).toHaveBeenCalledWith(mockOperation, expect.any(Object));
    });

    it('enforces rate limits across multiple operations', async () => {
      const policy = security.getPolicy('test-server')!;
      const operations: Promise<any>[] = [];

      // Execute operations up to the limit
      for (let i = 0; i < policy.rateLimits!.operations; i++) {
        operations.push(client.execute(mockOperation.toolName, mockOperation.args));
      }

      // All operations within limit should succeed
      await expect(Promise.all(operations)).resolves.toBeDefined();

      // Next operation should fail due to rate limit
      await expect(client.execute(mockOperation.toolName, mockOperation.args))
        .rejects.toThrow(/Operation.*not allowed/);
    });

    it('enforces concurrent operation limits', async () => {
      const policy = security.getPolicy('test-server')!;
      const operations: Promise<any>[] = [];

      // Start concurrent operations up to the limit
      for (let i = 0; i < policy.maxConcurrentOperations!; i++) {
        operations.push(client.execute(mockOperation.toolName, mockOperation.args));
      }

      // Additional operation should fail
      const extraOperation = client.execute(mockOperation.toolName, mockOperation.args);
      await expect(extraOperation).rejects.toThrow(/Operation.*not allowed/);

      // Original operations should complete
      await Promise.all(operations);
    });

    it('handles server disconnection gracefully', async () => {
      // Start an operation
      const operationPromise = client.execute(mockOperation.toolName, mockOperation.args);

      // Simulate server disconnection
      registry.updateServerStatus('test-server', {
        connected: false,
        tools: [],
        resources: [],
      });

      // Operation should fail
      await expect(operationPromise).rejects.toThrow('Server test-server is not connected');
    });
  });

  describe('Security Integration', () => {
    it('enforces operation permissions', async () => {
      // Update policy to disallow operation
      security.setPolicy('test-server', {
        allowedOperations: ['other:*'],
        allowedResources: ['test://*'],
      });

      await expect(client.execute('test:operation', { param: 'value' }))
        .rejects.toThrow(/Operation.*not allowed/);
    });

    it('validates operation schema', async () => {
      // Invalid args (missing required param)
      await expect(client.execute('test:operation', {}))
        .rejects.toThrow(/Operation validation failed/);
    });

    it('tracks operation history for rate limiting', async () => {
      const policy = security.getPolicy('test-server')!;
      const operations: Promise<any>[] = [];

      // Execute operations
      for (let i = 0; i < policy.rateLimits!.operations; i++) {
        operations.push(client.execute('test:operation', { param: 'value' }));
      }

      await Promise.all(operations);

      // Verify operation history
      expect(security['operationHistory'].length).toBe(policy.rateLimits!.operations);
    });
  });

  describe('Registry Integration', () => {
    it('manages server tools and status', () => {
      const status = registry.getServerStatus('test-server');
      expect(status).toEqual({
        connected: true,
        tools: [mockTool],
        resources: [],
      });
    });

    it('finds tools by name', () => {
      const tool = registry.findToolByName('test:operation');
      expect(tool).toEqual({
        server: 'test-server',
        tool: mockTool,
      });
    });

    it('handles tool updates', () => {
      const updatedTool = {
        ...mockTool,
        description: 'Updated description',
      };

      registry.updateServerStatus('test-server', {
        connected: true,
        tools: [updatedTool],
        resources: [],
      });

      const tool = registry.findToolByName('test:operation');
      expect(tool?.tool.description).toBe('Updated description');
    });
  });

  describe('Error Handling', () => {
    it('handles registry errors', async () => {
      registry.updateServerStatus('test-server', {
        connected: true,
        tools: [], // Remove tool registration
        resources: [],
      });

      await expect(client.execute('test:operation', { param: 'value' }))
        .rejects.toThrow('Tool test:operation not found');
    });

    it('handles security errors', async () => {
      security.removePolicy('test-server');

      await expect(client.execute('test:operation', { param: 'value' }))
        .rejects.toThrow('No security policy defined for server test-server');
    });

    it('handles client configuration errors', () => {
      expect(() => new MCPClientImpl(
        {
          name: 'test-client',
          serverName: 'non-existent-server',
          autoApprove: false,
        },
        registry,
        security
      )).not.toThrow();

      // But operations should fail
      expect(client.execute('test:operation', { param: 'value' }))
        .rejects.toThrow(/Server.*not connected/);
    });
  });
});
