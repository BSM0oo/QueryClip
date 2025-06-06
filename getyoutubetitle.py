import re
from typing import Optional
from pytube import YouTube
from pytube.exceptions import PytubeError

def get_youtube_title(url: str) -> Optional[str]:
    """
    Extract the title of a YouTube video from its URL.
    
    Args:
        url (str): The YouTube video URL. Can be in either youtube.com or youtu.be format.
    
    Returns:
        Optional[str]: The title of the video if successful, None if an error occurs.
    
    Raises:
        ValueError: If the URL is not a valid YouTube URL.
    """
    # Regular expression patterns for YouTube URLs
    youtube_patterns = [
        r'^https?://(?:www\.)?youtube\.com/watch\?v=[\w-]+',
        r'^https?://(?:www\.)?youtube\.com/v/[\w-]+',
        r'^https?://youtu\.be/[\w-]+'
    ]
    
    # Check if URL matches any valid YouTube URL pattern
    if not any(re.match(pattern, url) for pattern in youtube_patterns):
        raise ValueError("Invalid YouTube URL format")
    
    try:
        # Create YouTube object and get video title
        yt = YouTube(url)
        return yt.title
    
    except PytubeError as e:
        print(f"Error extracting video title: {str(e)}")
        return None
    except Exception as e:
        print(f"An unexpected error occurred: {str(e)}")
        return None

def main():
    """
    Main function to demonstrate the usage of get_youtube_title function.
    """
    print("YouTube Title Extractor")
    print("----------------------")
    
    while True:
        # Get URL from user
        url = input("\nEnter YouTube URL (or 'q' to quit): ").strip()
        
        if url.lower() == 'q':
            break
        
        try:
            title = get_youtube_title(url)
            if title:
                print(f"\nVideo Title: {title}")
            else:
                print("\nFailed to retrieve video title.")
        
        except ValueError as e:
            print(f"\nError: {str(e)}")

if __name__ == "__main__":
    main()