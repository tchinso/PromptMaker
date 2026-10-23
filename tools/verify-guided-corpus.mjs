import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, Script } from "node:vm";

const script = (name) => readFileSync(new URL(`../site/${name}.js`, import.meta.url), "utf8");
const sourceScript = script("corpus-library");
const guidedScript = script("guided-corpus");
const context = createContext({ window: {} });
new Script(sourceScript).runInContext(context);
const corpus = context.window.PM_CORPUS_LIBRARY;
const corpusBefore = JSON.stringify(corpus);
const sentinelStage = { id: "existing-stage", questions: [] };
context.window.PM_DATA = { stages: [sentinelStage] };
new Script(guidedScript).runInContext(context);
const guided = context.window.PM_GUIDED_CORPUS;

assert.equal(JSON.stringify(corpus), corpusBefore, "Guided vocabulary must not modify source data");
assert.equal(context.window.PM_DATA.stages.length, 1, "Vocabulary must not alter ordinary questions");
assert.equal(context.window.PM_DATA.stages[0], sentinelStage);
assert.equal(context.window.PM_CORPUS_STUDIO, undefined, "Ordinary selection requires no studio module");
assert.equal(guided.occurrenceToItem.size, corpus.stats.sourceOccurrences);
assert.equal(guided.occurrenceToItem.size, 4964);
assert.equal(new Set(guided.items.map((item) => item.id)).size, guided.items.length, "Stable IDs are collision free");
assert.equal(guided.groups.flatMap((group) => group.items).length, guided.items.length, "Each expression is reachable in one ordinary facet");
assert.ok(guided.stages.every((stageId) => guided.getGroups(stageId).length), "All seven ordinary steps expose vocabulary");

const expectedStage = {
  interaction: "scene", proportion: "character", appearance: "character",
  medium: "concept", environment: "concept", graphics: "concept", aesthetic: "concept",
  light: "mood", palette: "mood", air: "mood",
  "outfit-base": "outfit", construction: "outfit", fabric: "outfit", motif: "outfit", legwear: "outfit",
  floating: "props", accessory: "props", prop: "props",
  hands: "camera", pose: "camera", framing: "camera", camera: "camera", motion: "camera", gaze: "camera", layout: "camera",
};
let sourceCount = 0;
for (const [promptId, prompt] of Object.entries(corpus.sourcePrompts)) {
  for (const [sectionIndex, section] of prompt.sections.entries()) {
    for (const [tagIndex, source] of section.tags.entries()) {
      sourceCount++;
      const occurrenceId = `${promptId}:${sectionIndex}:${tagIndex}`;
      const id = guided.occurrenceToItem.get(occurrenceId);
      assert.ok(id, `${occurrenceId}: every source occurrence has an ordinary choice`);
      const item = guided.byId.get(id);
      const weight = source.weight == null ? null : String(source.weight);
      assert.equal(item.tag, source.tag, `${occurrenceId}: exact source expression`);
      assert.equal(item.section, source.section, `${occurrenceId}: original output section`);
      assert.ok(item.weights.includes(weight), `${occurrenceId}: original emphasis is selectable`);
      assert.ok(item.weights.includes(null), `${occurrenceId}: phrase can also be used without emphasis`);
      assert.equal(item.stageId, expectedStage[item.facet], `${occurrenceId}: semantic ordinary step`);
      assert.ok(guided.getGroups(item.stageId).some((group) => group.items.some((choice) => choice.id === id)));
      const evidence = item.sources.find((candidate) => candidate.id === occurrenceId);
      assert.equal(evidence.rawTag, source.rawTag ?? source.tag);
      assert.equal(evidence.sectionLabel, section.label);
      assert.equal(evidence.facet, source.facet);
      const compiled = guided.compile({ selections: { [id]: weight } });
      assert.equal(compiled.selected.length, 1, `${occurrenceId}: no bundle or sibling phrase imported`);
      assert.equal(compiled.selected[0].text, weight == null ? source.tag : `${weight}::${source.tag}::`);
      assert.equal(compiled.selected[0].section, source.section);
      assert.ok(item.searchText.includes(prompt.title.toLowerCase()), `${occurrenceId}: Korean source title is searchable`);
    }
  }
}
assert.equal(sourceCount, 4964);

