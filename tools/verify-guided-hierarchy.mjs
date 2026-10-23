#!/usr/bin/env node
// Hierarchy-only audit. The existing corpus/compiler audits remain authoritative
// for all source weights, variants and legacy draft migrations.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, Script } from "node:vm";

const site = new URL("../site/", import.meta.url);
const context = createContext({ window: {} });
const load = (name) => new Script(readFileSync(new URL(`${name}.js`, site), "utf8"), { filename: `${name}.js` }).runInContext(context);
for (const name of ["data", "corpus-library", "novelai-tag-catalog", "freedom-data", "corpus-studio", "guided-options", "guided-corpus",
  "guided-descriptions-world", "guided-descriptions-outfit", "guided-descriptions-action"]) load(name);

const { PM_DATA: data, PM_CORPUS_LIBRARY: corpus, PM_GUIDED_CORPUS: guided } = context.window;
const sourceBefore = JSON.stringify(corpus);
const dataBefore = JSON.stringify(data);
const itemsBefore = JSON.stringify(guided.items);
const groupsBefore = JSON.stringify(guided.groups);
const occurrencesBefore = JSON.stringify([...guided.occurrenceToItem]);
const selections = Object.fromEntries(guided.items.map((item) => [item.id, item.weights.at(-1)]));
const savedBefore = JSON.stringify(guided.normalize({ selections, active: true, useBase: true }));
const outputBefore = JSON.stringify(guided.compile({ selections, active: true, useBase: true }));

load("guided-hierarchy");
const hierarchy = context.window.PM_GUIDED_HIERARCHY;
assert.ok(hierarchy, "The integrated hierarchy is exported");
for (const key of ["roots", "byId", "itemPaths"]) {
  assert.equal(typeof hierarchy[key]?.get, "function", `${key} is an indexed map`);
  assert.equal(typeof hierarchy[key]?.entries, "function", `${key} is an iterable map`);
}
assert.equal(typeof hierarchy.getRoot, "function");
assert.equal(guided.items.length, 3217, "No independently selectable source expression is removed");
assert.equal(guided.occurrenceToItem.size, 4964, "All original source occurrences remain mapped");
assert.equal(JSON.stringify(corpus), sourceBefore, "Hierarchy construction cannot alter source phrases, variants or weights");
assert.equal(JSON.stringify(data), dataBefore, "Hierarchy construction cannot replace or mutate existing ordinary choices");
assert.equal(JSON.stringify(guided.items), itemsBefore, "Exact item IDs, tags, sections, variants and weights are preserved");
assert.equal(JSON.stringify(guided.groups), groupsBefore, "Original semantic facet membership is preserved");
assert.equal(JSON.stringify([...guided.occurrenceToItem]), occurrencesBefore, "Every source occurrence retains its existing item identity");
assert.equal(JSON.stringify(guided.normalize({ selections, active: true, useBase: true })), savedBefore,
  "Existing saved selection and weight state is unchanged");
assert.equal(JSON.stringify(guided.compile({ selections, active: true, useBase: true })), outputBefore,
  "Hierarchy construction cannot change the original compiled prompt");

const questions = new Map(data.stages.flatMap((stage) => stage.questions.map((question) => [question.id, { ...question, stageId: stage.id }])));
const visited = new Set();
const assigned = new Map();
const actualPaths = new Map();
let leafCount = 0;
let deepest = 0;
let largestLeaf = 0;
const childNode = (value) => typeof value === "string" ? hierarchy.byId.get(value) : value;
const ids = (items) => [...items].map((item) => typeof item === "string" ? item : item.id).sort();
const equalIds = (actual, expected, label) => assert.equal(JSON.stringify(ids(actual)), JSON.stringify(ids(expected)), label);

