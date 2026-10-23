import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, Script } from "node:vm";
const context = createContext({ window: {} });
for (const file of ["data", "corpus-library", "novelai-tag-catalog", "freedom-data", "corpus-studio", "guided-options", "guided-corpus", "guided-hierarchy"]) {
  new Script(readFileSync(new URL(`../site/${file}.js`, import.meta.url), "utf8")).runInContext(context);
}
const corpus = context.window.PM_CORPUS_LIBRARY;
const studio = context.window.PM_CORPUS_STUDIO;
const guided = context.window.PM_GUIDED_CORPUS;
assert.ok(!context.window.PM_DATA.stages.some((stage) => stage.id === "corpus-studio"), "The retired source-combination stage is absent from ordinary navigation");
assert.equal(corpus.source.pages, 17);
assert.equal(corpus.source.prompts, 205);
assert.equal(corpus.sourcePrompts["p15-02"].sections.length, 14, "Animal variants must remain separate");
assert.equal(studio.blocks.flatMap((b) => b.tags).length, corpus.stats.sourceOccurrences ?? corpus.stats.occurrences, "No tag occurrence lost during reclassification");
for (const tag of studio.tags.values()) {
  assert.ok(studio.facets.some((f) => f.id === tag.facet && f.section === tag.section), tag.tag);
}
const cases = {
  "light blue yukata": "outfit-base", "blue leg warmers": "legwear", "heart charm": "accessory",
  "pearl necklace": "accessory", "warm and cool light contrast": "light", "blue color scheme": "palette",
  "hand near mouth": "hands", "holding electric guitar": "hands", "floating ribbons": "floating",
  "magazine cover": "layout", "white outline": "graphics", "watercolor painting": "medium",
};
for (const [text, facet] of Object.entries(cases)) {
  const entries = [...studio.tags.values()].filter((item) => item.tag === text);
  assert.ok(entries.length, text);
  assert.ok(entries.every((item) => item.facet === facet), `${text}: ${entries.map((i) => i.facet)}`);
}
assert.ok([...studio.tags.values()].some((item) => item.text === '2::large title text "CHERRY"::'));
assert.ok([...studio.tags.values()].some((item) => item.tag === ":3"));
const selected = { blocks: ["p16-08:0", "p16-08:1"], pins: [], excluded: [] };
const light = studio.compile(selected, "density-light");
const standard = studio.compile(selected, "density-standard");
const rich = studio.compile(selected, "density-rich");
assert.ok(light.selected.length < standard.selected.length);
assert.ok(standard.selected.length < rich.selected.length);
assert.equal(rich.omitted, 0);
for (const item of rich.selected.filter((item) => item.weight)) {
  assert.ok(light.selected.some((other) => other.id === item.id), "Source weights survive density");
}
const optional = rich.selected.find((item) => !light.selected.some((other) => other.id === item.id));
const pinned = studio.compile({ ...selected, pins: [optional.id] }, "density-light");
assert.ok(pinned.selected.some((item) => item.id === optional.id));
const excluded = studio.compile({ ...selected, excluded: [optional.id] }, "density-rich");
assert.ok(!excluded.selected.some((item) => item.id === optional.id));
const female = studio.compile({ blocks: ["p17-01:1"] }, "density-rich");
assert.ok(female.selected.some((item) => item.tag === "black pinafore dress"));
assert.ok(!female.selected.some((item) => item.tag === "baggy cargo pants"));
assert.equal(studio.compile({ blocks: ["missing"], pins: ["missing"] }).selected.length, 0);
assert.equal(studio.compile(selected, "density-rich", () => false).selected.length, 0);

