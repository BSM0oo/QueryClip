import axios from 'axios';

// Define our own retry logic since we're not importing an external package
const axiosRetry = (axios, { retries = 3, retryDelay, retryCondition }) => {
  axios.interceptors.response.use(null, async (error) => {
    // Extract config and set retry count
    const config = error.config;
    config.retryCount = config.retryCount || 0;
    
    // Check if we should retry
    const shouldRetry = retryCondition(error) && config.retryCount < retries;
    
    if (shouldRetry) {
      config.retryCount += 1;
      // Calculate delay
      const delay = retryDelay(config.retryCount);
      // Wait for the delay
      await new Promise(resolve => setTimeout(resolve, delay));
      // Retry the request
      return axios(config);
    }
    
    // If we shouldn't retry, reject normally
    return Promise.reject(error);
  });
};

// IMPORTANT: Always use relative URLs to ensure requests go to the same server that served the page
// This ensures proper CORS behavior and works from any client machine
const API_BASE_URL = '/api';

// Log the API URL for debugging
console.log('API Base URL:', API_BASE_URL);

// Create an axios instance for API calls
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000, // Default 15-second timeout
});

// Apply our retry logic to the API instance
axiosRetry(api, {
  retries: 2,
  retryDelay: (retryCount) => retryCount * 2000, // 2s, 4s between retries
  retryCondition: (error) => {
    // Only retry on network errors or 5xx server errors
    return (
      (!error.response && error.request) || // Network errors
      (error.response && error.response.status >= 500) // Server errors
    );
  }
});

/**
 * Extracts a valid YouTube video ID from various URL formats or returns the ID directly
 * @param {string} input - URL or video ID
 * @returns {string} - YouTube video ID
 */
export const extractVideoId = (input) => {
  if (!input) return '';

  // Check if it's already a valid ID (11 characters)
  if (input.length === 11 && !input.includes('/')) {
    return input;
  }

  // Extract from YouTube URL formats
  let videoId = '';

  // youtube.com/watch?v=ID
  if (input.includes('youtube.com/watch')) {
    try {
      const url = new URL(input);
      videoId = url.searchParams.get('v') || '';
    } catch {
      // Invalid URL, try other formats
    }
  }
  // youtu.be/ID
  else if (input.includes('youtu.be/')) {
    const parts = input.split('youtu.be/');
    if (parts.length > 1) {
      videoId = parts[1].split('?')[0].split('&')[0];
    }
  }
  // youtube.com/embed/ID
  else if (input.includes('youtube.com/embed/')) {
    const parts = input.split('youtube.com/embed/');
    if (parts.length > 1) {
      videoId = parts[1].split('?')[0].split('&')[0];
    }
  }

  return videoId;
};

/**
 * Captures a screenshot with optional caption
 * @param {Object} options - Capture options
 * @returns {Promise<Object>} Screenshot data
 */
export const captureScreenshot = async ({
  player,
  videoId,
  timestamp,
  generateCaption = true,
  transcript = [],
  customPrompt = '',
  onPlayVideo = () => { },
  label = null,
  contextWindowSize = 30 // Default to 30 seconds if not specified
}) => {
  if (!player || !videoId) {
    throw new Error('Player or video ID not available');
  }

  try {
    // We no longer handle pausing/playing here - that's now in the parent component

    // Find context from transcript using the provided contextWindowSize
    const transcriptContext = Array.isArray(transcript)
      ? transcript
        .filter(item => Math.abs(item.start - timestamp) < contextWindowSize)
        .map(item => item.text)
        .join(' ')
      : '';

    console.log(`Capturing screenshot at ${timestamp} with caption=${generateCaption}, context window=${contextWindowSize}s, context length=${transcriptContext.length}`);

    // Prepare data for request
    const requestData = {
      video_id: videoId,
      timestamp,
      generate_caption: generateCaption,
      context: transcriptContext,
      custom_prompt: customPrompt,
    };

    // Add label data if provided
    if (label && label.text) {
      requestData.label = {
        text: label.text,
        fontSize: label.fontSize || 48,
        color: label.color || 'white'
      };
    }

    // Make API call with enhanced error handling and timeouts
    console.log('Sending screenshot capture request:', requestData);
    let response;
    
    try {
      // Set a longer timeout for screenshot capture (30 seconds) as it can take time
      response = await api.post('/capture-screenshot', requestData, {
        timeout: 30000, // 30 second timeout
        headers: {
          'X-Client-Timestamp': Date.now(), // Add client timestamp for debugging
        },
        // Add retry logic using axios-retry
        'axios-retry': {
          retries: 2,          // number of retries
          retryDelay: (retryCount) => {
            console.log(`Retry attempt ${retryCount} for screenshot capture`);
            return retryCount * 2000; // exponential backoff
          },
          retryCondition: (error) => {
            // Only retry on network errors or 5xx server errors
            return (
              !error.response && error.request || // Network errors don't have response but have request
              (error.response && error.response.status >= 500)
            );
          }
        }
      });
      console.log('Screenshot capture response:', response.data);
    } catch (error) {
      console.error('Screenshot capture network error:', error);
      // Throw a more specific error for better debugging
      if (error.code === 'ECONNABORTED') {
        throw new Error('Screenshot capture timed out - please try again or check your network connection');
      } else if (error.response) {
        // The server responded with an error status
        const errorMsg = error.response.data?.detail || error.response.statusText || error.message;
        throw new Error(`Server error during screenshot capture: ${errorMsg}`);
      } else if (error.request) {
        // No response received from the server
        throw new Error('Network error - no response from server. Please check your connection and try again.');
      } else {
        throw new Error(`Screenshot capture failed: ${error.message}`);
      }
    } finally {
      // Always allow for resuming video if needed, regardless of success/failure
      onPlayVideo();
    }

    // If we need to generate a caption but didn't get one, try a direct caption request
    if (generateCaption && !response.data.caption && !response.data.caption_error) {
      console.log('No caption in response, making direct caption request');
      try {
        const captionResponse = await api.post('/generate-caption', {
          timestamp,
          image_data: response.data.image_data.split(',')[1], // Remove the data URL prefix
          transcript_context: transcriptContext,
          prompt: customPrompt
        });
        
        console.log('Direct caption response:', captionResponse.data);
        response.data.caption = captionResponse.data.caption;
        if (captionResponse.data.caption_error) {
          response.data.caption_error = captionResponse.data.caption_error;
        }
      } catch (captionError) {
        console.error('Error in direct caption request:', captionError);
        response.data.caption_error = captionError.message;
      }
    }

    // Create screenshot object
    const screenshot = {
      id: `screenshot_${Date.now()}`,
      videoId,
      timestamp,
      image: response.data.image_data,
      caption: response.data.caption || '',
      transcriptContext,
      type: 'screenshot',
      content_type: response.data.content_type || 'other',
      createdAt: new Date().toISOString(),
      notes: ''
    };

    if (response.data.caption_error) {
      screenshot.captionError = response.data.caption_error;
    }

    return screenshot;

  } catch (error) {
    console.error('Error taking screenshot:', error);
    throw new Error(error?.response?.data?.detail || error.message || 'Failed to capture screenshot');
  }
};

export default {
  captureScreenshot,
  extractVideoId
};