# Testing Guidelines

## Overview

This document outlines testing procedures and requirements for the Multi-LLM application, including Model Context Protocol (MCP) testing.

## Test Types

### 1. Unit Tests
- Individual component testing
- Isolated functionality
- Mock dependencies
- Quick execution

#### Example: Agent Test
```typescript
import { ChatAgent } from '../src/lib/agents/chat';
import { mockMCP } from '../test/mocks/mcp';

describe('ChatAgent', () => {
  let agent: ChatAgent;
  
  beforeEach(() => {
    agent = new ChatAgent();
    agent.setMCP(mockMCP);
  });

  it('processes messages correctly', async () => {
    const result = await agent.process('test message');
    expect(result).toBeDefined();
  });

  it('handles MCP operations', async () => {
    const result = await agent.saveConversation('test-id', 'content');
    expect(mockMCP.write).toHaveBeenCalled();
  });
});
```

### 2. Integration Tests
- Component interaction testing
- Real dependencies
- System integration
- Comprehensive coverage

#### Example: MCP Integration
```typescript
import { MCPRegistry } from '../src/lib/mcp/registry';
import { FileSystemMCP } from '../src/lib/mcp/filesystem';

describe('MCP Integration', () => {
  let registry: MCPRegistry;
  
  beforeAll(async () => {
    registry = new MCPRegistry();
    await registry.initialize();
  });

  it('registers MCP servers', async () => {
    const fsMCP = new FileSystemMCP();
    await registry.register(fsMCP);
    expect(registry.getServer('filesystem')).toBeDefined();
  });

  it('executes MCP operations', async () => {
    const result = await registry.execute('filesystem', {
      operation: 'write',
      path: 'test.txt',
      content: 'test'
    });
    expect(result).toEqual({ success: true });
  });
});
```

### 3. E2E Tests
- Complete workflow testing
- User interaction simulation
- Real environment
- Full system testing

#### Example: Workflow Test
```typescript
import { WorkflowManager } from '../src/lib/workflow';
import { AgentRegistry } from '../src/lib/agents/registry';

describe('Complete Workflow', () => {
  let workflow: WorkflowManager;
  
  beforeAll(async () => {
    workflow = new WorkflowManager();
    await workflow.initialize();
  });

  it('processes user request end-to-end', async () => {
    const result = await workflow.execute({
      type: 'chat',
      input: 'Save this message',
      mcpOperations: ['filesystem.write']
    });
    
    expect(result.status).toBe('completed');
    expect(result.mcpResults).toBeDefined();
  });
});
```

## Test Coverage

### 1. Required Coverage
- Agents: 90%
- Tools: 90%
- MCPs: 95%
- Core Logic: 95%
- UI Components: 80%

### 2. Coverage Report
```bash
# Generate coverage report
npm run test:coverage

# Coverage thresholds
{
  "global": {
    "branches": 85,
    "functions": 90,
    "lines": 90,
    "statements": 90
  }
}
```

## Test Environment

### 1. Setup
```typescript
// test/setup.ts
import { TestEnvironment } from './environment';

beforeAll(async () => {
  await TestEnvironment.initialize({
    mockMCP: true,
    mockLLM: true,
    mockDB: true
  });
});

afterAll(async () => {
  await TestEnvironment.cleanup();
});
```

### 2. Mocks
```typescript
// test/mocks/mcp.ts
export const mockMCP = {
  execute: jest.fn(),
  initialize: jest.fn(),
  cleanup: jest.fn()
};

// test/mocks/llm.ts
export const mockLLM = {
  generate: jest.fn(),
  embed: jest.fn()
};
```

### 3. Fixtures
```typescript
// test/fixtures/agents.ts
export const testAgents = {
  chat: {
    id: 'test-chat',
    type: 'chat',
    config: {}
  }
};

// test/fixtures/mcp.ts
export const testMCPOperations = {
  write: {
    operation: 'write',
    path: 'test.txt',
    content: 'test'
  }
};
```

## Test Categories

### 1. Functionality Tests
- Core features
- Edge cases
- Error handling
- Recovery procedures

### 2. Security Tests
- Input validation
- Permission checks
- MCP security
- Authentication

### 3. Performance Tests
- Response times
- Resource usage
- Concurrent operations
- Load testing

## Test Automation

### 1. CI/CD Pipeline
```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Install dependencies
        run: npm install
      - name: Run tests
        run: npm test
      - name: Upload coverage
        uses: codecov/codecov-action@v2
```

### 2. Pre-commit Hooks
```json
{
  "hooks": {
    "pre-commit": "npm run test:quick",
    "pre-push": "npm run test"
  }
}
```

### 3. Test Scripts
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:quick": "jest --bail",
    "test:e2e": "cypress run"
  }
}
```

## Best Practices

### 1. Test Organization
- Group by feature
- Clear descriptions
- Consistent naming
- Proper setup/teardown

### 2. Test Quality
- Single responsibility
- Independent tests
- Meaningful assertions
- Proper mocking

### 3. Maintenance
- Regular updates
- Remove obsolete tests
- Update dependencies
- Document changes

## Troubleshooting

### 1. Common Issues
- Flaky tests
- Timeout errors
- Resource leaks
- Mock failures

### 2. Debug Tools
- Jest debugger
- Chrome DevTools
- VSCode debugger
- Console logging

### 3. Solutions
- Increase timeouts
- Clean up resources
- Update mocks
- Fix race conditions

## Resources

### 1. Documentation
- [Jest Documentation](https://jestjs.io/docs)
- [Testing Library](https://testing-library.com)
- [Cypress Guides](https://docs.cypress.io)
- [MCP Testing](./mcp.md#testing)

### 2. Tools
- Jest
- Testing Library
- Cypress
- Istanbul (coverage)

### 3. Examples
- [Test Examples](./examples/tests)
- [E2E Examples](./examples/e2e)
- [Mock Examples](./examples/mocks)
