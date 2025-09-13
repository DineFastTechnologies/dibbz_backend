#!/bin/bash

# Kill any existing node processes on port 3000
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# Start the simple backend
echo "Starting Dibbz Backend (Simple Version)..."
node index-simple.js