// Check every independently selectable source variant, not only sample recipes.
const densities = ["density-light", "density-standard", "density-rich"];
let ordinaryReconstructions = 0;
for (const block of studio.blocks) {
  const sourceSection = corpus.sourcePrompts[block.promptId].sections[Number(block.id.split(":").at(-1))];
  assert.equal(block.rawText, sourceSection.rawText || "", `${block.id}: original source text is available for inspection`);
  const results = ["density-light", "density-standard", "density-rich"].map((density) => studio.compile({ blocks: [block.id] }, density));
  const richKeys = new Set(results[2].selected.map((item) => studio.keyFor(item.tag)));
  assert.equal(richKeys.size, new Set(block.tags.map((item) => studio.keyFor(item.tag))).size, `${block.id}: full source coverage`);
  for (let index = 0; index < results.length; index++) {
    const result = results[index];
    assert.equal(result.total, richKeys.size, `${block.id}: totals count unique phrases`);
    assert.equal(result.omitted, result.total - result.selected.length);
    const selectedKeys = new Set(result.selected.map((item) => studio.keyFor(item.tag)));
    assert.equal(selectedKeys.size, result.selected.length, `${block.id}: no duplicate phrases`);
    for (const facet of new Set(block.tags.map((item) => item.facet))) {
      // A phrase reclassified differently in the same source appears only once.
      if (results[2].selected.some((item) => item.facet === facet)) {
        assert.ok(result.selected.some((item) => item.facet === facet), `${block.id}: preserve ${facet}`);
      }
    }
    for (const item of results[2].selected.filter((item) => item.weight != null)) {
      assert.ok(selectedKeys.has(studio.keyFor(item.tag)), `${block.id}: preserve weighted ${item.tag}`);
    }
    if (index > 0) for (const item of results[index - 1].selected) {
      assert.ok(selectedKeys.has(studio.keyFor(item.tag)), `${block.id}: increasing density never removes a phrase`);
    }
    const order = result.selected.map((item) => studio.facets.findIndex((facet) => facet.id === item.facet));
    assert.ok(order.every((value, index) => !index || order[index - 1] <= value), `${block.id}: semantic output order`);
  }
}

// Controlled fixtures exercise collisions that otherwise depend on the source
// archive happening to contain the right combination of phrases and weights.
const fixtureContext = createContext({ window: {
  PM_CORPUS_LIBRARY: { grammar: { facets: studio.facets }, sourcePrompts: { sample: {
    title: "Compiler precedence fixture", pageId: 1, sections: [
      { label: "Variant A", tags: [
        { tag: "silver necklace", weight: null, facet: "accessory", section: "outfit" },
        { tag: "mist", weight: null, facet: "air", section: "background" },
      ] },
      { label: "Variant B", tags: [
        { tag: "Silver  necklace", weight: "1.4", facet: "accessory", section: "outfit" },
        { tag: "mist", weight: "0", facet: "air", section: "background" },
        { tag: "soft light", weight: 0, facet: "light", section: "background" },
      ] },
      { label: "Variant C", tags: [{ tag: "silver necklace", weight: "1.8", facet: "accessory", section: "outfit" }] },
    ],
  } } }, PM_DATA: { stages: [] },
} });
new Script(readFileSync(new URL("../site/corpus-studio.js", import.meta.url), "utf8")).runInContext(fixtureContext);
const fixture = fixtureContext.window.PM_CORPUS_STUDIO;
const combined = { blocks: ["sample:0", "sample:1", "sample:2"] };
const necklace = (result) => result.selected.find((item) => fixture.keyFor(item.tag) === "silver necklace");
assert.equal(necklace(fixture.compile(combined)).text, "1.4::Silver  necklace::", "Weighted source replaces earlier unweighted duplicate");
assert.equal(necklace(fixture.compile({ blocks: [...combined.blocks].reverse() })).weight, "1.8", "First selected weighted source has stable precedence");
assert.equal(fixture.tags.get("sample:1:2").text, "0::soft light::", "Numeric zero weights remain explicit");
const explicitPin = fixture.compile({ ...combined, pins: ["sample:0:0", "sample:1:0"], excluded: ["sample:2:0"] });
assert.equal(necklace(explicitPin).id, "sample:0:0", "First explicit pin overrides source weights and exclusion");
assert.equal(explicitPin.selected.filter((item) => fixture.keyFor(item.tag) === "silver necklace").length, 1, "Duplicate pins compile once");
assert.equal(necklace(fixture.compile({ ...combined, excluded: ["sample:0:0"] })), undefined, "Exclusion applies across source occurrences");
assert.equal(necklace(fixture.compile(combined, "density-rich", (text) => !text.startsWith("1.4::"))).weight, "1.8", "Filtered occurrence does not hide a later valid source");
assert.equal(fixture.compile({ blocks: ["sample:0"] }).selected.some((item) => item.tag === "soft light"), false, "Variants never import their siblings");

