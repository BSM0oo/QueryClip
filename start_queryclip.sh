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
source venv/bin/activate

# Start QueryClip in the background
echo "Starting QueryClip..."
python3 main.py &
QUERYCLIP_PID=0

# Give QueryClip a moment to start
sleep 2

# Start ngrok with the reserved domain
echo "Starting ngrok with reserved domain: "
ngrok http --url="" 
# # to start, ngrok http 8991 --domain=BSM0oo.ngrok.io


# When ngrok is stopped (Ctrl+C), also stop QueryClip
kill 
echo "QueryClip stopped."
