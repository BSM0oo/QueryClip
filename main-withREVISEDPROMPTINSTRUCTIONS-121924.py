import os
import json
import shutil
import base64
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pytube import YouTube
import youtube_transcript_api
from youtube_transcript_api import YouTubeTranscriptApi
import re
import uvicorn
from pydantic import BaseModel
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
DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)
SCREENSHOTS_DIR = DATA_DIR / "screenshots"
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
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--window-size=1920,1080")
    return webdriver.Chrome(options=chrome_options)

@app.get("/api/transcript/{video_id}")
async def get_transcript(video_id: str):
    """Get transcript for a YouTube video"""
    try:
        transcript = YouTubeTranscriptApi.get_transcript(video_id)
        return {"transcript": transcript}
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

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
    """Clear all saved state"""
    try:
        screenshots_dir = DATA_DIR / "screenshots"
        if screenshots_dir.exists():
            if eraseFiles:
                shutil.rmtree(screenshots_dir)
            else:
                pass

        state_file = DATA_DIR / "app_state.json"
        if state_file.exists():
            if eraseFiles:
                state_file.unlink()
            else:
                with open(state_file, "w") as f:
                    json.dump({}, f)

        if eraseFiles:
            DATA_DIR.mkdir(exist_ok=True)
            screenshots_dir.mkdir(exist_ok=True)

        return {"message": "State cleared successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/capture-screenshot")
async def capture_screenshot(request: VideoRequest):
    """Capture a screenshot from a YouTube video"""
    try:
        driver = init_driver()
        video_url = f'https://www.youtube.com/watch?v={request.video_id}'
        
        try:
            driver.get(video_url)
            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.ID, "movie_player"))
            )
            driver.execute_script(
                f'document.querySelector("video").currentTime = {request.timestamp};'
            )
            time.sleep(1)
            screenshot = driver.get_screenshot_as_png()
            base64_image = base64.b64encode(screenshot).decode()
            
            timestamp_str = f"{int(request.timestamp)}"
            file_path = SCREENSHOTS_DIR / f"yt_{request.video_id}_{timestamp_str}.png"
            with open(file_path, "wb") as f:
                f.write(screenshot)
            
            return {"image_data": f"data:image/png;base64,{base64_image}"}
        finally:
            driver.quit()
    except Exception as e:
        print(f"Screenshot error: {str(e)}")
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
                1. A high-level summary of the main topics (2-3 sentences)
                2. Key points and takeaways, comprehensive (bullet points)
                3. Any important technical terms or concepts mentioned
                4. Suggested sections/timestamps for review

                Transcript:
                {request.transcript}
                """
            }]
        )
        
        analysis = response.content[0].text.strip()
        return {"analysis": analysis}
    except Exception as e:
        print(f"Analysis error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)