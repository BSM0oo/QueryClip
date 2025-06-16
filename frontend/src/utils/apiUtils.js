import axios from 'axios';
import { getApiUrl, isDevelopment } from '../config';

// Create an axios instance with the correct base URL
// During development, use '' as baseURL since we're using relative paths
// and getApiUrl() already adds the /api prefix
const api = axios.create({
  baseURL: '', // Empty baseURL since we add paths in the request URLs
  timeout: 30000, // 30-second timeout for requests
});

// Update API base URL when server config is loaded
export const updateApiBaseUrl = (port) => {
  console.log(`Updating API base URL with port: ${port}`);
  // No need to update axios instance since we're using getApiUrl for all requests
};

// Log the API configuration for debugging
console.log('API Utils initialized with:', { 
  developmentMode: isDevelopment,
  timeout: 30000
});

// Add retry logic for API calls to increase reliability
api.interceptors.response.use(undefined, async (error) => {
  const { config, response } = error;

  if (!config || config._retry) {
    return Promise.reject(error);
  }

  // Configure retry count
  config._retryCount = config._retryCount || 0;
  const maxRetries = config.url.includes('/state/') ? 3 : 1; // More retries for state operations

  if (config._retryCount >= maxRetries) {
    return Promise.reject(error);
  }

  // Only retry on network errors, server errors (5xx), or rate limiting (429)
  const shouldRetry = !response || 
                      response.status >= 500 || 
                      response.status === 429 ||
                      config.url.includes('/state/'); // Always retry state operations

  if (shouldRetry) {
    config._retryCount += 1;
    
    // Exponential backoff delay
    const delay = Math.pow(2, config._retryCount) * 300 + Math.random() * 500;
    console.log(`Retrying request to ${config.url} (attempt ${config._retryCount} of ${maxRetries}) after ${delay}ms`);
    
    return new Promise(resolve => {
      setTimeout(() => resolve(api(config)), delay);
    });
  }

  return Promise.reject(error);
});

// Fetches transcript for a video
export const fetchTranscript = async (videoId) => {
  try {
    console.log(`Fetching transcript for video ${videoId}`);
    const response = await api.get(getApiUrl(`/transcript/${videoId}`));
    console.log(`Transcript received with ${response.data?.transcript?.length || 0} entries`);
    return response.data;
  } catch (error) {
    console.error('Error fetching transcript:', error);
    throw error;
  }
};

/**
 * Captures a screenshot from a video
 * @param {string} videoId - The YouTube video ID
 * @param {number} timestamp - The timestamp in seconds
 * @param {boolean} generateCaption - Whether to generate a caption for the screenshot
 * @returns {Promise<Object>} - The response containing the screenshot data
 */
export const captureScreenshot = async (videoId, timestamp, generateCaption = true, content_type = null) => {
  try {
    // No need to modify this function as the pausing logic is handled in EnhancedScreenshotManager
    const response = await api.post(getApiUrl('/capture-screenshot'), {
      video_id: videoId,
      timestamp,
      generate_caption: generateCaption,
      content_type: content_type || null
    });
    return response.data;
  } catch (error) {
    console.error('Error capturing screenshot:', error);
    throw error;
  }
};

// Generates a caption for a screenshot
export const generateCaption = async (timestamp, imageData, transcriptContext, prompt = null, model) => {
  try {
    const response = await api.post(getApiUrl('/generate-caption'), {
      timestamp,
      image_data: imageData,
      transcript_context: transcriptContext,
      prompt,
      model,
    });
    return response.data;
  } catch (error) {
    console.error('Error generating caption:', error);
    throw error;
  }
};

// Queries the transcript with a prompt
export const queryTranscript = async (transcript, prompt, videoId = null, model) => {
  try {
    const response = await api.post(getApiUrl('/query-transcript'), {
      transcript,
      prompt,
      videoId, // Include videoId to save to history
      model,
    });
    return response.data;
  } catch (error) {
    console.error('Error querying transcript:', error);
    throw error;
  }
};

// Clears server state
export const clearServerState = async (eraseFiles = false) => {
  try {
    const response = await api.delete(getApiUrl(`/state/clear?eraseFiles=${eraseFiles}`));
    return response.data;
  } catch (error) {
    console.error('Error clearing server state:', error);
    throw error;
  }
};

// Loads server state with retries
export const loadState = async () => {
  try {
    console.log('Loading state from server...');
    const response = await api.get(getApiUrl('/state/load'));
    console.log('State loaded successfully');
    return response.data;
  } catch (error) {
    console.error('Error loading state after all retries:', error);
    // Return empty state rather than throwing
    return { state: null };
  }
};

// Saves server state with retries
export const saveState = async (state) => {
  try {
    if (!state) {
      console.error('Attempted to save null or undefined state');
      return { success: false, error: 'Invalid state object' };
    }
    
    console.log(`Saving state to server with ${state.screenshots?.length || 0} screenshots`);
    
    // Add timestamp if not present
    const stateToSave = {
      ...state,
      timestamp: state.timestamp || Date.now()
    };
    
    const response = await api.post(getApiUrl('/state/save'), stateToSave);
    console.log('State saved successfully');
    return response.data;
  } catch (error) {
    console.error('Error saving state after all retries:', error);
    // Try to save again with a reduced payload if the error might be related to payload size
    if (error.response && (error.response.status === 413 || error.response.status === 500) && state.screenshots) {
      try {
        console.warn('Attempting to save with reduced screenshot data...');
        
        // Create a copy with smaller screenshots (just metadata, no images)
        const reducedState = {
          ...state,
          screenshots: state.screenshots.map(screenshot => ({
            ...screenshot,
            // Remove image data if it's base64
            image: screenshot.image && screenshot.image.startsWith('data:') 
              ? `reduced_${Date.now()}.png` 
              : screenshot.image
          }))
        };
        
        const retryResponse = await api.post(getApiUrl('/state/save'), reducedState);
        console.log('State saved with reduced payload');
        return retryResponse.data;
      } catch (retryError) {
        console.error('Error saving reduced state:', retryError);
      }
    }
    
    return { success: false, error: error.message };
  }
};

