
import React, { useState, useEffect, useRef } from 'react';
import { Menu, Send, Paperclip, X, File as FileIcon, Loader2, Sparkles, BrainCircuit } from 'lucide-react';
import Sidebar from './components/Sidebar';
import MessageBubble from './components/MessageBubble';
import { streamChatResponse } from './services/geminiService';
import { Message, Role, ChatSession, ModelType, Attachment, KnowledgeContext, MCPServer } from './types';
import { generateId, fileToBase64, saveChatsToStorage, loadChatsFromStorage } from './utils';
import { connectToServer } from './services/mcpService';

function App() {
  // --- State ---
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentModel, setCurrentModel] = useState<ModelType>(ModelType.FLASH);
  
  // Attachments (Per message)
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  
  // Context / RAG (Per session)
  const [contextFiles, setContextFiles] = useState<Attachment[]>([]);
  const [isContextPanelOpen, setIsContextPanelOpen] = useState(false);

  // MCP Servers
  const [mcpServers, setMcpServers] = useState<MCPServer[]>([]);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contextInputRef = useRef<HTMLInputElement>(null);

  // --- Effects ---
  
  // Load from local storage on mount
  useEffect(() => {
    const loaded = loadChatsFromStorage();
    if (loaded.length > 0) {
      setSessions(loaded);
    }
    
    // Load MCP Servers
    const storedServers = localStorage.getItem('mcp_servers');
    if (storedServers) {
      try {
        const parsed = JSON.parse(storedServers);
        setMcpServers(parsed);
        // Optimistically refresh connection for all servers on load
        parsed.forEach((s: MCPServer) => handleRefreshServer(s.id));
      } catch (e) {
        console.error("Failed to load MCP servers", e);
      }
    }
  }, []);

  // Save to local storage whenever sessions change
  useEffect(() => {
    if (sessions.length > 0) {
      saveChatsToStorage(sessions);
    }
  }, [sessions]);

  // Save MCP servers
  useEffect(() => {
    localStorage.setItem('mcp_servers', JSON.stringify(mcpServers));
  }, [mcpServers]);

  // Scroll to bottom on new messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentSessionId, sessions]);

  // --- Helpers ---

  const currentSession = sessions.find(s => s.id === currentSessionId);
  const messages = currentSession?.messages || [];

  const createNewSession = () => {
    setCurrentSessionId(null);
    setContextFiles([]);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const updateSessionMessages = (sessionId: string, newMessages: Message[]) => {
    setSessions(prev => prev.map(s => {
      if (s.id === sessionId) {
        let title = s.title;
        if (s.messages.length === 0 && newMessages.length > 0) {
          const firstMsg = newMessages[0];
          if (firstMsg.role === Role.USER) {
            title = firstMsg.text.slice(0, 30) + (firstMsg.text.length > 30 ? '...' : '');
          }
        }
        return { ...s, messages: newMessages, title, updatedAt: Date.now() };
      }
      return s;
    }));
  };

  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSessions = sessions.filter(s => s.id !== id);
    setSessions(newSessions);
    saveChatsToStorage(newSessions);
    if (currentSessionId === id) {
       setCurrentSessionId(null);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isContext: boolean) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files) as File[];
      const newAttachments: Attachment[] = [];

      for (const file of filesArray) {
        try {
          if (file.size > 5 * 1024 * 1024) {
            alert(`File ${file.name} is too large (max 5MB)`);
            continue;
          }
          const base64 = await fileToBase64(file);
          newAttachments.push({
            name: file.name,
            mimeType: file.type || 'application/octet-stream',
            data: base64
          });
        } catch (err) {
          console.error("Error reading file", err);
        }
      }

      if (isContext) {
        setContextFiles(prev => [...prev, ...newAttachments]);
      } else {
        setPendingAttachments(prev => [...prev, ...newAttachments]);
      }
    }
    if (e.target) e.target.value = '';
  };

  // MCP Handlers
  const handleAddServer = async (url: string) => {
    const tempId = generateId();
    // Add placeholder
    setMcpServers(prev => [...prev, {
      id: tempId,
      url,
      name: url,
      status: 'disconnected',
      tools: []
    }]);

    try {
      const tools = await connectToServer(url);
      setMcpServers(prev => prev.map(s => 
        s.id === tempId ? { ...s, status: 'connected', tools, name: new URL(url).hostname } : s
      ));
    } catch (e) {
      setMcpServers(prev => prev.map(s => 
        s.id === tempId ? { ...s, status: 'error' } : s
      ));
    }
  };

  const handleRemoveServer = (id: string) => {
    setMcpServers(prev => prev.filter(s => s.id !== id));
  };

  const handleRefreshServer = async (id: string) => {
    const server = mcpServers.find(s => s.id === id);
    if (!server) return;

    try {
      const tools = await connectToServer(server.url);
      setMcpServers(prev => prev.map(s => 
        s.id === id ? { ...s, status: 'connected', tools } : s
      ));
    } catch (e) {
      setMcpServers(prev => prev.map(s => 
        s.id === id ? { ...s, status: 'error' } : s
      ));
    }
  };

  const handleSendMessage = async () => {
    if ((!input.trim() && pendingAttachments.length === 0) || isGenerating) return;

    let activeSessionId = currentSessionId;
    let currentHistory = messages;

    if (!activeSessionId) {
      const newSessionId = generateId();
      const newSession: ChatSession = {
        id: newSessionId,
        title: 'New Chat',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setSessions(prev => [newSession, ...prev]);
      setCurrentSessionId(newSessionId);
      activeSessionId = newSessionId;
      currentHistory = [];
    }

    const userMessage: Message = {
      id: generateId(),
      role: Role.USER,
      text: input,
      timestamp: Date.now(),
      attachments: [...pendingAttachments]
    };

    const updatedMessages = [...currentHistory, userMessage];
    updateSessionMessages(activeSessionId, updatedMessages);
    
    setInput('');
    setPendingAttachments([]);
    setIsGenerating(true);

    try {
      const botMessageId = generateId();
      let botMessageText = '';
      
      const botMessage: Message = {
        id: botMessageId,
        role: Role.MODEL,
        text: '', 
        timestamp: Date.now()
      };
      
      updateSessionMessages(activeSessionId, [...updatedMessages, botMessage]);

      await streamChatResponse(
        updatedMessages, 
        currentModel, 
        (chunk) => {
          botMessageText = chunk;
          updateSessionMessages(activeSessionId!, [...updatedMessages, { ...botMessage, text: botMessageText }]);
        },
        contextFiles,
        mcpServers // Pass connected servers
      );

    } catch (error: any) {
      console.error("Chat error", error);
      const errorMessage: Message = {
        id: generateId(),
        role: Role.MODEL,
        text: error.message || "Sorry, I encountered an error. Please check your API key and connection.",
        timestamp: Date.now(),
        isError: true
      };
      updateSessionMessages(activeSessionId, [...updatedMessages, errorMessage]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)}
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={setCurrentSessionId}
        onNewChat={createNewSession}
        onDeleteSession={handleDeleteSession}
        // MCP Props
        mcpServers={mcpServers}
        onAddServer={handleAddServer}
        onRemoveServer={handleRemoveServer}
        onRefreshServer={handleRefreshServer}
      />

      <div className="flex-1 flex flex-col relative h-full">
        
        <header className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur z-10 text-zinc-200">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 -ml-2 rounded-md hover:bg-zinc-800 md:hidden text-zinc-400"
            >
              <Menu size={20} />
            </button>
            <div className="flex flex-col">
              <h1 className="font-semibold text-sm md:text-base flex items-center gap-2">
                {currentSession?.title || 'New Chat'}
              </h1>
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                 <span className={`w-2 h-2 rounded-full ${currentModel === ModelType.PRO ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                 {currentModel === ModelType.PRO ? 'Gemini 3 Pro (Thinking)' : 'Gemini 2.5 Flash'}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 bg-zinc-800 p-1 rounded-lg">
             <button 
               onClick={() => setCurrentModel(ModelType.FLASH)}
               className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${currentModel === ModelType.FLASH ? 'bg-zinc-700 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'}`}
             >
               Flash
             </button>
             <button 
               onClick={() => setCurrentModel(ModelType.PRO)}
               className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${currentModel === ModelType.PRO ? 'bg-amber-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'}`}
             >
               Pro
             </button>
          </div>
        </header>

        <div className={`border-b border-zinc-800 bg-zinc-900/50 transition-all duration-300 ${isContextPanelOpen ? 'max-h-64' : 'max-h-0'} overflow-hidden`}>
           <div className="p-4 bg-zinc-900/30">
              <div className="flex justify-between items-center mb-3">
                 <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                    <BrainCircuit size={14} className="text-emerald-400" />
                    Knowledge Context (RAG)
                 </h3>
                 <button 
                   onClick={() => fileInputRef.current?.click()}
                   className="text-xs flex items-center gap-1 text-emerald-400 hover:text-emerald-300"
                 >
                   <Paperclip size={12} /> Add Document
                 </button>
                 <input 
                   type="file" 
                   multiple 
                   className="hidden" 
                   ref={contextInputRef} 
                   onChange={(e) => handleFileUpload(e, true)}
                 />
              </div>
              
              {/* Context Files List */}
              {contextFiles.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-zinc-800 rounded-lg text-zinc-600 text-sm">
                   Drag & drop files here or click "Add Document" to upload knowledge base.
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                   {contextFiles.map((file, idx) => (
                      <div key={idx} className="bg-zinc-800 rounded p-2 flex items-center gap-2 overflow-hidden relative group">
                         <FileIcon size={16} className="text-emerald-500 shrink-0" />
                         <span className="text-xs text-zinc-300 truncate">{file.name}</span>
                         <button 
                           onClick={() => setContextFiles(prev => prev.filter((_, i) => i !== idx))}
                           className="absolute right-1 top-1/2 -translate-y-1/2 p-1 bg-zinc-900/80 rounded-full text-zinc-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                         >
                            <X size={12} />
                         </button>
                      </div>
                   ))}
                </div>
              )}
           </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto scroll-smooth">
          {!currentSessionId && messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
              <div className="w-16 h-16 bg-gradient-to-tr from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center mb-6 shadow-2xl shadow-emerald-500/20">
                <Sparkles size={32} className="text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">How can I help you today?</h2>
              <p className="text-zinc-400 max-w-md mb-8">
                I can explain complex code, draft emails, or analyze your uploaded documents using my large context window.
              </p>
              
              <div className="grid md:grid-cols-2 gap-4 max-w-2xl w-full text-left">
                <button 
                  onClick={() => setIsContextPanelOpen(true)}
                  className="p-4 border border-zinc-800 rounded-xl hover:bg-zinc-800/50 transition-colors group"
                >
                  <div className="font-medium text-zinc-200 mb-1 flex items-center gap-2">
                    <BrainCircuit size={16} className="text-emerald-500" /> Analyze Documents
                  </div>
                  <div className="text-sm text-zinc-500 group-hover:text-zinc-400">
                    Upload a PDF or text file to start context-aware chat
                  </div>
                </button>
                <div className="p-4 border border-zinc-800 rounded-xl hover:bg-zinc-800/50 transition-colors group cursor-pointer" onClick={() => setInput("Create a React component for a sortable table")}>
                  <div className="font-medium text-zinc-200 mb-1">Generate Code</div>
                  <div className="text-sm text-zinc-500 group-hover:text-zinc-400">
                    Create a React component or Python script
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-6">
               {messages.map((msg) => (
                 <MessageBubble key={msg.id} message={msg} />
               ))}
               {isGenerating && (
                 <div className="max-w-3xl mx-auto px-4 py-4">
                   <div className="flex items-center gap-2 text-zinc-500 text-sm">
                     <Loader2 size={16} className="animate-spin" /> Thinking...
                   </div>
                 </div>
               )}
               <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/95">
          <div className="max-w-3xl mx-auto">
             
             {/* Pending Attachments */}
             {pendingAttachments.length > 0 && (
               <div className="flex flex-wrap gap-2 mb-2">
                 {pendingAttachments.map((att, idx) => (
                   <div key={idx} className="relative group">
                     <div className="flex items-center gap-2 bg-zinc-800 px-3 py-2 rounded-lg text-xs font-medium text-zinc-200 border border-zinc-700">
                       <FileIcon size={14} className="text-zinc-400" />
                       <span className="max-w-[150px] truncate">{att.name}</span>
                     </div>
                     <button 
                       onClick={() => setPendingAttachments(prev => prev.filter((_, i) => i !== idx))}
                       className="absolute -top-1 -right-1 bg-zinc-700 text-zinc-300 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                     >
                       <X size={12} />
                     </button>
                   </div>
                 ))}
               </div>
             )}

            <div className="relative bg-zinc-900 border border-zinc-800 rounded-2xl focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500/50 transition-all shadow-lg shadow-black/20">
              
              {/* Toolbar */}
              <div className="absolute left-3 bottom-3 flex items-center gap-2">
                 <button 
                   onClick={() => setIsContextPanelOpen(!isContextPanelOpen)}
                   className={`p-2 rounded-lg transition-colors ${isContextPanelOpen ? 'bg-emerald-500/10 text-emerald-400' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}
                   title="RAG Context"
                 >
                   <BrainCircuit size={20} />
                 </button>
                 <button 
                   onClick={() => fileInputRef.current?.click()}
                   className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
                   title="Attach File"
                 >
                   <Paperclip size={20} />
                 </button>
                 {/* Hidden File Input for Message Attachments */}
                 <input 
                   type="file" 
                   multiple 
                   className="hidden" 
                   ref={fileInputRef} 
                   onChange={(e) => handleFileUpload(e, false)} 
                 />
              </div>

              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isContextPanelOpen ? "Ask about the uploaded documents..." : "Ask anything..."}
                className="w-full bg-transparent border-none text-zinc-100 placeholder-zinc-500 px-4 py-4 pl-4 min-h-[56px] max-h-[200px] resize-none focus:ring-0 ml-24"
                rows={1}
                style={{ height: 'auto', minHeight: '56px' }}
              />

              <div className="absolute right-2 bottom-2">
                <button
                  onClick={handleSendMessage}
                  disabled={!input.trim() && pendingAttachments.length === 0}
                  className={`p-2 rounded-xl transition-all ${
                    (input.trim() || pendingAttachments.length > 0) 
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-500' 
                      : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                  }`}
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
            <div className="text-center mt-2">
              <p className="text-[10px] text-zinc-600">
                Gemini can make mistakes. Consider checking important information.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
