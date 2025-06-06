import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Server configuration
SERVER_HOST = os.getenv("SERVER_HOST", "127.0.0.1")  # Default to localhost instead of 0.0.0.0
SERVER_PORT = int(os.getenv("SERVER_PORT", "8000"))  # Default port 8000

# Frontend URL for CORS
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")  # Common Vite default port

# CORS settings
CORS_ORIGINS = os.getenv("CORS_ORIGINS", FRONTEND_URL).split(",")
if "*" in CORS_ORIGINS:
    CORS_ORIGINS = ["*"]
