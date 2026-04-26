# Progress Bar Calculation

## Overview

The progress bar shows how far the robot has advanced along the current detection path. It is computed entirely on the frontend using field dimensions, device camera width, and the live `current_steps` count polled from the backend.

---

## Formula

```
forward_distance_cm  = field.length × 100   (if partition_type == 'row')
                     = field.width  × 100   (if partition_type == 'column')

cam_width_cm         = parseFloat(device.camera_vision_width_cm) || 0

total_steps_for_path = cam_width_cm > 0 ? round(forward_distance_cm / cam_width_cm) : 0

progress_pct = (total_steps_for_path > 0 && current_steps != null)
               ? min(100, round(current_steps / total_steps_for_path × 100))
               : 0
```

**Source:** [DeviceControl.jsx lines 110–117](../src/pages/DeviceControl.jsx#L110)

---

## Why the frontend computes total_steps, not the backend

The backend returns `total_steps` in the detection status response, but it calculates it as `grid_x × grid_y` (the full field grid cell count across all paths). That is the total for the entire field, not for a single path. Since each detection run covers one path at a time, using the backend value would make progress reach only `1 / partition_count × 100 %` at completion.

The frontend instead derives `total_steps_for_path` from:
- `forwardDistanceCm` — the distance the robot travels along its path (field length for row type, field width for column type)
- `camera_vision_width_cm` — stored on the device; one robot step advances exactly this distance

---

## Step-by-step for different field sizes

| Field | Partition type | Camera width | forward_distance_cm | total_steps_for_path | Steps at 100% |
|---|---|---|---|---|---|
| 10 m × 5 m | row | 50 cm | 1000 cm | round(1000/50) = **20** | 20 |
| 10 m × 5 m | column | 50 cm | 500 cm | round(500/50) = **10** | 10 |
| 50 m × 20 m | row | 50 cm | 5000 cm | round(5000/50) = **100** | 100 |
| 50 m × 20 m | column | 50 cm | 2000 cm | round(2000/50) = **40** | 40 |
| 100 m × 30 m | row | 30 cm | 10000 cm | round(10000/30) = **333** | 333 |
| 100 m × 30 m | column | 30 cm | 3000 cm | round(3000/30) = **100** | 100 |

---

## Variables

| Variable | Source | Description |
|---|---|---|
| `partition_type` | `field.partition_type` | `'row'` — robot moves along field length; `'column'` — robot moves along field width |
| `field.length` | Field record (metres) | Physical length of the field |
| `field.width` | Field record (metres) | Physical width of the field |
| `camera_vision_width_cm` | Device record (stored as string — must use `parseFloat`) | Distance covered by one robot step |
| `current_steps` | `GET /detection/status` polled every 2 s | Number of weed detection rows written for the active run |
| `total_steps_for_path` | Computed on frontend | Steps required to traverse one path end-to-end |

---

## Edge cases

| Scenario | Behaviour |
|---|---|
| `camera_vision_width_cm` is 0, not set, or not parseable as a number | `cam_width_cm = 0` → `total_steps_for_path = 0` → `progress_pct = 0` (bar stays empty) |
| `current_steps` exceeds `total_steps_for_path` | `min(100, …)` clamps progress to 100% |
| `current_steps` is `null` (status not yet polled) | Guard `detStatus?.current_steps != null` keeps progress at 0 until first poll |
| Detection stopped before completion | Polling stops; progress bar freezes at the last polled value |
| Field not selected | `forwardDistanceCm = 0` → `total_steps_for_path = 0` → bar stays empty |
