#!/usr/bin/env node
// Start site/ on localhost:4173. Uses the established Playwright launcher.
// Walk all 3217 expressions once on desktop, then verify responsive interaction.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { launch, goToStage, loadImages, assertIndependentGuidedState } = require('./verify-guided-browser.cjs');
const baseURL = process.env.PM_BASE_URL || 'http://localhost:4173';
const out = process.env.PM_QA_DIR || path.join(os.tmpdir(), 'promptmaker-hierarchy-qa');
const STORAGE_KEY = 'nyankat-prompt-atelier:draft:v3';
const attr = value => String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
const by = (name, value) => `[data-hierarchy-${name}="${attr(value)}"]`;
const ordered = values => [...values].sort();
const section = (page, questionId) => page.locator(`[data-question-block="${attr(questionId)}"] section${by('question', questionId)}`);
const prompt = page => page.locator('#prompt-output').textContent();
const stored = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
const diagnostic = (error, message) => { error.message += `\n${message}`; if (error.stack) error.stack += `\n${message}`; };

async function inspectGeometry(page, label, options = {}) {
  await loadImages(page);
  const cropSelector = options.questionId ? `section${by('question', options.questionId)} .option-sprite` : '.option-sprite';
  const result = await page.evaluate(cropSelector => {
    const visible = element => !!element.getClientRects().length;
    return {
      viewport: document.documentElement.clientWidth, width: document.documentElement.scrollWidth,
      overflow: [...document.querySelectorAll('[data-hierarchy-question]')].filter(visible)
        .filter(element => element.scrollWidth > element.clientWidth + 1)
        .map(element => `${element.tagName}:${element.dataset.hierarchyQuestion}`),
      crops: [...document.querySelectorAll(cropSelector)].filter(visible).map(element => {
        const image = element.querySelector('img');
        if (!image) return { missingImage: true };
        const box = element.getBoundingClientRect(), artwork = image.getBoundingClientRect();
        const filename = image.getAttribute('src').split('/').pop();
        const metadata = window.PM_ATLAS_CROPS?.[filename];
        const scaleX = artwork.width / image.naturalWidth, scaleY = artwork.height / image.naturalHeight;
        const crop = { left: (box.left - artwork.left) / scaleX, top: (box.top - artwork.top) / scaleY,
          right: (box.right - artwork.left) / scaleX, bottom: (box.bottom - artwork.top) / scaleY };
        const nodeButton = element.closest('[data-hierarchy-node]');
        const node = nodeButton && window.PM_GUIDED_HIERARCHY.byId.get(nodeButton.dataset.hierarchyNode);
        const cells = Array.from({ length: 12 }, (_, index) => metadata?.cells?.[index] || {
          x: index % 4 * image.naturalWidth / 4, y: Math.floor(index / 4) * image.naturalHeight / 3,
          width: image.naturalWidth / 4, height: image.naturalHeight / 3,
        });
        const index = node?.imageKey?.index ?? cells.findIndex(cell => crop.left >= cell.x && crop.top >= cell.y
          && crop.right <= cell.x + cell.width && crop.bottom <= cell.y + cell.height);
        const cell = cells[index];
        const margins = cell && { left: crop.left - cell.x, top: crop.top - cell.y,
          right: cell.x + cell.width - crop.right, bottom: cell.y + cell.height - crop.bottom };
        return { filename, nodeId: node?.id, index, margins, square: Math.abs(box.width - box.height) <= 1,
          loaded: image.complete && image.naturalWidth > 0,
          metadataMatches: metadata?.width === image.naturalWidth && metadata?.height === image.naturalHeight,
          uniformScale: Math.abs(scaleX - scaleY) < .001,
          transform: getComputedStyle(image).transform,
          covered: artwork.left <= box.left + .1 && artwork.top <= box.top + .1
            && artwork.right >= box.right - .1 && artwork.bottom >= box.bottom - .1 };
      }),
    };
  }, cropSelector);
  assert.ok(result.width <= result.viewport + 1, `${label}: horizontal overflow ${result.width}/${result.viewport}`);
  assert.deepEqual(result.overflow, [], `${label}: hierarchy controls fit their container`);
  for (const crop of result.crops) {
    const detail = `${label}: ${JSON.stringify(crop)}`;
    assert.ok(!crop.missingImage && crop.loaded, `Artwork loads: ${detail}`);
    assert.ok(crop.metadataMatches, `Measured image bounds match the asset: ${detail}`);
    assert.ok(crop.square && crop.uniformScale, `Artwork keeps its native proportions: ${detail}`);
    assert.equal(crop.transform, 'none', `Hover cannot expose an adjoining tile: ${detail}`);
    assert.ok(crop.covered, `Artwork covers the complete thumbnail: ${detail}`);
    assert.ok(crop.index >= 0 && crop.index < 12 && crop.margins, `Crop stays within one atlas cell: ${detail}`);
    for (const margin of Object.values(crop.margins)) assert.ok(margin >= 2, `No cell boundary or separator enters the thumbnail: ${detail}`);
  }
  return result.crops.length;
}

