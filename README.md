# 🐔 ChickCheck
## Complete Livestock Monitoring System

**ChickCheck** is an end-to-end computer-vision and kinematic behavioral monitoring platform for livestock. Built with **FastAPI**, **Ultralytics YOLO11 + ByteTrack**, and **Next.js 14**, ChickCheck continuously analyzes video feeds to detect animals, assign persistent tracking IDs, calculate real-time kinematics, evaluate 10 biological anomaly screening rules, stream live annotated MJPEG video and SSE event feeds, and dispatch alerts to farm owners across Telegram, Webhook, and SMTP Email.

![ChickCheck Live Dashboard](samples/homepage.png)

> ⚠️ **Clinical Disclaimer**: ChickCheck provides an automated, movement-based behavioral screening signal only. It is **not** a clinical veterinary diagnosis or a replacement for professional animal care inspection.

---

## 🌟 Key Features

- **Continuous Video Pipeline**: Supports local looping video files (`samples/dummy.mp4`) with accurate timeline pacing, or live network streams (`RTSP`, `HTTP`) with automatic reconnection and exponential backoff.
- **YOLO11 & ByteTrack Kinematics**: Tracks individual animals with stable IDs (`#12`), calculates distance-independent normalized speed (body-lengths/s), displacement, idle duration, heading changes, and bounding-box aspect ratio shifts.
- **Flock-Level Metrics**: Live aggregation of active vs. idle headcounts, multi-species counts breakdown, flock activity index (0-100), dispersion from centroid, pairwise crowding density, spatial cluster/huddle detection, and a 16x16 enclosure zone occupancy grid.
- **Adaptive Low-Resolution Enhancement**: Real-time CLAHE on LAB luminance channel and unsharp masking edge definition for low-resolution/degraded surveillance footage (e.g. 360p/480p IoT/RTSP streams). Includes coordinate EMA smoothing to eliminate bounding-box quantization jitter.
- **Multi-Animal & Multi-Species Flock Monitoring**: Concurrent tracking across multi-species coops (e.g. `chicken,duck` or `all`), individual species kinematic baselines, HSV color appearance histograms for occlusion resilience, and spatial graph clustering for dense huddle detection.
- **10 Real Behavioral Anomaly Rules**:
  1. *Prolonged Inactivity*: Animal immobile for > N minutes while flock is active.
  2. *Sudden Stop*: Velocity collapse following high speed combined with posture change.
  3. *Fallen / Lying Posture*: Persistent shift in body aspect ratio vs. individual baseline.
  4. *Social Isolation*: Animal separated by > X body lengths from flock centroid for > N seconds.
  5. *Erratic / Panic Movement*: Multi-animal speed spike with high zigzag direction change rate.
  6. *Crowding / Huddling*: High pairwise cluster density indicating heat/cold stress or suffocation risk.
  7. *Count Drop*: Unexplained decrease in active count vs. rolling window baseline.
  8. *Low Flock Activity*: Activity significantly below learned diurnal baseline for current hour.
  9. *Limping / Gait Proxy*: Asymmetric stride detected by low speed with high bounding box jitter.
  10. *Feeding-Time Deviation*: Anticipated activity fails to manifest during scheduled feeding hours.
- **Rolling Diurnal Baselines**: Learns hour-by-hour circadian activity patterns using EWMA and MAD (Median Absolute Deviation), gracefully falling back to species profile norms when history is scarce.
- **Incident Ring Buffer & Evidence Capture**: Captures incident JPEG snapshots with highlighted bounding boxes and exports 10-second MP4 video clips capturing pre-and-post event context.
- **Multi-Channel Alert Dispatch**: Real-time push via Telegram Bot (with photo attachment), HMAC-signed Webhook JSON POSTs, and SMTP Email.
- **Quiet Hours & Deduplication**: Configurable cooldowns prevent owner alert fatigue and escalate persistent conditions to `critical`; quiet hours suppress non-critical notifications.
- **Daily Executive Reports**: Automated daily operational summaries in structured JSON and compilable PDF format.
- **Mobile-First Responsive Dashboard**: Real-time Next.js frontend with live MJPEG stream, heatmap overlay toggle, Recharts historical trends, animal registry table, interactive motion trail drawer, and alert acknowledgment.

---

## 📋 Species Profile Baseline Reference

A farm monitors **one animal species at a time** (configured via `SPECIES` env variable or UI Settings). Below are the baseline kinematics and class mappings utilized by ChickCheck:

