import React from 'react';
import { format } from 'date-fns';
import { MessageSquarePlus, Trash2 } from 'lucide-react';
import { useAppStore } from '../store';
import type { ChatSession } from '../types';

export function ChatSidebar() {
  const { chatSessions, currentChatId, setCurrentChatId, addChatSession, deleteChatSession } = useAppStore();

  const createNewChat = () => {
    const newSession: ChatSession = {
      id: crypto.randomUUID(),
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    addChatSession(newSession);
    setCurrentChatId(newSession.id);
  };

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteChatSession(sessionId);
    if (currentChatId === sessionId) {
      setCurrentChatId(null);
    }
  };

  return (
    <div className="w-64 bg-gray-50 border-r border-gray-200 p-4 flex flex-col h-full">
      <button
        onClick={createNewChat}
        className="flex items-center justify-center space-x-2 w-full py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
      >
        <MessageSquarePlus size={20} />
        <span>New Chat</span>
      </button>

      <div className="mt-4 flex-1 overflow-y-auto">
        <div className="space-y-2">
          {chatSessions.map((session) => (
            <div
              key={session.id}
              onClick={() => setCurrentChatId(session.id)}
              className={`p-3 rounded-lg cursor-pointer flex justify-between items-start group ${
                currentChatId === session.id
                  ? 'bg-blue-100 text-blue-900'
                  : 'hover:bg-gray-100'
              }`}
            >
              <div className="flex-1 min-w-0">
                <h3 className="font-medium truncate">{session.title}</h3>
                <p className="text-sm text-gray-500">
                  {format(session.updatedAt, 'MMM d, yyyy')}
                </p>
              </div>
              <button
                onClick={(e) => handleDeleteSession(session.id, e)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded transition-opacity"
              >
                <Trash2 size={16} className="text-gray-500" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}