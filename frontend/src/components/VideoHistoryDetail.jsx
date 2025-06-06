import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getVideoHistoryItem, deleteVideoHistoryItem } from '../utils/apiUtils';
import ReactMarkdown from 'react-markdown';
import MainLayout from '../layouts/MainLayout';

const VideoHistoryDetail = () => {
  const { videoId } = useParams();
  const navigate = useNavigate();
  const [historyItem, setHistoryItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('info');
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    if (videoId) {
      loadVideoDetails();
    }
  }, [videoId]);
  
  // Update page title when history item loads
  useEffect(() => {
    if (historyItem) {
      document.title = `${historyItem.title} - QueryClip History`;
    } else {
      document.title = 'Video History - QueryClip';
    }
    
    // Restore title when component unmounts
    return () => {
      document.title = 'QueryClip';
    };
  }, [historyItem]);

  const loadVideoDetails = async () => {
    try {
      setLoading(true);
      // Get history item from API
      const data = await getVideoHistoryItem(videoId);
      
      console.log('Loaded history data:', data);
      
      // Add default values for missing properties
      const enhancedData = {
        ...data,
        queryAnswers: data.queryAnswers || [],
        transcript: data.transcript || '',
        transcriptAnalysis: data.transcriptAnalysis || '',
        notes: data.notes || '',
        screenshotCount: data.screenshotCount || 0,
        screenshotCaptions: data.screenshotCaptions || '',
        tags: data.tags || [],
        chapters: data.chapters || []
      };
      
      setHistoryItem(enhancedData);
      setError(null);
    } catch (error) {
      console.error('Error loading video details:', error);
      setError('Failed to load video details. The video may have been deleted or is no longer available.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }

    try {
      await deleteVideoHistoryItem(videoId);
      navigate('/history');
    } catch (error) {
      console.error('Error deleting video:', error);
      setError(`Failed to delete video: ${error.message}`);
      setDeleteConfirm(false);
    }
  };

  const handleLoadVideo = () => {
    navigate(`/?videoId=${videoId}`);
  };

  const formatDate = (isoDate) => {
    if (!isoDate) return 'Unknown date';
    try {
      const date = new Date(isoDate);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    } catch (e) {
      return isoDate;
    }
  };

  // Function to process captions from history into proper markdown format
  const processCaptionsForMarkdown = (captionsText) => {
    if (!captionsText) return '';

    // Split captions by timestamp markers [HH:MM]
    const captionGroups = captionsText.split(/\[\d+:\d+\]/).filter(group => group.trim().length > 0);
    
    return captionGroups.map((group, index) => {
      let processedGroup = group.trim();
      
      // Add heading if none exists
      if (!processedGroup.startsWith('###')) {
        processedGroup = `### Caption ${index + 1}\n\n${processedGroup}`;
      }
      
      // Process bullet points
      // Look for sequences starting with * and format them properly
      processedGroup = processedGroup.replace(/\*\s+(.*?)(?=\*\s+|$)/gs, (match, bulletContent) => {
        // Format each bullet point with proper markdown spacing
        return `* ${bulletContent.trim()}\n\n`;
      });
      
      return processedGroup;
    }).join('\n\n---\n\n'); // Add separator between caption groups
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="container mx-auto p-4 text-center">
          <p className="text-gray-500">Loading video details...</p>
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <div className="container mx-auto p-4 text-center">
          <p className="text-red-500">{error}</p>
          <div className="mt-4 flex justify-center gap-4">
            <button 
              onClick={() => navigate('/history')}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
            >
              Back to History
            </button>
            <button 
              onClick={loadVideoDetails}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Try Again
            </button>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!historyItem) {
    return (
      <MainLayout>
        <div className="container mx-auto p-4 text-center">
          <p className="text-gray-500">Video not found</p>
          <button 
            onClick={() => navigate('/history')}
            className="mt-4 px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
          >
            Back to History
          </button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto p-4">
        <div className="flex justify-between items-center mb-6">
          <button 
            onClick={() => navigate('/history')}
            className="text-blue-500 hover:text-blue-700 flex items-center"
          >
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to History
          </button>
          <div className="flex gap-2">
            <button
              onClick={handleLoadVideo}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Load Video
            </button>
            <button
              onClick={handleDelete}
              className={`px-4 py-2 rounded ${
                deleteConfirm
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
              }`}
            >
              {deleteConfirm ? 'Confirm Delete' : 'Delete'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {/* Video Header */}
          <div className="md:flex p-6 border-b">
            <div className="md:w-64 flex-shrink-0 mb-4 md:mb-0 md:mr-6">
              <img 
                src={historyItem.thumbnailUrl || `https://i.ytimg.com/vi/${historyItem.videoId}/mqdefault.jpg`} 
                alt={historyItem.title}
                className="w-full rounded"
              />
            </div>
            <div className="flex-grow">
              <h1 className="text-2xl font-bold mb-2">{historyItem.title}</h1>
              <p className="text-gray-500 mb-4">
                Last viewed: {formatDate(historyItem.lastAccessedAt)}
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="px-2 py-1 bg-gray-100 text-sm rounded">
                  ID: {historyItem.videoId}
                </span>
                {historyItem.screenshotCount > 0 && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded">
                    {historyItem.screenshotCount} Screenshots
                  </span>
                )}
                {historyItem.transcript && (
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-sm rounded">
                    Transcript
                  </span>
                )}
                {historyItem.transcriptAnalysis && (
                  <span className="px-2 py-1 bg-purple-100 text-purple-800 text-sm rounded">
                    Analysis
                  </span>
                )}
                {historyItem.isFavorite && (
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-sm rounded">
                    Favorite
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                {(historyItem.tags || []).map((tag, index) => (
                  <span key={index} className="px-2 py-1 bg-gray-200 text-gray-800 text-xs rounded">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b px-6">
            <div className="flex overflow-x-auto">
              <button 
                onClick={() => setActiveTab('info')}
                className={`py-3 px-4 border-b-2 font-medium text-sm ${
                  activeTab === 'info' 
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Info
              </button>
              {historyItem.transcript && historyItem.transcript.length > 0 && (
                <button 
                  onClick={() => setActiveTab('transcript')}
                  className={`py-3 px-4 border-b-2 font-medium text-sm ${
                    activeTab === 'transcript' 
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Transcript
                </button>
              )}
              {historyItem.transcriptAnalysis && historyItem.transcriptAnalysis.length > 0 && (
                <button 
                  onClick={() => setActiveTab('analysis')}
                  className={`py-3 px-4 border-b-2 font-medium text-sm ${
                    activeTab === 'analysis' 
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Analysis
                </button>
              )}
              {historyItem.notes && historyItem.notes.length > 0 && (
                <button 
                  onClick={() => setActiveTab('notes')}
                  className={`py-3 px-4 border-b-2 font-medium text-sm ${
                    activeTab === 'notes' 
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Notes
                </button>
              )}
              {historyItem.queryAnswers && Array.isArray(historyItem.queryAnswers) && historyItem.queryAnswers.length > 0 && (
                <button 
                  onClick={() => setActiveTab('queries')}
                  className={`py-3 px-4 border-b-2 font-medium text-sm ${
                    activeTab === 'queries' 
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Queries
                </button>
              )}
              {historyItem.chapters && Array.isArray(historyItem.chapters) && historyItem.chapters.length > 0 && (
                <button 
                  onClick={() => setActiveTab('chapters')}
                  className={`py-3 px-4 border-b-2 font-medium text-sm ${
                    activeTab === 'chapters' 
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Chapters
                </button>
              )}
              {historyItem.screenshotCaptions && historyItem.screenshotCaptions.length > 0 && (
                <button 
                  onClick={() => setActiveTab('captions')}
                  className={`py-3 px-4 border-b-2 font-medium text-sm ${
                    activeTab === 'captions' 
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Captions
                </button>
              )}
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'info' && (
              <div>
                <h3 className="text-lg font-semibold mb-3">Video Information</h3>
                <p className="mb-3">
                  <a 
                    href={`https://www.youtube.com/watch?v=${historyItem.videoId}`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-700"
                  >
                    Open Video on YouTube
                  </a>
                </p>
                <div className="mb-4">
                  <h4 className="font-medium mb-1">YouTube Video ID:</h4>
                  <code className="block p-2 bg-gray-100 rounded">{historyItem.videoId}</code>
                </div>
                <p className="text-sm text-gray-500">
                  This video was first saved to your history on {formatDate(historyItem.lastAccessedAt)}.
                </p>
              </div>
            )}

            {activeTab === 'transcript' && historyItem.transcript && historyItem.transcript.length > 0 && (
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-lg font-semibold">Video Transcript</h3>
                  <button 
                    onClick={() => {
                      try {
                        // Create a temporary textarea element to copy text
                        const textarea = document.createElement('textarea');
                        textarea.value = historyItem.transcript;
                        
                        // Make the textarea non-visible but still part of the document
                        textarea.style.position = 'fixed';
                        textarea.style.opacity = '0';
                        document.body.appendChild(textarea);
                        
                        // Select and copy the text
                        textarea.select();
                        document.execCommand('copy');
                        
                        // Clean up
                        document.body.removeChild(textarea);
                        
                        // Show success feedback
                        const button = document.getElementById('copy-transcript-btn');
                        if (button) {
                          const originalText = button.innerText;
                          button.innerText = 'Copied!';
                          button.classList.remove('bg-blue-500', 'hover:bg-blue-600');
                          button.classList.add('bg-green-500', 'hover:bg-green-600');
                          
                          setTimeout(() => {
                            button.innerText = originalText;
                            button.classList.remove('bg-green-500', 'hover:bg-green-600');
                            button.classList.add('bg-blue-500', 'hover:bg-blue-600');
                          }, 2000);
                        }
                        
                        console.log('Transcript text copied successfully');
                      } catch (err) {
                        console.error('Failed to copy text: ', err);
                        alert('Failed to copy transcript text: ' + err.message);
                      }
                    }}
                    id="copy-transcript-btn"
                    className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded flex items-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    Copy Transcript
                  </button>
                </div>
                <div className="bg-gray-50 p-4 rounded">
                  <p className="whitespace-pre-wrap">{historyItem.transcript}</p>
                </div>
              </div>
            )}

            {activeTab === 'analysis' && historyItem.transcriptAnalysis && historyItem.transcriptAnalysis.length > 0 && (
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-lg font-semibold">Transcript Analysis</h3>
                  <button 
                    onClick={() => {
                      try {
                        // Create a temporary textarea element to copy text
                        const textarea = document.createElement('textarea');
                        textarea.value = historyItem.transcriptAnalysis;
                        
                        // Make the textarea non-visible but still part of the document
                        textarea.style.position = 'fixed';
                        textarea.style.opacity = '0';
                        document.body.appendChild(textarea);
                        
                        // Select and copy the text
                        textarea.select();
                        document.execCommand('copy');
                        
                        // Clean up
                        document.body.removeChild(textarea);
                        
                        // Show success feedback
                        const button = document.getElementById('copy-analysis-btn');
                        if (button) {
                          const originalText = button.innerText;
                          button.innerText = 'Copied!';
                          button.classList.remove('bg-blue-500', 'hover:bg-blue-600');
                          button.classList.add('bg-green-500', 'hover:bg-green-600');
                          
                          setTimeout(() => {
                            button.innerText = originalText;
                            button.classList.remove('bg-green-500', 'hover:bg-green-600');
                            button.classList.add('bg-blue-500', 'hover:bg-blue-600');
                          }, 2000);
                        }
                        
                        console.log('Analysis text copied successfully');
                      } catch (err) {
                        console.error('Failed to copy text: ', err);
                        alert('Failed to copy analysis text: ' + err.message);
                      }
                    }}
                    id="copy-analysis-btn"
                    className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded flex items-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    Copy Analysis
                  </button>
                </div>
                <div className="bg-gray-50 p-4 rounded prose max-w-none">
                  <ReactMarkdown>
                    {historyItem.transcriptAnalysis}
                  </ReactMarkdown>
                </div>
              </div>
            )}

            {activeTab === 'notes' && historyItem.notes && historyItem.notes.length > 0 && (
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-lg font-semibold">Notes</h3>
                  <button 
                    onClick={() => {
                      try {
                        // Create a temporary textarea element to copy text
                        const textarea = document.createElement('textarea');
                        textarea.value = historyItem.notes;
                        
                        // Make the textarea non-visible but still part of the document
                        textarea.style.position = 'fixed';
                        textarea.style.opacity = '0';
                        document.body.appendChild(textarea);
                        
                        // Select and copy the text
                        textarea.select();
                        document.execCommand('copy');
                        
                        // Clean up
                        document.body.removeChild(textarea);
                        
                        // Show success feedback
                        const button = document.getElementById('copy-notes-btn');
                        if (button) {
                          const originalText = button.innerText;
                          button.innerText = 'Copied!';
                          button.classList.remove('bg-blue-500', 'hover:bg-blue-600');
                          button.classList.add('bg-green-500', 'hover:bg-green-600');
                          
                          setTimeout(() => {
                            button.innerText = originalText;
                            button.classList.remove('bg-green-500', 'hover:bg-green-600');
                            button.classList.add('bg-blue-500', 'hover:bg-blue-600');
                          }, 2000);
                        }
                        
                        console.log('Notes text copied successfully');
                      } catch (err) {
                        console.error('Failed to copy text: ', err);
                        alert('Failed to copy notes: ' + err.message);
                      }
                    }}
                    id="copy-notes-btn"
                    className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded flex items-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    Copy Notes
                  </button>
                </div>
                <div className="bg-gray-50 p-4 rounded">
                  <p className="whitespace-pre-wrap">{historyItem.notes}</p>
                </div>
              </div>
            )}

            {activeTab === 'queries' && historyItem.queryAnswers && Array.isArray(historyItem.queryAnswers) && historyItem.queryAnswers.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3">Query Responses</h3>
                <div className="space-y-6">
                  {historyItem.queryAnswers.map((qa, index) => (
                    <div key={index} className="border rounded-lg p-5 bg-gray-50 shadow-sm">
                      <div className="mb-3 pb-2 border-b border-gray-200">
                        <h4 className="font-semibold text-blue-700 mb-2">
                          <span className="text-gray-500 mr-2">#{index+1}</span>
                          {qa.question || qa.prompt}
                        </h4>
                        {qa.timestamp && (
                          <div className="text-xs text-gray-500">
                            Asked on {formatDate(qa.timestamp)}
                          </div>
                        )}
                      </div>
                      <div className="pl-4 border-l-2 border-blue-200 prose max-w-none">
                        <ReactMarkdown>
                          {qa.answer || qa.response}
                        </ReactMarkdown>
                      </div>
                      {qa.metadata && (
                        <div className="mt-3 pt-2 border-t border-gray-200 text-xs text-gray-500 flex gap-4">
                          {qa.metadata.model && <span>Model: {qa.metadata.model}</span>}
                          {qa.metadata.responseLength && <span>{qa.metadata.responseLength} characters</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {activeTab === 'chapters' && historyItem.chapters && Array.isArray(historyItem.chapters) && historyItem.chapters.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3">Video Chapters</h3>
                <div className="space-y-4">
                  {historyItem.chapters.map((chapter, index) => (
                    <div key={index} className="border rounded p-4 bg-gray-50">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">{chapter.title}</h4>
                        <div className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {Math.floor(chapter.timestamp / 60)}:{String(Math.floor(chapter.timestamp % 60)).padStart(2, '0')}
                        </div>
                      </div>
                      {chapter.description && (
                        <p className="mt-2 text-gray-700">{chapter.description}</p>
                      )}
                      <div className="mt-2 text-xs text-gray-500">
                        Created: {formatDate(chapter.createdAt)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {activeTab === 'captions' && historyItem.screenshotCaptions && historyItem.screenshotCaptions.length > 0 && (
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-lg font-semibold">Screenshot Captions</h3>
                  <button 
                    onClick={() => {
                      try {
                        // Create a temporary textarea element to copy text
                        const textarea = document.createElement('textarea');
                        textarea.value = historyItem.screenshotCaptions;
                        
                        // Make the textarea non-visible but still part of the document
                        textarea.style.position = 'fixed';
                        textarea.style.opacity = '0';
                        document.body.appendChild(textarea);
                        
                        // Select and copy the text
                        textarea.select();
                        document.execCommand('copy');
                        
                        // Clean up
                        document.body.removeChild(textarea);
                        
                        // Show success feedback
                        const button = document.getElementById('copy-captions-btn');
                        if (button) {
                          const originalText = button.innerText;
                          button.innerText = 'Copied!';
                          button.classList.remove('bg-blue-500', 'hover:bg-blue-600');
                          button.classList.add('bg-green-500', 'hover:bg-green-600');
                          
                          setTimeout(() => {
                            button.innerText = originalText;
                            button.classList.remove('bg-green-500', 'hover:bg-green-600');
                            button.classList.add('bg-blue-500', 'hover:bg-blue-600');
                          }, 2000);
                        }
                        
                        console.log('Captions text copied successfully');
                      } catch (err) {
                        console.error('Failed to copy text: ', err);
                        alert('Failed to copy captions: ' + err.message);
                      }
                    }}
                    id="copy-captions-btn"
                    className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded flex items-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    Copy Captions
                  </button>
                </div>
                <div className="bg-gray-50 p-4 rounded prose max-w-none">
                  {historyItem.screenshotCaptions.split(/\[\d+:\d+\]/).map((captionBlock, index) => {
                    if (!captionBlock.trim()) return null;
                    
                    // Process the caption text to ensure proper markdown formatting
                    let formattedCaption = captionBlock.trim();
                    
                    // Add heading if needed
                    if (!formattedCaption.startsWith('###')) {
                      formattedCaption = `### Caption ${index + 1}\n\n${formattedCaption}`;
                    }
                    
                    // Format bullet points - convert all bullet patterns to standard markdown
                    formattedCaption = formattedCaption
                      // Fix bullet points by ensuring they start on a new line with proper spacing
                      .replace(/(\* |\- |\• )/g, '\n* ') // Normalize different bullet styles and ensure they're on new lines
                      .replace(/\n\* /g, '\n\n* ') // Add blank line before each bullet
                      .replace(/^\* /g, '\n\n* '); // Handle case where caption starts with a bullet
                    
                    return (
                      <div key={index} className="mb-8 pb-4 border-b border-gray-200 last:border-0">
                        <ReactMarkdown
                          components={{
                            ul: ({node, ...props}) => (
                              <ul className="list-disc pl-4 space-y-2 mb-4" {...props} />
                            ),
                            li: ({node, ...props}) => (
                              <li className="ml-2 mb-1" {...props} />
                            ),
                            h3: ({node, ...props}) => (
                              <h3 className="text-md font-bold text-blue-700 mb-3 mt-4" {...props} />
                            ),
                            p: ({node, ...props}) => (
                              <p className="mb-2" {...props} />
                            )
                          }}
                        >
                          {formattedCaption}
                        </ReactMarkdown>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 text-sm text-gray-500">
                  {historyItem.screenshotCount} screenshots with captions
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default VideoHistoryDetail;