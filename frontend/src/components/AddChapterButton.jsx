import React from 'react';
import { Button } from "@/components/ui/button";
import { BookPlus } from "lucide-react";

/**
 * Button component that allows inserting a new chapter marker
 */
const AddChapterButton = ({ onClick, className, index }) => {
  return (
    <div className={`flex justify-center my-3 ${className || ''}`}>
      <Button
        variant="outline"
        size="sm"
        className="text-blue-600 border-blue-300 hover:border-blue-500 hover:bg-blue-50"
        onClick={() => onClick(index)}
      >
        <BookPlus className="h-4 w-4 mr-2" />
        Add Chapter
      </Button>
    </div>
  );
};

export default AddChapterButton;
