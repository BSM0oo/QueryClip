import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle, Clock, Loader2, ListPlus } from 'lucide-react';

// Helper function to parse timestamp from various formats (2:30, 2:30.5, 150, etc.)
const parseTimestamp = (timestampStr) => {
  // Handle empty input
  if (!timestampStr || typeof timestampStr !== 'string') return NaN;
  
  // Simple number (seconds)
  if (/^\d+(\.\d+)?$/.test(timestampStr)) {
    return parseFloat(timestampStr);
  }
  
  // Format: MM:SS or MM:SS.ms
  const mmssPattern = /^(\d+):(\d+)(?:\.(\d+))?$/;
  const mmssMatch = timestampStr.match(mmssPattern);
  
  if (mmssMatch) {
    const minutes = parseInt(mmssMatch[1], 10);
    const seconds = parseInt(mmssMatch[2], 10);
    const milliseconds = mmssMatch[3] ? parseFloat(`0.${mmssMatch[3]}`) : 0;
    
    return minutes * 60 + seconds + milliseconds;
  }
  
  // Format: HH:MM:SS or HH:MM:SS.ms
  const hhmmssPattern = /^(\d+):(\d+):(\d+)(?:\.(\d+))?$/;
  const hhmmssMatch = timestampStr.match(hhmmssPattern);
  
  if (hhmmssMatch) {
    const hours = parseInt(hhmmssMatch[1], 10);
    const minutes = parseInt(hhmmssMatch[2], 10);
    const seconds = parseInt(hhmmssMatch[3], 10);
    const milliseconds = hhmmssMatch[4] ? parseFloat(`0.${hhmmssMatch[4]}`) : 0;
    
    return hours * 3600 + minutes * 60 + seconds + milliseconds;
  }
  
  return NaN; // Invalid format
};

// New component for timestamp input
const TimestampInput = ({ onAddTimestamps, disabled }) => {
  const [timestampInput, setTimestampInput] = useState('');
  
  const handleAddTimestamps = () => {
    if (!timestampInput.trim()) return;
    
    // Parse comma-separated input
    const timestamps = timestampInput
      .split(',')
      .map(t => t.trim())
      .filter(t => t)
      .map(parseTimestamp)
      .filter(t => !isNaN(t) && t >= 0);
    
    if (timestamps.length > 0) {
      onAddTimestamps(timestamps);
      setTimestampInput('');
    }
  };
  
  return (
    <div className="flex gap-1 items-center">
      <input 
        type="text" 
        value={timestampInput} 
        onChange={e => setTimestampInput(e.target.value)}
        placeholder="1:24, 5:30, 10:15"
        className="flex-1 px-2 py-1 border border-gray-300 rounded-md text-xs"
        disabled={disabled}
      />
      <Button
        onClick={handleAddTimestamps}
        className="bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center h-7 px-2 min-w-0 text-xs"
        disabled={disabled || !timestampInput.trim()}
      >
        <ListPlus className="h-3 w-3" />
        Add
      </Button>
    </div>
  );
};

const MarkModeControls = ({
  markedTimestamps,
  onMark,
  onCapture,
  onClear,
  onAddTimestamps,
  processWithCaptions,
  processingScreenshot,
  disabled,
  remainingMarks
}) => {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-1">
        {/* Mark current timestamp button */}
        <Button
          onClick={onMark}
          className="h-7 bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center gap-1 px-2 text-xs"
          disabled={processingScreenshot || disabled}
        >
          <Clock className="h-3 w-3" />
          <span className="whitespace-nowrap">Mark {processWithCaptions ? '(+caption)' : '(no caption)'}</span>
        </Button>
        
        {/* Batch capture button */}
        <Button
          onClick={onCapture}
          className="h-7 bg-green-500 hover:bg-green-600 text-white flex items-center justify-center gap-1 px-2 text-xs"
          disabled={processingScreenshot || disabled || markedTimestamps.length === 0}
        >
          {processingScreenshot ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Processing...</span>
            </>
          ) : (
            <>
              <span>Capture {markedTimestamps.length}</span>
            </>
          )}
        </Button>
      </div>
      
      {/* Add new timestamp input component */}
      <TimestampInput 
        onAddTimestamps={onAddTimestamps}
        disabled={processingScreenshot || disabled}
      />

      {markedTimestamps.length > 0 && (
        <div className="space-y-2 border border-gray-300 rounded-md p-2 bg-gray-50">
          <div className="flex justify-between items-center">
            <div className="text-xs font-medium">
              <span className="text-emerald-600 flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                {markedTimestamps.length} timestamp{markedTimestamps.length !== 1 ? 's' : ''} queued
              </span>
            </div>
            {processingScreenshot && remainingMarks > 0 && (
              <div className="text-xs font-medium text-amber-600 flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                {remainingMarks} remaining
              </div>
            )}
          </div>
          
          {/* Show marked timestamps list with accurate times */}
          <div className="max-h-24 overflow-y-auto text-xs bg-white rounded border border-gray-200 p-1">
            {markedTimestamps.map((mark, index) => (
              <div key={index} className="flex justify-between py-0.5 border-b border-gray-100 last:border-0 text-xs">
                <span>#{index + 1}: {formatTimeForDisplay(mark.timestamp)}</span>
                <span className={mark.withCaption ? 'text-blue-600' : 'text-gray-500'}>
                  {mark.withCaption ? 'Caption' : 'No caption'}
                </span>
              </div>
            ))}
          </div>

          <div className="flex gap-1">
            <Button
              onClick={onClear}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white h-6 text-xs"
              disabled={processingScreenshot}
            >
              Clear
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper function to format time in a more readable format
const formatTimeForDisplay = (seconds) => {
  if (isNaN(seconds)) return '00:00';
  
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
};

export default MarkModeControls;