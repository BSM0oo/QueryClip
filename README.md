# QueryClip: YouTube Video Analysis and Note-Taking Tool

QueryClip is a powerful application designed to enhance your video learning and content creation workflow. It allows you to load YouTube videos, capture screenshots, generate AI-powered captions and summaries, take detailed notes, and organize your findings efficiently.

## Key Features

*   **Video Playback & Navigation**: Seamlessly play YouTube videos with integrated timestamp navigation.
*   **Screenshot Capture**: Easily capture single screenshots, burst shots, or create GIFs from video content.
*   **AI-Powered Insights**:
    *   Generate intelligent captions for your screenshots.
    *   Obtain summaries and outlines from video transcripts.
    *   Ask questions directly about the video content and get AI-generated answers.
*   **Transcript Management**: View synchronized transcripts, copy text with or without timestamps, and analyze full transcripts.
*   **Note-Taking**: A dedicated section for taking and organizing notes related to the video.
*   **Content Organization**:
    *   Organize screenshots in a draggable gallery.
    *   Label images with custom text overlays.
    *   Manage video chapters and descriptions.
*   **Video History**: Keep track of viewed videos, along with their associated notes, screenshots, and analyses.
*   **Export Options**: Export your work (notes, screenshots, transcripts) to various formats.
*   **Notion Integration**: Save your analyzed video content directly to a Notion database.

## Tech Stack

*   **Backend**: Python (FastAPI)
*   **Frontend**: JavaScript (React, Vite)
*   **AI**: Anthropic Claude API (for captions, summaries, Q&A)
*   **Video Processing**: Playwright (for screenshots), `yt-dlp` (for video data), MoviePy (for GIFs)
*   **Styling**: Tailwind CSS, Shadcn UI

## Setup and Running the Application

### Prerequisites

*   Node.js (v16+ recommended)
*   Python (v3.9+ recommended)
*   API Keys:
    *   Anthropic API Key
    *   YouTube Data API Key
    *   Notion API Key (optional, for Notion integration)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone <your-repository-url>
    cd QueryClip
    ```

2.  **Backend Setup:**
    *   Create a virtual environment (optional but recommended):
        ```bash
        python -m venv venv
        source venv/bin/activate  # On Windows: venv\Scripts\activate
        ```
    *   Install Python dependencies:
        ```bash
        pip install -r requirements.txt
        ```
    *   Create a `.env` file in the root directory by copying `.env.example` and fill in your API keys and desired port configurations:
        ```
        ANTHROPIC_API_KEY=your_anthropic_api_key
        YOUTUBE_API_KEY=your_youtube_api_key
        NOTION_API_KEY=your_notion_api_key
        NOTION_DATABASE_ID=your_notion_database_id

        SERVER_HOST=0.0.0.0
        SERVER_PORT=8991
        FRONTEND_URL=http://localhost:5173
        ```

3.  **Frontend Setup:**
    *   Navigate to the `frontend` directory:
        ```bash
        cd frontend
        ```
    *   Install JavaScript dependencies:
        ```bash
        npm install
        ```
    *   (Optional) Create a `.env` file in the `frontend` directory if you need to override default frontend settings (usually not required as it connects to the backend).

### Running the Application

1.  **Start the Backend Server:**
    From the root project directory:
    ```bash
    python main.py
    ```
    The backend will typically run on `http://localhost:8991` (or the port specified in your `.env`).

2.  **Start the Frontend Development Server:**
    From the `frontend` directory (in a new terminal):
    ```bash
    npm run dev
    ```
    The frontend will typically run on `http://localhost:5173`. Open this URL in your browser.

Alternatively, you can use the provided shell scripts:
*   `./buildrun.sh`: Builds the frontend and copies static files for the backend to serve.
*   `./start_queryclip.sh`: (Assumed to run `buildrun.sh`, activate environment, and start `python main.py`).

## API Endpoints

The backend provides the following RESTful API endpoints (base URL: `http://localhost:{SERVER_PORT}/api`):

*   **Video History:**
    *   `GET /video-history`: List all videos in history.
    *   `GET /video-history/{video_id}`: Get specific video history.
    *   `POST /video-history`: Add or update video in history.
    *   `DELETE /video-history/{video_id}`: Remove video from history.
*   **Transcript:**
    *   `GET /transcript/{video_id}`: Retrieve transcript for a video.
    *   `POST /analyze-transcript`: Analyze transcript for key points.
    *   `POST /query-transcript`: Ask questions about a transcript.
*   **Screenshots & GIFs:**
    *   `POST /capture-screenshot`: Capture a screenshot.
    *   `POST /generate-caption`: Generate AI caption for a screenshot.
    *   `POST /generate-structured-caption`: Generate a structured AI caption.
    *   `POST /capture-gif`: Capture a GIF.
    *   `POST /cleanup-screenshots`: Trigger cleanup of old screenshots.
*   **Video Information:**
    *   `GET /video-info/{video_id}`: Get video details (title, description, chapters).
*   **Notion Integration:**
    *   `POST /save-to-notion`: Save content to Notion.
*   **Application State & Configuration:**
    *   `GET /state/load`: Load application state.
    *   `POST /state/save`: Save application state.
    *   `DELETE /state/clear`: Clear saved state.
    *   `GET /config`: Get client-safe configuration.

## Project Structure Overview

```
QueryClip/
├── .env                  # Backend environment variables
├── .gitignore            # Files and directories to ignore in Git
├── main.py               # FastAPI backend server
├── requirements.txt      # Python dependencies
├── config.py             # Backend configuration loader
├── transcript_retriever.py # Module for fetching YouTube transcripts
├── modules/              # Additional backend modules (e.g., gif_capture.py)
│   └── gif_capture.py
├── notion_service.py     # Service for Notion integration
├── data/                 # Directory for persistent data (e.g., history.json, screenshots)
│   ├── history.json
│   └── screenshots/
├── static/               # Directory for serving built frontend files
├── frontend/             # React frontend application
│   ├── .env              # Frontend environment variables (optional)
│   ├── package.json      # Frontend dependencies and scripts
│   ├── vite.config.js    # Vite configuration
│   ├── index.html        # Main HTML file for the SPA
│   └── src/              # Frontend source code
│       ├── App.jsx       # Main React application component
│       ├── main.jsx      # Frontend entry point
│       ├── components/   # Reusable UI components
│       ├── features/     # Feature-specific components and logic
│       ├── hooks/        # Custom React hooks
│       ├── layouts/      # Layout components
│       ├── services/     # API service integrations
│       ├── styles/       # CSS and styling
│       └── utils/        # Utility functions
└── README.md             # This file
```

## Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues.

## License

This project is licensed under the [MIT License](LICENSE).
