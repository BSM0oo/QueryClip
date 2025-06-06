import React, { useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { getContentTypeIcon } from '../utils/iconUtils.jsx';
import ReactMarkdown from 'react-markdown';

const EnhancedScreenshotGallery = ({
  screenshots,
  onScreenshotsUpdate,
  customPrompt,
  videoTitle
}) => {
  const [visibleNotes, setVisibleNotes] = useState({});
  const [processingScreenshot, setProcessingScreenshot] = useState(false);
  const [error, setError] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [groupByType, setGroupByType] = useState(false);
  const [expandedScreenshot, setExpandedScreenshot] = useState(null);
  const [sortAscending, setSortAscending] = useState(true);

  const formatTime = (seconds) => {
    const date = new Date(seconds * 1000);
    return date.toISOString().substr(11, 8);
  };

  const deleteScreenshot = (index) => {
    const updatedScreenshots = screenshots.filter((_, i) => i !== index);
    onScreenshotsUpdate(updatedScreenshots);
  };

  const regenerateCaption = async (index) => {
    try {
      setProcessingScreenshot(true);
      const screenshot = screenshots[index];
      
      const response = await axios.post(`${API_BASE_URL}/api/generate-structured-caption`, {
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
    const updatedScreenshots = [...screenshots];
    updatedScreenshots[index] = {
      ...screenshots[index],
      ...updatedPromptResponse
    };
    onScreenshotsUpdate(updatedScreenshots);
  };

  const sortScreenshots = (shots) => {
    return [...shots].sort((a, b) => {
      const timeA = a.timestamp || 0;
      const timeB = b.timestamp || 0;
      return sortAscending ? timeA - timeB : timeB - timeA;
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
    <div className="space-y-8">
      {videoTitle && (
        <h1 className="text-2xl font-bold text-gray-800">{videoTitle}</h1>
      )}
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0">
        <h2 className="text-2xl font-bold">Screenshots & Notes</h2>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={() => setSortAscending(!sortAscending)}
            className="flex-1 sm:flex-none text-xs sm:text-sm border border-gray-300 hover:border-gray-400 bg-white hover:bg-gray-50 text-gray-800 hover:text-gray-900 px-2 sm:px-3 py-1 rounded"
          >
            {sortAscending ? '↑ Oldest First' : '↓ Newest First'}
          </button>
          <button
            onClick={() => setGroupByType(!groupByType)}
            className="flex-1 sm:flex-none text-xs sm:text-sm border border-gray-300 hover:border-gray-400 bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-800 px-2 sm:px-3 py-1 rounded"
          >
            {groupByType ? 'Show Chronological' : 'Group by Type'}
          </button>
          <button
            onClick={() => setEditMode(!editMode)}
            className="flex-1 sm:flex-none text-xs sm:text-sm border border-gray-300 hover:border-gray-400 bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-800 px-2 sm:px-3 py-1 rounded"
          >
            {editMode ? 'Save Changes' : 'Edit Captions'}
          </button>
        </div>
      </div>

      {groupByType ? (
        // Grouped view
        Object.entries(groupedScreenshots).map(([type, typeScreenshots]) => (
          <div key={type} className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              {type !== 'prompt_response' && getContentTypeIcon(type)}
              <h3 className="text-xl font-semibold capitalize">
                {type === 'prompt_response' ? 'Prompt Responses' : type}
              </h3>
              <span className="text-gray-500">({typeScreenshots.length})</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {typeScreenshots.map(({ originalIndex, ...screenshot }) => (
                screenshot.type === 'prompt_response' ? (
                  <PromptResponseCard
                    key={originalIndex}
                    screenshot={screenshot}
                    editMode={editMode}
                    index={originalIndex}
                    onUpdatePromptResponse={updatePromptResponse}
                  />
                ) : (
                  <ScreenshotCard
                    key={originalIndex}
                    screenshot={screenshot}
                    index={originalIndex}
                    editMode={editMode}
                    onUpdateNotes={updateScreenshotNotes}
                    onUpdateCaption={updateScreenshotCaption}
                    onRegenerateCaption={regenerateCaption}
                    onDeleteScreenshot={deleteScreenshot}
                    expanded={expandedScreenshot === originalIndex}
                    onToggleExpand={() => setExpandedScreenshot(
                      expandedScreenshot === originalIndex ? null : originalIndex
                    )}
                  />
                )
              ))}
            </div>
          </div>
        ))
      ) : (
        // Chronological view
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {sortScreenshots(screenshots).map((screenshot, index) => (
            screenshot.type === 'prompt_response' ? (
              <PromptResponseCard
                key={index}
                screenshot={screenshot}
                editMode={editMode}
                index={index}
                onUpdatePromptResponse={updatePromptResponse}
              />
            ) : (
              <ScreenshotCard
                key={index}
                screenshot={screenshot}
                index={index}
                editMode={editMode}
                onUpdateNotes={updateScreenshotNotes}
                onUpdateCaption={updateScreenshotCaption}
                onRegenerateCaption={regenerateCaption}
                onDeleteScreenshot={deleteScreenshot}
                expanded={expandedScreenshot === index}
                onToggleExpand={() => setExpandedScreenshot(
                  expandedScreenshot === index ? null : index
                )}
              />
            )
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
    </div>
  );
};

const PromptResponseCard = ({ screenshot, editMode, index, onUpdatePromptResponse }) => {
  const handleUpdate = (field, value) => {
    onUpdatePromptResponse(index, {
      ...screenshot,
      [field]: value
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-6 space-y-4">
        {editMode ? (
          <>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Query:</label>
              <textarea
                value={screenshot.prompt}
                onChange={(e) => handleUpdate('prompt', e.target.value)}
                className="w-full min-h-[80px] p-3 border rounded-md resize-y text-sm font-sans"
                placeholder="Enter your query..."
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Response:</label>
              <textarea
                value={screenshot.response}
                onChange={(e) => handleUpdate('response', e.target.value)}
                className="w-full min-h-[200px] p-3 border rounded-md resize-y text-sm font-sans"
                placeholder="Enter the response..."
              />
            </div>
          </>
        ) : (
          <>
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
              <p className="text-blue-800 font-medium">Query:</p>
              <p className="text-blue-900">{screenshot.prompt}</p>
            </div>
            <div className="prose prose-sm max-w-none">
              <div className="markdown-content">
                <ReactMarkdown
                  components={{
                    ul: ({node, ...props}) => (
                      <ul className="list-disc pl-4 space-y-1 mb-4" {...props} />
                    ),
                    li: ({node, ...props}) => (
                      <li className="ml-4" {...props} />
                    ),
                    h2: ({node, ...props}) => (
                      <h2 className="text-lg font-bold mt-4 mb-2" {...props} />
                    ),
                    p: ({node, ...props}) => (
                      <p className="mb-4" {...props} />
                    ),
                    strong: ({node, ...props}) => (
                      <strong className="font-bold" {...props} />
                    )
                  }}
                >
                  {screenshot.response}
                </ReactMarkdown>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const ScreenshotCard = ({
  screenshot,
  index,
  editMode,
  onUpdateNotes,
  onUpdateCaption,
  onRegenerateCaption,
  onDeleteScreenshot,
  expanded,
  onToggleExpand
}) => {
  const [showNotes, setShowNotes] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false); // Changed to false by default

  const parseStructuredCaption = (caption) => {
    try {
      const parts = caption.split('\n\n').filter(Boolean);
      return {
        topic: parts[0]?.replace('TOPIC HEADING: ', '').trim(),
        context: parts[1]?.replace('CONTEXT: ', '').trim(),
        points: parts[2]?.replace('KEY POINTS: ', '')
          .split('\n')
          .filter(point => point.trim())
          .map(point => point.trim().replace(/^[•-]\s*/, ''))
      };
    } catch (error) {
      console.error('Error parsing caption:', error);
      return { topic: '', context: '', points: [] };
    }
  };

  const { topic, context, points } = parseStructuredCaption(screenshot.caption);

  // Add a helper function to format the transcript
  const formatTranscript = (transcriptContext) => {
    if (!transcriptContext) return 'No transcript context available';
    // Remove line breaks and extra spaces, join with single spaces
    return transcriptContext
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .join(' ');
  };

  return (
    <div className={`bg-white rounded-lg shadow-md overflow-hidden ${expanded ? 'col-span-2' : ''}`}>
      <div className="relative">
        <img 
          src={screenshot.image} 
          alt={`Screenshot ${index + 1}`}
          className={`w-full object-cover ${expanded ? 'max-h-[600px]' : ''}`}
          onClick={onToggleExpand}
        />
        <div className="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-sm">
          {new Date(screenshot.timestamp * 1000).toISOString().substr(11, 8)}
        </div>
        {screenshot.content_type && (
          <div className="absolute top-2 left-2">
            {getContentTypeIcon(screenshot.content_type)}
          </div>
        )}
      </div>
      
      <div className="p-6 space-y-4">
        {editMode ? (
          <textarea
            value={screenshot.caption}
            onChange={(e) => onUpdateCaption(index, e.target.value)}
            className="w-full min-h-[200px] p-3 border rounded-md resize-y text-sm font-sans"
            placeholder="Caption text..."
          />
        ) : (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-gray-900">{topic}</h3>
            {context && (
              <p className="text-gray-600">{context}</p>
            )}
            <ul className="space-y-2">
              {points?.map((point, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">•</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
            {showTranscript && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Transcript Context:</h4>
                <p className="text-sm text-gray-600 font-sans">
                  {formatTranscript(screenshot.transcriptContext)}
                </p>
              </div>
            )}
          </div>
        )}
        
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowNotes(!showNotes)}
            className="text-gray-600 hover:text-gray-800"
          >
            {showNotes ? 'Hide Notes' : 'Show Notes'}
          </button>
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="text-gray-600 hover:text-gray-800"
          >
            {showTranscript ? 'Hide Transcript' : 'Show Transcript'}
          </button>
          <button
            onClick={() => onRegenerateCaption(index)}
            className="text-gray-600 hover:text-gray-800"
          >
            Regenerate Caption
          </button>
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to delete this screenshot?')) {
                onDeleteScreenshot(index);
              }
            }}
            className="text-red-600 hover:text-red-800"
          >
            Delete
          </button>
        </div>

        {showNotes && (
          <textarea
            value={screenshot.notes || ''}
            onChange={(e) => onUpdateNotes(index, e.target.value)}
            placeholder="Add notes..."
            className="w-full min-h-[100px] p-3 border rounded-md resize-y"
          />
        )}
      </div>
    </div>
  );
};

export default EnhancedScreenshotGallery;