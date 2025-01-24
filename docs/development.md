# Development Guide

## Overview

This guide provides development setup instructions and best practices for the Multi-LLM application, including Model Context Protocol (MCP) integration.

## Setup

### 1. Prerequisites
- Node.js 18+ (required for MCP servers)
- Python 3.8+ (for ChromaDB)
- Git
- VSCode (recommended)

### 2. Installation
```bash
# Clone repository
git clone <repository-url>
cd chatty

# Install dependencies
npm install

# Install Python dependencies
pip install -r requirements.txt

# Copy environment files
cp .env.example .env
```

### 3. Environment Configuration
```env
# Service URLs
VITE_WEAVIATE_URL=http://localhost:8080
VITE_LM_STUDIO_URL=http://localhost:5000
VITE_CHROMA_URL=http://localhost:8000

# API Keys
VITE_OPENAI_API_KEY=your-key-here
VITE_CLAUDE_API_KEY=your-key-here

# ChromaDB Configuration
CHROMA_HOST=localhost
CHROMA_PORT=8000
CHROMA_COLLECTION_NAME=chat_sessions
```

### 4. MCP Setup
1. Create MCP configuration file:
```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "./allowed/paths"
      ]
    }
  }
}
```

2. Install MCP servers:
```bash
# Install common MCP servers
npm install @modelcontextprotocol/server-filesystem
npm install @modelcontextprotocol/server-browser
npm install @modelcontextprotocol/server-git
```

## Project Structure

```
chatty/
├── docs/               # Documentation
├── src/               # Source code
│   ├── components/    # React components
│   ├── lib/          # Core libraries
│   │   ├── agents/   # Agent implementations
│   │   ├── tools/    # Tool implementations
│   │   └── mcp/      # MCP integrations
│   ├── pages/        # React pages
│   └── store/        # State management
├── scripts/          # Build/setup scripts
└── tests/           # Test files
```

## Development Workflow

### 1. Starting Development Server
```bash
# Start ChromaDB
python start_chroma.py

# Start development server
npm run dev
```

### 2. Running Tests
```bash
# Run all tests
npm test

# Run specific test suite
npm test -- agents
npm test -- tools
npm test -- mcp
```

### 3. Building for Production
```bash
# Build application
npm run build

# Preview production build
npm run preview
```

## Adding New Features

### 1. Adding New Agents
```typescript
// src/lib/agents/custom-agent.ts
import { BaseAgent } from './base';

export class CustomAgent extends BaseAgent {
  constructor() {
    super('custom-agent');
  }

  async process(input: string): Promise<string> {
    // Implementation
  }
}
```

### 2. Adding New Tools
```typescript
// src/lib/tools/custom-tool.ts
import { BaseTool } from './base';

export class CustomTool extends BaseTool {
  constructor() {
    super('custom-tool');
  }

  async execute(params: unknown): Promise<unknown> {
    // Implementation
  }
}
```

### 3. Adding New MCP Integration
```typescript
// src/lib/mcp/custom-mcp.ts
import { MCPClient } from './base';

export class CustomMCP extends MCPClient {
  constructor() {
    super('custom-mcp');
  }

  async initialize(): Promise<void> {
    // Setup MCP connection
  }
}
```

## Testing

### 1. Unit Tests
```typescript
// tests/agents/custom-agent.test.ts
import { CustomAgent } from '../src/lib/agents/custom-agent';

describe('CustomAgent', () => {
  it('processes input correctly', async () => {
    const agent = new CustomAgent();
    const result = await agent.process('test input');
    expect(result).toBeDefined();
  });
});
```

### 2. Integration Tests
```typescript
// tests/integration/mcp.test.ts
import { MCPRegistry } from '../src/lib/mcp/registry';

describe('MCP Integration', () => {
  it('connects to MCP server', async () => {
    const registry = new MCPRegistry();
    await registry.initialize();
    expect(registry.isConnected()).toBe(true);
  });
});
```

### 3. E2E Tests
```typescript
// tests/e2e/workflow.test.ts
describe('Complete Workflow', () => {
  it('processes user request', async () => {
    // Test complete workflow
  });
});
```

## Debugging

### 1. VSCode Launch Configuration
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Server",
      "program": "${workspaceFolder}/src/server/index.ts",
      "outFiles": ["${workspaceFolder}/dist/**/*.js"]
    }
  ]
}
```

### 2. Chrome DevTools
- Network tab for API calls
- Console for logs
- React DevTools for component debugging
- Redux DevTools for state debugging

### 3. MCP Debugging
```typescript
// Enable MCP debug logging
const registry = new MCPRegistry({
  debug: true,
  logLevel: 'verbose'
});
```

## Best Practices

### 1. Code Style
- Use TypeScript
- Follow ESLint rules
- Write JSDoc comments
- Use meaningful names

### 2. Git Workflow
- Feature branches
- Descriptive commits
- Pull request reviews
- Version tagging

### 3. Documentation
- Update README
- Document APIs
- Update CHANGELOG
- Write tests

### 4. Performance
- Lazy loading
- Code splitting
- Resource caching
- Bundle optimization

## Troubleshooting

### 1. Common Issues
- Port conflicts
- Missing dependencies
- Environment variables
- Type errors

### 2. MCP Issues
- Server connection
- Permission errors
- Operation timeouts
- Resource limits

### 3. Build Issues
- Cache clearing
- Dependency conflicts
- TypeScript errors
- Bundle size

## Resources

### 1. Documentation
- [Architecture Overview](./architecture.md)
- [MCP Integration](./mcp.md)
- [Security Guidelines](./security.md)
- [API Reference](./api.md)

### 2. External Links
- [React Documentation](https://reactjs.org)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [MCP Specification](https://mcp.dev)
- [Vite Guide](https://vitejs.dev/guide)
