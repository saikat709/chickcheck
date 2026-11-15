.PHONY: all install migrate test benchmark dev run build clean docker-up docker-down

PYTHON = .venv/bin/python3
PIP = .venv/bin/pip
ALEMBIC = .venv/bin/alembic
PYTEST = .venv/bin/pytest

all: install migrate test build

install:
	@if [ ! -d ".venv" ]; then python3 -m venv .venv; fi
	$(PIP) install --upgrade pip
	$(PIP) install torch torchvision --index-url https://download.pytorch.org/whl/cpu --no-cache-dir
	$(PIP) install -r backend/requirements.txt --no-cache-dir
	cd frontend && npm install

migrate:
	PYTHONPATH=. $(ALEMBIC) upgrade head

test:
	PYTHONPATH=. $(PYTEST) -v

benchmark:
	PYTHONPATH=. $(PYTHON) scripts/benchmark.py --video samples/dummy.mp4 --process-every-n 2 --imgsz 640

dev:
	./run.sh

build:
	cd frontend && npm run build

docker-up:
	docker compose up --build -d

docker-down:
	docker compose down -v

clean:
	rm -rf .pytest_cache data/chickcheck.db data/snapshots/* data/clips/* data/reports/*
	find . -type d -name "__pycache__" -exec rm -rf {} +

