import React, { useState } from 'react';
import { saveToNotion } from '../utils/apiUtils';

/**
 * Button component for saving video information to Notion
 * with enhanced error handling and user feedback
 */
const SaveToNotionButton = ({ videoInfo, videoId }) => {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [pageUrl, setPageUrl] = useState('');

  // Handle save to Notion click
  const handleSaveToNotion = async () => {
    if (!videoInfo || !videoId) {
      setError('No video loaded to save to Notion');
      setTimeout(() => setError(''), 5000);
      return;
    }
    
    // Reset states
    setSaving(true);
    setError('');
    setPageUrl('');
    
    // Debug - Log the available environment variables for API URL
    console.log('Environment variables available:', {
      VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
      BUILD_MODE: import.meta.env.MODE
    });

    try {
      // Debug log what's being sent to the backend
      console.log('Saving to Notion - Data Summary:', {
        title: videoInfo.title || 'Untitled Video',
        videoId,
        description: videoInfo.description ? `${videoInfo.description.length} chars` : 'None',
        transcript: Array.isArray(videoInfo.transcript) ? `${videoInfo.transcript.length} entries` : 'Not an array',
        notes: videoInfo.notes ? `${videoInfo.notes.length} chars` : 'None',
        screenshots: Array.isArray(videoInfo.screenshots) ? `${videoInfo.screenshots.length} items` : 'Not an array',
        transcriptAnalysis: videoInfo.transcriptAnalysis ? (
          typeof videoInfo.transcriptAnalysis === 'string' ? 'string' : 'object'
        ) : 'None'
      });
      
      // Ensure data is properly formatted before sending
      const formattedData = {
        description: videoInfo.description || '',
        transcript: Array.isArray(videoInfo.transcript) ? videoInfo.transcript : [],
        notes: videoInfo.notes || '',
        screenshots: Array.isArray(videoInfo.screenshots) ? videoInfo.screenshots : [],
        transcriptAnalysis: videoInfo.transcriptAnalysis || {}
      };
      
      // Detailed debug log of transcript format
      if (formattedData.transcript.length > 0) {
        console.log('Transcript first item sample:', 
          formattedData.transcript[0]
        );
      }
      
      // Send data to backend with enhanced error handling
      const response = await saveToNotion(
        videoInfo.title || 'Untitled Video',
        videoId,
        formattedData
      );
      
      // Handle success response with page URL
      if (response.success && response.page_url) {
        setPageUrl(response.page_url);
        console.log('Successfully saved to Notion:', response);
      }
      
      setSaved(true);
      setTimeout(() => setSaved(false), 5000);
    } catch (err) {
      console.error('Error saving to Notion:', err);
      // Extract error information from various possible formats
      let errorMessage = '';
      
      if (err.response?.data?.detail) {
        // FastAPI error format
        errorMessage = err.response.data.detail;
      } else if (err.response?.data?.error) {
        // Our custom error format
        errorMessage = err.response.data.error;
      } else if (typeof err.response?.data === 'string') {
        // Plain string error
        errorMessage = err.response.data;
      } else {
        // Fallback to generic error message
        errorMessage = err.message || 'Unknown error occurred';
      }
      
      // Provide user-friendly error messages
      if (errorMessage.includes('database_id') || errorMessage.includes('Database not found')) {
        setError('Invalid Notion Database ID - Check your .env file');
      } else if (errorMessage.includes('NOTION_API_KEY') || errorMessage.includes('Authentication failed')) {
        setError('Invalid Notion API Key - Check your .env file');
      } else if (errorMessage.includes('property') || errorMessage.includes('validation_error')) {
        setError('Database property error: ' + errorMessage);
      } else if (errorMessage.includes('timeout') || errorMessage.includes('Connection error')) {
        setError('Connection issue - Please check your internet connection');
      } else {
        setError(errorMessage || 'Failed to save to Notion');
      }
      
      // Keep error visible longer for user to read
      setTimeout(() => setError(''), 8000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleSaveToNotion}
        disabled={saving || !videoInfo || !videoId}
        className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${
          saving 
            ? 'bg-gray-400 cursor-not-allowed' 
            : saved
              ? 'bg-green-500 hover:bg-green-600 text-white'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
        }`}
        title="Save video to Notion database"
      >
        {saving ? 'Saving...' : saved ? 'Saved to Notion!' : 'Save to Notion'}
      </button>
      
      {/* Error message */}
      {error && (
        <div className="absolute top-full mt-1 right-0 bg-red-100 border border-red-400 text-red-700 px-2 py-1 rounded text-xs whitespace-nowrap z-10">
          {error}
        </div>
      )}
      
      {/* Success message with link to Notion page */}
      {saved && pageUrl && (
        <div className="absolute top-full mt-1 right-0 bg-green-100 border border-green-400 text-green-700 px-2 py-1 rounded text-xs z-10">
          Saved! <a href={pageUrl} target="_blank" rel="noopener noreferrer" className="underline">View in Notion</a>
        </div>
      )}
    </div>
  );
};

export default SaveToNotionButton;
