import React from 'react';

const ScreenshotModeSelector = ({
  screenshotMode,
  setScreenshotMode,
  processWithCaptions,
  setProcessWithCaptions,
  onModeChange,
  isCleaningUp,
  onCleanup,
  contextWindowSize = 30,
  setContextWindowSize
}) => {
  const handleModeChange = (mode) => {
    setScreenshotMode(mode);
    if (onModeChange) {
      onModeChange(mode);
    }
  };

  return (
    <div className="flex flex-col justify-between items-start gap-1 mb-2">
      <div className="flex flex-col items-start gap-1 w-full">
        <div className="flex gap-2 w-full text-xs justify-between">
          <label className="flex items-center">
            <input
              type="radio"
              checked={screenshotMode === 'single'}
              onChange={() => handleModeChange('single')}
              className="mr-1 h-3 w-3"
            />
            Single
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              checked={screenshotMode === 'burst'}
              onChange={() => handleModeChange('burst')}
              className="mr-1 h-3 w-3"
            />
            Burst
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              checked={screenshotMode === 'gif'}
              onChange={() => handleModeChange('gif')}
              className="mr-1 h-3 w-3"
            />
            GIF
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              checked={screenshotMode === 'mark'}
              onChange={() => handleModeChange('mark')}
              className="mr-1 h-3 w-3"
            />
            Mark
          </label>
        </div>
        
        <div className="flex items-center justify-between w-full text-xs mt-1 pt-1 border-t border-gray-100">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={processWithCaptions}
              onChange={(e) => setProcessWithCaptions(e.target.checked)}
              className="mr-1 h-3 w-3 rounded text-blue-600 border-gray-300"
            />
            Captions
          </label>
          
          {processWithCaptions && (
            <div className="flex items-center">
              <label className="text-xs text-gray-700 mr-1">Context:</label>
              <div className="flex items-center gap-1">
                <input 
                  type="range" 
                  min="5" 
                  max="60" 
                  step="5"
                  value={contextWindowSize} 
                  onChange={(e) => setContextWindowSize(parseInt(e.target.value, 10))}
                  className="w-16 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-xs font-mono">{contextWindowSize}s</span>
              </div>
            </div>
          )}
          
          <button
            onClick={onCleanup}
            className="bg-gray-500 text-white text-xs px-2 py-0.5 rounded hover:bg-gray-600 disabled:opacity-50"
            disabled={isCleaningUp}
          >
            {isCleaningUp ? '...' : 'Clear'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScreenshotModeSelector;