"""Read-only crop geometry and edge diagnostics for visual-guide atlases.

Contact sheets and candidate edge strips are written outside the checkout.
Flat white artwork is legitimate, so boundary candidates require visual review.
Usage: python tools/audit-guided-crops.py [--pattern thumb-guided-*.png] [--out DIR]
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import tempfile

import numpy as np
from PIL import Image, ImageDraw


def crop_box(size, inset, index, measured=None):
    width, height = size
    if measured:
        cell_width, cell_height = measured["width"], measured["height"]
        margin = min(cell_width, cell_height) * inset
        side = min(cell_width, cell_height) - margin * 2
        left = measured["x"] + margin + (cell_width - margin * 2 - side) * measured.get("anchorX", .5)
        top = measured["y"] + margin + (cell_height - margin * 2 - side) * measured.get("anchorY", .5)
        return (left, top, left + side, top + side)
    cell_width, cell_height = width / 4, height / 3
    side = min(cell_width, cell_height) * (1 - 2 * inset)
    x, y = index % 4, index // 4
    left = x * cell_width + (cell_width - side) / 2
    top = y * cell_height + (cell_height - side) / 2
    return (left, top, left + side, top + side)


def edge_diagnostics(crop):
    rgb = np.asarray(crop.convert("RGB"))
    band = max(2, round(min(crop.size) * .025))
    strips = {"top": rgb[:band], "bottom": rgb[-band:],
              "left": rgb[:, :band], "right": rgb[:, -band:]}
    edges = {}
    for name, pixels in strips.items():
        flat = pixels.reshape(-1, 3).astype(float)
        white = (flat.min(axis=1) >= 245) & (np.ptp(flat, axis=1) <= 9)
        dark = flat.max(axis=1) <= 12
        # A uniform band can be either a separator or intentional flat artwork.
        median = np.median(flat, axis=0)
        uniform = (np.max(np.abs(flat - median), axis=1) <= 5).mean()
        edges[name] = {"white": round(float(white.mean()), 3),
                       "dark": round(float(dark.mean()), 3),
                       "uniform": round(float(uniform), 3),
                       "median": median.round().astype(int).tolist()}
    suspicious = [name for name, values in edges.items()
                  if values["white"] >= .85 or values["dark"] >= .85
                  or values["uniform"] >= .96]
    return edges, suspicious


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pattern", action="append", default=[])
    parser.add_argument("--out", type=Path,
                        default=Path(tempfile.gettempdir()) / "promptmaker-guided-qa")
    parser.add_argument("--source-bounds", action="store_true",
                        help="Preview measured source bounds before rebuilding browser metadata")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    directory = root / "site/assets/visual-guides/options"
    source = (root / "site/atlas-crops.js").read_text(encoding="utf-8")
    metadata = json.loads(source[source.index("{"):].strip().removesuffix(";"))
    source_bounds = json.loads((root / "tools/atlas_cell_bounds.json").read_text(encoding="utf-8")) if args.source_bounds else {}
    patterns = args.pattern or ["*.png"]
    files = sorted(set(path for pattern in patterns for path in directory.glob(pattern)))
    assert files, f"No atlases match {patterns}"
    args.out.mkdir(parents=True, exist_ok=True)
    report = {"atlases": [], "cropPolicy": "centered native-aspect square inside each 4×3 cell",
              "reviewNote": "Uniform/white/dark edge candidates are diagnostic, not failures."}
    summary_sheets = []
    for page_start in range(0, len(files), 8):
        page_files = files[page_start:page_start + 8]
        summary = Image.new("RGB", (12 * 104, len(page_files) * 124), "#ddd9e4")
        summary_draw = ImageDraw.Draw(summary)
        for row, file in enumerate(page_files):
            with Image.open(file) as original:
                original = original.convert("RGB")
                entry = metadata.get(file.name)
                if entry is None and args.source_bounds:
                    entry = {"width": original.width, "height": original.height, "inset": .04}
                assert entry, f"Missing browser atlas metadata: {file.name}"
                assert (entry["width"], entry["height"]) == original.size, f"Stale size: {file.name}"
                inset = float(entry["inset"])
                assert 0 < inset < .25, f"Invalid inset: {file.name}"
                cells = source_bounds.get(file.name, {}).get("cells") or entry.get("cells")
                if cells:
                    assert len(cells) == 12, f"Missing logical cell: {file.name}"
                atlas = {"file": file.name, "size": original.size, "inset": inset, "tiles": []}
                contact = Image.new("RGB", (4 * 224, 3 * 248), "#ddd9e4")
                contact_draw = ImageDraw.Draw(contact)
                for index in range(12):
                    measured = cells[index] if cells else None
                    box = crop_box(original.size, inset, index, measured)
                    cell_width, cell_height = original.width / 4, original.height / 3
                    x, y = index % 4, index // 4
                    content = measured or {"x": x * cell_width, "y": y * cell_height,
                                           "width": cell_width, "height": cell_height}
                    assert content["x"] < box[0] < box[2] < content["x"] + content["width"]
                    assert content["y"] < box[1] < box[3] < content["y"] + content["height"]
                    assert abs((box[2] - box[0]) - (box[3] - box[1])) < .001
                    crop = original.crop(tuple(round(value) for value in box))
                    assert abs(crop.width - crop.height) <= 1
                    edges, candidates = edge_diagnostics(crop)
                    atlas["tiles"].append({"index": index, "sourceCell": content, "crop": [round(value, 3) for value in box],
                                            "edgeBands": edges, "reviewEdges": candidates})
                    contact.paste(crop.resize((220, 220)), (x * 224 + 2, y * 248 + 2))
                    contact_draw.text((x * 224 + 5, y * 248 + 226), f"tile {index}", fill="#191720")
                    summary.paste(crop.resize((100, 100)), (index * 104 + 2, row * 124 + 2))
                    summary_draw.text((index * 104 + 4, row * 124 + 105), str(index), fill="#191720")
                name = file.stem + "-cropped.png"
                contact.save(args.out / name)
                atlas["contactSheet"] = name
                report["atlases"].append(atlas)
                summary_draw.text((34, row * 124 + 105), file.name, fill="#191720")
        summary_name = f"atlas-page-{page_start // 8 + 1:02d}.png"
        summary.save(args.out / summary_name)
        summary_sheets.append(summary_name)
    report["summarySheets"] = summary_sheets
    report["atlasCount"] = len(files)
    report["tileCount"] = len(files) * 12
    report["candidateTiles"] = sum(bool(tile["reviewEdges"])
                                     for atlas in report["atlases"] for tile in atlas["tiles"])
    report_path = args.out / "guided-crop-audit.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"PASS geometry: {len(files)} atlases / {len(files) * 12} tiles; "
          f"{report['candidateTiles']} edge candidates for visual review. {report_path}")


if __name__ == "__main__":
    main()
