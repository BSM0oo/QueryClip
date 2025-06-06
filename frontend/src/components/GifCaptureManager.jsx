import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

const GifCaptureManager = ({ videoId, currentTime, onGifCaptured }) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [duration, setDuration] = useState(3);
  const [fps, setFps] = useState(10);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const validateInputs = () => {
    if (!videoId) {
      setError("No video loaded. Please load a video first.");
      return false;
    }
    if (duration < 1 || duration > 10) {
      setError("Duration must be between 1 and 10 seconds.");
      return false;
    }
    if (fps < 5 || fps > 30) {
      setError("FPS must be between 5 and 30.");
      return false;
    }
    return true;
  };

  const handleCaptureGif = async () => {
    setError('');
    setStatus('');

    if (!validateInputs()) {
      return;
    }

    try {
      setIsCapturing(true);
      setStatus('Initializing capture...');

      const response = await fetch('/api/capture-gif', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          video_id: videoId,
          start_time: currentTime,
          duration: parseFloat(duration),
          fps: parseInt(fps),
          width: 480,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to capture GIF');
      }

      setStatus('Processing GIF...');
      const data = await response.json();
      
      if (!data.gif_data) {
        throw new Error('No GIF data received');
      }

      onGifCaptured(data.gif_data, currentTime);
      setStatus('GIF captured successfully!');
      
      // Clear success status after 3 seconds
      setTimeout(() => setStatus(''), 3000);

    } catch (error) {
      console.error('Error capturing GIF:', error);
      setError(error.message || "Failed to capture GIF. Please try again.");
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <Card className="w-full">
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex flex-col space-y-2">
            <Label htmlFor="duration">Duration (seconds)</Label>
            <Input
              id="duration"
              type="number"
              min="1"
              max="10"
              value={duration}
              onChange={(e) => {
                setError('');
                setDuration(e.target.value);
              }}
              className="w-full"
              disabled={isCapturing}
            />
            <p className="text-xs text-gray-500">
              Recommended: 2-5 seconds for smooth playback
            </p>
          </div>

          <div className="flex flex-col space-y-2">
            <Label htmlFor="fps">Frames per second</Label>
            <Input
              id="fps"
              type="number"
              min="5"
              max="30"
              value={fps}
              onChange={(e) => {
                setError('');
                setFps(e.target.value);
              }}
              className="w-full"
              disabled={isCapturing}
            />
            <p className="text-xs text-gray-500">
              Higher FPS = smoother playback but larger file size
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded">
              {error}
            </div>
          )}

          {status && !error && (
            <div className="bg-blue-50 border border-blue-200 text-blue-600 px-4 py-2 rounded">
              {status}
            </div>
          )}

          <Button
            onClick={handleCaptureGif}
            disabled={isCapturing}
            className="w-full"
          >
            {isCapturing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Capturing GIF...
              </>
            ) : (
              'Capture GIF'
            )}
          </Button>

          <p className="text-xs text-gray-500 text-center">
            GIF capture may take a few moments depending on duration and FPS.
            For best results, ensure stable internet connection.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default GifCaptureManager;