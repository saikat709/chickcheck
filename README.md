# 🐔 ChickCheck
## Commercial Poultry & Livestock Behavioral Monitoring Platform

**ChickCheck** is an end-to-end computer-vision and kinetic behavioral monitoring platform engineered for real commercial poultry sheds and livestock barns. Built with **FastAPI**, **Ultralytics YOLO**, **Dense Optical Flow**, and **Next.js 14**, ChickCheck continuously analyzes surveillance feeds to measure flock-level activity, detect collective thermal stress huddling, screen for immobile bird candidates, monitor barn zone occupancy, and evaluate anomaly rules—all while streaming real-time annotated video and dispatching alerts to farm operators.

![ChickCheck Live Dashboard](samples/homepage.png)

> ⚠️ **Clinical Disclaimer**: ChickCheck provides an automated, movement-based behavioral screening signal only. It is **not** a clinical veterinary diagnosis or a replacement for professional animal care inspection.

---

## 🌾 Commercial Farm Realities & Core Design Principle

Commercial broiler and layer sheds present extreme challenges for standard computer vision:
- **High Bird Density & Occlusions**: Hundreds of birds tightly packed and overlapping. Standard single-bird trackers suffer from heavy bounding box merging and ID switches (benchmarked at >100x ID churn over 150 frames on stock ByteTrack).
- **Dust, Lighting & Sensor Noise**: Uneven barn illumination, dust speckles, and low-contrast bedding.
- **Hardware & Bandwidth Constraints**: Systems must run efficiently on local barn edge CPUs or small GPUs without relying on high-bandwidth cloud uplinks.

### Core Principle
> **Flock-Level Analytics Are Primary and Trustworthy.**  
> Collective kinetic energy, optical flow activity indices, plumage density estimation, spatial distribution, and zone occupancy metrics are resilient to individual tracking failures.  
> **Individual Per-Bird Analytics Are Secondary & Best-Effort:** Evaluated only when tracking stability meets strict quality gates (`track_quality >= 0.50`), and experimental rules (such as bounding-box jitter "limping") are explicitly downgraded.

