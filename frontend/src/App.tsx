import { useState, useRef, useEffect } from 'react'
import { Send, Upload, FileText, Globe, Settings, X, MessageSquare, Plus, Loader2, Database, Trash2, Bot, User, Check, RefreshCw, Search, FolderOpen, AlertCircle } from 'lucide-react'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface AppSettings {
  openai_api_key?: string
  openai_base_url?: string
  openai_model: string
  embedding_model: string
}

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface Document {
  id: string
  name: string
  source: string
  type: 'file' | 'url'
  created_at: string
}

interface UploadingItem {
  id: string
  name: string
  type: 'file' | 'url'
  progress: number
  status: 'uploading' | 'error' | 'success'
}

function App() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hello! I am your personal knowledge base assistant. How can I help you today?' }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState<AppSettings>({
    openai_model: 'gpt-3.5-turbo',
    embedding_model: 'text-embedding-ada-002'
  })

  // Knowledge Management State
  const [showKnowledgeManager, setShowKnowledgeManager] = useState(false)
  const [documents, setDocuments] = useState<Document[]>([])
  const [uploadQueue, setUploadQueue] = useState<UploadingItem[]>([])
  const [urlInput, setUrlInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [ragEnabled, setRagEnabled] = useState(true)
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([])
  const [isDocsLoading, setIsDocsLoading] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    fetchSettings()
    fetchDocuments()
  }, [])

  const fetchSettings = async () => {
    try {
      const res = await axios.get('/api/settings')
      setSettings(res.data)
    } catch (err) {
      console.error("Failed to fetch settings", err)
    }
  }

  const fetchDocuments = async () => {
    setIsDocsLoading(true)
    try {
      const res = await axios.get('/api/documents')
      setDocuments(res.data)
    } catch (err) {
      console.error("Failed to fetch documents", err)
    } finally {
      setIsDocsLoading(false)
    }
  }

  const handleDeleteDocument = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    // if (!confirm('Are you sure you want to delete this document?')) return

    try {
      await axios.delete(`/api/documents/${id}`)
      fetchDocuments()
      // Remove from selection if selected
      setSelectedDocIds(prev => prev.filter(docId => docId !== id))
    } catch (err) {
      console.error("Failed to delete document", err)
      alert('Failed to delete document')
    }
  }

  const toggleDocSelection = (id: string) => {
    setSelectedDocIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const handleSaveSettings = async () => {
    try {
      await axios.post('/api/settings', settings)
      alert('Settings saved!')
      setShowSettings(false)
    } catch (err) {
      console.error("Failed to save settings", err)
      alert('Failed to save settings')
    }
  }

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = { role: 'user', content: input }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          message: userMessage.content,
          history: messages.filter(m => m.role !== 'system'),
          rag_config: {
            enabled: ragEnabled,
            selected_doc_ids: selectedDocIds.length > 0 ? selectedDocIds : undefined
          }
        }),
      })

      if (!response.body) throw new Error('No response body')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let assistantMessage = ''
      
      setMessages(prev => [...prev, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        const chunk = decoder.decode(value, { stream: true })
        assistantMessage += chunk
        
        setMessages(prev => {
          const newMessages = [...prev]
          newMessages[newMessages.length - 1].content = assistantMessage
          return newMessages
        })
      }
    } catch (error) {
      console.error('Error sending message:', error)
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error.' }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    // Create temp items for queue
    const newUploads: UploadingItem[] = Array.from(files).map(file => ({
      id: Math.random().toString(36).substring(7),
      name: file.name,
      type: 'file',
      progress: 0,
      status: 'uploading'
    }))

    setUploadQueue(prev => [...newUploads, ...prev])

    // Process uploads
    Array.from(files).forEach((file, index) => {
      const uploadId = newUploads[index].id
      const formData = new FormData()
      formData.append('file', file)

      axios.post('/api/ingest/file', formData, {
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 100))
          setUploadQueue(prev => prev.map(item => 
            item.id === uploadId ? { ...item, progress: percentCompleted } : item
          ))
        }
      })
      .then(() => {
        setUploadQueue(prev => prev.filter(item => item.id !== uploadId))
        fetchDocuments()
      })
      .catch((error) => {
        console.error('Error uploading file:', error)
        setUploadQueue(prev => prev.map(item => 
          item.id === uploadId ? { ...item, status: 'error' } : item
        ))
        // Auto remove error after 3s
        setTimeout(() => {
          setUploadQueue(prev => prev.filter(item => item.id !== uploadId))
        }, 3000)
      })
    })
    
    // Clear input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleUrlUpload = async () => {
    if (!urlInput.trim()) return

    const urlToIngest = urlInput
    setUrlInput('') // Clear immediately
    
    const uploadId = Math.random().toString(36).substring(7)
    const newUpload: UploadingItem = {
      id: uploadId,
      name: urlToIngest,
      type: 'url',
      progress: 0,
      status: 'uploading'
    }

    setUploadQueue(prev => [newUpload, ...prev])
    
    // Async upload
    axios.post('/api/ingest/url', { url: urlToIngest })
    .then(() => {
      setUploadQueue(prev => prev.filter(item => item.id !== uploadId))
      fetchDocuments()
    })
    .catch((error) => {
      console.error('Error ingesting URL:', error)
      setUploadQueue(prev => prev.map(item => 
        item.id === uploadId ? { ...item, status: 'error' } : item
      ))
      setTimeout(() => {
        setUploadQueue(prev => prev.filter(item => item.id !== uploadId))
      }, 3000)
    })
  }

  const filteredDocuments = documents.filter(doc => 
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="flex h-screen bg-gray-100 text-gray-900 font-sans overflow-hidden">
      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-white p-8 rounded-2xl w-[500px] shadow-2xl border border-gray-200 transform transition-all scale-100">
            <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
              <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <Settings className="text-blue-600" size={24} />
                Settings
              </h2>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-full">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex flex-col gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">OpenAI API Key</label>
                <input 
                  type="password" 
                  value={settings.openai_api_key || ''}
                  onChange={e => setSettings({...settings, openai_api_key: e.target.value})}
                  className="w-full border border-gray-300 bg-gray-50 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm"
                  placeholder="sk-..."
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Base URL (Optional)</label>
                <input 
                  type="text" 
                  value={settings.openai_base_url || ''}
                  onChange={e => setSettings({...settings, openai_base_url: e.target.value})}
                  className="w-full border border-gray-300 bg-gray-50 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm"
                  placeholder="https://api.openai.com/v1"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Chat Model</label>
                  <input 
                    type="text" 
                    value={settings.openai_model}
                    onChange={e => setSettings({...settings, openai_model: e.target.value})}
                    className="w-full border border-gray-300 bg-gray-50 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Embedding Model</label>
                  <input 
                    type="text" 
                    value={settings.embedding_model}
                    onChange={e => setSettings({...settings, embedding_model: e.target.value})}
                    className="w-full border border-gray-300 bg-gray-50 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm"
                  />
                </div>
              </div>
              <button 
                onClick={handleSaveSettings}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl hover:opacity-90 transition-opacity font-semibold mt-4 shadow-lg shadow-blue-500/30"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Knowledge Manager Modal */}
      {showKnowledgeManager && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-[800px] h-[600px] shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                  <Database size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Knowledge Base</h2>
                  <p className="text-xs text-gray-500">Manage your documents and data sources</p>
                </div>
              </div>
              <button onClick={() => setShowKnowledgeManager(false)} className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Toolbar */}
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center gap-4">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Search documents..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
              
              <div className="flex items-center gap-2">
                 <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                  accept=".pdf,.md,.txt"
                  multiple
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all text-sm font-medium shadow-sm"
                >
                  <Upload size={16} />
                  Upload Files
                </button>
                
                <div className="relative group">
                   <div className="flex items-center bg-white border border-gray-300 rounded-lg overflow-hidden shadow-sm focus-within:ring-2 focus-within:ring-blue-500">
                      <div className="pl-3 text-gray-400"><Globe size={16} /></div>
                      <input 
                        type="text" 
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        placeholder="Add URL..."
                        className="w-48 px-3 py-2 text-sm outline-none border-none"
                        onKeyDown={(e) => e.key === 'Enter' && handleUrlUpload()}
                      />
                      <button 
                        onClick={handleUrlUpload} 
                        disabled={!urlInput.trim()}
                        className="px-3 py-2 hover:bg-gray-100 border-l border-gray-200 text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Plus size={16} />
                      </button>
                   </div>
                </div>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
              {/* Upload Queue */}
              {uploadQueue.length > 0 && (
                <div className="mb-6 space-y-3">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Uploading</h3>
                  {uploadQueue.map(item => (
                    <div key={item.id} className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                       {item.status === 'error' ? (
                          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-500">
                             <AlertCircle size={14} />
                          </div>
                       ) : (
                          <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                             <Loader2 size={14} className="animate-spin" />
                          </div>
                       )}
                       <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-1">
                             <span className="text-sm font-medium text-gray-700 truncate">{item.name}</span>
                             <span className={`text-xs font-bold ${item.status === 'error' ? 'text-red-500' : 'text-blue-600'}`}>
                                {item.status === 'error' ? 'Failed' : `${item.progress}%`}
                             </span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                             <div 
                                className={`h-1.5 rounded-full transition-all duration-300 ${item.status === 'error' ? 'bg-red-500' : 'bg-blue-500'}`}
                                style={{ width: `${item.progress}%` }}
                             ></div>
                          </div>
                       </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Document List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-2">
                   <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Documents ({filteredDocuments.length})</h3>
                   {isDocsLoading && <Loader2 size={14} className="animate-spin text-gray-400" />}
                </div>

                {filteredDocuments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
                    <FolderOpen size={48} className="text-gray-300 mb-2" />
                    <p className="text-sm">No documents found</p>
                    {searchQuery && <p className="text-xs mt-1">Try a different search term</p>}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {filteredDocuments.map(doc => (
                      <div 
                        key={doc.id}
                        className={`group bg-white p-4 rounded-xl border shadow-sm transition-all hover:shadow-md cursor-pointer flex items-center justify-between ${
                          selectedDocIds.includes(doc.id) 
                            ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50/10' 
                            : 'border-gray-200 hover:border-blue-300'
                        }`}
                        onClick={() => toggleDocSelection(doc.id)}
                      >
                        <div className="flex items-center gap-4 overflow-hidden">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                            selectedDocIds.includes(doc.id) ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                          }`}>
                             {doc.type === 'url' ? <Globe size={20} /> : <FileText size={20} />}
                          </div>
                          <div className="flex flex-col overflow-hidden">
                            <h4 className={`font-medium text-sm truncate ${selectedDocIds.includes(doc.id) ? 'text-blue-700' : 'text-gray-700'}`}>
                              {doc.name}
                            </h4>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                               <span>{doc.created_at.split('T')[0]}</span>
                               <span>•</span>
                               <span className="uppercase">{doc.type}</span>
                               {selectedDocIds.includes(doc.id) && (
                                  <>
                                    <span>•</span>
                                    <span className="text-blue-600 font-medium flex items-center gap-1">
                                       <Check size={10} /> Selected
                                    </span>
                                  </>
                               )}
                            </div>
                          </div>
                        </div>
                        
                        <button 
                          onClick={(e) => handleDeleteDocument(doc.id, e)}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                          title="Delete document"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar - Dark Theme for Contrast */}
      <div className="w-80 bg-slate-900 text-white flex flex-col shadow-xl z-20 h-full">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <Database size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Info-Get</h1>
              <p className="text-xs text-slate-400 font-medium">Knowledge Base</p>
            </div>
          </div>
        </div>
        
        <div className="flex-1 p-6 flex flex-col gap-6 overflow-hidden">
           {/* Knowledge Base Entry */}
           <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
              <div className="p-4 border-b border-slate-700/50">
                 <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Knowledge Context</h3>
                 <p className="text-xs text-slate-500">Manage your data sources</p>
              </div>
              <div className="p-2">
                 <button 
                    onClick={() => setShowKnowledgeManager(true)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-700/50 text-slate-300 hover:text-white transition-all group"
                 >
                    <div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center text-slate-400 group-hover:text-blue-400 group-hover:bg-slate-600 transition-colors">
                       <FolderOpen size={16} />
                    </div>
                    <div className="flex flex-col items-start">
                       <span className="text-sm font-medium">Manage Documents</span>
                       <span className="text-[10px] text-slate-500">{documents.length} files available</span>
                    </div>
                 </button>
              </div>
           </div>

           {/* Active Context Summary */}
           <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 flex-1 overflow-hidden flex flex-col">
               <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center justify-between">
                  Active Context
                  <span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded-full text-slate-300">
                     {selectedDocIds.length > 0 ? selectedDocIds.length : 'All'}
                  </span>
               </h3>
               
               <div className="flex-1 overflow-y-auto pr-1 space-y-2">
                  {selectedDocIds.length === 0 ? (
                     <div className="text-xs text-slate-500 italic px-2">
                        Using all available documents as context.
                     </div>
                  ) : (
                     documents.filter(d => selectedDocIds.includes(d.id)).map(doc => (
                        <div key={doc.id} className="flex items-center gap-2 text-xs text-slate-300 bg-slate-700/30 p-2 rounded border border-slate-700/50">
                           <Check size={12} className="text-blue-500 shrink-0" />
                           <span className="truncate">{doc.name}</span>
                        </div>
                     ))
                  )}
               </div>
               
               {selectedDocIds.length > 0 && (
                  <button 
                     onClick={() => setSelectedDocIds([])}
                     className="mt-4 text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 justify-center w-full py-2 border-t border-slate-700/50"
                  >
                     <RefreshCw size={10} /> Reset to All
                  </button>
               )}
           </div>

          {/* Settings Button */}
          <div className="mt-auto shrink-0">
            <button 
              onClick={() => setShowSettings(true)} 
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-all duration-200 group"
            >
              <Settings size={20} className="group-hover:rotate-90 transition-transform duration-500" />
              <span className="font-medium text-sm">Settings</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-gray-50/50 relative">
        {/* Header */}
        <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 shadow-sm z-10">
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold text-gray-800">Chat Session</span>
            <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium border border-green-200">Active</span>
          </div>
          
          {/* RAG Controls */}
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200">
                <span className={`text-xs font-semibold uppercase ${ragEnabled ? 'text-blue-600' : 'text-gray-400'}`}>RAG</span>
                <button 
                  onClick={() => setRagEnabled(!ragEnabled)}
                  className={`w-10 h-5 rounded-full p-1 transition-colors relative ${ragEnabled ? 'bg-blue-600' : 'bg-gray-300'}`}
                >
                  <div className={`w-3 h-3 bg-white rounded-full transition-transform ${ragEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
             </div>

             <div className="text-xs text-gray-500">
                {selectedDocIds.length > 0 ? `${selectedDocIds.length} context(s) selected` : (ragEnabled ? "All docs" : "No context")}
             </div>

            <button className="text-gray-400 hover:text-gray-600 transition-colors" title="Clear Chat" onClick={() => setMessages([])}>
              <Trash2 size={20} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth">
          <div className="max-w-4xl mx-auto flex flex-col gap-6 pb-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-[50vh] text-gray-400 gap-4">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center">
                  <MessageSquare size={32} className="text-gray-300" />
                </div>
                <p>Start a conversation...</p>
              </div>
            )}
            
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300 group`}>
                <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-white border border-gray-200 text-green-600'
                  }`}>
                    {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                  </div>

                  <div 
                    className={`p-5 rounded-2xl shadow-sm leading-relaxed text-[15px] ${
                      msg.role === 'user' 
                        ? 'bg-blue-600 text-white rounded-tr-none' 
                        : 'bg-white text-gray-800 rounded-tl-none border border-gray-200'
                    }`}
                  >
                    <div className="text-xs font-medium mb-1 opacity-70 flex items-center gap-2">
                      {msg.role === 'user' ? 'You' : 'Assistant'}
                    </div>
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {isLoading && (
               <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex gap-3 max-w-[85%] flex-row">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-sm bg-white border border-gray-200 text-green-600">
                    <Bot size={16} />
                  </div>
                  <div className="p-4 rounded-2xl shadow-sm bg-white text-gray-800 rounded-tl-none border border-gray-200 flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin text-blue-600" />
                    <span className="text-sm text-gray-500">AI is thinking...</span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="bg-white border-t border-gray-200 p-4 md:p-6 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
          <div className="max-w-4xl mx-auto relative">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask me anything..."
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
          <div className="max-w-4xl mx-auto mt-2 text-center">
            <p className="text-xs text-gray-400">
              AI can make mistakes. Please verify important information.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
