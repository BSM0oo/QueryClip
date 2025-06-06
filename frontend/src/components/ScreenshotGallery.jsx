import React, { useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';

const ScreenshotGallery = ({
  screenshots,
  onScreenshotsUpdate,
  customPrompt,
  videoTitle
}) => {
  const [visibleNotes, setVisibleNotes] = useState({});
  const [processingScreenshot, setProcessingScreenshot] = useState(false);
  const [error, setError] = useState('');
  const [editMode, setEditMode] = useState(false);
const [editableCaptions, setEditableCaptions] = useState({});

  const formatTime = (seconds) => {
    const date = new Date(seconds * 1000);
    return date.toISOString().substr(11, 8);
  };

  // Initialize editable captions when entering edit mode
  const handleEditMode = () => {
    if (!editMode) {
      const initialCaptions = {};
      screenshots.forEach((screenshot, index) => {
        initialCaptions[index] = screenshot.caption || '';
      });
      setEditableCaptions(initialCaptions);
    } else {
      // Save all changes when exiting edit mode
      const updatedScreenshots = screenshots.map((screenshot, index) => ({
        ...screenshot,
        caption: editableCaptions[index] || screenshot.caption
      }));
      onScreenshotsUpdate(updatedScreenshots);
    }
    setEditMode(!editMode);
  };

  const handleCaptionChange = (index, newValue) => {
    setEditableCaptions(prev => ({
      ...prev,
      [index]: newValue
    }));
  };

  const regenerateCaption = async (index) => {
    try {
      setProcessingScreenshot(true);
      const screenshot = screenshots[index];
      
      const response = await axios.post(`${API_BASE_URL}/api/generate-caption`, {
        timestamp: screenshot.timestamp,
        image_data: screenshot.image,
        transcript_context: screenshot.transcriptContext,
        prompt: customPrompt
      });

      const updatedScreenshots = [...screenshots];
      updatedScreenshots[index] = {
        ...screenshot,
        caption: response.data.caption
      };
      onScreenshotsUpdate(updatedScreenshots);
    } catch (error) {
      setError('Error regenerating caption: ' + error.message);
    } finally {
      setProcessingScreenshot(false);
    }
  };

  const updateScreenshotNotes = (index, notes) => {
    const updatedScreenshots = [...screenshots];
    updatedScreenshots[index] = {
      ...screenshots[index],
      notes
    };
    onScreenshotsUpdate(updatedScreenshots);
  };

  const updateScreenshotCaption = (index, caption) => {
    const updatedScreenshots = [...screenshots];
    updatedScreenshots[index] = {
      ...screenshots[index],
      caption
    };
    onScreenshotsUpdate(updatedScreenshots);
  };

  if (!screenshots.length) return null;

  return (
    <div className="space-y-4">
      {videoTitle && (
        <h1 className="text-2xl font-bold text-gray-800">{videoTitle}</h1>
      )}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Screenshots & Notes</h2>
        <button
          onClick={handleEditMode}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          {editMode ? 'Save Changes' : 'Edit Captions'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {screenshots.map((screenshot, index) => (
          <div key={index} className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="relative">
              <img 
                src={screenshot.image} 
                alt={`Screenshot ${index + 1}`}
                className="w-full object-cover"
              />
              <div className="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-sm">
                {new Date(screenshot.timestamp * 1000).toISOString().substr(11, 8)}
              </div>
            </div>
            
            <div className="p-3 space-y-2">
              {editMode ? (
                <textarea
                  value={editableCaptions[index] || ''}
                  onChange={(e) => handleCaptionChange(index, e.target.value)}
                  className="w-full min-h-[200px] p-3 border rounded-md resize-y text-sm font-sans"
                  placeholder="Caption text..."
                />
              ) : (
                <div className="min-h-[200px] max-h-[400px] overflow-y-auto">
                  <pre className="whitespace-pre-wrap text-sm font-sans leading-tight">
                    {screenshot.caption
                      .replace(/\n\n+/g, '\n') // Replace multiple newlines with a single one
                      .replace(/^\s*[-•]\s+/gm, '• ') // Standardize bullet points
                      .replace(/\n\s+/g, '\n') // Remove space at start of lines
                      .trim()}
                  </pre>
                </div>
              )}
              
              <div className="space-y-2">
                <textarea
                  value={screenshot.notes || ''}
                  onChange={(e) => {
                    const updatedScreenshots = [...screenshots];
                    updatedScreenshots[index] = {
                      ...screenshot,
                      notes: e.target.value
                    };
                    onScreenshotsUpdate(updatedScreenshots);
                  }}
                  placeholder="Add notes..."
                  className="w-full min-h-[100px] p-3 border rounded-md resize-y"
                />
                
                <button
                  onClick={() => regenerateCaption(index)}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-md"
                >
                  Regenerate Caption
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ScreenshotGallery;