#!/bin/bash

# Start QueryClip with a static ngrok domain
# Created on April 29, 2025

# Configuration
QUERYCLIP_DIR="/Users/williamsmith/QueryClip-v3-20250320"
QUERYCLIP_PORT=8991
# Replace with your actual reserved domain from ngrok dashboard
NGROK_DOMAIN="BSM0oo.ngrok.dev"

# Navigate to QueryClip directory
cd ""

# Activate virtual environment
source new_venv/bin/activate

# Start QueryClip in the foreground
echo "Starting QueryClip..."
uvicorn main:app --host 0.0.0.0 --port 8991 --reload
