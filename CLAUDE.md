# QueryClip Development Guide

## Run Commands
- Frontend dev: `cd frontend && npm run dev`
- Frontend build and copy to static: `./buildrun.sh`
- Backend run: `python main.py`
- Build, run, and expose via ngrok: `./start-ngrok.sh`
- Setup dependencies: `./setup_dependencies.sh`
- Install frontend: `cd frontend && npm install`
- Install backend: `python -m venv venv && source venv/bin/activate && pip install -r requirements.txt`

## Docker
- Build: `docker build --platform linux/amd64 -t youtube-notes-app .`
- Run: `docker run -p 8080:8080 youtube-notes-app`

## Code Style
- Python: snake_case for functions/variables, type annotations with Pydantic, try/except for errors
- JavaScript: camelCase for variables, PascalCase for components, async/await for API calls
- React: functional components with hooks, TailwindCSS for styling
- API design: RESTful endpoints with kebab-case paths prefixed with /api
- Project structure: `/frontend` (React), `/modules` (Python modules), `/data` (storage)

No formal testing, linting, or type checking configuration found. Application is a full-stack YouTube video analysis tool with FastAPI backend and React frontend.

## Network Fixes (March 9, 2025)
- Fixed network connectivity issues when accessing from other devices on LAN
- Modified frontend URL handling to use relative paths consistently 
- Updated CORS settings on backend to accept requests from any device
- Fixed API calls to prevent double 'api' path prefixes
- Set up proper Vite proxy configuration for cross-device access

## Layout Improvements (March 9, 2025)
- Added new split-view layout mode for the application
- Button now cycles between 3 modes: normal, widescreen, and split view
- Split view mode shows video and controls on left, gallery on right
- Implemented as layoutMode state (0=normal, 1=fullwidth, 2=split)
- Added unicode button symbols for each mode: ⊡, ⊟, ⊞

## March 10, 2025 Updates

### Remote Access via ngrok
- Created a setup for accessing QueryClip remotely using ngrok tunnels
- Fixed CORS issues to allow access from ngrok domains
- Updated API URL handling to ensure proper domain/port recognition
- Added helper scripts:
  - `start-ngrok.sh` - Starts the backend and ngrok tunnel in one command
  - `clear-ngrok-sessions.sh` - Utility to clear stuck ngrok sessions
- Full documentation added in how-to-ngrok.md

## March 23, 2025 Updates

### Improved Ngrok Deployment Process
- Fixed issue where ngrok was serving outdated versions of the application
- Created automated build script (`buildrun.sh`) that properly builds frontend and copies to static directory
- Updated `start-ngrok.sh` to run the build script automatically before starting
- Added clear instructions for both automated and manual deployment processes
- Ensured all new features (like video history) work properly when deployed via ngrok
- Added troubleshooting steps for common deployment issues

### Mobile & Print Improvements
- Fixed capture controls in split view mode
- Improved display of transcript outlines on mobile devices
  - Removed scrolling behavior for outlines to show complete content
  - Made outlines fully visible for screenshots/markup on mobile
  - Ensured proper spacing and formatting across device sizes
- Enhanced print functionality
  - Modified print system to always use mobile layout for better printouts
  - Added explicit mobile viewport emulation to print iframe
  - Optimized image sizes and text formatting for printing
  - Fixed spacing and margin issues for consistent print output

### Bug Fixes
- Fixed issue where video title would sometimes be replaced by last chapter title
  - Problem: The backend code was reusing the same variable for both video title and chapter titles
  - Solution: Separated video title and chapter title variables to prevent overwriting
  - Impact: Video title now always displays correctly in the UI and when saving content

### Mobile Video Enhancements (March 10, 2025)
- Fixed issue where videos would stop playing when app goes to background on mobile
- Implemented Picture-in-Picture (PiP) support for mobile playback
  - Videos now continue playing when user switches to another app
  - Automatically attempts to enter PiP mode when app goes to background
  - Preserves playback state when returning to app
- Implementation details:
  - Added `picture_in_picture: 1` parameter to YouTube player
  - Added visibility change event listeners to detect app state
  - Used mobile device detection to enable PiP on appropriate platforms
  - Enhanced iframe permissions with `allow="picture-in-picture"` attribute
  - Added fallback for continued playback when PiP is not available

### Files Modified
- Backend:
  - `main.py` - Fixed CORS for ngrok, fixed video title bug
- Frontend:
  - `App.jsx` - Added capture controls to split view, fixed transcript outline display, enhanced split view player with PiP support
  - `YouTubePlayer.jsx` - Added Picture-in-Picture support and background playback handling
  - `NotesManager.jsx` - Enhanced print functionality with mobile layout
  - `exportUtils.js` - Updated print styles for mobile-optimized output
  - `ExportStyles.css` - Improved print styling
- Scripts:
  - Added `start-ngrok.sh` and `clear-ngrok-sessions.sh`
  - Added `how-to-ngrok.md` documentation

## Video History Feature (March 19, 2025)

### Overview
- Added persistent video history with database storage
- Created history browsing interface with thumbnails and metadata
- Implemented detailed history view with transcript, analysis, and notes
- Added automatic history tracking for all viewed videos

### Backend Implementation
- Added `VideoHistoryItem` data model for storing history information
- Created JSON-based persistent storage in `data/history.json`
- Added RESTful API endpoints for history management:
  - `/api/video-history` - Get/add video history
  - `/api/video-history/{video_id}` - Get/update/delete specific history item
- Automatically records video metadata, transcript text, and analysis

### Frontend Implementation
- Added React Router for navigation between main app and history
- Created history list view with thumbnail previews
- Implemented detailed history view with tabs for different content
- Added ability to load videos directly from history
- Updated navigation with history access link
- Automatic content tracking:
  - Saves transcript text, analysis, notes
  - Tracks screenshot count
  - Records query responses

### User Experience Improvements
- Direct video loading from history list
- Detailed view of past video content
- Ability to delete unwanted history items
- Automatic content organization

## 3/9/25 wrap up notes:
Conversation Summary

  We improved the QueryClip application, a YouTube video screenshot/caption tool with React frontend and FastAPI backend, in two key
   areas:

  1. Network Connectivity Fix

  - Fixed issue where the app worked on host machine but not from other LAN devices
  - Problems identified: hardcoded "localhost" URLs, CORS issues, double "/api" path prefixes
  - Solutions implemented:
    - Modified CORS settings in main.py to accept cross-origin requests
    - Updated frontend URL handling to use relative paths (/api/...)
    - Changed Vite proxy config to bind to all network interfaces
    - Removed all hardcoded references to localhost

  2. Split View Layout Implementation

  - Added a new UI layout mode with 3 options: normal, widescreen, split view
  - Split view places video/controls on left, screenshot gallery on right
  - Implementation:
    - Added layoutMode state (0=normal, 1=widescreen, 2=split)
    - Created custom CSS with .split-view-gallery class to force single-column display
    - Fixed JSX errors with proper closing tags and indentation
    - Embedded YouTube player directly in left column
    - Added clear section separation

  Key Files Modified:

  - /main.py - Backend CORS settings
  - /frontend/src/App.jsx - Main layout and component structure
  - /frontend/src/config.js - API URL configuration
  - /frontend/src/styles/appStyles.js - CSS for layout modes
  - /frontend/vite.config.js - Dev server configuration

  Current Status:

  - Network connectivity issues fixed - app works from LAN devices
  - Layout modes working with three options via toggle button
  - Split view displays video on left, single-column gallery on right

  This setup now allows for more efficient screenshot management with proper cross-device functionality.