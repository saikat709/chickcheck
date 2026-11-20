# CLAUDE.md — Khamar Prohori (খামার প্রহরী)
> Engineering Guidelines, Architectural Specifications & Agent Memory Bank

---

## 🌾 1. Project Overview & Mission

**Khamar Prohori (খামার প্রহরী)** is an autonomous computer-vision behavioral monitoring platform and bilingual veterinary AI co-pilot engineered for commercial poultry sheds. It turns standard surveillance cameras (RTSP/CCTV) into non-invasive 24/7 sentries that screen for flock-level health risks, thermal smothering, and immobile bird candidates before catastrophic flock mortality occurs.

- **Primary Motto:** Flock-level kinetic analytics are primary and trustworthy; per-bird tracking is secondary and quality-gated.
- **Language Support:** Native bilingual support for **Bangla (বাংলা)** and **English**.
- **Clinical Disclaimer:** Automated behavioral screening signal only. Never a veterinary diagnosis.

---

## 🏗️ 2. System Architecture

```
                       [ Standard Barn RTSP / CCTV Feed ]
                                       │
                    ┌──────────────────┴──────────────────┐
                    ▼ (Frame Decimation: Every 3rd Frame) ▼
      ┌──────────────────────────┐       ┌──────────────────────────┐
      │  Ultralytics YOLO11n     │       │  Dense Optical Flow      │
      │  (Detection & Tracking)  │       │  (Farnebäck 8x8 Grid)    │
      └─────────────┬────────────┘       └────────────┬─────────────┘
                    └──────────────────┬──────────────┘
                                       ▼
                 ┌──────────────────────────────────────────┐
                 │  Kinematic Anomaly Evaluation Engine     │
                 │  (Huddling, Immobility, Count Drop, Diurnal)
                 └─────────────────────┬────────────────────┘
                                       │
       ┌───────────────────────────────┴───────────────────────────────┐
       ▼                                                               ▼
┌─────────────────────────────┐                         ┌─────────────────────────────┐
│ Downscaled Video Buffer     │                         │ SQLite (WAL) / PostgreSQL   │
│ (Max 480p, <15MB RAM)       │                         │ (Tracks, Alerts, Baselines) │
└──────────────┬──────────────┘                         └──────────────┬──────────────┘
               └───────────────────────┬───────────────────────────────┘
                                       ▼
                     ┌──────────────────────────────────┐
                     │ Sohayok AI (সহায়ক এআই) RAG Engine │
                     │ - Fireworks AI (gpt-oss-120b)    │
                     │ - Live Telemetry Injection       │
                     │ - Curated Bengali/English KB     │
                     │ - Sliding Rate Limiter (15/min)  │
                     └─────────────────┬────────────────┘
                                       ▼
                     ┌──────────────────────────────────┐
                     │ Client PWA (Next.js 14 Standalone│
                     │ - Real-Time Dashboard & SSE      │
                     │ - Floating Sohayok AI Widget     │
                     │ - Live /docs & YC Pitch Portal   │
                     └──────────────────────────────────┘
```

---

## 📁 3. Monorepo Structure

```
khamar-prohori/
├── backend/                  # FastAPI 0.110+ backend
│   ├── alembic/              # Database migration scripts
│   ├── app/
│   │   ├── alerts/           # AlertEngine, Webhook, WebPush, Telegram
│   │   ├── analysis/         # Optical flow, spatial clustering, baselines
│   │   ├── api/              # API Routers (chat, stream, stats, docs_api)
│   │   ├── services/         # Pipeline, Sohayok AI, Recorder, RateLimiter
│   │   ├── vision/           # YOLO11 detector, ByteTrack, camera guard
│   │   ├── config.py         # Pydantic Settings & model defaults
│   │   ├── db.py             # SQLAlchemy session & Base
│   │   ├── models.py         # DB models (AnimalTrack, AlertEventRecord)
│   │   └── main.py           # FastAPI entrypoint, lifespan, CORS
│   ├── requirements.txt      # PyTorch CPU, FastAPI, OpenCV, Ultralytics
│   └── Dockerfile            # Standalone backend container
├── frontend/                 # Next.js 14 App Router (TypeScript)
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx      # Main Farm Dashboard (Overview)
│   │   │   ├── live/         # Real-time annotated camera stream
│   │   │   ├── analytics/    # Flock kinematic charts & heatmaps
│   │   │   ├── events/       # Alert feed & operator feedback loop
│   │   │   ├── reports/      # PDF & tabular flock reports
│   │   │   ├── docs/         # Live YC Pitch Deck & Technical Whitepaper
│   │   │   ├── settings/     # Camera & notification configurations
│   │   │   └── sw.ts         # Serwist PWA service worker
│   │   ├── components/
│   │   │   ├── chat/         # SohayokWidget.tsx (Floating AI drawer)
│   │   │   └── shell/        # AppShell, Topbar, Sidebar, MobileTabBar
│   │   └── lib/              # LiveDataContext, LanguageContext, translations
│   ├── package.json
│   └── next.config.mjs       # Rewrites /api/* to 127.0.0.1:8001
├── samples/                  # Benchmark test videos (dummy.mp4)
├── data/                     # Local SQLite, clips, snapshots (gitignored)
├── Dockerfile                # Root unified all-in-one container
├── start.sh                  # Multi-process supervisor script (Backend + Node)
├── railway.json              # Railway deployment build spec
└── CLAUDE.md                 # This specification & memory bank
```

