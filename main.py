import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, FileResponse, HTMLResponse
from pathlib import Path
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import base64
import hashlib
import json
import mimetypes
import os
import re
import sys
import traceback
import uuid
import asyncio
from playwright.async_api import async_playwright
from anthropic import Anthropic
from dotenv import load_dotenv
from transcript_retriever import EnhancedTranscriptRetriever
from modules.gif_capture import GifCapture
from notion_service import notion_service
import yt_dlp
from urllib.parse import urlparse
from datetime import datetime, timedelta
from dataclasses import dataclass
import cv2
import numpy as np
from PIL import Image, ImageOps
import pytesseract
import io
from PIL import ImageDraw, ImageFont
import asyncio
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import copy
import time

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger("queryclip")

# Load environment variables
load_dotenv()
logger.info("Environment variables loaded from .env file")

# Check for required API keys
anthro_key = os.getenv('ANTHROPIC_API_KEY')
youtube_key = os.getenv('YOUTUBE_API_KEY')
notion_key = os.getenv('NOTION_API_KEY')
logger.info(f"Anthropic API key: {'CONFIGURED' if anthro_key else 'MISSING'}")
logger.info(f"YouTube API key: {'CONFIGURED' if youtube_key else 'MISSING'}")
logger.info(f"Notion API key: {'CONFIGURED' if notion_key else 'MISSING'}")

# Load configuration from config.py or environment variables
SERVER_HOST = os.getenv('SERVER_HOST', '0.0.0.0').strip()  # Strip to remove any whitespace
SERVER_PORT = int(os.getenv('SERVER_PORT', '8991'))
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3001')
CORS_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173'
]

# Check and fix SERVER_HOST to ensure no comments are included
if '#' in SERVER_HOST:
    SERVER_HOST = SERVER_HOST.split('#')[0].strip()

logger.info(f"Server will run at: {SERVER_HOST}:{SERVER_PORT}")
logger.info(f"CORS configured for origins: {CORS_ORIGINS}")

def cleanup_old_screenshots():
    """Clean up old screenshots based on age and count limits"""
    try:
        # Get current time
        now = datetime.now()
        cleanup_threshold = now - timedelta(days=7)
        
        # Group files by video ID
        video_files = {}
        for file_path in SCREENSHOTS_DIR.glob("yt_*"):
            if not file_path.is_file():
                continue
                
            # Parse video ID from filename
            match = re.match(r"yt_([^_]+)_", file_path.name)
            if not match:
                continue
                
            video_id = match.group(1)
            file_stat = file_path.stat()
            file_time = datetime.fromtimestamp(file_stat.st_mtime)
            
            # Check if file is too old
            if file_time < cleanup_threshold:
                file_path.unlink()
                continue
                
            if video_id not in video_files:
                video_files[video_id] = []
            video_files[video_id].append((file_path, file_time))
        
        # Clean up excess files per video
        for video_id, files in video_files.items():
            if len(files) > 50:
                # Sort by modification time, newest first
                sorted_files = sorted(files, key=lambda x: x[1], reverse=True)
                
                # Remove oldest files exceeding the limit
                for file_path, _ in sorted_files[50:]:
                    file_path.unlink()
                    
        return {"message": "Cleanup completed successfully"}
    except Exception as e:
        logger.error(f"Error during screenshot cleanup: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Initialize Anthropic client
load_dotenv(override=True)
anthropic = Anthropic(
    api_key=os.getenv('ANTHROPIC_API_KEY')
)

# Initialize GIF capture
gif_capture = GifCapture()

YOUTUBE_API_KEY = os.getenv('YOUTUBE_API_KEY')
youtube = build('youtube', 'v3', developerKey=YOUTUBE_API_KEY)

app = FastAPI()

# Add CORS middleware with configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for ngrok access
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure necessary directories exist
DATA_DIR = Path("data")
DATA_DIR.mkdir(parents=True, exist_ok=True)
SCREENSHOTS_DIR = DATA_DIR / "screenshots"
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
SAVED_CONTENT_DIR = Path("saved_content")
SAVED_CONTENT_DIR.mkdir(parents=True, exist_ok=True)
STATIC_DIR = Path("static")
STATIC_DIR.mkdir(parents=True, exist_ok=True)

# Path to video history data file
HISTORY_FILE = DATA_DIR / "history.json"

# Initialize history file if it doesn't exist
if not HISTORY_FILE.exists():
    with open(HISTORY_FILE, 'w') as f:
        json.dump([], f, indent=4)

# Constants for screenshot management
MAX_SCREENSHOT_AGE_DAYS = 7  # Maximum age of screenshots before cleanup
MAX_SCREENSHOTS_PER_VIDEO = 50  # Maximum number of screenshots to keep per video
MAX_SCREENSHOTS = 50

@dataclass
class VideoInfo:
    """Class to store video information in a structured format"""
    title: str
    description: str
    chapters: List[Dict[str, str]]
    links: List[str]

class VideoHistoryItem(BaseModel):
    """Class to store video history information"""
    # Basic video info
    id: str  # Unique identifier (using videoId)
    videoId: str  # YouTube video ID
    title: str  # Video title
    thumbnailUrl: Optional[str] = None  # Thumbnail URL
    lastAccessedAt: str  # ISO timestamp of last access
    
    # User engagement data
    screenshotCount: int = 0  # Number of screenshots
    screenshotCaptions: Optional[str] = None  # Combined caption text from screenshots
    notes: Optional[str] = None  # User notes
    isFavorite: bool = False  # Favorited status
    tags: List[str] = []  # User-assigned tags
    
    # Content data
    transcript: Optional[str] = None  # Transcript text content (without timestamps)
    transcriptAnalysis: Optional[str] = None  # Generated transcript analysis/outline
    queryAnswers: Optional[List[Dict[str, str]]] = None  # Saved query responses
    chapters: Optional[List[Dict[str, Any]]] = None  # Video chapters

class LabelConfig(BaseModel):
    text: str
    fontSize: int
    color: str = 'white' # Default to white text

class VideoRequest(BaseModel):
    video_id: str
    timestamp: float 
    generate_caption: bool = True
    context: Optional[str] = None
    transcript_context: Optional[str] = None  # Alternative name used in some requests
    custom_prompt: Optional[str] = None
    label: Optional[LabelConfig] = None

class CaptionRequest(BaseModel):
    timestamp: float
    image_data: str
    transcript_context: str
    prompt: Optional[str] = None

class VideoFrameAnalysisRequest(BaseModel):
    video_id: str
    start_time: float
    duration: float = 30.0  # Default to 30 seconds

class GifCaptureRequest(BaseModel):
    video_id: str
    start_time: float
    duration: float = 3.0  # Default to 3 seconds
    fps: Optional[int] = 10
    width: Optional[int] = 480

class QuestionRequest(BaseModel):
    transcript: str
    question: str
    timestamp: float

class TranscriptAnalysisRequest(BaseModel):
    transcript: str
    videoId: Optional[str] = None

# Add this class with the existing BaseModel classes
class TranscriptQueryRequest(BaseModel):
    transcript: list
    prompt: str
    videoId: Optional[str] = None
    
class NotionSaveRequest(BaseModel):
    title: str
    videoId: str
    author: str = "QueryClip"
    publisher: str = "QueryClip"
    description: Optional[str] = None
    transcript: Optional[List] = None
    notes: Optional[str] = None
    screenshots: Optional[List] = None
    transcriptAnalysis: Optional[Dict] = None

class Screenshot(BaseModel):
    type: str
    timestamp: int
    image_url: Optional[str] = None
    prompt: Optional[str] = None
    response: Optional[str] = None
    caption: Optional[str] = None
    notes: Optional[str] = None
    transcriptContext: Optional[str] = None
    content_type: Optional[str] = "other"
    chapterId: Optional[str] = None
    createdAt: Optional[str] = None

class AppState(BaseModel):
    screenshots: Optional[List[Screenshot]] = Field(default=None, description="List of screenshots")
    videoId: Optional[str] = Field(default=None, description="Current video ID")
    timestamp: Optional[float] = Field(default=None, description="Current timestamp")
    chapters: Optional[List[Dict[str, Any]]] = Field(default=None, description="List of chapter markers")
    otherState: Optional[Dict[str, Any]] = Field(default=None, description="Other application state")

class SceneDetector:
    def __init__(self):
        self.threshold = 30.0  # Scene change threshold
        
    def detect_scene_change(self, frame1, frame2):
        """Detect if there's a significant scene change between frames"""
        if frame1 is None or frame2 is None:
            return False
            
        # Convert frames to grayscale
        gray1 = cv2.cvtColor(frame1, cv2.COLOR_BGR2GRAY)
        gray2 = cv2.cvtColor(frame2, cv2.COLOR_BGR2GRAY)
        
        # Calculate difference
        diff = cv2.absdiff(gray1, gray2)
        mean_diff = np.mean(diff)
        return mean_diff > self.threshold
        
    def detect_text_presence(self, frame):
        """Detect if frame contains significant text"""
        # Convert to grayscale
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # Enhance contrast
        enhanced = cv2.equalizeHist(gray)
        
        # Convert to PIL Image for Tesseract
        pil_image = Image.fromarray(enhanced)
        
        # Extract text
        text = pytesseract.image_to_string(pil_image)
        return len(text.strip()) > 20
        
    def is_slide_frame(self, frame):
        """Detect if frame likely contains a presentation slide"""
        # Convert to grayscale
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # Apply threshold
        _, thresh = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY)
        
        # Look for rectangular shapes
        edges = cv2.Canny(thresh, 50, 150)
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        for contour in contours:
            # Approximate the contour
            epsilon = 0.04 * cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, epsilon, True)
            
            # Check if it's rectangular
            if len(approx) == 4:
                # Get area of the rectangle
                area = cv2.contourArea(contour)
                image_area = frame.shape[0] * frame.shape[1]
                
                # Check if rectangle is large enough (>20% of frame)
                if area > 0.2 * image_area:
                    return True
        return False

