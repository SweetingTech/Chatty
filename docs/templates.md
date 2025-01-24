# Templates and Builder System

## Overview

The Multi-LLM application uses a template-based system for creating and managing tools, agents, and Model Context Protocol (MCP) connections. This system ensures consistency and makes it easy to share configurations across different instances.

## Template Formats

### Tool Template
```json
{
  "schema": "1.0.0",
  "type": "tool",
  "metadata": {
    "name": "Tool Name",
    "description": "Tool Description",
    "version": "1.0.0",
    "author": "Author Name",
    "tags": ["tag1", "tag2"]
  },
  "configuration": {
    "type": "function | api | cli",
    "config": {},
    "permissions": [],
    "requirements": []
  },
  "implementation": {
    "code": "// Tool implementation",
    "dependencies": [],
    "exports": []
  }
}
```

### Agent Template
```json
{
  "schema": "1.0.0",
  "type": "agent",
  "metadata": {
    "name": "Agent Name",
    "description": "Agent Description",
    "version": "1.0.0",
    "author": "Author Name",
    "tags": ["tag1", "tag2"]
  },
  "configuration": {
    "tools": ["tool1", "tool2"],
    "memory": {
      "type": "short_term | long_term",
      "capacity": 1000
    },
    "behavior": {
      "temperature": 0.7,
      "maxTokens": 4096,
      "stopSequences": []
    }
  },
  "implementation": {
    "initialization": "// Initialization code",
    "handlers": {},
    "cleanup": "// Cleanup code"
  }
}
```

### MCP Template
```json
{
  "schema": "1.0.0",
  "type": "mcp",
  "metadata": {
    "name": "MCP Name",
    "description": "MCP Description",
    "version": "1.0.0",
    "author": "Author Name",
    "tags": ["tag1", "tag2"]
  },
  "configuration": {
    "model": "model-name",
    "context": ["context1", "context2"],
    "connections": [],
    "apis": []
  },
  "implementation": {
    "preprocessors": [],
    "postprocessors": [],
    "errorHandlers": []
  }
}
```

## Builder Agent

The Builder Agent is responsible for creating new tools, agents, and MCPs from templates. It provides:

1. Template validation
2. Default value handling
3. ID generation
4. Configuration merging

### Usage

```typescript
import { builderAgent } from '../lib/builder/BuilderAgent';

// Create a tool
const tool = await builderAgent.createTool({
  metadata: {
    name: "My Tool",
    description: "Tool description"
  },
  configuration: {
    type: "function",
    config: {}
  }
});

// Create an agent
const agent = await builderAgent.createAgent({
  metadata: {
    name: "My Agent",
    description: "Agent description"
  },
  configuration: {
    tools: ["tool1", "tool2"]
  }
});

// Create an MCP
const mcp = await builderAgent.createMCP({
  metadata: {
    name: "My MCP",
    description: "MCP description"
  },
  configuration: {
    model: "gpt-4"
  }
});
```

## File Management

Templates can be:
1. Exported as JSON files
2. Imported via drag-and-drop
3. Modified through the UI
4. Shared between instances

## Best Practices

1. Always validate templates before use
2. Include comprehensive metadata
3. Document configuration options
4. Version templates appropriately
5. Test templates before deployment