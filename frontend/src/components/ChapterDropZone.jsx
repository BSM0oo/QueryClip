import React from 'react';
import { Droppable } from '@hello-pangea/dnd';
import { BookOpen } from 'lucide-react';

/**
 * ChapterDropZone component acts as a drop target for screenshots being assigned to chapters
 */
const ChapterDropZone = ({ 
  chapter, 
  chapterIndex,
  isActive,
  isDraggingOver,
  children 
}) => {
  // Handle the chapter ID correctly - use a string representation that is stable
  const chapterId = chapter ? (chapter.id || `chapter-${chapterIndex}`) : 'null';
  
  return (
    <div 
      className={`
        chapter-drop-zone 
        transition-all duration-200
        ${isActive ? 'border-2 rounded-lg' : ''}
        ${isActive && isDraggingOver ? 'border-blue-500 bg-blue-50' : isActive ? 'border-blue-200' : ''}
        ${isActive ? 'p-3 mb-6' : ''}
      `}
      data-chapter-id={chapterId}
    >
      {isActive && (
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="h-5 w-5 text-blue-500" />
          <h3 className="text-xl font-bold text-blue-700">
            {chapter?.title || 'Untitled Chapter'}
          </h3>
          <div className="text-sm text-gray-500 italic">
            Drop screenshots here
          </div>
        </div>
      )}
      {children}
    </div>
  );
};

export default ChapterDropZone;
