import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

const LabelControls = ({
  enableLabel,
  setEnableLabel,
  labelText,
  setLabelText,
  fontSize,
  setFontSize,
  textColor,
  setTextColor,
  renderCaptureButton
}) => {
  // Preview text for font size demo
  const [previewText, setPreviewText] = useState("Sample Text");

  return (
    <div className="space-y-2 p-2 border rounded-lg bg-gray-50 text-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <Switch
            id="label-toggle"
            checked={enableLabel}
            onCheckedChange={setEnableLabel}
            className="h-3 w-7 data-[state=checked]:bg-blue-500"
          />
          <Label htmlFor="label-toggle" className="text-xs cursor-pointer">Label</Label>
        </div>
        <div className="flex-1 flex justify-end">
          {renderCaptureButton && renderCaptureButton()}
        </div>
      </div>

      {enableLabel && (
        <>
          <div className="space-y-1">
            <Input
              id="label-text"
              value={labelText}
              onChange={(e) => setLabelText(e.target.value)}
              placeholder="Enter text to overlay..."
              className="w-full text-xs h-7 px-2"
            />
          </div>

          <div className="flex gap-2 items-center">
            <div className="flex items-center gap-1">
              <Label htmlFor="font-size" className="text-xs whitespace-nowrap">Size:</Label>
              <Input
                id="font-size"
                type="number"
                min="20"
                max="200"
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="w-12 text-xs h-6 px-1"
              />
            </div>

            <div className="flex items-center gap-1">
              <Switch
                id="color-toggle"
                checked={textColor === 'white'}
                onCheckedChange={(checked) => setTextColor(checked ? 'white' : 'black')}
                className="h-3 w-6 data-[state=checked]:bg-blue-500"
              />
              <Label htmlFor="color-toggle" className="text-xs cursor-pointer whitespace-nowrap">
                {textColor === 'white' ? 'White' : 'Black'}
              </Label>
            </div>
          </div>

          <div className="mt-1">
            <div 
              className="w-full h-16 bg-gray-200 rounded-md flex items-center justify-center overflow-hidden text-center px-2"
              style={{
                fontSize: `${fontSize/3}px`, // Scale down for preview
                color: textColor,
                lineHeight: 1.1,
                textShadow: textColor === 'white' ? '1px 1px 2px black' : '1px 1px 2px white'
              }}
            >
              {labelText || "Sample Text"}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default LabelControls;