import { nanoid } from 'nanoid';
import type { Agent, BuildRequest } from '../../types';
import type { Workflow, WorkflowStep, WorkflowResult } from './types';
import { routerAgent } from '../agents/RouterAgent';
import { builderAgent } from '../builder/BuilderAgent';

export class WorkflowManager {
  private static instance: WorkflowManager;
  private workflows: Map<string, Workflow>;
  private activeWorkflows: Set<string>;

  private constructor() {
    this.workflows = new Map();
    this.activeWorkflows = new Set();
  }

  public static getInstance(): WorkflowManager {
    if (!WorkflowManager.instance) {
      WorkflowManager.instance = new WorkflowManager();
    }
    return WorkflowManager.instance;
  }

  public async createWorkflow(
    name: string,
    description: string,
    initialAgent: Agent,
    input: unknown
  ): Promise<Workflow> {
    const workflow: Workflow = {
      id: nanoid(),
      name,
      description,
      steps: [],
      current_step: 0,
      status: 'pending',
      created_at: Date.now(),
      updated_at: Date.now(),
      metadata: {},
    };

    // Create initial step
    const initialStep: WorkflowStep = {
      id: nanoid(),
      stage: 'init',
      agent: initialAgent,
      action: 'initialize',
      status: 'pending',
      requires_approval: initialAgent.requires_approval || false,
      input,
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    workflow.steps.push(initialStep);
    this.workflows.set(workflow.id, workflow);
    return workflow;
  }

  public async executeWorkflow(workflowId: string): Promise<WorkflowResult> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    this.activeWorkflows.add(workflowId);
    workflow.status = 'in_progress';
    
    try {
      while (workflow.current_step < workflow.steps.length) {
        const step = workflow.steps[workflow.current_step];
        
        // Check if step needs approval
        if (step.requires_approval && step.status === 'pending') {
          step.status = 'waiting_approval';
          workflow.status = 'waiting_approval';
          return {
            success: false,
            workflow,
            output: undefined,
            error: 'Waiting for approval',
          };
        }

        // Execute step
        if (step.status === 'approved' || !step.requires_approval) {
          step.status = 'in_progress';
          
          const result = await this.executeStep(step);
          
          if (!result.success) {
            step.status = 'failed';
            step.error = result.error;
            workflow.status = 'failed';
            return result;
          }

          step.status = 'completed';
          step.output = result.output;

          // Check if we need to add more steps based on the output
          const newSteps = await this.planNextSteps(workflow, step);
          if (newSteps.length > 0) {
            workflow.steps.splice(workflow.current_step + 1, 0, ...newSteps);
          }

          workflow.current_step++;
        }
      }

      workflow.status = 'completed';
      this.activeWorkflows.delete(workflowId);
      
      return {
        success: true,
        workflow,
        output: workflow.steps[workflow.steps.length - 1].output,
      };
    } catch (error) {
      workflow.status = 'failed';
      this.activeWorkflows.delete(workflowId);
      
      return {
        success: false,
        workflow,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async executeStep(step: WorkflowStep): Promise<WorkflowResult> {
    try {
      switch (step.stage) {
        case 'routing':
          const routingResult = await routerAgent.routeRequest(step.input as string);
          if (routingResult.buildRequest) {
            return {
              success: true,
              workflow: this.workflows.get(step.id)!,
              output: routingResult.buildRequest,
            };
          }
          return {
            success: true,
            workflow: this.workflows.get(step.id)!,
            output: routingResult.agent,
          };

        case 'planning':
          if (step.agent.type === 'builder') {
            const buildPlan = await builderAgent.createBuildPlan(
              step.input as BuildRequest
            );
            return {
              success: true,
              workflow: this.workflows.get(step.id)!,
              output: buildPlan,
            };
          }
          break;

        // Add more stage handlers as needed
      }

      return {
        success: true,
        workflow: this.workflows.get(step.id)!,
        output: step.output,
      };
    } catch (error) {
      return {
        success: false,
        workflow: this.workflows.get(step.id)!,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async planNextSteps(
    workflow: Workflow,
    currentStep: WorkflowStep
  ): Promise<WorkflowStep[]> {
    const newSteps: WorkflowStep[] = [];

    // Add next steps based on current step's output and stage
    switch (currentStep.stage) {
      case 'routing':
        if (currentStep.output && typeof currentStep.output === 'object' && 'buildRequest' in currentStep.output) {
          // Need to create a new agent/tool
          newSteps.push({
            id: nanoid(),
            stage: 'planning',
            agent: Array.from(routerAgent['agents'].values()).find(a => a.type === 'builder')!,
            action: 'create_build_plan',
            status: 'pending',
            requires_approval: true,
            input: currentStep.output,
            created_at: Date.now(),
            updated_at: Date.now(),
          });
        }
        break;

      case 'planning':
        if (currentStep.output) {
          newSteps.push({
            id: nanoid(),
            stage: 'execution',
            agent: currentStep.agent,
            action: 'execute_plan',
            status: 'pending',
            requires_approval: true,
            input: currentStep.output,
            created_at: Date.now(),
            updated_at: Date.now(),
          });
        }
        break;
    }

    return newSteps;
  }

  public approveStep(workflowId: string, stepId: string): void {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const step = workflow.steps.find(s => s.id === stepId);
    if (!step) {
      throw new Error(`Step not found: ${stepId}`);
    }

    step.status = 'approved';
    step.updated_at = Date.now();
    workflow.updated_at = Date.now();
  }

  public rejectStep(workflowId: string, stepId: string, reason: string): void {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const step = workflow.steps.find(s => s.id === stepId);
    if (!step) {
      throw new Error(`Step not found: ${stepId}`);
    }

    step.status = 'rejected';
    step.error = reason;
    step.updated_at = Date.now();
    workflow.status = 'rejected';
    workflow.updated_at = Date.now();
  }

  public getWorkflow(workflowId: string): Workflow | undefined {
    return this.workflows.get(workflowId);
  }

  public getAllWorkflows(): Workflow[] {
    return Array.from(this.workflows.values());
  }

  public getActiveWorkflows(): Workflow[] {
    return Array.from(this.activeWorkflows).map(id => this.workflows.get(id)!);
  }
}

export const workflowManager = WorkflowManager.getInstance();