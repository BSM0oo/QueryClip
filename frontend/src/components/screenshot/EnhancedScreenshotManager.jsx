import React, { useState, useEffect, useRef } from 'react';
import GifCaptureManager from '../GifCaptureManager';
import ScreenshotGallery from './ScreenshotGallery';
import ScreenshotModeSelector from './ScreenshotModeSelector';
import BurstModeControls from './BurstModeControls';
import MarkModeControls from './MarkModeControls';
import CaptureControls from './CaptureControls';
import LabelControls from './LabelControls';
import { captureScreenshot, extractVideoId } from './screenshotService';
import { formatTime } from '../../utils/exportUtils';

const EnhancedScreenshotManager = ({ 
  videoId, 
  player, 
  transcript,
  onScreenshotsTaken,
  customPrompt,
  onScreenshotEdit
}) => {
  const [screenshotMode, setScreenshotMode] = useState('single');
  const [burstCount, setBurstCount] = useState(3);
  const [burstInterval, setBurstInterval] = useState(2);
  const [isCapturing, setIsCapturing] = useState(false);
  const [processingScreenshot, setProcessingScreenshot] = useState(false);
  const [error, setError] = useState('');
  const [screenshots, setScreenshots] = useState([]);
  // Use ref to track if component is mounted to prevent state updates after unmount
  const isMounted = useRef(true);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [processWithCaptions, setProcessWithCaptions] = useState(true);
  const [markedTimestamps, setMarkedTimestamps] = useState([]);
  const [remainingMarks, setRemainingMarks] = useState(0);
  const [disablePauseOnCapture, setDisablePauseOnCapture] = useState(false);
  
  // Context window size for transcript context
  const [contextWindowSize, setContextWindowSize] = useState(30); // Default: 30 seconds

  // Label controls state
  const [enableLabel, setEnableLabel] = useState(false);
  const [labelText, setLabelText] = useState('');
  const [fontSize, setFontSize] = useState(48); // Default font size
  const [textColor, setTextColor] = useState('white'); // Default text color

  useEffect(() => {
    // Set mounted flag
    isMounted.current = true;
    
    return () => {
      // Clear mounted flag when component unmounts
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        if (isMounted.current) {
          setError('');
        }
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // No longer using initialScreenshots since it's not provided as a prop
  // Instead, we'll ensure screenshots state is properly managed internally

  const handleSingleScreenshot = async () => {
    if (!player) return;
    
    try {
      setProcessingScreenshot(true);
      setError(''); // Clear any previous errors
      
      // Get current time before pausing so we don't shift position
      const currentTimestamp = player.getCurrentTime();
      
      // Only pause the video if disablePauseOnCapture is false
      if (!disablePauseOnCapture) {
        player.pauseVideo();
      }
      
      console.log(`Attempting to capture screenshot at ${formatTime(currentTimestamp)}`);
      
      // Use a timeout to prevent indefinite hanging
      const screenshotPromise = captureScreenshot({
        player,
        videoId,
        timestamp: currentTimestamp, // Use stored timestamp instead of current position
        generateCaption: processWithCaptions,
        transcript,
        customPrompt,
        onPlayVideo: () => {
          // Only need to resume if we paused it
          if (!disablePauseOnCapture) {
            player.playVideo();
          }
        },
        label: enableLabel ? {
          text: labelText,
          fontSize: fontSize,
          color: textColor
        } : null,
        contextWindowSize: contextWindowSize // Pass the configurable context window size
      });
      
      // Set a timeout for the screenshot capture
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Screenshot capture timed out after 45 seconds. Please try again.'));
        }, 45000); // 45 second timeout
      });
      
      // Race the screenshot capture against the timeout
      const screenshot = await Promise.race([screenshotPromise, timeoutPromise]);
      
      console.log('Screenshot captured successfully:', screenshot.id);
      const newScreenshots = [screenshot];
      setScreenshots(prev => [...prev, ...newScreenshots]);
      onScreenshotsTaken(newScreenshots);
    } catch (error) {
      console.error('Screenshot capture failed:', error);
      // Format the error message for better user feedback
      let errorMessage = 'Failed to capture screenshot';
      
      if (error.message && error.message.includes('network')) {
        errorMessage += ': Network error. Please check your internet connection and try again.';
      } else if (error.message && error.message.includes('timeout')) {
        errorMessage += ': The request timed out. Please try again later.';
      } else if (error.message) {
        errorMessage += ': ' + error.message;
      }
      
      setError(errorMessage);
      
      // Resume video playback on error if we paused it
      if (!disablePauseOnCapture) {
        player.playVideo();
      }
    } finally {
      setProcessingScreenshot(false);
    }
  };

  const handleBurstScreenshots = async () => {
    if (!player) return;
    
    try {
      setIsCapturing(true);
      setProcessingScreenshot(true);
      setError('');
      
      // Get current time before pausing so we don't shift position
      const startTime = player.getCurrentTime();
      
      // Only pause the video if disablePauseOnCapture is false
      if (!disablePauseOnCapture) {
        player.pauseVideo();
      }
      
      const screenshots = [];
      
      for (let i = 0; i < burstCount; i++) {
        const timestamp = startTime + (i * burstInterval);
        try {
          const screenshot = await captureScreenshot({
            player,
            videoId,
            timestamp,
            generateCaption: processWithCaptions,
            transcript,
            customPrompt,
            label: enableLabel ? {
              text: labelText,
              fontSize: fontSize
            } : null,
            contextWindowSize: contextWindowSize // Pass the configurable context window size
          });
          screenshots.push(screenshot);
        } catch (error) {
          console.error(`Failed to capture burst screenshot ${i}:`, error);
        }
      }
      
      if (screenshots.length > 0) {
        setScreenshots(prev => [...prev, ...screenshots]);
        onScreenshotsTaken(screenshots);
      }
      
    } catch (error) {
      setError('Failed to capture burst screenshots: ' + error.message);
    } finally {
      setProcessingScreenshot(false);
      setIsCapturing(false);
      
      // Only resume if we paused it
      if (!disablePauseOnCapture && player) {
        player.playVideo();
      }
    }
  };

  const handleMarkForScreenshot = () => {
    if (!player) return;
    // Store the current time to avoid any issues with changing position later
    const currentTime = player.getCurrentTime();
    
    // Only add to queue, don't process immediately
    console.log(`Marking timestamp ${formatTime(currentTime)} for later processing`);
    
    // Use a callback to ensure we get the latest state
    setMarkedTimestamps(prev => {
      const newMarks = [
        ...prev,
        { timestamp: currentTime, withCaption: processWithCaptions }
      ];
      
      // Update the remaining marks count based on the new value
      setRemainingMarks(newMarks.length);
      
      return newMarks;
    });
  };
  
  const handleAddTimestamps = (timestamps) => {
    if (!timestamps?.length) return;
    
    // Convert array of timestamp numbers into objects with withCaption property
    const newTimestamps = timestamps.map(timestamp => ({
      timestamp,
      withCaption: processWithCaptions
    }));
    
    console.log(`Adding ${newTimestamps.length} timestamps from input`);
    
    // Update marked timestamps and remaining count
    setMarkedTimestamps(prev => {
      const updatedMarks = [...prev, ...newTimestamps];
      setRemainingMarks(updatedMarks.length);
      return updatedMarks;
    });
  };

  const handleCaptureMarked = async () => {
    if (!player || markedTimestamps.length === 0) return;
    
    try {
      setProcessingScreenshot(true);
      setError('');
      
      // Only pause if not disabled
      if (!disablePauseOnCapture) {
        player.pauseVideo();
      }
      
      const processedScreenshots = [];
      let captionErrors = false;
      
      // Set the initial count of remaining screenshots to process
      const totalMarks = markedTimestamps.length;
      setRemainingMarks(totalMarks);
      console.log(`Processing ${totalMarks} marked screenshots`);

      // Process marks one at a time, updating UI after each
      for (let i = 0; i < markedTimestamps.length; i++) {
        const mark = markedTimestamps[i];
        const currentNumber = i + 1;
        
        try {
          // Update UI to show which screenshot is being processed
          console.log(`Processing screenshot ${currentNumber} of ${totalMarks} at ${formatTime(mark.timestamp)}`);
          
          // Wait longer before starting next capture (1 second instead of 0.5)
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Ensure player is at correct time
          player.seekTo(mark.timestamp, true);
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Process one screenshot completely before moving to the next
          const screenshot = await captureScreenshot({
            player,
            videoId,
            timestamp: mark.timestamp,
            generateCaption: mark.withCaption,
            transcript,
            customPrompt,
            label: enableLabel ? {
              text: labelText,
              fontSize: fontSize,
              color: textColor
            } : null,
            contextWindowSize: contextWindowSize
          });

          // Add to our local collection of processed screenshots
          processedScreenshots.push(screenshot);
          
          // Update UI with this screenshot
          setScreenshots(prev => [...prev, screenshot]);
          
          // Wait for the screenshot to be fully processed
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Update the remaining count
          setRemainingMarks(totalMarks - currentNumber);

          if (screenshot.captionError) {
            captionErrors = true;
          }

          // Wait more time before starting the next capture
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          console.error(`Failed to capture marked screenshot ${currentNumber} of ${totalMarks}:`, error);
          setError(`Failed to capture screenshot ${currentNumber}: ${error.message}`);
          setRemainingMarks(totalMarks - currentNumber);
          // Wait before continuing after error
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // Clear marks after all processing is done
      if (processedScreenshots.length > 0) {
        setMarkedTimestamps([]); // Clear marks after all captures
        
        // Send all processed screenshots to parent as a batch now that we're done
        onScreenshotsTaken(processedScreenshots);
        console.log(`Batch finished: ${processedScreenshots.length} of ${totalMarks} screenshots processed successfully`);

        if (captionErrors) {
          setError('Some captions failed to generate. You can regenerate them individually.');
        }
      }
      
    } catch (error) {
      console.error('Failed to capture marked screenshots:', error);
      setError('Failed to capture marked screenshots: ' + error.message);
    } finally {
      setProcessingScreenshot(false);
      
      // Only resume if we paused it and player still exists
      if (!disablePauseOnCapture && player) {
        try {
          player.playVideo();
        } catch (e) {
          console.error('Error resuming video:', e);
        }
      }
    }
  };

  const handleCleanup = () => {
    setIsCleaningUp(true);
    try {
      if (player) {
        player.playVideo();
      }
      setError('');
      setMarkedTimestamps([]);
      setProcessingScreenshot(false);
      setIsCapturing(false);
    } finally {
      setIsCleaningUp(false);
    }
  };

  const handleModeChange = (mode) => {
    setScreenshotMode(mode);
    if (mode === 'mark') {
      setMarkedTimestamps([]);
    }
  };

  const handleGifCaptured = (gifData, timestamp) => {
    onScreenshotsTaken([{
      image: gifData,
      timestamp,
      caption: 'Animated GIF capture',
      content_type: 'gif',
      notes: '',
      transcriptContext: ''
    }]);
  };

  return (
    <>
      <div className="bg-white rounded-lg p-2 sm:p-3 border overflow-hidden text-sm">
        <div className="flex items-center mb-2 pb-1 border-b border-gray-200">
          <input
            type="checkbox"
            id="pause-toggle"
            checked={disablePauseOnCapture}
            onChange={() => setDisablePauseOnCapture(!disablePauseOnCapture)}
            className="mr-2 h-3 w-3"
          />
          <label htmlFor="pause-toggle" className="text-xs text-gray-600">
            Don't pause video when capturing
          </label>
        </div>
        
        <ScreenshotModeSelector 
          screenshotMode={screenshotMode}
          setScreenshotMode={setScreenshotMode}
          processWithCaptions={processWithCaptions}
          setProcessWithCaptions={setProcessWithCaptions}
          onModeChange={handleModeChange}
          isCleaningUp={isCleaningUp}
          onCleanup={handleCleanup}
          contextWindowSize={contextWindowSize}
          setContextWindowSize={setContextWindowSize}
        />

        <div className="mt-2 mb-2 space-y-2">
          <LabelControls
            enableLabel={enableLabel}
            setEnableLabel={setEnableLabel}
            labelText={labelText}
            setLabelText={setLabelText}
            fontSize={fontSize}
            setFontSize={setFontSize}
            textColor={textColor}
            setTextColor={setTextColor}
            renderCaptureButton={() => (
              <CaptureControls 
                mode={screenshotMode}
                onCapture={screenshotMode === 'single' ? handleSingleScreenshot : handleBurstScreenshots}
                disabled={!player || isCapturing}
                processing={processingScreenshot}
                burstCount={burstCount}
              />
            )}
          />
        </div>

        {screenshotMode === 'burst' && (
          <BurstModeControls 
            burstCount={burstCount}
            setBurstCount={setBurstCount}
            burstInterval={burstInterval}
            setBurstInterval={setBurstInterval}
          />
        )}

        {screenshotMode === 'mark' && (
          <MarkModeControls 
            markedTimestamps={markedTimestamps}
            onMark={handleMarkForScreenshot}
            onCapture={handleCaptureMarked}
            onClear={() => {
              setMarkedTimestamps([]);
              setRemainingMarks(0);
            }}
            onAddTimestamps={handleAddTimestamps}
            processWithCaptions={processWithCaptions}
            processingScreenshot={processingScreenshot}
            disabled={!player}
            remainingMarks={remainingMarks}
          />
        )}
      </div>

      {screenshotMode === 'gif' && (
        <div className="mt-4">
          <GifCaptureManager
            videoId={extractVideoId(videoId)}
            currentTime={player ? player.getCurrentTime() : 0}
            onGifCaptured={handleGifCaptured}
          />
        </div>
      )}

      {error && (
        <div className="mt-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
    </>
  );
};

export default EnhancedScreenshotManager;