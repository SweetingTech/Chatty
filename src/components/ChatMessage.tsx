import React from 'react';
import { User, Bot, Paperclip } from 'lucide-react';
import type { ChatMessage as ChatMessageType, FileAttachment } from '../types/chat';

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} p-4`}
    >
      <div className={`flex items-start space-x-3 max-w-[80%] ${
        isUser ? 'bg-blue-50' : 'bg-white'
      } rounded-lg p-3`}>
        <div
          className={`p-2 rounded-full ${
            isUser ? 'bg-blue-500 text-white' : 'bg-gray-100'
          }`}
        >
          {isUser ? <User size={20} /> : <Bot size={20} />}
        </div>
        <div className="flex-1">
          <div className="font-medium">{isUser ? 'You' : 'Assistant'}</div>
          <div className="mt-1">
            <div className="text-gray-700 whitespace-pre-wrap">
              {message.content}
            </div>
            {message.files && message.files.length > 0 && (
              <div className="mt-2 space-y-1">
                {message.files.map((file: FileAttachment) => (
                  <div
                    key={file.name}
                    className="flex items-center space-x-2 text-sm text-gray-600 bg-gray-50 rounded p-2"
                  >
                    <Paperclip size={14} />
                    <span>{file.name}</span>
                    <span className="text-gray-400">
                      {new Date(file.uploadedAt).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="text-xs text-gray-400 self-end ml-2">
          {new Date(message.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}
