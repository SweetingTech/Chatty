import React from 'react';
import { User, Bot, Paperclip } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
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
      } rounded-lg p-3 shadow-sm border border-gray-100`}>
        <div
          className={`p-2 rounded-full mt-1 ${
            isUser ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
          }`}
        >
          {isUser ? <User size={20} /> : <Bot size={20} />}
        </div>
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="font-medium text-sm text-gray-500 mb-1">{isUser ? 'You' : 'Assistant'}</div>
          <div className="mt-1 text-gray-800 prose prose-sm max-w-none prose-pre:bg-gray-900 prose-pre:p-0 prose-pre:rounded-lg overflow-x-auto">
            {isUser ? (
              <div className="whitespace-pre-wrap">{message.content}</div>
            ) : (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code(props) {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
                    const {children, className, node, ref, ...rest} = props as any;
                    const match = /language-(\w+)/.exec(className || '');
                    return match ? (
                      <SyntaxHighlighter
                        {...rest}
                        PreTag="div"
                        children={String(children).replace(/\n$/, '')}
                        language={match[1]}
                        style={vscDarkPlus}
                        className="rounded-md my-2"
                      />
                    ) : (
                      <code {...rest} className="bg-gray-100 px-1.5 py-0.5 rounded text-sm text-pink-600 font-mono">
                        {children}
                      </code>
                    );
                  }
                }}
              >
                {message.content}
              </ReactMarkdown>
            )}

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
