# Tools System

## Overview

The Tools System provides a standardized way to extend agent capabilities through functions, APIs, CLI commands, and Model Context Protocol (MCP) servers. Tools can either be standalone or leverage MCP capabilities for enhanced functionality.

## Tool Types

### 1. Functions
- **Purpose**: Execute JavaScript/TypeScript code
- **Configuration**:
  ```typescript
  {
    type: 'function',
    config: {
      function: string,
      parameters: Record<string, unknown>,
      mcp_requirements?: string[] // MCPs required by this function
    }
  }
  ```
- **Security**:
  - Input validation
  - Type checking
  - Execution sandboxing
  - Error handling
  - MCP permission validation

### 2. APIs
- **Purpose**: External service integration
- **Configuration**:
  ```typescript
  {
    type: 'api',
    config: {
      endpoint: string,
      method: string,
      headers: Record<string, string>,
      timeout: number,
      mcp_integrations?: { // MCP integrations for enhanced API functionality
        auth?: string,    // e.g., "oauth-mcp"
        cache?: string,   // e.g., "redis-mcp"
        proxy?: string    // e.g., "proxy-mcp"
      }
    }
  }
  ```
- **Features**:
  - Request validation
  - Response parsing
  - Error handling
  - Rate limiting
  - MCP-powered capabilities

### 3. CLI Commands
- **Purpose**: System command execution
- **Configuration**:
  ```typescript
  {
    type: 'cli',
    config: {
      command: string,
      timeout: number,
      mcp_executor?: string // MCP to handle command execution
    }
  }
  ```
- **Security**:
  - Command whitelist
  - Argument sanitization
  - Resource limits
  - Output buffering
  - MCP permission checks

## Tool Schema

```typescript
interface Tool {
  id: string;
  name: string;
  description: string;
  type: 'function' | 'api' | 'cli';
  config: Record<string, unknown>;
  mcp_capabilities?: {
    required: string[];    // Required MCP servers
    optional: string[];    // Optional MCP enhancements
    permissions: string[]; // Required MCP permissions
  };
}
```

## Tool Templates

### Function Template with MCP Integration
```json
{
  "schema": "1.0.0",
  "type": "tool",
  "metadata": {
    "name": "File Search Tool",
    "description": "Search files with MCP filesystem capabilities",
    "version": "1.0.0",
    "author": "Author Name",
    "tags": ["filesystem", "search"]
  },
  "configuration": {
    "type": "function",
    "config": {
      "mcp_requirements": ["filesystem"]
    },
    "permissions": ["read"],
    "requirements": []
  },
  "implementation": {
    "code": "// Tool implementation using MCP filesystem",
    "dependencies": ["@modelcontextprotocol/sdk"],
    "exports": []
  }
}
```

### API Template with MCP Enhancement
```json
{
  "schema": "1.0.0",
  "type": "tool",
  "metadata": {
    "name": "Enhanced API Tool",
    "description": "API Integration with MCP capabilities"
  },
  "configuration": {
    "type": "api",
    "config": {
      "endpoint": "",
      "method": "GET",
      "headers": {},
      "timeout": 30000,
      "mcp_integrations": {
        "auth": "oauth-mcp",
        "cache": "redis-mcp"
      }
    }
  }
}
```

### CLI Template with MCP Execution
```json
{
  "schema": "1.0.0",
  "type": "tool",
  "metadata": {
    "name": "Secure CLI Tool",
    "description": "Command Line Tool with MCP security"
  },
  "configuration": {
    "type": "cli",
    "config": {
      "command": "",
      "timeout": 30000,
      "mcp_executor": "secure-shell-mcp"
    }
  }
}
```

## Tool Execution

### Function Execution with MCP
```typescript
private async executeFunction(tool: Tool, input: unknown): Promise<unknown> {
  // Validate MCP requirements
  await this.validateMCPRequirements(tool.mcp_capabilities?.required);
  
  // Validate input
  const validatedInput = validateFunctionInput(input, tool.config.parameters);
  
  // Execute function with MCP context
  const mcpContext = await this.getMCPContext(tool.mcp_capabilities);
  const func = new Function(...params, tool.config.function);
  return func(...args, mcpContext);
}
```

### API Execution with MCP
```typescript
private async executeAPI(tool: Tool, input: unknown): Promise<unknown> {
  // Set up MCP integrations
  const mcpIntegrations = await this.setupMCPIntegrations(tool.config.mcp_integrations);
  
  // Build request with MCP enhancements
  const request = buildAPIRequest(tool.config, input, mcpIntegrations);
  
  // Execute request
  const response = await fetch(request);
  return parseResponse(response);
}
```

### CLI Execution with MCP
```typescript
private async executeCLI(tool: Tool, input: unknown): Promise<unknown> {
  // Get MCP executor if configured
  const executor = tool.config.mcp_executor 
    ? await this.getMCPExecutor(tool.config.mcp_executor)
    : null;
    
  // Sanitize command
  const command = sanitizeCommand(tool.config.command);
  const args = sanitizeArgs(input);
  
  // Execute command through MCP or directly
  return executor 
    ? executor.execute(command, args)
    : executeCommand(command, args);
}
```

## Security Considerations

### Input Validation
- Type checking
- Schema validation
- Sanitization
- Size limits
- MCP permission checks

### Execution Safety
- Resource limits
- Timeouts
- Error handling
- Output validation
- MCP security boundaries

### Access Control
- Tool permissions
- User restrictions
- Rate limiting
- Audit logging
- MCP access management

## Best Practices

1. Tool Development
   - Clear documentation
   - Input validation
   - Error handling
   - Performance optimization
   - MCP integration testing

2. Security
   - Validate all inputs
   - Sanitize commands
   - Implement timeouts
   - Monitor usage
   - Verify MCP permissions

3. Maintenance
   - Version control
   - Testing
   - Documentation
   - Updates
   - MCP health checks
