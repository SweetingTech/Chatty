export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  conversationId?: string;
}

export interface ConversationState {
  id: string;
  messages: ChatMessage[];
  context: Record<string, any>;
  tools: Set<string>;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}
