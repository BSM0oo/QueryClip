import { useState, useEffect, useRef } from 'react';
import { saveState, loadState } from '../utils/apiUtils';

const MAX_SCREENSHOTS = 50;
const SAVE_DEBOUNCE_MS = 2000; // Debounce server saves to avoid too many calls

const usePersistedState = (key, initialValue) => {
  // State to store our value
  // Pass initial state function to useState so logic is only executed once
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = localStorage.getItem(key);
      // Parse stored json or if none return initialValue
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // Use a ref to track if we've loaded from the server
  const hasLoadedFromServer = useRef(false);
  // Use a ref for debouncing server saves
  const saveServerTimeoutRef = useRef(null);

  // Load data from server on init
  useEffect(() => {
    // Only load from server for screenshots
    if (key === 'yt-notes-screenshots' && !hasLoadedFromServer.current) {
      const loadFromServer = async () => {
        try {
          console.log('Loading screenshots from server...');
          const response = await loadState();
          if (response.state && response.state.screenshots && response.state.screenshots.length > 0) {
            console.log(`Loaded ${response.state.screenshots.length} screenshots from server`);
            setStoredValue(response.state.screenshots);
            // Also update localStorage
            localStorage.setItem(key, JSON.stringify(response.state.screenshots));
            hasLoadedFromServer.current = true;
          } else {
            console.log('No screenshots found on server');
            hasLoadedFromServer.current = true;
          }
        } catch (error) {
          console.error('Failed to load state from server:', error);
          hasLoadedFromServer.current = true; // Mark as loaded even on error to avoid retrying indefinitely
        }
      };
      
      loadFromServer();
    }
  }, [key]);

  // Return a wrapped version of useState's setter function that 
  // persists the new value to localStorage and server
  const setValue = value => {
    try {
      // Allow value to be a function so we have same API as useState
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      
      // For screenshots, enforce limit
      let finalValue = valueToStore;
      if (key === 'yt-notes-screenshots' && Array.isArray(valueToStore) && valueToStore.length > MAX_SCREENSHOTS) {
        console.warn(`Screenshots exceed limit of ${MAX_SCREENSHOTS}, trimming to most recent`);
        finalValue = valueToStore.slice(-MAX_SCREENSHOTS);
      }
      
      // Save state
      setStoredValue(finalValue);
      
      // Save to localStorage, but first handle potential serialization of large image data
      let serializedValue;
      try {
        serializedValue = JSON.stringify(finalValue);
        localStorage.setItem(key, serializedValue);
      } catch (serializeError) {
        console.error(`Error serializing state for localStorage (${key}):`, serializeError);
        
        // If this is screenshots data, try to reduce image data size
        if (key === 'yt-notes-screenshots' && Array.isArray(finalValue)) {
          console.warn('Image data may be too large for localStorage, saving to server only.');
          // Don't try to save to localStorage, just rely on server
        } else {
          // For other data types, rethrow
          throw serializeError;
        }
      }
      
      // For screenshots or chapters, also save to server
      if ((key === 'yt-notes-screenshots' && Array.isArray(finalValue)) || 
          (key === 'yt-notes-chapters' && Array.isArray(finalValue))) {
        
        // Debounce server saves
        if (saveServerTimeoutRef.current) {
          clearTimeout(saveServerTimeoutRef.current);
        }
        
        saveServerTimeoutRef.current = setTimeout(async () => {
          try {
            // Get videoId from localStorage
            const videoId = localStorage.getItem('yt-notes-videoId');
            const parsedVideoId = videoId ? JSON.parse(videoId) : null;
            
            // Get screenshots and chapters from localStorage or use passed value
            let parsedScreenshots = [];
            let parsedChapters = [];
            
            if (key === 'yt-notes-screenshots') {
              parsedScreenshots = finalValue;
              
              // Get chapters
              const chapters = localStorage.getItem('yt-notes-chapters');
              parsedChapters = chapters ? JSON.parse(chapters) : [];
            } else {
              // We're updating chapters
              parsedChapters = finalValue;
              
              // Get screenshots
              try {
                const screenshots = localStorage.getItem('yt-notes-screenshots');
                parsedScreenshots = screenshots ? JSON.parse(screenshots) : [];
              } catch (e) {
                console.error('Error parsing screenshots from localStorage:', e);
                // In case this fails, use what's in state
                parsedScreenshots = storedValue;
              }
            }
            
            console.log(`Saving state to server with ${parsedScreenshots.length} screenshots and ${parsedChapters.length} chapters`);
            
            // Save state to server
            await saveState({
              screenshots: parsedScreenshots,
              chapters: parsedChapters,
              videoId: parsedVideoId,
              timestamp: Date.now()
            });
            console.log('State saved to server successfully');
          } catch (error) {
            console.error('Failed to save state to server:', error);
          }
        }, SAVE_DEBOUNCE_MS);
      }
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  };

  // Subscribe to changes in value across tabs/windows
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === key && e.newValue !== null) {
        try {
          setStoredValue(JSON.parse(e.newValue));
        } catch (error) {
          console.error(`Error parsing storage change for key "${key}":`, error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key]);

  return [storedValue, setValue];
};

export default usePersistedState;