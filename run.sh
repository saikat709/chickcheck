#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=========================================================="
echo "         Starting ChickCheck (Ubuntu Linux Runner)        "
echo "=========================================================="

# 1. Check Python and Node
if ! command -v python3 &> /dev/null; then
    echo "[ERROR] python3 is required but not installed." >&2
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "[ERROR] npm is required but not installed." >&2
    exit 1
fi

# 2. Check video source
VIDEO_FILE="${VIDEO_SOURCE:-samples/dummy.mp4}"
if [[ "$VIDEO_FILE" != rtsp://* && "$VIDEO_FILE" != http://* && "$VIDEO_FILE" != https://* ]]; then
    if [ ! -f "$VIDEO_FILE" ]; then
        echo ""
        echo "[FATAL ERROR] Video source file '$VIDEO_FILE' was not found!" >&2
        echo "Please place your livestock video at '$VIDEO_FILE' or configure VIDEO_SOURCE in .env" >&2
        exit 1
    fi
fi

# 3. Setup Virtual Environment
if [ ! -d ".venv" ]; then
    echo "Creating Python virtual environment in .venv..."
    python3 -m venv .venv
    .venv/bin/pip install --upgrade pip
    .venv/bin/pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu --no-cache-dir
    .venv/bin/pip install -r backend/requirements.txt --no-cache-dir
fi

# 4. Run database migrations
echo "Applying database schema migrations..."
export PYTHONPATH="$SCRIPT_DIR"
.venv/bin/alembic upgrade head

# 5. Frontend node_modules
if [ ! -d "frontend/node_modules" ]; then
    echo "Installing frontend dependencies..."
    (cd frontend && npm install)
fi

# 6. Cleanup handler for graceful shutdown
cleanup() {
    echo ""
    echo "Shutting down ChickCheck backend and frontend services..."
    if [ -n "$BACKEND_PID" ]; then
        kill "$BACKEND_PID" 2>/dev/null || true
    fi
    if [ -n "$FRONTEND_PID" ]; then
        kill "$FRONTEND_PID" 2>/dev/null || true
    fi
    wait
    echo "All services stopped."
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# 7. Start Backend
BACKEND_PORT="${PORT:-8001}"
echo "Starting Backend API server on http://127.0.0.1:${BACKEND_PORT}..."
.venv/bin/uvicorn backend.app.main:app --host 0.0.0.0 --port "${BACKEND_PORT}" --reload --reload-dir backend/app &
BACKEND_PID=$!

# Wait briefly for backend to initialize
sleep 2

# 8. Start Frontend
echo "Starting Next.js Frontend on http://127.0.0.1:3000..."
(cd frontend && npm run dev) &
FRONTEND_PID=$!

echo ""
echo "=========================================================="
echo " ChickCheck is running!"
echo " Dashboard: http://localhost:3000"
echo " API Docs : http://localhost:${BACKEND_PORT}/docs"
echo " Stream   : http://localhost:${BACKEND_PORT}/api/stream/video"
echo "=========================================================="
echo "Press Ctrl+C to terminate both servers."

wait
