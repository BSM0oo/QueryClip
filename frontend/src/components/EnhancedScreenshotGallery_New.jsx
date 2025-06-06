import React, { useState } from 'react';
import axios from 'axios';
import { getApiUrl } from '../config';
import GalleryControls from './GalleryControls';
import DraggableGalleryGrid from './DraggableGalleryGrid';

const EnhancedScreenshotGallery = ({
  screenshots,
  onScreenshotsUpdate,
  customPrompt,
  videoTitle,
  chapters = [],
  onAddChapter,
  onUpdateChapter,
  onDeleteChapter,
  onAssignScreenshotToChapter,
  onReorganizeChapter
}) => {
  const [processingScreenshot, setProcessingScreenshot] = useState(false);
  const [error, setError] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [groupByType, setGroupByType] = useState(false);
  const [expandedScreenshot, setExpandedScreenshot] = useState(null);
  const [sortAscending, setSortAscending] = useState(true);
  const [sortByCreationTime, setSortByCreationTime] = useState(false); // New option to sort by creation time
  const [reorderMode, setReorderMode] = useState(false);

  const regenerateCaption = async (index) => {
    try {
      setProcessingScreenshot(true);
      const screenshot = screenshots[index];
      
      const response = await axios.post(getApiUrl('/generate-structured-caption'), {
        timestamp: screenshot.timestamp,
        image_data: screenshot.image,
        transcript_context: screenshot.transcriptContext,
        prompt: customPrompt
      });

      const updatedScreenshots = [...screenshots];
      updatedScreenshots[index] = {
        ...screenshot,
        caption: response.data.structured_caption,
        content_type: response.data.content_type
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

  const updatePromptResponse = (index, updatedPromptResponse) => {
    // If updatedPromptResponse is null, delete the screenshot
    if (updatedPromptResponse === null) {
      const updatedScreenshots = screenshots.filter((_, i) => i !== index);
      onScreenshotsUpdate(updatedScreenshots);
      return;
    }
    
    // Otherwise update the prompt response
    const updatedScreenshots = [...screenshots];
    updatedScreenshots[index] = {
      ...screenshots[index],
      ...updatedPromptResponse
    };
    onScreenshotsUpdate(updatedScreenshots);
  };

  const deleteScreenshot = (index) => {
    const updatedScreenshots = screenshots.filter((_, i) => i !== index);
    onScreenshotsUpdate(updatedScreenshots);
  };

  const sortScreenshots = (shots) => {
    return [...shots].sort((a, b) => {
      let valueA, valueB;
      
      if (sortByCreationTime) {
        // Sort by when the screenshot was created (capture time)
        valueA = a.createdAt ? new Date(a.createdAt).getTime() : 
                 (a.id ? parseInt(a.id.split(/[-_]/)[0]) || 0 : 0);
        valueB = b.createdAt ? new Date(b.createdAt).getTime() : 
                 (b.id ? parseInt(b.id.split(/[-_]/)[0]) || 0 : 0);
      } else {
        // Sort by video timestamp
        valueA = a.timestamp || 0;
        valueB = b.timestamp || 0;
      }
      
      return sortAscending ? valueA - valueB : valueB - valueA;
    });
  };

  const groupScreenshotsByType = () => {
    const groups = {};
    const sortedShots = sortScreenshots(screenshots);
    sortedShots.forEach((screenshot, index) => {
      const type = screenshot.type === 'prompt_response' ? 'prompt_response' : (screenshot.content_type || 'other');
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push({ ...screenshot, originalIndex: index });
    });
    return groups;
  };

  if (!screenshots.length) return null;

  const groupedScreenshots = groupByType ? groupScreenshotsByType() : null;

  return (
    <div className="space-y-8 print:space-y-4 print:mx-0 print:w-full print:max-w-full">
      <div className="print:fixed print:top-0 print:right-4 print:text-sm print:text-gray-500">
        {new Date().toLocaleDateString()}
      </div>
      <GalleryControls
        videoTitle={videoTitle}
        sortAscending={sortAscending}
        sortByCreationTime={sortByCreationTime}
        groupByType={groupByType}
        editMode={editMode}
        reorderMode={reorderMode}
        onSortToggle={() => setSortAscending(!sortAscending)}
        onSortByToggle={() => setSortByCreationTime(!sortByCreationTime)}
        onGroupToggle={() => setGroupByType(!groupByType)}
        onEditToggle={() => setEditMode(!editMode)}
        onReorderToggle={() => setReorderMode(!reorderMode)}
      />

      <DraggableGalleryGrid
        screenshots={sortScreenshots(screenshots)}
        groupByType={groupByType}
        reorderMode={reorderMode}
        groupedScreenshots={groupedScreenshots}
        editMode={editMode}
        expandedScreenshot={expandedScreenshot}
        onUpdateNotes={updateScreenshotNotes}
        onUpdateCaption={updateScreenshotCaption}
        onRegenerateCaption={regenerateCaption}
        onDeleteScreenshot={deleteScreenshot}
        onUpdatePromptResponse={updatePromptResponse}
        setExpandedScreenshot={setExpandedScreenshot}
        onReorderScreenshots={onScreenshotsUpdate}
        chapters={chapters}
        onAddChapter={onAddChapter}
        onUpdateChapter={onUpdateChapter}
        onDeleteChapter={onDeleteChapter}
        onAssignScreenshotToChapter={onAssignScreenshotToChapter}
        onReorganizeChapter={onReorganizeChapter}
      />

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
    </div>
  );
};

export default EnhancedScreenshotGallery;