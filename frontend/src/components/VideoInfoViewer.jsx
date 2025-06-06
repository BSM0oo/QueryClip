/**
 * This is a React component called VideoInfoViewer that displays information about a video.
 * 
 * Features:
 * - Takes a videoInfo prop containing video data like title, chapters, links, and description
 * - Includes a collapsible interface (show/hide functionality) using the isVisible state
 * 
 * When expanded, it displays:
 * - Video title
 * - Chapter list with timestamps (if available)
 * - Links found in the description (if any)
 * - Full video description
 * 
 * Component features:
 * - Clean formatting with Tailwind CSS classes
 * - Timestamps formatted as minutes:seconds
 * - Links that open in new tabs
 * - Pre-formatted description text that preserves whitespace
 */

import React, { useState } from 'react';

const VideoInfoViewer = ({ videoInfo }) => {
  const [isVisible, setIsVisible] = useState(true);

  if (!videoInfo) return null;

  return (
    <div className="bg-white rounded-lg p-6 border mt-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Video Information</h2>
        <button
          onClick={() => setIsVisible(!isVisible)}
          className="text-gray-600 hover:text-gray-800"
        >
          {isVisible ? 'Hide Info' : 'Show Info'}
        </button>
      </div>

      {isVisible && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-2">Title</h3>
            <p className="text-gray-700">{videoInfo.title}</p>
          </div>

          {videoInfo.chapters && videoInfo.chapters.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-2">Chapters</h3>
              <ul className="space-y-2">
                {videoInfo.chapters.map((chapter, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-gray-500 min-w-[60px]">
                      {Math.floor(chapter.start_time / 60)}:{String(chapter.start_time % 60).padStart(2, '0')}
                    </span>
                    <span className="ml-4">{chapter.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {videoInfo.links && videoInfo.links.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-2">Links from Description</h3>
              <ul className="list-disc list-inside space-y-1">
                {videoInfo.links.map((link, index) => (
                  <li key={index}>
                    <a 
                      href={link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 break-all"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h3 className="text-lg font-semibold mb-2">Description</h3>
            <pre className="whitespace-pre-wrap text-gray-700 font-sans">
              {videoInfo.description}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoInfoViewer;
