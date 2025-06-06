import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

const VideoControls = ({ 
  onLoadVideo, 
  onToggleFullWidth, 
  onClearData,
  isFullWidth,
  eraseLocalFiles,
  setEraseLocalFiles 
}) => {
  const [videoUrl, setVideoUrl] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    onLoadVideo(videoUrl);
  };

  return (
    <Card className="p-2 sm:p-4 mb-4 bg-white shadow-sm overflow-hidden">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
        <form onSubmit={handleSubmit} className="flex-1 w-full mb-2 sm:mb-0">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                type="text"
                placeholder="Enter YouTube Video URL"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                className="w-full"
              />
            </div>
            <Button type="submit" variant="default" className="bg-blue-500 hover:bg-blue-600">
              Load Video
            </Button>
          </div>
        </form>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
          <Button
            onClick={onToggleFullWidth}
            variant="secondary"
            className="bg-purple-500 hover:bg-purple-600 text-white"
          >
            {isFullWidth ? 'Normal View' : 'Full Width View'}
          </Button>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="eraseFiles"
              checked={eraseLocalFiles}
              onChange={(e) => setEraseLocalFiles(e.target.checked)}
              className="form-checkbox h-4 w-4 text-blue-600"
            />
            <Label htmlFor="eraseFiles" className="text-sm text-gray-600">
              Erase local files on clear
            </Label>
          </div>

          <Button
            onClick={onClearData}
            variant="destructive"
            className="bg-red-500 hover:bg-red-600"
          >
            Clear All Data
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default VideoControls;