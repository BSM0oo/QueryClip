#!/usr/bin/env python3
"""
YouTube Transcript Extractor

A robust Python script that reliably extracts YouTube video transcripts using multiple methods:
1. youtube-transcript-api (primary - fastest and most reliable)
2. yt-dlp subtitle extraction (secondary - robust fallback)
3. YouTube Data API (tertiary - if user has API key and permissions)
4. Whisper AI transcription (last resort - for videos without subtitles)
"""

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Union
from urllib.parse import parse_qs, urlparse

# Core dependencies
import requests

# Method 1: youtube-transcript-api
try:
    from youtube_transcript_api import YouTubeTranscriptApi, NoTranscriptFound, TranscriptsDisabled
    YOUTUBE_TRANSCRIPT_API_AVAILABLE = True
except ImportError:
    YOUTUBE_TRANSCRIPT_API_AVAILABLE = False

# Method 2: yt-dlp (subprocess)
try:
    import webvtt
    WEBVTT_AVAILABLE = True
except ImportError:
    WEBVTT_AVAILABLE = False

# Method 3: YouTube Data API
try:
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
    YOUTUBE_API_AVAILABLE = True
except ImportError:
    YOUTUBE_API_AVAILABLE = False

# Method 4: Whisper AI
try:
    import whisper
    import pytube
    WHISPER_AVAILABLE = True
except ImportError:
    WHISPER_AVAILABLE = False