async function getModel(page) {
  return page.evaluate(() => {
    const hierarchy = window.PM_GUIDED_HIERARCHY;
    const stageByQuestion = new Map(window.PM_DATA.stages.flatMap(stage => stage.questions.map(question => [question.id, stage.id])));
    return [...hierarchy.roots].map(([questionId, root]) => {
      const resolve = value => typeof value === 'string' ? hierarchy.byId.get(value) : value;
      const nodes = [];
      const visit = (value, trail) => {
        const node = resolve(value);
        const path = [...trail, node.id];
        nodes.push({ id: node.id, label: node.label, path, children: node.children.map(child => resolve(child).id),
          items: node.items.map(item => typeof item === 'string' ? item : item.id) });
        node.children.forEach(child => visit(child, path));
      };
      visit(root, []);
      return { questionId, stageId: stageByQuestion.get(questionId), rootId: resolve(root).id, nodes };
    });
  });
}

async function openHost(page, host, visitStage = true) {
  if (visitStage) await goToStage(page, host.stageId);
  const block = page.locator(`[data-question-block="${attr(host.questionId)}"]`);
  assert.ok(await block.isVisible(), `${host.questionId}: its ordinary host question is reachable without an unrelated prerequisite`);
  const toggle = block.locator(by('open', host.questionId));
  assert.equal(await toggle.count(), 1, `${host.questionId}: one accessible hierarchy toggle inside its question`);
  if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
  assert.equal(await toggle.getAttribute('aria-expanded'), 'true', `${host.questionId}: expanded state is exposed`);
  assert.ok(await section(page, host.questionId).isVisible(), `${host.questionId}: inline hierarchy is visible`);
  return section(page, host.questionId);
}

async function navigate(page, host, node) {
  const panel = await openHost(page, host);
  // Any ancestor in the breadcrumb is clickable; the current crumb may be text.
  const root = panel.locator(by('node', host.rootId));
  if (await root.count()) await root.first().click();
  for (const id of node.path.slice(1)) await panel.locator(by('node', id)).first().click();
  return panel;
}

