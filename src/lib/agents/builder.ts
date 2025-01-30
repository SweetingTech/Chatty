import { BaseAgent } from './base';
import { AgentRequest, AgentResponse } from '../../types/agent';
import { MCPClient } from '../mcp';

interface BuilderContext {
  componentType: string;
  properties: Record<string, any>;
  dependencies: string[];
  status: 'pending' | 'building' | 'complete' | 'failed';
  error?: string;
}

export class BuilderAgent extends BaseAgent {
  private buildContexts: Map<string, BuilderContext>;

  constructor(mcpClient: MCPClient) {
    super(mcpClient);
    this.buildContexts = new Map();
  }

  // Initialize a new build context
  private initializeBuildContext(id: string, componentType: string): BuilderContext {
    const context: BuilderContext = {
      componentType,
      properties: {},
      dependencies: [],
      status: 'pending'
    };
    this.buildContexts.set(id, context);
    return context;
  }

  // Get build context by ID
  getBuildContext(id: string): BuilderContext | undefined {
    return this.buildContexts.get(id);
  }

  // Update build properties
  updateBuildProperties(id: string, properties: Record<string, any>): void {
    const context = this.getBuildContext(id);
    if (context) {
      context.properties = { ...context.properties, ...properties };
      this.buildContexts.set(id, context);
    }
  }

  // Add build dependency
  addDependency(id: string, dependency: string): void {
    const context = this.getBuildContext(id);
    if (context && !context.dependencies.includes(dependency)) {
      context.dependencies.push(dependency);
      this.buildContexts.set(id, context);
    }
  }

  // Update build status
  private updateBuildStatus(id: string, status: BuilderContext['status'], error?: string): void {
    const context = this.getBuildContext(id);
    if (context) {
      context.status = status;
      context.error = error;
      this.buildContexts.set(id, context);
    }
  }

  protected async processRequest(request: AgentRequest): Promise<AgentResponse> {
    try {
      const { buildId, componentType, action } = request.payload;

      // Initialize build context if needed
      let context = this.getBuildContext(buildId);
      if (!context && componentType) {
        context = this.initializeBuildContext(buildId, componentType);
      }

      if (!context) {
        throw new Error('Invalid build context');
      }

      // Process build action
      switch (action) {
        case 'start':
          return await this.startBuild(buildId, request);
        case 'update':
          return await this.updateBuild(buildId, request);
        case 'validate':
          return await this.validateBuild(buildId, request);
        case 'complete':
          return await this.completeBuild(buildId, request);
        default:
          throw new Error(`Unknown build action: ${action}`);
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  // Start a new build process
  private async startBuild(buildId: string, request: AgentRequest): Promise<AgentResponse> {
    const context = this.getBuildContext(buildId);
    if (!context) {
      throw new Error('Build context not found');
    }

    try {
      this.updateBuildStatus(buildId, 'building');

      // Execute MCP operation if present
      if (request.operation) {
        const result = await this.executeMCPOperation(request.operation);
        this.updateBuildProperties(buildId, { mcpResult: result });
      }

      return {
        success: true,
        message: `Build started for ${context.componentType}`,
        data: { context },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.updateBuildStatus(buildId, 'failed', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  // Update an ongoing build
  private async updateBuild(buildId: string, request: AgentRequest): Promise<AgentResponse> {
    const context = this.getBuildContext(buildId);
    if (!context) {
      throw new Error('Build context not found');
    }

    try {
      // Update properties from request payload
      if (request.payload.properties) {
        this.updateBuildProperties(buildId, request.payload.properties);
      }

      // Execute MCP operation if present
      if (request.operation) {
        const result = await this.executeMCPOperation(request.operation);
        this.updateBuildProperties(buildId, { mcpResult: result });
      }

      return {
        success: true,
        message: 'Build updated successfully',
        data: { context },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.updateBuildStatus(buildId, 'failed', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  // Validate build progress
  private async validateBuild(buildId: string, request: AgentRequest): Promise<AgentResponse> {
    const context = this.getBuildContext(buildId);
    if (!context) {
      throw new Error('Build context not found');
    }

    try {
      // Perform validation checks
      const validationErrors = [];

      // Check required properties
      if (Object.keys(context.properties).length === 0) {
        validationErrors.push('No properties defined');
      }

      // Check dependencies
      for (const dep of context.dependencies) {
        if (!this.validateDependency(dep)) {
          validationErrors.push(`Missing dependency: ${dep}`);
        }
      }

      // Execute MCP validation if present
      if (request.operation) {
        try {
          await this.executeMCPOperation(request.operation);
        } catch (error) {
          validationErrors.push(`MCP validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      if (validationErrors.length > 0) {
        return {
          success: false,
          message: 'Build validation failed',
          error: validationErrors.join(', '),
          data: { context, validationErrors },
          timestamp: new Date().toISOString()
        };
      }

      return {
        success: true,
        message: 'Build validation successful',
        data: { context },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.updateBuildStatus(buildId, 'failed', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  // Complete the build process
  private async completeBuild(buildId: string, request: AgentRequest): Promise<AgentResponse> {
    const context = this.getBuildContext(buildId);
    if (!context) {
      throw new Error('Build context not found');
    }

    try {
      // Validate before completing
      const validation = await this.validateBuild(buildId, request);
      if (!validation.success) {
        throw new Error(`Cannot complete build: ${validation.error}`);
      }

      // Execute final MCP operation if present
      if (request.operation) {
        const result = await this.executeMCPOperation(request.operation);
        this.updateBuildProperties(buildId, { finalResult: result });
      }

      this.updateBuildStatus(buildId, 'complete');

      return {
        success: true,
        message: `Build completed for ${context.componentType}`,
        data: { context },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.updateBuildStatus(buildId, 'failed', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  // Validate a single dependency
  private validateDependency(dependency: string): boolean {
    // This could be enhanced with actual dependency validation logic
    return true;
  }

  // Clean up completed or failed builds
  cleanupBuild(buildId: string): void {
    this.buildContexts.delete(buildId);
  }
}
