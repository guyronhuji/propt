#!/bin/bash

# Kill background processes on exit
trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT

echo "Starting Prompt Optimizer Web Platform..."

# Check conditions
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

# Determine python command (uvicorn is installed in venv)
PYTHON_CMD="uvicorn api.index:app --reload --port 8000"

# Start Python Backend
echo "Starting Backend on port 8000..."
$PYTHON_CMD &
BACKEND_PID=$!

# Wait a moment for backend
sleep 2

# Start Frontend
echo "Starting Frontend..."
pnpm dev

wait