async function pageItems(panel, questionId) {
  const seen = [];
  const signatures = new Set();
  for (;;) {
    const items = await panel.locator('[data-hierarchy-item]').evaluateAll(buttons => buttons.filter(button => button.getClientRects().length)
      .map(button => {
        const id = button.dataset.hierarchyItem;
        const item = window.PM_GUIDED_CORPUS.byId.get(id);
        const explanation = window.PM_GUIDED_DESCRIPTIONS[id];
        return { id, text: button.textContent, pressed: button.getAttribute('aria-pressed'),
          english: button.textContent.includes(item.tag),
          description: !!explanation?.description && button.textContent.includes(explanation.description),
          korean: /[가-힣]{2}/.test(explanation?.description || ''),
          fits: button.scrollWidth <= button.clientWidth + 1,
          viewportFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1 };
      }));
    assert.ok(items.length <= 12, `${questionId}: at most 12 detailed expressions appear together`);
    const signature = items.map(item => item.id).join(',');
    assert.ok(!signatures.has(signature), `${questionId}: pagination advances rather than looping`);
    signatures.add(signature);
    for (const item of items) {
      assert.ok(item.text.trim(), `${item.id}: choice has a visible accessible label`);
      assert.ok(item.english && item.description && item.korean, `${item.id}: original English expression and full Korean explanation remain available`);
      assert.ok(item.fits && item.viewportFits, `${item.id}: detailed wording fits its control and viewport`);
      assert.ok(['true', 'false'].includes(item.pressed), `${item.id}: selection state is accessible`);
      assert.ok(!seen.includes(item.id), `${item.id}: leaf pages do not repeat an expression`);
      seen.push(item.id);
    }
    const next = panel.locator(`${by('page', 1)}${by('question', questionId)}`);
    if (!await next.count() || !await next.isVisible() || await next.isDisabled()) break;
    await next.click();
  }
  return seen;
}

async function auditTree(page, hosts, options = {}) {
  const initialPrompt = await prompt(page);
  const visitedItems = new Set();
  const visitedNodes = new Set();
  const inspectedStages = new Set();
  let nodes = 0, crops = 0;
  for (const host of hosts) {
    try {
    await goToStage(page, host.stageId);
    const toggle = page.locator(`[data-question-block="${attr(host.questionId)}"] ${by('open', host.questionId)}`);
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false', `${host.questionId}: detail choices start collapsed`);
    assert.equal(await section(page, host.questionId).locator('[data-hierarchy-item]:visible').count(), 0,
      `${host.questionId}: closed questions do not expose thousands of choices`);
    // Ordinary stage artwork needs one audit per stage. Each new branch's
    // category artwork is inspected inside its host below, without scanning
    // all previous hosts or re-rendering the entire stage for every node.
    if (!inspectedStages.has(host.stageId)) {
      crops += await inspectGeometry(page, `desktop ${host.stageId} ordinary options`);
      inspectedStages.add(host.stageId);
    }
    const panel = await openHost(page, host, false);
    const byId = new Map(host.nodes.map(node => [node.id, node]));
    async function visit(node) {
      assert.ok(node && !visitedNodes.has(node.id), `${node?.id}: each UI category is visited once`);
      visitedNodes.add(node.id);
      assert.equal(await panel.locator(`${by('node', node.id)}[aria-current="location"]`).count(), 1,
        `${node.id}: the breadcrumb exposes the current category`);
      if (node.id !== host.rootId) assert.ok((await panel.textContent()).includes(node.label), `${node.id}: current category label is visible`);
      if (node.children.length) {
        assert.equal(await panel.locator('[data-hierarchy-item]:visible').count(), 0, `${node.id}: branches show categories before detail choices`);
        crops += await inspectGeometry(page, `desktop ${host.questionId}/${node.id}`, { questionId: host.questionId });
        for (const id of node.children) {
          const child = panel.locator(by('node', id));
          assert.ok(await child.isVisible(), `${node.id}: child ${id} is reachable`);
          // The corpus walk verifies the visible DOM and its actual delegated
          // click handler. Representative user interactions below additionally
          // exercise pointer actionability, focus and scrolling with Playwright.
          await child.evaluate(button => button.click());
          await visit(byId.get(id));
          await panel.locator(by('node', node.id)).evaluate(button => button.click());
          assert.equal(await panel.locator(`${by('node', node.id)}[aria-current="location"]`).count(), 1,
            `${node.id}: parent breadcrumb returns from child ${id}`);
        }
      } else {
        const items = await pageItems(panel, host.questionId);
        assert.deepEqual(ordered(items), ordered(node.items), `${node.id}: every expression appears through ordinary leaf pagination`);
        for (const id of items) {
          assert.ok(!visitedItems.has(id), `${id}: source expression is not duplicated across leaf UI`);
          visitedItems.add(id);
        }
      }
      nodes++;
    }
    await visit(byId.get(host.rootId));
    } catch (error) {
      diagnostic(error, `Tree progress: ${JSON.stringify({ host: host.questionId, stage: host.stageId, nodes, expressions: visitedItems.size })}`);
      throw error;
    }
  }
  assert.equal(nodes, hosts.reduce((sum, host) => sum + host.nodes.length, 0), 'Every category is audited through a single depth-first UI walk');
  assert.equal(visitedItems.size, options.expectedExpressions ?? 3217, 'Every original expression in the audited scope is reachable through category navigation');
  assert.equal(await prompt(page), initialPrompt, 'Browsing branches, breadcrumbs and pages cannot change a prompt');
  assert.equal(await page.locator('[data-guided-stage]').count(), 0, 'The separate detailed-vocabulary panel has been retired');
  return { hosts: hosts.length, nodes, leafExpressions: visitedItems.size, crops };
}

