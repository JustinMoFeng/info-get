import React, { useEffect, useState } from 'react';
import { Database, FolderOpen, Settings, MessageSquare, Plus, Search, Trash2 } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

interface Chat {
  id: string;
  title: string;
  updated_at: string;
}

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [chats, setChats] = useState<Chat[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchChats();
    
    // Listen for chat creation events from other components
    const handleChatCreated = () => fetchChats();
    window.addEventListener('chat-created', handleChatCreated);
    
    return () => {
      window.removeEventListener('chat-created', handleChatCreated);
    };
  }, []);

  const fetchChats = async () => {
    try {
      const res = await axios.get('/api/chats');
      setChats(res.data);
    } catch (err) {
      console.error("Failed to fetch chats", err);
    }
  };

  const handleNewChat = () => {
    navigate('/');
  };

  const handleDeleteChat = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Delete this chat?')) return;
    try {
      await axios.delete(`/api/chats/${id}`);
      fetchChats();
      if (location.pathname.includes(id)) {
        navigate('/');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredChats = chats.filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="w-80 bg-slate-900 text-white flex flex-col shadow-xl z-20 h-full">
      {/* Header */}
      <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <Database size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Info-Get</h1>
            <p className="text-xs text-slate-400 font-medium">Knowledge Base</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 space-y-2">
        <button 
          onClick={handleNewChat}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg transition-all font-medium shadow-lg shadow-blue-900/20"
        >
          <Plus size={18} />
          New Chat
        </button>

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input 
            type="text" 
            placeholder="Search chats..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 pl-9 pr-3 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Chat History List */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-2">History</h3>
        {filteredChats.map(chat => (
          <div 
            key={chat.id}
            onClick={() => navigate(`/chat/${chat.id}`)}
            className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${
              location.pathname.includes(chat.id) 
                ? 'bg-slate-800 text-white border border-slate-700' 
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <MessageSquare size={16} className="shrink-0" />
              <span className="text-sm truncate">{chat.title || 'Untitled Chat'}</span>
            </div>
            <button 
              onClick={(e) => handleDeleteChat(e, chat.id)}
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 hover:text-red-400 rounded transition-all"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Bottom Nav */}
      <div className="p-4 border-t border-slate-800 space-y-1">
        <button 
          onClick={() => navigate('/files')}
          className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${
            location.pathname === '/files' 
              ? 'bg-slate-800 text-white' 
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <FolderOpen size={18} />
          <span className="text-sm font-medium">Knowledge Base</span>
        </button>
        
        {/* Settings - We can make this a route or modal. For now let's keep it simple or remove if unused in new design */}
        {/* <button className="w-full flex items-center gap-3 p-3 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-all">
          <Settings size={18} />
          <span className="text-sm font-medium">Settings</span>
        </button> */}
      </div>
    </div>
  );
};

export default Sidebar;
