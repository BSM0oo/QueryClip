import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

const CaptureControls = ({
  mode,
  onCapture,
  disabled,
  processing,
  burstCount
}) => {
  // Determine the button text based on the selected mode
  const getButtonText = () => {
    if (processing) {
      return (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {mode === 'burst' ? 'Capturing Screenshots...' : 'Processing Screenshot...'}
        </>
      );
    }
    
    switch (mode) {
      case 'single':
        return 'Take Screenshot';
      case 'burst':
      case 'gif':
      default:
        return `Take ${burstCount} Screenshots`;
    }
  };

  // If in mark mode, keep the 'Take Screenshot' text but disable the button
  const isMarkMode = mode === 'mark';
  const buttonText = isMarkMode ? 'Take Screenshot' : getButtonText();
  
  return (
    <Button
      onClick={onCapture}
      className={`min-w-[80px] text-xs py-1 px-2 h-auto ${isMarkMode ? 'bg-gray-400 hover:bg-gray-400 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600'} text-white`}
      disabled={disabled || processing || isMarkMode}
    >
      {processing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
      {mode === 'single' ? 'Capture' : `Capture ${burstCount}`}
    </Button>
  );
};

export default CaptureControls;