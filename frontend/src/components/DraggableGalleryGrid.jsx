import React, { useMemo, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { getContentTypeIcon } from '../utils/iconUtils.jsx';
import ScreenshotCard from './ScreenshotCard';
import PromptResponseCard from './PromptResponseCard';
import ChapterMarker from './ChapterMarker';
import AddChapterButton from './AddChapterButton';
import ChapterDropZone from './ChapterDropZone';

const DraggableGalleryGrid = ({
  reorderMode,
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
  setExpandedScreenshot,
  onReorderScreenshots,
  // Chapter props
  chapters = [],
  onAddChapter,
  onUpdateChapter,
  onDeleteChapter,
  onAssignScreenshotToChapter,
  onReorganizeChapter
}) => {
  // Sort chapters by timestamp to ensure they appear in the right order
  const sortedChapters = useMemo(() => 
    [...chapters].sort((a, b) => a.timestamp - b.timestamp),
    [chapters]
  );

  // Debug effect to log when screenshots change
  useEffect(() => {
    console.log(`DraggableGalleryGrid: Received ${screenshots.length} screenshots`);
  }, [screenshots.length]);

  // Group screenshots by chapter
  const screenshotsByChapter = useMemo(() => {
    const result = { 
      'null': [] // "null" is for screenshots not in any chapter
    };
    
    // Initialize with an empty array for each chapter
    sortedChapters.forEach(chapter => {
      if (chapter && chapter.id) {
        result[chapter.id] = [];
      }
    });
    
    // Distribute screenshots to their chapters
    screenshots.forEach((screenshot, index) => {
      // Consistently use 'null' string for null chapter ID
      const chapterId = screenshot.chapterId ? screenshot.chapterId : 'null';
      
      if (!result[chapterId]) {
        result[chapterId] = [];
      }
      
      result[chapterId].push({ ...screenshot, originalIndex: index });
    });
    
    // Log screenshot distribution for debugging
    const totalDistributed = Object.values(result)
      .reduce((sum, arr) => sum + arr.length, 0);
    console.log(`Screenshot distribution: ${totalDistributed} total, ${result['null'].length} without chapter`);
    console.log('Chapters with screenshots:', Object.keys(result).map(id => `${id}: ${result[id].length}`));
    
    return result;
  }, [screenshots, sortedChapters]);

  const handleDragEnd = (result) => {
    // Drop outside the list
    if (!result.destination) {
      return;
    }

    const startIndex = parseInt(result.source.index);
    const endIndex = parseInt(result.destination.index);
    const sourceChapterId = result.source.droppableId;
    const destinationChapterId = result.destination.droppableId;
    
    // Log the drag operation for debugging
    console.log(`Drag operation: from ${sourceChapterId}[${startIndex}] to ${destinationChapterId}[${endIndex}]`);
    
    if (startIndex === endIndex && sourceChapterId === destinationChapterId) {
      console.log('No change in position, skipping update');
      return; // No change
    }

    // Convert source index to global index in screenshots array
    const sourceGlobalIndex = findGlobalScreenshotIndex(sourceChapterId, startIndex);
    if (sourceGlobalIndex === -1) {
      console.error('Could not find source screenshot');
      return;
    }
    
    // Convert destination index to global index if same chapter
    let destinationGlobalIndex = endIndex;
    if (sourceChapterId === destinationChapterId) {
      // Just reorder within the same chapter
      const newScreenshots = Array.from(screenshots);
      const [removed] = newScreenshots.splice(sourceGlobalIndex, 1);
      
      // If moving within the same chapter, we need to adjust the destination index
      // based on whether we're moving up or down
      if (sourceGlobalIndex < destinationGlobalIndex) {
        destinationGlobalIndex = findGlobalScreenshotIndex(destinationChapterId, endIndex);
      } else {
        destinationGlobalIndex = findGlobalScreenshotIndex(destinationChapterId, endIndex);
      }
      
      if (destinationGlobalIndex === -1) {
        // Fallback to end of array if we can't find the destination
        destinationGlobalIndex = newScreenshots.length;
      }
      
      newScreenshots.splice(destinationGlobalIndex, 0, removed);
      console.log(`Reordering within ${sourceChapterId} chapter: moving from index ${sourceGlobalIndex} to ${destinationGlobalIndex}`);
      onReorderScreenshots(newScreenshots);
    } 
    // If dragging to a different chapter
    else {
      // Handle reorganizing between chapters
      // Note: Keep as string 'null' for internal processing but convert to null for API
      const internalDestId = destinationChapterId;
      const actualDestinationId = destinationChapterId === 'null' ? null : destinationChapterId;
      
      // Get the screenshot we're moving
      const screenshotToMove = screenshots[sourceGlobalIndex];
      if (!screenshotToMove) {
        console.error(`Could not find screenshot at index ${sourceGlobalIndex}`);
        return;
      }
      
      console.log(`Moving screenshot from chapter ${sourceChapterId} to ${internalDestId}`);
      
      // Find the appropriate destination global index
      let targetChapterScreenshots = [];
      if (internalDestId === 'null') {
        targetChapterScreenshots = screenshotsByChapter['null'] || [];
      } else {
        targetChapterScreenshots = screenshotsByChapter[internalDestId] || [];
      }
      
      // Calculate destination position more accurately
      let destinationGlobalIndex;
      
      if (targetChapterScreenshots.length === 0) {
        // No screenshots in this chapter yet, use the beginning or end of the array
        destinationGlobalIndex = 0; // Can be adjusted based on preference
      } else if (endIndex >= targetChapterScreenshots.length) {
        // Dropped at the end of chapter
        const lastScreenshot = targetChapterScreenshots[targetChapterScreenshots.length - 1];
        const lastIndex = screenshots.findIndex(s => 
          s.timestamp === lastScreenshot.timestamp && 
          (s.id === lastScreenshot.id || (!s.id && !lastScreenshot.id))
        );
        destinationGlobalIndex = lastIndex + 1;
      } else {
        // Find exact position
        const targetScreenshot = targetChapterScreenshots[endIndex];
        destinationGlobalIndex = screenshots.findIndex(s => 
          s.timestamp === targetScreenshot.timestamp && 
          (s.id === targetScreenshot.id || (!s.id && !targetScreenshot.id))
        );
      }
      
      if (destinationGlobalIndex === -1) {
        // Fallback if we can't find destination
        destinationGlobalIndex = screenshots.length;
        console.warn(`Could not find destination index, using end of array: ${destinationGlobalIndex}`);
      }
      
      console.log(`Moving to different chapter: from ${sourceGlobalIndex} to ${destinationGlobalIndex} in chapter ${actualDestinationId}`);
      
      // Create a new array with the screenshot moved and chapter updated
      const newScreenshots = [...screenshots];
      // Remove from original position
      newScreenshots.splice(sourceGlobalIndex, 1);
      // Add at new position with updated chapter
      const updatedScreenshot = {...screenshotToMove, chapterId: actualDestinationId};
      
      // Adjust destination if we removed from before it
      const adjustedDestIndex = sourceGlobalIndex < destinationGlobalIndex 
        ? destinationGlobalIndex - 1 
        : destinationGlobalIndex;
      
      newScreenshots.splice(adjustedDestIndex, 0, updatedScreenshot);
      console.log(`Placed at adjusted index ${adjustedDestIndex}`);
      
      onReorderScreenshots(newScreenshots);
    }
  };
  
  // Helper function to find the global index of a screenshot in the screenshots array
  // based on its chapter ID and local index within that chapter
  const findGlobalScreenshotIndex = (chapterId, localIndex) => {
    // Process chapter ID to handle both string and object formats
    let normalizedChapterId = chapterId;
    
    // Handle special case for 'null' string or actual null
    if (chapterId === 'null' || chapterId === null) {
      normalizedChapterId = 'null';
    } 
    // Handle chapter IDs that might be prefixed with 'chapter-'
    else if (typeof chapterId === 'string' && chapterId.startsWith('chapter-')) {
      const chapterNumber = parseInt(chapterId.replace('chapter-', ''), 10);
      if (!isNaN(chapterNumber) && chapterNumber < chapters.length) {
        // Convert to actual chapter ID if possible
        normalizedChapterId = chapters[chapterNumber].id || chapterId;
      }
    }
    
    // Get screenshots for this chapter
    const chapterScreenshots = normalizedChapterId === 'null' 
      ? screenshotsByChapter['null'] || [] 
      : screenshotsByChapter[normalizedChapterId] || [];
    
    console.log(`Looking for screenshots in chapter ${normalizedChapterId}, found ${chapterScreenshots.length} items`);
    
    if (localIndex >= chapterScreenshots.length) {
      console.warn(`Local index ${localIndex} is out of bounds for chapter ${normalizedChapterId} with ${chapterScreenshots.length} screenshots`);
      return -1;
    }
    
    const targetScreenshot = chapterScreenshots[localIndex];
    if (!targetScreenshot) {
      console.warn(`Could not find screenshot at index ${localIndex} in chapter ${normalizedChapterId}`);
      return -1;
    }
    
    const globalIndex = screenshots.findIndex(s => 
      s.timestamp === targetScreenshot.timestamp && 
      (s.id === targetScreenshot.id || (!s.id && !targetScreenshot.id))
    );
    
    console.log(`Found global index ${globalIndex} for chapter ${normalizedChapterId} local index ${localIndex}`);
    return globalIndex;
  };

  // Merge screenshots and chapters for rendering
  const getChapterForScreenshotIndex = (index) => {
    const screenshot = screenshots[index];
    // Find chapters that should appear after this screenshot
    return sortedChapters.find(chapter => 
      chapter.afterScreenshotIndex === index || 
      (chapter.afterScreenshotIndex === -1 && index === screenshots.length - 1)
    );
  };

  if (groupByType) {
    // For now, disable drag and drop in grouped view
    return (
      <div className="print:mx-0 print:w-full print:max-w-none print:p-0">
        {Object.entries(groupedScreenshots).map(([type, typeScreenshots]) => (
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
        ))}
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="space-y-4 print:block print:space-y-8 print:w-full">
        {editMode && !reorderMode && (
          <AddChapterButton 
            onClick={() => onAddChapter(-1)} 
            className="mt-2 mb-6" 
            index={-1}
          />
        )}
        
        {/* Chapter-based layout in edit mode */}
        {editMode && !reorderMode && sortedChapters.length > 0 ? (
          <div className="chapters-container space-y-8">
            {/* First show screenshots without a chapter */}
            <Droppable droppableId="null">
              {(provided, snapshot) => (
                <ChapterDropZone 
                  isActive={true} 
                  isDraggingOver={snapshot.isDraggingOver}
                >
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="grid grid-cols-1 md:grid-cols-2 gap-8"
                  >
                    <div className="col-span-full mb-2">
                      <h3 className="text-xl font-semibold text-gray-700">Uncategorized</h3>
                    </div>
                    
                    {screenshotsByChapter['null'].map((screenshot, index) => (
                      <Draggable
                        key={`${screenshot.timestamp}-${screenshot.originalIndex}`}
                        draggableId={`${screenshot.timestamp}-${screenshot.originalIndex}`}
                        index={index}
                        isDragDisabled={screenshot.type === 'prompt_response'}
                      >
                        {(provided, draggableSnapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`${draggableSnapshot.isDragging ? 'opacity-75 rotate-1' : ''}`}
                            style={{
                              ...provided.draggableProps.style,
                              transition: draggableSnapshot.isDragging ? 'none' : 'all 0.2s',
                              transform: draggableSnapshot.isDragging 
                                ? `${provided.draggableProps.style.transform} rotate(1deg)` 
                                : provided.draggableProps.style.transform
                            }}
                          >
                            {screenshot.type === 'prompt_response' ? (
                              <PromptResponseCard
                                screenshot={screenshot}
                                editMode={editMode}
                                index={screenshot.originalIndex}
                                onUpdatePromptResponse={onUpdatePromptResponse}
                              />
                            ) : (
                              <ScreenshotCard
                                screenshot={screenshot}
                                index={screenshot.originalIndex}
                                editMode={editMode}
                                onUpdateNotes={onUpdateNotes}
                                onUpdateCaption={onUpdateCaption}
                                onRegenerateCaption={onRegenerateCaption}
                                onDeleteScreenshot={onDeleteScreenshot}
                                expanded={expandedScreenshot === screenshot.originalIndex}
                                onToggleExpand={() => setExpandedScreenshot(
                                  expandedScreenshot === screenshot.originalIndex ? null : screenshot.originalIndex
                                )}
                              />
                            )}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                </ChapterDropZone>
              )}
            </Droppable>

            {/* Then show chapters with their screenshots */}
            {sortedChapters.map((chapter, chapterIndex) => (
              <div key={chapter.id} className="chapter-section">
                <ChapterMarker
                  chapter={chapter}
                  editMode={editMode}
                  onUpdateChapter={onUpdateChapter}
                  onDeleteChapter={onDeleteChapter}
                />
                
                <Droppable droppableId={chapter.id}>
                  {(provided, snapshot) => (
                    <ChapterDropZone 
                      chapter={chapter}
                      chapterIndex={chapterIndex}
                      isActive={true} 
                      isDraggingOver={snapshot.isDraggingOver}
                    >
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className="grid grid-cols-1 md:grid-cols-2 gap-8"
                      >
                        {(screenshotsByChapter[chapter.id] || []).map((screenshot, index) => (
                          <Draggable
                            key={`${screenshot.timestamp}-${screenshot.originalIndex}`}
                            draggableId={`${screenshot.timestamp}-${screenshot.originalIndex}`}
                            index={index}
                            isDragDisabled={screenshot.type === 'prompt_response'}
                          >
                            {(provided, draggableSnapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`${draggableSnapshot.isDragging ? 'opacity-75 rotate-1' : ''}`}
                                style={{
                                  ...provided.draggableProps.style,
                                  transition: draggableSnapshot.isDragging ? 'none' : 'all 0.2s',
                                  transform: draggableSnapshot.isDragging 
                                    ? `${provided.draggableProps.style.transform} rotate(1deg)` 
                                    : provided.draggableProps.style.transform
                                }}
                              >
                                {screenshot.type === 'prompt_response' ? (
                                  <PromptResponseCard
                                    screenshot={screenshot}
                                    editMode={editMode}
                                    index={screenshot.originalIndex}
                                    onUpdatePromptResponse={onUpdatePromptResponse}
                                  />
                                ) : (
                                  <ScreenshotCard
                                    screenshot={screenshot}
                                    index={screenshot.originalIndex}
                                    editMode={editMode}
                                    onUpdateNotes={onUpdateNotes}
                                    onUpdateCaption={onUpdateCaption}
                                    onRegenerateCaption={onRegenerateCaption}
                                    onDeleteScreenshot={onDeleteScreenshot}
                                    expanded={expandedScreenshot === screenshot.originalIndex}
                                    onToggleExpand={() => setExpandedScreenshot(
                                      expandedScreenshot === screenshot.originalIndex ? null : screenshot.originalIndex
                                    )}
                                  />
                                )}
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    </ChapterDropZone>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        ) : (
          /* Standard layout for non-edit mode or when no chapters */
          <Droppable droppableId="screenshots">
            {(provided, snapshot) => (
              <div 
                {...provided.droppableProps}
                ref={provided.innerRef}
                className={`grid grid-cols-1 md:grid-cols-2 gap-8 print:block print:space-y-8 print:w-full ${snapshot.isDraggingOver ? 'bg-blue-50/50 rounded-lg p-4' : ''}`}
              >
                {screenshots.map((screenshot, index) => (
                  <React.Fragment key={`fragment-${screenshot.timestamp}-${index}`}>
                    <Draggable 
                      key={`${screenshot.timestamp}-${index}`} 
                      draggableId={`${screenshot.timestamp}-${index}`} 
                      index={index}
                      isDragDisabled={!reorderMode || screenshot.type === 'prompt_response'}
                    >
                      {(provided, draggableSnapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={`${draggableSnapshot.isDragging ? 'opacity-75 rotate-1' : ''}`}
                          style={{
                            ...provided.draggableProps.style,
                            transition: draggableSnapshot.isDragging ? 'none' : 'all 0.2s',
                            transform: draggableSnapshot.isDragging 
                              ? `${provided.draggableProps.style.transform} rotate(1deg)` 
                              : provided.draggableProps.style.transform
                          }}
                        >
                          <div className="relative">
                            {/* Visual indicator for drag handle */}
                            {reorderMode && screenshot.type !== 'prompt_response' && (
                              <div className="absolute top-2 left-2 z-10 bg-black/50 text-white px-2 py-1 rounded text-sm print:hidden">
                                Drag to reorder
                              </div>
                            )}
                            {screenshot.type === 'prompt_response' ? (
                              <PromptResponseCard
                                screenshot={screenshot}
                                editMode={editMode}
                                index={index}
                                onUpdatePromptResponse={onUpdatePromptResponse}
                              />
                            ) : (
                              <ScreenshotCard
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
                            )}
                          </div>
                        </div>
                      )}
                    </Draggable>

                    {/* Add chapter button after each screenshot */}
                    {editMode && !reorderMode && (
                      <div className="col-span-2">
                        <AddChapterButton onClick={onAddChapter} index={index} />
                      </div>
                    )}

                    {/* Render chapter marker if one exists after this screenshot */}
                    {getChapterForScreenshotIndex(index) && (
                      <div className="col-span-2">
                        <ChapterMarker 
                          chapter={getChapterForScreenshotIndex(index)}
                          editMode={editMode}
                          onUpdateChapter={onUpdateChapter}
                          onDeleteChapter={onDeleteChapter}
                        />
                      </div>
                    )}
                  </React.Fragment>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        )}
      </div>
    </DragDropContext>
  );
};

export default DraggableGalleryGrid;