import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { User, Bot, FileText, AlertCircle } from 'lucide-react';
import { Message, Role } from '../types';

interface MessageBubbleProps {
  message: Message;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === Role.USER;

  return (
    <div className={`group w-full text-slate-800 dark:text-slate-100 border-b border-black/5 dark:border-white/5 ${isUser ? 'bg-transparent' : 'bg-slate-50/50 dark:bg-[#111a2d]'}`}>
      <div className="max-w-3xl mx-auto px-4 py-8 flex gap-4 md:gap-6">
        
        {/* Avatar */}
        <div className="flex-shrink-0 flex flex-col relative items-end">
          <div className={`
            w-8 h-8 rounded-sm flex items-center justify-center
            ${isUser ? 'bg-transparent' : 'bg-green-500'}
          `}>
             {isUser ? (
               <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-sm flex items-center justify-center">
                 <User size={18} className="text-slate-500 dark:text-slate-300" />
               </div>
             ) : (
               <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-sm flex items-center justify-center shadow-lg shadow-indigo-500/20">
                 <Bot size={18} className="text-white" />
               </div>
             )}
          </div>
        </div>

        {/* Content */}
        <div className="relative flex-1 overflow-hidden">
          <div className="font-semibold text-sm mb-1 opacity-90">
            {isUser ? 'You' : 'Gemini'}
          </div>

          {/* Attachments Display */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {message.attachments.map((att, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-slate-200 dark:bg-slate-800 px-3 py-2 rounded-md text-xs font-medium text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                  <FileText size={14} className="text-indigo-400" />
                  <span className="truncate max-w-[200px]">{att.name}</span>
                </div>
              ))}
            </div>
          )}

          {/* Message Text */}
          <div className="prose prose-invert max-w-none text-[15px] leading-7">
             {message.isError ? (
               <div className="flex items-center gap-2 text-red-400 bg-red-400/10 p-3 rounded-md border border-red-400/20">
                 <AlertCircle size={16} />
                 <span>{message.text}</span>
               </div>
             ) : (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {message.text}
                </ReactMarkdown>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
