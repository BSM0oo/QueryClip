import React, { useEffect } from 'react';
import { useScreenshots } from './useScreenshots';

const ScreenshotGallery = ({ screenshots = [], onScreenshotEdit }) => {
  // Function to handle screenshot deletion
  const handleDelete = (screenshot) => {
    if (confirm('Are you sure you want to delete this screenshot?')) {
      // Find index in original array
      const index = screenshots.findIndex(s => s.id === screenshot.id);
      // Use onScreenshotEdit to inform parent component about deletion
      if (index !== -1 && onScreenshotEdit) {
        // We'll use onScreenshotEdit with a special 'delete' action
        onScreenshotEdit(index, 'delete');
      }
    }
  };
  // Debug log when screenshots prop changes
  useEffect(() => {
    console.log(`ScreenshotGallery received ${screenshots.length} screenshots from parent`);
  }, [screenshots.length]);
  const {
    screenshots: displayedScreenshots,
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
  } = useScreenshots(screenshots);

  // Render pagination controls
  const renderPagination = () => {
    if (totalPages <= 1) return null;

    return (
      <div className="flex justify-center items-center gap-4 mt-4">
        <button
          onClick={previousPage}
          disabled={currentPage === 1}
          className={`px-4 py-2 rounded ${
            currentPage === 1 
              ? 'bg-gray-300 cursor-not-allowed' 
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          Previous
        </button>
        <span className="text-sm">
          Page {currentPage} of {totalPages}
        </span>
        <button
          onClick={nextPage}
          disabled={currentPage === totalPages}
          className={`px-4 py-2 rounded ${
            currentPage === totalPages
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          Next
        </button>
      </div>
    );
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-gray-600">
          {screenshots.length} screenshot{screenshots.length !== 1 ? 's' : ''}
        </div>
        <div className="flex space-x-2">
          <button 
            onClick={toggleSortBy} 
            className="flex items-center px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm"
            title="Toggle between sorting by video timestamp or capture time"
          >
            By: {sortBy === 'videoTime' ? 'Video Time' : 'Capture Time'}
            <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </button>
          <button 
            onClick={toggleSortOrder} 
            className="flex items-center px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm"
            title="Toggle between newest first and oldest first"
          >
            Order: {sortNewestFirst ? 'Newest First' : 'Oldest First'}
            <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {sortNewestFirst ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
              )}
            </svg>
          </button>
        </div>
      </div>
      {displayedScreenshots.length === 0 && !isLoading && (
        <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-200 mb-4">
          <p className="text-gray-600">No screenshots yet. Capture some screenshots to see them here.</p>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayedScreenshots.map((screenshot, index) => (
          <div key={index} className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="relative aspect-video">
              <img
                src={screenshot.image}
                alt={`Screenshot ${index + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute bottom-0 right-0 bg-black bg-opacity-50 text-white px-2 py-1 text-sm">
                {formatTime(screenshot.timestamp)}
              </div>
            </div>
            <div className="p-4">
              {screenshot.caption && (
                <div className="prose max-w-none">
                  {screenshot.caption.split('\n').map((line, i) => (
                    <p key={i} className="mb-2">{line}</p>
                  ))}
                </div>
              )}
              {screenshot.notes && (
                <div className="mt-2 text-sm text-gray-600">{screenshot.notes}</div>
              )}
              <div className="flex justify-between mt-2">
                {onScreenshotEdit && (
                  <button
                    onClick={() => onScreenshotEdit(index)}
                    className="text-blue-500 hover:text-blue-600"
                  >
                    Edit
                  </button>
                )}
                <button
                  onClick={() => handleDelete(screenshot)}
                  className="text-red-500 hover:text-red-600"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {isLoading && (
        <div className="flex justify-center items-center mt-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      )}
      {renderPagination()}
    </div>
  );
};

const formatTime = (seconds) => {
  const date = new Date(seconds * 1000);
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const secs = date.getUTCSeconds();
  
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
};

export default ScreenshotGallery;