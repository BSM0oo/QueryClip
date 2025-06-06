# YouTube Notes Application Guide

## Overview
This application allows users to take smart notes while watching YouTube videos. It combines video playback, automatic transcription, screenshot capture, and AI-powered caption generation to create comprehensive study materials.

## Core Features
- YouTube video playback with synchronized transcript
- Screenshot capture with context
- AI-powered caption generation using Claude
- Note-taking for both screenshots and global context
- Export to multiple formats (Markdown, PDF, RTF)

## Technical Architecture

### Frontend (React)
- `App.jsx`: Main application component handling state and user interactions
- `YouTubePlayer.jsx`: Custom YouTube player component using YouTube IFrame API

### Backend (FastAPI)
- Python-based API server handling various functionalities
- Key endpoints:
  ```
  GET  /api/transcript/{video_id}  - Fetches video transcript
  POST /api/capture-screenshot     - Captures video screenshots
  POST /api/generate-caption       - Generates AI captions
  POST /api/export-rtf            - Exports notes to RTF
  POST /api/export-pdf            - Exports notes to PDF
  ```

### External Services Integration
1. **YouTube Data**
   - Uses `youtube-transcript-api` for transcript fetching
   - YouTube IFrame API for video playback

2. **Anthropic Claude API**
   - Integrates with Claude 3 Sonnet for caption generation
   - Uses context-aware prompting for relevant captions

## Data Flow
1. User enters YouTube URL
2. Application extracts video ID and loads:
   - Video player
   - Video transcript
   - Synchronized transcript highlighting

3. Screenshot Workflow:
   - User captures screenshot
   - Backend processes video frame
   - Gets surrounding transcript context
   - Sends to Claude for caption generation
   - Returns combined data to frontend

4. Notes Management:
   - Global notes for entire video
   - Per-screenshot notes
   - Context-aware transcript segments
   - Custom AI prompting options

## Export Functionality
Supports multiple export formats:
- Markdown: Direct text export
- PDF: Converted using pypandoc
- RTF: Formatted rich text export

## Technical Requirements
- Frontend: React with Tailwind CSS
- Backend: Python 3.x with FastAPI
- APIs: Anthropic API key
- Dependencies: youtube-transcript-api, playwright, pypandoc

## Communication Flow
```
Frontend <-> FastAPI Backend <-> External Services
           |                  |
           |- YouTube API     |- Anthropic API
           |- Transcript API  |- File Conversion
```

# Code Walkthrough: App.jsx Explained

### State Management
The app uses React's `useState` to keep track of various pieces of information:
- `videoId`: Stores the current YouTube video identifier
- `screenshots`: Array that holds all captured screenshots
- `notes`: Stores user's written notes
- `player`: Reference to the YouTube player instance
- `transcript`: Holds the video's text transcript
- `loading` & `error`: Handle loading states and error messages
- `currentTime`: Tracks current video timestamp

### Key Components

1. **Video Player Integration**
   - YouTubePlayer component embeds the actual video
   - Player controls are managed through YouTube's IFrame API
   - Video state (play/pause/time) is synchronized with the app

2. **Screenshot System**
   - Uses html2canvas to capture video frames
   - Each screenshot is stored with:
     - Timestamp
     - Generated caption
     - User notes
     - Surrounding transcript context

3. **AI Caption Generation**
   - Custom prompt system for Claude AI
   - Takes surrounding transcript context
   - Generates relevant captions for screenshots
   - Uses Anthropic's API through backend

4. **Transcript Management**
   - Fetches transcript when video loads
   - Synchronizes with video playback
   - Highlights current section being played
   - Provides context for AI captions

### Data Flow in App.jsx
1. User enters YouTube URL → App extracts video ID
2. App loads video player and fetches transcript
3. User can:
   - Take screenshots (captures frame + context)
   - Add notes (global or per screenshot)
   - Customize AI prompts
   - Export notes in various formats

### Error Handling
- Loading states show progress
- Error messages display user-friendly notifications
- Graceful fallbacks for missing data
- Network request error handling

### User Interface Elements
- Video player with controls
- Transcript display (toggleable)
- Screenshot gallery
- Notes editor
- Custom prompt editor
- Export options

This structure makes the app modular and maintainable, with clear separation between:
- User interface components
- Data management (state)
- External service integration
- Error handling