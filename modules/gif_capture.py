from fastapi import HTTPException
from moviepy.video.io.VideoFileClip import VideoFileClip
import yt_dlp
import os
import tempfile
from typing import Optional
import logging
import time
import math

logger = logging.getLogger(__name__)

class GifCapture:
    MAX_GIF_SIZE_MB = 8  # Maximum GIF size in MB
    MAX_DIMENSION = 800  # Maximum width or height
    MIN_DIMENSION = 120  # Minimum width or height
    
    def __init__(self):
        self.temp_dir = tempfile.mkdtemp()
        
    def _validate_dimensions(self, width: int, height: int) -> tuple[int, int]:
        """Validate and adjust dimensions if needed."""
        if width > self.MAX_DIMENSION or height > self.MAX_DIMENSION:
            ratio = min(self.MAX_DIMENSION / width, self.MAX_DIMENSION / height)
            width = int(width * ratio)
            height = int(height * ratio)
            logger.info(f"Dimensions adjusted to {width}x{height} to meet size limits")
            
        if width < self.MIN_DIMENSION or height < self.MIN_DIMENSION:
            ratio = max(self.MIN_DIMENSION / width, self.MIN_DIMENSION / height)
            width = int(width * ratio)
            height = int(height * ratio)
            logger.info(f"Dimensions adjusted to {width}x{height} to meet minimum size")
            
        return width, height
    
    def _adjust_fps(self, input_fps: float, duration: float) -> int:
        """Calculate optimal FPS based on input video."""
        # For longer clips, reduce FPS to manage file size
        if duration > 5:
            target_fps = min(15, input_fps)
        else:
            target_fps = min(20, input_fps)
            
        # Round to nearest integer
        return math.ceil(target_fps)
    
    async def capture_gif(self, 
                         video_id: str, 
                         start_time: float, 
                         duration: float, 
                         fps: Optional[int] = None,
                         width: Optional[int] = 480) -> str:
        """
        Captures a GIF from a YouTube video.
        
        Args:
            video_id: YouTube video ID
            start_time: Start time in seconds
            duration: Duration of GIF in seconds
            fps: Frames per second (optional, will be calculated if not provided)
            width: Target width in pixels (height will maintain aspect ratio)
            
        Returns:
            str: Base64 encoded GIF data
        """
        temp_video_path = None
        video = None
        clip = None
        gif_path = None
        
        try:
            # Input validation
            if not 0.5 <= duration <= 10:
                raise HTTPException(
                    status_code=400,
                    detail="Duration must be between 0.5 and 10 seconds"
                )
                
            if width and (width < self.MIN_DIMENSION or width > self.MAX_DIMENSION):
                raise HTTPException(
                    status_code=400,
                    detail=f"Width must be between {self.MIN_DIMENSION} and {self.MAX_DIMENSION} pixels"
                )
            
            # Configure yt-dlp
            video_url = f"https://www.youtube.com/watch?v={video_id}"
            logger.info(f"Processing video: {video_url}")
            
            ydl_opts = {
                'format': 'best[height<=720]',
                'outtmpl': os.path.join(self.temp_dir, f'temp_video_{video_id}_{int(time.time())}.mp4'),
                'quiet': True,
                'no_warnings': True
            }
            
            # Download video
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                logger.info("Downloading video...")
                result = ydl.extract_info(video_url, download=True)
                temp_video_path = ydl.prepare_filename(result)
            
            if not os.path.exists(temp_video_path):
                raise HTTPException(status_code=500, detail="Failed to download video file")
            
            # Load video and extract metadata
            logger.info("Loading video file...")
            video = VideoFileClip(temp_video_path)
            
            # Validate and adjust time range
            if start_time < 0:
                start_time = 0
                logger.warning("Start time adjusted to 0")
                
            if start_time + duration > video.duration:
                duration = video.duration - start_time
                logger.warning(f"Duration adjusted to {duration:.1f}s to fit video length")
            
            # Extract clip
            logger.info(f"Extracting clip from {start_time:.2f}s to {start_time + duration:.2f}s")
            clip = video.subclipped(start_time, start_time + duration)
            
            # Calculate optimal FPS if not provided
            if not fps:
                fps = self._adjust_fps(video.fps, duration)
            logger.info(f"Using FPS: {fps}")
            
            # Handle resizing
            if width:
                current_height = clip.h
                current_width = clip.w
                new_height = int(width * current_height / current_width)
                
                # Validate final dimensions
                width, new_height = self._validate_dimensions(width, new_height)
                logger.info(f"Resizing to {width}x{new_height}")
                
                try:
                    clip = clip.resized(new_size=(width, new_height))
                except Exception as e:
                    logger.error(f"Resize failed: {str(e)}")
                    raise HTTPException(
                        status_code=500,
                        detail=f"Failed to resize video: {str(e)}"
                    )
            
            # Create GIF with unique name
            gif_path = os.path.join(self.temp_dir, f"output_{video_id}_{int(time.time())}.gif")
            logger.info(f"Creating GIF: {gif_path}")
            
            try:
                # Use simpler write_gif call with essential parameters
                clip.write_gif(
                    gif_path,
                    fps=fps,
                    opt='optimizeplus'  # Use optimizeplus for better quality
                )
            except Exception as e:
                logger.error(f"GIF creation failed: {str(e)}")
                # Try again with minimal parameters if first attempt fails
                try:
                    clip.write_gif(gif_path, fps=fps)
                except Exception as e:
                    logger.error(f"Fallback GIF creation failed: {str(e)}")
                    raise HTTPException(
                        status_code=500,
                        detail=f"Failed to create GIF: {str(e)}"
                    )
            
            # Check file size
            if os.path.exists(gif_path):
                file_size = os.path.getsize(gif_path) / (1024 * 1024)  # Convert to MB
                logger.info(f"GIF created successfully. Size: {file_size:.1f}MB")
                
                if file_size > self.MAX_GIF_SIZE_MB:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Generated GIF is too large ({file_size:.1f}MB). Try reducing duration or dimensions."
                    )
                
                # Read and return GIF data
                with open(gif_path, "rb") as f:
                    return f.read()
            else:
                raise HTTPException(status_code=500, detail="Failed to create GIF file")
            
        except Exception as e:
            logger.error(f"Error capturing GIF: {str(e)}", exc_info=True)
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(status_code=500, detail=f"GIF capture error: {str(e)}")
            
        finally:
            # Clean up resources
            try:
                if clip:
                    clip.close()
                if video:
                    video.close()
                    
                # Clean up temporary files
                for path in [temp_video_path, gif_path]:
                    if path and os.path.exists(path):
                        try:
                            os.remove(path)
                        except Exception as e:
                            logger.error(f"Failed to remove temporary file {path}: {str(e)}")
                    
            except Exception as e:
                logger.error(f"Error during cleanup: {str(e)}")
        
    def __del__(self):
        """Cleanup temporary directory on object destruction"""
        try:
            if os.path.exists(self.temp_dir):
                for file in os.listdir(self.temp_dir):
                    try:
                        os.remove(os.path.join(self.temp_dir, file))
                    except Exception as e:
                        logger.error(f"Error removing file {file}: {str(e)}")
                os.rmdir(self.temp_dir)
        except Exception as e:
            logger.error(f"Error cleaning up temp directory: {str(e)}")
