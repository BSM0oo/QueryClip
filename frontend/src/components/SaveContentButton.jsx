import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";
import { saveState } from '../utils/apiUtils';

const SaveContentButton = ({
  screenshots,
  videoInfo,
  transcriptAnalysis,
  transcript,
  disabled = false
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const formatDate = () => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  };

  // ... (generateHTML function stays the same) ...

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError('');

      // Save HTML content
      const html = generateHTML();
      const title = videoInfo?.title || 'untitled';
      const date = formatDate();
      const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const filename = `${safeTitle}_${date}.html`;

      const response = await fetch('/api/save-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: html,
          filename: filename
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save content');
      }

      // Also save screenshots to server for persistence
      try {
        await saveState({
          screenshots: screenshots,
          videoId: videoInfo?.id || '',
          timestamp: Date.now()
        });
        console.log('Screenshots saved to server');
      } catch (serverErr) {
        console.error('Error saving screenshots to server:', serverErr);
        // Don't fail the whole operation if just server save fails
      }

      alert('Content saved successfully!');
    } catch (err) {
      console.error('Error saving content:', err);
      setError('Failed to save content: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mt-8 pb-4 text-center text-sm text-gray-500">
      <Button 
        onClick={handleSave}
        disabled={disabled || isSaving}
        variant="ghost"
        className="text-gray-500 hover:text-gray-700"
      >
        {isSaving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Save className="mr-2 h-4 w-4" />
            Save Page Content
          </>
        )}
      </Button>
      {error && (
        <div className="mt-2 text-xs text-red-600">
          {error}
        </div>
      )}
    </div>
  );
};

export default SaveContentButton;