| Species | COCO Proxy Class | Class ID | Nominal Aspect Ratio ($W/H$) | Nominal Speed Norm (bl/s) | Flock Dispersion Norm | Behavioral Description |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Chicken** | `bird` | 14 | 1.05 | 0.08 - 0.85 | 3.5 body-lengths | Active foraging, rapid pecking, sudden heading turns, moderate flocking. |
| **Duck** | `bird` | 14 | 1.12 | 0.06 - 0.75 | 2.8 body-lengths | Waddling gait, high flock cohesion, synchronized movements. |
| **Cow** | `cow` | 19 | 1.45 | 0.02 - 0.35 | 4.5 body-lengths | Deliberate slow locomotion, grazing, prolonged sternal rumination postures. |
| **Sheep** | `sheep` | 18 | 1.25 | 0.04 - 0.50 | 2.2 body-lengths | High herd cohesion, collective movement, vulnerable to huddling stress. |
| **Goat** | `sheep` | 18 | 1.20 | 0.05 - 0.65 | 4.0 body-lengths | Agile, exploratory, higher dispersion, climbing postures. |

---

## 🚀 Quickstart on Ubuntu Linux

### Prerequisites
- Ubuntu 22.04 LTS or 24.04 LTS
- Python 3.11 or Python 3.12 (`python3`, `python3-venv`)
- Node.js 18+ and npm (`node`, `npm`)
- FFmpeg installed (`sudo apt update && sudo apt install -y ffmpeg`)

### 1. Run with Native Scripts
```bash
# Clone and enter the repository
cd chickcheck

# Start everything with the unified runner (sets up .venv, migrates DB, installs npm, starts backend & frontend)
./run.sh
```
Or use the `Makefile`:
```bash
make install
make migrate
make test
make dev
```
Open **http://localhost:3000** in your browser to view the live dashboard!
API documentation is available at **http://localhost:8000/docs**.

---

## 🐳 Running with Docker Compose

ChickCheck includes a complete `docker-compose.yml` orchestrating PostgreSQL, FastAPI backend, and Next.js frontend:

```bash
# Build and run all services in background
docker compose up --build -d

# View service logs
docker compose logs -f backend

# Stop services
docker compose down
```

---

## 📹 Switching to Live RTSP / IoT Streams

To switch from the sample video to a live RTSP or HTTP camera stream, simply update `VIDEO_SOURCE` in `.env`:

```env
# Example RTSP IP Camera stream
VIDEO_SOURCE=rtsp://admin:password@192.168.1.100:554/stream1

# Or an HTTP/MJPEG camera stream
# VIDEO_SOURCE=http://192.168.1.100:8080/video
```
ChickCheck's `RTSPSource` handles network interruptions automatically with exponential backoff and reconnection retry loops.

---

## 🎯 Choosing a model

Stock COCO models are not trained on chicks. Measured on `samples/dummy.mp4` (about 20 chicks, CPU):

| Model | Chicks found / frame | Time / frame |
| :--- | :--- | :--- |
| `yolo11n` | 0 | 0.4 s |
| `yolo11m` @960 | ~8 | 1.1 s |
| `yolo11x` @1280 | ~18 | 4.6 s |

Use a GPU with `yolo11x` + `INFER_IMGSZ=1280`, or fine-tuned poultry weights (below). Wide barn footage with hundreds of small birds (`samples/dummy_2.mp4`) needs fine-tuned weights; COCO models cannot detect it.

## 🧠 Plugging in Custom Fine-Tuned Weights

If you have fine-tuned a custom YOLO11 model on specific breeds or poultry datasets (e.g. distinguishing hens from roosters):

1. Place your weights file in the project (e.g. `data/best_chickens.pt`).
2. Update `.env`:
```env
CUSTOM_WEIGHTS_PATH=./data/best_chickens.pt
CUSTOM_CLASS_NAMES=chicken,rooster,hen
```
ChickCheck will automatically load your custom model and filter detections for your specified classes.

### Optional Health Classifier
If you have a YOLO classification model trained on sick vs. healthy animal crops:
```env
HEALTH_CLASSIFIER_PATH=./data/chicken_health_cls.pt
```
ChickCheck will periodically crop detected animals and blend the classification confidence into the kinematic health score.

---

## 🤖 Telegram Bot Setup Guide

To receive instant photo alerts on your phone:

1. Open Telegram and search for `@BotFather`.
2. Send `/newbot` and follow the prompts to create your bot. Copy the **HTTP API Token** (e.g. `123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ`).
3. Search for `@userinfobot` in Telegram, send `/start`, and copy your personal or group **Id** (e.g. `987654321`).
4. Update your `.env` or configure directly on the `/settings` page:
```env
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ
TELEGRAM_CHAT_ID=987654321
```
5. Click **"Send Test Notification"** on the Settings page to confirm delivery!

