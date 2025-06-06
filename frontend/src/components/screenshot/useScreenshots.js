import { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from '../../config';

const SCREENSHOTS_PER_PAGE = 12;
const MAX_SCREENSHOTS = 100; // Increase from 50 to avoid losing screenshots

export const useScreenshots = (inputScreenshots = []) => {
  const [screenshots, setScreenshots] = useState(inputScreenshots);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [sortNewestFirst, setSortNewestFirst] = useState(true); // Default to newest first
  const [sortBy, setSortBy] = useState('videoTime'); // Default sort by video timestamp - options: 'videoTime', 'captureTime'
  const prevInputLength = useRef(inputScreenshots.length);
  
  // Debug log for screenshot updates
  useEffect(() => {
    console.log(`useScreenshots: Managing ${screenshots.length} screenshots, page ${currentPage}/${totalPages}`);
  }, [screenshots.length, currentPage]);

  // Calculate total pages
  const totalPages = Math.ceil(screenshots.length / SCREENSHOTS_PER_PAGE);

  // Get current page screenshots with proper sorting
  const getCurrentPageScreenshots = () => {
    // Create a sorted copy based on the sort preference
    const sorted = [...screenshots].sort((a, b) => {
      let aValue, bValue;
      
      // Determine which field to sort by
      if (sortBy === 'videoTime') {
        // Sort by video timestamp
        aValue = a.timestamp;
        bValue = b.timestamp;
      } else if (sortBy === 'captureTime') {
        // Sort by capture time (when screenshot was taken)
        // Extract timestamp from ID or use createdAt if available
        aValue = a.createdAt ? new Date(a.createdAt).getTime() : parseInt(a.id.split('-')[0]) || 0;
        bValue = b.createdAt ? new Date(b.createdAt).getTime() : parseInt(b.id.split('-')[0]) || 0;
      }
      
      // Apply sort direction
      if (sortNewestFirst) {
        return bValue - aValue; // Newest first (descending)
      } else {
        return aValue - bValue; // Oldest first (ascending)
      }
    });
    
    const startIndex = (currentPage - 1) * SCREENSHOTS_PER_PAGE;
    const endIndex = startIndex + SCREENSHOTS_PER_PAGE;
    return sorted.slice(startIndex, endIndex);
  };
  
  // Toggle sort order (ascending/descending)
  const toggleSortOrder = () => {
    setSortNewestFirst(prev => !prev);
    setCurrentPage(1); // Reset to first page when changing sort order
  };
  
  // Toggle sort by field
  const toggleSortBy = () => {
    // Cycle through the options: videoTime -> captureTime -> videoTime
    setSortBy(prev => prev === 'videoTime' ? 'captureTime' : 'videoTime');
    setCurrentPage(1); // Reset to first page when changing sort field
  };

  // Add new screenshots - prevent duplicates by checking IDs
  const addScreenshots = (newScreenshots) => {
    if (!newScreenshots || newScreenshots.length === 0) return;
    
    console.log(`Adding ${newScreenshots.length} screenshot(s) to collection`);
    
    setScreenshots(prev => {
      // Create a map of existing screenshots by ID or timestamp+content
      const existingMap = new Map();
      prev.forEach(s => {
        const key = s.id || `${s.timestamp}-${s.content_type}`;
        existingMap.set(key, true);
      });
      
      // Filter out duplicates
      const uniqueNew = newScreenshots.filter(s => {
        const key = s.id || `${s.timestamp}-${s.content_type}`;
        return !existingMap.has(key);
      });
      
      console.log(`${uniqueNew.length} unique new screenshots after filtering duplicates`);
      
      const updated = [...prev, ...uniqueNew];
      // If we have too many screenshots, remove the oldest ones
      if (updated.length > MAX_SCREENSHOTS) {
        return updated.slice(-MAX_SCREENSHOTS);
      }
      return updated;
    });
  };

  // Clean up old screenshots
  const cleanupScreenshots = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/cleanup-screenshots`, {
        method: 'POST'
      });
      if (!response.ok) {
        throw new Error('Failed to cleanup screenshots');
      }
    } catch (error) {
      console.error('Screenshot cleanup failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Navigation functions
  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const previousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

  const goToPage = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  // Sync with input screenshots when they change
  useEffect(() => {
    // Only process if there are new screenshots from the parent
    if (inputScreenshots.length > prevInputLength.current) {
      console.log(`New screenshots detected from parent: ${inputScreenshots.length} (was ${prevInputLength.current})`);
      addScreenshots(inputScreenshots.slice(prevInputLength.current));
    } else if (inputScreenshots.length !== screenshots.length) {
      // Complete reset if sizes don't match but we don't have more screenshots
      console.log(`Resynchronizing screenshots with parent component: ${inputScreenshots.length} vs ${screenshots.length}`);
      setScreenshots(inputScreenshots);
    }
    
    prevInputLength.current = inputScreenshots.length;
  }, [inputScreenshots]);
  
  // Run cleanup periodically
  useEffect(() => {
    const cleanup = async () => {
      await cleanupScreenshots();
    };
    
    // Run cleanup every 5 minutes
    const interval = setInterval(cleanup, 5 * 60 * 1000);
    
    return () => {
      clearInterval(interval);
    };
  }, []);

  return {
    screenshots: getCurrentPageScreenshots(),
    currentPage,
    totalPages,
    isLoading,
    sortNewestFirst,
    sortBy,
    toggleSortOrder,
    toggleSortBy,
    addScreenshots,
    nextPage,
    previousPage,
    goToPage
  };
};