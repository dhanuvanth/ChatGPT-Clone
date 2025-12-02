import React, { useState, useEffect } from 'react';
import { Plus, MessageSquare, Trash2, X, Settings, Key } from 'lucide-react';
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    const storedKey = localStorage.getItem('gemini_api_key');
    if (storedKey) setApiKey(storedKey);
  }, []);

  const handleSaveKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem('gemini_api_key', apiKey.trim());
    } else {
      localStorage.removeItem('gemini_api_key');
    }
    setIsSettingsOpen(false);
  };

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

          {/* Footer (Profile/Settings) */}
          <div className="p-4 border-t border-zinc-800">
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-3 px-3 py-2 w-full text-zinc-400 text-sm hover:bg-zinc-800/50 rounded-lg transition-all group"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white font-bold text-xs shadow-lg shadow-emerald-900/20">
                G
              </div>
              <div className="flex-1 text-left">
                <div className="font-medium text-zinc-200 group-hover:text-white transition-colors">Gemini RAG</div>
                <div className="text-xs text-zinc-500 flex items-center gap-1">
                  {localStorage.getItem('gemini_api_key') ? <span className="text-emerald-400">Custom Key</span> : "Free Tier"}
                </div>
              </div>
              <Settings size={16} className="text-zinc-600 group-hover:text-zinc-400 transition-colors" />
            </button>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
              <h3 className="font-semibold text-zinc-100 flex items-center gap-2">
                <Settings size={18} className="text-emerald-500"/> Settings
              </h3>
              <button onClick={() => setIsSettingsOpen(false)} className="text-zinc-400 hover:text-zinc-200 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
                  API Key
                </label>
                <div className="relative">
                   <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
                     <Key size={16} />
                   </div>
                   <input
                     type="password"
                     value={apiKey}
                     onChange={(e) => setApiKey(e.target.value)}
                     placeholder="Enter your Gemini API Key"
                     className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2.5 pl-10 pr-4 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all placeholder:text-zinc-600"
                   />
                </div>
                <p className="text-xs text-zinc-500 mt-2">
                  Leave empty to use the system default key. Your key is stored locally in your browser.
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-zinc-800 bg-zinc-900/50 flex justify-end gap-2">
               <button
                 onClick={() => setIsSettingsOpen(false)}
                 className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
               >
                 Cancel
               </button>
               <button
                 onClick={handleSaveKey}
                 className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors font-medium shadow-lg shadow-emerald-500/20"
               >
                 Save Changes
               </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;