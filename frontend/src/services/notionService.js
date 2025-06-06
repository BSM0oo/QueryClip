import axios from 'axios';
import { getApiUrl } from '../config';

/**
 * Service for interacting with Notion API through the backend
 */
class NotionService {
  /**
   * Save video information to a Notion database
   * @param {Object} videoInfo - Information about the video
   * @param {string} videoInfo.title - Title of the video
   * @param {string} videoInfo.videoId - YouTube video ID
   * @returns {Promise<Object>} - Response from the API
   */
  async saveToNotion(videoInfo) {
    try {
      const response = await axios.post(getApiUrl('/save-to-notion'), {
        title: videoInfo.title || 'Untitled Video',
        videoId: videoInfo.videoId,
        author: 'QueryClip',
        publisher: 'QueryClip'
      });
      
      return response.data;
    } catch (error) {
      console.error('Error saving to Notion:', error);
      throw error;
    }
  }
}

export default new NotionService();
