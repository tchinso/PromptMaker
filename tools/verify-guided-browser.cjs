#!/usr/bin/env node
/* Read-only guided-flow UI verification. Start site/ on localhost:4173 first.
 * Requires Playwright in NODE_PATH. Artifacts default to the temporary folder.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require('playwright');
const baseURL = process.env.PM_BASE_URL || 'http://localhost:4173';
const out = process.env.PM_QA_DIR || path.join(os.tmpdir(), 'promptmaker-guided-qa');
fs.mkdirSync(out, { recursive: true });

async function launch() {
  if (process.env.PM_BROWSER_CHANNEL) return chromium.launch({ headless: true, channel: process.env.PM_BROWSER_CHANNEL });
  try { return await chromium.launch({ headless: true }); }
  catch (error) {
    if (!error.message.includes("Executable doesn't exist")) throw error;
    return chromium.launch({ headless: true, channel: 'msedge' });
  }
}

async function loadImages(page) {
  await page.evaluate(async () => {
    const images = [...document.querySelectorAll('[data-reference-image]')];
    images.forEach(image => { image.loading = 'eager'; });
    await Promise.all(images.map(image => image.decode().catch(error => {
      throw new Error(`Cannot decode ${image.currentSrc || image.src}: ${error.message}`);
    })));
  });
}

async function assertCropGeometry(page, label) {
  const result = await page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    const options = new Map();
    const visit = value => {
      if (!value || typeof value !== 'object') return;
      if (value.image && value.sprite) {
        const id = value.id || value[0];
        if (!options.has(id)) options.set(id, []);
        options.get(id).push(value);
      }
      Object.values(value).forEach(visit);
    };
    visit(window.PM_DATA);
    return {
      width: document.documentElement.scrollWidth, viewport,
      crops: [...document.querySelectorAll('.option-visual.option-sprite,.detail-visual.option-sprite')]
        .filter(element => element.getClientRects().length)
        .map(element => {
          const image = element.querySelector('img');
          const box = element.getBoundingClientRect();
          const artwork = image.getBoundingClientRect();
          const filename = image.getAttribute('src').split('/').pop();
          const metadata = window.PM_ATLAS_CROPS?.[filename];
          const item = element.closest('button');
          const hierarchyNode = window.PM_GUIDED_HIERARCHY?.byId.get(item?.dataset.hierarchyNode);
          const optionId = item?.dataset.option || item?.dataset.detailOption || hierarchyNode?.id;
          const questionId = item?.dataset.question || item?.dataset.detailQuestion;
          const question = window.PM_DATA.stages.flatMap(stage => stage.questions).find(question => question.id === questionId);
          const directOptions = item?.dataset.option ? question?.options : question?.detailGroups
            ?.find(group => group.id === item.dataset.detailGroup)?.options;
          const option = hierarchyNode?.imageKey ? {
            image: `assets/visual-guides/options/thumb-hierarchy-${hierarchyNode.imageKey.sheet === 'world' ? 'appearance-world' : 'detail-action'}-v1.png`,
            sprite: { index: hierarchyNode.imageKey.index },
          } : directOptions?.find(option => (option.id || option[0]) === optionId)
            || options.get(optionId)?.find(option => option.image?.endsWith(filename));
          const cellIndex = option?.sprite.index;
          const scaleX = artwork.width / image.naturalWidth;
          const scaleY = artwork.height / image.naturalHeight;
          const crop = { left: (box.left - artwork.left) / scaleX, top: (box.top - artwork.top) / scaleY,
            right: (box.right - artwork.left) / scaleX, bottom: (box.bottom - artwork.top) / scaleY };
          const cellWidth = image.naturalWidth / 4, cellHeight = image.naturalHeight / 3;
          const row = Math.floor(cellIndex / 4), column = cellIndex % 4;
          const sourceCell = metadata?.cells?.[cellIndex] || {
            x: column * cellWidth, y: row * cellHeight, width: cellWidth, height: cellHeight,
          };
          const inset = option?.sprite.inset ?? metadata?.inset ?? .04;
          const margin = Math.min(sourceCell.width, sourceCell.height) * inset;
          const side = Math.min(sourceCell.width, sourceCell.height) - 2 * margin;
          const expected = {
            left: sourceCell.x + margin + (sourceCell.width - 2 * margin - side) * (sourceCell.anchorX ?? .5),
            top: sourceCell.y + margin + (sourceCell.height - 2 * margin - side) * (sourceCell.anchorY ?? .5),
          };
          expected.right = expected.left + side;
          expected.bottom = expected.top + side;
          return {
            label: item?.textContent.trim().slice(0, 70), optionId, knownOption: !!option, filename,
            w: box.width, h: box.height, loaded: image.complete && image.naturalWidth > 0,
            scaleX, scaleY, transform: getComputedStyle(image).transform,
            covered: artwork.left <= box.left + .1 && artwork.top <= box.top + .1
              && artwork.right >= box.right - .1 && artwork.bottom >= box.bottom - .1,
            metadataMatches: metadata?.width === image.naturalWidth && metadata?.height === image.naturalHeight,
            crop, expected, cellIndex, sourceCell,
            margins: { left: crop.left - sourceCell.x, top: crop.top - sourceCell.y,
              right: sourceCell.x + sourceCell.width - crop.right, bottom: sourceCell.y + sourceCell.height - crop.bottom },
          };
        }),
    };
  });
  assert.ok(result.width <= result.viewport + 1, `${label}: horizontal overflow ${result.width}/${result.viewport}`);
  for (const crop of result.crops) {
    const message = `${label}: ${JSON.stringify(crop)}`;
    assert.ok(crop.knownOption, `Unknown visual option ${message}`);
    assert.ok(crop.loaded, `Unloaded artwork ${message}`);
    assert.ok(crop.metadataMatches, `Stale crop metadata ${message}`);
    assert.ok(Math.abs(crop.w - crop.h) <= 1, `Thumbnail is not square ${message}`);
    assert.ok(Math.abs(crop.scaleX - crop.scaleY) < .001, `Native artwork aspect is distorted ${message}`);
    assert.equal(crop.transform, 'none', `Atlas image has a hover transform ${message}`);
    assert.ok(crop.covered, `Uncovered thumbnail edge ${message}`);
    assert.ok(crop.cellIndex >= 0 && crop.cellIndex < 12, `Logical atlas index out of bounds ${message}`);
    for (const side of ['left', 'top', 'right', 'bottom']) {
      assert.ok(Math.abs(crop.crop[side] - crop.expected[side]) <= .8, `Rendered crop differs from measured ${side} ${message}`);
    }
    // Validate in intrinsic pixels: neither an adjacent image nor the atlas's
    // outer edge can enter the rendered card or detail preview at any viewport.
    for (const [side, margin] of Object.entries(crop.margins)) {
      assert.ok(margin >= 2, `${side} enters a tile boundary ${message}`);
    }
  }
  return result.crops;
}

async function goToStage(page, id) {
  const index = await page.evaluate(stageId => window.PM_DATA.stages.findIndex(stage => stage.id === stageId), id);
  assert.ok(index >= 0, `Guided stage ${id} must exist`);
  await page.locator(`[data-stage="${index}"]`).click();
  await loadImages(page);
  return index;
}

// The source studio must remain empty throughout all ordinary-step actions.
async function assertIndependentGuidedState(page) {
  const state = await page.evaluate(() => {
    const value = localStorage.getItem('nyankat-prompt-atelier:draft:v3');
    return value ? JSON.parse(value) : null;
  });
  assert.ok(state, 'Ordinary-step actions must persist a draft');
  assert.equal(state.studio?.blocks?.length || 0, 0, 'Guided actions must not import a studio bundle');
  assert.equal(state.studio?.pins?.length || 0, 0, 'Guided actions must not create studio pins');
}

async function closeDetail(page) {
  if (await page.locator('#detail-dialog').getAttribute('open') !== null) await page.locator('#close-detail').click();
}

async function openGroup(page, item) {
  await closeDetail(page);
  const group = await page.evaluate(value => {
    const hierarchy = window.PM_GUIDED_HIERARCHY;
    const root = value.questionId ? hierarchy.getRoot(value.questionId)
      : hierarchy.byId.get(hierarchy.itemPaths.get(value.id)?.[0]);
    const stage = window.PM_DATA.stages.find(stage => stage.questions.some(question => question.id === root?.questionId));
    return root && stage ? { rootId: root.id, questionId: root.questionId, stageId: stage.id } : null;
  }, item);
  assert.ok(group, `Missing hierarchy question for ${item.id || item.questionId}`);
  await goToStage(page, group.stageId);
  const toggle = page.locator(`[data-hierarchy-open="${group.questionId}"]`);
  if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
  await page.locator(`[data-hierarchy-node="${group.rootId}"]`).click();
  await loadImages(page);
  return group;
}

async function selectGuided(page, tag, weight = null) {
  const item = await page.evaluate(text => {
    const engine = window.PM_GUIDED_CORPUS;
    return engine.items.find(candidate => engine.keyFor(candidate.tag) === engine.keyFor(text));
  }, tag);
  assert.ok(item, `Missing guided phrase ${tag}`);
  const group = await openGroup(page, item);
  await page.locator(`[data-hierarchy-search="${group.questionId}"]`).fill(item.tag);
  const button = page.locator(`[data-hierarchy-item="${item.id}"]`);
  await button.waitFor();
  if (await button.getAttribute('aria-pressed') !== 'true') await button.click();
  if (weight !== null) await page.locator(`[data-hierarchy-weight="${item.id}"]`).selectOption(String(weight));
  assert.equal(await button.getAttribute('aria-pressed'), 'true');
  const text = weight === null ? item.tag : `${weight}::${item.tag}::`;
  assert.ok((await page.locator('#prompt-output').textContent()).includes(text), `Selected phrase is missing from output: ${text}`);
  await closeDetail(page);
  await assertIndependentGuidedState(page);
  return { ...item, text };
}

async function auditVocabulary(page, name) {
  const weighted = await page.evaluate(() => window.PM_GUIDED_CORPUS.items.find(item => item.facet === 'medium'
    && /watercolor/i.test(item.tag) && item.weights.includes('5')));
  assert.ok(weighted, 'Original watercolor 5× phrase must be selectable');
  const selected = [await selectGuided(page, weighted.tag, '5')];
  for (const tag of ['intimate distance', 'chibi', 'white outline', 'aquarium tunnel', 'soft lighting',
    'inner white t-shirt', 'unzipped', 'puff sleeves', 'heart charm', 'floating ribbons',
    'knees drawn up', 'leaning back on one hand', 'foreshortening', 'magazine cover']) {
    selected.push(await selectGuided(page, tag));
  }
  const weightedGroup = await openGroup(page, weighted);
  const weightedScope = page.locator(`section[data-hierarchy-question="${weightedGroup.questionId}"]`);
  await weightedScope.locator('[data-hierarchy-search]').fill(weighted.tag);
  await weightedScope.locator('[data-hierarchy-selected-only]').check();
  assert.equal(await weightedScope.locator('[data-hierarchy-item]').count(), 1, 'Selected-only filter is scoped to its question');
  assert.equal(await page.locator(`[data-hierarchy-weight="${weighted.id}"]`).inputValue(), '5');
  await assertCropGeometry(page, `${name} vocabulary question`);
  await page.screenshot({ path: path.join(out, `${name}-hierarchy-question.png`) });
  await closeDetail(page);

  const largest = await page.evaluate(() => {
    const root = [...window.PM_GUIDED_HIERARCHY.roots.values()].sort((a, b) => b.allItems.length - a.allItems.length)[0];
    const query = ['a', 'e', 'i', 'o'].sort((a, b) => root.allItems.filter(item => item.searchText.toLowerCase().includes(b)).length
      - root.allItems.filter(item => item.searchText.toLowerCase().includes(a)).length)[0];
    return { questionId: root.questionId, count: root.allItems.length, query };
  });
  assert.ok(largest.count > 120, 'Long-tail fixture must exceed the former 120-result limit');
  await openGroup(page, largest);
  const largestScope = page.locator(`section[data-hierarchy-question="${largest.questionId}"]`);
  assert.ok(await largestScope.locator('.vocabulary-branch').count() > 0, 'Ordinary browsing starts with semantic branches');
  await largestScope.locator('[data-hierarchy-search]').fill(largest.query);
  const firstPage = await largestScope.locator('[data-hierarchy-item]').evaluateAll(buttons => buttons.map(button => button.dataset.hierarchyItem));
  assert.equal(firstPage.length, 12, 'Hierarchy search paginates 12 expressions at a time');
  await largestScope.locator('[data-hierarchy-page="1"]').click();
  const secondPage = await largestScope.locator('[data-hierarchy-item]').evaluateAll(buttons => buttons.map(button => button.dataset.hierarchyItem));
  assert.equal(secondPage.length, 12);
  assert.ok(secondPage.every(id => !firstPage.includes(id)), 'Pagination must expose new expressions');
  await largestScope.locator('[data-hierarchy-page="-1"]').click();
  assert.deepEqual(await largestScope.locator('[data-hierarchy-item]').evaluateAll(buttons => buttons.map(button => button.dataset.hierarchyItem)), firstPage);
  await closeDetail(page);

  await goToStage(page, 'finish');
  await page.locator('[data-question="density"][data-option="density-light"]').click();
  const light = await page.locator('#prompt-output').textContent();
  for (const item of selected) assert.ok(light.includes(item.text), `Low density removes explicit ${item.text}`);
  const saved = light;
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('#prompt-output').textContent(), saved, 'Guided choices and original weights persist after reload');
  await assertIndependentGuidedState(page);
  const removable = selected.find(item => item.tag === 'aquarium tunnel');
  await openGroup(page, removable);
  await page.locator(`[data-hierarchy-remove="${removable.id}"]`).click();
  assert.ok(!(await page.locator('#prompt-output').textContent()).includes(removable.tag), 'Selected chip can remove a precise phrase');
  await selectGuided(page, removable.tag);
  return selected.length;
}

async function auditVisuals(page, name) {
  const stages = await page.evaluate(() => window.PM_DATA.stages.map(stage => stage.id));
  assert.ok(!stages.includes('corpus-studio'), 'Source studio step must be retired after coverage verification');
  assert.deepEqual(stages, ['scene', 'character', 'concept', 'mood', 'outfit', 'props', 'camera', 'finish']);
  let sprites = 0;
  const newTiles = new Set();
  for (const id of stages) {
    await goToStage(page, id);
    await assertStageOrder(page, id, name);
    const crops = await assertCropGeometry(page, `${name} ${id}`);
    sprites += crops.length;
    crops.filter(crop => crop.filename.startsWith('thumb-guided-'))
      .forEach(crop => newTiles.add(`${crop.filename}:${crop.cellIndex}`));
    assert.equal(await page.locator('[data-action="source-prompts"]').count(), 0, 'Retired source-import controls must not remain in guided stages');
    for (const question of await page.locator('[data-question-block^="guided-"]').all()) {
      const id = await question.getAttribute('data-question-block');
      await question.screenshot({ path: path.join(out, `${name}-${id}.png`) });
    }
  }
  assert.equal(newTiles.size, 48, 'All 48 new reference tiles must be exposed in ordinary stages');

  // Audit every species-specific portrait atlas, including unequal old rows.
  await goToStage(page, 'character');
  const species = await page.locator('[data-question="character-archetype"][data-option]').evaluateAll(buttons => buttons.map(button => button.dataset.option));
  for (const id of species) {
    await page.locator(`[data-question="character-archetype"][data-option="${id}"]`).click();
    await loadImages(page);
    sprites += (await assertCropGeometry(page, `${name} species ${id}`)).length;
  }
  await page.locator('[data-question="hair-style"][data-option]').first().click();
  await page.locator('[data-action="open-details"][data-question="hair-style"]').click();
  await loadImages(page);
  assert.equal(await page.locator('#detail-dialog .detail-visual').count(), await page.locator('#detail-dialog [data-detail-option]').count(), 'All hair details retain reference images');
  sprites += (await assertCropGeometry(page, `${name} hair detail`)).length;
  await page.locator('[data-detail-option]').first().click();
  assert.equal(await page.locator('[data-detail-option]').first().getAttribute('aria-pressed'), 'true');
  await closeDetail(page);

  // Every wardrobe family has an independent main/subtype reference atlas.
  // Its first subtype also reveals that family's shared finish atlas.
  await goToStage(page, 'outfit');
  const families = await page.locator('[data-question="wardrobe"][data-option]').evaluateAll(buttons => buttons.map(button => button.dataset.option));
  for (const id of families) {
    await page.locator(`[data-question="wardrobe"][data-option="${id}"]`).click();
    const subtype = page.locator('[data-question="outfit-subtype"][data-option]').first();
    await subtype.click();
    await loadImages(page);
    sprites += (await assertCropGeometry(page, `${name} wardrobe ${id}`)).length;
  }
  await page.locator('[data-action="open-details"][data-question="outfit-subtype-detail"]').click();
  await loadImages(page);
  sprites += (await assertCropGeometry(page, `${name} garment finish detail`)).length;
  await page.screenshot({ path: path.join(out, `${name}-garment-details.png`) });
  await closeDetail(page);
  if (await page.locator('#mobile-prompt-button').isVisible()) {
    await page.locator('#mobile-prompt-button').click();
    assert.equal(await page.locator('#mobile-prompt-button').getAttribute('aria-expanded'), 'true');
    await assertCropGeometry(page, `${name} mobile prompt`);
    await page.locator('#mobile-prompt-button').click();
  }
  await assertIndependentGuidedState(page);
  return { sprites, newTiles: newTiles.size };
}

async function assertStageOrder(page, stageId, label) {
  const result = await page.evaluate(() => {
    const questions = [...document.querySelectorAll('#stage-content [data-question-block]')];
    return { ids: questions.map(question => question.dataset.questionBlock),
      retiredPanels: document.querySelectorAll('#stage-content [data-guided-stage],#stage-content [data-guided-group]').length,
      misplacedVocabulary: [...document.querySelectorAll('#stage-content section[data-hierarchy-question]')]
        .filter(section => section.closest('[data-question-block]')?.dataset.questionBlock !== section.dataset.hierarchyQuestion)
        .map(section => section.dataset.hierarchyQuestion) };
  });
  assert.equal(result.retiredPanels, 0, `${label}/${stageId}: the retired detailed-combination panel is removed`);
  assert.deepEqual(result.misplacedVocabulary, [], `${label}/${stageId}: vocabulary is integrated into its ordinary question`);
  const adjacent = (before, after) => assert.equal(result.ids.indexOf(after), result.ids.indexOf(before) + 1,
    `${label}/${stageId}: ${after} follows ${before}`);
  if (stageId === 'concept') {
    adjacent('genre', 'guided-medium');
    adjacent('setting', 'guided-setting');
    adjacent('palette', 'guided-graphic');
  }
  if (stageId === 'outfit') adjacent('outfit-fit', 'guided-construction');
  if (stageId === 'camera') {
    adjacent('framing', 'guided-editorial');
    adjacent('body-action', 'guided-pose-support');
  }
}

async function auditOrder(browser) {
  const results = [];
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }, { width: 320, height: 740 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const name = `${viewport.width}x${viewport.height}`;
    try {
      await page.goto(baseURL, { waitUntil: 'networkidle' });
      for (const id of ['scene', 'character', 'concept', 'mood', 'outfit', 'props', 'camera']) {
        await goToStage(page, id);
        await assertStageOrder(page, id, name);
        await assertCropGeometry(page, `${name} latest ${id} order`);
      }
      await goToStage(page, 'concept');
      await page.locator('[data-question-block="guided-medium"]').screenshot({ path: path.join(out, `${name}-final-integrated-order.png`) });
      results.push({ viewport: name, orderedStages: 7 });
    } finally { await context.close(); }
  }
  return results;
}

async function auditViewport(browser, viewport) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const name = `${viewport.width}x${viewport.height}`;
  try {
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await page.locator('[data-stage="0"]').waitFor();
    assert.equal(await page.locator('[data-studio-block],#studio-page').count(), 0);
    const selected = await auditVocabulary(page, name);
    const visual = await auditVisuals(page, name);
    assert.deepEqual(errors, [], `${name}: browser exceptions`);
    return { viewport: name, stages: 8, selected, ...visual };
  } finally { await context.close(); }
}

async function auditMigration(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  try {
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    const expected = await page.evaluate(() => {
      const blocks = ['p17-03:0'];
      const source = window.PM_CORPUS_STUDIO.compile({ blocks }, 'density-rich').selected.map(item => item.text);
      localStorage.setItem('nyankat-prompt-atelier:draft:v3', JSON.stringify({
        version: 6, currentStage: 0, answers: { density: ['density-rich'] },
        studio: { blocks, pins: [], excluded: [], custom: { outfit: ['a preserved private ribbon detail'] }, useBase: false },
      }));
      return source;
    });
    await page.reload({ waitUntil: 'networkidle' });
    const output = await page.locator('#prompt-output').textContent();
    for (const text of expected) assert.ok(output.includes(text), `Draft migration loses ${text}`);
    assert.ok(output.includes('a preserved private ribbon detail'));
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('nyankat-prompt-atelier:draft:v3')));
    assert.ok(!stored.studio, 'Migrated draft no longer stores retired studio state');
    assert.equal(await page.locator('[data-studio-block],#studio-page').count(), 0);
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('#prompt-output').textContent(), output, 'Migration is stable across repeated reloads');
    return { migratedPhrases: expected.length + 1 };
  } finally { await context.close(); }
}

async function run() {
  const browser = await launch();
  try {
    const results = [];
    // Resume a failed viewport without repeating already completed image audits.
    const widths = process.env.PM_VIEWPORTS?.split(',').map(Number);
    const viewports = [{ width: 1440, height: 1000 }, { width: 390, height: 844 }, { width: 320, height: 740 }]
      .filter(viewport => !widths || widths.includes(viewport.width));
    assert.ok(viewports.length, 'PM_VIEWPORTS must contain a supported viewport width');
    for (const viewport of viewports) {
      const result = await auditViewport(browser, viewport);
      results.push(result);
      console.log(JSON.stringify({ status: 'VIEWPORT_PASS', ...result }));
    }
    const migration = await auditMigration(browser);
    console.log(JSON.stringify({ status: 'PASS', results, migration, screenshots: out }, null, 2));
  } finally { await browser.close(); }
}

if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { assertCropGeometry, assertIndependentGuidedState, goToStage, loadImages, openGroup, assertStageOrder, auditOrder, launch, run };
