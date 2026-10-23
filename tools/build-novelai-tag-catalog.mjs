import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(root, "novelai_tags.json");
const outputPath = resolve(root, "site", "novelai-tag-catalog.js");

const raw = JSON.parse(readFileSync(sourcePath, "utf8"));
const byTag = new Map();
// Neutral source expressions also occur in adult-themed catalog records.
// Their association with those records does not make the tag itself explicit.
const neutralSourceTags = new Set(["handcuffs", "sleeping"]);

function visit(value) {
  if (Array.isArray(value)) {
    value.forEach(visit);
    return;
  }
  if (!value || typeof value !== "object") return;

  if (Array.isArray(value.tags)) {
    for (const rawTag of value.tags) {
      const tag = String(rawTag || "").trim().toLowerCase();
      if (!tag) continue;
      const existing = byTag.get(tag);
      byTag.set(tag, {
        tag,
        label: value.name || tag,
        category: value.category || "기타",
        subCategory: value.subCategory || "",
        // A tag may occur in more than one source record.  Keep the stricter
        // classification so the browser can avoid surfacing it by default.
        nsfw: !neutralSourceTags.has(tag) && Boolean(existing?.nsfw || value.nsfw),
      });
    }
    return;
  }

  Object.values(value).forEach(visit);
}

visit(raw);

const items = [...byTag.values()].sort((a, b) => a.tag.localeCompare(b.tag));
const payload = {
  version: 1,
  source: "local NovelAI tag catalog",
  stats: {
    tags: items.length,
    nsfwTagged: items.filter((item) => item.nsfw).length,
  },
  items,
};

const output = [
  "(function () {",
  '  "use strict";',
  "",
  `  window.PM_NOVELAI_TAG_CATALOG = ${JSON.stringify(payload, null, 2)};`,
  "})();",
  "",
].join("\n");

writeFileSync(outputPath, output, "utf8");
console.log(`Wrote ${outputPath}`);
console.log(`Tags: ${items.length} (${payload.stats.nsfwTagged} marked NSFW)`);
