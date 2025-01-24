import type { Agent, Tool, MCPConnection } from '../../types';

export type WorkflowStage = 
  | 'init'
  | 'routing'
  | 'planning'
  | 'approval'
  | 'execution'
  | 'completion'
  | 'error';

export type WorkflowStatus = 
  | 'pending'
  | 'in_progress'
  | 'waiting_approval'
  | 'approved'
  | 'rejected'
  | 'completed'
  | 'failed';

export interface WorkflowStep {
  id: string;
  stage: WorkflowStage;
  agent: Agent;
  action: string;
  status: WorkflowStatus;
  requires_approval: boolean;
  input?: unknown;
  output?: unknown;
  error?: string;
  created_at: number;
  updated_at: number;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  current_step: number;
  status: WorkflowStatus;
  created_at: number;
  updated_at: number;
  metadata: Record<string, unknown>;
}

export interface WorkflowResult {
  success: boolean;
  workflow: Workflow;
  output?: unknown;
  error?: string;
}