// Gets video information
export const getVideoInfo = async (videoId) => {
  try {
    const response = await api.get(getApiUrl(`/video-info/${videoId}`));
    return response.data;
  } catch (error) {
    console.error('Error getting video info:', error);
    throw error;
  }
};

// Add this alias for components that are using fetchVideoInfo
export const fetchVideoInfo = getVideoInfo;

// Video History API functions
export const getVideoHistory = async () => {
  try {
    const response = await api.get(getApiUrl('/video-history'));
    return response.data;
  } catch (error) {
    console.error('Error fetching video history:', error);
    throw error;
  }
};

export const getVideoHistoryItem = async (videoId) => {
  try {
    const response = await api.get(getApiUrl(`/video-history/${videoId}`));
    return response.data;
  } catch (error) {
    console.error(`Error fetching video history for ${videoId}:`, error);
    throw error;
  }
};

export const addOrUpdateVideoHistory = async (videoHistoryItem) => {
  try {
    const response = await api.post(getApiUrl('/video-history'), videoHistoryItem);
    return response.data;
  } catch (error) {
    console.error('Error adding/updating video history:', error);
    throw error;
  }
};

export const deleteVideoHistoryItem = async (videoId) => {
  try {
    const response = await api.delete(getApiUrl(`/video-history/${videoId}`));
    return response.data;
  } catch (error) {
    console.error(`Error deleting video history for ${videoId}:`, error);
    throw error;
  }
};

// Saves video information to Notion database
export const saveToNotion = async (title, videoId, data = {}) => {
  try {
    const response = await api.post(getApiUrl('/save-to-notion'), {
      title,
      videoId,
      author: data.author || 'QueryClip',
      publisher: data.publisher || 'QueryClip',
      description: data.description || '',
      transcript: data.transcript || [],
      notes: data.notes || '',
      screenshots: data.screenshots || [],
      transcriptAnalysis: data.transcriptAnalysis || {}
    });
    return response.data;
  } catch (error) {
    console.error('Error saving to Notion:', error);
    throw error;
  }
};

// Analyzes transcript
export const analyzeTranscript = async (transcript, videoId = null, model) => {
  try {
    console.log(`Analyzing transcript with videoId: ${videoId || 'none'}`);
    const response = await api.post(getApiUrl('/analyze-transcript'), {
      transcript,
      videoId,  // Include videoId so it can be saved to history
      model,
    });
    
    // If we have a videoId but no direct save from backend, save it here
    if (videoId && response.data.analysis) {
      try {
        // Get current history item
        const historyItem = await getVideoHistoryItem(videoId).catch(() => null);
        
        if (historyItem) {
          // Update history item with transcript analysis
          await addOrUpdateVideoHistory({
            ...historyItem,
            transcriptAnalysis: response.data.analysis,
            lastAccessedAt: new Date().toISOString()
          });
          
          console.log('Updated history with transcript analysis via frontend');
        }
      } catch (historyError) {
        console.error('Error updating history with transcript analysis:', historyError);
      }
    }
    
    return response.data;
  } catch (error) {
    console.error('Error analyzing transcript:', error);
    throw error;
  }
};

// Captures a GIF from a video
export const captureGif = async (videoId, startTime, duration = 3.0, fps = 10, width = 480) => {
  try {
    const response = await api.post(getApiUrl('/capture-gif'), {
      video_id: videoId,
      start_time: startTime,
      duration,
      fps,
      width,
    });
    return response.data;
  } catch (error) {
    console.error('Error capturing GIF:', error);
    throw error;
  }
};

// New function to explicitly save all content to history
export const saveAllContentToHistory = async (videoId, contentData) => {
  try {
    if (!videoId) {
      console.error('Cannot save to history - no videoId provided');
      return;
    }
    
    // Get the current history item if it exists
    const historyItem = await getVideoHistoryItem(videoId).catch(() => null);
    
    // Prepare data to save
    const {
      transcript,
      transcriptAnalysis,
      notes,
      screenshotCount,
      screenshotCaptions,
      queryAnswers,
      chapters
    } = contentData;
    
    // Create update object with only the fields that have values
    const updateData = {
      id: videoId, // Required field in VideoHistoryItem model
      videoId,
      title: contentData.title || "Untitled Video", // Make sure title is always provided
      lastAccessedAt: new Date().toISOString(),
      ...(transcript ? { transcript } : {}),
      ...(transcriptAnalysis ? { transcriptAnalysis } : {}),
      ...(notes ? { notes } : {}),
      ...(screenshotCount !== undefined ? { screenshotCount } : {}),
      ...(screenshotCaptions ? { screenshotCaptions } : {}),
      ...(queryAnswers ? { queryAnswers } : {}),
      ...(chapters ? { chapters } : {})
    };
    
    // If we have existing history, merge with it
    if (historyItem) {
      await addOrUpdateVideoHistory({
        ...historyItem,
        ...updateData
      });
    } else {
      // Create new history item
      await addOrUpdateVideoHistory(updateData);
    }
    
    console.log('Successfully saved all content to history');
    return true;
  } catch (error) {
    console.error('Error saving all content to history:', error);
    return false;
  }
};