---

## 🧪 Running Offline Performance Benchmarks

Tune pipeline throughput (`PROCESS_EVERY_N` and `INFER_IMGSZ`) against your hardware:

```bash
# Run benchmark on samples/dummy.mp4
.venv/bin/python3 scripts/benchmark.py --video samples/dummy.mp4 --process-every-n 2 --imgsz 640
```
This runs offline and outputs:
- Native Video FPS vs. Pipeline Effective FPS
- Average and 95th-percentile inference latency in milliseconds
- Real-time compliance assessment.

---

## ⚙️ Environment Variables Reference

| Variable | Default | Description |
| :--- | :--- | :--- |
| `SPECIES` | `chicken` | Livestock species: `chicken`, `duck`, `cow`, `sheep`, `goat`, comma-separated (`chicken,duck`), or `all`. |
| `ENHANCE_LOW_RES` | `true` | Enables adaptive CLAHE and unsharp preprocessing for low-res/degraded feeds. |
| `LOW_RES_MAX_DIM` | `540` | Resolution threshold below which frames are classified as low-res. |
| `CLAHE_CLIP_LIMIT`| `2.5` | Contrast limit for CLAHE histogram equalization. |
| `SHARPEN_FACTOR`  | `0.4` | Edge sharpening factor for blurred video contours. |
| `DENSE_CROWD_MODE`| `true` | Enables spatial clustering, appearance signature re-ID, and extended track memory during tight huddles. |
| `VIDEO_SOURCE` | `samples/dummy.mp4` | Video file path or RTSP/HTTP network stream URL. |
| `DATABASE_URL` | `sqlite:///./data/chickcheck.db` | SQLAlchemy database URL (SQLite or PostgreSQL). |
| `MODEL_WEIGHTS` | `yolo11m.pt` | Default YOLO model weights (see *Choosing a model*). |
| `ADAPTIVE_CONF_FLOOR` | `0.10` | Adaptive scaling never lowers confidence below this. |
| `POULTRY_PROXY_CLASSES` | `sheep,teddy bear` | Extra COCO classes accepted as chicks (poultry only). |
| `POULTRY_COLOR_FUSION` | `false` | Experimental colour-blob detector for missed chicks. |
| `CUSTOM_WEIGHTS_PATH` | `None` | Path to custom fine-tuned weights file. |
| `CUSTOM_CLASS_NAMES` | `None` | Comma-separated class names for custom weights. |
| `HEALTH_CLASSIFIER_PATH`| `None` | Optional path to YOLO-cls model weights. |
| `PROCESS_EVERY_N` | `2` | Frame decimation rate (infer every Nth frame). |
| `INFER_IMGSZ` | `640` | Inference resolution (e.g. 640, 480, 320). |
| `CONF_THRESHOLD` | `0.25` | Minimum object detection confidence threshold. |
| `TRACK_LOST_SECONDS` | `2.0` | Seconds to hold lost track in memory before eviction. |
| `MAX_TRAIL_POINTS` | `30` | Number of centroid positions retained for rendering trail. |
| `SENSITIVITY` | `normal` | Anomaly sensitivity preset: `low`, `normal`, `high`. |
| `QUIET_HOURS_ENABLED` | `false` | When true, suppresses non-critical alerts during quiet hours. |
| `QUIET_HOURS_START` | `22` | Quiet hours start hour (0-23). |
| `QUIET_HOURS_END` | `6` | Quiet hours end hour (0-23). |
| `RETENTION_DAYS` | `7` | Days to retain snapshots, incident clips, and reports on disk. |
| `TELEGRAM_ENABLED` | `false` | Enable/disable Telegram bot alerts. |
| `TELEGRAM_BOT_TOKEN` | `None` | Telegram bot API token. |
| `TELEGRAM_CHAT_ID` | `None` | Telegram destination chat ID. |
| `WEBHOOK_ENABLED` | `false` | Enable/disable webhook dispatch. |
| `WEBHOOK_URL` | `None` | Webhook HTTP POST endpoint. |
| `WEBHOOK_SECRET` | `None` | HMAC-SHA256 signature secret. |
| `SMTP_ENABLED` | `false` | Enable/disable SMTP email delivery. |
| `SMTP_HOST` | `smtp.gmail.com` | SMTP relay server. |
| `SMTP_PORT` | `587` | SMTP port (e.g. 587 or 465). |
| `SMTP_USER` | `None` | SMTP username. |
| `SMTP_PASSWORD` | `None` | SMTP password or app password. |
| `SMTP_FROM` | `alerts@farm.local` | Sender email address. |
| `SMTP_TO` | `owner@farm.local` | Recipient email address. |