---

## 🛠️ 4. Essential Commands

### Development Setup
```bash
# Backend (Python 3.12 Virtualenv)
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu --no-cache-dir
pip install -r backend/requirements.txt --no-cache-dir
alembic upgrade head

# Frontend (Node 20+)
cd frontend
npm install
npm run dev
```

### Full Local Runner (Runs both Backend & Frontend)
```bash
chmod +x run.sh
./run.sh
```

### Build & Verification
```bash
# Verify backend unit tests
.venv/bin/pytest backend/tests

# Verify Next.js production build
cd frontend && npm run build

# Docker Unified Build
docker build -t khamar-prohori:latest .
```

---

## 🤖 5. Sohayok AI (সহায়ক এআই) RAG Engine

- **Provider:** Fireworks AI (`https://api.fireworks.ai/inference/v1`)
- **Primary Model:** `accounts/fireworks/models/gpt-oss-120b` (Fast, bilingual, non-trapping reasoning)
- **Fallback Model:** `accounts/fireworks/models/qwen3p8-max`
- **Rate Limiting:** Sliding-window in-memory limiter: **15 requests/minute**, **120 requests/hour** per IP (`X-Forwarded-For` aware).
- **RAG Context Pipeline:**
  1. *Live Telemetry:* Harvests active bird count, flock health score (0–100), activity index, and unacknowledged alerts from `pipeline.get_latest_stats()`.
  2. *Domain Knowledge Base:* Curated English & Bengali articles in `knowledge_base.py` covering brooding temperatures (Day 1–35), heat stress electrolytes, Newcastle/Ranikhet, Gumboro (IBD), and Coccidiosis.
  3. *Bilingual Response:* Matches user language (Bengali & English) with explicit source citations.

---

## 🚀 6. Live /docs & Pitch Portal

- **URL:** `{app_base_url}/docs`
- **Access Control:** Defaults to Judging Window (**June 10, 00:00 &rarr; June 14, 23:59 UTC**).
- **Admin Passcode:** `khamar2026` allows instant unlock, toggle public visibility ON/OFF, and schedule overrides.
- **Dual Presentation:**
  - *YC Pitch Deck View:* 12 interactive slides with keyboard arrows, stepper, and team showcase.
  - *Full Technical Documentation View:* Complete system whitepaper with ASCII architecture, data flow, API explorer, and security protocols.
- **Core Team:**
  - **Md. Saikat Islam** — *Full-Stack & Systems Architect*
  - **Tukabbir Hossain Sadi** — *Frontend Lead & UI/UX Specialist*
  - **Ayon** — *AI & Machine Learning Engineer*
  - **Fayroz Tasnim** — *Product Strategist & Domain Researcher*

---

## ⚡ 7. Performance & Production Guidelines

1. **Memory Budgeting:** The video recorder ring buffer in `recorder.py` MUST downsample frames to max 480px width and cap at 75 frames (~3s) to prevent OOM kills on cloud starter instances (<15MB RAM total).
2. **Video Writing Lock:** `cv2.VideoWriter` encoding MUST use non-blocking write locks (`_write_lock.acquire(blocking=False)`) to prevent multiple concurrent alert clips from thrashing CPU.
3. **Pacing:** `PROCESS_EVERY_N=3` decimation must be maintained for CPU inference.
4. **Font Loading:** Use standard CSS font `@import` in `globals.css` rather than `next/font/google` to avoid build-time container failures in offline or restricted CI/CD environments.
