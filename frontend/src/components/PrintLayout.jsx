import React from 'react';

const PrintLayout = ({ 
  title,
  videoInfo,
  screenshots,
  transcriptAnalysis,
  transcript,
  queries
}) => {
  return (
    <div className="export-container">
      {/* Title Section */}
      <div className="print-section">
        <h1 className="export-title">{title}</h1>
        <div className="metadata">
          <h2>Video Information</h2>
          {videoInfo}
        </div>
      </div>

      {/* Screenshots & Queries Section */}
      {screenshots && screenshots.length > 0 && (
        <div className="print-section screenshot-section">
          <h2 className="export-subtitle">Screenshots & Notes</h2>
          {screenshots.map((group, index) => (
            <div key={index} className="screenshot-pair">
              {/* Query if it exists */}
              {group.query && (
                <div className="query-container">
                  <div className="query-text">Query:</div>
                  <div>{group.query}</div>
                </div>
              )}
              
              {/* Screenshots */}
              <div className="screenshot-container">
                <img 
                  src={group.image} 
                  alt={`Screenshot ${index + 1}`} 
                  className="screenshot-image"
                />
                <div className="screenshot-caption">
                  {group.timestamp && (
                    <div className="timestamp">[{formatTime(group.timestamp)}]</div>
                  )}
                  {group.caption && (
                    <div className="caption-content">{group.caption}</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Transcript Analysis Section */}
      {transcriptAnalysis && (
        <div className="print-section transcript-analysis-section">
          <h2 className="export-subtitle">Transcript Analysis</h2>
          <div className="transcript-analysis">{transcriptAnalysis}</div>
        </div>
      )}

      {/* Full Transcript Section */}
      {transcript && (
        <div className="print-section transcript-section">
          <h2 className="export-subtitle">Full Transcript</h2>
          <div className="transcript-content">{transcript}</div>
        </div>
      )}
    </div>
  );
};

const formatTime = (seconds) => {
  const date = new Date(seconds * 1000);
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  const secs = date.getUTCSeconds().toString().padStart(2, '0');
  
  if (hours > 0) {
    return `${hours}:${minutes}:${secs}`;
  }
  return `${minutes}:${secs}`;
};

export default PrintLayout;