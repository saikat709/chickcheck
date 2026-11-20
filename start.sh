#!/usr/bin/env bash
set -e

cleanup() {
    echo "Shutting down Khamar Prohori services..."
    kill -TERM "$BACKEND_LOOP_PID" 2>/dev/null || true
    kill -TERM "$FRONTEND_PID" 2>/dev/null || true
    pkill -f uvicorn 2>/dev/null || true
    wait 2>/dev/null || true
    exit 0
}
trap cleanup SIGTERM SIGINT

# 1. Run database migrations
echo "Applying database schema migrations..."
alembic upgrade head || true

# 2. Start FastAPI Backend in background supervisor loop
run_backend() {
    while true; do
        echo "Starting Backend API on 127.0.0.1:8001..."
        uvicorn backend.app.main:app --host 127.0.0.1 --port 8001 || true
        echo "Backend process exited with code $?. Restarting in 2 seconds..."
        sleep 2
    done
}

run_backend &
BACKEND_LOOP_PID=$!

# 3. Wait briefly for backend to initialize before opening frontend
echo "Waiting for Backend to become ready on http://127.0.0.1:8001..."
for i in $(seq 1 30); do
    if curl -s http://127.0.0.1:8001/api/health > /dev/null 2>&1; then
        echo "Backend is ready!"
        break
    fi
    sleep 1
done

# 4. Start Next.js Frontend on 0.0.0.0:$PORT
FRONTEND_PORT="${PORT:-3000}"
echo "Starting Next.js Frontend on 0.0.0.0:${FRONTEND_PORT}..."
export PORT="$FRONTEND_PORT"
export HOSTNAME="0.0.0.0"

cd /app/frontend
node server.js &
FRONTEND_PID=$!

# Wait for frontend process
wait "$FRONTEND_PID"
