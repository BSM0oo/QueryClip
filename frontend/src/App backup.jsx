import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import html2canvas from 'html2canvas';

const App = () => {
  const [videoId, setVideoId] = useState('');
  const [screenshots, setScreenshots] = useState([]);
  const [notes, setNotes] = useState('');
  const [player, setPlayer] = useState(null);
  const [transcript, setTranscript] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [processingScreenshot, setProcessingScreenshot] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [customPrompt, setCustomPrompt] = useState(
    `Based on the following transcript context from a YouTube video, generate a concise and informative caption for a screenshot taken at this timestamp.
    Generate a caption that:
    1. Describes the key point or action being discussed
    2. Includes any relevant technical terms or concepts
    3. Is clear and informative without the surrounding context`
  );
  const playerRef = useRef(null);
  const transcriptRef = useRef(null);

  // Helper function to scroll transcript
  const scrollToTime = (time) => {
    const transcriptElement = transcriptRef.current;
    if (!transcriptElement) return;

    const timestampElements = transcriptElement.getElementsByClassName('timestamp');
    for (let element of timestampElements) {
      const elementTime = parseFloat(element.dataset.time);
      if (elementTime >= time) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

  const initializePlayer = (videoId) => {
    if (!videoId) return;
    
    if (window.YT) {
      const newPlayer = new window.YT.Player('player', {
        height: '360',
        width: '640',
        videoId: videoId,
        playerVars: {
          playsinline: 1,
          controls: 1,
          modestbranding: 1,
        },
        events: {
          onReady: (event) => {
            console.log('Player ready');
            setPlayer(event.target);
          },
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.PLAYING || 
                event.data === window.YT.PlayerState.PAUSED) {
              setCurrentTime(event.target.getCurrentTime());
            }
          }
        }
      });
    }
  };

  useEffect(() => {
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      if (videoId) {
        initializePlayer(videoId);
      }
    };

    return () => {
      // Cleanup
      if (player && player.destroy) {
        player.destroy();
      }
    };
  }, []);

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
        } else {
          initializePlayer(id);
        }

        const response = await axios.get(`http://localhost:8000/api/transcript/${id}`);
        setTranscript(response.data.transcript);
      }
    } catch (error) {
      setError('Error loading video or transcript: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const captureScreenshot = async () => {
    if (!player) return;
    
    try {
      setProcessingScreenshot(true);
      player.pauseVideo();

      // Wait for the video to actually pause
      await new Promise(resolve => setTimeout(resolve, 500));

      const videoFrame = document.querySelector('#player iframe');
      if (!videoFrame) {
        throw new Error('Video frame not found');
      }

      // Get the video dimensions
      const width = videoFrame.clientWidth;
      const height = videoFrame.clientHeight;

      const canvas = await html2canvas(videoFrame, {
        useCORS: true,
        logging: true,
        width: width,
        height: height,
        scale: 1,
        allowTaint: true,
        foreignObjectRendering: true
      });
      
      const imageData = canvas.toDataURL('image/png');
      const currentTime = player.getCurrentTime();

      const contextWindow = 10;
      const relevantTranscript = transcript
        .filter(entry => 
          entry.start >= currentTime - contextWindow &&
          entry.start <= currentTime + contextWindow
        )
        .map(entry => entry.text)
        .join(' ');

      const captionResponse = await axios.post('http://localhost:8000/api/generate-caption', {
        timestamp: currentTime,
        image_data: imageData,
        transcript_context: relevantTranscript,
        prompt: customPrompt
      });

      setScreenshots(prev => [...prev, {
        image: imageData,
        timestamp: currentTime,
        caption: captionResponse.data.caption,
        notes: '',
        transcriptContext: relevantTranscript
      }]);

      // Resume playback
      player.playVideo();
    } catch (error) {
      setError('Error capturing screenshot: ' + error.message);
      console.error('Screenshot error:', error);
    } finally {
      setProcessingScreenshot(false);
    }
  };

  const regenerateCaption = async (screenshotIndex) => {
    try {
      setProcessingScreenshot(true);
      const screenshot = screenshots[screenshotIndex];
      
      const response = await axios.post('http://localhost:8000/api/generate-caption', {
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
        content += `**Timestamp:** ${formatTime(screenshot.timestamp)}\n`;
        content += `**Caption:** ${screenshot.caption}\n`;
        content += `**Context:** ${screenshot.transcriptContext}\n`;
        if (screenshot.notes) {
          content += `**Notes:** ${screenshot.notes}\n`;
        }
        content += '\n---\n\n';
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
      } else {
        const response = await axios.post(
          'http://localhost:8000/api/export-pdf', 
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
      }
    } catch (error) {
      setError('Error exporting notes: ' + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">YouTube Notes App</h1>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        <form onSubmit={handleVideoSubmit} className="mb-8">
          <div className="flex gap-4">
            <input
              type="text"
              value={videoId}
              onChange={(e) => setVideoId(e.target.value)}
              placeholder="Enter YouTube Video URL"
              className="flex-1 p-2 border rounded"
            />
            <button 
              type="submit" 
              className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Load Video'}
            </button>
          </div>
        </form>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="aspect-video bg-black rounded-lg overflow-hidden">
              <div id="player" ref={playerRef}></div>
            </div>
            
            <button
              onClick={captureScreenshot}
              className="w-full bg-green-500 text-white px-4 py-3 rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center justify-center gap-2"
              disabled={processingScreenshot || !player}
            >
              {processingScreenshot ? (
                <>
                  <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing Screenshot...
                </>
              ) : (
                'Take Screenshot'
              )}
            </button>

            <div className="bg-white rounded-lg p-4 border">
              <h2 className="text-lg font-bold mb-4">Caption Generation Prompt</h2>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                className="w-full h-32 p-2 border rounded mb-2"
                placeholder="Enter custom prompt for caption generation..."
              />
            </div>

            {transcript.length > 0 && (
              <div className="border rounded-lg p-4 bg-white">
                <h2 className="text-lg font-bold mb-4">Transcript</h2>
                <div className="h-[300px] overflow-y-auto space-y-2" ref={transcriptRef}>
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

          <div className="space-y-4">
            <div className="bg-white rounded-lg p-4 border">
              <h2 className="text-lg font-bold mb-4">Global Notes</h2>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add your notes here..."
                className="w-full h-40 p-2 border rounded"
              />
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => exportNotes('markdown')}
                  className="flex-1 bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600"
                >
                  Export as Markdown
                </button>
                <button
                  onClick={() => exportNotes('pdf')}
                  className="flex-1 bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600"
                >
                  Export as PDF
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {screenshots.map((screenshot, index) => (
                <div key={index} className="bg-white border rounded-lg p-4">
                  <h3 className="font-bold text-lg mb-2">Screenshot {index + 1}</h3>
                  <div className="relative">
                    <img 
                      src={screenshot.image} 
                      alt={`Screenshot ${index + 1}`}
                      className="w-full rounded mb-4"
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">
                      Timestamp: {formatTime(screenshot.timestamp)}
                    </p>
                    <div className="space-y-2">
                      <h4 className="font-medium">Caption:</h4>
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
                        className="w-full p-2 border rounded"
                        rows={3}
                        placeholder="Screenshot caption..."
                      />
                      <button
                        onClick={() => regenerateCaption(index)}
                        disabled={processingScreenshot}
                        className="text-sm bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 disabled:opacity-50"
                      >
                        Regenerate Caption
                      </button>
                    </div>
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
                      className="w-full mt-2 p-2 border rounded"
                      rows={3}
                    />
                    <div className="mt-2">
                      <h4 className="font-medium text-sm">Context:</h4>
                      <p className="text-sm text-gray-700 italic">
                        {screenshot.transcriptContext}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;