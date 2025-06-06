import { useState, useEffect } from 'react';

const useVideoPlayer = (initialVideoId = '') => {
  const [player, setPlayer] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [loading, setLoading] = useState(false);

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

  const handlePlayerReady = (ytPlayer) => {
    setPlayer(ytPlayer);
  };

  const seekTo = (time) => {
    if (player) {
      player.seekTo(time, true);
    }
  };

  const loadVideo = (videoId) => {
    if (player) {
      player.loadVideoById(videoId);
    }
  };

  return {
    player,
    currentTime,
    loading,
    setLoading,
    handlePlayerReady,
    seekTo,
    loadVideo
  };
};

export default useVideoPlayer;