See [AUDIT.md](file:///home/saikat/projects/chickcheck/AUDIT.md) for the complete measured audit of anomaly rules, tracking churn measurements, and validation benchmarks.

---

## 🌟 Key Features

### 1. Dense Scene Detection & Dual-Regime Counting
- **Dual-Scale Sliced Inference (SAHI-style)**: Overlapping tile generation and coordinate re-projection for detecting small, distant birds in large commercial sheds (`backend/app/vision/sahi.py`).
- **Dual-Regime Density Estimation**: Automatically switches between bounding-box counting (sparse scenes) and plumage color segmentation with distance transform peaks (dense crowd scenes) (`backend/app/vision/density_counter.py`).
- **Honest Uncertainty Ranges**: Reports counts as $N \pm \Delta$ (e.g. `19 ± 2`) with the estimation method clearly indicated, avoiding false-precision counts.
- **Temporal Count Smoothing**: Sliding window median filter prevents momentary camera occlusion or lighting flicker from raising false count-drop alarms.

### 2. ID-Independent Behavior Analytics
- **Dense Optical Flow (Farnebäck)**: Measures collective kinetic energy on an 8x8 spatial grid in real-time on CPU (<6ms per frame), generating a Whole-Flock Activity Index (0–100) (`backend/app/analysis/optical_flow.py`).
- **Thermal Stress Clustering**: Differentiates cold-stress tight clustering from heat-stress perimeter crowding.
- **Immobile Bird Candidate Screening**: Temporal difference decay tracking motionless plumage blobs over extended durations (>30s) while the flock moves, capturing cropped evidence snapshots for operator inspection (`backend/app/analysis/immobile.py`).
- **Barn Zones & Perspective Scaling**: User-defined polygonal feeder, drinker, resting, and exclusion zones with point-in-polygon assignment and depth-tilt compensation (`backend/app/analysis/zones.py`).
- **Camera Operational Fault Guard**: Real-time detection of barn blackout/illumination loss, lens obstruction/soiling, and camera tampering/bumps, raising hardware maintenance alerts (`backend/app/vision/camera_guard.py`).

### 3. Operator Feedback Loop & Anomaly Rules
- **10 Anomaly Rules**: 
  - Flock-level: *Panic Movement Surge*, *Thermal Stress Huddling*, *Flock Count Drop*, *Depressed Diurnal Activity*, *Feeding Time Rhythm Deviation*, *Camera Hardware Fault*, and *Immobile Bird Candidate*.
  - Per-bird (quality-gated): *Prolonged Inactivity*, *Sudden Movement Collapse*, and *Fallen / Recumbent Posture*.
- **Alert Feedback Endpoint**: Operators can verify alerts as `correct` or `false_alarm` via `POST /api/events/{event_id}/feedback` or the UI to minimize false alerts.

### 4. Bilingual Support & Bangladesh Regional Auto-Detection
- **Auto-Detection**: Automatically detects if the operator's region is Bangladesh (`Asia/Dhaka` timezone or `bn` locale) and defaults to **Bangla (বাংলা)**; defaults to **English** for other regions.
- **Header Language Switcher**: One-click interactive `EN | বাংলা` toggle in the navigation header with `localStorage` persistence.
- **Multilingual Executive Reports**: Automated daily executive summaries generated in both English and Bengali (`lang=en` or `lang=bn`).

---

## 📋 Anomaly Rule Reliability Matrix

| Rule | Primary / Gated | Target Signal | Reliability & Commercial Farm Suitability |
| :--- | :--- | :--- | :--- |
| **Panic Movement Surge** | Flock-Level | Optical flow kinetic surge + velocity variance | **High**: Reliable disturbance / predator alarm without ID dependence. |
| **Crowding / Thermal Huddle** | Flock-Level | Pairwise spatial clustering + density mapping | **High**: Detects heater draft clustering (cold) or wall crowding (heat). |
| **Count Drop** | Flock-Level | Temporally smoothed dual-regime count | **High**: Median filter eliminates single-frame tracking dropouts. |
| **Low Flock Activity** | Flock-Level | Optical flow activity vs learned diurnal EWMA baseline | **High**: Stable circadian rhythm screening. |
| **Feeding Deviation** | Flock-Level | Feeder zone occupancy during feeding schedule | **High**: Checks feed availability without individual IDs. |
| **Camera Hardware Fault** | Flock-Level | Luminance, Laplacian edge variance, frame translation | **High**: Operational alerts for blackout, dirt, or camera bumps. |
| **Immobile Bird Candidate** | Hybrid | Stationary plumage blob persistence (>30s) | **High**: Reliable mortality and non-ambulatory bird screening. |
| **Prolonged Inactivity** | Quality-Gated | Individual idle time | **Medium**: Evaluated only when `track_quality >= 0.50`. |
| **Sudden Stop** | Quality-Gated | Kinematic velocity drop | **Medium**: Evaluated only when `track_quality >= 0.50`. |
| **Fallen Posture** | Quality-Gated | Aspect ratio change | **Medium**: Requires overhead aspect stability and track quality gate. |
| **Limping / Gait Proxy** | Experimental | Bounding-box jitter vs herd median | **Downgraded**: Marked experimental due to high occlusion bbox noise. |

---

## 🚀 Quickstart on Ubuntu Linux

### Prerequisites
- Ubuntu 22.04 LTS or 24.04 LTS
- Python 3.11 or Python 3.12 (`python3`, `python3-venv`)
- Node.js 18+ and npm (`node`, `npm`)
- FFmpeg (`sudo apt update && sudo apt install -y ffmpeg`)

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

## 🧪 Model Evaluation & Training

### Run Benchmark Evaluation
Evaluate detection speed, counting MAE, ID churn, and alert frequencies:
```bash
.venv/bin/python3 scripts/evaluate.py --video samples/dummy.mp4 --frames 150 --ground-truth 19.0
```

### Fine-Tuning a Poultry Model
To train a dedicated YOLO model on real poultry data rather than generic COCO weights:
```bash
# Extract frames, auto-label, and fine-tune YOLO11 on poultry
.venv/bin/python3 scripts/train_poultry.py --video samples/dummy.mp4 --output-dir ./poultry_dataset --epochs 30
```
See [DATASET.md](file:///home/saikat/projects/chickcheck/DATASET.md) for the complete dataset specification, annotation guidelines (CVAT/Roboflow), lighting conditions, age brackets (Day 1 to 42), and bootstrapping procedure.

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