async function itemModel(page, tag) {
  return page.evaluate(text => {
    const item = window.PM_GUIDED_CORPUS.items.find(candidate => window.PM_GUIDED_CORPUS.keyFor(candidate.tag)
      === window.PM_GUIDED_CORPUS.keyFor(text));
    if (!item) return null;
    const path = window.PM_GUIDED_HIERARCHY.itemPaths.get(item.id);
    const questionId = window.PM_GUIDED_HIERARCHY.byId.get(path[0]).questionId;
    const stageId = window.PM_DATA.stages.find(stage => stage.questions.some(question => question.id === questionId)).id;
    return { id: item.id, tag: item.tag, weights: item.weights, stageId, path, questionId,
      explanation: window.PM_GUIDED_DESCRIPTIONS[item.id] };
  }, tag);
}

async function findSearchResult(panel, item) {
  const button = panel.locator(by('item', item.id));
  const seen = new Set();
  for (;;) {
    if (await button.count() && await button.isVisible()) return button;
    const ids = await panel.locator('[data-hierarchy-item]').evaluateAll(buttons => buttons.map(button => button.dataset.hierarchyItem).join(','));
    assert.ok(!seen.has(ids), `${item.id}: search pagination must terminate`);
    seen.add(ids);
    const next = panel.locator(`${by('page', 1)}${by('question', item.questionId)}`);
    assert.ok(await next.count() && await next.isVisible() && !await next.isDisabled(), `${item.id}: host-wide search finds its expression`);
    await next.click();
  }
}

async function selectExpression(page, hosts, item, weight = null) {
  const host = hosts.find(host => host.questionId === item.questionId);
  assert.ok(host, `${item.tag}: original expression has an ordinary question host`);
  const panel = await openHost(page, host);
  await panel.locator(by('search', item.questionId)).fill(item.tag);
  const button = await findSearchResult(panel, item);
  assert.ok((await button.textContent()).includes(item.tag), `${item.id}: original English expression remains visible`);
  if (await button.getAttribute('aria-pressed') !== 'true') await button.click();
  if (weight !== null) await panel.locator(by('weight', item.id)).selectOption(String(weight));
  assert.equal(await panel.locator(by('item', item.id)).getAttribute('aria-pressed'), 'true');
  const text = weight === null ? item.tag : `${weight}::${item.tag}::`;
  assert.ok((await prompt(page)).includes(text), `${item.id}: original wording and weight are compiled`);
  return { ...item, text };
}

