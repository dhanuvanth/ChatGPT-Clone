import React from 'react';
import { Plus, MessageSquare, Trash2, X, Github, Database } from 'lucide-react';
import { ChatSession } from '../types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string, e: React.MouseEvent) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  sessions,
  currentSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession
}) => {
  return (
    <>
      {/* Mobile Overlay */}
      <div 
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity md:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Sidebar Container */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-zinc-950 border-r border-zinc-800 transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4">
            <button
              onClick={() => {
                onNewChat();
                if (window.innerWidth < 768) onClose();
              }}
              className="flex items-center gap-3 w-full px-4 py-3 bg-zinc-100 hover:bg-white text-zinc-900 rounded-lg transition-colors shadow-lg shadow-zinc-500/10 group border border-zinc-200"
            >
              <Plus size={20} className="group-hover:rotate-90 transition-transform" />
              <span className="font-semibold text-sm">New Chat</span>
            </button>
          </div>

          {/* Chat List */}
          <div className="flex-1 overflow-y-auto px-2 py-2">
            <div className="text-xs font-semibold text-zinc-500 px-4 mb-2 uppercase tracking-wider">
              History
            </div>
            
            {sessions.length === 0 ? (
              <div className="text-zinc-500 text-sm text-center py-8">
                No previous chats
              </div>
            ) : (
              <div className="space-y-1">
                {sessions.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => {
                      onSelectSession(session.id);
                      if (window.innerWidth < 768) onClose();
                    }}
                    className={`
                      w-full flex items-center justify-between px-3 py-3 rounded-lg text-sm transition-colors text-left group
                      ${currentSessionId === session.id 
                        ? 'bg-zinc-800 text-zinc-100' 
                        : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}
                    `}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <MessageSquare size={16} className={currentSessionId === session.id ? 'text-emerald-400' : 'text-zinc-600'} />
                      <span className="truncate">{session.title || 'New Conversation'}</span>
                    </div>
                    
                    <div 
                      onClick={(e) => onDeleteSession(session.id, e)}
                      className={`
                        p-1 rounded-md hover:bg-red-500/20 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100
                        ${currentSessionId === session.id ? 'opacity-100' : ''}
                      `}
                    >
                      <Trash2 size={14} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-zinc-800">
            <div className="flex items-center gap-3 px-3 py-2 text-zinc-400 text-sm">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white font-bold text-xs">
                G
              </div>
              <div className="flex-1">
                <div className="font-medium text-zinc-200">Gemini RAG</div>
                <div className="text-xs text-zinc-500">Free Tier</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;