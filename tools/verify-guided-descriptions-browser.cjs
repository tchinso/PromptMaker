#!/usr/bin/env node
// Focused localization checks. Geometry and corpus reconstruction have separate audits.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { launch, openGroup } = require('./verify-guided-browser.cjs');
const baseURL = process.env.PM_BASE_URL || 'http://localhost:4173';
const out = process.env.PM_QA_DIR || path.join(os.tmpdir(), 'promptmaker-guided-qa');

async function inspectViewport(browser, viewport) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => {
    if (new URL(request.url()).origin === new URL(baseURL).origin) {
      errors.push(`${request.failure()?.errorText} ${request.url()}`);
    }
  });
  page.on('response', response => {
    if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) {
      errors.push(`${response.status()} ${response.url()}`);
    }
  });
  try {
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    assert.ok(await page.evaluate(() => !!window.PM_GUIDED_HIERARCHY),
      `Hierarchy failed to initialize: ${JSON.stringify(errors)}`);
    const groups = await page.evaluate(() => [...window.PM_GUIDED_HIERARCHY.roots.values()].map(root => ({
      id: root.id, questionId: root.questionId, representative: root.allItems[0].tag,
    })));
    let visibleDescriptions = 0;
    for (const group of groups) {
      await openGroup(page, group);
      const scope = page.locator(`section[data-hierarchy-question="${group.questionId}"]`);
      await scope.locator('[data-hierarchy-search]').fill(group.representative);
      const result = await scope.evaluate(section => {
        const choices = [...section.querySelectorAll('[data-hierarchy-item]')];
        return {
          count: choices.length,
          missing: choices.filter(choice => !/[가-힣]{2}/.test(choice.querySelector('.guided-description')?.textContent || ''))
            .map(choice => choice.dataset.hierarchyItem),
          overflow: choices.filter(choice => choice.scrollWidth > choice.clientWidth + 1)
            .map(choice => choice.dataset.hierarchyItem),
          sectionWidth: section.getBoundingClientRect().width,
          viewportWidth: document.documentElement.clientWidth,
        };
      });
      assert.ok(result.count > 0, `${group.id}: choices render`);
      assert.deepEqual(result.missing, [], `${group.id}: visible Korean explanations`);
      assert.deepEqual(result.overflow, [], `${group.id}: explanation text fits`);
      assert.ok(result.sectionWidth <= result.viewportWidth, `${group.id}: integrated vocabulary fits the viewport`);
      visibleDescriptions += result.count;
    }

    const item = await page.evaluate(() => {
      const item = window.PM_GUIDED_CORPUS.items.find(item => item.facet === 'medium'
        && /watercolor/i.test(item.tag) && item.weights.includes('5'));
      return { ...item, explanation: window.PM_GUIDED_DESCRIPTIONS[item.id] };
    });
    assert.ok(item, 'Original weighted watercolor expression exists');
    const group = await openGroup(page, item);
    const scope = page.locator(`section[data-hierarchy-question="${group.questionId}"]`);
    const search = scope.locator('[data-hierarchy-search]');
    const before = await page.locator('#prompt-output').textContent();
    await search.fill(item.explanation.description);
    const choice = page.locator(`[data-hierarchy-item="${item.id}"]`);
    await choice.waitFor();
    assert.equal(await choice.locator('.guided-description').textContent(), item.explanation.description);
    assert.ok((await choice.textContent()).includes(item.tag), 'Original English tag remains visible');
    assert.equal(await page.locator('#prompt-output').textContent(), before, 'Korean search does not change the prompt');

    await search.fill('');
    const composition = await search.evaluate((input, query) => {
      input.focus();
      const section = input.closest('section[data-hierarchy-question]');
      const before = [...section.querySelectorAll('[data-hierarchy-item]')].map(button => button.dataset.hierarchyItem).join(',');
      input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      input.value = query;
      input.dispatchEvent(new InputEvent('input', { bubbles: true, data: query, inputType: 'insertCompositionText', isComposing: true }));
      const during = [...section.querySelectorAll('[data-hierarchy-item]')].map(button => button.dataset.hierarchyItem).join(',');
      const keptInput = input.isConnected && document.activeElement === input;
      input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: query }));
      return { keptInput, sameResultsDuringComposition: before === during };
    }, item.explanation.label);
    assert.deepEqual(composition, { keptInput: true, sameResultsDuringComposition: true }, 'Korean composition remains intact');
    assert.equal(await search.inputValue(), item.explanation.label);
    await choice.waitFor();
    await choice.click();
    await page.locator(`[data-hierarchy-weight="${item.id}"]`).selectOption('5');
    const output = await page.locator('#prompt-output').textContent();
    assert.ok(output.includes(`5::${item.tag}::`), 'English expression and original weight compile unchanged');
    assert.ok(!/[가-힣]/.test(output), 'Descriptions are help text only');
    assert.ok(await scope.evaluate(section => section.scrollWidth <= section.clientWidth + 1),
      'Selected expression, explanation and weight control fit together');
    await page.screenshot({ path: path.join(out, `${viewport.width}x${viewport.height}-korean-descriptions.png`) });
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('#prompt-output').textContent(), output, 'Localized selection survives reload');
    assert.deepEqual(errors, [], 'No browser exceptions or failed resources');
    return { viewport: `${viewport.width}x${viewport.height}`, groups: groups.length, visibleDescriptions,
      koreanSearch: true, composition: true, originalWeight: true };
  } finally { await context.close(); }
}

async function run() {
  fs.mkdirSync(out, { recursive: true });
  const browser = await launch();
  try {
    const results = [];
    const widths = process.env.PM_VIEWPORTS?.split(',').map(Number);
    const viewports = [{ width: 1440, height: 1000 }, { width: 390, height: 844 }, { width: 320, height: 740 }]
      .filter(viewport => !widths || widths.includes(viewport.width));
    assert.ok(viewports.length, 'PM_VIEWPORTS must contain a supported viewport width');
    for (const viewport of viewports) {
      const result = await inspectViewport(browser, viewport);
      results.push(result);
      console.log(JSON.stringify({ status: 'VIEWPORT_PASS', ...result }));
    }
    console.log(JSON.stringify({ status: 'PASS', results, screenshots: out }, null, 2));
  } finally { await browser.close(); }
}
if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });
