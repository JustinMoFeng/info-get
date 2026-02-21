import React from 'react';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import ChatPage from './pages/ChatPage';
import FilesPage from './pages/FilesPage';

const Layout = () => {
  return (
    <div className="flex h-screen bg-gray-100 text-gray-900 font-sans overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col bg-gray-50/50 relative overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<ChatPage />} />
          <Route path="chat/:chatId" element={<ChatPage />} />
          <Route path="files" element={<FilesPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
