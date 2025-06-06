import React from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const VideoControls = ({ 
  isFullWidth, 
  onToggleFullWidth, 
  eraseFilesOnClear,
  setEraseFilesOnClear,
  onClearData,
  videoId,
  setVideoId,
  onVideoSubmit,
  loading
}) => {
  const handleSubmit = (e) => {
    e.preventDefault();
    onVideoSubmit(e);
  };
  return (
    <div className="bg-white rounded-lg p-4 border mb-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          {/* URL input and Load button */}
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold whitespace-nowrap">Video Controls</h2>
            <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-2">
              <input
                type="text"
                value={videoId}
                onChange={(e) => setVideoId(e.target.value)}
                placeholder="Enter YouTube Video URL"
                className="flex-1 p-2 border rounded text-sm min-w-[300px]"
              />
              <Button 
                type="submit"
                variant="default"
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Load Video'}
              </Button>
            </form>
          </div>

          {/* Full Width toggle */}
          <Button 
            variant="outline"
            onClick={onToggleFullWidth}
            className="whitespace-nowrap"
          >
            {isFullWidth ? 'Constrained Width' : 'Full Width View'}
          </Button>
        </div>

          <div className="flex items-center gap-4 border-l pl-4">
            <div className="flex items-center gap-2">
              <Switch
                id="erase-files"
                checked={eraseFilesOnClear}
                onCheckedChange={setEraseFilesOnClear}
              />
              <Label htmlFor="erase-files" className="whitespace-nowrap text-sm">Erase local files on clear</Label>
            </div>
            
            <Button 
              variant="destructive" 
              onClick={onClearData}
              className="whitespace-nowrap"
              size="sm"
            >
              Clear All Data
            </Button>
          </div>
      </div>
    </div>
  );
};

export default VideoControls;