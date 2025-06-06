#!/bin/bash

echo "==== NGROK SESSION CLEANUP TOOL ===="
echo ""
echo "This script will help you clean up stuck ngrok sessions."
echo ""

# Kill local ngrok processes
echo "Step 1: Killing all local ngrok processes..."
pkill -9 -f ngrok
sleep 2
echo "Done."
echo ""

# Check if any local ngrok processes remain
if pgrep -f ngrok > /dev/null; then
    echo "WARNING: Some ngrok processes are still running. Trying to force kill..."
    pkill -9 -f ngrok
    sleep 1
    
    if pgrep -f ngrok > /dev/null; then
        echo "ERROR: Unable to kill all ngrok processes. Please check manually with:"
        echo "ps aux | grep ngrok"
        exit 1
    fi
fi

echo "Step 2: Please check the ngrok dashboard for any stuck sessions:"
echo "https://dashboard.ngrok.com/tunnels"
echo ""
echo "If you see any active tunnels there, you need to stop them manually in the dashboard."
echo ""
echo "Once you've confirmed all sessions are stopped in the dashboard, press Enter to continue..."
read

echo "Step 3: Restarting ngrok with a test tunnel to port 8080..."
echo "This sometimes helps clear stuck sessions. Press Ctrl+C after 5 seconds."
echo ""
echo "Starting in 3 seconds..."
sleep 3

# Try to start a test tunnel that will be immediately canceled
timeout 5 ngrok http 8080 || true
echo ""
echo "Cleanup completed. Now you should be able to run your ngrok tunnel."
echo ""
echo "To start a new tunnel to port 8991, run:"
echo "ngrok http 8991"
echo ""