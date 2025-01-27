export interface FileAttachment {
  name: string;
  type: string;
  uploadedAt: number;
}

export interface ChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: number;
  conversationId?: string;
  files?: FileAttachment[];
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
