import React, { useState } from 'react';
import { Button } from "./ui/button";
import { Loader2, Save, History } from "lucide-react";
import { saveAllContentToHistory } from '../utils/apiUtils';

/**
 * Button component that saves all current content to the video history
 */
const SaveToHistoryButton = ({
  videoId,
  videoInfo,
  transcript,
  transcriptAnalysis,
  notes,
  screenshots,
  chapters,
  queryAnswers,
  className = "",
  disabled = false
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError('');
      setSuccess(false);

      if (!videoId) {
        setError('No video ID available');
        return;
      }

      // Collect all content that needs to be saved
      const contentData = {
        // Include video title from videoInfo if available
        title: videoInfo?.title || "Untitled Video",
        
        // Convert transcript array to plain text for history
        transcript: transcript && Array.isArray(transcript) 
          ? transcript.map(item => item.text || '').join(' ').trim()
          : undefined,
        
        transcriptAnalysis: transcriptAnalysis || undefined,
        
        notes: notes || undefined,
        
        // Include screenshot metadata
        screenshotCount: screenshots?.length || 0,
        
        // Collect captions from all screenshots
        screenshotCaptions: screenshots && screenshots.length > 0
          ? screenshots
              .filter(s => s.caption)
              .map(s => `[${Math.floor(s.timestamp / 60)}:${String(Math.floor(s.timestamp % 60)).padStart(2, '0')}] ${s.caption}`)
              .join('\n\n')
          : undefined,
        
        // Include chapter data
        chapters: chapters || undefined,
        
        // Include query answers
        queryAnswers: queryAnswers || undefined
      };

      // Save to history API
      const success = await saveAllContentToHistory(videoId, contentData);
      
      if (success) {
        setSuccess(true);
        // Reset success message after 3 seconds
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError('Failed to save to history');
      }
    } catch (err) {
      console.error('Error saving to history:', err);
      setError('Failed to save to history: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`${className} flex items-center gap-2`}>
      <Button 
        onClick={handleSave}
        disabled={disabled || isSaving}
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center gap-2"
      >
        {isSaving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Saving to History...</span>
          </>
        ) : (
          <>
            <History className="h-4 w-4" />
            <span>Save to History</span>
          </>
        )}
      </Button>
      
      {error && (
        <div className="text-xs text-red-600">
          {error}
        </div>
      )}
      
      {success && (
        <div className="text-xs text-green-600">
          Saved successfully!
        </div>
      )}
    </div>
  );
};

export default SaveToHistoryButton;