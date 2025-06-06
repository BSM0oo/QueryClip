import React, { useState } from 'react';
import { saveAllContentToHistory } from '../utils/apiUtils';
import { Loader2, Save, History } from "lucide-react";

/**
 * A fixed position bar at the top of the screen that provides a prominent way
 * to save the current video content to history
 */
const HistorySaveBar = ({
  videoId,
  videoInfo,
  transcript,
  transcriptAnalysis,
  notes,
  screenshots,
  chapters,
  queryAnswers,
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  if (!videoId || !isVisible) {
    return null;
  }

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError('');
      setSuccess(false);

      // Collect all content that needs to be saved
      const contentData = {
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
        // Auto-hide after success
        setTimeout(() => {
          setSuccess(false);
          setIsVisible(false);
        }, 3000);
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

  const hasSaveableContent = (
    (transcript && transcript.length > 0) || 
    transcriptAnalysis || 
    notes || 
    (screenshots && screenshots.length > 0)
  );

  if (!hasSaveableContent) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 bg-blue-600 text-white p-2 z-50 flex justify-between items-center">
      <div className="flex items-center">
        <History className="h-5 w-5 mr-2" />
        <span className="font-medium">
          {videoInfo?.title ? `Save "${videoInfo.title}" to history?` : 'Save current video to history?'}
        </span>
      </div>
      
      <div className="flex items-center gap-2">
        {error && <span className="text-red-200 text-sm">{error}</span>}
        {success && <span className="text-green-200 text-sm">Saved successfully!</span>}
        
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-white text-blue-700 px-3 py-1 rounded-md flex items-center gap-1 text-sm font-medium hover:bg-blue-50 disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Save className="h-3 w-3" />
              <span>Save to History</span>
            </>
          )}
        </button>
        
        <button
          onClick={() => setIsVisible(false)}
          className="text-white hover:text-blue-200 p-1"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default HistorySaveBar;