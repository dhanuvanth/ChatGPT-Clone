
import React, { useState, useEffect } from 'react';
import { Plus, MessageSquare, Trash2, X, Settings, Key, Server, RefreshCw, Plug, Circle, AlertCircle, Check, HelpCircle } from 'lucide-react';
import { ChatSession, MCPServer } from '../types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string, e: React.MouseEvent) => void;
  // MCP Props
  mcpServers: MCPServer[];
  onAddServer: (url: string) => void;
  onRemoveServer: (id: string) => void;
  onRefreshServer: (id: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  sessions,
  currentSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  mcpServers,
  onAddServer,
  onRemoveServer,
  onRefreshServer
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'mcp'>('general');
  const [apiKey, setApiKey] = useState('');
  const [newServerUrl, setNewServerUrl] = useState('');
  const [newServerHeaders, setNewServerHeaders] = useState('');
  
  // UI State for feedback
  const [hasKey, setHasKey] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    const storedKey = localStorage.getItem('gemini_api_key');
    if (storedKey) {
      setApiKey(storedKey);
      setHasKey(true);
    }
  }, []);

  const handleSaveKey = () => {
    setSaveStatus('saving');
    
    setTimeout(() => {
      if (apiKey.trim()) {
        localStorage.setItem('gemini_api_key', apiKey.trim());
        setHasKey(true);
      } else {
        localStorage.removeItem('gemini_api_key');
        setHasKey(false);
      }
      setSaveStatus('saved');
      
      // Reset status after 2 seconds
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 500);
  };

  const handleAddServer = (e: React.FormEvent) => {
    e.preventDefault();
    if (newServerUrl.trim()) {
      // Parse headers if any
      let headersMap: Record<string, string> | undefined = undefined;
      if (newServerHeaders.trim()) {
        try {
          headersMap = JSON.parse(newServerHeaders);
        } catch (e) {
          alert("Invalid JSON for headers");
          return;
        }
      }

      onAddServer(newServerUrl.trim()); // TODO: Pass headers up
      setNewServerUrl('');
      setNewServerHeaders('');
    }
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
                  {hasKey ? <span className="text-emerald-400">Custom Key</span> : "Free Tier"}
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
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-lg rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50 shrink-0">
              <h3 className="font-semibold text-zinc-100 flex items-center gap-2">
                <Settings size={18} className="text-emerald-500"/> Settings
              </h3>
              <button onClick={() => setIsSettingsOpen(false)} className="text-zinc-400 hover:text-zinc-200 transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-zinc-800 px-4 shrink-0">
               <button 
                 onClick={() => setActiveTab('general')}
                 className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'general' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-zinc-400 hover:text-zinc-200'}`}
               >
                 General
               </button>
               <button 
                 onClick={() => setActiveTab('mcp')}
                 className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'mcp' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-zinc-400 hover:text-zinc-200'}`}
               >
                 MCP Servers <span className="ml-1 text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded-full">{mcpServers.filter(s => s.status === 'connected').length}</span>
               </button>
            </div>
            
            {/* Content - Scrollable */}
            <div className="p-6 overflow-y-auto">
              {activeTab === 'general' && (
                <div className="space-y-4">
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
                  <div className="pt-4 flex justify-end">
                     <button
                       onClick={handleSaveKey}
                       disabled={saveStatus === 'saved'}
                       className={`
                         px-4 py-2 text-sm rounded-lg transition-all font-medium flex items-center gap-2
                         ${saveStatus === 'saved' 
                           ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' 
                           : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'}
                       `}
                     >
                       {saveStatus === 'saved' ? (
                         <><Check size={16} /> Saved</>
                       ) : (
                         "Save Key"
                       )}
                     </button>
                  </div>
                </div>
              )}

              {activeTab === 'mcp' && (
                 <div className="space-y-6">
                    {/* Intro / Optional Notice */}
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 flex items-start gap-3">
                      <HelpCircle size={18} className="text-blue-400 shrink-0 mt-0.5"/>
                      <div className="text-xs text-blue-200">
                        <strong className="text-blue-100 block mb-1">MCP is Optional</strong>
                        Model Context Protocol (MCP) allows the AI to connect to external tools (like local files, databases, or Spotify). You do not need this for normal chatting.
                      </div>
                    </div>

                    <div className="bg-zinc-800/30 border border-zinc-800 rounded-lg p-4">
                       <h4 className="text-sm font-medium text-zinc-200 mb-2 flex items-center gap-2">
                          <Server size={16} className="text-emerald-500"/> Connect New Server
                       </h4>
                       <p className="text-xs text-zinc-500 mb-3">
                          Enter your local MCP HTTP bridge URL.
                       </p>
                       <form onSubmit={handleAddServer} className="space-y-3">
                          <input 
                             type="url" 
                             value={newServerUrl}
                             onChange={(e) => setNewServerUrl(e.target.value)}
                             placeholder="http://localhost:3000/mcp"
                             className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
                             required
                          />
                          <div>
                            <input 
                               type="text" 
                               value={newServerHeaders}
                               onChange={(e) => setNewServerHeaders(e.target.value)}
                               placeholder='{"Authorization": "Bearer token"}'
                               className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 font-mono"
                            />
                            <p className="text-[10px] text-zinc-600 mt-1">Optional JSON headers for authentication</p>
                          </div>
                          <div className="flex justify-end">
                            <button type="submit" className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-sm border border-zinc-700 transition-colors">
                               Connect
                            </button>
                          </div>
                       </form>
                    </div>

                    <div>
                       <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">Connected Servers</h4>
                       <div className="space-y-2">
                          {mcpServers.length === 0 ? (
                             <div className="text-center py-6 text-zinc-600 text-sm italic border border-dashed border-zinc-800 rounded-lg">
                                No servers connected.
                             </div>
                          ) : (
                             mcpServers.map(server => (
                                <div key={server.id} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-lg p-3 group">
                                   <div className="flex items-center gap-3">
                                      {server.status === 'connected' ? (
                                         <div className="text-emerald-500 relative">
                                            <Plug size={18} />
                                            <div className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                                         </div>
                                      ) : (
                                         <AlertCircle size={18} className="text-red-500" />
                                      )}
                                      <div>
                                         <div className="text-sm font-medium text-zinc-200">{server.name || server.url}</div>
                                         <div className="text-xs text-zinc-500 flex items-center gap-2">
                                            {server.tools.length} tools available
                                            {server.status === 'error' && <span className="text-red-400">- Connection Failed</span>}
                                         </div>
                                      </div>
                                   </div>
                                   <div className="flex items-center gap-1">
                                      <button 
                                        onClick={() => onRefreshServer(server.id)}
                                        className="p-1.5 text-zinc-500 hover:text-emerald-400 hover:bg-zinc-800 rounded-md transition-colors"
                                        title="Refresh Tools"
                                      >
                                         <RefreshCw size={14} />
                                      </button>
                                      <button 
                                        onClick={() => onRemoveServer(server.id)}
                                        className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-md transition-colors"
                                        title="Remove Server"
                                      >
                                         <Trash2 size={14} />
                                      </button>
                                   </div>
                                </div>
                             ))
                          )}
                       </div>
                    </div>
                 </div>
              )}
            </div>

            <div className="p-4 border-t border-zinc-800 bg-zinc-900/50 flex justify-end">
               <button
                 onClick={() => setIsSettingsOpen(false)}
                 className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
               >
                 Close
               </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