def is_valid_youtube_url(url: str) -> bool:
    """Validate if the provided URL is a valid YouTube URL."""
    parsed = urlparse(url)
    return bool(parsed.netloc) and parsed.netloc.endswith(('youtube.com', 'youtu.be'))

def extract_links_from_description(description: str) -> List[str]:
    """Extract all URLs from the video description using regex."""
    url_pattern = r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+'
    return re.findall(url_pattern, description)

def get_video_info(video_id: str) -> Optional[VideoInfo]:
    """Extract information from a YouTube video using the YouTube Data API."""
    try:
        # Get video details
        video_response = youtube.videos().list(
            part='snippet,contentDetails',
            id=video_id
        ).execute()

        if not video_response['items']:
            return None

        video_data = video_response['items'][0]
        description = video_data['snippet']['description']
        video_title = video_data['snippet']['title']
        
        # Extract chapters from description (YouTube stores chapters in description)
        chapters = []
        lines = description.split('\n')
        for line in lines:
            # Look for timestamp patterns like "0:00" or "00:00" or "0:00:00"
            match = re.search(r'^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s*[-–]\s*(.+)$', line.strip())
            if match:
                groups = match.groups()
                if len(groups) == 4:
                    hours = int(groups[0]) if groups[0] else 0
                    minutes = int(groups[1])
                    seconds = int(groups[2])
                    chapter_title = groups[3].strip()
                    time_seconds = hours * 3600 + minutes * 60 + seconds
                    chapters.append({
                        'start_time': time_seconds,
                        'title': chapter_title
                    })

        links = extract_links_from_description(description)
        
        return VideoInfo(
            title=video_title,  # Use the original video title, not the last chapter title
            description=description,
            chapters=chapters,
            links=links
        )

    except HttpError as e:
        print(f"An HTTP error occurred: {e}")
        return None
    except Exception as e:
        print(f"An error occurred: {e}")
        return None

# Video History API Endpoints
@app.get("/api/video-history")
async def get_video_history():
    """Get list of videos in history"""
    try:
        if not HISTORY_FILE.exists():
            return {"items": []}
            
        with open(HISTORY_FILE, 'r') as f:
            history = json.load(f)
            
        # Sort by last accessed time, newest first
        history.sort(key=lambda x: x.get('lastAccessedAt', ''), reverse=True)
        
        return {"items": history}
    except Exception as e:
        logger.error(f"Error fetching video history: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching video history: {str(e)}")

@app.get("/api/video-history/{video_id}")
async def get_video_history_item(video_id: str):
    """Get a specific video history item"""
    try:
        if not HISTORY_FILE.exists():
            raise HTTPException(status_code=404, detail="History not found")
            
        with open(HISTORY_FILE, 'r') as f:
            history = json.load(f)
            
        # Find the video in history
        video = next((item for item in history if item.get('videoId') == video_id), None)
        
        if not video:
            raise HTTPException(status_code=404, detail=f"Video with ID {video_id} not found in history")
            
        return video
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching video history item: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching video history item: {str(e)}")

@app.post("/api/video-history")
async def add_or_update_video_history(item: VideoHistoryItem):
    """Add or update a video in history"""
    try:
        # Read current history
        history = []
        if HISTORY_FILE.exists():
            with open(HISTORY_FILE, 'r') as f:
                history = json.load(f)
        
        # Generate thumbnail URL if not provided
        if not item.thumbnailUrl and item.videoId:
            item.thumbnailUrl = f"https://i.ytimg.com/vi/{item.videoId}/mqdefault.jpg"
            
        # Update lastAccessedAt if not provided
        if not item.lastAccessedAt:
            item.lastAccessedAt = datetime.now().isoformat()
            
        # Check if video already exists in history
        existing_index = next((i for i, x in enumerate(history) if x.get('videoId') == item.videoId), None)
        
        if existing_index is not None:
            # Update existing entry
            history[existing_index] = item.dict()
        else:
            # Add new entry
            history.append(item.dict())
            
        # Sort by lastAccessedAt (newest first)
        history.sort(key=lambda x: x.get('lastAccessedAt', ''), reverse=True)
        
        # Limit history size to 100 items
        if len(history) > 100:
            history = history[:100]
            
        # Save updated history
        with open(HISTORY_FILE, 'w') as f:
            json.dump(history, f, indent=4, sort_keys=True)
            
        return {"success": True, "item": item.dict()}
    except Exception as e:
        logger.error(f"Error updating video history: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error updating video history: {str(e)}")