class EnhancedTranscriptRetriever:
    """Main class for extracting YouTube transcripts using multiple methods."""
    
    def __init__(self, api_key: Optional[str] = None, verbose: bool = False):
        """
        Initialize the transcript extractor.
        
        Args:
            api_key: YouTube Data API key (optional)
            verbose: Enable verbose logging
        """
        self.api_key = api_key
        self.verbose = verbose
        self.youtube_service = None
        
        if api_key and YOUTUBE_API_AVAILABLE:
            try:
                self.youtube_service = build('youtube', 'v3', developerKey=api_key)
            except Exception as e:
                self.log(f"Warning: Could not initialize YouTube API service: {e}")
    
    def log(self, message: str):
        """Log message if verbose mode is enabled."""
        if self.verbose:
            print(f"[LOG] {message}")
    
    def extract_video_id(self, url: str) -> Optional[str]:
        """
        Extract video ID from various YouTube URL formats.
        
        Args:
            url: YouTube URL
            
        Returns:
            Video ID or None if not found
        """
        patterns = [
            r'(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)',
            r'youtube\.com\/v\/([^&\n?#]+)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        
        return None
    
    def method1_youtube_transcript_api(self, video_id: str, languages: List[str] = None) -> Optional[Dict]:
        """
        Method 1: Extract transcript using youtube-transcript-api.
        
        Args:
            video_id: YouTube video ID
            languages: List of preferred languages (default: ['en'])
            
        Returns:
            Transcript data or None if failed
        """
        if not YOUTUBE_TRANSCRIPT_API_AVAILABLE:
            self.log("youtube-transcript-api not available")
            return None
        
        if languages is None:
            languages = ['en']
        
        try:
            self.log("Attempting Method 1: youtube-transcript-api")
            
            # Try to get transcript
            transcript = YouTubeTranscriptApi.get_transcript(video_id, languages=languages)
            
            # Format the transcript
            formatted_transcript = {
                'method': 'youtube-transcript-api',
                'video_id': video_id,
                'language': 'auto-detected',
                'segments': []
            }
            
            for entry in transcript:
                formatted_transcript['segments'].append({
                    'start': entry['start'],
                    'duration': entry['duration'],
                    'text': entry['text'].strip()
                })
            
            self.log(f"Method 1 successful: Found {len(transcript)} segments")
            return formatted_transcript
            
        except NoTranscriptFound:
            self.log("Method 1 failed: No transcript found")
        except TranscriptsDisabled:
            self.log("Method 1 failed: Transcripts disabled for this video")
        except Exception as e:
            self.log(f"Method 1 failed: {e}")
        
        return None
    
    def method2_ytdlp_extraction(self, video_id: str) -> Optional[Dict]:
        """
        Method 2: Extract transcript using yt-dlp.
        
        Args:
            video_id: YouTube video ID
            
        Returns:
            Transcript data or None if failed
        """
        if not WEBVTT_AVAILABLE:
            self.log("webvtt library not available for Method 2")
            return None
        
        try:
            self.log("Attempting Method 2: yt-dlp subtitle extraction")
            
            # Create temporary directory
            with tempfile.TemporaryDirectory() as temp_dir:
                temp_path = Path(temp_dir)
                output_template = str(temp_path / "subtitle")
                
                # Build yt-dlp command
                cmd = [
                    "yt-dlp",
                    "--write-subs",
                    "--sub-format", "vtt",
                    "--skip-download",
                    f"https://www.youtube.com/watch?v={video_id}",
                    "-o", output_template
                ]
                
                # Run yt-dlp
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
                
                if result.returncode != 0:
                    self.log(f"Method 2 failed: yt-dlp error: {result.stderr}")
                    return None
                
                # Find VTT files
                vtt_files = list(temp_path.glob("*.vtt"))
                if not vtt_files:
                    self.log("Method 2 failed: No VTT files found")
                    return None
                
                # Use the first VTT file
                vtt_file = vtt_files[0]
                self.log(f"Method 2: Processing {vtt_file.name}")
                
                # Parse VTT file
                vtt_content = webvtt.read(str(vtt_file))
                
                formatted_transcript = {
                    'method': 'yt-dlp',
                    'video_id': video_id,
                    'language': 'auto-detected',
                    'segments': []
                }
                
                for caption in vtt_content:
                    # Convert time to seconds
                    start_seconds = self._time_to_seconds(caption.start)
                    end_seconds = self._time_to_seconds(caption.end)
                    duration = end_seconds - start_seconds
                    
                    formatted_transcript['segments'].append({
                        'start': start_seconds,
                        'duration': duration,
                        'text': caption.text.replace('\n', ' ').strip()
                    })
                
                self.log(f"Method 2 successful: Found {len(formatted_transcript['segments'])} segments")
                return formatted_transcript
                
        except subprocess.TimeoutExpired:
            self.log("Method 2 failed: yt-dlp timeout")
        except FileNotFoundError:
            self.log("Method 2 failed: yt-dlp not found in PATH")
        except Exception as e:
            self.log(f"Method 2 failed: {e}")
        
        return None
    
    def method3_youtube_data_api(self, video_id: str) -> Optional[Dict]:
        """
        Method 3: Extract transcript using YouTube Data API.
        
        Args:
            video_id: YouTube video ID
            
        Returns:
            Transcript data or None if failed
        """
        if not self.youtube_service:
            self.log("Method 3 skipped: YouTube Data API not available")
            return None
        
        try:
            self.log("Attempting Method 3: YouTube Data API")
            
            # List available captions
            captions_response = self.youtube_service.captions().list(
                part='snippet',
                videoId=video_id
            ).execute()
            
            if not captions_response.get('items'):
                self.log("Method 3 failed: No captions available")
                return None
            
            # Find English caption or use first available
            caption_id = None
            for item in captions_response['items']:
                if item['snippet']['language'] == 'en':
                    caption_id = item['id']
                    break
            
            if not caption_id:
                caption_id = captions_response['items'][0]['id']
            
            # Download caption
            caption_response = self.youtube_service.captions().download(
                id=caption_id,
                tfmt='vtt'
            ).execute()
            
            # Parse VTT content
            with tempfile.NamedTemporaryFile(mode='w', suffix='.vtt', delete=False) as temp_file:
                temp_file.write(caption_response.decode('utf-8'))
                temp_file_path = temp_file.name
            
            try:
                vtt_content = webvtt.read(temp_file_path)
                
                formatted_transcript = {
                    'method': 'youtube-data-api',
                    'video_id': video_id,
                    'language': 'auto-detected',
                    'segments': []
                }
                
                for caption in vtt_content:
                    start_seconds = self._time_to_seconds(caption.start)
                    end_seconds = self._time_to_seconds(caption.end)
                    duration = end_seconds - start_seconds
                    
                    formatted_transcript['segments'].append({
                        'start': start_seconds,
                        'duration': duration,
                        'text': caption.text.replace('\n', ' ').strip()
                    })
                
                self.log(f"Method 3 successful: Found {len(formatted_transcript['segments'])} segments")
                return formatted_transcript
                
            finally:
                os.unlink(temp_file_path)
                
        except HttpError as e:
            self.log(f"Method 3 failed: YouTube API error: {e}")
        except Exception as e:
            self.log(f"Method 3 failed: {e}")
        
        return None
    
    def method4_whisper_transcription(self, video_id: str, model_size: str = "base") -> Optional[Dict]:
        """
        Method 4: Extract transcript using Whisper AI.
        
        Args:
            video_id: YouTube video ID
            model_size: Whisper model size (tiny, base, small, medium, large)
            
        Returns:
            Transcript data or None if failed
        """
        if not WHISPER_AVAILABLE:
            self.log("Method 4 skipped: Whisper or pytube not available")
            return None
        
        try:
            self.log(f"Attempting Method 4: Whisper AI transcription (model: {model_size})")
            
            # Download audio using pytube
            url = f"https://www.youtube.com/watch?v={video_id}"
            yt = pytube.YouTube(url)
            
            # Get audio stream
            audio_stream = yt.streams.filter(only_audio=True).first()
            if not audio_stream:
                self.log("Method 4 failed: No audio stream available")
                return None
            
            # Download audio to temporary file
            with tempfile.TemporaryDirectory() as temp_dir:
                temp_path = Path(temp_dir)
                audio_file = audio_stream.download(output_path=temp_dir)
                
                # Load Whisper model
                self.log(f"Loading Whisper model: {model_size}")
                model = whisper.load_model(model_size)
                
                # Transcribe audio
                self.log("Transcribing audio...")
                result = model.transcribe(audio_file)
                
                formatted_transcript = {
                    'method': 'whisper-ai',
                    'video_id': video_id,
                    'language': result.get('language', 'unknown'),
                    'segments': []
                }
                
                for segment in result['segments']:
                    formatted_transcript['segments'].append({
                        'start': segment['start'],
                        'duration': segment['end'] - segment['start'],
                        'text': segment['text'].strip()
                    })
                
                self.log(f"Method 4 successful: Found {len(formatted_transcript['segments'])} segments")
                return formatted_transcript
                
        except Exception as e:
            self.log(f"Method 4 failed: {e}")
        
        return None
    
    def _time_to_seconds(self, time_str: str) -> float:
        """Convert VTT time format to seconds."""
        parts = time_str.split(':')
        if len(parts) == 3:
            hours, minutes, seconds = parts
            return float(hours) * 3600 + float(minutes) * 60 + float(seconds)
        elif len(parts) == 2:
            minutes, seconds = parts
            return float(minutes) * 60 + float(seconds)
        else:
            return float(parts[0])
    
    def extract_transcript(self, url: str, languages: List[str] = None, 
                          whisper_model: str = "base") -> Optional[Dict]:
        """
        Extract transcript using all available methods as fallbacks.
        
        Args:
            url: YouTube URL
            languages: Preferred languages for transcript
            whisper_model: Whisper model size for Method 4
            
        Returns:
            Transcript data or None if all methods failed
        """
        # Extract video ID
        video_id = self.extract_video_id(url)
        if not video_id:
            self.log("Error: Could not extract video ID from URL")
            return None
        
        self.log(f"Extracting transcript for video ID: {video_id}")
        
        # Try methods in order of preference
        methods = [
            lambda: self.method1_youtube_transcript_api(video_id, languages),
            lambda: self.method2_ytdlp_extraction(video_id),
            lambda: self.method3_youtube_data_api(video_id),
            lambda: self.method4_whisper_transcription(video_id, whisper_model)
        ]
        
        for i, method in enumerate(methods, 1):
            try:
                result = method()
                if result:
                    self.log(f"Success! Transcript extracted using Method {i}")
                    return result
            except Exception as e:
                self.log(f"Method {i} encountered an error: {e}")
                continue
        
        self.log("All methods failed to extract transcript")
        return None
