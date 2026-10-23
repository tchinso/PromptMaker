import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, Script } from "node:vm";

const context = createContext({ window: {} });
for (const file of ["data", "corpus-library", "novelai-tag-catalog", "freedom-data", "corpus-studio", "guided-options", "guided-corpus", "guided-descriptions-world", "guided-descriptions-outfit", "guided-descriptions-action"]) {
  new Script(readFileSync(new URL(`../site/${file}.js`, import.meta.url), "utf8"), { filename: file }).runInContext(context);
}
const items = context.window.PM_GUIDED_CORPUS.items;
const explanations = context.window.PM_GUIDED_DESCRIPTIONS;
assert.equal(Object.keys(explanations).length, items.length, "Every ordinary expression needs a Korean explanation");
const duplicateCounts = new Map();
for (const item of items) {
  const entry = explanations[item.id];
  assert.ok(entry, `${item.tag}: missing Korean explanation`);
  assert.equal(typeof entry.label, "string", `${item.tag}: missing localized label`);
  assert.ok(entry.label.trim(), `${item.tag}: empty localized label`);
  assert.equal(typeof entry.description, "string", item.tag);
  assert.ok(entry.description.trim().length >= 15, `${item.tag}: explanation too short`);
  assert.ok(entry.description.length <= 250, `${item.tag}: explanation too long for selection UI`);
  const korean = entry.description.match(/[가-힣]/g)?.length || 0;
  const latin = entry.description.match(/[a-z]/gi)?.length || 0;
  assert.ok(korean >= 8 && korean > latin, `${item.tag}: explanation must primarily be Korean`);
  assert.ok(!/준비 중|설명 없음|TODO|번역 예정|원본 태그 그대로/.test(entry.description), `${item.tag}: placeholder`);
  duplicateCounts.set(entry.description, (duplicateCounts.get(entry.description) || 0) + 1);
}
const duplicateExamples = [...duplicateCounts].filter(([, count]) => count > 5).sort((a, b) => b[1] - a[1]);
console.log(`Korean descriptions verified: ${items.length} expressions, ${duplicateCounts.size} distinct explanations.`);
if (duplicateExamples.length) console.log(`Review shared synonym explanations: ${JSON.stringify(duplicateExamples.slice(0, 8))}`);
