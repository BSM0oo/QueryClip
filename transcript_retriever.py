#!/usr/bin/env python3
"""
Enhanced transcript retriever with improved error handling
"""

import asyncio
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import TranscriptsDisabled, NoTranscriptFound
import logging

logger = logging.getLogger(__name__)

class EnhancedTranscriptRetriever:
    """Enhanced transcript retriever that handles multiple languages and exceptions gracefully"""
    
    def __init__(self):
        self.languages = ['en', 'en-US', 'en-GB', 'auto']
    
    async def get_transcript(self, video_id):
        """
        Attempt to get transcript for video with improved error handling
        
        Args:
            video_id (str): YouTube video ID
            
        Returns:
            list: List of transcript segments
            
        Raises:
            Exception: If transcript retrieval fails
        """
        try:
            return await self._get_transcript_with_retries(video_id)
        except TranscriptsDisabled:
            logger.warning(f"Transcripts are disabled for video {video_id}")
            return None
        except NoTranscriptFound:
            logger.warning(f"No transcript found for video {video_id}")
            return None
        except Exception as e:
            logger.error(f"Error retrieving transcript for video {video_id}: {str(e)}")
            raise
    
    async def _get_transcript_with_retries(self, video_id):
        """Try to get transcript in different languages with retries"""
        errors = []
        
        # Try different language options
        for lang in self.languages:
            try:
                logger.info(f"Attempting to get transcript for {video_id} in language: {lang}")
                if lang == 'auto':
                    transcript = YouTubeTranscriptApi.get_transcript(video_id)
                else:
                    transcript = YouTubeTranscriptApi.get_transcript(video_id, languages=[lang])
                
                # Clean and process transcript
                return self._process_transcript(transcript)
            except Exception as e:
                errors.append(f"Failed with language {lang}: {str(e)}")
                continue
        
        # If we get here, all attempts failed
        error_msg = "\n".join(errors)
        logger.error(f"All transcript retrieval attempts failed: {error_msg}")
        raise Exception(f"Failed to retrieve transcript after trying languages {self.languages}")
    
    def _process_transcript(self, transcript):
        """Process and clean transcript data"""
        # Return empty result for None input
        if transcript is None:
            return []
            
        # Format transcript entries
        processed = []
        for entry in transcript:
            # Extract relevant fields
            item = {
                'text': entry.get('text', ''),
                'start': entry.get('start', 0),
                'duration': entry.get('duration', 0)
            }
            
            # Skip empty text entries
            if not item['text'].strip():
                continue
                
            processed.append(item)
            
        return processed

# For testing this implementation directly
if __name__ == "__main__":
    import sys
    
    async def test_retriever(video_id):
        retriever = EnhancedTranscriptRetriever()
        try:
            transcript = await retriever.get_transcript(video_id)
            if transcript:
                print(f"Successfully retrieved {len(transcript)} transcript segments")
                print(f"Sample: {transcript[:2]}")
            else:
                print("No transcript available for this video")
        except Exception as e:
            print(f"Error: {str(e)}")
    
    if len(sys.argv) > 1:
        video_id = sys.argv[1]
        asyncio.run(test_retriever(video_id))
    else:
        print("Usage: python transcript_retriever.py VIDEO_ID")