async function auditSelection(page, hosts) {
  const weighted = await itemModel(page, 'watercolor painting');
  assert.ok(weighted?.weights.includes('5'), 'Original five-fold watercolor weight is available');
  const selected = [await selectExpression(page, hosts, weighted, '5')];
  for (const tag of ['intimate distance', 'chibi', 'white outline', 'aquarium tunnel', 'soft lighting', 'inner white t-shirt',
    'unzipped', 'puff sleeves', 'heart charm', 'floating ribbons', 'knees drawn up', 'leaning back on one hand', 'foreshortening',
    'magazine cover', 'handcuffs', 'sleeping']) {
    const item = await itemModel(page, tag);
    assert.ok(item, `${tag}: original representative phrase exists`);
    selected.push(await selectExpression(page, hosts, item));
  }
  const before = (await stored(page)).guided;
  const host = hosts.find(host => host.questionId === weighted.questionId);
  await goToStage(page, host.stageId);
  const alternative = page.locator(`[data-question="${attr(host.questionId)}"][data-option][aria-pressed="false"]`).first();
  assert.ok(await alternative.count(), `${host.questionId}: a parent family choice is available`);
  await alternative.click();
  assert.deepEqual((await stored(page)).guided, before, 'Changing a parent family cannot drop selected detail expressions or weights');
  const panel = await openHost(page, host);
  await panel.locator(by('search', host.questionId)).fill('');
  const unrelated = host.nodes.find(node => !node.children.length && !node.items.includes(weighted.id));
  assert.ok(unrelated, 'Cross-branch search fixture exists');
  await navigate(page, host, unrelated);
  const outputBeforeSearch = await prompt(page);
  const search = panel.locator(by('search', host.questionId));
  await search.fill(weighted.explanation.description);
  await findSearchResult(panel, weighted);
  assert.equal(await prompt(page), outputBeforeSearch, 'Korean explanation search does not change selected expressions');
  await search.fill('');
  const composition = await search.evaluate((input, query) => {
    input.focus();
    const panel = input.closest('section[data-hierarchy-question]');
    const items = () => [...panel.querySelectorAll('[data-hierarchy-item]')].map(button => button.dataset.hierarchyItem).join(',');
    const before = items();
    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    input.value = query;
    input.dispatchEvent(new InputEvent('input', { bubbles: true, data: query, inputType: 'insertCompositionText', isComposing: true }));
    const result = { keptInput: input.isConnected && document.activeElement === input, unchangedDuringComposition: before === items() };
    input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: query }));
    return result;
  }, weighted.explanation.label);
  assert.deepEqual(composition, { keptInput: true, unchangedDuringComposition: true }, 'Korean IME composition keeps the same focused input and waits for committed text');
  assert.equal(await search.inputValue(), weighted.explanation.label, 'Committed Korean text remains in the search input');
  await findSearchResult(panel, weighted);
  assert.equal(await panel.locator(by('weight', weighted.id)).inputValue(), '5', 'Weight remains selected when an expression reappears through search');
  await inspectGeometry(page, 'desktop selected Korean search');
  await panel.screenshot({ path: path.join(out, 'desktop-hierarchy-selected.png') });
  for (const density of ['density-light', 'density-rich', 'density-standard']) {
    await goToStage(page, 'finish');
    await page.locator(`[data-question="density"][data-option="${density}"]`).click();
    const output = await prompt(page);
    for (const item of selected) assert.ok(output.includes(item.text), `${density}: explicit expression survives (${item.text})`);
    assert.deepEqual((await stored(page)).guided, before, `${density}: original expression and emphasis state is independent of density`);
  }
  const savedOutput = await prompt(page);
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await prompt(page), savedOutput, 'All chosen expressions and emphasis survive saved-draft recovery');
  assert.deepEqual((await stored(page)).guided, before, 'Recovered exact guided selection state');
  await assertIndependentGuidedState(page);
  await goToStage(page, weighted.stageId);
  await page.locator(by('reveal', weighted.id)).click();
  const recoveredPanel = section(page, weighted.questionId);
  assert.equal(await recoveredPanel.locator(`${by('node', weighted.path.at(-1))}[aria-current="location"]`).count(), 1,
    'Selected expression chip reveals its complete original category path');
  assert.equal(await recoveredPanel.locator(by('item', weighted.id)).getAttribute('aria-pressed'), 'true',
    'Selected expression chip reveals the page containing its selected expression');
  assert.equal(await recoveredPanel.locator(by('weight', weighted.id)).inputValue(), '5',
    'Selected expression chip restores access to its original emphasis');
  const removable = selected.find(item => item.tag === 'aquarium tunnel');
  await goToStage(page, removable.stageId);
  await page.locator(by('remove', removable.id)).first().click();
  assert.ok(!Object.hasOwn((await stored(page)).guided.selections, removable.id), 'A selected detail chip removes only that expression');
  assert.ok((await prompt(page)).includes(selected[0].text), 'Removing one expression retains other selected weights');
  return { selections: selected.length, koreanSearch: true, crossBranchSearch: true, composition: true, savedState: true };
}

