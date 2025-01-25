export interface ChatMessage {
  conversationId: string;
  message: string;
  timestamp?: string;
}

export interface ConversationState {
  id: string;
  messages: ChatMessage[];
  context: Record<string, any>;
  tools: Set<string>;
}
