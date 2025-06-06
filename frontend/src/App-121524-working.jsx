import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import YouTubePlayer from './YouTubePlayer';
import html2canvas from 'html2canvas'; // Add this import
import { API_BASE_URL } from './config';

// Add this style block to the top of your component, right after imports
const printStyles = `
  @media print {
    /* Hide everything by default */
    .main-content {
      display: none !important;
    }
    
    /* Only show print content when printing */
    .print-content {
      display: block !important;
    }

    /* Remove height limits and scrolling for print */
    .print-content .whitespace-pre-wrap {
      max-height: none !important;
      overflow: visible !important;
    }

    /* Ensure page breaks work properly */
    .page-break {
      break-before: page !important;
    }
  }
`;

const App = () => {
  // Initialize state from localStorage or use default values
  const [videoId, setVideoId] = useState(() => 
    localStorage.getItem('videoId') || ''
  );
  const [screenshots, setScreenshots] = useState(() => {
    const saved = localStorage.getItem('screenshots');
    return saved ? JSON.parse(saved) : [];
  });
  const [notes, setNotes] = useState(() => 
    localStorage.getItem('notes') || ''
  );
  const [transcript, setTranscript] = useState(() => {
    const saved = localStorage.getItem('transcript');
    return saved ? JSON.parse(saved) : [];
  });
  const [transcriptAnalysis, setTranscriptAnalysis] = useState(() => 
    localStorage.getItem('transcriptAnalysis') || ''
  );
  const [customPrompt, setCustomPrompt] = useState(() => 
    localStorage.getItem('customPrompt') || `Based on the following transcript context...`
  );

  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [processingScreenshot, setProcessingScreenshot] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [showPrompt, setShowPrompt] = useState(false); // Changed from true to false
  const [showTranscript, setShowTranscript] = useState(true);
  const transcriptRef = useRef(null);
  const [analyzingTranscript, setAnalyzingTranscript] = useState(false);
  const [screenshotMode, setScreenshotMode] = useState('single'); // 'single' or 'burst'
  const [burstCount, setBurstCount] = useState(3);
  const [burstInterval, setBurstInterval] = useState(2);
  const [isCapturing, setIsCapturing] = useState(false);
  const [showNotes, setShowNotes] = useState(true);
  const [visibleNotes, setVisibleNotes] = useState({});
  const [isPrinting, setIsPrinting] = useState(false);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('videoId', videoId);
  }, [videoId]);

  useEffect(() => {
    localStorage.setItem('screenshots', JSON.stringify(screenshots));
  }, [screenshots]);

  useEffect(() => {
    localStorage.setItem('notes', notes);
  }, [notes]);

  useEffect(() => {
    localStorage.setItem('transcript', JSON.stringify(transcript));
  }, [transcript]);

  useEffect(() => {
    localStorage.setItem('transcriptAnalysis', transcriptAnalysis);
  }, [transcriptAnalysis]);

  useEffect(() => {
    localStorage.setItem('customPrompt', customPrompt);
  }, [customPrompt]);

  // Add a clear data function
  const clearStoredData = () => {
    localStorage.clear();
    setVideoId('');
    setScreenshots([]);
    setNotes('');
    setTranscript([]);
    setTranscriptAnalysis('');
    setCustomPrompt(`Based on the following transcript context...`);
  };

  // Helper function to scroll transcript
  const scrollToTime = (time) => {
    const transcriptElement = transcriptRef.current;
    if (!transcriptElement) return;

    const timestampElements = transcriptElement.getElementsByClassName('timestamp');
    for (let element of timestampElements) {
      const elementTime = parseFloat(element.dataset.time);
      if (elementTime >= time) {
        const elementTop = element.offsetTop - transcriptElement.offsetTop;
        const scrollPosition = elementTop - transcriptElement.clientHeight / 2 + element.clientHeight / 2;

        transcriptElement.scrollTo({
          top: scrollPosition,
          behavior: 'smooth'
        });
        break;
      }
    }
  };

  // Update transcript scroll position based on video time
  useEffect(() => {
    if (player) {
      const interval = setInterval(() => {
        try {
          const time = player.getCurrentTime();
          setCurrentTime(time);
          scrollToTime(time);
        } catch (error) {
          console.error('Error getting current time:', error);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [player]);

  const extractVideoId = (url) => {
    const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    return match ? match[1] : url;
  };

  const handleVideoSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setScreenshots([]);
    
    try {
      const id = extractVideoId(videoId);
      if (id) {
        if (player) {
          player.loadVideoById(id);
        }

        const response = await axios.get(`${API_BASE_URL}/api/transcript/${id}`);
        setTranscript(response.data.transcript);
      }
    } catch (error) {
      setError('Error loading video or transcript: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayerReady = (ytPlayer) => {
    console.log('Player ready');
    setPlayer(ytPlayer);
  };

  const captureScreenshot = async () => {
    if (!player) return;
    
    try {
      setProcessingScreenshot(true);
      setError('');
      player.pauseVideo();
      const currentTime = player.getCurrentTime();

      try {
        // Get screenshot from server
        const screenshotResponse = await axios.post(`${API_BASE_URL}/api/capture-screenshot`, {
          video_id: extractVideoId(videoId),
          timestamp: currentTime
        });
        
        // Increase context window from 10 to 20 seconds
        const contextWindow = 20;

        // Add paragraph breaks between transcript entries
        const relevantTranscript = transcript
          .filter(entry => 
            entry.start >= currentTime - contextWindow &&
            entry.start <= currentTime + contextWindow
          )
          .map(entry => `[${formatTime(entry.start)}] ${entry.text}`)
          .join('\n\n');  // Use double line breaks for paragraph breaks

        // Generate caption
        const captionResponse = await axios.post(`${API_BASE_URL}/api/generate-caption`, {
          timestamp: currentTime,
          image_data: screenshotResponse.data.image_data,
          transcript_context: relevantTranscript,
          prompt: customPrompt
        });

        setScreenshots(prev => [...prev, {
          image: screenshotResponse.data.image_data,
          timestamp: currentTime,
          caption: captionResponse.data.caption,
          notes: '',
          transcriptContext: relevantTranscript
        }]);

      } catch (error) {
        setError('Failed to capture screenshot: ' + error.message);
        console.error('Screenshot error:', error);
      }

    } catch (error) {
      setError('Error processing screenshot: ' + error.message);
      console.error('Processing error:', error);
    } finally {
      setProcessingScreenshot(false);
      player.playVideo();
    }
  };

  const captureBurstScreenshots = async () => {
    if (!player) return;
    
    try {
      setIsCapturing(true);
      setProcessingScreenshot(true);
      setError('');
      player.pauseVideo();
      
      // Take multiple screenshots
      for (let i = 0; i < burstCount; i++) {
        const currentTime = player.getCurrentTime() + (i * burstInterval);
        player.seekTo(currentTime, true);
        
        // Wait for video to seek
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        try {
          const screenshotResponse = await axios.post(`${API_BASE_URL}/api/capture-screenshot`, {
            video_id: extractVideoId(videoId),
            timestamp: currentTime
          });
          
          const contextWindow = 20;
          const relevantTranscript = transcript
            .filter(entry => 
              entry.start >= currentTime - contextWindow &&
              entry.start <= currentTime + contextWindow
            )
            .map(entry => `[${formatTime(entry.start)}] ${entry.text}`)
            .join('\n\n');

          const captionResponse = await axios.post(`${API_BASE_URL}/api/generate-caption`, {
            timestamp: currentTime,
            image_data: screenshotResponse.data.image_data,
            transcript_context: relevantTranscript,
            prompt: customPrompt
          });

          setScreenshots(prev => [...prev, {
            image: screenshotResponse.data.image_data,
            timestamp: currentTime,
            caption: captionResponse.data.caption,
            notes: '',
            transcriptContext: relevantTranscript
          }]);

        } catch (error) {
          setError(`Failed to capture screenshot ${i + 1}: ${error.message}`);
        }
      }
    } catch (error) {
      setError('Error in burst capture: ' + error.message);
    } finally {
      setProcessingScreenshot(false);
      setIsCapturing(false);
      player.playVideo();
    }
  };

  const regenerateCaption = async (screenshotIndex) => {
    try {
      setProcessingScreenshot(true);
      const screenshot = screenshots[screenshotIndex];
      
      const response = await axios.post(`${API_BASE_URL}/api/generate-caption`, {
        timestamp: screenshot.timestamp,
        image_data: screenshot.image,
        transcript_context: screenshot.transcriptContext,
        prompt: customPrompt
      });

      const updatedScreenshots = [...screenshots];
      updatedScreenshots[screenshotIndex] = {
        ...screenshot,
        caption: response.data.caption
      };
      setScreenshots(updatedScreenshots);
    } catch (error) {
      setError('Error regenerating caption: ' + error.message);
    } finally {
      setProcessingScreenshot(false);
    }
  };

  const formatTime = (seconds) => {
    const date = new Date(seconds * 1000);
    return date.toISOString().substr(11, 8);
  };

  const handleTranscriptClick = (time) => {
    if (player && player.seekTo) {
      player.seekTo(time, true);
    }
  };

  const exportNotes = async (format = 'markdown') => {
    try {
      let content = `# Video Notes: ${videoId}\n\n`;
      content += `${notes}\n\n`;
      
      screenshots.forEach((screenshot, index) => {
        content += `## Screenshot ${index + 1}\n`;
        content += `![Screenshot ${index + 1}](${screenshot.image})\n\n`;
        content += `**Timestamp:** ${formatTime(screenshot.timestamp)}\n\n`;
        content += `**Caption:** ${screenshot.caption}\n\n`;
        
        // Clean up context format
        const cleanContext = screenshot.transcriptContext
          .split('\n\n')
          .map(line => line.replace(/\[\d{2}:\d{2}:\d{2}\]\s*/, '')) // Remove all timestamps
          .join(' ')
          .trim();
        
        content += `**Context:** ${cleanContext}\n\n`;
        
        if (screenshot.notes) {
          content += `**Notes:** ${screenshot.notes}\n\n`;
        }
        content += '---\n\n';
      });

      if (format === 'markdown') {
        const blob = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'notes.md';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else if (format === 'pdf') {
        const response = await axios.post(
          `${API_BASE_URL}/api/export-pdf`, 
          { content },
          { responseType: 'blob' }
        );
        const url = URL.createObjectURL(response.data);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'notes.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else if (format === 'rtf') {
        // Send content to backend to convert to RTF
        const response = await axios.post(
          `${API_BASE_URL}/api/export-rtf`, 
          { content },
          { responseType: 'blob' }
        );
        const url = URL.createObjectURL(new Blob([response.data], { type: 'application/rtf' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = 'notes.rtf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else if (format === 'html') {
        // Convert markdown to HTML
        const htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Video Notes: ${videoId}</title>
            <style>
              body { 
                font-family: system-ui, -apple-system, sans-serif;
                line-height: 1.6;
                max-width: 800px;
                margin: 0 auto;
                padding: 2rem;
              }
              img { max-width: 100%; height: auto; }
              hr { margin: 2rem 0; }
            </style>
          </head>
          <body>
            ${content.replace(/\n/g, '<br>')
                     .replace(/^# (.*)/gm, '<h1>$1</h1>')
                     .replace(/^## (.*)/gm, '<h2>$1</h2>')
                     .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                     .replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1">')}
          </body>
          </html>
        `;

        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'notes.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      setError('Error exporting notes: ' + error.message);
    }
  };

  const analyzeTranscript = async () => {
    if (!transcript.length) return;
    
    try {
      setAnalyzingTranscript(true);
      setError('');
      
      const fullTranscript = transcript
        .map(entry => `[${formatTime(entry.start)}] ${entry.text}`)
        .join('\n');
      
      const response = await axios.post(`${API_BASE_URL}/api/analyze-transcript`, {
        transcript: fullTranscript
      });
      
      setTranscriptAnalysis(response.data.analysis);
    } catch (error) {
      setError('Error analyzing transcript: ' + error.message);
    } finally {
      setAnalyzingTranscript(false);
    }
  };

  const toggleNotes = (index) => {
    setVisibleNotes(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  useEffect(() => {
    // Add print styles to document head
    const style = document.createElement('style');
    style.innerHTML = printStyles;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 100);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-4 sm:py-8">
        {/* Print content - hidden by default */}
        <div className="print-content" style={{ display: isPrinting ? 'block' : 'none' }}>
          <h1 className="text-2xl sm:text-3xl font-bold mb-4">YouTube Notes App</h1>
          <h2 className="text-xl mb-6">Video: {videoId}</h2>
          
          {notes && (
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-2">Notes:</h3>
              <div className="whitespace-pre-wrap">{notes}</div>
            </div>
          )}

          {screenshots.length > 0 && (
            <div className="space-y-8">
              {screenshots.map((screenshot, index) => (
                <div key={index} className="page-break">
                  <h3 className="font-bold text-xl mb-4">Screenshot {index + 1}</h3>
                  <img 
                    src={screenshot.image} 
                    alt={`Screenshot ${index + 1}`}
                    className="w-full rounded mb-4"
                  />
                  <p className="text-sm text-gray-600 mb-2">
                    Timestamp: {formatTime(screenshot.timestamp)}
                  </p>
                  {screenshot.caption && (
                    <div className="mb-4">
                      <h4 className="font-medium mb-2">Caption:</h4>
                      <div className="whitespace-pre-wrap">{screenshot.caption}</div>
                    </div>
                  )}
                  {screenshot.notes && (
                    <div className="mb-4">
                      <h4 className="font-medium mb-2">Notes:</h4>
                      <div className="whitespace-pre-wrap">{screenshot.notes}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {transcriptAnalysis && (
            <div className="page-break">
              <h3 className="text-xl font-bold mb-4">Generated Transcript Outline</h3>
              <div className="whitespace-pre-wrap">{transcriptAnalysis}</div>
            </div>
          )}
        </div>

        {/* Main content - visible by default */}
        <div className="main-content" style={{ display: isPrinting ? 'none' : 'block' }}>
          <div className="flex justify-between items-center mb-4 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold">YouTube Notes App</h1>
            <button
              onClick={clearStoredData}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
            >
              Clear All Data
            </button>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}
          
          <form onSubmit={handleVideoSubmit} className="mb-4 sm:mb-8">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
              <input
                type="text"
                value={videoId}
                onChange={(e) => setVideoId(e.target.value)}
                placeholder="Enter YouTube Video URL"
                className="flex-1 p-2 border rounded text-sm sm:text-base"
              />
              <button 
                type="submit" 
                className="w-full sm:w-auto bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Load Video'}
              </button>
            </div>
          </form>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8 mb-8">
            <div className="space-y-4">
              <div className="aspect-video bg-black rounded-lg overflow-hidden w-full">
                {videoId && (
                  <YouTubePlayer 
                    videoId={videoId}
                    onPlayerReady={handlePlayerReady}
                  />
                )}
              </div>
              
              <div className="space-y-2">
                <div className="bg-white rounded-lg p-4 border">
                  <div className="flex gap-4 mb-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={screenshotMode === 'single'}
                        onChange={() => setScreenshotMode('single')}
                        className="mr-2"
                      />
                      Single Screenshot
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={screenshotMode === 'burst'}
                        onChange={() => setScreenshotMode('burst')}
                        className="mr-2"
                      />
                      Burst Mode
                    </label>
                  </div>

                  {screenshotMode === 'burst' && (
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Number of Screenshots
                        </label>
                        <input
                          type="number"
                          min="2"
                          max="10"
                          value={burstCount}
                          onChange={(e) => setBurstCount(Number(e.target.value))}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Interval (seconds)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={burstInterval}
                          onChange={(e) => setBurstInterval(Number(e.target.value))}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        />
                      </div>
                    </div>
                  )}

                  <button
                    onClick={screenshotMode === 'single' ? captureScreenshot : captureBurstScreenshots}
                    className="w-full bg-green-500 text-white px-4 py-3 rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center justify-center gap-2"
                    disabled={processingScreenshot || !player || isCapturing}
                  >
                    {processingScreenshot ? (
                      <>
                        <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {screenshotMode === 'burst' ? 'Capturing Screenshots...' : 'Processing Screenshot...'}
                      </>
                    ) : (
                      `Take ${screenshotMode === 'burst' ? `${burstCount} Screenshots` : 'Screenshot'}`
                    )}
                  </button>
                </div>
                
                <button
                  onClick={analyzeTranscript}
                  disabled={!transcript.length || analyzingTranscript}
                  className="w-full bg-indigo-500 text-white px-4 py-3 rounded-lg hover:bg-indigo-600 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {analyzingTranscript ? (
                    <>
                      <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 1 1 0 16V12H0C0 5.373 5.373 0 12 0v4z"
                        ></path>
                      </svg>
                      Analyzing Transcript...
                    </>
                  ) : (
                    'Generate Transcript Outline'  // Changed text here
                  )}
                </button>

                {/* Move caption prompt here */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setShowPrompt(!showPrompt)}
                    className="text-gray-600 hover:text-gray-800"
                  >
                    {showPrompt ? 'Hide Caption Prompt' : 'Show Caption Prompt'}
                  </button>
                </div>

                {showPrompt && (
                  <div className="bg-white rounded-lg p-4 border">
                    <h2 className="text-lg font-bold mb-4">Caption Generation Prompt</h2>
                    <textarea
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      className="w-full h-32 p-2 border rounded mb-2"
                      placeholder="Enter custom prompt for caption generation..."
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold">Global Notes</h2>
                <button
                  onClick={() => setShowNotes(!showNotes)}
                  className="text-gray-600 hover:text-gray-800"
                >
                  {showNotes ? 'Hide Notes' : 'Show Notes'}
                </button>
              </div>
              
              {showNotes && (
                <div className="bg-white rounded-lg p-4 border">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add your notes here..."
                    className="w-full h-40 p-2 border rounded"
                  />
                  <div className="flex flex-col sm:flex-row gap-2 mt-4">
                    <button
                      onClick={() => exportNotes('markdown')}
                      className="w-full sm:flex-1 bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 text-sm sm:text-base"
                    >
                      Export as Markdown
                    </button>
                    <button
                      onClick={() => exportNotes('html')}
                      className="w-full sm:flex-1 bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 text-sm sm:text-base"
                    >
                      Save as HTML
                    </button>
                    <button
                      onClick={handlePrint}
                      className="w-full sm:flex-1 bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 text-sm sm:text-base"
                    >
                      Print / Save as PDF
                    </button>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setShowTranscript(!showTranscript)}
                  className="flex-1 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                >
                  {showTranscript ? 'Hide Transcript' : 'Show Transcript'}
                </button>
              </div>

              {showTranscript && transcript.length > 0 && (
                <div className="border rounded-lg p-4 bg-white overflow-hidden">
                  <h2 className="text-lg font-bold mb-4">Transcript</h2>
                  <div 
                    className="h-[300px] overflow-y-auto space-y-2 scroll-smooth"
                    ref={transcriptRef}
                    style={{ scrollBehavior: 'smooth' }}
                  >
                    {transcript.map((item, index) => (
                      <p 
                        key={index} 
                        className={`text-sm cursor-pointer hover:bg-gray-100 p-1 rounded ${
                          item.start <= currentTime && currentTime < (transcript[index + 1]?.start || Infinity)
                            ? 'bg-yellow-100'
                            : ''
                        }`}
                        onClick={() => handleTranscriptClick(item.start)}
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
          </div>
        </div>

        <div className="space-y-4">
          {screenshots.map((screenshot, index) => (
            <div key={index} className="bg-white border rounded-lg p-4">
              <h3 className="font-bold text-xl mb-4">Screenshot {index + 1}</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="relative">
                  <img 
                    src={screenshot.image} 
                    alt={`Screenshot ${index + 1}`}
                    className="w-full rounded"
                  />
                  <p className="text-sm text-gray-600 mt-2">
                    Timestamp: {formatTime(screenshot.timestamp)}
                  </p>
                </div>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Caption:</h4>
                    <textarea
                      value={screenshot.caption || ''}
                      onChange={(e) => {
                        const updatedScreenshots = [...screenshots];
                        updatedScreenshots[index] = {
                          ...screenshot,
                          caption: e.target.value
                        };
                        setScreenshots(updatedScreenshots);
                      }}
                      className="w-full p-2 border rounded min-h-[12rem] lg:min-h-[8rem] max-h-[20rem] h-auto resize-y"
                      placeholder="Screenshot caption..."
                    />
                    <button
                      onClick={() => regenerateCaption(index)}
                      disabled={processingScreenshot}
                      className="mt-2 text-sm bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 disabled:opacity-50"
                    >
                      Regenerate Caption
                    </button>
                  </div>
                  <div>
                    <div className="flex justify-between items-center">
                      <button
                        onClick={() => toggleNotes(index)}
                        className="text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        {visibleNotes[index] ? 'Hide Notes' : 'Add Notes'}
                      </button>
                    </div>
                    {visibleNotes[index] && (
                      <textarea
                        value={screenshot.notes || ''}
                        onChange={(e) => {
                          const updatedScreenshots = [...screenshots];
                          updatedScreenshots[index] = {
                            ...screenshot,
                            notes: e.target.value
                          };
                          setScreenshots(updatedScreenshots);
                        }}
                        placeholder="Add notes for this screenshot..."
                        className="w-full p-2 border rounded h-32 mt-2"
                      />
                    )}
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Context:</h4>
                    <p className="text-sm text-gray-700 italic">
                      {screenshot.transcriptContext}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Modified transcript analysis section */}
        {transcriptAnalysis && (
          <div className="bg-white rounded-lg p-6 border mt-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Generated Transcript Outline</h2>
              <button
                onClick={() => setTranscriptAnalysis('')}
                className="text-red-500 hover:text-red-700"
              >
                Clear Outline
              </button>
            </div>
            {/* Keep scroll for screen view, print styles will override */}
            <div className={`prose max-w-none whitespace-pre-wrap ${
              !isPrinting ? 'max-h-[50vh] overflow-y-auto' : ''
            }`}>
              {transcriptAnalysis}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default App;