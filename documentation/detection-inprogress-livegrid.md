# Detection In-Progress: Live Grid & Progress Display

## Overview

During an active weed detection run, the Device Control page shows:
1. A **live density grid** — 20 cells coloured by weed count as the robot scans
2. A **progress bar** — percentage of total robot steps completed

Both are driven by HTTP polling. No WebSocket is used.

---

## Concepts

### Robot Step
One robot step = the robot advances one `camera_vision_width_cm` forward and captures one image. Each step produces exactly one row in the `weed_detections` table for the active `run_id`.

### Total Steps
The total number of steps the robot must take to cover the field path:

```
forward_dimension = field.length   (if partition_type == 'row')
                  = field.width    (if partition_type == 'column')

total_steps = round(forward_dimension_m * 100 / camera_vision_width_cm)
            = round(forward_distance_cm / camera_vision_width_cm)
```

`forward_distance_cm` is stored in `active_detection.total_distance_cm` at detection start.

**Example:** field length = 500 m, camera width = 50 cm  
→ `total_steps = round(50000 / 50) = 1000`

### Current Steps
```
current_steps = COUNT(weed_detections WHERE run_id = active_run_id)
```
Each new row posted by the robot increments this by 1.

### Progress %
```
progress_pct = round((current_steps / total_steps) * 100)  capped at 100
```

---

## Live Grid Layout

The display grid represents the **full field**. Dimensions depend on `partition_type`:

| `partition_type` | Grid rows | Grid columns | Robot movement direction |
|---|---|---|---|
| `row` | `partition_count` (one row per path) | 20 (steps along field length) | Horizontal — left to right across columns |
| `column` | 20 (steps along field width) | `partition_count` (one column per path) | Vertical — top to bottom across rows |

Each run scans one path at a time. The active path is identified by `current_path` (1-based), which maps to:
- **row partition** → `grid[current_path - 1][cell_index]` (fills columns 0–19 in that row)
- **column partition** → `grid[cell_index][current_path - 1]` (fills rows 0–19 in that column)

Paths not yet started remain all null (grey).

### Cell Assignment
The 20 cells along the active path are filled sequentially as the robot moves. Steps for the current run are divided into 20 equal buckets by insertion order:

```
steps_per_cell = floor(total_steps / 20)   (minimum 1)
cell_index     = floor(step_sequence_number / steps_per_cell)  capped at 19
```

`step_sequence_number` is the 0-based position of the row in `weed_detections` ordered by `id` for the run.

**Example:** 1000 total steps → `steps_per_cell = 50`.  
Steps 0–49 → cell 0, steps 50–99 → cell 1, …, steps 950–999 → cell 19.

### Cell Colour
Computed from the **sum of `weed_detections.count`** for all rows in that bucket:

| Weed count | Colour | Density label |
|---|---|---|
| 0 – 9 | Green | `low` |
| 10 – 19 | Orange | `medium` |
| ≥ 20 | Red | `high` |

A cell with `step_count == 0` (no detections yet) is rendered as **grey/null** (not yet scanned).

---

## API Contract

### `GET /api/devices/<device_id>/detection/status`

Polled every **2 seconds** by the frontend while detection is running.

**Response (running):**
```json
{
  "status": "running",
  "run_id": 42,
  "current_steps": 137,
  "total_steps": 1000,
  "weeds_found": 23,
  "total_distance_cm": 50000,
  "cells_scanned": 0,
  "device_position": { "x": 0, "y": 3 },
  "started_at": "2026-04-26T10:00:00+00:00",
  "finished_at": null,
  "last_updated": "2026-04-26T10:05:17+00:00"
}
```

**Response (idle / no active detection):**
```json
{
  "status": "idle",
  "current_steps": 0,
  "total_steps": 0,
  "weeds_found": 0,
  "total_distance_cm": 0,
  "cells_scanned": 0,
  "device_position": { "x": 0, "y": 0 },
  "last_updated": null
}
```

**Backend computation:**
```python
cam_width    = device.camera_vision_width_cm  # from devices table
total_steps  = round(ad.total_distance_cm / cam_width)  if cam_width > 0 else 0
current_steps = WeedDetection.query.filter_by(run_id=ad.run_id).count()
```

`status` values: `"running"` | `"finished"` | `"stopped"` | `"idle"`

---

### `GET /api/devices/<device_id>/detection/grid`

Polled every **3.5 seconds** by the frontend while detection is running.

**Response — always 20 items, one per cell:**
```json
[
  { "cell": 0,  "weed_count": 3,  "step_count": 50 },
  { "cell": 1,  "weed_count": 18, "step_count": 50 },
  { "cell": 2,  "weed_count": 0,  "step_count": 37 },
  { "cell": 3,  "weed_count": 0,  "step_count": 0  },
  ...
  { "cell": 19, "weed_count": 0,  "step_count": 0  }
]
```

**Fields:**

| Field | Type | Description |
|---|---|---|
| `cell` | int 0–19 | Sequential cell index along the detection path |
| `weed_count` | int | Sum of `weed_detections.count` for all steps in this bucket |
| `step_count` | int | Number of `weed_detections` rows in this bucket (0 = not yet reached) |

**Backend computation:**
```python
cam_width      = device.camera_vision_width_cm
total_steps    = round(ad.total_distance_cm / cam_width) if cam_width > 0 else 0
steps_per_cell = max(1, total_steps // 20)

detections = WeedDetection.query \
    .filter_by(run_id=ad.run_id) \
    .order_by(WeedDetection.id) \
    .all()

buckets = [{"weed_count": 0, "step_count": 0} for _ in range(20)]
for i, det in enumerate(detections):
    cell_idx = min(i // steps_per_cell, 19)
    buckets[cell_idx]["weed_count"] += det.count
    buckets[cell_idx]["step_count"] += 1
```

