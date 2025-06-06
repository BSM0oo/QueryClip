#!/bin/bash

# Store the root directory
ROOT_DIR=$(pwd)

# Function to setup frontend
setup_frontend() {
    echo "Setting up frontend..."
    cd frontend
    # Clean existing dependencies
    rm -rf node_modules package-lock.json
    # Install all dependencies
    npm install
    npm install vite @vitejs/plugin-react
    cd $ROOT_DIR
}

# Function to setup backend
setup_backend() {
    echo "Setting up Python environment..."
    if [ ! -d "venv" ]; then
        echo "Creating new virtual environment..."
        python3 -m venv venv
    fi

    # Check and kill any existing processes on port 8000
    echo "Checking for existing processes on port 8000..."
    PIDS=$(lsof -ti:8000)
    if [ ! -z "$PIDS" ]; then
        echo "Killing existing processes on port 8000..."
        kill $PIDS
        sleep 1
    fi

    # Create a temporary script to run in the new terminal
    TEMP_SCRIPT="$ROOT_DIR/temp_startup.sh"
    echo '#!/bin/bash' > "$TEMP_SCRIPT"
    echo "cd '$ROOT_DIR'" >> "$TEMP_SCRIPT"
    echo "source venv/bin/activate" >> "$TEMP_SCRIPT"
    echo "pip install -r requirements.txt" >> "$TEMP_SCRIPT"
    echo "python main.py" >> "$TEMP_SCRIPT"
    chmod +x "$TEMP_SCRIPT"

    # Open a new terminal and run the temporary script
    osascript -e 'tell app "Terminal"
        do script "\"'"$TEMP_SCRIPT"'\"" 
    end tell'

    # Wait a moment before cleaning up
    sleep 2
    rm "$TEMP_SCRIPT"
}

# Display menu
echo "What would you like to setup?"
echo "1) Frontend only"
echo "2) Backend only"
echo "3) Both frontend and backend"
echo "Please enter your choice (1-3):"

# Read user input
read choice

# Process the choice
case $choice in
    1)
        setup_frontend
        ;;
    2)
        setup_backend
        ;;
    3)
        setup_frontend
        setup_backend
        ;;
    *)
        echo "Invalid choice. Please run the script again and select 1, 2, or 3."
        exit 1
        ;;
esac

echo "Setup completed!"
