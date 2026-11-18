# ChickCheck Commercial Poultry Dataset Guide (DATASET.md)

This document specifies the dataset collection, annotation standards, and bootstrapping methodology required to train and evaluate computer-vision models in commercial poultry production facilities.

---

## 1. Dataset Scope & Diversity Requirements

A commercial poultry model must generalize across varied lighting, bird ages, plumage colors, and stocking densities. A production training set should contain at least **5,000 to 10,000 verified images** covering the following operational axes:

| Factor | Required Variation Range | Rationale |
| :--- | :--- | :--- |
| **Bird Age & Size** | Day 1–7 (chicks ~80g), Day 8–21 (pullets ~400g), Day 22–42 (market broilers ~2.5kg) | Bounding box pixel dimensions scale from ~30px to ~250px across production cycles. |
| **Barn Lighting** | 5 lux (dim brooding/rest), 20 lux (standard feeding), 40 lux (inspection), infrared/monochrome (night) | Models trained solely on bright footage fail completely during dawn/dusk simulated lighting. |
| **Stocking Density** | Sparse ($<10$ birds/$m^2$), Standard ($15-25$ birds/$m^2$), Crowded ($30-40$ birds/$m^2$) | Prevents model collapse when birds huddle or pile up near water lines. |
| **Plumage & Breed** | White Broiler (Ross 308, Cobb 500), Brown Layer (Hy-Line Brown, Lohmann), Native / Desi fowl | Contrast against litter changes dramatically from white plumage on dark wood shavings to brown birds on rice husk litter. |
| **Barn Elements** | Automatic pan feeders, bell drinkers, nipple water lines, heating pipes, ventilation fans | Background equipment must be annotated or included as negative samples to prevent false detections. |

---

## 2. Annotation Format (YOLO Standard)

Annotations follow the standard YOLO darknet text format:
One `.txt` file per `.jpg` image with the exact same base name (`frame_00123.jpg` $\leftrightarrow$ `frame_00123.txt`).

Each line represents one bird:
```
<class_id> <x_center> <y_center> <width> <height>
```
- Coordinates are normalized between `0.0` and `1.0`.
- Class ID: `0` represents `chicken`.

### Single Bounding Box vs. Crowd Annotation Rules:
1. **Fully Visible Birds**: Draw a tight rectangular box enclosing the body, head, and tail. Legs touching the litter do not need separate boxes.
2. **Partially Occluded Birds**: If $>50\%$ of the bird is visible, draw the box estimating the bird's full extents.
3. **Severe Overlap / Pileups**: When 4+ birds form an indistinguishable mass where individual heads or bodies cannot be discerned, do not invent arbitrary boxes; allow the density/plumage crowd estimation pathway to measure the cluster area.

---

## 3. Labeling Tool Setup (CVAT / Roboflow)

### Option A: CVAT (Computer Vision Annotation Tool - Self-Hosted or Cloud)
1. Create a Project named `ChickCheck-Poultry`.
2. Add single class: `chicken` (color: `#22c55e`).
3. Upload extracted image batches (maximum 500 images per task to avoid browser memory strain).
4. Enable AI-Assisted annotation with YOLO pre-labeling (using our bootstrapping script).

### Option B: Roboflow
1. Create a Object Detection project.
2. Upload images.
3. Use **Auto-Label** with our bootstrapped `best.pt` or use the Roboflow Universe poultry model.
4. Export as **YOLOv11** format.

---

## 4. Bootstrapping Workflow (Auto-Label + Manual Review)

To save 80%+ of manual labeling labor, use ChickCheck's automated bootstrapping pipeline:

```bash
# 1. Extract and auto-label 100 sample frames from real farm footage
python scripts/train_poultry.py \
    --bootstrap-from-video samples/dummy.mp4 \
    --sample-every-n 10 \
    --output-dir data/poultry_dataset

# 2. Inspect the generated directory:
#    data/poultry_dataset/images/train/
#    data/poultry_dataset/labels/train/
#    data/poultry_dataset/data.yaml

# 3. Import data/poultry_dataset into CVAT or Roboflow
# 4. Correct misaligned boxes and add missed birds (5–10 mins per 50 frames)
# 5. Re-export verified dataset to dataset/poultry.yaml

# 6. Fine-tune your custom model:
python scripts/train_poultry.py \
    --data data/poultry_dataset/data.yaml \
    --epochs 50 \
    --batch 16 \
    --imgsz 640
```

Once trained, activate the model in `.env`:
```env
CUSTOM_WEIGHTS_PATH=./runs/train_poultry/poultry_yolo11/weights/best.pt
CUSTOM_CLASS_NAMES=chicken
```
