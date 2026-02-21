import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, User, Bot, Loader2, MessageSquare, Trash2, Plus, FileText, Check, Globe } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import axios from 'axios';
import { ThoughtChain, ThoughtStep } from '../components/Chat/ThoughtChain';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  thought_steps?: ThoughtStep[];
}

interface ChatPageProps {}

const ChatPage: React.FC<ChatPageProps> = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentThoughtSteps, setCurrentThoughtSteps] = useState<ThoughtStep[]>([]);
  
  // Context Selection State
  const [ragEnabled, setRagEnabled] = useState(true);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [showContextSelector, setShowContextSelector] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  useEffect(() => {
    if (chatId) {
      fetchMessages(chatId);
    } else {
      setMessages([]);
    }
  }, [chatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentThoughtSteps]);

  const fetchDocuments = async () => {
    try {
      const res = await axios.get('/api/documents');
      setDocuments(res.data);
    } catch (err) {
      console.error("Failed to fetch documents", err);
    }
  };

  const fetchMessages = async (id: string) => {
    setIsLoading(true);
    try {
      const res = await axios.get(`/api/chats/${id}/messages`);
      setMessages(res.data.map((m: any) => ({
        role: m.role,
        content: m.content,
        thought_steps: m.thought_steps ? JSON.parse(m.thought_steps) : []
      })));
    } catch (err) {
      console.error("Failed to fetch messages", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setCurrentThoughtSteps([]); // Clear previous thoughts
    let newChatId = '';

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userMessage.content,
          chat_id: chatId,
          rag_config: {
            enabled: ragEnabled,
            selected_doc_ids: selectedDocIds.length > 0 ? selectedDocIds : undefined
          }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server responded with ${response.status}: ${errorText}`);
      }
      
      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      let assistantMessageContent = '';
      let currentSteps: ThoughtStep[] = [];
      let isFirstChunk = true;
      
      // Optimistic update for assistant message placeholder
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (dataStr === '[DONE]') continue;
            
            try {
              const data = JSON.parse(dataStr);
              
              if (data.type === 'meta') {
                if (!chatId && data.chat_id) {
                   newChatId = data.chat_id;
                   // Don't navigate yet to avoid unmounting
                }

                currentSteps.push({ type: 'thought', content: data.content });
                setCurrentThoughtSteps([...currentSteps]);
              } else if (data.type === 'tool_call') {
                currentSteps.push({ type: 'tool_call', name: data.name, args: data.args });
                setCurrentThoughtSteps([...currentSteps]);
              } else if (data.type === 'tool_output') {
                currentSteps.push({ type: 'tool_output', content: data.content });
                setCurrentThoughtSteps([...currentSteps]);
              } else if (data.type === 'answer') {
                assistantMessageContent += data.content;
                setMessages(prev => {
                  const newMessages = [...prev];
                  const lastMsg = newMessages[newMessages.length - 1];
                  lastMsg.content = assistantMessageContent;
                  // Associate thoughts with this message once done?
                  // For now, thoughts are displayed separately below the user message or above assistant message
                  lastMsg.thought_steps = [...currentSteps];
                  return newMessages;
                });
              }
            } catch (e) {
              console.error("Error parsing SSE data", e);
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      let errorMessage = 'Error: Failed to send message.';
      
      if (typeof error === 'string') {
        errorMessage = error;
      } else if (error instanceof Error) {
        errorMessage = `Error: ${error.message}`;
      }

      if (error?.response?.data?.detail) {
        errorMessage = `Error: ${error.response.data.detail}`;
      }
      
      setMessages(prev => [...prev, { role: 'assistant', content: errorMessage }]);
    } finally {
      setIsLoading(false);
      setCurrentThoughtSteps([]); 
      // If we started a new chat, navigate to it now and refresh history
      if (newChatId) {
         window.dispatchEvent(new Event('chat-created'));
         navigate(`/chat/${newChatId}`, { replace: true });
      }
    }
  };

  const toggleDocSelection = (id: string) => {
    setSelectedDocIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const getDocName = (id: string) => {
    const doc = documents.find(d => d.id === id);
    return doc ? doc.name : id;
  };

  return (
    <div className="flex flex-col h-full bg-gray-50/50">
      {/* Header */}
      <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm z-10 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold text-gray-800">
             {chatId ? 'Chat Session' : 'New Conversation'}
          </span>
        </div>
        
        <div className="flex items-center gap-4 relative">
           {/* Context Selector Toggle */}
           <button 
             onClick={() => setShowContextSelector(!showContextSelector)}
             className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
               selectedDocIds.length > 0 ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
             }`}
           >
             <FileText size={16} />
             {selectedDocIds.length > 0 ? `${selectedDocIds.length} Selected` : 'Select Context'}
           </button>

           {showContextSelector && (
             <div className="absolute top-12 right-0 w-80 bg-white border border-gray-200 rounded-xl shadow-xl p-4 z-50 animate-in fade-in slide-in-from-top-2">
               <h3 className="text-sm font-bold text-gray-700 mb-2">Select Documents</h3>
               <div className="max-h-60 overflow-y-auto space-y-2 mb-2">
                 {documents.map(doc => (
                   <div 
                     key={doc.id} 
                     onClick={() => toggleDocSelection(doc.id)}
                     className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer text-sm border ${
                       selectedDocIds.includes(doc.id) ? 'bg-blue-50 border-blue-200 text-blue-700' : 'hover:bg-gray-50 border-transparent'
                     }`}
                   >
                     <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedDocIds.includes(doc.id) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                       {selectedDocIds.includes(doc.id) && <Check size={10} className="text-white" />}
                     </div>
                     <span className="truncate flex-1">{doc.name}</span>
                   </div>
                 ))}
               </div>
               <div className="flex justify-end pt-2 border-t border-gray-100">
                 <button onClick={() => setSelectedDocIds([])} className="text-xs text-gray-500 hover:text-gray-700 mr-auto">Clear All</button>
                 <button onClick={() => setShowContextSelector(false)} className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">Done</button>
               </div>
             </div>
           )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth">
        <div className="max-w-3xl mx-auto flex flex-col gap-6 pb-4">
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center h-[50vh] text-gray-400 gap-4">
              <div className="w-16 h-16 bg-white border border-gray-200 rounded-2xl flex items-center justify-center shadow-sm">
                <MessageSquare size={32} className="text-gray-300" />
              </div>
              <p>Start a new conversation...</p>
            </div>
          )}
          
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
              <div className={`flex gap-3 max-w-[90%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-sm ${
                  msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-green-600'
                }`}>
                  {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>

                <div className="flex flex-col gap-2 w-full">
                  {/* Display Thoughts for this message if present (At the top) */}
                  {msg.thought_steps && msg.thought_steps.length > 0 && (
                    <div className="mb-1">
                      <ThoughtChain steps={msg.thought_steps} defaultExpanded={false} />
                    </div>
                  )}

                  <div className={`p-5 rounded-2xl shadow-sm leading-relaxed text-[15px] ${
                    msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-gray-800 rounded-tl-none border border-gray-200'
                  }`}>
                    <div className="prose prose-sm max-w-none dark:prose-invert break-words">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {/* Active Thinking Process (Streaming) - Display at the top of the incoming message area if possible, or just below last message */}
          {isLoading && currentThoughtSteps.length > 0 && (
             <div className="flex flex-col gap-2 items-start animate-in fade-in slide-in-from-bottom-2 duration-300">
               <div className="flex gap-3 max-w-[90%] flex-row">
                 <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-sm bg-white border border-gray-200 text-green-600">
                   <Bot size={16} />
                 </div>
                 <div className="flex flex-col gap-2 w-full">
                    <div className="mb-1">
                      <ThoughtChain steps={currentThoughtSteps} defaultExpanded={true} />
                    </div>
                 </div>
               </div>
             </div>
          )}

          {isLoading && currentThoughtSteps.length === 0 && (
             <div className="flex justify-start pl-12">
                <div className="flex items-center gap-2 text-gray-500 bg-white px-4 py-2 rounded-full shadow-sm border border-gray-100">
                   <Loader2 size={14} className="animate-spin text-blue-600" />
                   <span className="text-xs font-medium">Thinking...</span>
                </div>
             </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 p-4 md:p-6 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20 shrink-0">
        <div className="max-w-3xl mx-auto">
          
          {/* Selected Files Preview */}
          {selectedDocIds.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {selectedDocIds.map(id => (
                <div key={id} className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs border border-blue-100 max-w-[200px]">
                  <FileText size={12} className="shrink-0" />
                  <span className="truncate" title={getDocName(id)}>{getDocName(id)}</span>
                  <button 
                    onClick={() => toggleDocSelection(id)}
                    className="ml-1 hover:text-blue-900 rounded-full p-0.5"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="relative">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask anything..."
              className="w-full bg-gray-50 border border-gray-200 text-gray-800 p-4 pr-14 rounded-2xl shadow-inner focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-gray-400"
              disabled={isLoading}
            />
            <button 
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="absolute right-2 top-2 bottom-2 bg-blue-600 text-white p-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-all shadow-md shadow-blue-500/20"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
        <div className="max-w-3xl mx-auto mt-2 text-center">
          <p className="text-xs text-gray-400">AI can check memory and tools before answering.</p>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
