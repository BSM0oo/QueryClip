import asyncio
from transcript_retriever import EnhancedTranscriptRetriever

async def main():
    retriever = EnhancedTranscriptRetriever()
    video_id = "m0InTgNln8w"

    print("--- Testing youtube_transcript_api ---")
    try:
        transcript = await retriever.get_transcript(video_id)
        if transcript:
            print("youtube_transcript_api SUCCEEDED")
        else:
            print("youtube_transcript_api FAILED")
    except Exception as e:
        print(f"youtube_transcript_api FAILED with error: {e}")

    print("\n--- Testing yt-dlp ---")
    try:
        # To test yt-dlp directly, we call the internal method
        transcript = retriever._get_transcript_with_yt_dlp(video_id)
        if transcript:
            print("yt-dlp SUCCEEDED")
        else:
            print("yt-dlp FAILED")
    except Exception as e:
        print(f"yt-dlp FAILED with error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
