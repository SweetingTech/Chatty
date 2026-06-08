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
    // @ts-ignore: private property access for testing
    registry.serverStatus.clear();
    // @ts-ignore: private property access for testing
    registry.serverConfigs.clear();

    security = MCPSecurity.getInstance(registry);
    // @ts-ignore: private property access for testing
    security.policies.clear();
    // @ts-ignore: private property access for testing
    security.activeOperations.clear();
    // @ts-ignore: private property access for testing
    security.operationHistory = [];

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
      expect(operationStartSpy).toHaveBeenCalledWith(expect.objectContaining({
        toolName: mockOperation.toolName,
        args: mockOperation.args
      }));
      expect(operationEndSpy).toHaveBeenCalledWith(expect.objectContaining({
        toolName: mockOperation.toolName,
        args: mockOperation.args
      }), expect.any(Object));
    });

    it('enforces rate limits across multiple operations', async () => {
      const policy = security.getPolicy('test-server')!;

      // Clear out history just in case
      // @ts-ignore
      security.operationHistory = [];

      // We must avoid concurrent limits if maxConcurrentOperations is lower than rate limit
      policy.maxConcurrentOperations = policy.rateLimits!.operations + 1;

      // Execute operations up to the limit sequentially so they don't timeout/fail from concurrency
      for (let i = 0; i < policy.rateLimits!.operations; i++) {
        await client.execute(mockOperation.toolName, { param: `value-rate-${i}` });
      }

      // Next operation should fail due to rate limit
      await expect(client.execute(mockOperation.toolName, { param: 'extra-rate' }))
        .rejects.toThrow(/Operation test:operation is not allowed/);
    });

    it('enforces concurrent operation limits', async () => {
      const policy = security.getPolicy('test-server')!;
      const operations: Promise<any>[] = [];

      // Start concurrent operations up to the limit
      for (let i = 0; i < policy.maxConcurrentOperations!; i++) {
        operations.push(client.execute(mockOperation.toolName, { param: `value-${i}` }));
      }

      // Wait a tick for trackOperationStart
      await new Promise(r => process.nextTick(r));

      // Additional operation should fail
      const extraOperation = client.execute(mockOperation.toolName, { param: 'extra' });
      await expect(extraOperation).rejects.toThrow(/Operation.*not allowed/);

      // Original operations should complete
      const results = await Promise.all(operations);
      expect(results).toHaveLength(policy.maxConcurrentOperations!);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });

    it('handles server disconnection gracefully', async () => {
      // Simulate server disconnection
      registry.updateServerStatus('test-server', {
        connected: false,
        tools: [],
        resources: [],
      });

      // Start an operation
      const operationPromise = client.execute(mockOperation.toolName, mockOperation.args);

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

      // Clear out history just in case
      // @ts-ignore
      security.operationHistory = [];

      policy.maxConcurrentOperations = policy.rateLimits!.operations + 1;

      // Execute operations sequentially to avoid concurrent operation limits
      for (let i = 0; i < policy.rateLimits!.operations; i++) {
        await client.execute('test:operation', { param: `value-hist-${i}` });
      }

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
        .rejects.toThrow('Operation test:operation is not allowed');
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

      const invalidClient = new MCPClientImpl(
        {
          name: 'test-client',
          serverName: 'non-existent-server',
          autoApprove: false,
        },
        registry,
        security
      );
      // But operations should fail
      expect(invalidClient.execute('test:operation', { param: 'value' }))
        .rejects.toThrow(/Server.*not connected/);
    });
  });
});
