import { useState, useRef, useEffect } from 'react'
import { Send, Upload, FileText, Globe, Settings, X, MessageSquare, Plus, Loader2, Database, Trash2, Bot, User } from 'lucide-react'
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

function App() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hello! I am your personal knowledge base assistant. How can I help you today?' }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [urlInput, setUrlInput] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState<AppSettings>({
    openai_model: 'gpt-3.5-turbo',
    embedding_model: 'text-embedding-ada-002'
  })

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const res = await axios.get('/api/settings')
      setSettings(res.data)
    } catch (err) {
      console.error("Failed to fetch settings", err)
    }
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
          history: messages.filter(m => m.role !== 'system')
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
    const file = event.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)

    setIsUploading(true)
    setUploadProgress(0)

    try {
      await axios.post('/api/ingest/file', formData, {
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 100))
          setUploadProgress(percentCompleted)
        }
      })
      alert('File uploaded successfully!')
    } catch (error) {
      console.error('Error uploading file:', error)
      alert('Failed to upload file.')
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleUrlUpload = async () => {
    if (!urlInput.trim()) return

    setIsUploading(true)
    try {
      await axios.post('/api/ingest/url', { url: urlInput })
      alert('URL ingested successfully!')
      setUrlInput('')
    } catch (error) {
      console.error('Error ingesting URL:', error)
      alert('Failed to ingest URL.')
    } finally {
      setIsUploading(false)
    }
  }

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

      {/* Sidebar - Dark Theme for Contrast */}
      <div className="w-80 bg-slate-900 text-white flex flex-col shadow-xl z-20">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 backdrop-blur-sm">
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
        
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8">
          {/* File Upload Section */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Knowledge Source</h3>
              <span className="bg-slate-800 text-xs px-2 py-0.5 rounded text-slate-400">Add Data</span>
            </div>
            
            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 hover:border-blue-500/50 transition-colors group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 to-indigo-600/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <h3 className="font-medium flex items-center gap-2 text-slate-200 mb-3 group-hover:text-blue-400 transition-colors relative z-10">
                <FileText size={18} /> 
                Upload Documents
              </h3>
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                accept=".pdf,.md,.txt"
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full bg-slate-800 border border-slate-600 text-slate-300 px-4 py-2.5 rounded-lg hover:bg-slate-700 hover:border-slate-500 hover:text-white transition-all text-sm font-medium flex items-center justify-center gap-2 relative z-10"
              >
                <Upload size={16} />
                Select Files
              </button>
              
              {isUploading && uploadProgress > 0 && (
                <div className="mt-3 relative z-10">
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Uploading...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-blue-500 h-1.5 rounded-full transition-all duration-300 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)]" 
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 hover:border-green-500/50 transition-colors group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-green-600/5 to-emerald-600/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <h3 className="font-medium flex items-center gap-2 text-slate-200 mb-3 group-hover:text-green-400 transition-colors relative z-10">
                <Globe size={18} /> 
                Ingest URL
              </h3>
              <div className="flex flex-col gap-3 relative z-10">
                <input 
                  type="text" 
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com"
                  className="bg-slate-900 border border-slate-600 text-slate-200 p-2.5 rounded-lg w-full text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all placeholder:text-slate-600"
                />
                <button 
                  onClick={handleUrlUpload}
                  disabled={isUploading}
                  className="bg-slate-800 border border-slate-600 text-slate-300 px-4 py-2.5 rounded-lg hover:bg-slate-700 hover:border-slate-500 hover:text-white transition-all text-sm font-medium"
                >
                  Fetch Content
                </button>
              </div>
            </div>
          </div>

          {/* Stats or Info */}
          <div className="mt-auto">
            <div className="bg-gradient-to-br from-blue-900/50 to-indigo-900/50 p-5 rounded-xl border border-blue-800/50 relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-24 h-24 bg-blue-500/20 rounded-full blur-2xl"></div>
              <h4 className="font-semibold text-blue-200 text-sm mb-2 flex items-center gap-2">
                <Bot size={16} />
                AI Assistant
              </h4>
              <p className="text-xs text-blue-300/80 leading-relaxed">
                Your knowledge base is ready. Upload documents or URLs to contextually enhance my answers.
              </p>
            </div>
            
            <button 
              onClick={() => setShowSettings(true)} 
              className="mt-6 w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-all duration-200 group"
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
          <div className="flex items-center gap-4">
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
            
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex justify-start animate-in fade-in duration-300 pl-11">
                <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-gray-200 flex items-center gap-3 shadow-sm">
                  <Loader2 className="animate-spin text-blue-500" size={18} />
                  <span className="text-gray-500 text-sm font-medium">AI is thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="p-6 bg-white border-t border-gray-200 shadow-[0_-5px_20px_rgba(0,0,0,0.02)]">
          <div className="max-w-4xl mx-auto">
            <div className="relative flex items-end gap-2 bg-gray-50 p-2 rounded-2xl border border-gray-200 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 focus-within:bg-white transition-all shadow-inner">
              <button className="p-3 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors mb-[1px]">
                <Plus size={20} />
              </button>
              <textarea 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask anything about your documents..."
                className="flex-1 bg-transparent border-none focus:ring-0 text-gray-700 placeholder-gray-400 text-base py-3 max-h-32 min-h-[44px] resize-none"
                disabled={isLoading}
                rows={1}
                style={{ height: 'auto', minHeight: '44px' }}
              />
              <button 
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className={`p-3 rounded-xl transition-all duration-200 mb-[1px] ${
                  input.trim() 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 hover:bg-blue-700 hover:scale-105 active:scale-95' 
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Send size={20} />
              </button>
            </div>
            <div className="text-center mt-3">
              <p className="text-xs text-gray-400 font-medium">
                AI can make mistakes. Please verify important information.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