const custom = { outfit: ["  silver necklace  ", "a private outfit detail"], background: ["1.25::special light::"] };
const customResult = fixture.compile({ ...combined, custom }, "density-light");
assert.equal(necklace(customResult).id, "custom:outfit:0", "Explicit custom phrase takes precedence over automatic source weight");
assert.equal(necklace(fixture.compile({ ...combined, custom, pins: ["sample:2:0"] })).weight, "1.8", "Explicit source pin overrides custom duplicate");
const customLight = customResult.selected.find((item) => item.tag === "special light");
assert.equal(customLight.text, "1.25::special light::");
assert.equal(customLight.facet, "free-background");
assert.equal(customLight.section, "background");
assert.equal(customLight.weight, "1.25");
assert.equal(fixture.compile({ custom }, "density-rich", () => false).selected.length, 0, "Allow filtering applies to all custom text");
const manyCustom = Array.from({ length: 45 }, (_, i) => `explicit detail ${i}`);
assert.equal(fixture.compile({ custom: { concept: manyCustom } }, "density-light").selected.length, 45, "Density never truncates explicit custom detail");

for (const input of [undefined, null, false, 23, "bad saved state", []]) {
  const normalized = studio.normalize(input);
  assert.equal(normalized.useBase, false);
  assert.equal(normalized.blocks.length + normalized.pins.length + normalized.excluded.length + Object.keys(normalized.custom).length, 0);
}
const normalized = studio.normalize({
  blocks: [selected.blocks[0], selected.blocks[0], "missing", null],
  pins: [optional.id, optional.id, {}, "missing"], excluded: "not an array",
  custom: { outfit: [" trimmed ", "trimmed", "two\nwords", "", 3, null, {}, "bad\u0000value"], unknown: ["ignore"], concept: "ignore" },
  useBase: "true", unknown: true,
});
assert.equal(normalized.blocks.length, 1);
assert.equal(normalized.pins.length, 1);
assert.equal(normalized.excluded.length, 0);
assert.equal(JSON.stringify(normalized.custom), JSON.stringify({ outfit: ["trimmed", "two words"] }));
assert.equal(normalized.useBase, false, "Persisted string is not a boolean opt-in");
assert.equal(studio.normalize({ useBase: true }).useBase, true);
assert.equal(JSON.stringify(studio.normalize(JSON.parse(JSON.stringify(normalized)))), JSON.stringify(normalized), "Normalization survives persistence and is idempotent");
assert.equal(studio.keyFor(" 1.25::Silver  Necklace:: "), "silver necklace");

// Exercise the actual app's compiler integration without a browser or exposing
// production internals. Only the final initial render is replaced by a test seam.
const elements = new Map();
const stored = new Map();
context.document = {
  querySelector(selector) {
    if (!elements.has(selector)) elements.set(selector, { addEventListener() {}, style: {}, dataset: {} });
    return elements.get(selector);
  },
  querySelectorAll: () => [], addEventListener() {},
};
context.localStorage = {
  getItem: (key) => stored.get(key) ?? null,
  setItem: (key, value) => stored.set(key, value),
  removeItem: (key) => stored.delete(key),
};
context.window.setTimeout = () => 0;
context.window.clearTimeout = () => {};
const appSource = readFileSync(new URL("../site/app.js", import.meta.url), "utf8");
const appHarness = appSource.replace(/\n  renderAll\(\);\r?\n\}\)\(\);\s*$/, `
  window.APP_TEST = {
    gatherPrompt, renderPrompt, splitTagInput, persist, loadState, sanitizeState, isSafeCustomTag, migratedStage,
    setState(value = {}) {
      const defaults = defaultState();
      state = { ...defaults, ...value, answers: { ...defaults.answers, ...(value.answers || {}) } };
      sanitizeState();
    },
    getState: () => state,
  };
})();`);
assert.notEqual(appHarness, appSource, "App test seam must replace only startup rendering");
new Script(appHarness).runInContext(context);
const app = context.window.APP_TEST;
assert.equal(JSON.stringify(guided.items.filter((item) => !app.isSafeCustomTag(item.tag)).map((item) => item.tag)), "[]",
  "Every original expression remains selectable and compilable; unrelated catalog flags cannot hide neutral source tags");
