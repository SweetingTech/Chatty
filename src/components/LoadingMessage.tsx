import React from 'react';
import { Bot } from 'lucide-react';

export function LoadingMessage() {
  return (
    <div className="flex justify-start p-4">
      <div className="flex items-start space-x-3">
        <div className="p-2 rounded-full bg-gray-100">
          <Bot size={20} />
        </div>
        <div className="flex-1">
          <div className="font-medium">Assistant</div>
          <div className="mt-1">
            <div className="loader">
              <div className="dot"></div>
              <div className="dot"></div>
              <div className="dot"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
