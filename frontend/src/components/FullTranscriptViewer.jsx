import React, { useState } from 'react';
import { CopyIcon } from './icons/CopyIcon';

const FullTranscriptViewer = ({ transcript }) => {
  const [showTranscript, setShowTranscript] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!transcript || transcript.length === 0) {
    return null;
  }

  // Handle case when transcript might not be an array
  const isArray = Array.isArray(transcript);

  const formattedText = isArray 
    ? transcript.map((item) => {
        const time = new Date(item.start * 1e3).toISOString().substr(11, 8);
        return `[${time}] ${item.text}`;
      }).join('\n')
    : typeof transcript === 'string' 
      ? transcript 
      : JSON.stringify(transcript);

  const handleCopy = () => {
    navigator.clipboard.writeText(formattedText).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      (err) => {
        console.error('Could not copy text: ', err);
      }
    );
  };

  return (
    <div className="border rounded-lg bg-white p-3 shadow">
      <div className="flex justify-between items-center mb-1">
        <h2 className="text-lg font-bold">Full Transcript</h2>
        <div className="flex">
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="text-blue-500 hover:text-blue-700 mr-2"
          >
            {showTranscript ? 'Hide' : 'Show'} Full Transcript
          </button>
          {showTranscript && (
            <button
              onClick={handleCopy}
              className="flex items-center text-gray-500 hover:text-gray-700"
              title="Copy transcript to clipboard"
            >
              <CopyIcon className="w-4 h-4 mr-1" />
              {copied ? 'Copied!' : 'Copy'}
            </button>
          )}
        </div>
      </div>

      {showTranscript && (
        <div className="mt-3 overflow-auto max-h-[400px] bg-gray-50 p-3 rounded font-mono text-sm whitespace-pre-wrap leading-tight">
          {formattedText}
        </div>
      )}
    </div>
  );
};

export default FullTranscriptViewer;