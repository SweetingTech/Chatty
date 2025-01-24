import { nanoid } from 'nanoid';

export interface ModelContext {
  id: string;
  model: string;
  context: string[];
  metadata: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

export interface ModelResponse {
  id: string;
  content: string;
  model: string;
  contextId: string;
  metadata: Record<string, any>;
  timestamp: number;
}

class ModelContextProtocol {
  private static instance: ModelContextProtocol;
  private contexts: Map<string, ModelContext>;
  private responses: Map<string, ModelResponse[]>;

  private constructor() {
    this.contexts = new Map();
    this.responses = new Map();
  }

  public static getInstance(): ModelContextProtocol {
    if (!ModelContextProtocol.instance) {
      ModelContextProtocol.instance = new ModelContextProtocol();
    }
    return ModelContextProtocol.instance;
  }

  public createContext(model: string, initialContext: string[] = [], metadata: Record<string, any> = {}): ModelContext {
    const context: ModelContext = {
      id: nanoid(),
      model,
      context: initialContext,
      metadata,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.contexts.set(context.id, context);
    this.responses.set(context.id, []);
    return context;
  }

  public updateContext(contextId: string, updates: Partial<ModelContext>): ModelContext {
    const context = this.contexts.get(contextId);
    if (!context) {
      throw new Error(`Context not found: ${contextId}`);
    }

    const updatedContext = {
      ...context,
      ...updates,
      updatedAt: Date.now(),
    };

    this.contexts.set(contextId, updatedContext);
    return updatedContext;
  }

  public addResponse(
    contextId: string,
    content: string,
    metadata: Record<string, any> = {}
  ): ModelResponse {
    const context = this.contexts.get(contextId);
    if (!context) {
      throw new Error(`Context not found: ${contextId}`);
    }

    const response: ModelResponse = {
      id: nanoid(),
      content,
      model: context.model,
      contextId,
      metadata,
      timestamp: Date.now(),
    };

    const responses = this.responses.get(contextId) || [];
    this.responses.set(contextId, [...responses, response]);
    return response;
  }

  public getContext(contextId: string): ModelContext | undefined {
    return this.contexts.get(contextId);
  }

  public getResponses(contextId: string): ModelResponse[] {
    return this.responses.get(contextId) || [];
  }

  public getAllContexts(): ModelContext[] {
    return Array.from(this.contexts.values());
  }

  public deleteContext(contextId: string): void {
    this.contexts.delete(contextId);
    this.responses.delete(contextId);
  }

  public mergeContexts(contextIds: string[]): ModelContext {
    const contexts = contextIds
      .map((id) => this.contexts.get(id))
      .filter((c): c is ModelContext => !!c);

    if (contexts.length === 0) {
      throw new Error('No valid contexts found');
    }

    const mergedContext = this.createContext(
      contexts[0].model,
      contexts.flatMap((c) => c.context)
    );

    return mergedContext;
  }
}

export const mcp = ModelContextProtocol.getInstance();
