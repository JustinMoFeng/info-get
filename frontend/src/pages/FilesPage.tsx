import React, { useEffect, useState, useRef } from 'react';
import { Database, Upload, Globe, Trash2, FolderOpen, Loader2, AlertCircle, Search, FileText, Plus } from 'lucide-react';
import axios from 'axios';

interface Document {
  id: string;
  name: string;
  source: string;
  type: 'file' | 'url';
  created_at: string;
}

interface UploadingItem {
  id: string;
  name: string;
  type: 'file' | 'url';
  progress: number;
  status: 'uploading' | 'error' | 'success';
}

const FilesPage = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploadQueue, setUploadQueue] = useState<UploadingItem[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDocsLoading, setIsDocsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    setIsDocsLoading(true);
    setError(null);
    try {
      const res = await axios.get('/api/documents');
      if (Array.isArray(res.data)) {
        setDocuments(res.data);
      } else {
        console.error("Unexpected response format:", res.data);
        setDocuments([]);
      }
    } catch (err) {
      console.error("Failed to fetch documents", err);
      setError("Failed to load documents. Please check your connection.");
    } finally {
      setIsDocsLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const newUploads: UploadingItem[] = Array.from(files).map(file => ({
      id: Math.random().toString(36).substring(7),
      name: file.name,
      type: 'file',
      progress: 0,
      status: 'uploading'
    }));

    setUploadQueue(prev => [...newUploads, ...prev]);

    Array.from(files).forEach((file, index) => {
      const uploadId = newUploads[index].id;
      const formData = new FormData();
      formData.append('file', file);

      axios.post('/api/ingest/file', formData, {
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 100));
          setUploadQueue(prev => prev.map(item => 
            item.id === uploadId ? { ...item, progress: percentCompleted } : item
          ));
        }
      })
      .then(() => {
        setUploadQueue(prev => prev.filter(item => item.id !== uploadId));
        fetchDocuments();
      })
      .catch((error) => {
        console.error('Error uploading file:', error);
        setUploadQueue(prev => prev.map(item => 
          item.id === uploadId ? { ...item, status: 'error' } : item
        ));
        setTimeout(() => {
          setUploadQueue(prev => prev.filter(item => item.id !== uploadId));
        }, 3000);
      });
    });
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUrlUpload = async () => {
    if (!urlInput.trim()) return;

    const urlToIngest = urlInput;
    setUrlInput('');
    
    const uploadId = Math.random().toString(36).substring(7);
    const newUpload: UploadingItem = {
      id: uploadId,
      name: urlToIngest,
      type: 'url',
      progress: 0,
      status: 'uploading'
    };

    setUploadQueue(prev => [newUpload, ...prev]);
    
    axios.post('/api/ingest/url', { url: urlToIngest })
    .then(() => {
      setUploadQueue(prev => prev.filter(item => item.id !== uploadId));
      fetchDocuments();
    })
    .catch((error) => {
      console.error('Error ingesting URL:', error);
      setUploadQueue(prev => prev.map(item => 
        item.id === uploadId ? { ...item, status: 'error' } : item
      ));
      setTimeout(() => {
        setUploadQueue(prev => prev.filter(item => item.id !== uploadId));
      }, 3000);
    });
  };

  const handleDeleteDocument = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      await axios.delete(`/api/documents/${id}`);
      fetchDocuments();
    } catch (err) {
      console.error("Failed to delete document", err);
      alert('Failed to delete document');
    }
  };

  const filteredDocuments = documents.filter(doc => 
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-gray-50/50 p-8 overflow-y-auto">
      <div className="max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 shadow-sm">
            <Database size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Knowledge Base</h1>
            <p className="text-gray-500">Manage your documents and data sources</p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search documents..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
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
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-sm font-medium shadow-sm shadow-blue-500/20"
            >
              <Upload size={16} />
              Upload Files
            </button>
            
            <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 transition-all">
              <div className="pl-3 text-gray-400"><Globe size={16} /></div>
              <input 
                type="text" 
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Add URL..."
                className="w-48 px-3 py-2 text-sm outline-none bg-transparent border-none"
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

        {/* Upload Queue */}
        {uploadQueue.length > 0 && (
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {uploadQueue.map(item => (
              <div key={item.id} className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm flex items-center gap-3 animate-in fade-in zoom-in-95 duration-300">
                 {item.status === 'error' ? (
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-500 shrink-0">
                       <AlertCircle size={18} />
                    </div>
                 ) : (
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                       <Loader2 size={18} className="animate-spin" />
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

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <AlertCircle size={20} />
            <span>{error}</span>
            <button 
              onClick={() => fetchDocuments()} 
              className="ml-auto text-sm font-medium underline hover:text-red-800"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading State */}
        {isDocsLoading && (
          <div className="flex justify-center py-12">
            <Loader2 size={32} className="animate-spin text-blue-600" />
          </div>
        )}

        {/* Document Grid */}
        {!isDocsLoading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocuments.map(doc => (
            <div 
              key={doc.id}
              className="group bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all duration-200 relative"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 shrink-0 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                   {doc.type === 'url' ? <Globe size={20} /> : <FileText size={20} />}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-800 truncate mb-1" title={doc.name}>{doc.name}</h4>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                     <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600 uppercase font-semibold tracking-wider text-[10px]">{doc.type}</span>
                     <span>•</span>
                     <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              
              <button 
                onClick={(e) => handleDeleteDocument(doc.id, e)}
                className="absolute top-4 right-4 p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                title="Delete document"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
          
          {filteredDocuments.length === 0 && !isDocsLoading && (
             <div className="col-span-full py-12 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                <FolderOpen size={48} className="mb-3 text-gray-300" />
                <p>No documents found</p>
             </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
};

export default FilesPage;
