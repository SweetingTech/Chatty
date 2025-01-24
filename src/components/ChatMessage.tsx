import React from 'react';
import { User, Bot } from 'lucide-react';
import type { ChatMessage as ChatMessageType } from '../types';

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={`flex items-start space-x-3 p-4 ${
        isUser ? 'bg-blue-50' : 'bg-white'
      }`}
    >
      <div
        className={`p-2 rounded-full ${
          isUser ? 'bg-blue-500 text-white' : 'bg-gray-100'
        }`}
      >
        {isUser ? <User size={20} /> : <Bot size={20} />}
      </div>
      <div className="flex-1">
        <div className="font-medium">{isUser ? 'You' : 'Assistant'}</div>
        <div className="mt-1 text-gray-700 whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
      <div className="text-xs text-gray-400">
        {new Date(message.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
}