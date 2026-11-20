#!/usr/bin/env bash
set -e

cleanup() {
    echo "Shutting down ChickCheck services..."
    kill -TERM "$BACKEND_PID" 2>/dev/null || true
    kill -TERM "$FRONTEND_PID" 2>/dev/null || true
    wait "$BACKEND_PID" 2>/dev/null || true
    wait "$FRONTEND_PID" 2>/dev/null || true
    exit 0
}
trap cleanup SIGTERM SIGINT

# Run database migrations
echo "Applying database schema migrations..."
alembic upgrade head || true

# Start FastAPI Backend in background on 127.0.0.1:8001
echo "Starting Backend API on 127.0.0.1:8001..."
uvicorn backend.app.main:app --host 127.0.0.1 --port 8001 &
BACKEND_PID=$!

# Start Next.js Frontend on 0.0.0.0:$PORT
FRONTEND_PORT="${PORT:-3000}"
echo "Starting Next.js Frontend on 0.0.0.0:${FRONTEND_PORT}..."
export PORT="$FRONTEND_PORT"
export HOSTNAME="0.0.0.0"

cd /app/frontend
node server.js &
FRONTEND_PID=$!

# Wait for either process to exit
wait -n "$BACKEND_PID" "$FRONTEND_PID"