async function auditMobile(page, hosts, width) {
  let crops = 0;
  for (const host of hosts) {
    const node = host.nodes.find(node => !node.children.length);
    const panel = await navigate(page, host, node);
    assert.ok(await panel.locator('[data-hierarchy-item]').count() <= 12, `${width}/${host.questionId}: compact detail page`);
    crops += await inspectGeometry(page, `${width}/${host.questionId}`);
  }
  const item = await itemModel(page, 'watercolor painting');
  await selectExpression(page, hosts, item, '5');
  await inspectGeometry(page, `${width} selected expression and weight`);
  await section(page, item.questionId).screenshot({ path: path.join(out, `${width}-hierarchy-selected.png`) });
  if (await page.locator('#mobile-prompt-button').isVisible()) {
    await page.locator('#mobile-prompt-button').click();
    await inspectGeometry(page, `${width} mobile prompt dock`);
    await page.locator('#mobile-prompt-button').click();
  }
  return { hosts: hosts.length, crops };
}

// Reuse the complete corpus result when only the medium taxonomy or global
// search breadcrumbs change; this audit walks that one host and its UI state.
async function auditMediumScope(page) {
  const hosts = await getModel(page);
  const host = hosts.find(host => host.questionId === 'guided-medium');
  assert.ok(host, 'The medium question has an integrated vocabulary');
  const count = host.nodes.reduce((sum, node) => sum + node.items.length, 0);
  const tree = await auditTree(page, [host], { expectedExpressions: count });
  const watercolor = await itemModel(page, 'watercolor painting');
  const unpainted = await itemModel(page, 'unpainted');
  const labels = item => item.path.map(id => host.nodes.find(node => node.id === id).label);
  assert.ok(!labels(watercolor).some(label => /레이스|원단|섬유/.test(label)), 'Watercolor is classified using medium details rather than clothing materials');
  assert.ok(labels(unpainted).some(label => label === '선화와 스케치'), 'Unpainted belongs to drawing/animation instead of matching paint as a substring');
  assert.ok(!labels(unpainted).some(label => label === '수채화와 물감'), 'Unpainted cannot fall into the watercolor branch');
  const previous = host.nodes.find(node => node.id === unpainted.path.at(-1));
  const panel = await navigate(page, host, previous);
  const pathIds = () => panel.locator('.vocabulary-path [data-hierarchy-node]').evaluateAll(buttons => buttons.map(button => button.dataset.hierarchyNode));
  const search = panel.locator(by('search', host.questionId));
  const assertGlobalPath = async label => {
    assert.deepEqual(await pathIds(), [host.rootId], `${label}: global results do not retain an unrelated leaf breadcrumb`);
    assert.equal((await panel.locator('.vocabulary-path [aria-current="location"]').textContent()).replace(/^\s*›\s*/, '').trim(), label);
  };
  await search.fill(watercolor.explanation.description);
  await findSearchResult(panel, watercolor);
  await assertGlobalPath('전체 분류 검색 결과');
  await panel.locator(by('item', watercolor.id)).click();
  await panel.locator(by('weight', watercolor.id)).selectOption('5');
  await search.fill('');
  assert.deepEqual(await pathIds(), previous.path, 'Clearing global search restores the original browsing path');
  await panel.locator(by('selected-only', host.questionId)).check();
  await assertGlobalPath('선택한 표현');
  assert.equal(await panel.locator(by('item', watercolor.id)).count(), 1, 'Selected-only results span the whole question');
  await panel.locator(by('selected-only', host.questionId)).uncheck();
  assert.deepEqual(await pathIds(), previous.path, 'Leaving selected-only mode restores the original browsing path');
  await panel.locator(by('item', unpainted.id)).click();
  await panel.locator(by('selected-only', host.questionId)).check();
  await assertGlobalPath('선택한 표현');
  assert.deepEqual(ordered(await panel.locator('[data-hierarchy-item]').evaluateAll(buttons => buttons.map(button => button.dataset.hierarchyItem))),
    ordered([watercolor.id, unpainted.id]), 'Selected-only results include selections from different medium branches');
  await panel.locator(by('reveal', watercolor.id)).click();
  assert.deepEqual(await pathIds(), watercolor.path, 'A selected chip reveals the actual newly classified medium path');
  assert.equal(await panel.locator(by('search', host.questionId)).inputValue(), '');
  assert.ok(!await panel.locator(by('selected-only', host.questionId)).isChecked(), 'Chip reveal exits global result modes');
  assert.equal(await panel.locator(by('item', watercolor.id)).getAttribute('aria-pressed'), 'true');
  await panel.locator(by('search', host.questionId)).fill(watercolor.explanation.label);
  await assertGlobalPath('전체 분류 검색 결과');
  await panel.screenshot({ path: path.join(out, 'desktop-hierarchy-selected.png') });
  return { tree, watercolorPath: labels(watercolor), unpaintedPath: labels(unpainted),
    globalSearchBreadcrumb: true, selectedScopeBreadcrumb: true, clearRestoresPath: true, chipRevealPath: true };
}

