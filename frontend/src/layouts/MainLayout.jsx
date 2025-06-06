import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { printStyles } from '../styles/printStyles';
import { appStyles } from '../styles/appStyles';

const MainLayout = ({ 
  children, 
  isFullWidth = false,
  isSplitView = false,
  videoInfo = null,
  error = null 
}) => {
  const location = useLocation();
  
  // Add styles to head
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = printStyles + appStyles;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // Determine active route
  const isHome = location.pathname === '/';
  const isHistory = location.pathname.startsWith('/history');

  return (
    <div className="app-container bg-gray-50">
      <div className={`content-container ${!isFullWidth && !isSplitView ? 'constrained' : ''} ${isSplitView ? 'split-view' : ''}`}>
        {/* Navigation Bar */}
        <nav className="flex items-center justify-between mb-4 border-b pb-4">
          <div className="flex items-center">
            <h1 className="text-2xl sm:text-3xl font-bold">QueryClip</h1>
          </div>
          <div className="flex space-x-4">
            <Link 
              to="/" 
              className={`px-3 py-2 rounded-md text-sm font-medium ${isHome ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              Home
            </Link>
            <Link 
              to="/history" 
              className={`px-3 py-2 rounded-md text-sm font-medium ${isHistory ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              History
            </Link>
          </div>
        </nav>

        {/* Title section - always visible */}
        {videoInfo?.title && (
          <div className="flex flex-col w-full mb-4">
            <div className="flex flex-col w-full">
              <div className="bg-blue-50 border-l-4 border-blue-500 pl-4 py-2 pr-3 rounded-r-lg">
                <h2 className="text-xl sm:text-2xl font-semibold text-blue-900 leading-tight">
                  {videoInfo.title}
                </h2>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 w-full">
            {error}
          </div>
        )}

        {children}
      </div>
    </div>
  );
};

export default MainLayout;