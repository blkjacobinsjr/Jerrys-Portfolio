#!/usr/bin/env python3
"""Rebuild the small traced SVG data from the signature frame set.

Requires numpy, scipy, pillow, and potracer. By default the source set is the
local .portfolio-research copy; pass --source-dir to use another copy.
"""

from __future__ import annotations

import argparse
import glob
import json
import math
from pathlib import Path

import numpy as np
import potrace
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = Path.home() / "Documents/GitHub/.portfolio-research/research/sig"
SCALE = 0.5


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output", type=Path, default=ROOT / "src/components/signature-data.json")
    args = parser.parse_args()

    frames = sorted(glob.glob(str(args.source_dir / "frames/*.png")))
    if not frames:
        parser.error(f"No signature frames found under {args.source_dir / 'frames'}")
    pts = [float(line.strip().strip(",")) for line in (args.source_dir / "pts.txt").read_text().splitlines() if line.strip()]
    if len(pts) != len(frames):
        parser.error(f"Expected one timestamp per frame, found {len(pts)} timestamps and {len(frames)} frames")

    def ink(index: int) -> np.ndarray:
        with Image.open(frames[index]) as image:
            return np.asarray(image.convert("L")) < 128

    final = ink(len(frames) - 1)
    first_stroke = ink(38)
    first_two = ink(119)
    late_ink = final & ~first_two

    # The late pixels include the oval's final top edge and the diagonal slash.
    # Fit the slash axis from the two extreme ends so the oval cannot pull it off line.
    yy, xx = np.nonzero(late_ink)
    pixels = np.stack([xx, yy], axis=1).astype(float)
    center = pixels.mean(axis=0)
    vector = np.linalg.eigh(np.cov((pixels - center).T))[1][:, -1]
    projection = (pixels - center) @ vector
    lower = pixels[projection <= np.percentile(projection, 1)].mean(axis=0)
    upper = pixels[projection >= np.percentile(projection, 99)].mean(axis=0)
    slash_start, slash_end = (lower, upper) if lower[0] < upper[0] else (upper, lower)
    axis = slash_end - slash_start
    axis /= np.linalg.norm(axis)
    normal = np.array([-axis[1], axis[0]])
    grid_y, grid_x = np.indices(late_ink.shape)
    distance_from_axis = np.abs((grid_x - slash_start[0]) * normal[0] + (grid_y - slash_start[1]) * normal[1])

    # Estimate the brush half-width from a narrow lane through the slash centre.
    distance_inside_ink = ndimage.distance_transform_edt(late_ink)
    slash_lane = late_ink & (distance_from_axis < 12)
    slash_half_width = float(distance_inside_ink[slash_lane].max())
    slash_band = slash_half_width + 4
    slash_pixels = late_ink & (distance_from_axis <= slash_band)
    oval_finish = late_ink & ~slash_pixels

    y_all, x_all = np.nonzero(final)
    pad = 12
    x0, y0 = int(x_all.min()) - pad, int(y_all.min()) - pad
    x1, y1 = int(x_all.max()) + pad, int(y_all.max()) + pad

    def tx(x: float, y: float) -> tuple[int, int]:
        return round((x - x0) * SCALE), round((y - y0) * SCALE)

    def dilate(mask: np.ndarray, radius: int) -> np.ndarray:
        image = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(radius * 2 + 1))
        return np.asarray(image) > 127

    # A small frame-to-frame edge wobble leaves J pixels in the subtraction.
    # Keep them with J so the err/oval centreline does not need an oversized brush.
    first_stroke_core = dilate(first_stroke, 2)
    source_masks = [
        first_stroke_core,
        (first_two & ~first_stroke_core) | oval_finish,
        slash_pixels,
    ]

    def trace(mask: np.ndarray) -> str:
        bitmap = potrace.Bitmap(~mask)
        traced = bitmap.trace(turdsize=8, alphamax=1.0, opticurve=True, opttolerance=0.4)
        commands: list[str] = []
        for curve in traced:
            x, y = tx(curve.start_point.x, curve.start_point.y)
            commands.append(f"M{x} {y}")
            for segment in curve.segments:
                if segment.is_corner:
                    ax, ay = tx(segment.c.x, segment.c.y)
                    bx, by = tx(segment.end_point.x, segment.end_point.y)
                    commands.append(f"L{ax} {ay}L{bx} {by}")
                else:
                    ax, ay = tx(segment.c1.x, segment.c1.y)
                    bx, by = tx(segment.c2.x, segment.c2.y)
                    cx, cy = tx(segment.end_point.x, segment.end_point.y)
                    commands.append(f"C{ax} {ay} {bx} {by} {cx} {cy}")
            commands.append("Z")
        return "".join(commands)

    samples: list[tuple[int, float, float, float]] = []
    previous: np.ndarray | None = None
    for index in range(len(frames)):
        current = ink(index)
        if previous is not None:
            added = current & ~previous
            if added.sum() > 15:
                ys, xs = np.nonzero(added)
                samples.append((index, pts[index], float(xs.mean()), float(ys.mean())))
        previous = current

    def stroke_samples(start: int, end: int) -> list[tuple[float, float, float]]:
        return [(time, x, y) for index, time, x, y in samples if start <= index <= end]

    def line_data(points: list[tuple[float, float, float]]) -> tuple[str, dict[str, object]]:
        coordinates = np.asarray([tx(x, y) for _, x, y in points], dtype=float)
        segment_lengths = np.r_[0, np.cumsum(np.hypot(*np.diff(coordinates, axis=0).T))]
        times = np.asarray([time for time, _, _ in points])
        stops = [
            [round(float((time - times[0]) / (times[-1] - times[0])), 4), round(float(length / segment_lengths[-1]), 4)]
            for time, length in zip(times, segment_lengths)
        ]
        path = "M" + "L".join(f"{int(x)} {int(y)}" for x, y in coordinates)
        return path, {"start": float(times[0]), "duration": float(times[-1] - times[0]), "stops": stops}

    j_samples = stroke_samples(14, 36)
    err_samples = stroke_samples(40, 119)
    previous = first_two
    for index in range(120, len(frames)):
        current = ink(index)
        added_oval = (current & ~previous) & oval_finish
        if added_oval.sum() > 15:
            ys, xs = np.nonzero(added_oval)
            err_samples.append((pts[index], float(xs.mean()), float(ys.mean())))
        previous = current
    if not j_samples or not err_samples:
        parser.error("Could not find the first two pen strokes in the frame sequence")

    j_path, j_timing = line_data(j_samples)
    err_path, err_timing = line_data(err_samples)
    slash_start_x, slash_start_y = tx(*slash_start)
    slash_end_x, slash_end_y = tx(*slash_end)
    slash_path = f"M{slash_start_x} {slash_start_y}L{slash_end_x} {slash_end_y}"

    slash_progress: list[tuple[int, float, float]] = []
    slash_first = None
    slash_last = None
    for index in range(120, len(frames)):
        frame_late = ink(index) & ~first_two
        yy, xx = np.nonzero(frame_late)
        if not len(xx):
            continue
        frame_pixels = np.stack([xx, yy], axis=1).astype(float)
        distances = np.abs((frame_pixels - slash_start) @ normal)
        along = (frame_pixels - slash_start) @ axis
        active = along[distances <= slash_band]
        if not len(active):
            continue
        if slash_first is None:
            slash_first = index
        slash_last = index
        slash_progress.append((index, pts[index], float(active.max())))
    if slash_first is None or slash_last is None:
        parser.error("Could not find the final slash in the frame sequence")

    # Keep only advancing points to locate the source-aligned end of the slash.
    advancing: list[tuple[int, float, float]] = []
    furthest = -math.inf
    for sample in slash_progress:
        progress = sample[2]
        if progress > furthest:
            advancing.append(sample)
            furthest = progress
    # Frame 138 is a still hold after the slash has finished. Keep the actual
    # advancing endpoint and leave a short visible pen lift after the oval.
    pen_lift = 0.08
    slash_start_time = pts[slash_first - 1] + pen_lift
    slash_end_time = pts[advancing[-1][0]] + pen_lift
    # The source frame begins with most of the slash already present. Use its
    # timing, but reveal it with the requested accelerating flick instead of a jump.
    slash_stops = [[0, 0], [0.16, 0.01], [0.36, 0.06], [0.6, 0.2], [0.82, 0.52], [1, 1]]
    slash_timing = {"start": slash_start_time, "duration": slash_end_time - slash_start_time, "stops": slash_stops}

    stroke_samples_list = [j_samples, err_samples, [(0, *slash_start), (1, *slash_end)]]

    def mask_width(mask: np.ndarray, points: list[tuple[float, float, float]]) -> int:
        canvas = Image.new("1", (mask.shape[1], mask.shape[0]))
        draw = ImageDraw.Draw(canvas)
        positions = [(round(x), round(y)) for _, x, y in points]
        draw.line(positions, fill=1, width=1, joint="curve")
        centerline = np.asarray(canvas, dtype=bool)
        reach_map = ndimage.distance_transform_edt(~centerline)
        reach = float(reach_map[mask].max())
        # The extra source pixel covers raster rounding and antialiasing at the edge.
        return math.ceil(2 * (reach + 1) * SCALE)

    traced_masks = [dilate(mask, 1) for mask in source_masks]
    mask_widths = [mask_width(mask, points) for mask, points in zip(traced_masks, stroke_samples_list)]
    strokes = [
        {"fill": fill, "centerline": centerline, "maskWidth": width, "timing": timing}
        for fill, centerline, width, timing in zip(
            (trace(mask) for mask in traced_masks),
            (j_path, err_path, slash_path),
            mask_widths,
            (j_timing, err_timing, slash_timing),
        )
    ]
    box_width = round((x1 - x0) * SCALE)
    box_height = round((y1 - y0) * SCALE)
    result = {
        "viewBox": f"0 0 {box_width} {box_height}",
        "width": box_width,
        "height": box_height,
        "strokes": strokes,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, separators=(",", ":")) + "\n")
    print(json.dumps({"output": str(args.output), "viewBox": result["viewBox"], "maskWidths": mask_widths, "timing": [(entry["start"], entry["duration"]) for entry in (j_timing, err_timing, slash_timing)]}))


if __name__ == "__main__":
    main()
