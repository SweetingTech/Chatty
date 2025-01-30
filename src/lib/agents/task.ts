import { BaseAgent } from './base';
import { AgentRequest, AgentResponse } from '../../types/agent';
import { MCPClient } from '../mcp';

interface TaskStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  operation?: string;
  dependencies: string[];
  result?: any;
  error?: string;
}

interface TaskWorkflow {
  id: string;
  name: string;
  description: string;
  steps: Map<string, TaskStep>;
  currentStep?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  context: Record<string, any>;
}

export class TaskAgent extends BaseAgent {
  private workflows: Map<string, TaskWorkflow>;

  constructor(mcpClient: MCPClient) {
    super(mcpClient);
    this.workflows = new Map();
  }

  // Create a new workflow
  createWorkflow(id: string, name: string, description: string): TaskWorkflow {
    if (this.workflows.has(id)) {
      throw new Error(`Workflow ${id} already exists`);
    }

    const workflow: TaskWorkflow = {
      id,
      name,
      description,
      steps: new Map(),
      status: 'pending',
      context: {}
    };

    this.workflows.set(id, workflow);
    return workflow;
  }

  // Add a step to a workflow
  addWorkflowStep(workflowId: string, step: TaskStep): void {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    if (workflow.steps.has(step.id)) {
      throw new Error(`Step ${step.id} already exists in workflow ${workflowId}`);
    }

    workflow.steps.set(step.id, step);
  }

  // Get workflow by ID
  getWorkflow(id: string): TaskWorkflow | undefined {
    return this.workflows.get(id);
  }

  protected async processRequest(request: AgentRequest): Promise<AgentResponse> {
    try {
      const { workflowId, action } = request.payload;

      // Process workflow action
      switch (action) {
        case 'start':
          return await this.startWorkflow(workflowId, request);
        case 'step':
          return await this.executeStep(workflowId, request);
        case 'status':
          return await this.getWorkflowStatus(workflowId);
        case 'complete':
          return await this.completeWorkflow(workflowId);
        default:
          throw new Error(`Unknown workflow action: ${action}`);
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

  // Start workflow execution
  private async startWorkflow(workflowId: string, request: AgentRequest): Promise<AgentResponse> {
    const workflow = this.getWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    try {
      // Initialize workflow
      workflow.status = 'in_progress';
      workflow.context = request.payload.context || {};

      // Find first step
      const firstStep = this.findNextStep(workflow);
      if (!firstStep) {
        throw new Error('No executable steps found in workflow');
      }

      workflow.currentStep = firstStep.id;
      firstStep.status = 'in_progress';

      // Execute MCP operation if present
      if (request.operation) {
        const result = await this.executeMCPOperation(request.operation);
        workflow.context.mcpResult = result;
      }

      return {
        success: true,
        message: `Workflow ${workflow.name} started`,
        data: { workflow },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      workflow.status = 'failed';
      throw error;
    }
  }

  // Execute a workflow step
  private async executeStep(workflowId: string, request: AgentRequest): Promise<AgentResponse> {
    const workflow = this.getWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    if (!workflow.currentStep) {
      throw new Error('No current step in workflow');
    }

    const step = workflow.steps.get(workflow.currentStep);
    if (!step) {
      throw new Error(`Step ${workflow.currentStep} not found`);
    }

    try {
      // Execute step operation
      if (request.operation) {
        step.result = await this.executeMCPOperation(request.operation);
      }

      // Mark step as completed
      step.status = 'completed';

      // Find next step
      const nextStep = this.findNextStep(workflow);
      if (nextStep) {
        workflow.currentStep = nextStep.id;
        nextStep.status = 'in_progress';
      } else {
        workflow.currentStep = undefined;
        workflow.status = 'completed';
      }

      return {
        success: true,
        message: `Step ${step.name} completed`,
        data: { workflow, step },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      step.status = 'failed';
      step.error = error instanceof Error ? error.message : 'Unknown error';
      workflow.status = 'failed';
      throw error;
    }
  }

  // Get workflow status
  private async getWorkflowStatus(workflowId: string): Promise<AgentResponse> {
    const workflow = this.getWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    return {
      success: true,
      message: `Workflow status: ${workflow.status}`,
      data: {
        workflow,
        currentStep: workflow.currentStep ? workflow.steps.get(workflow.currentStep) : undefined,
        completedSteps: Array.from(workflow.steps.values()).filter(step => step.status === 'completed')
      },
      timestamp: new Date().toISOString()
    };
  }

  // Complete workflow
  private async completeWorkflow(workflowId: string): Promise<AgentResponse> {
    const workflow = this.getWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    // Verify all steps are completed
    const incompleteSteps = Array.from(workflow.steps.values())
      .filter(step => step.status !== 'completed');

    if (incompleteSteps.length > 0) {
      throw new Error(`Cannot complete workflow: ${incompleteSteps.length} steps incomplete`);
    }

    workflow.status = 'completed';
    workflow.currentStep = undefined;

    return {
      success: true,
      message: `Workflow ${workflow.name} completed`,
      data: { workflow },
      timestamp: new Date().toISOString()
    };
  }

  // Find next executable step in workflow
  private findNextStep(workflow: TaskWorkflow): TaskStep | undefined {
    return Array.from(workflow.steps.values()).find(step => {
      if (step.status !== 'pending') {
        return false;
      }

      // Check if all dependencies are completed
      return step.dependencies.every(depId => {
        const depStep = workflow.steps.get(depId);
        return depStep && depStep.status === 'completed';
      });
    });
  }

  // Clean up completed workflows
  cleanupWorkflow(workflowId: string): void {
    this.workflows.delete(workflowId);
  }
}
