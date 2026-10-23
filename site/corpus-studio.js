(function () {
  "use strict";
  const corpus = window.PM_CORPUS_LIBRARY;
  const facets = corpus.grammar.facets;
  const facetOrder = new Map(facets.map((facet, index) => [facet.id, index]));
  const sections = [...new Set(facets.map((facet) => facet.section))];
  const weightedText = /^(-?(?:\d+(?:\.\d+)?|\.\d+))::([\s\S]+)::$/;
  // Accept a phrase or a rendered weighted phrase, for shared UI identity.
  const keyFor = (text) => {
    const clean = String(text).trim();
    return (clean.match(weightedText)?.[2] || clean).replace(/\s+/g, " ").trim().toLowerCase();
  };
  const blocks = Object.entries(corpus.sourcePrompts).flatMap(([promptId, prompt]) =>
    prompt.sections.map((section, index) => ({
      id: `${promptId}:${index}`, promptId, title: prompt.title, page: prompt.pageId,
      label: section.label, rawText: section.rawText || "",
      tags: section.tags.map((tag, tagIndex) => ({
        ...tag, id: `${promptId}:${index}:${tagIndex}`,
        text: tag.weight != null ? `${tag.weight}::${tag.tag}::` : tag.tag,
      })),
    })),
  );
  const byId = new Map(blocks.map((block) => [block.id, block]));
  const tags = new Map(blocks.flatMap((block) => block.tags.map((tag) => [tag.id, tag])));

  function normalize(value = {}) {
    if (!value || typeof value !== "object" || Array.isArray(value)) value = {};
    const custom = {};
    for (const section of sections) {
      const items = value.custom && Array.isArray(value.custom[section]) ? value.custom[section] : [];
      const clean = [...new Set(items.filter((text) => typeof text === "string")
        .map((text) => text.replace(/\s+/g, " ").trim())
        .filter((text) => text && !/[\u0000-\u0008\u000e-\u001f\u007f]/.test(text)))];
      if (clean.length) custom[section] = clean;
    }
    return {
      blocks: [...new Set((Array.isArray(value.blocks) ? value.blocks : []).filter((id) => byId.has(id)))],
      pins: [...new Set((Array.isArray(value.pins) ? value.pins : []).filter((id) => tags.has(id)))],
      excluded: [...new Set((Array.isArray(value.excluded) ? value.excluded : []).filter((id) => tags.has(id)))],
      custom,
      useBase: value.useBase === true,
    };
  }

  function compile(value, density, allow = () => true) {
    const state = normalize(value);
    const excluded = new Set(state.excluded.map((id) => keyFor(tags.get(id).tag)));
    const custom = Object.entries(state.custom).flatMap(([section, items]) => items.map((text, index) => {
      const weighted = text.match(weightedText);
      return {
        id: `custom:${section}:${index}`, text, tag: weighted ? weighted[2].trim() : text,
        weight: weighted ? weighted[1] : null, facet: `free-${section}`, section,
      };
    }));
    const explicitByTag = new Map();
    // Pins override other occurrences, including custom text and exclusions.
    // Each phrase occurs once, even if several source occurrences were pinned.
    for (const item of [...state.pins.map((id) => tags.get(id)), ...custom]) {
      const key = keyFor(item.tag);
      if (!explicitByTag.has(key) && allow(item.text)) explicitByTag.set(key, item);
    }
    const pinned = [...explicitByTag.values()];
    const automaticByTag = new Map();
    for (const id of state.blocks) {
      for (const item of byId.get(id).tags) {
        const key = keyFor(item.tag);
        if (excluded.has(key) || explicitByTag.has(key) || !allow(item.text)) continue;
        const previous = automaticByTag.get(key);
        // Preserve source emphasis regardless of block selection order. Two
        // different source weights keep the first selected source's intent.
        if (!previous || (previous.weight == null && item.weight != null)) automaticByTag.set(key, item);
      }
    }
    const candidates = [...automaticByTag.values()];
    // Preserve the first phrase in each semantic layer and explicit source
    // weights before optional detail. Budget is shared across selected blocks.
    const covered = new Set(pinned.map((item) => item.facet));
    const essential = [], detail = [];
    for (const item of candidates) {
      if (!covered.has(item.facet) || item.weight != null) essential.push(item);
      else detail.push(item);
      covered.add(item.facet);
    }
    const budget = density === "density-light" ? 18 : density === "density-rich" ? Infinity : 30;
    const selected = [...pinned, ...essential, ...detail.slice(0, Math.max(0, budget - pinned.length - essential.length))];
    selected.sort((a, b) => (facetOrder.get(a.facet) ?? facets.length) - (facetOrder.get(b.facet) ?? facets.length));
    return { selected, omitted: candidates.length + pinned.length - selected.length, total: candidates.length + pinned.length };
  }

  window.PM_CORPUS_STUDIO = { blocks, byId, tags, facets, normalize, compile, keyFor };
  // Read-only compatibility compiler for converting saved drafts from v6/v7.
  // The current interface exposes ordinary, stage-specific controls only.
})();
