#!/bin/bash

# First, build the application to ensure we have the latest version
echo "===== Building QueryClip Application ====="
./buildrun.sh
echo ""

# Check if there's an ngrok session running on the dashboard
echo "Checking for orphaned ngrok sessions..."
echo "If you see sessions at https://dashboard.ngrok.com/tunnels, please stop them manually"
echo "Press Enter to continue..."
read

# Stop any running ngrok processes locally
echo "Stopping any local ngrok processes..."
pkill -f ngrok
sleep 2

# Kill any remaining processes by port 
echo "Checking for processes using port 8991..."
lsof -i :8991 | awk 'NR>1 {print $2}' | xargs -r kill
sleep 1

# Activate the virtual environment with full path to python
echo "Activating Python virtual environment..."
source venv20250227/bin/activate
PYTHON_PATH="$(which python)"

if [ -z "$PYTHON_PATH" ]; then
    echo "Python not found in virtual environment. Using system Python..."
    PYTHON_PATH="python3"
fi

echo "Using Python: $PYTHON_PATH"

# Make sure we're in the right directory
cd "$(dirname "$0")"

# Check if the backend is running, start it if not
if ! pgrep -f "python main.py" > /dev/null; then
    echo "Starting backend server..."
    $PYTHON_PATH main.py &
    # Wait for backend to start
    sleep 3
fi

# Clear possibly stuck ngrok sessions from dashboard
echo ""
echo "IMPORTANT: Before continuing, visit https://dashboard.ngrok.com/tunnels"
echo "If you see any active tunnels there, press Ctrl+C now and stop them first"
echo "Then run this script again"
echo ""
echo "Press Enter to continue with starting ngrok..."
read

# Start ngrok tunnel
echo "Starting ngrok tunnel to port 8991..."
ngrok http 8991 --domain=BSM0oo.ngrok.io


# Display instructions
echo "Press Ctrl+C to stop the ngrok tunnel"
echo "The backend server will continue running in the background"
echo "To stop the backend server, run: pkill -f 'python main.py'"