from pytube import YouTube
import youtube_transcript_api
from youtube_transcript_api import YouTubeTranscriptApi
import re
import os
import json
import base64
from pathlib import Path
import uvicorn
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import cv2
import numpy as np
import requests
from PIL import Image
import io
import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from anthropic import Anthropic
from dotenv import load_dotenv
from transcript_retriever import EnhancedTranscriptRetriever

# Load environment variables
load_dotenv()

# Initialize Anthropic client with API key from environment variable
anthropic = Anthropic(
    api_key=os.getenv('ANTHROPIC_API_KEY')
)

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create data directory if it doesn't exist
DATA_DIR = Path('data')
DATA_DIR.mkdir(exist_ok=True)
SCREENSHOTS_DIR = DATA_DIR / 'screenshots'
SCREENSHOTS_DIR.mkdir(exist_ok=True)

class VideoRequest(BaseModel):
    video_id: str
    timestamp: float

class CaptionRequest(BaseModel):
    timestamp: float
    image_data: str
    transcript_context: str
    prompt: Optional[str] = None

class QuestionRequest(BaseModel):
    transcript: str
    question: str
    timestamp: float

class TranscriptAnalysisRequest(BaseModel):
    transcript: str

def init_driver():
    try:
        chrome_options = Options()
        chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--window-size=1920,1080")
        chrome_options.add_argument("--disable-gpu")  # Added for stability
        chrome_options.add_argument("--disable-software-rasterizer")  # Added for stability
        chrome_options.add_argument("--start-maximized")
        chrome_options.add_argument("--disable-infobars")
        chrome_options.add_argument("--disable-extensions")
        driver = webdriver.Chrome(options=chrome_options)
        driver.set_script_timeout(30)  # Increase script timeout to 30 seconds
        driver.set_page_load_timeout(30)  # Increase page load timeout to 30 seconds
        return driver
    except Exception as e:
        print(f"Failed to initialize Chrome driver: {str(e)}")
        raise

@app.get("/api/transcript/{video_id}")
async def get_transcript(video_id: str):
    """Get transcript for a YouTube video using enhanced retrieval system"""
    try:
        print(f"Attempting to get transcript for video ID: {video_id}")
        
        transcript_retriever = EnhancedTranscriptRetriever()
        transcript = await transcript_retriever.get_transcript(video_id)
        
        if transcript:
            return {"transcript": transcript}
        else:
            raise HTTPException(
                status_code=404,
                detail="No transcript could be retrieved"
            )
            
    except Exception as e:
        print(f"Transcript error: {str(e)}")
        error_msg = f"Could not get transcript: {str(e)}"
        if "No transcript found" in str(e):
            error_msg = "No transcript/captions available for this video"
        raise HTTPException(status_code=404, detail=error_msg)

@app.post("/api/capture-screenshot")
async def capture_screenshot(request: VideoRequest):
    """Capture a screenshot from a YouTube video"""
    driver = None
    max_retries = 3
    current_try = 0
    
    while current_try < max_retries:
        try:
            current_try += 1
            print(f"Screenshot attempt {current_try} of {max_retries}")
            
            driver = init_driver()
            video_url = f'https://www.youtube.com/watch?v={request.video_id}'
            
            # Navigate to video
            print("Navigating to video...")
            driver.get(video_url)
            
            # Wait for consent dialog and click accept if present
            try:
                consent_button = WebDriverWait(driver, 5).until(
                    EC.element_to_be_clickable((By.XPATH, "//button[@aria-label='Accept all']"))
                )
                consent_button.click()
            except:
                print("No consent dialog found or already accepted")
            
            # Wait for video player with increased timeout
            print("Waiting for video player...")
            player = WebDriverWait(driver, 20).until(
                EC.presence_of_element_located((By.ID, "movie_player"))
            )
            
            # Wait for video element
            print("Waiting for video element...")
            video_element = WebDriverWait(driver, 20).until(
                EC.presence_of_element_located((By.TAG_NAME, "video"))
            )
            
            # Improved seeking logic with explicit waits
            print(f"Seeking to timestamp {request.timestamp}...")
            seek_success = driver.execute_script("""
                return new Promise((resolve) => {
                    const video = document.querySelector('video');
                    if (!video) {
                        resolve(false);
                        return;
                    }
                    
                    // Force video ready state
                    video.play().then(() => {
                        video.pause();
                        video.currentTime = arguments[0];
                        
                        let checkReady = () => {
                            if (video.readyState >= 3) {
                                setTimeout(() => resolve(true), 500);
                            } else {
                                setTimeout(checkReady, 100);
                            }
                        };
                        
                        checkReady();
                        
                        // Fallback timeout
                        setTimeout(() => resolve(false), 10000);
                    }).catch(() => resolve(false));
                });
            """, request.timestamp)
            
            if not seek_success:
                raise Exception("Failed to seek to timestamp")
            
            # Take screenshot with retry
            print("Taking screenshot...")
            max_screenshot_attempts = 3
            screenshot = None
            
            for attempt in range(max_screenshot_attempts):
                try:
                    screenshot = video_element.screenshot_as_png
                    if screenshot:
                        break
                except Exception as e:
                    print(f"Screenshot attempt {attempt + 1} failed: {e}")
                    time.sleep(1)
            
            if not screenshot:
                raise Exception("Failed to capture screenshot after multiple attempts")
            
            # Process and return screenshot
            base64_image = base64.b64encode(screenshot).decode()
            timestamp_str = f"{int(request.timestamp)}"
            file_path = SCREENSHOTS_DIR / f"yt_{request.video_id}_{timestamp_str}.png"
            
            with open(file_path, "wb") as f:
                f.write(screenshot)
            
            print("Screenshot captured successfully")
            return {"image_data": f"data:image/png;base64,{base64_image}"}
            
        except Exception as e:
            print(f"Screenshot attempt {current_try} failed: {str(e)}")
            if current_try >= max_retries:
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to capture screenshot after {max_retries} attempts: {str(e)}"
                )
            time.sleep(2)  # Wait before retry
            
        finally:
            if driver:
                try:
                    driver.quit()
                except Exception as e:
                    print(f"Error closing driver: {str(e)}")