@app.delete("/api/video-history/{video_id}")
async def delete_video_history_item(video_id: str):
    """Delete a video from history"""
    try:
        if not HISTORY_FILE.exists():
            raise HTTPException(status_code=404, detail="History not found")
            
        with open(HISTORY_FILE, 'r') as f:
            history = json.load(f)
            
        # Filter out the video to delete
        original_length = len(history)
        history = [item for item in history if item.get('videoId') != video_id]
        
        if len(history) == original_length:
            raise HTTPException(status_code=404, detail=f"Video with ID {video_id} not found in history")
            
        # Save updated history
        with open(HISTORY_FILE, 'w') as f:
            json.dump(history, f, indent=4, sort_keys=True)
            
        return {"success": True, "message": f"Video with ID {video_id} removed from history"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting video history item: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error deleting video history item: {str(e)}")

@app.get("/api/transcript/{video_id}")
async def get_transcript(video_id: str):
    """Get transcript for a YouTube video using enhanced retrieval system"""
    try:
        logger.info(f"Attempting to get transcript for video ID: {video_id}")
        
        retriever = EnhancedTranscriptRetriever(api_key=os.getenv('YOUTUBE_API_KEY'), verbose=True)
        
        # The new retriever's get_transcript method expects a URL, not just a video ID.
        url = f"https://www.youtube.com/watch?v={video_id}"
        transcript_data = retriever.extract_transcript(url)
        
        if transcript_data and transcript_data.get('segments'):
            return {"transcript": transcript_data['segments']}
        else:
            raise HTTPException(
                status_code=404,
                detail="No transcript could be retrieved"
            )
            
    except Exception as e:
        logger.error(f"Transcript error: {str(e)}")
        error_msg = f"Could not get transcript: {str(e)}"
        
        # Handle NoTranscriptFound exceptions more gracefully
        if "NoTranscriptFound" in str(e) or "No transcript found" in str(e):
            error_msg = "No transcript/captions available for this video"
        
        logger.error(f"Returning error: {error_msg}")
        raise HTTPException(status_code=404, detail=error_msg)

@app.post("/api/cleanup-screenshots")
async def trigger_cleanup():
    """Manually trigger screenshot cleanup"""
    return cleanup_old_screenshots()

@app.post("/api/capture-screenshot")
async def capture_screenshot(request: VideoRequest):
    """Capture a screenshot from a YouTube video using Playwright"""
    # Log the full request body to see what's being sent
    logger.info(f"Received screenshot request body: {request.dict()}")
    
    max_retries = 3
    current_try = 0
    
    # Run cleanup before capturing new screenshot
    try:
        cleanup_old_screenshots()
    except Exception as e:
        logger.warning(f"Cleanup failed but continuing with capture: {str(e)}")
    
    # Extract whether to generate captions
    generate_caption = getattr(request, 'generate_caption', True)
    logger.info(f"Screenshot request received with generate_caption={generate_caption}")
    
    # Get transcript context if available
    transcript_context = request.transcript_context or request.context or ""
    custom_prompt = request.custom_prompt or None
    
    logger.info(f"Screenshot request for video {request.video_id} at {request.timestamp}")
    logger.info(f"Context length: {len(transcript_context)} chars, Custom prompt: {custom_prompt is not None}")
    
    while current_try < max_retries:
        try:
            current_try += 1
            print(f"Screenshot attempt {current_try} of {max_retries}")
            
            async with async_playwright() as p:
                logger.info("Launching browser...")
                browser = await p.chromium.launch(headless=True)
                page = await browser.new_page()
                
                # Set a user agent to appear more like a regular browser
                await page.set_extra_http_headers({
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                })

                # Try embedding with modest branding and origin parameters
                embed_url = f"https://www.youtube.com/embed/{request.video_id}?start={int(request.timestamp)}&autoplay=1&modestbranding=1&origin=http://localhost"
                logger.info(f"Navigating to {embed_url}")
                
                try:
                    # Set a timeout for the navigation
                    await page.goto(embed_url, timeout=15000)  # 15 second timeout
                except Exception as e:
                    logger.error(f"Network error during page navigation: {str(e)}")
                    raise HTTPException(
                        status_code=500,
                        detail=f"Failed to load YouTube video: {str(e)}"
                    )
                
                logger.info("Waiting for network idle...")
                try:
                    # Reduced timeout for network idle state
                    await page.wait_for_load_state('networkidle', timeout=10000)  # 10 second timeout
                except Exception as e:
                    logger.warning(f"Network idle timeout: {str(e)}. Continuing anyway...")
                    # Continue execution as the video might still be usable
                
                # Wait for and handle video element
                logger.info("Waiting for video element...")
                video_element_found = False
                for attempt in range(3):  # Try up to 3 times to find the video element
                    try:
                        await page.wait_for_selector('video', timeout=5000)
                        logger.info("Video element found!")
                        video_element_found = True
                        break
                    except Exception as e:
                        logger.warning(f"Attempt {attempt+1}/3: Error waiting for video element: {str(e)}")
                        await asyncio.sleep(1)  # Wait a bit before retrying
                        
                        # Refresh the page on retry
                        if attempt < 2:  # Only refresh on first 2 failures
                            logger.info("Refreshing page and trying again...")
                            try:
                                await page.reload(timeout=10000)
                                await asyncio.sleep(2)  # Give it time to stabilize
                            except Exception as reload_error:
                                logger.error(f"Error refreshing page: {str(reload_error)}")
                
                if not video_element_found:
                    logger.error("Failed to find video element after multiple attempts")
                    # Take screenshot anyway to see what's on the page
                    try:
                        error_ss = await page.screenshot(type='png')
                        error_path = SCREENSHOTS_DIR / f"error_{request.video_id}_{int(request.timestamp)}.png"
                        with open(error_path, "wb") as f:
                            f.write(error_ss)
                        logger.info(f"Error screenshot saved to {error_path}")
                    except Exception as ss_error:
                        logger.error(f"Failed to capture error screenshot: {str(ss_error)}")
                    
                    raise HTTPException(
                        status_code=500,
                        detail="Failed to load video element from YouTube. This may be due to network issues or content restrictions."
                    )
                
                logger.info("Setting video time and playing...")
                await page.evaluate("""
                    const video = document.querySelector('video');
                    video.currentTime = parseInt(new URL(window.location.href).searchParams.get('start'));
                    video.play();
                """)
                
                # Wait for frame to load
                await asyncio.sleep(1.5)
                
                # Pause video and remove controls
                await page.evaluate("document.querySelector('video').pause()")
                await page.add_style_tag(content="""
                    .ytp-chrome-bottom { display: none !important; }
                    .ytp-large-play-button { display: none !important; }
                    .ytp-gradient-bottom { display: none !important; }
                """)
                
                # Take screenshot with improved error handling
                logger.info("Capturing screenshot...")
                try:
                    screenshot_bytes = await page.screenshot(
                        type='png',
                        clip={'x': 0, 'y': 0, 'width': 1280, 'height': 720},
                        timeout=10000  # 10 second timeout for screenshot capture
                    )
                    logger.info("Screenshot captured successfully")
                except Exception as e:
                    logger.error(f"Failed to capture screenshot: {str(e)}")
                    # Try one more time with a different approach - full page screenshot
                    logger.info("Attempting fallback screenshot method...")
                    try:
                        logger.info("Taking full page screenshot as fallback")
                        screenshot_bytes = await page.screenshot(type='png', timeout=10000)
                        logger.info("Fallback screenshot successful")
                    except Exception as fallback_error:
                        logger.error(f"Fallback screenshot also failed: {str(fallback_error)}")
                        raise HTTPException(
                            status_code=500,
                            detail=f"Network error during screenshot capture: {str(e)}"
                        )
                
                # Add label if requested
                if request.label:
                    # Open image with Pillow
                    image = Image.open(io.BytesIO(screenshot_bytes))
                    draw = ImageDraw.Draw(image)
                    
                    # Load a font with the requested size
                    try:
                        font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', request.label.fontSize)
                    except:
                        # Fallback to default font if Helvetica not found
                        font = ImageFont.load_default()
                        font_size = request.label.fontSize
                    
                    # Get label text and handle line breaks
                    text = request.label.text
                    # Split text on explicit newlines (shift+enter)
                    text_lines = text.split('\n')
                    
                    # Calculate max width for text wrapping (80% of image width)
                    max_width = int(image.width * 0.8)
                    wrapped_lines = []
                    
                    # Process each line and apply word wrapping
                    for line in text_lines:
                        if not line.strip():
                            wrapped_lines.append('')  # Keep empty lines
                            continue
                            
                        words = line.split()
                        current_line = words[0] if words else ''
                        
                        for word in words[1:]:
                            # Try adding the next word
                            test_line = current_line + ' ' + word
                            # Check if it fits
                            bbox = draw.textbbox((0, 0), test_line, font=font)
                            test_width = bbox[2] - bbox[0]
                            
                            if test_width <= max_width:
                                current_line = test_line  # It fits, keep it
                            else:
                                wrapped_lines.append(current_line)  # Line is full, save it
                                current_line = word  # Start new line with this word
                        
                        # Don't forget the last line
                        if current_line:
                            wrapped_lines.append(current_line)
                    
                    # Combine all lines for rendering
                    line_height = request.label.fontSize * 1.2  # Add some spacing between lines
                    total_text_height = len(wrapped_lines) * line_height
                    
                    # Center text block in upper portion of image
                    y_start = image.height // 4 - total_text_height // 2
                    
                    # Draw each line of text
                    for i, line in enumerate(wrapped_lines):
                        if not line:  # Skip empty lines (just advance y position)
                            continue
                            
                        # Calculate horizontal position for this line
                        bbox = draw.textbbox((0, 0), line, font=font)
                        line_width = bbox[2] - bbox[0]
                        x = (image.width - line_width) // 2
                        y = y_start + int(i * line_height)
                        
                        # Draw outline for visibility
                        outline_width = max(1, request.label.fontSize // 25)
                        for adj in range(-outline_width, outline_width + 1):
                            for offy in range(-outline_width, outline_width + 1):
                                if adj == 0 and offy == 0:
                                    continue
                                # Always use black outline
                                draw.text((x + adj, y + offy), line, font=font, fill='black')
                        # Draw the main text in configured color
                        draw.text((x, y), line, font=font, fill=request.label.color)
                    
                    # Convert back to bytes
                    buffer = io.BytesIO()
                    image.save(buffer, format='PNG')
                    screenshot_bytes = buffer.getvalue()
                
                # Optimize the image
                image = Image.open(io.BytesIO(screenshot_bytes))
                
                # Convert to WebP format with optimized settings
                webp_buffer = io.BytesIO()
                image.save(webp_buffer, 'WEBP', quality=80, method=6)
                optimized_bytes = webp_buffer.getvalue()
                
                # Save to data directory
                timestamp_str = f"{int(request.timestamp)}"
                file_path = SCREENSHOTS_DIR / f"yt_{request.video_id}_{timestamp_str}.webp"
                
                with open(file_path, "wb") as f:
                    f.write(optimized_bytes)
                
                # Convert to base64 for response
                base64_screenshot = base64.b64encode(optimized_bytes).decode()
                
                print("Screenshot captured and saved successfully")
                result = {
                    "image_data": f"data:image/webp;base64,{base64_screenshot}",
                    "timestamp": request.timestamp
                }
                
                if not generate_caption:
                    logger.info("Skipping caption generation as requested")
                    return result
                
                # Generate caption with Claude
                try:
                    logger.info("Generating caption for screenshot")
                    # Send to caption API
                    caption_request = CaptionRequest(
                        timestamp=request.timestamp,
                        image_data=base64_screenshot,
                        transcript_context=transcript_context,
                        prompt=custom_prompt
                    )
                    
                    caption_result = await generate_caption_api(caption_request)
                    result["caption"] = caption_result.get("caption", "")
                    
                    if "caption_error" in caption_result:
                        result["caption_error"] = caption_result["caption_error"]
                        logger.warning(f"Caption error: {caption_result['caption_error']}")
                    else:
                        logger.info("Caption generated successfully")
                        
                except Exception as e:
                    logger.error(f"Error generating caption: {str(e)}")
                    result["caption_error"] = str(e)
                
                return result
                
        except Exception as e:
            print(f"Screenshot attempt {current_try} failed: {str(e)}")
            if current_try >= max_retries:
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to capture screenshot after {max_retries} attempts: {str(e)}"
                )
            await asyncio.sleep(2)  # Wait before retry


@app.get("/api/state/load")
async def load_state():
    """Load application state from file system"""
    try:
        state_file = DATA_DIR / "app_state.json"
        if not state_file.exists():
            return {"state": None}

        with open(state_file, "r") as f:
            state = json.load(f)

        if "screenshots" in state:
            screenshots_dir = DATA_DIR / "screenshots"
            for screenshot in state["screenshots"]:
                if "image" in screenshot and isinstance(screenshot["image"], str):
                    image_path = screenshots_dir / screenshot["image"]
                    if image_path.exists():
                        try:
                            with open(image_path, "rb") as f:
                                image_data = base64.b64encode(f.read()).decode()
                                screenshot["image"] = f"data:image/png;base64,{image_data}"
                        except Exception as e:
                            print(f"Error loading screenshot: {e}")

        return {"state": state}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/capture-gif")
async def capture_gif(request: GifCaptureRequest):
    """Capture a GIF from a YouTube video"""
    try:
        gif_data = await gif_capture.capture_gif(
            video_id=request.video_id,
            start_time=request.start_time,
            duration=request.duration,
            fps=request.fps,
            width=request.width
        )
        
        # Save GIF to disk
        timestamp_str = f"{int(request.start_time)}"
        file_path = SCREENSHOTS_DIR / f"yt_{request.video_id}_{timestamp_str}.gif"
        
        with open(file_path, "wb") as f:
            f.write(gif_data)
        
        # Convert to base64 for response
        base64_gif = base64.b64encode(gif_data).decode()
        
        return {
            "gif_data": f"data:image/gif;base64,{base64_gif}"
        }
        
    except Exception as e:
        print(f"GIF capture error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/state/clear")
async def clear_state(eraseFiles: bool = Query(False)):
    """Clear all saved state and optionally delete files"""
    try:
        print(f"Clearing state with eraseFiles={eraseFiles}")
        
        screenshots_dir = DATA_DIR / "screenshots"
        if screenshots_dir.exists():
            if eraseFiles:
                print("Deleting screenshots directory")
                for file in screenshots_dir.glob("*"):
                    try:
                        file.unlink()
                    except Exception as e:
                        print(f"Error deleting file {file}: {e}")
                try:
                    screenshots_dir.rmdir()
                except Exception as e:
                    print(f"Error removing screenshots directory: {e}")
            else:
                print("Keeping screenshot files")

        state_file = DATA_DIR / "app_state.json"
        if state_file.exists():
            if eraseFiles:
                print("Deleting state file")
                state_file.unlink()
            else:
                print("Clearing state file contents")
                with open(state_file, "w") as f:
                    json.dump({}, f, indent=4)

        if eraseFiles:
            print("Recreating directories")
            DATA_DIR.mkdir(exist_ok=True)
            screenshots_dir.mkdir(exist_ok=True)

        return {"message": "State cleared successfully"}
    except Exception as e:
        print(f"Error in clear_state: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/state/save")
async def save_state(state: dict):
    """Save application state to file system with better error handling for batch processing"""
    try:
        # Ensure data directory exists
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        screenshots_dir = DATA_DIR / "screenshots"
        screenshots_dir.mkdir(parents=True, exist_ok=True)
        
        # Create a copy of the state that we'll modify
        persisted_state = copy.deepcopy(state)
        
        # Handle screenshots (if they exist)
        if "screenshots" in state and isinstance(state["screenshots"], list):
            print(f"Processing {len(state['screenshots'])} screenshots")
            
            # Validate screenshot count to prevent excessive storage
            if len(state["screenshots"]) > 50:
                print(f"Warning: Limiting to 50 most recent screenshots (received {len(state['screenshots'])})")
                persisted_state["screenshots"] = state["screenshots"][-50:]
            
            # Process each screenshot
            for i, screenshot in enumerate(persisted_state["screenshots"]):
                if "image" in screenshot and isinstance(screenshot["image"], str):
                    # Validate image format
                    if not screenshot["image"].startswith("data:image/"):
                        print(f"Warning: Screenshot {i} has invalid image format, skipping")
                        continue
                    
                    try:
                        # Generate a stable filename based on video ID and timestamp
                        timestamp = screenshot.get("timestamp", time.time())
                        video_id = screenshot.get("videoId", "unknown")
                        
                        # Create a unique but predictable filename
                        filename = f"{video_id}_{int(timestamp)}.png"
                        file_path = screenshots_dir / filename
                        
                        # Extract base64 data
                        try:
                            header, encoded = screenshot["image"].split(",", 1)
                            image_data = base64.b64decode(encoded)
                            
                            # Save image data to file with error handling
                            with open(file_path, "wb") as f:
                                f.write(image_data)
                            
                            # Replace base64 image with filename reference in state
                            screenshot["image"] = filename
                        except ValueError:
                            print(f"Warning: Failed to split image data for screenshot {i}")
                            # If already a filename, keep it
                            if not screenshot["image"].startswith("data:"):
                                pass  # Keep existing filename
                            else:
                                screenshot["image"] = f"error_{int(time.time())}.png"
                        except Exception as e:
                            print(f"Error processing screenshot {i}: {str(e)}")
                            screenshot["image"] = f"error_{int(time.time())}.png"
                    except Exception as e:
                        print(f"Error saving screenshot {i}: {str(e)}")
                        continue
        
        # Save state to JSON file
        with open(DATA_DIR / "app_state.json", "w") as f:
            json.dump(persisted_state, f, indent=4, sort_keys=True)
        
        return {"success": True}
    except Exception as e:
        print(f"Error saving state: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

import asyncio
import time
from datetime import datetime, timedelta

# Add a rate limiter for API calls
class RateLimiter:
    def __init__(self, max_calls_per_minute=5):
        self.max_calls = max_calls_per_minute
        self.calls = []
        self.lock = asyncio.Lock()
    
    async def wait_if_needed(self):
        async with self.lock:
            now = time.time()
            # Remove calls older than 1 minute
            self.calls = [t for t in self.calls if now - t < 60]
            
            if len(self.calls) >= self.max_calls:
                # Need to wait until oldest call is more than a minute old
                wait_time = 60 - (now - self.calls[0]) + 0.1  # Add a small buffer
                print(f"Rate limit reached, waiting {wait_time:.1f} seconds")
                await asyncio.sleep(wait_time)
            
            # Add current time to calls
            self.calls.append(now)

# Create a global rate limiter instance
anthropic_rate_limiter = RateLimiter(max_calls_per_minute=5)

@app.post("/api/generate-caption")
async def generate_caption_api(screenshot: CaptionRequest):
    """Generate AI caption for screenshot with improved context handling"""
    try:
        logger.info(f"Caption request received for timestamp {screenshot.timestamp}")
        
        # Validate transcript context
        transcript_text = screenshot.transcript_context.strip() if screenshot.transcript_context else ""
        if not transcript_text:
            logger.warning("No transcript context provided for caption generation")
            transcript_text = "No transcript context available for this moment in the video."

        # Use custom prompt if provided, otherwise use default
        base_prompt = screenshot.prompt if screenshot.prompt else """Generate a concise and informative caption for this moment in the video.
            The caption should be a direct statement about the key point, without referring to the video or transcript."""

        logger.info("Constructing prompt for Anthropic API")
        prompt = f"""Here is the transcript context around timestamp {screenshot.timestamp}:

{transcript_text}

{base_prompt}

Generate a caption with the following structured format:

1. Start with a Level 3 Markdown heading ("### ") followed by a concise topic or key takeaway (1-5 words)
2. Below that, provide 3 bullet points that:
   - Make direct, actionable statements about key points
   - Use relevant technical terms or concepts
   - Avoid phrases like "In this video" or "The speaker explains"
   - Start each bullet point with "* " (asterisk followed by a space)
   - Include a blank line between bullet points for proper markdown rendering

For example, format your response exactly like this:

### Main Topic Heading

* First bullet point content

* Second bullet point content

* Third bullet point content

Caption:"""

        # Check if ANTHROPIC_API_KEY is set
        api_key = os.getenv('ANTHROPIC_API_KEY')
        if not api_key:
            logger.error("ANTHROPIC_API_KEY is not set in environment variables")
            return {"caption_error": "Missing API key", "caption": "Caption generation failed: API key not configured"}
            
        logger.info("Sending request to Anthropic API")
        try:
            # Apply rate limiting before making API call
            await anthropic_rate_limiter.wait_if_needed()
            
            response = anthropic.messages.create(
                model="claude-3-haiku-20240307",
                max_tokens=150,
                messages=[{
                    "role": "user",
                    "content": prompt
                }]
            )
            
            caption = response.content[0].text.strip()
            
            # Before processing, check if we're dealing with the old format (TOPIC HEADING, etc.)
            if caption.startswith("TOPIC HEADING:") and "KEY POINTS:" in caption:
                # Process the old format to ensure bullet points are properly formatted
                parts = caption.split("KEY POINTS:")
                if len(parts) >= 2:
                    header = parts[0].strip()
                    key_points = parts[1].strip()
                    
                    # Extract bullet points and ensure each is on its own line
                    bullet_points = []
                    # Match bullet points that might be on the same line
                    import re
                    # This regex matches "• point" patterns, even if they're on the same line
                    points_regex = re.compile(r'•\s+([^•]+?)(?=\s+•|\s*$)')
                    matches = points_regex.findall(key_points)
                    
                    if matches:
                        # Format each bullet point with proper spacing
                        formatted_points = "\n".join([f"• {point.strip()}" for point in matches])
                        # Rebuild the caption with proper line breaks
                        caption = f"{header}\nKEY POINTS:\n{formatted_points}"
        
            # Then process any caption with bullet points to ensure proper markdown
            lines = caption.split('\n')
            formatted_lines = []
            
            for line in lines:
                line = line.strip()
                if not line:
                    # Keep empty lines for spacing
                    formatted_lines.append('')
                elif not (line.startswith('*') or line.startswith('-') or line.startswith('•')):
                    # If the line doesn't start with a bullet point, add one
                    formatted_lines.append(f"* {line}")
                else:
                    # Line already has a bullet point, keep as is
                    formatted_lines.append(line)
            
            # Join the lines back together with line breaks
            caption = '\n'.join(formatted_lines)
            
            logger.info(f"Caption generated successfully: {caption[:30]}...")
            return {"caption": caption}
        except Exception as e:
            logger.error(f"Anthropic API error: {str(e)}")
            return {"caption_error": str(e), "caption": "Caption generation failed due to API error"}
    except Exception as e:
        logger.error(f"Error in generate_caption: {str(e)}")
        return {"caption_error": str(e), "caption": "Caption generation failed"}

async def update_video_history_content(video_id: str, content_type: str, content: str):
    """Update the video history with additional content"""
    try:
        if not HISTORY_FILE.exists():
            logger.warning(f"History file doesn't exist, can't update {content_type} for video {video_id}")
            return
            
        with open(HISTORY_FILE, 'r') as f:
            history = json.load(f)
            
        # Find the video in history
        existing_index = next((i for i, x in enumerate(history) if x.get('videoId') == video_id), None)
        
        if existing_index is None:
            logger.warning(f"Video {video_id} not found in history, can't update {content_type}")
            return
            
        # Update content field
        history[existing_index][content_type] = content
        
        # Update last accessed time
        history[existing_index]['lastAccessedAt'] = datetime.now().isoformat()
        
        # Save updated history
        with open(HISTORY_FILE, 'w') as f:
            json.dump(history, f, indent=2)
            
        logger.info(f"Updated {content_type} for video {video_id} in history")
    except Exception as e:
        logger.error(f"Error updating {content_type} for video {video_id} in history: {str(e)}")
        # Don't throw an exception - this is a background operation

@app.post("/api/analyze-transcript")
async def analyze_transcript(request: TranscriptAnalysisRequest):
    """Analyze video transcript for structure and key points"""
    try:
        response = anthropic.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=1000,
            messages=[{
                "role": "user",
                "content": f"""Analyze this video transcript and provide:
                
                1. A high-level summary of the main topics in bullet points
                2. Key points and takeaways, comprehensive (bullet points)
                3. Any important technical terms or concepts mentioned, with accompanying definitions and context. "Term/Concept: Definition. Context of its mention.
                4. Suggested sections/timestamps for review and bullet point rationale for this recommendation. 
                - Review your output before finalizing to ensure you have followed these instructions exactly.
                - Generate a title for the video and begin your output with the title in bold

                Transcript:
                {request.transcript}
                """
            }]
        )
        
        analysis = response.content[0].text.strip()
        
        # Extract video ID from context if available
        # Assuming the request might contain a videoId property
        video_id = getattr(request, 'videoId', None)
        
        # Update video history with transcript analysis if video ID is available
        if video_id:
            await update_video_history_content(video_id, 'transcriptAnalysis', analysis)
            
            # Also update transcript in history (assuming we haven't done this yet)
            plain_transcript = ' '.join([item.get('text', '') for item in request.transcript]) if isinstance(request.transcript, list) else request.transcript
            await update_video_history_content(video_id, 'transcript', plain_transcript)
        
        return {"analysis": analysis}
    except Exception as e:
        print(f"Analysis error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ask-question")
async def ask_question(request: QuestionRequest):
    """Answer questions about the video content"""
    try:
        prompt = f"""Based on the following video transcript, please answer this question: {request.question}

Transcript:
{request.transcript}

Please provide a clear, concise answer that:
1. Directly addresses the question
2. Uses specific information from the transcript
3. Maintains technical accuracy
4. Is formatted in a clear, readable way

Answer:"""

        response = anthropic.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=300,
            messages=[{
                "role": "user",
                "content": prompt
            }]
        )
        
        answer = response.content[0].text.strip()
        return {
            "answer": answer,
            "timestamp": request.timestamp,
            "question": request.question
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/query-transcript")
async def query_transcript(request: TranscriptQueryRequest):
    """Process a query about the transcript using Claude 3.5 Sonnet with streamlined timestamp references"""
    try:
        if not request.transcript or not request.prompt:
            raise HTTPException(status_code=400, detail="Missing transcript or prompt")
            
        logger.info(f"Processing transcript query: {request.prompt[:50]}...")
        
        # Extract video ID if present in the request body
        video_id = request.dict().get('videoId')
        
        # Format transcript with timestamps for better context
        formatted_transcript = []
        for item in request.transcript:
            if not isinstance(item, dict) or 'start' not in item or 'text' not in item:
                continue
                
            timestamp = float(item['start'])
            hours = int(timestamp // 3600)
            minutes = int((timestamp % 3600) // 60)
            seconds = int(timestamp % 60)
            time_str = f"{hours:02d}:{minutes:02d}:{seconds:02d}"
            formatted_transcript.append(f"[{time_str}] {item['text']}")
            
        transcript_text = "\n".join(formatted_transcript)

        prompt = f"""Based on this video transcript, answer the following question or respond to this request: {request.prompt}

Transcript:
{transcript_text}

Provide your response following these exact rules:

1. Avoid using introductory statements or phrases like "The video shows...", "In this screenshot...", "The speaker explains..." Generate response as if you are the author of the transcript but don't refer to yourself in the first person. Never refer to the video or transcript directly.
2. Never refer to "the video", "the transcript", or use phrases like "they mention" or "the speaker explains"
3. Format timestamps like this: [HH:MM:SS]
4. Only add timestamps in parentheses at the end of key points
5. If multiple consecutive points come from the same timestamp, only include the timestamp once at the end of the last related point
6. Use markdown formatting with headings and bullet points
7. Be direct and concise - no meta-commentary about the response itself

Example of desired format:

**Topic Heading:**
* I previously covered this concept in several videos about X
* This technique is particularly important for beginners [00:05:20]

**Second Topic:**
* The first step involves positioning your hands correctly
* You'll want to maintain this position throughout the movement
* This creates the optimal angle for power generation [00:08:45]

Response:"""

        logger.info("Sending request to Anthropic API")
        try:
            # Apply rate limiting before making API call
            await anthropic_rate_limiter.wait_if_needed()
            
            response = anthropic.messages.create(
                model="claude-3-5-sonnet-20240620",
                max_tokens=1000,
                messages=[{
                    "role": "user",
                    "content": prompt
                }]
            )
            
            answer = response.content[0].text.strip()
            logger.info(f"Got response from Anthropic API: {answer[:50]}...")
            
            # Save the query and answer to history if videoId is provided
            if video_id:
                try:
                    # Read current history
                    history = []
                    if HISTORY_FILE.exists():
                        with open(HISTORY_FILE, 'r') as f:
                            history = json.load(f)
                    
                    # Find the video in history
                    existing_index = next((i for i, x in enumerate(history) if x.get('videoId') == video_id), None)
                    
                    if existing_index is not None:
                        # Update queryAnswers field
                        entry = history[existing_index]
                        
                        # Initialize queryAnswers if not present
                        if not entry.get('queryAnswers'):
                            entry['queryAnswers'] = []
                        
                        # Add the new query/answer pair with clear structure
                        entry['queryAnswers'].append({
                            'prompt': request.prompt,
                            'response': answer,
                            'timestamp': datetime.now().isoformat(),
                            'metadata': {
                                'model': 'claude-3-5-sonnet-20240620',
                                'responseLength': len(answer)
                            }
                        })
                        
                        # Update timestamp
                        entry['lastAccessedAt'] = datetime.now().isoformat()
                        
                        # Save updated history
                        with open(HISTORY_FILE, 'w') as f:
                            json.dump(history, f, indent=4, sort_keys=True)
                        
                        logger.info(f"Saved query answer to history for video {video_id}")
                    else:
                        logger.warning(f"Could not save query answer - video {video_id} not found in history")
                except Exception as history_error:
                    logger.error(f"Error saving query to history: {str(history_error)}")
                    # Continue without failing if history save fails
            
            return {
                "response": answer,
                "prompt": request.prompt,
            }
        except HTTPException as he:
            # Re-raise HTTP exceptions
            logger.error(f"HTTP exception in query_transcript: {str(he)}")
            raise he
        except Exception as e:
            logger.error(f"Error processing transcript query: {str(e)}")
            logger.error(f"Request data: {request}")
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Error processing transcript query: {str(e)}")
    except Exception as e:
        logger.error(f"Outer error in query_transcript: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing transcript query: {str(e)}")


@app.get("/api/video-info/{video_id}")
async def get_video_information(video_id: str):
    """Get detailed information about a YouTube video using the YouTube API"""
    try:
        video_info = get_video_info(video_id)
        
        if video_info:
            # Automatically add to history when video info is loaded
            try:
                # First try to get existing transcript to save it
                try:
                    transcript_retriever = EnhancedTranscriptRetriever()
                    transcript_data = transcript_retriever.get_transcript(video_id)
                    plain_transcript = ' '.join([item.get('text', '') for item in transcript_data]) if transcript_data else None
                except Exception as transcript_error:
                    logger.warning(f"Could not get transcript for {video_id}: {transcript_error}")
                    plain_transcript = None
                
                # Create history item with more information
                history_item = VideoHistoryItem(
                    id=video_id,
                    videoId=video_id,
                    title=video_info.title,
                    thumbnailUrl=f"https://i.ytimg.com/vi/{video_id}/mqdefault.jpg",
                    lastAccessedAt=datetime.now().isoformat(),
                    transcript=plain_transcript
                )
                
                # Read current history
                history = []
                if HISTORY_FILE.exists():
                    with open(HISTORY_FILE, 'r') as f:
                        history = json.load(f)
                
                # Check if video already exists in history
                existing_index = next((i for i, x in enumerate(history) if x.get('videoId') == video_id), None)
                
                if existing_index is not None:
                    # Update entry with new information but preserve existing content
                    existing_entry = history[existing_index]
                    # Update basic info
                    existing_entry['title'] = video_info.title
                    existing_entry['thumbnailUrl'] = f"https://i.ytimg.com/vi/{video_id}/mqdefault.jpg"
                    existing_entry['lastAccessedAt'] = datetime.now().isoformat()
                    
                    # Only update transcript if it wasn't already saved
                    if not existing_entry.get('transcript') and plain_transcript:
                        existing_entry['transcript'] = plain_transcript
                    
                    # Keep this entry in history
                    history[existing_index] = existing_entry
                else:
                    # Add new entry
                    history.append(history_item.dict())
                
                # Sort by lastAccessedAt (newest first)
                history.sort(key=lambda x: x.get('lastAccessedAt', ''), reverse=True)
                
                # Limit history size to 100 items
                if len(history) > 100:
                    history = history[:100]
                
                # Save updated history
                with open(HISTORY_FILE, 'w') as f:
                    json.dump(history, f, indent=4, sort_keys=True)
                
                logger.info(f"Added/updated video {video_id} in history with transcript: {'Yes' if plain_transcript else 'No'}")
            except Exception as history_error:
                logger.error(f"Error updating history for video {video_id}: {str(history_error)}")
                # Continue without failing if history update fails
            
            return {
                "title": video_info.title,
                "description": video_info.description,
                "chapters": video_info.chapters,
                "links": video_info.links
            }
        else:
            raise HTTPException(
                status_code=404,
                detail="Could not retrieve video information"
            )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error getting video information: {str(e)}"
        )

@app.post("/api/generate-structured-caption")
async def generate_structured_caption(screenshot: CaptionRequest):
    """Generate AI caption for screenshot with improved structured format"""
    try:
        transcript_text = screenshot.transcript_context.strip()
        if not transcript_text:
            raise HTTPException(status_code=400, detail="No transcript context provided")

        base_prompt = screenshot.prompt if screenshot.prompt else """Generate a structured caption for this moment in the video."""

        prompt = f"""After you're done, 
        Double check that you have always:
        1) Keep each bullet point concise and actionable.
        2) Avoid phrases like "In this video" or "The speaker explains" or "The speaker is discussing". 
        3) Generate the content as if you are the person who created the content in the video and you are explaining the key points to someone else. Never refer to the video or transcript directly.
        Follow these rules at all costs.
        
        Here is the transcript context around timestamp {screenshot.timestamp}:

{transcript_text}

{base_prompt}

Generate a structured caption in this exact format:
TOPIC HEADING: A clear, concise topic title

CONTEXT: A brief sentence providing context

KEY POINTS:
• First key point
• Second key point
• Third key point

Double check that you have always:
1) Keep each bullet point concise and actionable.
2) Avoid phrases like "In this video" or "The speaker explains" or "The speaker is discussing". 
3) Speak as if you are the person who created the content in the video and you are explaining the key points to someone else. Never refer to the video or transcript directly.
Follow these rules at all costs.

"""

        try:
            # Apply rate limiting before making API call
            await anthropic_rate_limiter.wait_if_needed()
            
            response = anthropic.messages.create(
                model="claude-3-haiku-20240307",
                max_tokens=150,
                messages=[{
                    "role": "user",
                    "content": prompt
                }]
            )
            
            caption = response.content[0].text.strip()
            
            # Before processing, check if we're dealing with the old format (TOPIC HEADING, etc.)
            if caption.startswith("TOPIC HEADING:") and "KEY POINTS:" in caption:
                # Process the old format to ensure bullet points are properly formatted
                parts = caption.split("KEY POINTS:")
                if len(parts) >= 2:
                    header = parts[0].strip()
                    key_points = parts[1].strip()
                    
                    # Extract bullet points and ensure each is on its own line
                    bullet_points = []
                    # Match bullet points that might be on the same line
                    import re
                    # This regex matches "• point" patterns, even if they're on the same line
                    points_regex = re.compile(r'•\s+([^•]+?)(?=\s+•|\s*$)')
                    matches = points_regex.findall(key_points)
                    
                    if matches:
                        # Format each bullet point with proper spacing
                        formatted_points = "\n".join([f"• {point.strip()}" for point in matches])
                        # Rebuild the caption with proper line breaks
                        caption = f"{header}\nKEY POINTS:\n{formatted_points}"
        
            # Then process any caption with bullet points to ensure proper markdown
            lines = caption.split('\n')
            formatted_lines = []
            
            for line in lines:
                line = line.strip()
                if not line:
                    # Keep empty lines for spacing
                    formatted_lines.append('')
                elif not (line.startswith('*') or line.startswith('-') or line.startswith('•')):
                    # If the line doesn't start with a bullet point, add one
                    formatted_lines.append(f"* {line}")
                else:
                    # Line already has a bullet point, keep as is
                    formatted_lines.append(line)
            
            # Join the lines back together with line breaks
            caption = '\n'.join(formatted_lines)
            
            print("Generated caption:", caption)  # Add debugging
        
            # Determine content type based on caption
            content_type = "text"  # default type
            if "slide" in caption.lower() or "presentation" in caption.lower():
                content_type = "slide"
            elif any(term in caption.lower() for term in ["demo", "demonstration", "showing", "example"]):
                content_type = "demo"
        
            result = {
                "structured_caption": caption,
                "content_type": content_type
            }
            print("Returning:", result)  # Add debugging
            return result
        
        except Exception as e:
            print(f"Caption error: {str(e)}")
            traceback.print_exc()  # Add full traceback
            raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Outer error in generate_structured_caption: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating caption: {str(e)}")

@app.get("/api/config")
async def get_config():
    """Return client-safe configuration settings"""
    return {
        "serverPort": SERVER_PORT,
        "apiVersion": "1.0",
        "hasAnthropicKey": bool(os.getenv('ANTHROPIC_API_KEY')),
        "hasYoutubeKey": bool(os.getenv('YOUTUBE_API_KEY')),
        "hasNotionKey": bool(os.getenv('NOTION_API_KEY'))
    }

@app.options("/api/{rest_of_path:path}")
async def options_route(rest_of_path: str):
    """Handle OPTIONS requests explicitly for all API routes"""
    logger.info(f"OPTIONS request for /api/{rest_of_path}")
    # Return an empty Response with appropriate CORS headers
    return Response(
        status_code=200,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, GET, DELETE, PUT, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept, Origin, Referer, User-Agent",
            "Access-Control-Max-Age": "3600",
        }
    )

@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    logger.info(f"Received request for path: {full_path}")
    
    # Skip API routes
    if (full_path.startswith("api/")):
        logger.info("Skipping API route")
        raise HTTPException(status_code=404)
    
    # Handle root path
    if not full_path or full_path == "/":
        index_path = STATIC_DIR / "index.html"
        logger.info(f"Serving root index.html from {index_path}")
        if index_path.exists():
            return FileResponse(index_path)
    
    # Check for static files
    static_file = STATIC_DIR / full_path
    if static_file.exists() and static_file.is_file():
        logger.info(f"Serving static file: {static_file}")
        return FileResponse(static_file)
    
    # Fallback to index.html for client-side routing
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        logger.info("Falling back to index.html")
        return FileResponse(index_path)
        
    # If we get here, something is wrong
    logger.error("Could not find index.html")
    raise HTTPException(status_code=404, detail="Not found")

@app.get("/api/config")
async def get_config():
    """Return client-safe configuration settings"""
    return {
        "serverPort": SERVER_PORT,
        "apiVersion": "1.0",
        "hasAnthropicKey": bool(os.getenv('ANTHROPIC_API_KEY')),
        "hasYoutubeKey": bool(os.getenv('YOUTUBE_API_KEY')),
        "hasNotionKey": bool(os.getenv('NOTION_API_KEY'))
    }

# Save video info to Notion database
@app.post('/api/save-to-notion')
async def save_to_notion(request: NotionSaveRequest):
    if not notion_service.is_configured():
        logger.error("Notion API is not configured - Missing API key or database ID")
        raise HTTPException(status_code=400, detail="Notion API is not configured. Please set NOTION_API_KEY and NOTION_DATABASE_ID in your .env file.")
    
    # Add detailed debug logging
    logger.info(f"Saving to Notion - Title: {request.title}, Video ID: {request.videoId}")
    logger.info(f"Description: {'Present' if request.description else 'None'} ({len(request.description) if request.description else 0} chars)")
    logger.info(f"Transcript: {'Present' if request.transcript else 'None'} ({len(request.transcript) if request.transcript else 0} items)")
    logger.info(f"Notes: {'Present' if request.notes else 'None'} ({len(request.notes) if request.notes else 0} chars)")
    logger.info(f"Screenshots: {'Present' if request.screenshots else 'None'} ({len(request.screenshots) if request.screenshots else 0} items)")
    logger.info(f"Transcript analysis: {'Present' if request.transcriptAnalysis else 'None'}")
    
    # Enhanced data validation and logging
    # Check transcript format if present
    if request.transcript and len(request.transcript) > 0:
        first_item = request.transcript[0]
        logger.info(f"Transcript first item type: {type(first_item).__name__}")
        logger.info(f"Transcript first item sample: {str(first_item)[:100]}")
        
        # Check if transcript has the expected structure and log warnings if not
        if isinstance(first_item, dict):
            expected_keys = ['start', 'text']
            missing_keys = [key for key in expected_keys if key not in first_item]
            if missing_keys:
                logger.warning(f"Transcript items missing expected keys: {missing_keys}")
    
    # Check screenshots format if present
    if request.screenshots and len(request.screenshots) > 0:
        first_screenshot = request.screenshots[0]
        logger.info(f"Screenshot first item type: {type(first_screenshot).__name__}")
        logger.info(f"Screenshot first item sample: {str(first_screenshot)[:100]}")
        
        # Check if screenshots have the expected structure
        if isinstance(first_screenshot, dict):
            if 'timestamp' not in first_screenshot:
                logger.warning("Screenshots missing 'timestamp' field which is important for Notion saving")
            if 'caption' not in first_screenshot and 'response' not in first_screenshot:
                logger.warning("Screenshots missing both 'caption' and 'response' fields")
    
    try:
        # Call the enhanced Notion service
        result = notion_service.save_video_to_notion(
            title=request.title,
            video_id=request.videoId,
            author=request.author,
            publisher=request.publisher,
            description=request.description,
            transcript=request.transcript,
            notes=request.notes,
            screenshots=request.screenshots,
            transcript_analysis=request.transcriptAnalysis
        )
        
        # Check for errors in the result using the new response format
        if "error" in result:
            error_message = result["error"]
            logger.error(f"Notion service returned error: {error_message}")
            raise HTTPException(status_code=500, detail=error_message)
        
        # Return successful response with any additional data provided by the service
        logger.info("Successfully saved to Notion")
        return {
            "success": True, 
            "page_id": result.get("page_id", ""),
            "page_url": result.get("page_url", ""),
            "page": result
        }
    except HTTPException:
        # Re-raise already formatted HTTP exceptions
        raise
    except Exception as e:
        logger.exception(f"Unexpected error saving to Notion: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to save to Notion: {str(e)}")

# Keep at the bottom of your file
app.mount("/", StaticFiles(directory="static", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    
    # Ensure clean host and port values
    clean_host = SERVER_HOST.strip()
    clean_port = SERVER_PORT
    
    logger.info(f"Starting server on {clean_host}:{clean_port}")
    
    try:
        uvicorn.run(
            "main:app", 
            host=clean_host,
            port=clean_port,
            reload=True
        )
    except Exception as e:
        logger.error(f"Error starting server: {e}")
        # Fallback to localhost if there's an issue
        logger.info("Trying fallback to localhost...")
        uvicorn.run(
            "main:app", 
            host="127.0.0.1",
            port=clean_port,
            reload=True
        )
