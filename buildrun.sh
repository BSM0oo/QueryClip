#!/bin/bash
set -e
# to start, run buildrun.sh, then python main.py, then run ./start-ngrok.sh which runs ngrok http 8991 --domain=BSM0oo.ngrok.io
echo "===== Building QueryClip Application ====="

# Step 1: Build the frontend
echo "🔨 Building frontend..."
cd frontend
npm run build

# Step 2: Copy built files to static directory
echo "📋 Copying build files to static directory..."
cd ..
mkdir -p static/assets
rm -rf static/assets/*
cp -r frontend/dist/* static/

echo "✅ Build complete! All files copied to static directory."
echo "🚀 To run: python main.py"
echo "🌐 To expose via ngrok: ngrok http 8991"