@app.post("/api/state/save")
async def save_state(data: dict):
    """Save application state to file system"""
    try:
        # Save screenshots as individual files
        screenshots_dir = DATA_DIR / "screenshots"
        screenshots_dir.mkdir(exist_ok=True)
        
        if "screenshots" in data:
            for idx, screenshot in enumerate(data["screenshots"]):
                image_data = screenshot.get("image")
                if image_data and isinstance(image_data, str):
                    image_path = screenshots_dir / f"screenshot_{idx}.png"
                    if "," in image_data:
                        image_data = image_data.split(",")[1]
                    try:
                        image_bytes = base64.b64decode(image_data)
                        with open(image_path, "wb") as f:
                            f.write(image_bytes)
                        screenshot["image"] = f"screenshot_{idx}.png"
                    except Exception as e:
                        print(f"Error saving screenshot {idx}: {e}")

        state_file = DATA_DIR / "app_state.json"
        with open(state_file, "w") as f:
            json.dump(data, f)

        return {"message": "State saved successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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

@app.delete("/api/state/clear")
async def clear_state(eraseFiles: bool = Query(False)):
    """Clear all saved state and optionally delete files"""
    try:
        print(f"Clearing state with eraseFiles={eraseFiles}")  # Debug log
        
        # Handle screenshots directory
        screenshots_dir = DATA_DIR / "screenshots"
        if screenshots_dir.exists():
            if eraseFiles:
                print("Deleting screenshots directory")  # Debug log
                # Delete all files in the directory first
                for file in screenshots_dir.glob("*"):
                    try:
                        file.unlink()
                    except Exception as e:
                        print(f"Error deleting file {file}: {e}")
                # Then remove the directory itself
                try:
                    screenshots_dir.rmdir()
                except Exception as e:
                    print(f"Error removing screenshots directory: {e}")
            else:
                print("Keeping screenshot files")  # Debug log

        # Handle state file
        state_file = DATA_DIR / "app_state.json"
        if state_file.exists():
            if eraseFiles:
                print("Deleting state file")  # Debug log
                state_file.unlink()
            else:
                print("Clearing state file contents")  # Debug log
                with open(state_file, "w") as f:
                    json.dump({}, f)

        # Recreate directories if they were deleted
        if eraseFiles:
            print("Recreating directories")  # Debug log
            DATA_DIR.mkdir(exist_ok=True)
            screenshots_dir.mkdir(exist_ok=True)

        return {"message": "State cleared successfully"}
    except Exception as e:
        print(f"Error in clear_state: {e}")  # Debug log
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ask-question")
async def ask_question(request: QuestionRequest):
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

@app.post("/api/analyze-transcript")
async def analyze_transcript(request: TranscriptAnalysisRequest):
    try:
        response = anthropic.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=1000,
            messages=[{
                "role": "user",
                "content": f"""Analyze this video transcript and provide:
                1. A high-level summary of the main topics 
                2. Key points and takeaways, comprehensive (bullet points)
                3. Names and descriptions of drills or exercises mentioned
                4. Any important technical terms or concepts mentioned
                4. Suggested sections/timestamps for review

                Transcript:
                {request.transcript}
                """
            }]
        )
        
        analysis = response.content[0].text.strip()
        return {"analysis": analysis}
    except Exception as e:
        print(f"Analysis error: {str(e)}")  # Debug log
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-caption")
async def generate_caption(screenshot: CaptionRequest):
    try:
        transcript_text = screenshot.transcript_context.strip()
        if not transcript_text:
            raise HTTPException(status_code=400, detail="No transcript context provided")

        base_prompt = screenshot.prompt if screenshot.prompt else """Generate a concise and informative caption for this moment in the video.
            The caption should be a direct statement about the key point, without referring to the video or transcript."""

        prompt = f"""Here is the transcript context around timestamp {screenshot.timestamp}:

{transcript_text}

{base_prompt}

Generate a caption consisting of 3 bullet points that AVOIDS using introductory statements like here is a caption consisting of 3 bullet points that meet the specified criteria:
1. Makes direct, actionable statements about each of the 3 key points
2. Uses relevant technical terms or concepts
3. Avoids phrases like "The video shows...", "In this screenshot...", "The speaker explains..."
4. Avoids quoting directly from the transcript

Examples:
❌ "The video demonstrates proper golf swing technique"
✅ "Maintain a firm grip while keeping wrists relaxed during the backswing"

❌ "The speaker explains the importance of data structures"
✅ "Hash tables provide O(1) average time complexity for lookups"

Caption:"""

        response = anthropic.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=150,
            messages=[{
                "role": "user",
                "content": prompt
            }]
        )
        
        caption = response.content[0].text.strip()
        return {"caption": caption}
    except Exception as e:
        print(f"Caption error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)