const allSelections = Object.fromEntries(guided.items.map((item) => [item.id, item.weights.at(-1)]));
assert.equal(guided.compile({ selections: allSelections }).selected.length, guided.items.length, "Explicit selections have no density budget");
assert.equal(guided.compile({ selections: allSelections }, () => false).selected.length, 0, "Scene filtering applies to explicit choices");
assert.equal(guided.compile({ blocks: ["p01-01:0"], pins: ["p01-01:0:0"] }).selected.length, 0, "Studio state cannot import ordinary choices");
const originalSelection = guided.compile({ selections: allSelections });
context.window.PM_CORPUS_STUDIO = { blocks: ["p17-01:0"], pins: ["p01-01:0:0"] };
assert.equal(JSON.stringify(guided.compile({ selections: allSelections })), JSON.stringify(originalSelection), "Changing studio state cannot affect ordinary compilation");

for (const value of [undefined, null, false, 3, "bad state", []]) {
  const normalized = guided.normalize(value);
  assert.equal(Object.keys(normalized.selections).length, 0);
  assert.equal(normalized.useBase, false);
  assert.equal(normalized.active, false);
}
const example = guided.items.find((item) => item.weights.length > 1);
const normalized = guided.normalize({ selections: { missing: "1.3", [example.id]: "unavailable weight" }, useBase: "true" });
assert.equal(normalized.selections[example.id], null, "Invalid saved weights recover to an unweighted phrase");
assert.equal(Object.keys(normalized.selections).length, 1);
assert.equal(normalized.useBase, false);
assert.equal(guided.normalize({ useBase: true }).useBase, true);
assert.equal(guided.normalize({ active: true }).active, true);
assert.equal(JSON.stringify(guided.normalize(JSON.parse(JSON.stringify(normalized)))), JSON.stringify(normalized), "Persistence is idempotent");
assert.equal(guided.keyFor(" 1.25::Silver  Necklace:: "), "silver necklace");
assert.ok(guided.items.find((item) => item.tag === "watercolor painting").searchText.includes("수채화"));
assert.ok(guided.items.find((item) => item.tag === "blue leg warmers").label.includes("레그워머"));

// Test source-order independence, section identity, explicit zero, quoted text
// and commas as part of a phrase rather than prompt separators.
const fixture = {
  grammar: { facets: corpus.grammar.facets },
  sourcePrompts: {
    first: { title: "별도 변형", pageId: 1, sections: [{ label: "의상", tags: [
      { tag: "ornament", rawTag: "ornament", weight: 0, facet: "motif", section: "outfit" },
      { tag: 'large title text "CHERRY, POP"', rawTag: 'large title text "CHERRY, POP"', weight: "1.4", facet: "graphics", section: "background" },
    ] }] },
    second: { title: "다른 출력 영역", pageId: 2, sections: [{ label: "배경", tags: [
      { tag: "ornament", weight: null, facet: "floating", section: "background" },
      { tag: "ornament", weight: "1.8", facet: "motif", section: "outfit" },
    ] }] },
  },
};
function fixtureGuided(sourcePrompts) {
  const isolated = createContext({ window: { PM_CORPUS_LIBRARY: { ...fixture, sourcePrompts } } });
  new Script(guidedScript).runInContext(isolated);
  return isolated.window.PM_GUIDED_CORPUS;
}
const first = fixtureGuided(fixture.sourcePrompts);
const reversed = fixtureGuided(Object.fromEntries(Object.entries(fixture.sourcePrompts).reverse()));
for (const item of first.items) {
  const second = reversed.items.find((candidate) => candidate.tag === item.tag && candidate.section === item.section);
  assert.equal(second.id, item.id, "Reordering source files cannot change saved IDs");
}
const zero = first.items.find((item) => item.tag === "ornament" && item.section === "outfit");
assert.ok(zero.weights.includes("0"));
assert.equal(first.compile({ selections: { [zero.id]: 0 } }).selected[0].text, "0::ornament::");
assert.equal(first.items.filter((item) => item.tag === "ornament").length, 2, "Same wording in different sections remains independently selectable");
const quote = first.items.find((item) => item.facet === "graphics");
assert.equal(first.compile({ selections: { [quote.id]: "1.4" } }).selected[0].text, '1.4::large title text "CHERRY, POP"::');

