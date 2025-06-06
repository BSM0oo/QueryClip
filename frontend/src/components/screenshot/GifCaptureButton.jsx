import React, { useState } from 'react';
import { captureGif } from '../../utils/apiUtils';

const GifCaptureButton = ({ videoId, player, onGifCaptured }) => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [duration, setDuration] = useState(3.0);
  const [fps, setFps] = useState(10);

  const captureGifFromVideo = async () => {
    if (!player || !videoId) {
      setError('Video player not ready or no video loaded');
      return;
    }

    try {
      setLoading(true);
      setProgress(10);
      
      // Get the current timestamp
      const currentTime = player.getCurrentTime();
      player.pauseVideo();

      setProgress(30);
      
      // Capture GIF
      const gifData = await captureGif(
        videoId, 
        currentTime, 
        duration,
        fps,
        480 // width
      );

      setProgress(90);

      if (gifData && gifData.gif_data) {
        const newGif = {
          id: `gif_${Date.now()}`,
          videoId,
          timestamp: currentTime,
          image: gifData.gif_data,
          duration: duration,
          fps: fps,
          type: 'gif',
          createdAt: new Date().toISOString()
        };

        // Call the parent handler
        if (onGifCaptured) {
          onGifCaptured(newGif);
        }
      } else {
        throw new Error('GIF data not received');
      }

      setProgress(100);

    } catch (error) {
      console.error('Error capturing GIF:', error);
      setError(error?.response?.data?.detail || error.message || 'Failed to capture GIF');
    } finally {
      setLoading(false);
      setTimeout(() => setProgress(0), 1000);
    }
  };

  return (
    <div className="w-full">
      <button
        onClick={() => setShowOptions(!showOptions)}
        className="w-full bg-purple-500 hover:bg-purple-600 text-white py-2 px-4 rounded mb-2"
      >
        {showOptions ? 'Hide GIF Options' : 'Create Animated GIF'}
      </button>
      
      {showOptions && (
        <div className="bg-gray-50 p-3 rounded border">
          <div className="mb-2">
            <label className="block text-sm text-gray-700">Duration (seconds)</label>
            <input 
              type="range" 
              min="1" 
              max="5" 
              step="0.5" 
              value={duration}
              onChange={(e) => setDuration(parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="text-xs text-gray-500 text-right">{duration}s</div>
          </div>
          
          <div className="mb-3">
            <label className="block text-sm text-gray-700">Frames Per Second</label>
            <select
              value={fps}
              onChange={(e) => setFps(parseInt(e.target.value))}
              className="w-full p-1 text-sm border rounded"
            >
              <option value="5">5 FPS (Smaller file)</option>
              <option value="10">10 FPS (Standard)</option>
              <option value="15">15 FPS (Smoother)</option>
            </select>
          </div>
          
          <button
            onClick={captureGifFromVideo}
            disabled={loading}
            className="w-full bg-green-500 hover:bg-green-600 text-white py-1 px-4 rounded disabled:opacity-50"
          >
            {loading ? `Processing... ${progress}%` : 'Capture GIF Now'}
          </button>
          
          {error && (
            <div className="text-red-600 text-xs mt-1">{error}</div>
          )}
          
          <p className="text-xs text-gray-500 mt-2">
            Note: GIF creation may take several seconds to process.
          </p>
        </div>
      )}
    </div>
  );
};

export default GifCaptureButton;
