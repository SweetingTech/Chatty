# Multi-LLM Agents

This document describes the built-in agents and their capabilities in the Multi-LLM system.

## Core Agents

### 1. Chat Agent
- **Purpose**: Handles general chat interactions and query processing
- **Configuration**:
  - LLM Provider selection
  - Model parameters
  - Personality traits
  - Response style
- **Tools**: 
  - Message history management
  - Context tracking
  - File attachment handling
  - MCP Tools:
    - Filesystem MCP for conversation storage
    - Browser MCP for web content
    - API MCPs for external services
- **Capabilities**:
  - Multi-turn conversations
  - Context-aware responses
  - File processing
  - Memory management
- **Personality Configuration**:
  - Traits customization
  - Tone selection
  - Style definition
  - Behavioral constraints

### 2. Router Agent
- **Purpose**: Analyzes and routes requests to appropriate agents
- **Tools**:
  - Request analysis
  - Agent matching
  - Build request generation
  - MCP Tools:
    - API MCPs for service health checks
    - Database MCPs for agent registry
- **Capabilities**:
  - Request classification
  - Agent selection
  - Missing agent detection
  - Build request creation
- **Workflow Integration**:
  - Initiates workflows
  - Coordinates with builder
  - Tracks request status
  - Manages responses

### 3. Builder Agent
- **Purpose**: Creates new agents, tools, and MCPs
- **Tools**:
  - Template management
  - Configuration validation
  - Component creation
  - MCP Tools:
    - Git MCP for version control
    - Filesystem MCP for component creation
- **Capabilities**:
  - Plan creation
  - Approval management
  - Component assembly
  - Integration testing
- **Security Features**:
  - Approval workflows
  - Validation checks
  - Permission management
  - Audit logging

### 4. Task Automation Agent
- **Purpose**: Handles automated workflows and task execution
- **Tools**:
  - Task scheduler
  - Workflow engine
  - Status monitoring
  - MCP Tools:
    - Docker MCP for containerization
    - Kubernetes MCP for orchestration
- **Capabilities**:
  - Task prioritization
  - Sequential execution
  - Error handling
  - Progress tracking

### 5. Integration Agent
- **Purpose**: Manages external service integrations
- **Tools**:
  - API connectors
  - Data transformers
  - Authentication manager
  - MCP Tools:
    - Database MCPs for data storage
    - API MCPs for service integration
- **Capabilities**:
  - API communication
  - Data format conversion
  - Error recovery
  - Rate limiting

### 6. Learning Agent
- **Purpose**: Improves system performance through feedback
- **Tools**:
  - Feedback collector
  - Performance analyzer
  - Model tuner
  - MCP Tools:
    - Vector Database MCPs for embeddings
    - Analytics MCPs for metrics
- **Capabilities**:
  - Pattern recognition
  - Performance optimization
  - Feedback incorporation
  - Continuous learning

## Agent Interactions

Agents work together through the Workflow System:
1. Request routing
2. Task delegation
3. Resource sharing
4. Result aggregation

## Agent Configuration

### LLM Configuration
```typescript
interface AgentLLMConfig {
  provider: 'lm-studio' | 'openai' | 'claude' | 'none';
  model?: string;
  temperature?: number;
  maxTokens?: number;
}
```

### Personality Configuration
```typescript
interface AgentPersonality {
  traits: string[];
  tone: string;
  style: string;
  constraints: string[];
}
```

### Agent Schema
```typescript
interface Agent {
  id: string;
  name: string;
  description: string;
  tools: string[];
  llmConfig: AgentLLMConfig;
  personality?: AgentPersonality;
  config: Record<string, unknown>;
  type: 'router' | 'builder' | 'chat' | 'custom';
  requires_approval?: boolean;
  mcp_tools?: string[]; // List of MCP tools the agent can use
}
```

## Creating Custom Agents

1. Define Configuration
```typescript
const agentConfig = {
  name: "Custom Agent",
  description: "Handles specific tasks",
  type: "custom",
  llmConfig: {
    provider: "openai",
    model: "gpt-4"
  },
  mcp_tools: ["filesystem", "browser"] // MCPs this agent can use
};
```

2. Select Tools
```typescript
const tools = [
  "web_search",
  "data_analysis",
  "file_handling"
];
```

3. Configure Personality
```typescript
const personality = {
  traits: ["professional", "efficient"],
  tone: "formal",
  style: "concise",
  constraints: ["no emojis"]
};
```

4. Create Agent
```typescript
const agent = await createAgent({
  ...agentConfig,
  tools,
  personality
});
```

## Best Practices

1. Agent Design
   - Clear purpose definition
   - Minimal tool selection
   - Appropriate permissions
   - Error handling
   - Careful MCP tool selection

2. Configuration
   - Validate settings
   - Test interactions
   - Document requirements
   - Monitor performance
   - Verify MCP permissions

3. Security
   - Implement approvals
   - Validate inputs
   - Audit actions
   - Regular reviews
   - MCP access control

4. Maintenance
   - Update configurations
   - Monitor performance
   - Review logs
   - Update documentation
   - Check MCP health
