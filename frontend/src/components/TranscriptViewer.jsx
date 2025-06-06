import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { getApiUrl } from '../config';
import { CopyIcon } from './icons/CopyIcon';

const TranscriptViewer = ({
  transcript,
  currentTime,
  onTimeClick,
  onAnalysisGenerated
}) => {
  const [analyzingTranscript, setAnalyzingTranscript] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedWithoutTimestamps, setCopiedWithoutTimestamps] = useState(false);
  const transcriptRef = useRef(null);

  const formatTime = (seconds) => {
    const date = new Date(seconds * 1000);
    return date.toISOString().substr(11, 8);
  };

  // Handle auto-scrolling of transcript
  useEffect(() => {
    if (transcriptRef.current) {

      const transcriptElement = transcriptRef.current;
      const timestampElements = transcriptElement.getElementsByClassName('timestamp');
      
      for (let element of timestampElements) {
        const elementTime = parseFloat(element.dataset.time);
        if (elementTime >= currentTime) {
          const elementTop = element.offsetTop - transcriptElement.offsetTop;
          const scrollPosition = elementTop - transcriptElement.clientHeight / 2 + element.clientHeight / 2;

          transcriptElement.scrollTo({
            top: scrollPosition,
            behavior: 'smooth'
          });
          break;
        }
      }
    }
  }, [currentTime]);

  const analyzeTranscript = async () => {
    if (!transcript.length) return;
    
    try {
      setAnalyzingTranscript(true);
      setError('');
      
      const fullTranscript = transcript
        .map(entry => `[${formatTime(entry.start)}] ${entry.text}`)
        .join('\n');
      
      const response = await axios.post(getApiUrl('/analyze-transcript'), {
        transcript: fullTranscript
      });
      
      onAnalysisGenerated(response.data.analysis);
    } catch (error) {
      setError('Error analyzing transcript: ' + error.message);
    } finally {
      setAnalyzingTranscript(false);
    }
  };

  const handleCopy = (withTimestamps = true) => {
    if (!transcript.length) return;
    
    try {
      // Format the transcript text based on whether timestamps are included
      const formattedText = withTimestamps
        ? transcript.map(entry => `[${formatTime(entry.start)}] ${entry.text}`).join('\n')
        : transcript.map(entry => entry.text).join('\n');
      
      console.log(`Attempting to copy text to clipboard ${withTimestamps ? 'with' : 'without'} timestamps`);
      
      // Use async/await with try/catch for better error handling
      // This helps handle both secure (HTTPS) and non-secure contexts
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(formattedText)
          .then(() => {
            console.log('Text successfully copied to clipboard');
            if (withTimestamps) {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } else {
              setCopiedWithoutTimestamps(true);
              setTimeout(() => setCopiedWithoutTimestamps(false), 2000);
            }
          })
          .catch(err => {
            console.error('Clipboard API error:', err);
            fallbackCopyTextToClipboard(formattedText, withTimestamps);
          });
      } else {
        console.log('Clipboard API not available, using fallback');
        fallbackCopyTextToClipboard(formattedText, withTimestamps);
      }
    } catch (err) {
      console.error('Unexpected error during copy:', err);
      setError('Failed to copy transcript: ' + (err.message || 'Unknown error'));
    }
  };
  
  // Fallback method using document.execCommand('copy')
  const fallbackCopyTextToClipboard = (text, withTimestamps = true) => {
    try {
      // Create temporary element
      const textArea = document.createElement('textarea');
      textArea.value = text;
      
      // Make the textarea out of viewport
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      
      // Select and copy
      textArea.focus();
      textArea.select();
      
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (successful) {
        console.log('Fallback: Copying text successful');
        if (withTimestamps) {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } else {
          setCopiedWithoutTimestamps(true);
          setTimeout(() => setCopiedWithoutTimestamps(false), 2000);
        }
      } else {
        console.error('Fallback: Unable to copy');
        setError('Unable to copy text to clipboard');
      }
    } catch (err) {
      console.error('Fallback: Oops, unable to copy', err);
      setError('Failed to copy transcript: ' + (err.message || 'Unknown error'));
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {transcript.length > 0 && (
        <div className="border rounded-lg p-3 bg-white overflow-hidden">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-base font-bold">Transcript</h2>
            <div className="flex space-x-2">
              <button
                onClick={() => handleCopy(false)}
                className="flex items-center text-gray-500 hover:text-gray-700"
                title="Copy transcript without timestamps"
              >
                <CopyIcon className="w-4 h-4 mr-1" />
                {copiedWithoutTimestamps ? 'Copied!' : 'Copy Text Only'}
              </button>
              <button
                onClick={() => handleCopy(true)}
                className="flex items-center text-gray-500 hover:text-gray-700"
                title="Copy transcript with timestamps"
              >
                <CopyIcon className="w-4 h-4 mr-1" />
                {copied ? 'Copied!' : 'Copy with Timestamps'}
              </button>
            </div>
          </div>
          <div 
            className="h-[300px] overflow-y-auto space-y-0.5 scroll-smooth"
            ref={transcriptRef}
            style={{ scrollBehavior: 'smooth' }}
          >
            {transcript.map((item, index) => (
              <p 
                key={index} 
                className={`text-sm cursor-pointer hover:bg-gray-100 py-0.5 px-1 rounded ${
                  item.start <= currentTime && currentTime < (transcript[index + 1]?.start || Infinity)
                    ? 'bg-yellow-100'
                    : ''
                }`}
                onClick={() => onTimeClick(item.start)}
              >
                <span 
                  className="timestamp text-gray-500 font-mono"
                  data-time={item.start}
                >
                  {formatTime(item.start)}
                </span>
                : {item.text}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TranscriptViewer;