# Agent Workflow System

## Overview

The Multi-LLM application implements a structured workflow system for managing agent interactions and task execution. This document describes the workflow system's architecture and components.

## Workflow Stages

1. **Init**
   - Initial stage for new workflows
   - Sets up context and validates inputs

2. **Routing**
   - Router agent analyzes request
   - Determines appropriate agent or suggests creation

3. **Planning**
   - Builder agent creates execution plan
   - Defines required components and steps

4. **Approval**
   - Human review of proposed actions
   - Required for sensitive operations

5. **Execution**
   - Agents perform their tasks
   - Tools and APIs are utilized

6. **Completion**
   - Results are collected and validated
   - Workflow is marked as complete

## Workflow Status

- `pending`: Awaiting start
- `in_progress`: Currently executing
- `waiting_approval`: Needs human approval
- `approved`: Step approved, ready to continue
- `rejected`: Step rejected, workflow stopped
- `completed`: Successfully finished
- `failed`: Error occurred

## Components

### WorkflowManager

- Singleton class managing all workflows
- Creates and executes workflow instances
- Handles approval/rejection logic
- Tracks active workflows

### WorkflowStep

- Represents a single step in the workflow
- Contains agent, action, and status
- Manages input/output data
- Tracks approval requirements

## Example Workflow

1. User sends request to chat agent
2. Router agent analyzes request
3. If existing agent found:
   - Request is routed to agent
   - Agent executes task
   - Results returned to user

4. If no agent exists:
   - Builder agent creates plan
   - Plan awaits approval
   - New agent/tool created
   - Original request processed

## Usage

```typescript
// Create new workflow
const workflow = await workflowManager.createWorkflow(
  'Process User Request',
  'Handle user query about data analysis',
  chatAgent,
  userQuery
);

// Execute workflow
const result = await workflowManager.executeWorkflow(workflow.id);

// Handle approval requests
if (result.workflow.status === 'waiting_approval') {
  // Show approval UI to user
  workflowManager.approveStep(workflow.id, currentStep.id);
  // or
  workflowManager.rejectStep(workflow.id, currentStep.id, 'Invalid action');
}
```

## Best Practices

1. Always check step requirements
2. Handle approval states appropriately
3. Implement proper error handling
4. Monitor active workflows
5. Clean up completed workflows

## Security Considerations

- Validate all inputs
- Enforce approval requirements
- Log all workflow actions
- Monitor for suspicious patterns
- Regular security audits