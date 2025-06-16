import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import usePersistedState from './hooks/usePersistedState';
import MainLayout from './layouts/MainLayout';
import VideoSection from './features/video/VideoSection';
import EnhancedScreenshotManager from './components/screenshot/EnhancedScreenshotManager';
import EnhancedScreenshotGallery from './components/EnhancedScreenshotGallery_New';
import TranscriptViewer from './components/TranscriptViewer';
import NotesManager from './components/NotesManager';
import VideoInfoViewer from './components/VideoInfoViewer';
import FullTranscriptViewer from './components/FullTranscriptViewer';
import ReactMarkdown from 'react-markdown';
import TranscriptPrompt from './components/TranscriptPrompt';
import SaveContentButton from './components/SaveContentButton';
import SaveToHistoryButton from './components/SaveToHistoryButton';
import HistorySaveBar from './components/HistorySaveBar';
import YouTubePlayer from './components/YouTubePlayer'; // Import YouTubePlayer for split view
import { clearServerState, queryTranscript, loadState, saveState, getVideoInfo, fetchTranscript, analyzeTranscript, addOrUpdateVideoHistory, getVideoHistoryItem, saveAllContentToHistory } from './utils/apiUtils';
import { initializeConfig } from './config';

// Hook to detect if user has scrolled near bottom
const useNearBottom = () => {
  const [isNearBottom, setIsNearBottom] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollTop = window.scrollY;
      const distanceFromBottom = documentHeight - (scrollTop + windowHeight);
      setIsNearBottom(distanceFromBottom < 1000);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return isNearBottom;
};

// Maximum number of screenshots to keep
const MAX_SCREENSHOTS = 50;

