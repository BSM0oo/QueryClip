import React, { useState, useEffect } from 'react';
import axios from 'axios';
import YouTubePlayer from './components/YouTubePlayer';
import EnhancedScreenshotManager from './components/EnhancedScreenshotManager';
import EnhancedScreenshotGallery from './components/EnhancedScreenshotGallery';
import TranscriptViewer from './components/TranscriptViewer';
import NotesManager from './components/NotesManager';
import VideoInfoViewer from './components/VideoInfoViewer';
import FullTranscriptViewer from './components/FullTranscriptViewer';
import usePersistedState from './hooks/usePersistedState';
import { API_BASE_URL } from './config';
import ReactMarkdown from 'react-markdown';

const printStyles = `
  @media print {
    .main-content {
      display: none !important;
    }
    
    .print-content {
      display: block !important;
    }

    .print-content .whitespace-pre-wrap {
      max-height: none !important;
      overflow: visible !important;
    }

    .page-break {
      break-before: page !important;
    }
  }
`;

const appStyles = `
  .app-container {
    width: 100vw;
    min-height: 100vh;
    overflow-x: hidden;
  }

  .content-container {
    width: 100%;
    max-width: 100vw;
    padding: 1rem;
    margin: 0;
    box-sizing: border-box;
  }

  @media (min-width: 640px) {
    .content-container {
      max-width: 80rem;
      margin: 0 auto;
      padding: 2rem;
    }
  }

  .video-container {
    width: 100%;
    position: relative;
    padding-top: 56.25%; /* 16:9 Aspect Ratio */
  }

  .video-container > div {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }
`;

const clearServerState = async (eraseFiles) => {
  try {
    await axios.delete(`${API_BASE_URL}/api/state/clear?eraseFiles=${eraseFiles}`);
  } catch (error) {
    console.error('Error clearing state:', error);
  }
};

