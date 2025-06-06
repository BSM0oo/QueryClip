import React, { useState, useCallback, useEffect } from 'react';
import YouTubePlayer from '../../components/YouTubePlayer';
import { fetchVideoInfo, fetchTranscript } from '../../utils/apiUtils';

const VideoSection = ({ 
  videoId, 
  setVideoId, 
  setTranscript, 
  setVideoInfo,
  isFullWidth,
  setIsFullWidth,
  layoutMode,
  setLayoutMode,
  onClearData,
  eraseFiles,
  setEraseFiles,
  setError,
  setPlayer,
  player,
  currentTime
}) => {
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Reset input field when videoId changes externally
  useEffect(() => {
    if (videoId && videoId !== inputValue) {
      setInputValue(videoId);
    }
  }, [videoId]);

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  const extractVideoId = (input) => {
    // Input validation - return early if input is null, undefined, or not a string
    if (!input || typeof input !== 'string') {
      console.error("Invalid input to extractVideoId:", input);
      return null;
    }
    
    input = input.trim();
    console.log("Extracting video ID from:", input);
    
    try {
      // Extract video ID from full URL if needed
      if (input.includes('youtube.com/watch?v=')) {
        const url = new URL(input);
        const id = url.searchParams.get('v');
        console.log("Extracted ID from youtube.com/watch?v=:", id);
        return id;
      } else if (input.includes('youtu.be/')) {
        const id = input.split('youtu.be/')[1]?.split('?')[0];
        console.log("Extracted ID from youtu.be/:", id);
        return id;
      } else if (input.includes('youtube.com/embed/')) {
        const id = input.split('youtube.com/embed/')[1]?.split('?')[0];
        console.log("Extracted ID from youtube.com/embed/:", id);
        return id;
      }
      // Otherwise assume it's already just the ID
      console.log("Using input as direct video ID");
      return input;
    } catch (error) {
      console.error("Error extracting video ID:", error);
      return null;
    }
  };

  const loadVideo = useCallback(async () => {
    if (!inputValue.trim()) return;
    
    const extractedId = extractVideoId(inputValue.trim());
    if (!extractedId) {
      setError("Invalid YouTube URL or video ID");
      return;
    }
    
    console.log(`Loading video with ID: ${extractedId}`);
    setLoading(true);
    setError('');
    
    try {
      // Load transcript
      const transcriptResponse = await fetchTranscript(extractedId);
      if (!transcriptResponse.transcript) {
        throw new Error("Failed to load transcript");
      }
      setTranscript(transcriptResponse.transcript);
      
      // Extract plain text from transcript for history
      let plainTranscript = '';
      if (Array.isArray(transcriptResponse.transcript)) {
        plainTranscript = transcriptResponse.transcript
          .map(item => item.text || '')
          .join('\n');
      } else {
        plainTranscript = transcriptResponse.transcript.toString();
      }
      
      // Load video info
      try {
        const videoInfoResponse = await fetchVideoInfo(extractedId);
        setVideoInfo(videoInfoResponse);
        
        // Explicitly save transcript to history
        import('../../utils/apiUtils').then(apiUtils => {
          try {
            apiUtils.addOrUpdateVideoHistory({
              videoId: extractedId,
              transcript: plainTranscript,
              lastAccessedAt: new Date().toISOString()
            });
            console.log("Explicitly saved transcript to history from VideoSection");
          } catch (historyError) {
            console.error("Error saving transcript to history:", historyError);
          }
        });
      } catch (infoError) {
        console.error("Error fetching video info:", infoError);
        // Don't block the whole process if just video info fails
      }
      
      // Set the video ID only if everything succeeds
      setVideoId(extractedId);
    } catch (error) {
      console.error("Error loading video:", error);
      setError(error?.response?.data?.detail || error.message || String(error));
    } finally {
      setLoading(false);
    }
  }, [inputValue, setVideoId, setTranscript, setVideoInfo, setError]);

  const handlePlayerReady = (playerInstance) => {
    console.log("Player ready", playerInstance);
    setPlayer(playerInstance);
  };

  const handlePlayerError = (error) => {
    console.error("YouTube player error:", error);
    setError(`YouTube player error: ${error}`);
  };

  const handleTimeUpdate = (time) => {
    // This will update the current time in the parent component
    // No need to store it locally
  };

  // Handle keyboard shortcut for video loading
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      loadVideo();
    }
  };

  return (
    <div className="mb-4">
      <div className="flex flex-col md:flex-row gap-2 mb-4">
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Enter YouTube URL or video ID"
          className="flex-1 p-2 border rounded"
          disabled={loading}
        />
        <button
          onClick={loadVideo}
          disabled={loading || !inputValue.trim()}
          className={`px-4 py-2 rounded ${
            loading
              ? 'bg-gray-400'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          {loading ? 'Loading...' : 'Load Video'}
        </button>
        <button
          onClick={() => {
            // Cycle through the layout modes: normal → fullwidth → split view → normal
            const newMode = (layoutMode + 1) % 3;
            console.log(`Changing layout mode from ${layoutMode} to ${newMode}`);
            setLayoutMode(newMode);
          }}
          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
          title={
            layoutMode === 0 ? "Switch to widescreen view" : 
            layoutMode === 1 ? "Switch to split view (video left, gallery right)" :
            "Switch to normal view"
          }
        >
          {layoutMode === 0 ? '⊡' : layoutMode === 1 ? '⊟' : '⊞'}
        </button>
        <button
          onClick={onClearData}
          className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded"
          title="Clear all data"
        >
          Clear Data
        </button>
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={eraseFiles}
            onChange={(e) => setEraseFiles(e.target.checked)}
            className="mr-2"
          />
          <span className="text-sm">Erase Files</span>
        </label>
      </div>

      {/* YouTube player */}
      {videoId && (
        <div className="w-full relative">
          <YouTubePlayer
            videoId={videoId}
            onReady={handlePlayerReady}
            onError={handlePlayerError}
            onTimeUpdate={handleTimeUpdate}
            className="w-full aspect-video"
          />
        </div>
      )}
    </div>
  );
};

export default VideoSection;