const App = () => {
  const isNearBottom = useNearBottom();
  // Track layout mode: 0=normal, 1=fullwidth, 2=split view (video left, gallery right)
  const [layoutMode, setLayoutMode] = useState(0);
  const isFullWidth = layoutMode === 1;
  const isSplitView = layoutMode === 2;
  
  // Add a log when layout mode changes and import missing components
  useEffect(() => {
    console.log(`Layout mode changed: ${layoutMode} (isFullWidth: ${isFullWidth}, isSplitView: ${isSplitView})`);
  }, [layoutMode, isFullWidth, isSplitView]);
  
  // For backward compatibility
  const setIsFullWidth = (value) => {
    setLayoutMode(value ? 1 : 0);
  };
  
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
  
  // Chapter markers for organizing screenshots
  const [chapters, setChapters] = usePersistedState('yt-notes-chapters', []);
  
  // Ensure proper saving of screenshot and chapter data
  useEffect(() => {
    try {
      // Manually save screenshots to localStorage to ensure chapter assignments persist
      localStorage.setItem('yt-notes-screenshots', JSON.stringify(screenshots));
      
      // Log screenshot distribution by chapter for debugging
      const chapterCounts = {};
      screenshots.forEach(s => {
        const chapId = s.chapterId !== undefined ? String(s.chapterId) : 'null';
        chapterCounts[chapId] = (chapterCounts[chapId] || 0) + 1;
      });
      console.log('Screenshot distribution by chapter:', chapterCounts);
    } catch (error) {
      console.error('Error saving screenshots to localStorage:', error);
    }
  }, [screenshots]);
  
  // Ensure chapters are saved properly
  useEffect(() => {
    try {
      // Manually save chapters to localStorage
      localStorage.setItem('yt-notes-chapters', JSON.stringify(chapters));
      console.log(`Saved ${chapters.length} chapters to localStorage`);
    } catch (error) {
      console.error('Error saving chapters to localStorage:', error);
    }
  }, [chapters]);

  // UI state (no persistence needed)
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [player, setPlayer] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [eraseFiles, setEraseFiles] = useState(() => 
    localStorage.getItem('eraseFilesOnClear') === 'true'
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isTranscriptVisible, setIsTranscriptVisible] = useState(false);
  const [isMainContentVisible, setIsMainContentVisible] = useState(true);
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = usePersistedState('yt-notes-selectedModel', 'claude-3-haiku-20240307');
  const [componentOrder, setComponentOrder] = usePersistedState('yt-notes-componentOrder', 'transcriptFirst');
  
  // Update document title when video info changes
  useEffect(() => {
    if (videoInfo && videoInfo.title) {
      document.title = `QueryClip - ${videoInfo.title}`;
    } else {
      document.title = 'QueryClip';
    }
  }, [videoInfo]);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch('/api/models');
        const data = await response.json();
        setModels(data.models);
      } catch (error) {
        console.error('Error fetching models:', error);
      }
    };

    fetchModels();
  }, []);

  useEffect(() => {
    localStorage.setItem('eraseFilesOnClear', eraseFiles);
  }, [eraseFiles]);

  // Initialize configuration when app starts
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await initializeConfig();
        console.log('Config loaded:', config);
      } catch (err) {
        console.error('Error loading config:', err);
        setError('Failed to load application configuration. Some features may not work correctly.');
      }
    };
    
    loadConfig();
  }, []);
  
  // Handle URL parameters
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const videoIdFromUrl = searchParams.get('videoId');
    
    if (videoIdFromUrl && videoIdFromUrl !== videoId) {
      console.log(`Loading video from URL parameter: ${videoIdFromUrl}`);
      setLoading(true);
      
      // Load video info
      const loadVideoFromUrl = async () => {
        try {
          // Get video info
          const videoInfoResponse = await getVideoInfo(videoIdFromUrl);
          setVideoInfo(videoInfoResponse);
          
          // Set video ID
          setVideoId(videoIdFromUrl);
          
          // Try to get transcript
          try {
            const transcriptResponse = await fetchTranscript(videoIdFromUrl);
            setTranscript(transcriptResponse.transcript || []);
            
            // Save plain transcript text to history
            try {
              // Get current history item
              const historyItem = await getVideoHistoryItem(videoIdFromUrl).catch(() => null);
              
              if (historyItem && transcriptResponse.transcript && transcriptResponse.transcript.length > 0) {
                // Create plain text version of transcript (without timestamps)
                const plainTranscript = transcriptResponse.transcript
                  .map(item => item.text || '')
                  .join(' ')
                  .trim();
                
                // Update history item with transcript
                await addOrUpdateVideoHistory({
                  ...historyItem,
                  transcript: plainTranscript,
                  lastAccessedAt: new Date().toISOString()
                });
                
                console.log('Updated history with transcript');
              }
            } catch (historyError) {
              console.error('Error updating history with transcript:', historyError);
              // Continue without failing if history update fails
            }
            
            // Generate transcript analysis
            try {
              setIsAnalyzing(true);
              const analysisResponse = await analyzeTranscript(
                transcriptResponse.transcript, 
                videoIdFromUrl,
                selectedModel
              );
              setTranscriptAnalysis(analysisResponse.analysis || '');
            } catch (analysisError) {
              console.error('Error analyzing transcript:', analysisError);
            } finally {
              setIsAnalyzing(false);
            }
          } catch (transcriptError) {
            console.error('Error fetching transcript:', transcriptError);
          }
          
          setError(null);
        } catch (error) {
          console.error('Error loading video from URL:', error);
          setError(`Failed to load video: ${error.message}`);
        } finally {
          setLoading(false);
        }
      };
      
      loadVideoFromUrl();
    }
  }, [searchParams, videoId]);

  // Load screenshots from server on startup
  useEffect(() => {
    const loadServerScreenshots = async () => {
      try {
        const response = await loadState();
        if (response.state && response.state.screenshots && response.state.screenshots.length > 0) {
          console.log(`Found ${response.state.screenshots.length} screenshots on server`);
          
          // Compare with local storage
          const localScreenshots = screenshots;
          
          if (response.state.screenshots.length > localScreenshots.length) {
            console.log('Server has more screenshots than local storage, syncing...');
            setScreenshots(response.state.screenshots);
          } else if (response.state.screenshots.length < localScreenshots.length) {
            console.log('Local storage has more screenshots than server, syncing to server...');
            // Save local screenshots to server
            await saveState({
              screenshots: localScreenshots,
              videoId: videoId,
              timestamp: Date.now()
            });
          }
        }
      } catch (error) {
        console.error('Error loading screenshots from server:', error);
      }
    };
    
    loadServerScreenshots();
  }, []);

  const handleScreenshotDelete = (index) => {
    console.log(`Deleting screenshot at index ${index}`);
    
    // Get the current array and remove the screenshot at the specified index
    setScreenshots(prev => {
      const updated = [...prev];
      updated.splice(index, 1);
      
      // Immediately update localStorage with the new array
      try {
        localStorage.setItem('yt-notes-screenshots', JSON.stringify(updated));
        console.log('Screenshot deletion saved to localStorage');
      } catch (error) {
        console.error('Error saving deletion to localStorage:', error);
      }
      
      return updated;
    });
    
    // Immediately save to server to sync the deletion
    setTimeout(() => {
      try {
        // Use the updated screenshots directly from state instead of reading from localStorage
        saveState({
          screenshots: screenshots, // This will have the updated state
          videoId: videoId,
          chapters: chapters,
          timestamp: Date.now()
        }).then(() => {
          console.log('Successfully saved state after deletion');
        }).catch(err => {
          console.error('Error in server save after deletion:', err);
        });
      } catch (error) {
        console.error('Error preparing server save after deletion:', error);
      }
    }, 300); // Shorter timeout for better responsiveness
  };
  
  const handleScreenshotsTaken = (newScreenshots) => {
    if (!newScreenshots || newScreenshots.length === 0) {
      console.warn('Received empty screenshot array in handleScreenshotsTaken');
      return;
    }
    
    console.log(`Processing ${newScreenshots.length} new screenshot(s)`);
    
    // Process screenshots one at a time for better UI feedback
    setScreenshots(prev => {
      try {
        // Make sure we have valid objects and normalize data
        const processed = newScreenshots.map(screenshot => {
          // Validate screenshot object
          if (!screenshot || typeof screenshot !== 'object') {
            console.error('Invalid screenshot object:', screenshot);
            return null;
          }
          
          // Ensure required properties
          return {
            ...screenshot,
            timestamp: Number(screenshot.timestamp) || Date.now(),
            image: screenshot.image || '', // Image should be base64 or filename
            caption: screenshot.caption || '',
            notes: screenshot.notes || '',
            transcriptContext: screenshot.transcriptContext || '',
            content_type: screenshot.content_type || 'other',
            chapterId: null, // Initialize chapterId to null
            videoId: screenshot.videoId || videoId, // Ensure videoId is set
            id: screenshot.id || Date.now().toString() + Math.random().toString(36).substr(2, 5), // Ensure unique ID
            createdAt: screenshot.createdAt || new Date().toISOString() // Capture creation time for sorting
          };
        }).filter(Boolean); // Remove any nulls
        
        // For immediate UI feedback, add them to the array
        const updated = [...prev, ...processed];
        
        // Ensure screenshots are sorted by timestamp
        updated.sort((a, b) => a.timestamp - b.timestamp);
        
        // Limit to max screenshots
        if (updated.length > MAX_SCREENSHOTS) {
          console.warn(`More than ${MAX_SCREENSHOTS} screenshots, keeping only the most recent ones`);
          return updated.slice(-MAX_SCREENSHOTS);
        }
        
        return updated;
      } catch (error) {
        console.error('Error processing screenshots:', error);
        // Return previous state if there was an error
        return prev;
      }
    });
    
    // Schedule a save to server, but don't await it to keep UI responsive
    setTimeout(() => {
      try {
        const localScreenshots = JSON.parse(localStorage.getItem('yt-notes-screenshots') || '[]');
        const localVideoId = JSON.parse(localStorage.getItem('yt-notes-videoId') || 'null');
        const localChapters = JSON.parse(localStorage.getItem('yt-notes-chapters') || '[]');
        
        saveState({
          screenshots: localScreenshots,
          videoId: localVideoId,
          chapters: localChapters,
          timestamp: Date.now()
        }).catch(err => console.error('Error in background save:', err));
        
        // Also update the screenshot count in the history
        if (videoId) {
          try {
            // Collect captions from all screenshots
            const captionsText = localScreenshots
              .filter(s => s.caption)
              .map(s => `[${Math.floor(s.timestamp / 60)}:${String(Math.floor(s.timestamp % 60)).padStart(2, '0')}] ${s.caption}`)
              .join('\n\n');
            
            // Get current history item
            getVideoHistoryItem(videoId)
              .then(historyItem => {
                if (historyItem) {
                  // Update history item with new screenshot count and captions
                  addOrUpdateVideoHistory({
                    ...historyItem,
                    screenshotCount: localScreenshots.length,
                    screenshotCaptions: captionsText || historyItem.screenshotCaptions, // Keep existing captions if no new ones
                    lastAccessedAt: new Date().toISOString()
                  });
                  
                  console.log(`Updated history with screenshot count: ${localScreenshots.length} and captions`);
                } else {
                  // No history item, create a new one with minimal info
                  addOrUpdateVideoHistory({
                    videoId,
                    screenshotCount: localScreenshots.length,
                    screenshotCaptions: captionsText || '',
                    lastAccessedAt: new Date().toISOString()
                  });
                }
              })
              .catch(err => {
                console.error('Error updating history screenshot count:', err);
                // Try a direct update without getting history first
                addOrUpdateVideoHistory({
                  videoId,
                  screenshotCount: localScreenshots.length,
                  lastAccessedAt: new Date().toISOString()
                });
              });
          } catch (historyError) {
            console.error('Error updating history with screenshot count:', historyError);
            // Continue without failing if history update fails
          }
        }
      } catch (error) {
        console.error('Error preparing background save:', error);
      }
    }, 2000);
  };

  // Chapter management functions
  const addChapter = (afterScreenshotIndex) => {
    const timestamp = afterScreenshotIndex >= 0 && screenshots[afterScreenshotIndex] 
      ? screenshots[afterScreenshotIndex].timestamp 
      : currentTime;
    
    const newChapter = {
      id: Date.now().toString(),
      title: "New Chapter",
      timestamp: timestamp,
      afterScreenshotIndex: afterScreenshotIndex,
      createdAt: new Date().toISOString()
    };
    
    setChapters(prev => {
      const updatedChapters = [...prev, newChapter];
      
      // Save chapters to history
      if (videoId) {
        try {
          addOrUpdateVideoHistory({
            videoId,
            chapters: updatedChapters,
          });
        } catch (error) {
          console.error("Error saving chapters to history:", error);
        }
      }
      
      return updatedChapters;
    });
    
    return newChapter;
  };
  
  const updateChapter = (chapterId, updates) => {
    setChapters(prev => {
      const updatedChapters = prev.map(chapter => 
        chapter.id === chapterId ? { ...chapter, ...updates } : chapter
      );
      
      // Save chapters to history
      if (videoId) {
        try {
          addOrUpdateVideoHistory({
            videoId,
            chapters: updatedChapters,
          });
        } catch (error) {
          console.error("Error saving updated chapters to history:", error);
        }
      }
      
      return updatedChapters;
    });
  };
  
  const deleteChapter = (chapterId) => {
    // Before deleting the chapter, update any screenshots that were in this chapter
    // to remove the chapter association
    setScreenshots(prev => {
      const updatedScreenshots = prev.map(screenshot => 
        screenshot.chapterId === chapterId 
          ? { ...screenshot, chapterId: null } 
          : screenshot
      );
      
      // Save updated screenshots to history
      if (videoId) {
        try {
          addOrUpdateVideoHistory({
            videoId,
            screenshotCount: updatedScreenshots.length,
          });
        } catch (error) {
          console.error("Error saving updated screenshots to history:", error);
        }
      }
      
      return updatedScreenshots;
    });
    
    // Then delete the chapter
    setChapters(prev => {
      const updatedChapters = prev.filter(chapter => chapter.id !== chapterId);
      
      // Save chapters to history
      if (videoId) {
        try {
          addOrUpdateVideoHistory({
            videoId,
            chapters: updatedChapters,
          });
        } catch (error) {
          console.error("Error saving updated chapters to history:", error);
        }
      }
      
      return updatedChapters;
    });
  };
  
  // Handle screenshot edit actions (edit or delete)
  const handleScreenshotEdit = (index, action = 'edit') => {
    if (action === 'delete') {
      handleScreenshotDelete(index);
    } else {
      // Regular edit functionality would go here
      console.log(`Editing screenshot at index ${index}`);
      // For now, we're not implementing edit functionality
    }
  };
  
  // Function to assign a screenshot to a chapter
  const assignScreenshotToChapter = (screenshotIndex, chapterId) => {
    setScreenshots(prev => {
      const updated = [...prev];
      updated[screenshotIndex] = {
        ...updated[screenshotIndex],
        chapterId: chapterId
      };
      
      // Save updated screenshots to history
      if (videoId) {
        try {
          addOrUpdateVideoHistory({
            videoId,
            screenshotCount: updated.length,
          });
        } catch (error) {
          console.error("Error saving updated screenshots to history:", error);
        }
      }
      
      return updated;
    });
  };
  
  // Function to handle chapter-based reorganization
  const handleReorganizeChapter = (sourceIndex, destinationIndex, chapterId) => {
    console.log(`Moving screenshot from index ${sourceIndex} to index ${destinationIndex} in chapter ${chapterId}`);
    
    setScreenshots(prev => {
      try {
        // Create a copy of the screenshots array
        const updated = [...prev];
        
        // Check if indices are valid
        if (sourceIndex < 0 || sourceIndex >= updated.length) {
          console.error(`Invalid source index: ${sourceIndex}, max: ${updated.length - 1}`);
          return prev;
        }
        
        // Get the screenshot to move without immediately removing it
        const screenshotToMove = {...updated[sourceIndex]};
        
        // First remove the screenshot from its original position
        updated.splice(sourceIndex, 1);
        
        // Update its chapter assignment
        screenshotToMove.chapterId = chapterId;
        
        // Ensure destination index is valid for the new array length
        const maxIndex = updated.length;
        let adjustedDestIndex = sourceIndex < destinationIndex ? destinationIndex - 1 : destinationIndex;
        
        // Bounds check
        if (adjustedDestIndex < 0) {
          adjustedDestIndex = 0;
        } else if (adjustedDestIndex > maxIndex) {
          adjustedDestIndex = maxIndex;
        }
        
        // Insert the screenshot at the new position
        updated.splice(adjustedDestIndex, 0, screenshotToMove);
        
        // Save updated screenshots to history
        if (videoId) {
          try {
            addOrUpdateVideoHistory({
              videoId,
              screenshotCount: updated.length,
            });
          } catch (error) {
            console.error("Error saving reorganized screenshots to history:", error);
          }
        }
        
        console.log(`Successfully reorganized screenshots. New chapter ID: ${chapterId}`);
        return updated;
      } catch (error) {
        console.error('Error during screenshot reorganization:', error);
        return prev; // Return previous state on error
      }
    });
    
    // Immediately save to localStorage to ensure persistence
    setTimeout(() => {
      try {
        // Force a save to server
        saveState({
          screenshots: screenshots,
          videoId: videoId,
          chapters: chapters,
          timestamp: Date.now()
        }).then(() => {
          console.log('Successfully saved state after reorganization');
          
          // Save chapters to history after reorganization
          if (videoId) {
            try {
              addOrUpdateVideoHistory({
                videoId,
                chapters: chapters,
              });
            } catch (error) {
              console.error("Error saving chapters to history after reorganization:", error);
            }
          }
        }).catch(err => {
          console.error('Error saving state after reorganization:', err);
        });
      } catch (error) {
        console.error('Error preparing state save after reorganization:', error);
      }
    }, 500);
  };

  const handlePromptSubmit = async (prompt) => {
    try {
      // Pass videoId to save to history directly from the API
      const response = await queryTranscript(transcript, prompt, videoId, selectedModel);
      console.log('Query response:', response);
      const newScreenshot = {
        timestamp: currentTime,
        type: 'prompt_response',
        prompt: prompt,
        response: response.response,
        createdAt: new Date().toISOString(),
        chapterId: null // Initialize chapterId to null
      };

      setScreenshots(prev => [...prev, newScreenshot]);
      
      // Save query and response to history if video ID is available
      if (videoId) {
        try {
          // Get current history item
          const historyItem = await getVideoHistoryItem(videoId).catch(() => null);
          
          if (historyItem) {
            // Create query answers array if it doesn't exist
            const queryAnswers = historyItem.queryAnswers || [];
            
            // Add new query
            queryAnswers.push({
              prompt: prompt,
              response: response.response,
              timestamp: new Date().toISOString()
            });
            
            // Update history item
            await addOrUpdateVideoHistory({
              ...historyItem,
              queryAnswers,
              lastAccessedAt: new Date().toISOString()
            });
            
            console.log('Updated history with new query response');
          }
        } catch (historyError) {
          console.error('Error updating history with query:', historyError);
          // Continue without failing if history update fails
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error submitting prompt:', error);
      setError('Failed to process prompt: ' + (error.response?.data?.detail || error.message));
      return false;
    }
  };

  const handleAnalysisGenerated = async () => {
    try {
      setIsAnalyzing(true);
      setError('');
      const response = await analyzeTranscript(transcript, videoId, selectedModel);
      const analysisText = response.analysis || '';
      setTranscriptAnalysis(analysisText);
      
      if (videoId) {
        try {
          const historyItem = await getVideoHistoryItem(videoId).catch(() => null);
          if (historyItem) {
            await addOrUpdateVideoHistory({
              ...historyItem,
              transcriptAnalysis: analysisText,
              lastAccessedAt: new Date().toISOString()
            });
            console.log('Updated history with transcript analysis');
          }
        } catch (historyError) {
          console.error('Error updating history with transcript analysis:', historyError);
        }
      }
    } catch (error) {
      console.error('Error analyzing transcript:', error);
      setError('Failed to analyze transcript: ' + (error.response?.data?.detail || error.message));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const clearStoredData = async () => {
    if (confirm('Are you sure you want to clear all data?' + 
        (eraseFiles ? '\nThis will also erase local files.' : ''))) {
      await clearServerState(eraseFiles);
      
      const keys = [
        'yt-notes-videoId',
        'yt-notes-screenshots',
        'yt-notes-notes',
        'yt-notes-transcript',
        'yt-notes-transcriptAnalysis',
        'yt-notes-customPrompt',
        'yt-notes-videoInfo',
        'yt-notes-detectedScenes',
        'yt-notes-contentTypes',
        'yt-notes-chapters'
      ];
      
      keys.forEach(key => localStorage.removeItem(key));
      
      setVideoId('');
      setScreenshots([]);
      setNotes('');
      setTranscript([]);
      setTranscriptAnalysis('');
      setCustomPrompt('Based on the following transcript context...');
      setVideoInfo(null);
      setDetectedScenes([]);
      setContentTypes(new Set());
      setChapters([]);
    }
  };

  return (
    <>
      {/* History Save Bar - appears at top of screen when content is available */}
      {videoId && (
        <HistorySaveBar 
          videoId={videoId}
          videoInfo={videoInfo}
          transcript={transcript}
          transcriptAnalysis={transcriptAnalysis}
          notes={notes}
          screenshots={screenshots}
          chapters={chapters}
        />
      )}
      
      <MainLayout isFullWidth={isFullWidth} isSplitView={isSplitView} videoInfo={videoInfo} error={error}>
        {isMainContentVisible && (
        <>
          {/* Only show VideoSection in normal and fullwidth views */}
          {!isSplitView && (
            <VideoSection 
              videoId={videoId}
              setVideoId={setVideoId}
              setTranscript={setTranscript}
              setVideoInfo={setVideoInfo}
              isFullWidth={isFullWidth}
              setIsFullWidth={setIsFullWidth}
              layoutMode={layoutMode}
              setLayoutMode={setLayoutMode}
              onClearData={clearStoredData}
              eraseFiles={eraseFiles}
              setEraseFiles={setEraseFiles}
              setError={setError}
              setPlayer={setPlayer}
              player={player}
              currentTime={currentTime}
            />
          )}
          
          {/* In split view, show a compact version of the controls */}
          {isSplitView && (
            <div className="flex justify-between items-center mb-4">
              <div className="flex-grow">
                <input
                  type="text"
                  value={videoId || ''}
                  placeholder="Current video ID"
                  className="p-2 border rounded w-full lg:w-1/2"
                  readOnly
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setLayoutMode(0)}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
                  title="Switch to normal view"
                >
                  ⊞
                </button>
                <button
                  onClick={clearStoredData}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded"
                  title="Clear all data"
                >
                  Clear Data
                </button>
              </div>
            </div>
          )}

          {isSplitView ? (
            // Split view layout (video & controls on left, gallery on right)
            <div className="flex flex-col md:flex-row w-full gap-4 overflow-hidden mt-4">
              {/* Left column: Transcript controls and other info */}
              <div className="w-full md:w-1/2 flex flex-col space-y-4 overflow-y-auto pr-2">
                <div className="mb-4 p-4 bg-gray-100 rounded">
                  <h2 className="text-lg font-bold mb-2">Video Controls</h2>
                  <p className="text-gray-600 mb-3">
                    Video player is shown below.<br/>
                    Screenshots gallery is displayed on the right.
                  </p>
                  
                  {/* Small embedded video player */}
                  {videoId && (
                    <div className="w-full aspect-video rounded overflow-hidden shadow-md">
                      <iframe 
                        className="w-full h-full"
                        src={`https://www.youtube.com/embed/${videoId}?start=${Math.floor(currentTime)}&controls=1&modestbranding=1&rel=0&playsinline=1&picture-in-picture=1&pip=1`}
                        allowFullScreen
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        title="YouTube video player"
                      ></iframe>
                    </div>
                  )}
                  
                  {/* Add screenshot capture controls */}
                  {videoId && (
                    <div className="mt-4">
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
                  )}
                </div>
                
                {/* Transcript Controls */}
                <div className="bg-white rounded-lg p-4 border">
                  <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                      <h2 className="text-xl font-bold">Transcript Controls</h2>
                      {transcript.length > 0 && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAnalysisGenerated(transcript)}
                            className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
                            disabled={isAnalyzing}
                          >
                            {isAnalyzing ? 'Generating...' : 'Generate Outline'}
                          </button>
                          <button
                            onClick={() => setIsTranscriptVisible(!isTranscriptVisible)}
                            className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded text-sm"
                          >
                            {isTranscriptVisible ? 'Hide Transcript' : 'Show Transcript'}
                          </button>
                        </div>
                      )}
                    </div>
                    {transcript.length > 0 && (
                      <TranscriptPrompt onSubmit={handlePromptSubmit} />
                    )}
                  </div>
                </div>
                
                {/* Transcript Viewer (conditionally rendered) */}
                {isTranscriptVisible && (
                  <TranscriptViewer
                    transcript={transcript}
                    currentTime={currentTime}
                    onTimeClick={(time) => player?.seekTo(time)}
                    onAnalysisGenerated={handleAnalysisGenerated}
                    className="bg-white rounded-lg h-[400px] overflow-auto"
                  />
                )}
                
                {/* Transcript Analysis (if available) */}
                {transcriptAnalysis && (
                  <div className="bg-white rounded-lg p-3 border mt-2 w-full">
                    <div className="flex justify-between items-center mb-2">
                      <h2 className="text-lg font-bold">Generated Transcript Outline</h2>
                      <button
                        onClick={() => setTranscriptAnalysis('')}
                        className="text-red-500 hover:text-red-700"
                      >
                        Clear Outline
                      </button>
                    </div>
                    <div className="prose max-w-none text-sm">
                      <ReactMarkdown
                        components={{
                          ul: ({node, ...props}) => (
                            <ul className="list-disc pl-4 space-y-0 mb-2" {...props} />
                          ),
                          li: ({node, ...props}) => (
                            <li className="ml-4 leading-tight py-0.5" {...props} />
                          ),
                          h2: ({node, ...props}) => (
                            <h2 className="text-base font-bold mt-2 mb-1" {...props} />
                          ),
                          p: ({node, ...props}) => (
                            <p className="mb-1 leading-tight" {...props} />
                          ),
                          strong: ({node, ...props}) => (
                            <strong className="font-bold" {...props} />
                          )
                        }}
                      >
                        {transcriptAnalysis}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}
                
                {/* Video Info */}
                <div className="w-full">
                  <VideoInfoViewer videoInfo={videoInfo} />
                </div>
              </div>

              {/* Right column: Only screenshot gallery */}
              <div className="w-full md:w-1/2 border-l pl-4 overflow-y-auto h-[calc(100vh-150px)]">
                {/* We'll pre-render the gallery here for split view */}
                <h2 className="text-2xl font-bold mb-4">Screenshots & Notes</h2>
                <div className="split-view-gallery">
                  <EnhancedScreenshotGallery
                    screenshots={screenshots}
                    onScreenshotsUpdate={setScreenshots}
                    customPrompt={customPrompt}
                    videoTitle={videoInfo?.title}
                    transcript={transcript}
                  chapters={chapters}
                  onAddChapter={addChapter}
                  onUpdateChapter={updateChapter}
                  onDeleteChapter={deleteChapter}
                  onAssignScreenshotToChapter={assignScreenshotToChapter}
                  onReorganizeChapter={handleReorganizeChapter}
                  onScreenshotEdit={handleScreenshotEdit}
                />
                </div>
              </div>
            </div>
          ) : (
            // Normal or full-width layout
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-4 w-full">
              {componentOrder === 'transcriptFirst' ? (
                <>
                  <div className="space-y-4 flex flex-col">
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
                  </div>
                  <div className="h-full space-y-4">
                    <div className="bg-white rounded-lg p-4 border">
                      <div className="flex flex-col gap-4">
                        <div className="flex justify-between items-center">
                          <h2 className="text-xl font-bold">Transcript Controls</h2>
                          {transcript.length > 0 && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleAnalysisGenerated(transcript)}
                                className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
                                disabled={isAnalyzing}
                              >
                                {isAnalyzing ? 'Generating...' : 'Generate Outline'}
                              </button>
                              <button
                                onClick={() => setIsTranscriptVisible(!isTranscriptVisible)}
                                className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded text-sm"
                              >
                                {isTranscriptVisible ? 'Hide Transcript' : 'Show Transcript'}
                              </button>
                            </div>
                          )}
                        </div>
                        {transcript.length > 0 && (
                          <TranscriptPrompt onSubmit={handlePromptSubmit} />
                        )}
                      </div>
                    </div>

                    {isTranscriptVisible && (
                      <TranscriptViewer
                        transcript={transcript}
                        currentTime={currentTime}
                        onTimeClick={(time) => player?.seekTo(time)}
                        onAnalysisGenerated={handleAnalysisGenerated}
                        className="bg-white rounded-lg h-[600px] overflow-auto"
                      />
                    )}

                    <div className="mt-4">
                      <NotesManager
                        title="Notes & Export Options"
                        showButtonText={isNotesVisible => 
                          isNotesVisible ? 'Hide Notes & Export Options' : 'Show Notes & Export Options'
                        }
                        videoId={videoId}
                        videoTitle={videoInfo?.title}
                        videoDescription={videoInfo?.description}
                        notes={notes}
                        onNotesChange={(newNotes) => {
                          setNotes(newNotes);
                          
                          // Also save to history if video ID is available
                          if (videoId) {
                            // Use a debounced approach to avoid too many API calls
                            if (window.notesSaveTimeout) {
                              clearTimeout(window.notesSaveTimeout);
                            }
                            window.notesSaveTimeout = setTimeout(async () => {
                              try {
                                // Get current history item
                                const historyItem = await getVideoHistoryItem(videoId).catch(() => null);
                                
                                if (historyItem) {
                                  // Update history item with notes
                                  await addOrUpdateVideoHistory({
                                    ...historyItem,
                                    notes: newNotes,
                                    lastAccessedAt: new Date().toISOString()
                                  });
                                  
                                  console.log('Updated history with notes');
                                }
                              } catch (historyError) {
                                console.error('Error updating history with notes:', historyError);
                                // Continue without failing if history update fails
                              }
                            }, 1500); // Save after 1.5s of inactivity
                          }
                        }}
                        screenshots={screenshots}
                        transcriptAnalysis={transcriptAnalysis}
                        transcript={transcript}
                      >
                        <div className="mt-4">
                          <label htmlFor="model-select" className="block text-sm font-medium text-gray-700">
                            AI Model
                          </label>
                          <select
                            id="model-select"
                            value={selectedModel}
                            onChange={(e) => setSelectedModel(e.target.value)}
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                          >
                            {models.map((model) => (
                              <option key={model} value={model}>
                                {model}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="mt-4">
                          <label htmlFor="component-order" className="block text-sm font-medium text-gray-700">
                            Component Order
                          </label>
                          <select
                            id="component-order"
                            value={componentOrder}
                            onChange={(e) => setComponentOrder(e.target.value)}
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                          >
                            <option value="transcriptFirst">Transcript First</option>
                            <option value="screenshotsFirst">Screenshots First</option>
                          </select>
                        </div>
                      </NotesManager>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="h-full space-y-4">
                    <div className="bg-white rounded-lg p-4 border">
                      <div className="flex flex-col gap-4">
                        <div className="flex justify-between items-center">
                          <h2 className="text-xl font-bold">Transcript Controls</h2>
                          {transcript.length > 0 && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleAnalysisGenerated(transcript)}
                                className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
                                disabled={isAnalyzing}
                              >
                                {isAnalyzing ? 'Generating...' : 'Generate Outline'}
                              </button>
                              <button
                                onClick={() => setIsTranscriptVisible(!isTranscriptVisible)}
                                className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded text-sm"
                              >
                                {isTranscriptVisible ? 'Hide Transcript' : 'Show Transcript'}
                              </button>
                            </div>
                          )}
                        </div>
                        {transcript.length > 0 && (
                          <TranscriptPrompt onSubmit={handlePromptSubmit} />
                        )}
                      </div>
                    </div>

                    {isTranscriptVisible && (
                      <TranscriptViewer
                        transcript={transcript}
                        currentTime={currentTime}
                        onTimeClick={(time) => player?.seekTo(time)}
                        onAnalysisGenerated={handleAnalysisGenerated}
                        className="bg-white rounded-lg h-[600px] overflow-auto"
                      />
                    )}

                    <div className="mt-4">
                      <NotesManager
                        title="Notes & Export Options"
                        showButtonText={isNotesVisible => 
                          isNotesVisible ? 'Hide Notes & Export Options' : 'Show Notes & Export Options'
                        }
                        videoId={videoId}
                        videoTitle={videoInfo?.title}
                        videoDescription={videoInfo?.description}
                        notes={notes}
                        onNotesChange={(newNotes) => {
                          setNotes(newNotes);
                          
                          // Also save to history if video ID is available
                          if (videoId) {
                            // Use a debounced approach to avoid too many API calls
                            if (window.notesSaveTimeout) {
                              clearTimeout(window.notesSaveTimeout);
                            }
                            window.notesSaveTimeout = setTimeout(async () => {
                              try {
                                // Get current history item
                                const historyItem = await getVideoHistoryItem(videoId).catch(() => null);
                                
                                if (historyItem) {
                                  // Update history item with notes
                                  await addOrUpdateVideoHistory({
                                    ...historyItem,
                                    notes: newNotes,
                                    lastAccessedAt: new Date().toISOString()
                                  });
                                  
                                  console.log('Updated history with notes');
                                }
                              } catch (historyError) {
                                console.error('Error updating history with notes:', historyError);
                                // Continue without failing if history update fails
                              }
                            }, 1500); // Save after 1.5s of inactivity
                          }
                        }}
                        screenshots={screenshots}
                        transcriptAnalysis={transcriptAnalysis}
                        transcript={transcript}
                      >
                        <div className="mt-4">
                          <label htmlFor="model-select" className="block text-sm font-medium text-gray-700">
                            AI Model
                          </label>
                          <select
                            id="model-select"
                            value={selectedModel}
                            onChange={(e) => setSelectedModel(e.target.value)}
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                          >
                            {models.map((model) => (
                              <option key={model} value={model}>
                                {model}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="mt-4">
                          <label htmlFor="component-order" className="block text-sm font-medium text-gray-700">
                            Component Order
                          </label>
                          <select
                            id="component-order"
                            value={componentOrder}
                            onChange={(e) => setComponentOrder(e.target.value)}
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                          >
                            <option value="transcriptFirst">Transcript First</option>
                            <option value="screenshotsFirst">Screenshots First</option>
                          </select>
                        </div>
                      </NotesManager>
                    </div>
                  </div>
                  <div className="space-y-4 flex flex-col">
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
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* Only show this section when NOT in split view mode */}
      {!isSplitView && (
        <div className="mt-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Screenshots & Notes</h2>
            <button
              onClick={() => setIsMainContentVisible(!isMainContentVisible)}
              className="flex items-center gap-2 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
            >
              {isMainContentVisible ? (
                <>
                  <span>Hide Video & Transcript</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </>
              ) : (
                <>
                  <span>Show Video & Transcript</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </>
              )}
            </button>
          </div>
          <EnhancedScreenshotGallery
            screenshots={screenshots}
            onScreenshotsUpdate={setScreenshots}
            customPrompt={customPrompt}
            videoTitle={videoInfo?.title}
            transcript={transcript}
            chapters={chapters}
            onAddChapter={addChapter}
            onUpdateChapter={updateChapter}
            onDeleteChapter={deleteChapter}
            onAssignScreenshotToChapter={assignScreenshotToChapter}
            onReorganizeChapter={handleReorganizeChapter}
            onScreenshotEdit={handleScreenshotEdit}
          />
      </div>
      )}

      {/* Show transcript analysis in all views */}
      {!isSplitView && transcriptAnalysis && (
        <div className="bg-white rounded-lg p-3 border mt-6 w-full mb-6">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-bold">Generated Transcript Outline</h2>
            <button
              onClick={() => setTranscriptAnalysis('')}
              className="text-red-500 hover:text-red-700"
            >
              Clear Outline
            </button>
          </div>
          <div className="prose max-w-none text-sm">
            <ReactMarkdown
              components={{
                ul: ({node, ...props}) => (
                  <ul className="list-disc pl-4 space-y-0 mb-2" {...props} />
                ),
                li: ({node, ...props}) => (
                  <li className="ml-4 leading-tight py-0.5" {...props} />
                ),
                h2: ({node, ...props}) => (
                  <h2 className="text-base font-bold mt-2 mb-1" {...props} />
                ),
                p: ({node, ...props}) => (
                  <p className="mb-1 leading-tight" {...props} />
                ),
                strong: ({node, ...props}) => (
                  <strong className="font-bold" {...props} />
                )
              }}
            >
              {transcriptAnalysis}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {!isSplitView && (
        <div className="w-full mt-8">
          <VideoInfoViewer videoInfo={videoInfo} />
        </div>
      )}
      
      {!isSplitView && (
        <div className="w-full mt-8">
          <FullTranscriptViewer transcript={transcript} />
        </div>
      )}

      {isNearBottom && !isSplitView && (
        <div className="flex flex-col items-center gap-4">
          <SaveContentButton
            screenshots={screenshots}
            videoInfo={videoInfo}
            transcriptAnalysis={transcriptAnalysis}
            transcript={transcript}
            disabled={!videoId || screenshots.length === 0}
          />
          
          {videoId && (
            <SaveToHistoryButton
              videoId={videoId}
              videoInfo={videoInfo}
              transcript={transcript}
              transcriptAnalysis={transcriptAnalysis}
              notes={notes}
              screenshots={screenshots}
              chapters={chapters}
              disabled={!transcript.length}
              className="mb-4"
            />
          )}
        </div>
      )}
    </MainLayout>
    </>
  
  );
};

export default App;
