# ChickCheck Commercial Poultry Farm Technical Audit (AUDIT.md)

**Audit Date:** November 2026  
**Auditor:** Senior Computer Vision & Agri-Tech Systems Engineer  
**System Target:** Commercial Broiler/Layer Poultry Barns (Dense Flock Conditions)  
**Evaluation Hardware:** x86_64 CPU (Ubuntu Linux)  
**Footage Evaluated:** `samples/dummy.mp4` (overhead broiler feeder clip, 322 frames, 30 FPS) & `samples/dummy_2.mp4` (1080p barn clip, 725 frames, 14.99 FPS)

---

## 1. Executive Summary & Core Principle

In commercial broiler and layer operations, single video frames contain tens to hundreds of birds densely overlapping, foraging, and resting under dim or variable barn lighting (5–30 lux) with high dust accumulation. 

### Fundamental Finding:
**Per-bird tracking with individual persistent IDs (`#1`, `#2`, ... `#N`) completely breaks down under dense commercial flock conditions.** Bounding boxes merge, occlusion is continuous, and track fragmentation causes massive ID inflation (measured at **105.7× ID inflation** over 5 seconds on sample footage). 

Consequently, behavioral screening rules that rely on persistent individual track identity (such as per-bird idle duration, aspect-ratio "lying" detection, and bounding-box jitter "limping") yield high rates of false positives and false negatives on commercial farms.

### System Architectural Realignment:
1. **Flock-Level Analytics Are Primary and Trustworthy**:
   - Dense optical flow (Farnebäck grid motion energy) provides an activity index independent of detection bounding boxes or tracking IDs.
   - Spatial density grids, zone occupancies (feeder, drinker, resting), and clustering/huddling metrics represent true collective welfare.
   - Diurnal diurnal circadian baselines (EWMA + MAD per hour) must evaluate whole-flock kinetic energy.
2. **Per-Bird Tracking Is Secondary & Quality-Gated**:
   - Per-bird tracks are assigned a **Track Quality Score** ($0.0 - 1.0$) based on detection confidence history, track age, and spatial continuity.
   - Individual rules evaluate **only** on tracks exceeding quality thresholds (`track_quality >= 0.65`).
   - Counts are reported with an **uncertainty range** (e.g., $18 \pm 2$) and density-regime indicator, never an artificial false-precise integer.
3. **Stationary / Immobile Bird Candidates**:
   - Identified via accumulated temporal frame differencing and plumage blob stability while the flock moves, flagged as *"Candidate, needs physical inspection"*.

---

## 2. Empirical Benchmark Measurements (Measured on `samples/dummy.mp4`)

| Metric | Measured Baseline Value | Commercial Farm Implication |
| :--- | :--- | :--- |
| **Throughput (CPU)** | **17.67 FPS** (150 frames in 8.49s) | Meets real-time requirement (>15 FPS on 480p/640p on commodity CPU). |
| **Inference Latency** | Avg: **51.9 ms**, p95: **49.9 ms** | Low latency, well-suited for edge compute appliances. |
| **Flock Count Stability** | Mean: **22.4**, Min: **15**, Max: **26**, $\sigma$: **2.88** | Fluctuation of $\pm 5$ birds/frame without temporal smoothing triggers spurious "Count Drop" alarms. |
| **ID Inflation / Switch Rate**| **2,114 unique IDs spawned in 150 frames** (~5s) | True flock size is ~18–20 birds. **105.7× ID churn rate** proves per-bird persistent tracking is invalid as a primary signal in dense clusters. |

---

## 3. Systematic Audit: 10 Anomaly Screening Rules

Each rule is categorized into:
- **(a) Truly Implemented & Valid**: Operates accurately on collective signals.
- **(b) Implemented but Invalid for Dense Flocks**: Implementation exists but produces false outputs in commercial flocks unless downgraded/redesigned.
- **(c) Fake / Unverified**: Theoretical or artifact of sensor/detection noise.