// Legacy source bundles are materialized once into ordinary selections. This
// compiler exists for migration only and contributes no state to the result.
const migrationContext = createContext({ window: { PM_DATA: { stages: [] } } });
for (const name of ["corpus-library", "corpus-studio", "guided-corpus"]) {
  new Script(script(name)).runInContext(migrationContext);
}
const migrator = migrationContext.window.PM_GUIDED_CORPUS;
const oldStudio = migrationContext.window.PM_CORPUS_STUDIO;
const migrationRows = (result) => [
  ...migrator.compile(result.guided).selected.map((item) => `${item.section}\u0000${item.text}`),
  ...Object.entries(result.custom).flatMap(([section, texts]) => texts.map((text) => `${section}\u0000${text}`)),
].sort();
function assertMigrationOrder(result, expected, label) {
  const actual = migrator.compile(result.guided).selected;
  for (const section of ["character", "concept", "background", "composition", "outfit"]) {
    assert.equal(JSON.stringify(actual.filter((item) => item.section === section).map((item) => item.text)), JSON.stringify(expected.filter((item) => item.section === section).map((item) => item.text)), `${label}/${section}: migrated expression order follows the original grammar and selection order`);
  }
}
let migrations = 0;
for (const block of oldStudio.blocks) {
  for (const density of ["density-light", "density-standard", "density-rich"]) {
    const studio = { blocks: [block.id] };
    const expected = oldStudio.compile(studio, density).selected.map((item) => `${item.section}\u0000${item.text}`).sort();
    const result = migrator.migrateStudio({ studio, density }, oldStudio);
    assert.equal(JSON.stringify(migrationRows(result)), JSON.stringify(expected), `${block.id}/${density}: migration retains the currently compiled output`);
    assertMigrationOrder(result, oldStudio.compile(studio, density).selected, `${block.id}/${density}`);
    assert.equal(result.guided.active, true);
    assert.equal(result.guided.useBase, false);
    assert.equal(Object.keys(result.custom).length, 0, "Source expressions become ordinary selections");
    assert.equal(JSON.stringify(Object.keys(result).sort()), JSON.stringify(["custom", "guided"]), "Migration returns no hidden legacy state");
    migrations++;
  }
}
for (const [index, block] of oldStudio.blocks.entries()) {
  const other = oldStudio.blocks[(index + 137) % oldStudio.blocks.length];
  const pinned = block.tags.at(-1);
  const excluded = other.tags.find((tag) => oldStudio.keyFor(tag.tag) !== oldStudio.keyFor(pinned.tag));
  const studio = { blocks: [block.id, other.id], pins: [pinned.id], excluded: excluded ? [excluded.id] : [] };
  for (const density of ["density-light", "density-standard", "density-rich"]) {
    const result = migrator.migrateStudio({ studio, density }, oldStudio);
    const expected = oldStudio.compile(studio, density).selected.map((item) => `${item.section}\u0000${item.text}`).sort();
    assert.equal(JSON.stringify(migrationRows(result)), JSON.stringify(expected), `${block.id}+${other.id}/${density}: mixed migration retains pins, exclusions and emphasis`);
    assertMigrationOrder(result, oldStudio.compile(studio, density).selected, `${block.id}+${other.id}/${density}`);
    migrations++;
  }
}
for (const promptId of Object.keys(corpus.sourcePrompts)) {
  const studio = { blocks: oldStudio.blocks.filter((block) => block.promptId === promptId).map((block) => block.id) };
  for (const density of ["density-light", "density-standard", "density-rich"]) {
    const result = migrator.migrateStudio({ studio, density }, oldStudio);
    const expected = oldStudio.compile(studio, density).selected.map((item) => `${item.section}\u0000${item.text}`).sort();
    assert.equal(JSON.stringify(migrationRows(result)), JSON.stringify(expected), `${promptId}/${density}: all source sections migrate together without duplication`);
    assertMigrationOrder(result, oldStudio.compile(studio, density).selected, `${promptId}/${density}`);
    migrations++;
  }
}
const sourceCustom = {
  blocks: ["p01-01:0"],
  custom: { concept: ["watercolor painting", "2.345::mist::"], background: ['1.25::light, fog::', "a private scene effect"] },
};
const migrationInput = { studio: sourceCustom, density: "density-light" };
const migrationInputBefore = JSON.stringify(migrationInput);
const migratedCustom = migrator.migrateStudio(migrationInput, oldStudio);
const customExpected = oldStudio.compile(sourceCustom, "density-light").selected.map((item) => `${item.section}\u0000${item.text}`).sort();
assert.equal(JSON.stringify(migrationRows(migratedCustom)), JSON.stringify(customExpected), "Arbitrary source custom text and unsupported weights migrate without coercion");
assert.equal(JSON.stringify(migrationInput), migrationInputBefore, "Migration cannot mutate the saved draft");
assert.ok(migratedCustom.custom.concept.includes("2.345::mist::"), "Unavailable source weights remain exact ordinary custom text");
assert.ok(migratedCustom.custom.background.includes('1.25::light, fog::'), "Grouped weighted custom phrases remain intact");
const watercolor = migrator.items.find((item) => item.tag === "watercolor painting" && item.section === "concept");
assert.equal(migratedCustom.guided.selections[watercolor.id], null, "Known unweighted custom expressions become ordinary choices");
const existing = { selections: { [watercolor.id]: null }, useBase: true };
const existingWins = migrator.migrateStudio({ guided: existing, studio: { custom: { concept: ["2.345::watercolor painting::"] } } }, oldStudio);
assert.equal(Object.keys(existingWins.custom).length, 0, "Existing ordinary choices override source custom duplicates");
assert.equal(existingWins.guided.selections[watercolor.id], null);
assert.equal(existingWins.guided.useBase, true, "Existing ordinary cast base setting takes precedence");
const existingNoBase = migrator.migrateStudio({ guided: { selections: { [watercolor.id]: null } }, studio: { custom: { concept: ["other phrase"] }, useBase: true } }, oldStudio);
assert.equal(existingNoBase.guided.useBase, false, "Existing ordinary base opt-out survives an opted-in legacy source");
for (const useBase of [false, true]) {
  const onlyCustom = migrator.migrateStudio({ studio: { custom: { concept: ["private custom only"] }, useBase } }, oldStudio);
  assert.equal(onlyCustom.guided.active, true, "Custom-only migration preserves the source-style base decision");
  assert.equal(onlyCustom.guided.useBase, useBase);
  assert.equal(Object.keys(onlyCustom.guided.selections).length, 0);
}
const firstBlock = oldStudio.blocks[0];
const allExcluded = migrator.migrateStudio({ studio: { blocks: [firstBlock.id], excluded: firstBlock.tags.map((item) => item.id) } }, oldStudio);
assert.equal(allExcluded.guided.active, true, "An intentionally empty excluded source draft cannot acquire cast defaults during migration");
assert.equal(Object.keys(allExcluded.guided.selections).length + Object.keys(allExcluded.custom).length, 0);
const allow = (text) => !/sky|light|cloud/.test(text);
const filtered = migrator.migrateStudio({ studio: { blocks: ["p01-01:0"] }, density: "density-light" }, oldStudio, allow);
assert.equal(JSON.stringify(migrationRows(filtered)), JSON.stringify(oldStudio.compile({ blocks: ["p01-01:0"] }, "density-light", allow).selected.map((item) => `${item.section}\u0000${item.text}`).sort()), "Migration uses the same allow predicate before applying the old density budget");
assert.equal(migrator.migrateStudio({}, oldStudio).guided.active, false);
assert.equal(migrator.migrateStudio({ guided: existing }).guided.selections[watercolor.id], null, "Missing migration compiler preserves ordinary choices");

console.log(`Guided corpus verified: ${sourceCount} source occurrences, ${guided.items.length} independently selectable expressions, ${guided.groups.length} facet groups across ${guided.stages.length} ordinary steps; ${migrations} source and mixture migrations preserve exact output.`);
