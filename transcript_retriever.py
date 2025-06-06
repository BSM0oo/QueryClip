import json
import re
from typing import Optional, Dict, Any, List
import requests
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import TranscriptsDisabled, NoTranscriptFound

class EnhancedTranscriptRetriever:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
        
    def _get_video_info(self, video_id: str) -> Dict[str, Any]:
        """Get video info using YouTube's internal API."""
        try:
            url = f"https://www.youtube.com/watch?v={video_id}"
            response = self.session.get(url)
            response.raise_for_status()
            
            # Extract ytInitialData from the page
            data_match = re.search(r"ytInitialData\s*=\s*({.+?});", response.text)
            if data_match:
                return json.loads(data_match.group(1))
            
            # Try alternative pattern
            data_match = re.search(r"var\s+ytInitialData\s*=\s*({.+?});", response.text)
            if data_match:
                return json.loads(data_match.group(1))
                
            return {}
        except Exception as e:
            print(f"Error getting video info: {e}")
            return {}

    def _extract_captions_url(self, video_info: Dict[str, Any]) -> Optional[str]:
        """Extract captions URL from video info."""
        try:
            # Navigate through the ytInitialData structure to find captions URL
            if 'captions' in video_info:
                captions_data = video_info['captions']
                player_captions = captions_data.get('playerCaptionsTracklistRenderer', {})
                caption_tracks = player_captions.get('captionTracks', [])
                
                # First try to find auto-generated English captions
                for track in caption_tracks:
                    if track.get('kind') == 'asr' and track.get('languageCode') == 'en':
                        return track.get('baseUrl')
                
                # If no auto-generated English captions, try any English captions
                for track in caption_tracks:
                    if track.get('languageCode') == 'en':
                        return track.get('baseUrl')
                
                # If no English captions, take the first available
                if caption_tracks:
                    return caption_tracks[0].get('baseUrl')
            
            return None
        except Exception as e:
            print(f"Error extracting captions URL: {e}")
            return None

    def _parse_caption_data(self, caption_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Parse caption data into transcript format."""
        transcript = []
        try:
            for event in caption_data.get('events', []):
                if 'segs' in event:
                    text = ' '.join(seg.get('utf8', '') for seg in event['segs'])
                    if text.strip():
                        transcript.append({
                            'text': text.strip(),
                            'start': event.get('tStartMs', 0) / 1000,
                            'duration': event.get('dDurationMs', 0) / 1000
                        })
        except Exception as e:
            print(f"Error parsing caption data: {e}")
        return transcript

    async def get_transcript(self, video_id: str) -> List[Dict[str, Any]]:
        """Get transcript with multiple fallback methods."""
        transcript = []
        
        # Method 1: Try youtube_transcript_api first
        try:
            print(f"Attempting to get transcript via youtube_transcript_api...")
            transcript = YouTubeTranscriptApi.get_transcript(video_id)
            return transcript
        except (TranscriptsDisabled, NoTranscriptFound) as e:
            print(f"Standard transcript retrieval failed: {e}")
        
        # Method 2: Try to get auto-generated transcript
        try:
            print(f"Attempting to get auto-generated transcript...")
            transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
            transcript = transcript_list.find_generated_transcript(['en']).fetch()
            return transcript
        except Exception as e:
            print(f"Auto-generated transcript retrieval failed: {e}")
        
        # Method 3: Try direct API approach
        try:
            print(f"Attempting direct API approach...")
            video_info = self._get_video_info(video_id)
            captions_url = self._extract_captions_url(video_info)
            
            if captions_url:
                print(f"Found captions URL, fetching transcript...")
                response = self.session.get(captions_url)
                response.raise_for_status()
                
                # Parse the timedtext format
                if response.headers.get('content-type', '').startswith('application/json'):
                    transcript = self._parse_caption_data(response.json())
                elif 'xml' in response.headers.get('content-type', ''):
                    # Handle XML format if needed
                    print("XML format detected - implementation needed")
                    pass
                
                if transcript:
                    return transcript
                
        except Exception as e:
            print(f"Direct API transcript retrieval failed: {e}")
        
        # If all methods fail, raise an exception
        raise NoTranscriptFound(video_id, "No transcript could be retrieved using any available method")