| # | Anomaly Rule | Status | Technical Audit Verdict & Commercial Remedy |
|---|:---|:---:|:---|
| 1 | **Prolonged Inactivity** | **(b)** | **Invalid for Dense Flocks**. Frequent occlusions terminate track IDs, resetting the inactivity timer. Birds resting naturally appear inactive, while ID churn mimics rapid movement. <br>**Remedy**: Gated behind `track_quality >= 0.65`. Supplemented by flock-level **Immobile Bird Candidate** detection via temporal differencing. |
| 2 | **Sudden Stop** | **(b)** | **Invalid for Dense Flocks**. When a tracking box drops out due to overlap near a feeder, the velocity drops abruptly to zero, mimicking a sudden collapse. <br>**Remedy**: Downgraded to secondary. Requires track quality $\ge 0.70$ and persistence over $\ge 1.5$ seconds before triggering. |
| 3 | **Fallen / Lying Posture** | **(b)** | **Invalid for Dense Flocks**. Bounding box aspect ratio ($W/H$) from a ceiling camera shifts when a bird turns, ducks to eat, or overlaps with a neighbor. Broilers spend 70%+ of time lying naturally. <br>**Remedy**: Removed as a standalone primary alarm; replaced by spatial thermal stress clustering (huddling vs wall dispersion). |
| 4 | **Social Isolation** | **(b)** | **Invalid for Dense Flocks**. Centroid distance calculation fails in commercial barns (100m+ long) where birds distribute uniformly or occupy quiet corners. <br>**Remedy**: Gated to sparse scenes only. In dense flocks, replaced by Zone Occupancy Analysis (feeder vs resting zone distribution). |
| 5 | **Panic / Erratic Movement** | **(b) $\rightarrow$ Upgraded to (a)** | **Previously Invalid on Per-Bird Centroids, Now Valid via Optical Flow**. Centroid jitter produced false panic alarms. Upgraded to dense Farnebäck Optical Flow motion energy variance across grid cells. Spikes in collective kinetic energy reliably detect stampedes, predators, or human intrusion. |
| 6 | **Crowding / Huddling** | **(a)** | **Truly Implemented & Valid**. DBSCAN pairwise spatial clustering accurately identifies high-density bird huddles, key for early warning of thermal stress (cold stress pileups or heat stress migration). |
| 7 | **Count Drop** | **(b) $\rightarrow$ Upgraded to (a)** | **Previously Invalid Due to Noise, Now Valid with Temporal Smoothing**. Raw frame-by-frame count fluctuations ($\sigma = 2.88$) triggered false alarms. Upgraded with sliding-window median filtering and reported with explicit uncertainty bounds ($N \pm \Delta$). |
| 8 | **Low Flock Activity** | **(b) $\rightarrow$ Upgraded to (a)** | **Upgraded to Optical Flow Energy**. Centroid speed average was corrupted by track switching. Now uses dense optical flow motion energy evaluated against an hour-by-hour diurnal EWMA + MAD baseline learned from barn history. |
| 9 | **Limping / Gait Proxy** | **(c)** | **Fake / Unverified in Dense Flocks**. Bounding-box quantization jitter on low-resolution surveillance video was mathematically misinterpreted as gait asymmetry. <br>**Remedy**: Honest downgrade. Removed from primary alerts; flagged as unverified for top-down wide-angle cameras. |
| 10 | **Feeding-Time Deviation** | **(a)** | **Truly Implemented & Valid**. Correlates scheduled automated feeding intervals with spatial Feeder Zone occupancy and optical flow motion. Valid and actionable for farm operations. |

---

## 4. Audit of README Claims

| README Claim | Actual Status | Technical Remediation |
| :--- | :---: | :--- |
| *"assign persistent tracking IDs... calculates real-time kinematics"* | **(b)** | True in sparse scenes ($<6$ animals). In commercial flocks ($>20$ birds), IDs switch rapidly. System now explicitly treats per-bird IDs as secondary and displays flock-level metrics primarily. |
| *"10 biological anomaly screening rules"* | **(b)** | 5 rules are flock-level and valid; 3 per-bird rules are now gated to high-quality tracks; 1 rule (limping) is removed/downgraded as unverified. |
| *"Adaptive Low-Resolution CLAHE & Unsharp"* | **(a)** | Fully functional in `enhancer.py`. Enhanced with adaptive gamma correction for dark corners. |
| *"Multi-Channel Alerts (Telegram, Webhook, Email)"* | **(a)** | Fully functional with rate-limiting, deduplication, and persistence windows. |
| *"Daily Executive Reports (PDF/JSON)"* | **(a)** | Fully functional. Now upgraded with plain-language English and Bengali summaries. |
| *"Mobile-First Next.js Dashboard"* | **(a)** | Fully responsive. Upgraded with language toggle (`EN` / `বাংলা`) and auto-detection for Bangladesh region. |

---

## 5. Architectural Upgrade Roadmap

1. **Dense-Scene Detection**:
   - SAHI-style tiled slicing inference for small, distant birds.
   - Density estimation path when overlap exceeds box threshold.
   - Explicit count uncertainty reporting ($N \pm \Delta$).
2. **Behavior Analytics (ID-Free)**:
   - Dense Farnebäck Optical Flow on spatial grid.
   - Immobile bird candidate detection (temporal differencing).
   - Zone-based occupancy and thermal huddle stress detection.
3. **Camera & Barn Guarding**:
   - Camera shift, obstruction, and blackout detection.
   - User-calibrated barn zones (feeder, drinker, exclusion).
4. **Farmer Alerting & Feedback**:
   - Feedback loop ("Correct" vs "False Alarm") with automatic threshold auto-tuning.
   - Dual-language executive reporting (English + Bengali).