// A focused follow-up can call this export without repeating the full corpus
// walk. In-place section updates must preserve the keyboard's position.
async function auditFocus(page, hosts) {
  const host = hosts.find(host => host.nodes.some(node => node.items.length > 24));
  assert.ok(host, 'Keyboard pagination fixture has at least three pages');
  const node = host.nodes.find(node => node.items.length > 24);
  const panel = await navigate(page, host, node);
  const assertFocus = async (selector, label) => {
    assert.ok(await panel.locator(selector).evaluate(element => document.activeElement === element), label);
  };
  const next = panel.locator(by('page', 1));
  await next.focus();
  await next.press('Enter');
  await assertFocus(by('page', 1), 'Pagination keeps focus on the next button while it remains usable');
  await panel.locator(by('page', 1)).press('Enter');
  assert.ok(await panel.locator('[data-hierarchy-item]').first().evaluate(element => document.activeElement === element),
    'Reaching the final page moves focus to its first expression instead of a disabled button');
  const selectedOnly = panel.locator(by('selected-only', host.questionId));
  await selectedOnly.focus();
  await selectedOnly.press('Space');
  await assertFocus(by('selected-only', host.questionId), 'Selected-only filtering retains the focused checkbox');
  await panel.locator(by('selected-only', host.questionId)).press('Space');
  await panel.locator(by('node', node.id)).click();
  for (const id of node.items.slice(0, 5)) await panel.locator(by('item', id)).click();
  const allSelected = panel.locator(by('selected', host.questionId));
  await allSelected.focus();
  await allSelected.press('Enter');
  await assertFocus(by('selected', host.questionId), 'Showing all selected expressions retains its control focus');
  await panel.locator(by('open', host.questionId)).click();
  const controls = await panel.locator(by('open', host.questionId)).getAttribute('aria-controls');
  assert.equal(await page.locator(`[id="${attr(controls)}"]`).count(), 1, 'Collapsed hierarchy keeps its aria-controls target');
  const remove = panel.locator('[data-hierarchy-remove]').first();
  await remove.focus();
  await remove.press('Enter');
  await assertFocus(by('open', host.questionId), 'Removing a collapsed chip moves focus to its hierarchy toggle');
  const reveal = panel.locator('[data-hierarchy-reveal]').first();
  const itemId = await reveal.getAttribute('data-hierarchy-reveal');
  await reveal.focus();
  await reveal.press('Enter');
  await assertFocus(by('item', itemId), 'Revealing a selected chip focuses its expression');
  return { pagination: true, disabledPageFallback: true, selectedOnly: true, selectedSummary: true,
    collapsedRemoval: true, chipReveal: true, collapsedAriaControls: true };
}