Returns `[]` if no active run.

---

## React Implementation

### Derived values (computed at render time)

```js
const GRID_SIZE = 20;
const partitionType      = selectedFieldObj?.partition_type ?? 'row';
const pathCount          = selectedFieldObj?.partition_count ?? GRID_SIZE;
// row partition:    partition_count rows × 20 cols (robot moves horizontally)
// column partition: 20 rows × partition_count cols (robot moves vertically)
// Falls back to 8×12 when no field is selected (grid is still rendered during loading)
const gridRows           = selectedFieldObj ? (partitionType === 'row' ? pathCount : GRID_SIZE) : 8;
const gridCols           = selectedFieldObj ? (partitionType === 'row' ? GRID_SIZE : pathCount) : 12;
const forwardDistanceCm  = selectedFieldObj
  ? Math.round((partitionType === 'row' ? selectedFieldObj.length : selectedFieldObj.width) * 100)
  : 0;

// camera_vision_width_cm is stored as a string in the device record — parseFloat is required
const camWidthCm = parseFloat(currentDevice?.camera_vision_width_cm) || 0;
const totalStepsForPath = camWidthCm > 0 ? Math.round(forwardDistanceCm / camWidthCm) : 0;
const progressPct = (totalStepsForPath > 0 && detStatus?.current_steps != null)
  ? Math.min(100, Math.round((detStatus.current_steps / totalStepsForPath) * 100))
  : 0;
```

### Grid conversion

```js
function weedCountToDensity(count) {
  if (count < 10) return 'low';
  if (count < 20) return 'medium';
  return 'high';
}

// Converts the 20-item bucket array from the grid API into the 2D density grid
// expected by DensityGrid component.
// Cells with step_count === 0 remain null (rendered as unscanned/grey).
// currentPath: 1-based index of the path being scanned in this run
function bucketsToDensityGrid(buckets, gridRows, gridCols, partitionType, currentPath) {
  const grid = Array.from({ length: gridRows }, () => Array(gridCols).fill(null));
  const pathIdx = (currentPath ?? 1) - 1;  // convert to 0-based
  buckets.forEach(({ cell, weed_count, step_count }) => {
    if (cell < 0 || cell >= 20 || step_count === 0) return;
    const density = weedCountToDensity(weed_count);
    if (partitionType === 'row') {
      // row partition: fill grid[pathIdx][cell] — robot moves horizontally
      grid[pathIdx][cell] = density;
    } else {
      // column partition: fill grid[cell][pathIdx] — robot moves vertically
      grid[cell][pathIdx] = density;
    }
  });
  return grid;
}
```

### Polling setup

```js
// Status: every 2 s
statusPollRef.current = setInterval(async () => {
  const s = await pollDetectionStatus(selectedDev);
  setDetStatus(s);
  if (s.status === 'finished' || s.status === 'stopped') {
    stopPolling();
    setRunning(false);
    setLastRun(s.finished_at ?? s.stopped_at ?? new Date().toISOString());
  }
}, 2000);

// Grid: every 3.5 s
gridPollRef.current = setInterval(async () => {
  const g = await pollDetectionGrid(selectedDev);
  setLiveGrid(bucketsToDensityGrid(g, gridRows, gridCols, partitionType, +currentPath));
}, 3500);
```

### Grid and progress bar JSX

```jsx
<DensityGrid
  grid={liveGrid}
  cellSize={18}
  cellHeight={20}
  showLegend
  devicePos={detStatus?.device_position}
/>
<div>
  <span className="text-xs text-slate-400">Progress</span>
  <div className="flex items-center gap-2 mt-1">
    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
      <div
        className="h-full bg-green-500 rounded-full transition-all duration-500"
        style={{ width: `${progressPct}%` }}
      />
    </div>
    <strong className="text-sm tabular-nums w-10 text-right">{progressPct}%</strong>
  </div>
</div>
```

---

## Data Flow Summary

```
Detection start
  └─ POST /detection/start  { distance: forwardDistanceCm, ... }
       └─ Backend stores total_distance_cm = forwardDistanceCm in active_detection

Robot runs (each step)
  └─ Robot posts 1 row to weed_detections (run_id, count)

Frontend polls (every 2 s)
  └─ GET /detection/status
       └─ current_steps = COUNT(weed_detections WHERE run_id)
       └─ total_steps   = round(total_distance_cm / camera_vision_width_cm)
       └─ progress_pct  = round(current_steps / total_steps * 100)

Frontend polls (every 3.5 s)
  └─ GET /detection/grid
       └─ Detections ordered by id → divided into 20 buckets
       └─ Each bucket: { cell, weed_count, step_count }
       └─ Frontend maps to 2D density grid → DensityGrid renders coloured cells
```

---

## Edge Cases

| Scenario | Behaviour |
|---|---|
| `camera_vision_width_cm` is 0 or null | `total_steps = 0` → `progress_pct = 0`, grid shows all null |
| `total_steps < 20` | `steps_per_cell = 1`, excess cells remain at `step_count = 0` |
| Detection stopped mid-run | Polling stops, partial grid and progress remain visible |
| No detections posted yet | All 20 buckets have `step_count = 0` → all cells grey |