const neutralSourceSelections = Object.fromEntries(["handcuffs", "sleeping"].map((tag) => {
  const item = guided.items.find((item) => item.tag === tag);
  assert.ok(item, `${tag}: neutral source expression exists`);
  return [item.id, null];
}));
app.setState({ guided: { selections: neutralSourceSelections }, answers: { density: ["density-light"] } });
for (const tag of ["handcuffs", "sleeping"]) assert.ok(app.gatherPrompt().flatTags.includes(tag), `${tag}: neutral source expression survives actual compilation`);
app.setState({ studio: { blocks: ["p16-08:0"] }, answers: { density: ["density-rich"] } });
const integrated = app.gatherPrompt();
const sourceText = studio.compile({ blocks: ["p16-08:0"] }, "density-rich").selected.map((item) => item.text);
assert.ok(integrated.tagCount > 0, "Selecting a source block produces output");
assert.equal(integrated.flatTags.length, sourceText.length, "Studio source receives no unsolicited default style or cast tags");
for (const text of sourceText) assert.ok(integrated.flatTags.includes(text), `App preserves source weight and wording: ${text}`);
app.renderPrompt();
assert.equal(elements.get("#prompt-output").textContent, integrated.flat);
assert.equal(elements.get("#empty-prompt").style.display, "none", "Selected source output hides empty overlay");
app.setState({ studio: { custom: { concept: ["one custom phrase"] } } });
app.renderPrompt();
assert.equal(elements.get("#prompt-output").textContent, "one custom phrase,");
assert.equal(elements.get("#empty-prompt").style.display, "none", "A single source detail remains visible");
assert.equal(JSON.stringify(app.splitTagInput('1.2::soft light, mist::, :3, ;)')), JSON.stringify(['1.2::soft light, mist::', ':3', ';)']), "Custom input retains grouped weights and emoticons");
app.setState({ studio: { custom: { background: ["1.2::special light::", "mist", "soft light"] } }, answers: { "core-emphasis": ["emphasis-background"] }, emphasis: "1.5" });
const emphasized = app.gatherPrompt();
assert.ok(emphasized.flatTags.includes("1.2::special light::"), "App emphasis preserves existing source weights");
assert.ok(emphasized.flatTags.includes("1.5::mist::"), "Explicit emphasis still applies to unweighted detail");
app.persist();
assert.equal(app.loadState().studio, undefined, "Legacy source state is removed before persistence");
assert.equal(JSON.stringify(app.loadState().custom), JSON.stringify(app.getState().custom), "Migrated custom text survives actual draft persistence");
assert.equal(JSON.stringify(app.loadState().guided), JSON.stringify(app.getState().guided), "Migrated independent selection state survives actual draft persistence");
app.setState({ studio: { custom: { character: ["2::solo::"] }, useBase: true } });
const optedInBase = app.gatherPrompt();
assert.ok(optedInBase.flatTags.includes("2::solo::"), "Explicit source weight survives an opted-in cast base duplicate");
assert.ok(!optedInBase.flatTags.includes("solo"), "Cast base does not erase or duplicate the source winner");
assert.ok(optedInBase.flatTags.includes("1girl") && optedInBase.flatTags.includes("adult woman"), "Other opted-in cast defaults remain present");
app.setState({ studio: { custom: { concept: ["2::mist::"] } }, custom: { setting: ["mist"] } });
const crossSection = app.gatherPrompt();
assert.ok(crossSection.flatTags.includes("2::mist::"), "Source winner survives a legacy duplicate in an earlier output section");
assert.ok(!crossSection.flatTags.includes("mist"), "Cross-section duplicates occur once in flat output");
assert.ok(crossSection.sections.concept.includes("2::mist::"), "Source winner retains its requested semantic section");
assert.ok(!crossSection.sections.background.includes("mist"), "Sectioned output follows the same duplicate precedence");

