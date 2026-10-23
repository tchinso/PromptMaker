"""Inspect atlas crop edges and generate a contact sheet for visual QA.

White artwork can trigger candidates: this is diagnostic, not a pass/fail test.
Source assets are only read. Usage: python tools/audit-sprite-crops.py [output-dir]
"""
import json
from pathlib import Path
import sys
import tempfile

import numpy as np
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1]
out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(tempfile.gettempdir()) / "promptmaker-qa"
out.mkdir(parents=True, exist_ok=True)
files = sorted((root / "site/assets/visual-guides/options").glob("*.png"))
metadata_source = (root / "site/atlas-crops.js").read_text(encoding="utf-8")
metadata = json.loads(metadata_source[metadata_source.index("{"):].strip().removesuffix(";"))
canvas = Image.new("RGB", (12 * 96, len(files) * 108), "#aaa")
draw = ImageDraw.Draw(canvas)
findings = []
non_square = []
for row, file in enumerate(files):
    image = Image.open(file).convert("RGB")
    width, height = image.size
    entry = metadata[file.name]
    assert (entry["width"], entry["height"]) == image.size, f"Stale atlas dimensions: {file.name}"
    inset = entry["inset"]
    if abs(width / 4 - height / 3) > 1:
        non_square.append({"file": file.name, "size": image.size, "cellAspect": (width / 4) / (height / 3)})
    for index in range(12):
        cells = entry.get("cells")
        cell = cells[index] if cells else {"x": index % 4 * width / 4, "y": index // 4 * height / 3,
                                                "width": width / 4, "height": height / 3}
        cell_width, cell_height = cell["width"], cell["height"]
        margin = min(cell_width, cell_height) * inset
        side = min(cell_width, cell_height) - margin * 2
        left = cell["x"] + margin + (cell_width - margin * 2 - side) * cell.get("anchorX", .5)
        top = cell["y"] + margin + (cell_height - margin * 2 - side) * cell.get("anchorY", .5)
        box = (left, top, left + side, top + side)
        crop = image.crop(tuple(round(value) for value in box))
        rgb = np.asarray(crop)
        white = (rgb.min(axis=2) > 247) & (rgb.max(axis=2) - rgb.min(axis=2) < 6)
        edge = max(white[0].mean(), white[-1].mean(), white[:, 0].mean(), white[:, -1].mean())
        corner = max(white[:5, :5].mean(), white[:5, -5:].mean(), white[-5:, :5].mean(), white[-5:, -5:].mean())
        if edge > .8 or corner > .9:
            findings.append({"file": file.name, "tile": index, "whiteEdge": round(float(edge), 3), "whiteCorner": round(float(corner), 3)})
        canvas.paste(crop.resize((90, 90)), (index * 96, row * 108))
    draw.text((0, row * 108 + 90), file.name, fill="black")
canvas.save(out / "atlas-crops.png")
report = {"atlases": len(files), "cells": len(files) * 12, "cropPolicy": "measured cells with square crop, per-cell anchor and per-atlas inset",
          "nonSquareSourceCells": non_square, "whiteEdgeCandidates": findings}
(out / "atlas-crops.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
print(f"Audited {len(files)} atlases / {len(files) * 12} cells; {len(findings)} white-art candidates require visual review. Report: {out / 'atlas-crops.json'}")
