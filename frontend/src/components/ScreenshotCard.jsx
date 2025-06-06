import React, { useState } from 'react';
import { getContentTypeIcon } from '../utils/iconUtils.jsx';
import ReactMarkdown from 'react-markdown';

const ScreenshotCard = ({
  screenshot,
  index,
  editMode,
  onUpdateNotes,
  onUpdateCaption,
  onRegenerateCaption,
  onDeleteScreenshot,
  expanded,
  onToggleExpand
}) => {
  const [showNotes, setShowNotes] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false); // Default to hiding transcript

  const parseStructuredCaption = (caption) => {
    try {
      if (!caption) return { isMarkdown: false, rawCaption: '', topic: '', context: '', points: [] };
      
      // Pre-process the caption to fix bullet point formatting if needed
      const formattedCaption = formatBulletPoints(caption);
      
      // Check if the caption appears to be in bullet point format with proper spacing
      const bulletPointRegex = /(\*|\-|•)\s+.+(\n\s*\n\s*(\*|\-|•)\s+.+)+/;
      if (bulletPointRegex.test(formattedCaption) || 
          (formattedCaption.includes('* ') && formattedCaption.includes('\n\n'))) {
        return {
          isMarkdown: true,
          rawCaption: formattedCaption,
          topic: '',
          context: '',
          points: []
        };
      }
      
      // Check if it's the old format with TOPIC HEADING/CONTEXT/KEY POINTS
      if (formattedCaption.includes('TOPIC HEADING:') || formattedCaption.includes('KEY POINTS:')) {
        // This is the old format - parse it and convert to markdown
        const parts = formattedCaption.split('\n\n').filter(Boolean);
        
        let topic = '';
        let context = '';
        let keyPointsText = '';
        
        // Parse the structured parts
        for (const part of parts) {
          if (part.startsWith('TOPIC HEADING:')) {
            topic = part.replace('TOPIC HEADING:', '').trim();
          } else if (part.startsWith('CONTEXT:')) {
            context = part.replace('CONTEXT:', '').trim();
          } else if (part.startsWith('KEY POINTS:')) {
            keyPointsText = part.replace('KEY POINTS:', '').trim();
          }
        }
        
        // Extract bullet points from KEY POINTS and format them properly
        let formattedMarkdown = '';
        
        if (topic) {
          formattedMarkdown += `## ${topic}\n\n`;
        }
        
        if (context) {
          formattedMarkdown += `${context}\n\n`;
        }
        
        if (keyPointsText) {
          // For dealing with bullet points that are all on one line with no proper breaks
          // Look for patterns like "• point 1 • point 2 • point 3"
          const bulletPointRegex = /•\s+([^•]+?)(?=\s+•|\s*$)/g;
          let match;
          const points = [];
          
          // Try to extract bullet points using regex
          while ((match = bulletPointRegex.exec(keyPointsText)) !== null) {
            if (match[1] && match[1].trim()) {
              points.push(match[1].trim());
            }
          }
          
          // If we found points using the regex, format them
          if (points.length > 0) {
            formattedMarkdown += points.map(point => `* ${point}`).join('\n\n');
          } else {
            // Fallback to simple splitting if regex didn't find matches
            // This handles both newline-separated points and single-line points
            const splitPoints = keyPointsText
              .split(/•/)
              .filter(Boolean)
              .map(point => point.trim())
              .filter(point => point.length > 0);
              
            formattedMarkdown += splitPoints.map(point => `* ${point}`).join('\n\n');
          }
        }
        
        return {
          isMarkdown: true,
          rawCaption: formattedMarkdown,
          topic: '',
          context: '',
          points: []
        };
      }
      
      // Fall back to the old parser for backward compatibility
      const parts = formattedCaption.split('\n\n').filter(Boolean);
      return {
        isMarkdown: false,
        rawCaption: formattedCaption,
        topic: parts[0]?.replace('TOPIC HEADING: ', '').trim(),
        context: parts[1]?.replace('CONTEXT: ', '').trim(),
        points: parts[2]?.replace('KEY POINTS: ', '')
          .split('\n')
          .filter(point => point.trim())
          .map(point => point.trim().replace(/^[•-]\s*/, ''))
      };
    } catch (error) {
      console.error('Error parsing caption:', error);
      return { 
        isMarkdown: false,
        rawCaption: caption,
        topic: '', 
        context: '', 
        points: [] 
      };
    }
  };

  const formatBulletPoints = (text) => {
    // This function adds proper line breaks between bullet points
    // particularly when they're scrunched together on one line
    
    if (!text) return '';
    
    // First, detect if this is a KEY POINTS section
    if (text.includes('KEY POINTS:')) {
      const parts = text.split('KEY POINTS:');
      if (parts.length < 2) return text;
      
      const header = parts[0];
      const keyPointsSection = parts[1];
      
      // Extract bullet points using regex
      const bulletPointRegex = /•\s+([^•]+?)(?=\s+•|\s*$)/g;
      let match;
      const points = [];
      let formattedKeyPoints = '';
      
      // Try to extract bullet points using regex
      while ((match = bulletPointRegex.exec(keyPointsSection)) !== null) {
        if (match[1] && match[1].trim()) {
          points.push(match[1].trim());
        }
      }
      
      // If we found points using regex, format them with line breaks
      if (points.length > 0) {
        formattedKeyPoints = points.map(point => `• ${point}`).join('\n');
        return `${header}KEY POINTS:\n${formattedKeyPoints}`;
      }
    }
    
    // General case for any text with bullet points
    // Split the text by bullet point markers and reformat with line breaks
    const lines = text.split(/([•*-]\s+[^•*-]+)/).filter(Boolean);
    if (lines.length <= 1) return text;
    
    // Rejoin with line breaks between bullet points
    return lines.join('\n');
  };

  const formatTranscript = (transcriptContext) => {
    if (!transcriptContext) return 'No transcript context available';
    return transcriptContext
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .join(' ');
  };

  const { isMarkdown, rawCaption, topic, context, points } = parseStructuredCaption(screenshot.caption);

  return (
    <div className={`bg-white rounded-lg shadow-md overflow-hidden print:shadow-none print:border-t print:border-gray-200 print:w-full print:max-w-none print:first:border-t-0 ${expanded ? 'col-span-2' : ''}`}>
      <div className="relative">
        <img 
          src={screenshot.image} 
          alt={`Screenshot ${index + 1}`}
          className={`w-full object-cover ${expanded ? 'max-h-[600px]' : 'max-h-[300px]'} print:object-contain print:max-h-[400px] print:w-auto print:mx-auto`}
          onClick={onToggleExpand}
          loading="lazy"
        />
        <div className="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-sm print:text-black print:bg-transparent">
          {new Date(screenshot.timestamp * 1000).toISOString().substr(11, 8)}
        </div>
        {screenshot.content_type && (
          <div className="absolute top-2 left-2">
            {getContentTypeIcon(screenshot.content_type)}
          </div>
        )}
      </div>
      
      <div className="p-6 space-y-4 print:px-0 print:py-4">
        {editMode ? (
          <textarea
            value={screenshot.caption}
            onChange={(e) => onUpdateCaption(index, e.target.value)}
            className="w-full min-h-[200px] p-3 border rounded-md resize-y text-sm font-sans"
            placeholder="Caption text..."
          />
        ) : (
          <div className="space-y-4">
            {isMarkdown ? (
              <div className="prose prose-sm max-w-none markdown-content">
                <ReactMarkdown
                  components={{
                    ul: ({node, ...props}) => (
                      <ul className="list-disc pl-4 space-y-1 mb-4" {...props} />
                    ),
                    li: ({node, ...props}) => (
                      <li className="ml-4" {...props} />
                    ),
                    h2: ({node, ...props}) => (
                      <h2 className="text-lg font-bold mt-4 mb-2" {...props} />
                    ),
                    h3: ({node, ...props}) => (
                      <h3 className="text-md font-bold mt-3 mb-2" {...props} />
                    ),
                    p: ({node, ...props}) => (
                      <p className="mb-4" {...props} />
                    ),
                    strong: ({node, ...props}) => (
                      <strong className="font-bold" {...props} />
                    )
                  }}
                >
                  {rawCaption}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="prose prose-sm max-w-none">
                {topic && (
                  <h3 className="text-lg font-bold text-gray-900 mb-3">{topic}</h3>
                )}
                {context && (
                  <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded mb-4">
                    <p className="text-blue-900">{context}</p>
                  </div>
                )}
                {points && points.length > 0 && (
                  <div className="mt-2">
                    <ul className="space-y-2 list-disc pl-4">
                      {points.map((point, i) => (
                        <li key={i} className="text-gray-800">
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            {showTranscript && screenshot.transcriptContext && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200 print:bg-white print:border-gray-300">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Transcript Context:</h4>
                <p className="text-sm text-gray-600 font-sans print:text-gray-800">
                  {formatTranscript(screenshot.transcriptContext)}
                </p>
              </div>
            )}
          </div>
        )}
        
        <div className="flex flex-wrap items-center gap-4 print:hidden">
          <button
            onClick={() => setShowNotes(!showNotes)}
            className="text-gray-600 hover:text-gray-800"
          >
            {showNotes ? 'Hide Notes' : 'Show Notes'}
          </button>
          {screenshot.transcriptContext && (
            <button
              onClick={() => setShowTranscript(!showTranscript)}
              className="text-gray-600 hover:text-gray-800"
            >
              {showTranscript ? 'Hide Transcript' : 'Show Transcript'}
            </button>
          )}
          <button
            onClick={() => onRegenerateCaption(index)}
            className="text-gray-600 hover:text-gray-800"
          >
            Regenerate Caption
          </button>
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to delete this screenshot?')) {
                onDeleteScreenshot(index);
              }
            }}
            className="text-red-600 hover:text-red-800"
          >
            Delete
          </button>

        </div>

        {showNotes && (
          <textarea
            value={screenshot.notes || ''}
            onChange={(e) => onUpdateNotes(index, e.target.value)}
            placeholder="Add notes..."
            className="w-full min-h-[100px] p-3 border rounded-md resize-y print:hidden"
          />
        )}
      </div>
    </div>
  );
};

export default ScreenshotCard;