// Every source variant can be built from ordinary step selections alone. The
// studio compiler supplies only the expected phrase/weight collision policy;
// no block, pin, imported text or source-selection state reaches the app.
function assertOrdinarySectionOrder(result, expected, label) {
  for (const section of ["character", "concept", "background", "composition", "outfit"]) {
    assert.equal(JSON.stringify(result.sections[section]), JSON.stringify(expected.filter((source) => source.section === section).map((source) => source.text)), `${label}/${section}: actual ordinary output retains original expression order`);
  }
}
for (const block of studio.blocks) {
  const expected = studio.compile({ blocks: [block.id] }, "density-rich", app.isSafeCustomTag).selected;
  const selections = Object.fromEntries(expected.map((source) => {
    const id = guided.occurrenceToItem.get(source.id);
    assert.ok(id, `${block.id}: source expression is independently selectable`);
    return [id, source.weight == null ? null : String(source.weight)];
  }));
  for (const density of densities) {
    app.setState({ guided: { selections }, answers: { density: [density] } });
    const result = app.gatherPrompt();
    assertOrdinarySectionOrder(result, expected, `${block.id}/${density}`);
    assert.equal(app.getState().studio, undefined, `${block.id}: no hidden source-selection state`);
    assert.equal(Object.keys(app.getState().custom).length, 0, `${block.id}: no source import into ordinary custom text`);
    assert.equal(result.flatTags.length, expected.length, `${block.id}/${density}: ordinary steps reproduce every distinct expression`);
    for (const source of expected) {
      assert.ok(result.flatTags.includes(source.text), `${block.id}/${density}: ordinary output retains ${source.text}`);
      assert.ok(result.sections[source.section].includes(source.text), `${block.id}/${density}: ordinary output retains source section for ${source.text}`);
    }
    ordinaryReconstructions++;
  }
}

// Reconstruct density-specific mixed outputs, including pins and global
// exclusions. Sources are expected-data only; the app receives ordinary IDs.
for (const [index, block] of studio.blocks.entries()) {
  const other = studio.blocks[(index + 137) % studio.blocks.length];
  const last = block.tags.at(-1);
  const excluded = other.tags.find((tag) => studio.keyFor(tag.tag) !== studio.keyFor(last.tag));
  const mixture = { blocks: [block.id, other.id], pins: [last.id], excluded: excluded ? [excluded.id] : [] };
  for (const density of densities) {
    const expected = studio.compile(mixture, density, app.isSafeCustomTag).selected;
    const selections = Object.fromEntries(expected.map((source) => [guided.occurrenceToItem.get(source.id), source.weight == null ? null : String(source.weight)]));
    app.setState({ guided: { selections }, answers: { density: [density] } });
    const result = app.gatherPrompt();
    assertOrdinarySectionOrder(result, expected, `${block.id}+${other.id}/${density}`);
    assert.equal(result.flatTags.length, expected.length, `${block.id}+${other.id}/${density}: mixed output has no imports or extras`);
    for (const source of expected) {
      assert.ok(result.sections[source.section].includes(source.text), `${block.id}+${other.id}/${density}: mixed pins/exclusions preserve ${source.text}`);
    }
    ordinaryReconstructions++;
  }
}

for (const promptId of Object.keys(corpus.sourcePrompts)) {
  const blocks = studio.blocks.filter((block) => block.promptId === promptId).map((block) => block.id);
  const expected = studio.compile({ blocks }, "density-rich", app.isSafeCustomTag).selected;
  const selections = Object.fromEntries(expected.map((source) => [guided.occurrenceToItem.get(source.id), source.weight == null ? null : String(source.weight)]));
  for (const density of densities) {
    app.setState({ guided: { selections }, answers: { density: [density] } });
    const result = app.gatherPrompt();
    assertOrdinarySectionOrder(result, expected, `${promptId}/${density}`);
    assert.equal(result.flatTags.length, expected.length, `${promptId}/${density}: all source sections reconstruct together without duplication`);
    for (const source of expected) assert.ok(result.sections[source.section].includes(source.text), `${promptId}/${density}: complete source output preserves ${source.text}`);
    ordinaryReconstructions++;
  }
}

