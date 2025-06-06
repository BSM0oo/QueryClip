import React, { useEffect, useRef, useState } from 'react';

const YouTubePlayer = ({ 
  videoId, 
  onReady = () => {}, 
  onError = () => {}, 
  onStateChange = () => {},
  onTimeUpdate = () => {},
  className = 'w-full aspect-video' 
}) => {
  const playerRef = useRef(null);
  const playerInstanceRef = useRef(null);
  const [isAPIReady, setIsAPIReady] = useState(false);
  const [playerError, setPlayerError] = useState(null);
  const timeUpdateIntervalRef = useRef(null);
  const wasPlayingBeforeHiddenRef = useRef(false);
  const currentVideoIdRef = useRef(videoId);
  const createTimeoutRef = useRef(null);

  console.log("Initializing YouTube player component");

  // Load the YouTube IFrame API once
  useEffect(() => {
    console.log("Initializing YouTube player component");
    
    // Check if the API is already loaded
    if (window.YT && window.YT.Player) {
      console.log("YouTube API already loaded");
      setIsAPIReady(true);
      return;
    }

    // Load the YouTube API if not present
    console.log("Loading YouTube API...");
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';

    // Create a callback for the API to call once ready
    window.onYouTubeIframeAPIReady = () => {
      console.log("YouTube API is ready");
      setIsAPIReady(true);
    };

    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

    // Cleanup
    return () => {
      window.onYouTubeIframeAPIReady = null;
    };
  }, []); // Empty dependency array - only run once

  // Handle visibility change to support background playback and PiP
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!playerInstanceRef.current) return;
      
      try {
        if (document.visibilityState === 'hidden') {
          // Store current playing state before going to background
          const playerState = playerInstanceRef.current.getPlayerState();
          wasPlayingBeforeHiddenRef.current = playerState === 1; // 1 = playing
          
          if (wasPlayingBeforeHiddenRef.current) {
            // If we're on a mobile device, try to activate PiP
            if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
              // Request Picture-in-Picture if supported
              if (document.pictureInPictureEnabled || 'pictureInPictureEnabled' in document) {
                const iframe = playerRef.current.querySelector('iframe');
                if (iframe && iframe.requestPictureInPicture) {
                  iframe.requestPictureInPicture().catch(err => {
                    console.log('PiP request failed:', err);
                    // Continue playing even if PiP fails
                  });
                }
              }
            }
          }
        } else if (document.visibilityState === 'visible' && wasPlayingBeforeHiddenRef.current) {
          // Resume playback if we were playing before going to background
          // and we're now back and not in PiP mode
          if (!document.pictureInPictureElement) {
            playerInstanceRef.current.playVideo();
          }
        }
      } catch (e) {
        console.error('Error handling visibility change:', e);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Handle player initialization and video loading
  useEffect(() => {
    // Update the current video ID ref to track changes
    currentVideoIdRef.current = videoId;
    
    if (!isAPIReady || !videoId || !playerRef.current) {
      console.log("Not ready to create player:", { isAPIReady, videoId: !!videoId, playerRef: !!playerRef.current });
      return;
    }

    console.log(`Creating/updating player for video ID: ${videoId}`);
    
    // Clear any previous errors
    setPlayerError(null);
    
    // Clean up any previous pending operations
    if (createTimeoutRef.current) {
      clearTimeout(createTimeoutRef.current);
      createTimeoutRef.current = null;
    }
    
    // Clean up any existing time update interval
    if (timeUpdateIntervalRef.current) {
      clearInterval(timeUpdateIntervalRef.current);
      timeUpdateIntervalRef.current = null;
    }
    
    // Define the player creation/update function
    const createOrUpdatePlayer = () => {
      try {
        // Verify that the video ID hasn't changed since we scheduled this operation
        if (currentVideoIdRef.current !== videoId) {
          console.log("Video ID changed during player initialization, aborting");
          return;
        }
        
        // Always fully destroy and recreate the player when switching videos
        // This is more reliable than trying to update an existing player
        if (playerInstanceRef.current) {
          try {
            playerInstanceRef.current.destroy();
          } catch (e) {
            console.warn("Error destroying YouTube player:", e);
          }
          playerInstanceRef.current = null;
        }
        
        // Create a new player instance
        playerInstanceRef.current = new window.YT.Player(playerRef.current, {
          videoId,
          playerVars: {
            autoplay: 0,
            controls: 1,
            enablejsapi: 1,
            modestbranding: 1,
            rel: 0,               // Don't show related videos
            fs: 1,                // Allow fullscreen
            origin: window.location.origin,
            host: window.location.origin,    // Add host parameter to help with cross-origin issues
            showinfo: 0,          // Hide video title and uploader info
            iv_load_policy: 3,    // Hide video annotations
            disablekb: 0,         // Enable keyboard controls
            autohide: 1,          // Hide video controls when playing
            cc_load_policy: 0,    // Hide closed captions by default
            playsinline: 1,       // Play inline on iOS
            picture_in_picture: 1, // Enable Picture-in-Picture mode
            endscreen: 0          // Disable end screen (annotation panels)
          },
          events: {
            onReady: (event) => {
              onReady(event.target);
            },
            onStateChange: (event) => {
              onStateChange(event);
              
              // Implement time updating for progress tracking
              if (event.data === window.YT.PlayerState.PLAYING) {
                // Clear any existing interval first
                if (timeUpdateIntervalRef.current) {
                  clearInterval(timeUpdateIntervalRef.current);
                }
                
                // Set new interval for time updates
                timeUpdateIntervalRef.current = setInterval(() => {
                  if (playerInstanceRef.current && typeof playerInstanceRef.current.getCurrentTime === 'function') {
                    try {
                      const currentTime = playerInstanceRef.current.getCurrentTime();
                      onTimeUpdate(currentTime);
                    } catch (e) {
                      console.error("Error getting current time:", e);
                    }
                  }
                }, 1000);
              } else if (timeUpdateIntervalRef.current) {
                clearInterval(timeUpdateIntervalRef.current);
              }
            },
            onError: (event) => {
              const errorCodes = {
                2: "Invalid video ID",
                5: "HTML5 player error",
                100: "Video not found",
                101: "Video owner doesn't allow embedding",
                150: "Video owner doesn't allow embedding"
              };
              const errorMessage = errorCodes[event.data] || `YouTube player error (${event.data})`;
              setPlayerError(errorMessage);
              onError(errorMessage);
            }
          }
        });
      } catch (e) {
        console.error("Error creating YouTube player:", e);
        setPlayerError("Failed to initialize YouTube player: " + e.message);
      }
    };
    
    // Schedule player creation with a slight delay to avoid conflicts
    // Store the timeout ID so we can clear it if needed
    createTimeoutRef.current = setTimeout(createOrUpdatePlayer, 150);
    
    // Cleanup function
    return () => {
      if (createTimeoutRef.current) {
        clearTimeout(createTimeoutRef.current);
        createTimeoutRef.current = null;
      }
      
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
        timeUpdateIntervalRef.current = null;
      }
    };
  }, [videoId, isAPIReady]); // Only recreate if videoId or isAPIReady changes

  // Final cleanup when component unmounts
  useEffect(() => {
    return () => {
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
      }
      
      if (createTimeoutRef.current) {
        clearTimeout(createTimeoutRef.current);
      }
      
      if (playerInstanceRef.current) {
        try {
          playerInstanceRef.current.destroy();
          playerInstanceRef.current = null;
        } catch (e) {
          console.warn("Error destroying YouTube player:", e);
        }
      }
    };
  }, []); // Empty dependency - only when unmounting

  // Add this additional check for videoId
  if (!videoId) {
    return (
      <div className={`bg-gray-200 flex items-center justify-center ${className}`}>
        <p className="text-gray-600">Please enter a YouTube video ID</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {playerError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 w-full">
          Error loading video: {playerError}
        </div>
      )}
      <div className={className}>
        <div ref={playerRef} className="w-full h-full" />
      </div>
    </div>
  );
};

export default YouTubePlayer;