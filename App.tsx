import React, { useState, useEffect, useRef } from 'react';
import { Menu, Send, Paperclip, X, File as FileIcon, Loader2, Sparkles, BrainCircuit } from 'lucide-react';
import Sidebar from './components/Sidebar';
import MessageBubble from './components/MessageBubble';
import { streamChatResponse } from './services/geminiService';
import { Message, Role, ChatSession, ModelType, Attachment, KnowledgeContext } from './types';
import { generateId, fileToBase64, saveChatsToStorage, loadChatsFromStorage } from './utils';

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
      // Don't auto-select a session to keep main screen clean, or select most recent:
      // setCurrentSessionId(loaded[0].id); 
    } else {
      createNewSession();
    }
  }, []);

  // Save to local storage whenever sessions change
  useEffect(() => {
    if (sessions.length > 0) {
      saveChatsToStorage(sessions);
    }
  }, [sessions]);

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
    const newSession: ChatSession = {
      id: generateId(),
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    setContextFiles([]); // Reset context for new chat
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const updateSessionMessages = (sessionId: string, newMessages: Message[]) => {
    setSessions(prev => prev.map(s => {
      if (s.id === sessionId) {
        // Auto-generate title if it's the first user message
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
      if (newSessions.length > 0) {
        setCurrentSessionId(newSessions[0].id);
      } else {
        createNewSession();
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isContext: boolean) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files) as File[];
      const newAttachments: Attachment[] = [];

      for (const file of filesArray) {
        try {
          // Basic validation (limit 5MB approx)
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
    // Reset input
    if (e.target) e.target.value = '';
  };

  const handleSendMessage = async () => {
    if ((!input.trim() && pendingAttachments.length === 0) || isGenerating || !currentSessionId) return;

    const userMessage: Message = {
      id: generateId(),
      role: Role.USER,
      text: input,
      timestamp: Date.now(),
      attachments: [...pendingAttachments]
    };

    // Optimistically add user message
    const updatedMessages = [...messages, userMessage];
    updateSessionMessages(currentSessionId, updatedMessages);
    
    setInput('');
    setPendingAttachments([]);
    setIsGenerating(true);

    try {
      // Create placeholder for bot message
      const botMessageId = generateId();
      let botMessageText = '';
      
      const botMessage: Message = {
        id: botMessageId,
        role: Role.MODEL,
        text: '', // Start empty
        timestamp: Date.now()
      };
      
      // Update state to show loading bot bubble
      updateSessionMessages(currentSessionId, [...updatedMessages, botMessage]);

      // Stream response
      await streamChatResponse(
        updatedMessages, 
        currentModel, 
        (chunk) => {
          botMessageText = chunk;
          updateSessionMessages(currentSessionId, [...updatedMessages, { ...botMessage, text: botMessageText }]);
        },
        contextFiles
      );

    } catch (error) {
      console.error("Chat error", error);
      const errorMessage: Message = {
        id: generateId(),
        role: Role.MODEL,
        text: "Sorry, I encountered an error processing your request. Please try again.",
        timestamp: Date.now(),
        isError: true
      };
      updateSessionMessages(currentSessionId, [...updatedMessages, errorMessage]);
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

  // --- Render ---

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden font-sans">
      
      {/* Sidebar */}
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)}
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={setCurrentSessionId}
        onNewChat={createNewSession}
        onDeleteSession={handleDeleteSession}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative h-full">
        
        {/* Top Header */}
        <header className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/95 backdrop-blur z-10 text-slate-200">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 -ml-2 rounded-md hover:bg-slate-800 md:hidden text-slate-400"
            >
              <Menu size={20} />
            </button>
            <div className="flex flex-col">
              <h1 className="font-semibold text-sm md:text-base flex items-center gap-2">
                {currentSession?.title || 'New Chat'}
              </h1>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                 <span className={`w-2 h-2 rounded-full ${currentModel === ModelType.PRO ? 'bg-purple-500' : 'bg-green-500'}`}></span>
                 {currentModel === ModelType.PRO ? 'Gemini 3 Pro (Thinking)' : 'Gemini 2.5 Flash'}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-lg">
             <button 
               onClick={() => setCurrentModel(ModelType.FLASH)}
               className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${currentModel === ModelType.FLASH ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
             >
               Flash
             </button>
             <button 
               onClick={() => setCurrentModel(ModelType.PRO)}
               className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${currentModel === ModelType.PRO ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
             >
               Pro
             </button>
          </div>
        </header>

        {/* RAG Context Panel (Collapsible) */}
        <div className={`border-b border-slate-800 bg-slate-900/50 transition-all duration-300 ${isContextPanelOpen ? 'max-h-64' : 'max-h-0'} overflow-hidden`}>
           <div className="p-4 bg-slate-800/30">
              <div className="flex justify-between items-center mb-3">
                 <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <BrainCircuit size={14} className="text-indigo-400" />
                    Knowledge Context (RAG)
                 </h3>
                 <button 
                   onClick={() => fileInputRef.current?.click()} // Reusing ref, actually should split logic but keeping simple
                   className="text-xs flex items-center gap-1 text-indigo-400 hover:text-indigo-300"
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
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                 <button 
                   onClick={() => contextInputRef.current?.click()}
                   className="h-20 border border-dashed border-slate-700 rounded-lg flex flex-col items-center justify-center text-slate-500 hover:bg-slate-800 hover:border-slate-600 transition-colors"
                 >
                    <PlusIcon size={20} />
                    <span className="text-xs mt-1">Upload File</span>
                 </button>

                 {contextFiles.map((file, idx) => (
                    <div key={idx} className="h-20 bg-slate-800 rounded-lg p-3 relative group border border-slate-700">
                       <button 
                         onClick={() => setContextFiles(prev => prev.filter((_, i) => i !== idx))}
                         className="absolute top-1 right-1 p-1 bg-slate-900/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-400"
                       >
                         <X size={10} />
                       </button>
                       <div className="h-full flex flex-col justify-center items-center text-center">
                          <FileIcon size={18} className="text-indigo-400 mb-1" />
                          <span className="text-xs text-slate-300 line-clamp-2 break-all">{file.name}</span>
                       </div>
                    </div>
                 ))}
              </div>
              <p className="text-[10px] text-slate-500 mt-2">
                 Files uploaded here are sent as system context for the entire chat session (simulating RAG).
              </p>
           </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto scroll-smooth">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-500">
               <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-black/20">
                  <Sparkles size={32} className="text-indigo-400" />
               </div>
               <h2 className="text-xl font-semibold text-slate-200 mb-2">How can I help you today?</h2>
               <p className="max-w-md text-sm mb-8">
                 I can explain complex code, draft emails, or analyze your uploaded documents using my large context window.
               </p>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl">
                  <button 
                    onClick={() => { setInput("Analyze this financial report for me."); setIsContextPanelOpen(true); }}
                    className="p-4 border border-slate-700 rounded-xl hover:bg-slate-800 text-left transition-colors text-sm"
                  >
                    <div className="font-medium text-slate-300 mb-1">Analyze Documents</div>
                    <div className="text-slate-500 text-xs">Upload a PDF or text file to start context-aware chat</div>
                  </button>
                  <button 
                     onClick={() => {
                        setInput("Write a React component for a responsive navbar.");
                        // Hacky way to focus, better to use effect but this works for demo
                        setTimeout(() => handleSendMessage(), 100);
                     }}
                     className="p-4 border border-slate-700 rounded-xl hover:bg-slate-800 text-left transition-colors text-sm"
                  >
                    <div className="font-medium text-slate-300 mb-1">Generate Code</div>
                    <div className="text-slate-500 text-xs">Create a React component or Python script</div>
                  </button>
               </div>
            </div>
          ) : (
            <div className="flex flex-col pb-4">
               {/* Context Indicator if files exist */}
               {contextFiles.length > 0 && (
                 <div className="w-full bg-slate-800/30 border-b border-slate-800/50 py-2 px-4 text-center">
                    <span className="text-xs text-slate-500 flex items-center justify-center gap-2">
                       <BrainCircuit size={12} /> Using {contextFiles.length} document(s) as context
                    </span>
                 </div>
               )}
               {messages.map((msg) => (
                 <MessageBubble key={msg.id} message={msg} />
               ))}
               {isGenerating && messages[messages.length - 1]?.role !== Role.MODEL && (
                 <div className="flex justify-center p-4">
                   <Loader2 size={24} className="animate-spin text-indigo-500" />
                 </div>
               )}
               <div ref={messagesEndRef} className="h-4" />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 pt-0 bg-transparent">
          <div className="max-w-3xl mx-auto">
             {/* Pending Attachments */}
             {pendingAttachments.length > 0 && (
                <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
                   {pendingAttachments.map((att, idx) => (
                      <div key={idx} className="relative bg-slate-800 pl-3 pr-8 py-2 rounded-lg border border-slate-700 flex items-center group">
                         <FileIcon size={14} className="text-indigo-400 mr-2" />
                         <span className="text-xs font-medium max-w-[150px] truncate">{att.name}</span>
                         <button 
                           onClick={() => setPendingAttachments(prev => prev.filter((_, i) => i !== idx))}
                           className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-red-400"
                         >
                           <X size={14} />
                         </button>
                      </div>
                   ))}
                </div>
             )}

            <div className="relative flex items-end gap-2 bg-slate-800 p-3 rounded-xl shadow-lg border border-slate-700 focus-within:ring-2 ring-indigo-500/50 transition-shadow">
               <button 
                 onClick={() => setIsContextPanelOpen(!isContextPanelOpen)}
                 className={`p-2 rounded-lg transition-colors mb-0.5 ${isContextPanelOpen || contextFiles.length > 0 ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:bg-slate-700 hover:text-slate-200'}`}
                 title="Manage Context / RAG"
               >
                 <BrainCircuit size={20} />
               </button>
               
               <div className="h-6 w-[1px] bg-slate-700 mx-1 mb-2"></div>

              <input 
                type="file" 
                multiple 
                className="hidden" 
                ref={fileInputRef} 
                onChange={(e) => handleFileUpload(e, false)} 
              />
              
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-slate-400 hover:bg-slate-700 hover:text-slate-200 rounded-lg transition-colors mb-0.5"
                title="Attach file to this message"
              >
                <Paperclip size={20} />
              </button>

              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={contextFiles.length > 0 ? "Ask a question about the uploaded documents..." : "Message Gemini..."}
                rows={1}
                className="flex-1 max-h-48 min-h-[24px] bg-transparent border-0 focus:ring-0 text-slate-100 placeholder-slate-500 resize-none py-2 text-sm leading-relaxed"
                style={{ height: 'auto', minHeight: '44px' }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
                }}
              />

              <button
                onClick={handleSendMessage}
                disabled={(!input.trim() && pendingAttachments.length === 0) || isGenerating}
                className={`p-2 rounded-lg mb-0.5 transition-all duration-200 ${
                  (input.trim() || pendingAttachments.length > 0) && !isGenerating
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-500/20' 
                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                }`}
              >
                {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </div>
            <div className="text-center mt-2">
               <span className="text-[10px] text-slate-500">
                  Gemini can make mistakes. Consider checking important information.
               </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// Simple internal component needed for the "Plus" icon in the context panel
const PlusIcon = ({ size }: { size: number }) => (
   <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
   >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
   </svg>
);

export default App;