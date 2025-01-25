import { BaseAgent } from './base';
import { AgentRequest, AgentResponse } from '../../types/agent';
import { MCPClient } from '../mcp';

interface FeedbackEntry {
  id: string;
  source: string;
  content: string;
  category: 'success' | 'error' | 'improvement' | 'general';
  timestamp: string;
  processed: boolean;
  insights?: string[];
}

interface LearningModel {
  id: string;
  name: string;
  version: string;
  lastUpdated: string;
  metrics: Record<string, number>;
  parameters: Record<string, any>;
}

interface LearningSession {
  id: string;
  modelId: string;
  startTime: string;
  endTime?: string;
  feedbackProcessed: number;
  improvements: string[];
  status: 'active' | 'completed' | 'failed';
  error?: string;
}

export class LearningAgent extends BaseAgent {
  private feedback: Map<string, FeedbackEntry>;
  private models: Map<string, LearningModel>;
  private sessions: Map<string, LearningSession>;

  constructor(mcpClient: MCPClient) {
    super(mcpClient);
    this.feedback = new Map();
    this.models = new Map();
    this.sessions = new Map();
  }

  // Add new feedback
  addFeedback(entry: Omit<FeedbackEntry, 'processed'>): FeedbackEntry {
    const feedbackEntry: FeedbackEntry = {
      ...entry,
      processed: false,
      timestamp: entry.timestamp || new Date().toISOString()
    };
    this.feedback.set(entry.id, feedbackEntry);
    return feedbackEntry;
  }

  // Get feedback by ID
  getFeedback(id: string): FeedbackEntry | undefined {
    return this.feedback.get(id);
  }

  // Register a learning model
  registerModel(model: LearningModel): void {
    if (this.models.has(model.id)) {
      throw new Error(`Model ${model.id} already registered`);
    }
    this.models.set(model.id, model);
  }

  // Get model by ID
  getModel(id: string): LearningModel | undefined {
    return this.models.get(id);
  }

  protected async processRequest(request: AgentRequest): Promise<AgentResponse> {
    try {
      const { action } = request.payload;

      // Process learning action
      switch (action) {
        case 'learn':
          return await this.startLearningSession(request);
        case 'process_feedback':
          return await this.processFeedback(request);
        case 'update_model':
          return await this.updateModel(request);
        case 'get_insights':
          return await this.getInsights(request);
        default:
          throw new Error(`Unknown learning action: ${action}`);
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  // Start a new learning session
  private async startLearningSession(request: AgentRequest): Promise<AgentResponse> {
    const { modelId } = request.payload;
    const model = this.getModel(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    const session: LearningSession = {
      id: `session-${Date.now()}`,
      modelId,
      startTime: new Date().toISOString(),
      feedbackProcessed: 0,
      improvements: [],
      status: 'active'
    };

    try {
      // Execute MCP operation if present
      if (request.operation) {
        const result = await this.executeMCPOperation(request.operation);
        session.improvements.push(...(result.improvements || []));
      }

      this.sessions.set(session.id, session);

      return {
        success: true,
        message: `Learning session started with model ${model.name}`,
        data: { session, model },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      session.status = 'failed';
      session.error = error instanceof Error ? error.message : 'Unknown error';
      this.sessions.set(session.id, session);
      throw error;
    }
  }

  // Process feedback entries
  private async processFeedback(request: AgentRequest): Promise<AgentResponse> {
    const { sessionId, feedbackIds } = request.payload;
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (session.status !== 'active') {
      throw new Error(`Session ${sessionId} is not active`);
    }

    const processedFeedback: FeedbackEntry[] = [];
    const errors: string[] = [];

    try {
      // Process each feedback entry
      for (const feedbackId of feedbackIds) {
        const feedback = this.getFeedback(feedbackId);
        if (!feedback) {
          errors.push(`Feedback ${feedbackId} not found`);
          continue;
        }

        try {
          // Execute MCP operation for feedback processing
          if (request.operation) {
            const result = await this.executeMCPOperation({
              ...request.operation,
              args: { ...request.operation.args, feedback }
            });
            feedback.insights = result.insights;
          }

          feedback.processed = true;
          this.feedback.set(feedbackId, feedback);
          processedFeedback.push(feedback);
          session.feedbackProcessed++;
        } catch (error) {
          errors.push(`Failed to process feedback ${feedbackId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      return {
        success: errors.length === 0,
        message: `Processed ${processedFeedback.length} feedback entries`,
        data: { session, processedFeedback, errors },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Feedback processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Update learning model
  private async updateModel(request: AgentRequest): Promise<AgentResponse> {
    const { modelId, updates } = request.payload;
    const model = this.getModel(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    try {
      // Execute MCP operation for model update
      if (request.operation) {
        const result = await this.executeMCPOperation(request.operation);
        Object.assign(model.parameters, result.parameters || {});
        Object.assign(model.metrics, result.metrics || {});
      }

      model.version = updates.version || model.version;
      model.lastUpdated = new Date().toISOString();
      this.models.set(modelId, model);

      return {
        success: true,
        message: `Model ${model.name} updated successfully`,
        data: { model },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Model update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get learning insights
  private async getInsights(request: AgentRequest): Promise<AgentResponse> {
    const { modelId, sessionId } = request.payload;
    const model = this.getModel(modelId);
    const session = this.sessions.get(sessionId);

    if (!model || !session) {
      throw new Error('Invalid model or session ID');
    }

    // Get all processed feedback for the session
    const sessionFeedback = Array.from(this.feedback.values())
      .filter(f => f.processed && f.insights && f.insights.length > 0);

    // Aggregate insights
    const insights = {
      totalFeedbackProcessed: session.feedbackProcessed,
      improvements: session.improvements,
      categories: new Map<string, number>(),
      topInsights: new Set<string>()
    };

    sessionFeedback.forEach(feedback => {
      // Count feedback categories
      insights.categories.set(
        feedback.category,
        (insights.categories.get(feedback.category) || 0) + 1
      );

      // Collect unique insights
      feedback.insights?.forEach(insight => insights.topInsights.add(insight));
    });

    return {
      success: true,
      message: 'Learning insights retrieved successfully',
      data: {
        model,
        session,
        insights: {
          ...insights,
          categories: Object.fromEntries(insights.categories),
          topInsights: Array.from(insights.topInsights)
        }
      },
      timestamp: new Date().toISOString()
    };
  }

  // Complete a learning session
  completeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session && session.status === 'active') {
      session.status = 'completed';
      session.endTime = new Date().toISOString();
      this.sessions.set(sessionId, session);
    }
  }

  // Clean up old feedback entries
  cleanupFeedback(maxAge: number): void {
    const cutoff = new Date(Date.now() - maxAge);
    for (const [id, entry] of this.feedback) {
      if (new Date(entry.timestamp) < cutoff && entry.processed) {
        this.feedback.delete(id);
      }
    }
  }
}
