import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App';
import VideoHistoryList from './components/VideoHistoryList';
import VideoHistoryDetail from './components/VideoHistoryDetail';
import './styles/globals.css';

const container = document.getElementById('root');
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/history" element={<VideoHistoryList />} />
        <Route path="/history/:videoId" element={<VideoHistoryDetail />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);