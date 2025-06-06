/**
 * Extract YouTube video ID from various URL formats
 * @param {string} url - YouTube URL or video ID
 * @returns {string|null} - Video ID or null if invalid
 */
export const extractVideoId = (url) => {
  const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
  return match ? match[1] : url;
};

/**
 * Format timestamp in seconds to HH:MM:SS format
 * @param {number} seconds - Time in seconds
 * @returns {string} - Formatted time string
 */
export const formatTimestamp = (seconds) => {
  return new Date(seconds * 1000).toISOString().substr(11, 8);
};

/**
 * Create transcript text from array of transcript entries
 * @param {Array} transcript - Array of transcript entries
 * @returns {string} - Formatted transcript text
 */
export const createTranscriptText = (transcript) => {
  return transcript
    .map(entry => `[${formatTimestamp(entry.start)}] ${entry.text}`)
    .join('\n');
};