let actualLegacyMigrations = 0;
for (let page = 1; page <= 17; page++) {
  const pageBlocks = studio.blocks.filter((block) => block.page === page).slice(0, 3);
  const pinned = pageBlocks[0].tags.at(-1);
  const excluded = pageBlocks.flatMap((block) => block.tags).find((tag) => studio.keyFor(tag.tag) !== studio.keyFor(pinned.tag));
  const legacy = {
    blocks: pageBlocks.map((block) => block.id), pins: [pinned.id], excluded: excluded ? [excluded.id] : [],
    custom: { concept: ["watercolor painting", "2.345::private motif::"], background: ["1.25::light, fog::"] },
  };
  for (const density of densities) {
    const expected = studio.compile(legacy, density, app.isSafeCustomTag).selected;
    app.setState({ studio: legacy, answers: { density: [density] } });
    const result = app.gatherPrompt();
    assert.equal(app.getState().studio, undefined, `page ${page}/${density}: actual sanitizer removes legacy state`);
    assert.equal(app.getState().guided.active, true, "Legacy activation survives even when custom text becomes ordinary input");
    assert.equal(result.flatTags.length, expected.length, `page ${page}/${density}: actual migration adds no cast defaults or sibling expressions`);
    for (const source of expected) assert.ok(result.sections[source.section].includes(source.text), `page ${page}/${density}: actual migration preserves pins, exclusions and exact weighted custom text: ${source.text}`);
    const saved = JSON.stringify(app.getState());
    for (const field of ["studio", "blocks", "pins", "excluded"]) assert.ok(!saved.includes(`"${field}":`), `page ${page}/${density}: persisted schema contains no hidden ${field}`);
    actualLegacyMigrations++;
  }
}
for (const version of [6, 7]) {
  assert.equal(app.migratedStage({ version, currentStage: 0 }), 0, "Retired source stage opens the first ordinary step");
  assert.equal(app.migratedStage({ version, currentStage: 3 }), 2, "Old drafts retain their ordinary step after source-stage removal");
}
assert.equal(app.migratedStage({ version: 5, currentStage: 3 }), 3, "Drafts from before the source stage retain their original step");
assert.equal(app.migratedStage({ version: 8, currentStage: 3 }), 3, "Current drafts are not shifted again");
assert.ok(!/function renderStudio\(|data-studio-|id="studio-/.test(appSource), "Current app contains no retired source controls or event handlers");

const guidedChoice = (tag, section) => {
  const choice = guided.items.find((item) => item.tag === tag && (!section || item.section === section));
  assert.ok(choice, `Guided fixture expression exists: ${tag}`);
  return choice;
};
const cloth = guidedChoice("black pinafore dress", "outfit");
const interaction = guided.items.find((item) => item.facet === "interaction" && app.isSafeCustomTag(item.tag));
const layout = guidedChoice("magazine cover", "composition");
const independent = { [cloth.id]: null, [interaction.id]: null, [layout.id]: null };
const outfitPacks = context.window.PM_DATA.dynamicPacks?.wardrobe || context.window.PM_DATA.outfitPacks;
const casualSubtype = outfitPacks["wardrobe-casual"][0].id;
app.setState({
  guided: { selections: independent },
  answers: { "scene-cast": ["cast-partner"], "partner-archetype": ["partner-soft"], wardrobe: ["wardrobe-casual"], "outfit-subtype": [casualSubtype] },
});
assert.ok(app.getState().answers["outfit-subtype"]?.includes(casualSubtype), "Conditional fixture begins with a valid child selection");
assert.ok(app.getState().answers["partner-archetype"]?.includes("partner-soft"), "Conditional fixture begins with a visible partner choice");
const guidedBefore = JSON.stringify(app.getState().guided);
for (const [cast, wardrobe, stageId] of [
  ["cast-solo", "wardrobe-gothic", "scene"],
  ["cast-partner", "wardrobe-fantasy", "outfit"],
  ["cast-solo", "wardrobe-casual", "camera"],
]) {
  const state = app.getState();
  state.answers["scene-cast"] = [cast];
  state.answers.wardrobe = [wardrobe];
  state.currentStage = context.window.PM_DATA.stages.findIndex((stage) => stage.id === stageId);
  app.sanitizeState();
  assert.equal(app.getState().answers.wardrobe[0], wardrobe, "Parent fixture uses valid wardrobe choices");
  if (stageId === "scene") {
    assert.equal(app.getState().answers["partner-archetype"], undefined, "Hidden conditional partner choice is actually removed");
    assert.equal(app.getState().answers["outfit-subtype"], undefined, "A previous outfit family's child choice is actually removed");
  }
  assert.equal(JSON.stringify(app.getState().guided), guidedBefore, `Changing ${stageId}/cast/outfit parent preserves independent ordinary selections`);
  for (const [id] of Object.entries(independent)) {
    assert.ok(app.gatherPrompt().flatTags.includes(guided.byId.get(id).tag), "Conditional sanitization cannot discard an independent selected expression");
  }
}
app.persist();
assert.equal(JSON.stringify(app.loadState().guided), guidedBefore, "Ordinary selections and weight state survive actual draft persistence");

const emphasizedChoice = guided.items.find((item) => item.weights.some((weight) => weight != null) && app.isSafeCustomTag(item.tag));
const sourceWeight = emphasizedChoice.weights.find((weight) => weight != null);
const evidence = emphasizedChoice.sources.find((source) => source.weight === sourceWeight);
const originalBlockId = `${evidence.promptId}:${evidence.sectionIndex}`;
app.setState({
  studio: { blocks: [originalBlockId], custom: { [emphasizedChoice.section]: [emphasizedChoice.tag] } },
  guided: { selections: { [emphasizedChoice.id]: null } },
  answers: { density: ["density-light"] },
});
let guidedWinner = app.gatherPrompt();
assert.ok(guidedWinner.flatTags.includes(emphasizedChoice.tag), "An explicit unweighted ordinary choice overrides a weighted source block");
assert.ok(!guidedWinner.flatTags.includes(`${sourceWeight}::${emphasizedChoice.tag}::`), "The superseded source emphasis is removed");

const watercolor = guidedChoice("watercolor painting", "concept");
const watercolorWeight = watercolor.weights.find((weight) => weight != null) ?? null;
app.setState({
  guided: { selections: { [watercolor.id]: watercolorWeight } },
  answers: { "guided-medium": ["guided-watercolor"], density: ["density-light"] },
});
guidedWinner = app.gatherPrompt();
assert.equal(guidedWinner.flatTags.filter((tag) => studio.keyFor(tag) === "watercolor painting").length, 1, "Explicit phrase and image card duplicates compile once");
assert.ok(guidedWinner.sections.concept.includes(watercolorWeight == null ? watercolor.tag : `${watercolorWeight}::${watercolor.tag}::`), "The independent phrase's emphasis wins over its image card duplicate");
for (const tag of ["translucent watercolor", "pigment bleeding", "paper grain"]) {
  assert.ok(guidedWinner.flatTags.includes(tag), `The complete image card's explicit detail survives light density: ${tag}`);
}

const solo = guidedChoice("solo", "character");
app.setState({
  studio: { custom: { character: ["2::solo::"] } },
  guided: { selections: { [solo.id]: null }, useBase: true },
});
guidedWinner = app.gatherPrompt();
assert.equal(guidedWinner.flatTags.filter((tag) => studio.keyFor(tag) === "solo").length, 1, "An ordinary choice, source duplicate and opted-in cast base compile once");
assert.ok(guidedWinner.flatTags.includes("solo"), "Explicit unweighted ordinary choice overrides a weighted studio source and agrees with cast base");
assert.ok(!guidedWinner.flatTags.includes("2::solo::"), "Guided precedence removes the superseded source weight even with cast defaults enabled");
assert.ok(guidedWinner.flatTags.includes("1girl") && guidedWinner.flatTags.includes("adult woman"), "Opted-in remaining cast defaults are preserved");
app.setState({ guided: { selections: { [solo.id]: null } } });
guidedWinner = app.gatherPrompt();
assert.equal(JSON.stringify(guidedWinner.flatTags), JSON.stringify(["solo"]), "Ordinary source expression has no unsolicited cast or quality defaults");
console.log(`PASS: 17 pages / 205 prompts / ${studio.tags.size} source occurrences / ${studio.blocks.length} independent variants / ${ordinaryReconstructions} actual ordinary-step reconstructions / ${actualLegacyMigrations} actual legacy mixed migrations; density coverage, semantic order, weighted precedence, conditional preservation, custom text and persistence`);
