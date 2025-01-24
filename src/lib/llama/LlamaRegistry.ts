import { nanoid } from 'nanoid';
import type { Agent, Tool } from '../../types';
import type { LlamaAgentState, LlamaContext } from './types';

export class LlamaRegistry {
  private static instance: LlamaRegistry;
  private agents: Map<string, Agent>;
  private tools: Map<string, Tool>;
  private states: Map<string, LlamaAgentState>;
  private contexts: Map<string, LlamaContext>;

  private constructor() {
    this.agents = new Map();
    this.tools = new Map();
    this.states = new Map();
    this.contexts = new Map();
  }

  public static getInstance(): LlamaRegistry {
    if (!LlamaRegistry.instance) {
      LlamaRegistry.instance = new LlamaRegistry();
    }
    return LlamaRegistry.instance;
  }

  // Agent Management
  public registerAgent(agent: Agent): void {
    this.agents.set(agent.id, agent);
  }

  public unregisterAgent(agentId: string): void {
    this.agents.delete(agentId);
  }

  public getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  public getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  // Tool Management
  public registerTool(tool: Tool): void {
    this.tools.set(tool.id, tool);
  }

  public unregisterTool(toolId: string): void {
    this.tools.delete(toolId);
  }

  public getTool(toolId: string): Tool | undefined {
    return this.tools.get(toolId);
  }

  public getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  // State Management
  public createState(agentId: string): LlamaAgentState {
    const state: LlamaAgentState = {
      id: nanoid(),
      agent_id: agentId,
      context: this.createContext(),
      tool_calls: [],
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    this.states.set(state.id, state);
    return state;
  }

  public getState(stateId: string): LlamaAgentState | undefined {
    return this.states.get(stateId);
  }

  public updateState(stateId: string, updates: Partial<LlamaAgentState>): void {
    const state = this.states.get(stateId);
    if (state) {
      Object.assign(state, updates, { updated_at: Date.now() });
      this.states.set(stateId, state);
    }
  }

  // Context Management
  private createContext(): LlamaContext {
    const context: LlamaContext = {
      id: nanoid(),
      variables: {},
      memory: [],
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    this.contexts.set(context.id, context);
    return context;
  }

  public getContext(contextId: string): LlamaContext | undefined {
    return this.contexts.get(contextId);
  }

  public updateContext(contextId: string, updates: Partial<LlamaContext>): void {
    const context = this.contexts.get(contextId);
    if (context) {
      Object.assign(context, updates, { updated_at: Date.now() });
      this.contexts.set(contextId, context);
    }
  }
}

export const llamaRegistry = LlamaRegistry.getInstance();