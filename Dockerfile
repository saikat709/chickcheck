# Stage 1: Build Next.js frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
ENV NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8001
RUN npm run build

# Stage 2: Final runner with Python 3.12 and Node.js
FROM python:3.12-slim

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsm6 \
    libxext6 \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy Node.js binary and runtime from official node image
COPY --from=node:20-bookworm-slim /usr/local /usr/local

WORKDIR /app

# Install Python backend dependencies
COPY backend/requirements.txt requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir -r requirements.txt

# Copy backend code, migrations, and samples
COPY backend/ /app/backend/
COPY alembic.ini /app/alembic.ini
COPY samples/ /app/samples/

# Copy frontend standalone build
COPY --from=frontend-builder /app/public /app/frontend/public
COPY --from=frontend-builder /app/.next/standalone /app/frontend/
COPY --from=frontend-builder /app/.next/static /app/frontend/.next/static
COPY --from=frontend-builder /app/package.json /app/frontend/package.json

# Copy and setup start script
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app
ENV NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8001
ENV HOSTNAME="0.0.0.0"

# Exposed port (Railway will map to $PORT)
EXPOSE 3000

CMD ["/app/start.sh"]
