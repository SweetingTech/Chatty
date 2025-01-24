import { nanoid } from 'nanoid';
import type { Agent, BuildRequest } from '../../types';
import { builderAgent } from '../builder/BuilderAgent';
import { useAppStore } from '../../store';

export class RouterAgent {
  private static instance: RouterAgent;
  private agents: Map<string, Agent>;

  private constructor() {
    this.agents = new Map();
    this.initializeAgents();
  }

  public static getInstance(): RouterAgent {
    if (!RouterAgent.instance) {
      RouterAgent.instance = new RouterAgent();
    }
    return RouterAgent.instance;
  }

  private async initializeAgents() {
    const { agents } = useAppStore.getState();
    agents.forEach(agent => this.agents.set(agent.id, agent));
  }

  public async routeRequest(request: string): Promise<{
    agent: Agent | null;
    response: string;
    buildRequest?: BuildRequest;
  }> {
    // Analyze request to determine appropriate agent
    const analysis = await this.analyzeRequest(request);
    
    if (!analysis.agent) {
      // No suitable agent found, suggest creating one
      const buildRequest: BuildRequest = {
        type: 'agent',
        purpose: analysis.purpose,
        requirements: analysis.requirements,
        suggested_tools: analysis.suggested_tools,
        suggested_apis: analysis.suggested_apis,
      };

      return {
        agent: null,
        response: `No suitable agent found for this request. I suggest creating a new agent with the following specifications:\n\n${JSON.stringify(buildRequest, null, 2)}`,
        buildRequest,
      };
    }

    return {
      agent: analysis.agent,
      response: `Routing request to ${analysis.agent.name}`,
    };
  }

  private async analyzeRequest(request: string): Promise<{
    agent: Agent | null;
    purpose: string;
    requirements: string[];
    suggested_tools?: string[];
    suggested_apis?: string[];
  }> {
    // Implement request analysis logic here
    // This is a placeholder implementation
    const agents = Array.from(this.agents.values());
    
    // Simple keyword matching for now
    for (const agent of agents) {
      if (request.toLowerCase().includes(agent.name.toLowerCase()) ||
          request.toLowerCase().includes(agent.description.toLowerCase())) {
        return {
          agent,
          purpose: request,
          requirements: [],
        };
      }
    }

    // No suitable agent found
    return {
      agent: null,
      purpose: request,
      requirements: ['Handle ' + request],
      suggested_tools: [],
      suggested_apis: [],
    };
  }

  public registerAgent(agent: Agent) {
    this.agents.set(agent.id, agent);
  }

  public unregisterAgent(agentId: string) {
    this.agents.delete(agentId);
  }

  public getRegisteredAgents(): Agent[] {
    return Array.from(this.agents.values());
  }
}

export const routerAgent = RouterAgent.getInstance();