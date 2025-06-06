import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookOpen, Edit, Trash2, Save, X } from "lucide-react";

/**
 * ChapterMarker component displays a visual separator between screenshots
 * to indicate a new section/chapter in the content
 */
const ChapterMarker = ({ 
  chapter, 
  editMode, 
  onUpdateChapter,
  onDeleteChapter
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(chapter.title);

  const handleSave = () => {
    onUpdateChapter(chapter.id, { title });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTitle(chapter.title);
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  return (
    <div className="chapter-marker my-8 w-full print:my-12 print:page-break-before relative">
      <div className="bg-gradient-to-r from-blue-200 via-blue-400 to-blue-200 h-1 w-full my-4 print:border-t-2 print:border-blue-400 print:bg-none"></div>
      
      <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 print:bg-transparent print:border print:border-blue-200 print:p-2">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-blue-500" />
          
          {isEditing ? (
            <div className="flex gap-2 items-center flex-1">
              <Input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                className="font-semibold focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={handleSave} title="Save">
                  <Save className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={handleCancel} title="Cancel">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <h3 className="text-xl text-blue-700 dark:text-blue-300 font-bold print:text-base">
              {chapter.title}
            </h3>
          )}
        </div>
        
        {editMode && !isEditing && (
          <div className="flex gap-2 print:hidden">
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => setIsEditing(true)} 
              title="Edit chapter title"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => onDeleteChapter(chapter.id)} 
              title="Delete chapter"
              className="text-red-500 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChapterMarker;
