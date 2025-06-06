import React, { useState, useEffect } from 'react';
import { getVideoHistory, deleteVideoHistoryItem } from '../utils/apiUtils';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';

const VideoHistoryList = () => {
  const [historyItems, setHistoryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const navigate = useNavigate();

  // Load history on component mount
  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const response = await getVideoHistory();
      setHistoryItems(response.items || []);
      setError(null);
    } catch (error) {
      console.error('Error loading video history:', error);
      setError('Failed to load video history. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (videoId) => {
    if (deleteConfirm === videoId) {
      // Confirmed delete
      try {
        await deleteVideoHistoryItem(videoId);
        // Update local state to remove the deleted item
        setHistoryItems(prev => prev.filter(item => item.videoId !== videoId));
        setDeleteConfirm(null);
      } catch (error) {
        console.error(`Error deleting video ${videoId}:`, error);
        setError(`Failed to delete video. ${error.message}`);
      }
    } else {
      // First click - ask for confirmation
      setDeleteConfirm(videoId);
    }
  };

  const handleVideoSelect = (videoId) => {
    // Navigate to the main app with the selected video ID
    navigate(`/?videoId=${videoId}`);
  };

  const handleViewDetails = (videoId) => {
    // Navigate to the detailed view of a history item
    navigate(`/history/${videoId}`);
  };

  // Format the timestamp to a readable date
  const formatDate = (isoDate) => {
    if (!isoDate) return 'Unknown date';
    try {
      const date = new Date(isoDate);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    } catch (e) {
      return isoDate;
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Loading video history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500">{error}</p>
        <button 
          onClick={loadHistory}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (historyItems.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">No videos in history yet.</p>
        <p className="mt-2">Videos will appear here after you view them in the app.</p>
      </div>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto p-4">
        <h2 className="text-2xl font-bold mb-6">Video History</h2>
        
        <div className="grid grid-cols-1 gap-4">
          {historyItems.map((item) => (
          <div 
            key={item.videoId} 
            className="border rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex flex-col md:flex-row items-start md:items-center">
              {/* Thumbnail */}
              <div className="w-full md:w-48 flex-shrink-0 mb-4 md:mb-0 md:mr-4">
                <img 
                  src={item.thumbnailUrl || `https://i.ytimg.com/vi/${item.videoId}/mqdefault.jpg`} 
                  alt={item.title}
                  className="w-full rounded object-cover"
                />
              </div>
              
              {/* Content */}
              <div className="flex-grow">
                <h3 className="text-lg font-semibold mb-2 line-clamp-2">{item.title}</h3>
                <p className="text-sm text-gray-500 mb-2">
                  Last viewed: {formatDate(item.lastAccessedAt)}
                </p>
                <p className="text-sm text-gray-600 mb-4">
                  {item.screenshotCount > 0 
                    ? `${item.screenshotCount} screenshots captured` 
                    : 'No screenshots'}
                  {item.transcript ? ' • Transcript available' : ''}
                  {item.transcriptAnalysis ? ' • Analysis available' : ''}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleVideoSelect(item.videoId)}
                    className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                  >
                    Load Video
                  </button>
                  <button
                    onClick={() => handleViewDetails(item.videoId)}
                    className="px-3 py-1 bg-gray-200 text-gray-800 text-sm rounded hover:bg-gray-300"
                  >
                    View Details
                  </button>
                  <button
                    onClick={() => handleDelete(item.videoId)}
                    className={`px-3 py-1 text-sm rounded ${
                      deleteConfirm === item.videoId
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                    }`}
                  >
                    {deleteConfirm === item.videoId ? 'Confirm Delete' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          ))}
        </div>
      </div>
    </MainLayout>
  );
};

export default VideoHistoryList;