async function auditViewport(browser, viewport, full) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  const injectedFailures = [];
  const resourceDiagnostics = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => {
    const message = `${request.failure()?.errorText} ${request.url()}`;
    // This system injects a local AdGuard script absent from the repository.
    // Production CSP correctly blocks it; keep it separate from app failures.
    if (new URL(request.url()).hostname === 'local.adguard.org' && /BLOCKED_BY_CSP/.test(message)) injectedFailures.push(message);
    else errors.push(message);
  });
  page.on('response', response => {
    if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) errors.push(`${response.status()} ${response.url()}`);
    if (response.url().endsWith('/guided-hierarchy.js')) {
      const resource = { status: response.status(), contentLength: response.headers()['content-length'] };
      resourceDiagnostics.push(resource);
      response.body().then(body => Object.assign(resource, { bytes: body.length,
        start: body.toString('utf8').slice(0, 45), end: body.toString('utf8').slice(-45) }))
        .catch(error => { resource.bodyError = error.message; });
    }
  });
  try {
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.PM_GUIDED_HIERARCHY);
    const hosts = await getModel(page);
    const result = full
      ? { tree: await auditTree(page, hosts), interaction: await auditSelection(page, hosts) }
      : await auditMobile(page, hosts, viewport.width);
    assert.deepEqual(errors, [], `${viewport.width}: no browser exceptions or failed image/script resources`);
    return { viewport: `${viewport.width}x${viewport.height}`, ...result,
      ...(injectedFailures.length ? { blockedLocalInjection: injectedFailures.length } : {}) };
  } catch (error) {
    const initialization = await page.evaluate(() => ({ data: typeof window.PM_DATA, guided: typeof window.PM_GUIDED_CORPUS,
      hierarchy: typeof window.PM_GUIDED_HIERARCHY, stageButtons: document.querySelectorAll('[data-stage]').length,
      brokenImages: [...document.querySelectorAll('[data-reference-image]')].filter(image => image.complete && !image.naturalWidth).map(image => image.currentSrc || image.src) })).catch(() => null);
    diagnostic(error, `Browser diagnostics: ${JSON.stringify({ errors, injectedFailures, initialization, resources: resourceDiagnostics })}`);
    throw error;
  } finally { await context.close(); }
}

async function run() {
  fs.mkdirSync(out, { recursive: true });
  const browser = await launch();
  try {
    const results = [];
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }, { width: 320, height: 740 }]) {
      results.push(await auditViewport(browser, viewport, viewport.width === 1440));
    }
    console.log(JSON.stringify({ status: 'PASS', results, screenshots: out }, null, 2));
  } finally { await browser.close(); }
}
if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { inspectGeometry, getModel, auditTree, auditSelection, auditFocus, auditMediumScope, run };
