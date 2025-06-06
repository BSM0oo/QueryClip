import React from 'react';
import { getContentTypeIcon } from '../utils/iconUtils.jsx';
import ScreenshotCard from './ScreenshotCard';
import PromptResponseCard from './PromptResponseCard';

const GalleryGrid = ({
  screenshots,
  groupByType,
  groupedScreenshots,
  editMode,
  expandedScreenshot,
  onUpdateNotes,
  onUpdateCaption,
  onRegenerateCaption,
  onDeleteScreenshot,
  onUpdatePromptResponse,
  setExpandedScreenshot
}) => {
  return (
    <div className="print:mx-0 print:w-full print:max-w-none print:p-0">
      {groupByType ? (
        // Grouped view
        Object.entries(groupedScreenshots).map(([type, typeScreenshots]) => (
          <div key={type} className="mb-8 print:mb-4">
            <div className="flex items-center gap-2 mb-4 print:mb-2">
              {type !== 'prompt_response' && getContentTypeIcon(type)}
              <h3 className="text-xl font-semibold capitalize print:text-lg">
                {type === 'prompt_response' ? 'Prompt Responses' : type}
              </h3>
              <span className="text-gray-500">({typeScreenshots.length})</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 print:block print:space-y-8 print:w-full">
              {typeScreenshots.map(({ originalIndex, ...screenshot }) => (
                screenshot.type === 'prompt_response' ? (
                  <PromptResponseCard
                    key={originalIndex}
                    screenshot={screenshot}
                    editMode={editMode}
                    index={originalIndex}
                    onUpdatePromptResponse={onUpdatePromptResponse}
                  />
                ) : (
                  <ScreenshotCard
                    key={originalIndex}
                    screenshot={screenshot}
                    index={originalIndex}
                    editMode={editMode}
                    onUpdateNotes={onUpdateNotes}
                    onUpdateCaption={onUpdateCaption}
                    onRegenerateCaption={onRegenerateCaption}
                    onDeleteScreenshot={onDeleteScreenshot}
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 print:grid-cols-1 print:gap-4 print:w-full">
          {screenshots.map((screenshot, index) => (
            screenshot.type === 'prompt_response' ? (
              <PromptResponseCard
                key={index}
                screenshot={screenshot}
                editMode={editMode}
                index={index}
                onUpdatePromptResponse={onUpdatePromptResponse}
              />
            ) : (
              <ScreenshotCard
                key={index}
                screenshot={screenshot}
                index={index}
                editMode={editMode}
                onUpdateNotes={onUpdateNotes}
                onUpdateCaption={onUpdateCaption}
                onRegenerateCaption={onRegenerateCaption}
                onDeleteScreenshot={onDeleteScreenshot}
                expanded={expandedScreenshot === index}
                onToggleExpand={() => setExpandedScreenshot(
                  expandedScreenshot === index ? null : index
                )}
              />
            )
          ))}
        </div>
      )}
    </div>
  );
};

export default GalleryGrid;