const App = () => {
  // Enhanced state management with persistence
  const [videoId, setVideoId] = usePersistedState('yt-notes-videoId', '');
  const [screenshots, setScreenshots] = usePersistedState('yt-notes-screenshots', []);
  const [notes, setNotes] = usePersistedState('yt-notes-notes', '');
  const [transcript, setTranscript] = usePersistedState('yt-notes-transcript', []);
  const [transcriptAnalysis, setTranscriptAnalysis] = usePersistedState('yt-notes-transcriptAnalysis', '');
  const [customPrompt, setCustomPrompt] = usePersistedState('yt-notes-customPrompt', 
    'Based on the following transcript context...'
  );
  const [videoInfo, setVideoInfo] = usePersistedState('yt-notes-videoInfo', null);
  
  // New state for scene detection and content organization
  const [detectedScenes, setDetectedScenes] = usePersistedState('yt-notes-detectedScenes', []);
  const [contentTypes, setContentTypes] = usePersistedState('yt-notes-contentTypes', new Set());

  // UI state (no persistence needed)
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [eraseFiles, setEraseFiles] = useState(() => 
    localStorage.getItem('eraseFilesOnClear') === 'true'
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Add styles to head
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = printStyles + appStyles;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  useEffect(() => {
    localStorage.setItem('eraseFilesOnClear', eraseFiles);
  }, [eraseFiles]);

  useEffect(() => {
    if (player) {
      const interval = setInterval(() => {
        try {
          const time = player.getCurrentTime();
          setCurrentTime(time);
        } catch (error) {
          console.error('Error getting current time:', error);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [player]);

  const extractVideoId = (url) => {
    const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    return match ? match[1] : url;
  };

  const handleScreenshotsTaken = (newScreenshots) => {
    setScreenshots(prev => {
      const updated = [...prev, ...newScreenshots].map(screenshot => ({
        ...screenshot,
        timestamp: Number(screenshot.timestamp),
        image: screenshot.image,
        caption: screenshot.caption || '',
        notes: screenshot.notes || '',
        transcriptContext: screenshot.transcriptContext || '',
        content_type: screenshot.content_type || 'other'
      }));
      
      // Keep only the last 50 screenshots to prevent localStorage size issues
      if (updated.length > 50) {
        console.warn('More than 50 screenshots, keeping only the most recent ones');
        return updated.slice(-50);
      }
      return updated;
    });
  };

  const handleVideoSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setVideoInfo(null);
    setDetectedScenes([]);
    setContentTypes(new Set());
    
    try {
      const id = extractVideoId(videoId);
      if (id) {
        if (player) {
          player.loadVideoById(id);
        }

        const [transcriptResponse, videoInfoResponse] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/transcript/${id}`),
          axios.get(`${API_BASE_URL}/api/video-info/${id}`)
        ]);

        setTranscript(transcriptResponse.data.transcript);
        setVideoInfo(videoInfoResponse.data);
      }
    } catch (error) {
      setError('Error loading video: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayerReady = (ytPlayer) => {
    setPlayer(ytPlayer);
  };

  const clearStoredData = async () => {
    if (confirm('Are you sure you want to clear all data?' + 
        (eraseFiles ? '\nThis will also erase local files.' : ''))) {
      await clearServerState(eraseFiles);
      
      // Clear all persisted state
      const keys = [
        'yt-notes-videoId',
        'yt-notes-screenshots',
        'yt-notes-notes',
        'yt-notes-transcript',
        'yt-notes-transcriptAnalysis',
        'yt-notes-customPrompt',
        'yt-notes-videoInfo',
        'yt-notes-detectedScenes',
        'yt-notes-contentTypes'
      ];
      
      keys.forEach(key => localStorage.removeItem(key));
      
      // Reset state
      setVideoId('');
      setScreenshots([]);
      setNotes('');
      setTranscript([]);
      setTranscriptAnalysis('');
      setCustomPrompt('Based on the following transcript context...');
      setVideoInfo(null);
      setDetectedScenes([]);
      setContentTypes(new Set());
    }
  };

  return (
    <div className="app-container bg-gray-50">
      <div className="content-container">
        <div className="flex flex-col w-full mb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start w-full">
            <div className="flex flex-col w-full sm:w-auto">
              <h1 className="text-2xl sm:text-3xl font-bold">YouTube Notes App</h1>
              {videoInfo?.title && (
                <div className="mt-3 bg-blue-50 border-l-4 border-blue-500 pl-4 py-2 pr-3 rounded-r-lg w-full sm:w-auto">
                  <h2 className="text-xl sm:text-2xl font-semibold text-blue-900 leading-tight">
                    {videoInfo.title}
                  </h2>
                </div>
              )}
            </div>
            <div className="flex items-center gap-4 mt-4 sm:mt-0 w-full sm:w-auto">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={eraseFiles}
                  onChange={(e) => setEraseFiles(e.target.checked)}
                  className="form-checkbox h-4 w-4 text-blue-600"
                />
                <span className="text-sm text-gray-600">Erase local files on clear</span>
              </label>
              <button
                onClick={clearStoredData}
                className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
              >
                Clear All Data
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 w-full">
            {error}
          </div>
        )}
        
        <form onSubmit={handleVideoSubmit} className="mb-4 w-full">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={videoId}
                onChange={(e) => setVideoId(e.target.value)}
                placeholder="Enter YouTube Video URL"
                className="p-2 border rounded text-sm sm:text-base w-full"
              />
            </div>
            <button 
              type="submit" 
              className="w-full sm:w-auto bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Load Video'}
            </button>
          </div>
        </form>

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full">
          {/* Left Column */}
          <div className="space-y-4 flex flex-col">
            {/* Video Container */}
            <div className="video-container">
              {videoId ? (
                <YouTubePlayer 
                  videoId={videoId}
                  onPlayerReady={handlePlayerReady}
                />
              ) : (
                <div className="absolute top-0 left-0 w-full h-full bg-black flex items-center justify-center">
                  <div className="text-red-600 flex flex-col items-center">
                    <svg 
                      className="w-16 h-16 mb-2" 
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                    </svg>
                    <span className="text-white text-lg font-medium">Enter YouTube URL</span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Screenshot Controls */}
            <div>
              <EnhancedScreenshotManager
                videoId={videoId}
                player={player}
                transcript={transcript}
                onScreenshotsTaken={handleScreenshotsTaken}
                customPrompt={customPrompt}
                detectedScenes={detectedScenes}
                onScenesDetected={setDetectedScenes}
              />
            </div>

            {/* Notes & Export Options - positioned to fill remaining height */}
            <div className="flex-grow">
              <NotesManager
                title="Notes & Export Options"
                showButtonText={isNotesVisible => 
                  isNotesVisible ? 'Hide Notes & Export Options' : 'Show Notes & Export Options'
                }
                videoId={videoId}
                videoTitle={videoInfo?.title}
                videoDescription={videoInfo?.description}
                notes={notes}
                onNotesChange={setNotes}
                screenshots={screenshots}
                transcriptAnalysis={transcriptAnalysis}
                transcript={transcript}
              />
            </div>
          </div>

          {/* Right Column - Transcript */}
          <div className="h-full">
            {/* Transcript Controls */}
            <div className="bg-white rounded-lg p-4 border mb-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Transcript Controls</h2>
                {transcript.length > 0 && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setTranscriptAnalysis('')}
                      className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
                    >
                      Clear Outline
                    </button>
                    <button
                      onClick={() => onAnalysisGenerated(transcript)}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
                    >
                      Generate Outline
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          const fullTranscript = transcript
                            .map(item => `[${new Date(item.start * 1000).toISOString().substr(11, 8)}] ${item.text}`)
                            .join('\n');
                          
                          if (navigator.clipboard && window.isSecureContext) {
                            await navigator.clipboard.writeText(fullTranscript);
                          } else {
                            const textArea = document.createElement("textarea");
                            textArea.value = fullTranscript;
                            textArea.style.position = "fixed";
                            textArea.style.left = "-999999px";
                            document.body.appendChild(textArea);
                            textArea.focus();
                            textArea.select();
                            try {
                              document.execCommand('copy');
                            } catch (err) {
                              console.error('Fallback: Oops, unable to copy', err);
                              alert('Copy failed! Please try selecting and copying the text manually.');
                              return;
                            }
                            document.body.removeChild(textArea);
                          }
                          alert('Transcript copied to clipboard!');
                        } catch (err) {
                          console.error('Failed to copy:', err);
                          alert('Failed to copy transcript. Please try again or copy manually.');
                        }
                      }}
                      className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm"
                    >
                      Copy Transcript
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Main Transcript Viewer - now freestanding */}
            <TranscriptViewer
              transcript={transcript}
              currentTime={currentTime}
              onTimeClick={(time) => player?.seekTo(time, true)}
              onAnalysisGenerated={setTranscriptAnalysis}
              className="bg-white rounded-lg h-[600px] overflow-auto"
            />
          </div>
        </div>

        {/* Screenshot Gallery and remaining components */}
        <div className="mt-8">
          <EnhancedScreenshotGallery
            screenshots={screenshots}
            onScreenshotsUpdate={setScreenshots}
            customPrompt={customPrompt}
            videoTitle={videoInfo?.title}
          />
        </div>

        {transcriptAnalysis && (
          <div className="bg-white rounded-lg p-6 border mt-8 w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Generated Transcript Outline</h2>
              <button
                onClick={() => setTranscriptAnalysis('')}
                className="text-red-500 hover:text-red-700"
              >
                Clear Outline
              </button>
            </div>
            <div className="prose prose-lg max-w-none">
              <ReactMarkdown>
                {transcriptAnalysis}
              </ReactMarkdown>
            </div>
          </div>
        )}

        <div className="w-full mt-8">
          <VideoInfoViewer videoInfo={videoInfo} />
        </div>
        
        <div className="w-full mt-8">
          <FullTranscriptViewer transcript={transcript} />
        </div>
      </div>
    </div>
  );
};

export default App;