function walk(node, host, parent, path) {
  assert.ok(node && typeof node.id === "string" && node.id, `${host}: valid node identity`);
  assert.equal(hierarchy.byId.get(node.id), node, `${node.id}: nodes use the canonical index`);
  assert.ok(!visited.has(node.id), `${node.id}: no cycles, duplicate children or multiple parents`);
  visited.add(node.id);
  assert.equal(node.questionId, host, `${node.id}: descendants stay inside their ordinary question`);
  assert.equal(node.parentId ?? null, parent?.id ?? null, `${node.id}: parent link matches the tree`);
  assert.ok(typeof node.label === "string" && /[가-힣]/.test(node.label), `${node.id}: a readable Korean category label`);
  assert.ok(Array.isArray(node.children) && Array.isArray(node.items) && Array.isArray(node.allItems), `${node.id}: complete branch data`);
  assert.ok(node.children.length <= 8, `${node.id}: each level offers at most eight semantic families`);
  assert.ok(node.children.length || node.items.length, `${node.id}: no empty category`);
  assert.ok(!node.children.length || !node.items.length, `${node.id}: expressions belong to leaves rather than hidden intermediate nodes`);
  if (node.imageKey != null) {
    assert.ok(["world", "detail"].includes(node.imageKey.sheet), `${node.id}: known hierarchy artwork sheet`);
    assert.ok(Number.isInteger(node.imageKey.index) && node.imageKey.index >= 0 && node.imageKey.index < 12,
      `${node.id}: hierarchy illustration stays inside its 4×3 sheet`);
  }
  const trail = [...path, node.id];
  assert.ok(trail.length <= 4, `${node.id}: category navigation stays within three refinements of its question`);
  deepest = Math.max(deepest, trail.length);
  const descendants = [];
  for (const child of node.children) descendants.push(...walk(childNode(child), host, node, trail));
  if (!node.children.length) {
    leafCount++;
    largestLeaf = Math.max(largestLeaf, node.items.length);
    for (const value of node.items) {
      const id = typeof value === "string" ? value : value.id;
      const item = guided.byId.get(id);
      assert.ok(item, `${node.id}: only existing source expressions can be selected (${id})`);
      if (typeof value !== "string") assert.equal(value, item, `${id}: hierarchy references the exact original item`);
      assert.ok(!assigned.has(id), `${id}: expression appears in exactly one leaf, first found in ${assigned.get(id)}`);
      assigned.set(id, node.id);
      actualPaths.set(id, trail);
      descendants.push(item);
    }
  }
  equalIds(node.allItems, descendants, `${node.id}: host-wide search and descendant counts include every leaf exactly once`);
  return descendants;
}

assert.ok(hierarchy.roots.size >= 7, "Vocabulary is distributed among ordinary questions");
for (const [questionId, root] of hierarchy.roots) {
  assert.ok(questions.has(questionId), `${questionId}: hierarchy is attached to an existing ordinary question`);
  const host = questions.get(questionId);
  for (const condition of ["dynamicPack", "visibleWhen", "visibleWhenAny"]) {
    assert.ok(!host[condition], `${questionId}: all source expressions remain accessible without ${condition} prerequisites`);
  }
  assert.equal(hierarchy.getRoot(questionId), root, `${questionId}: public root lookup`);
  walk(childNode(root), questionId, null, []);
}
assert.equal(visited.size, hierarchy.byId.size, "Every indexed category is reachable from an ordinary question");
assert.equal(assigned.size, guided.items.length, "Every source expression is reachable in exactly one leaf");
assert.equal(hierarchy.itemPaths.size, guided.items.length, "Every expression exposes a complete breadcrumb path");
for (const item of guided.items) {
  const path = hierarchy.itemPaths.get(item.id);
  assert.ok(Array.isArray(path) && path.length >= 2, `${item.id}: a navigable category path`);
  assert.equal(JSON.stringify(path), JSON.stringify(actualPaths.get(item.id)), `${item.id}: stored breadcrumb reaches its unique leaf`);
}
for (const [occurrence, itemId] of guided.occurrenceToItem) {
  assert.ok(assigned.has(itemId), `${occurrence}: original source occurrence is accessible through its unchanged item`);
}
assert.equal(hierarchy.getRoot("missing-question"), undefined, "Unknown questions do not gain a fallback category");

const html = readFileSync(new URL("index.html", site), "utf8");
const hierarchyIndex = html.indexOf('src="guided-hierarchy.js"');
assert.ok(hierarchyIndex > html.indexOf('src="guided-corpus.js"') && hierarchyIndex < html.indexOf('src="app.js'),
  "The browser loads hierarchy after vocabulary and before the interface");
console.log(`Guided hierarchy verified: ${assigned.size} expressions / ${guided.occurrenceToItem.size} original occurrences, ${hierarchy.roots.size} question hosts, ${visited.size} categories, ${leafCount} leaves, depth ${deepest}, largest leaf ${largestLeaf}; source, weights, saved state and compiled output unchanged.`);
