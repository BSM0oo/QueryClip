#!/bin/bash

# Script to apply the fixed transcript retriever

# Create backup of original file
echo "Creating backup of original transcript_retriever.py..."
cp transcript_retriever.py transcript_retriever.py.bak

# Copy the fixed implementation
echo "Applying fixed implementation..."
cp newfiles/transcript_retriever_fixed.py transcript_retriever.py

echo "Fix applied! A backup of the original file has been created as transcript_retriever.py.bak"
echo "You may now restart the server to apply the changes."
