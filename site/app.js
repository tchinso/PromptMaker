(function () {
  "use strict";

  const DATA = window.PM_DATA;
  const STUDIO = window.PM_CORPUS_STUDIO;
  const GUIDED = window.PM_GUIDED_CORPUS;
  const GUIDED_DESCRIPTIONS = window.PM_GUIDED_DESCRIPTIONS || {};
  const HIERARCHY = window.PM_GUIDED_HIERARCHY;
  if (!DATA) throw new Error("Prompt data is missing.");

  const STORAGE_KEY = "nyankat-prompt-atelier:draft:v3";
  const LIBRARY_KEY = "nyankat-prompt-atelier:library:v3";
  const LEGACY_STORAGE_KEYS = ["nyankat-prompt-atelier:draft:v2", "momo-prompt-atelier:draft:v2"];
  const LEGACY_LIBRARY_KEYS = ["nyankat-prompt-atelier:library:v2", "momo-prompt-atelier:library:v2"];

  const defaultState = () => ({
    version: DATA.version,
    currentStage: 0,
    idea: "",
    intent: "",
    answers: {
      "scene-cast": ["cast-solo"],
      density: ["density-standard"],
      aspect: ["ratio-portrait"],
      "core-emphasis": ["emphasis-none"],
    },
    custom: {},
    guided: { selections: {}, useBase: false, active: false },
    details: {},
    customUC: "",
    outputTab: "flat",
    emphasis: "2",
    quality: false,
  });

  let state = loadState();
  let toastTimer = 0;
  let activeDialog = null;
  let combinedLibraryCache = null;
  let needsMigrationSave = false;
  // Browsing a family never changes the expressions selected in another one.
  const hierarchyViews = new Map();

  const el = {
    stageNav: document.querySelector("#stage-nav"),
    stageContent: document.querySelector("#stage-content"),
    stageCounter: document.querySelector("#stage-counter"),
    progressFill: document.querySelector("#progress-fill"),
    answerCounter: document.querySelector("#answer-counter"),
    prevStage: document.querySelector("#prev-stage"),
    nextStage: document.querySelector("#next-stage"),
    nextLabel: document.querySelector("#next-label"),
    ideaInput: document.querySelector("#idea-input"),
    ideaHint: document.querySelector("#idea-hint"),
    analyzeIdea: document.querySelector("#analyze-idea"),
    intentPicker: document.querySelector("#intent-picker"),
    draftName: document.querySelector("#draft-name"),
    saveStatus: document.querySelector("#save-status"),
    promptOutput: document.querySelector("#prompt-output"),
    promptTabs: document.querySelector(".prompt-tabs"),
    emptyPrompt: document.querySelector("#empty-prompt"),
    tagCount: document.querySelector("#tag-count"),
    mobileTagCount: document.querySelector("#mobile-tag-count"),
    warningList: document.querySelector("#warning-list"),
    emphasisSelect: document.querySelector("#emphasis-select"),
    qualityToggle: document.querySelector("#quality-toggle"),
    copyPrompt: document.querySelector("#copy-prompt"),
    saveDraft: document.querySelector("#save-draft"),
    libraryButton: document.querySelector("#library-button"),
    resetButton: document.querySelector("#reset-button"),
    libraryDialog: document.querySelector("#library-dialog"),
    closeLibrary: document.querySelector("#close-library"),
    libraryList: document.querySelector("#library-list"),
    detailDialog: document.querySelector("#detail-dialog"),
    detailTitle: document.querySelector("#detail-title"),
    detailEyebrow: document.querySelector("#detail-eyebrow"),
    detailContent: document.querySelector("#detail-content"),
    closeDetail: document.querySelector("#close-detail"),
    toast: document.querySelector("#toast"),
    mobilePromptButton: document.querySelector("#mobile-prompt-button"),
    promptDock: document.querySelector(".prompt-dock"),
    corpusDna: document.querySelector("#corpus-dna"),
  };

  const questionMap = new Map();
  DATA.stages.forEach((stage) => stage.questions.forEach((question) => questionMap.set(question.id, question)));
  const novelaiCatalogByTag = new Map((window.PM_NOVELAI_TAG_CATALOG?.items || []).map((item) => [item.tag, item]));
  const preloadedImageSources = new Set();

  function addOptionImageSources(options, sources) {
    (options || []).forEach((option) => {
      if (option?.image && !option.noVisual) sources.add(option.image);
    });
  }

  function preloadStageImages(index) {
    const stage = DATA.stages[index];
    if (!stage) return;
    const sources = new Set();
    stage.questions.forEach((question) => {
      addOptionImageSources(question.options, sources);
      if (question.dynamicPack) {
        Object.values(DATA.dynamicPacks?.[question.dynamicPack] || {}).forEach((options) => addOptionImageSources(options, sources));
      }
    });
    const load = () => sources.forEach((source) => {
      if (preloadedImageSources.has(source)) return;
      preloadedImageSources.add(source);
      const image = new Image();
      image.decoding = "async";
      image.src = source;
    });
    if ("requestIdleCallback" in window) window.requestIdleCallback(load, { timeout: 800 });
    else window.setTimeout(load, 0);
  }

  const sectionForQuestion = {
    "character-archetype": "character",
    "age-impression": "character",
    "hair-length": "character",
    "hair-style": "character",
    "hair-color": "character",
    eyes: "character",
    face: "character",
    body: "character",
    genre: "concept",
    setting: "background",
    "time-weather": "background",
    palette: "background",
    tone: "background",
    lighting: "background",
    atmosphere: "background",
    "camera-finish": "background",
    wardrobe: "outfit",
    "outfit-subtype": "outfit",
    "outfit-fit": "outfit",
    material: "outfit",
    legwear: "outfit",
    footwear: "outfit",
    "hair-accessory": "outfit",
    jewelry: "outfit",
    "hand-prop": "composition",
    "scene-decor": "background",
    framing: "composition",
    angle: "composition",
    pose: "composition",
    gesture: "composition",
    gaze: "composition",
    expression: "composition",
    "composition-extra": "composition",
  };

  function sectionFor(question) {
    return question?.section || sectionForQuestion[question?.id] || "other";
  }

  const questionOrder = {
    "character-archetype": 10,
    "age-impression": 15,
    "hair-length": 20,
    "hair-style": 30,
    "hair-color": 40,
    eyes: 50,
    face: 60,
    body: 70,
    intent: 5,
    genre: 10,
    setting: 10,
    "time-weather": 20,
    palette: 30,
    tone: 35,
    lighting: 40,
    "scene-decor": 45,
    atmosphere: 50,
    "camera-finish": 60,
    wardrobe: 10,
    "outfit-subtype": 15,
    "outfit-fit": 20,
    material: 50,
    legwear: 60,
    footwear: 70,
    "hair-accessory": 80,
    jewelry: 90,
    framing: 10,
    angle: 20,
    "composition-extra": 25,
    pose: 30,
    "hand-prop": 35,
    gesture: 40,
    gaze: 50,
    expression: 60,
  };

  const detailOrder = {
    "outfit-palette": 12,
    "outfit-layer": 18,
    "outfit-collar": 22,
    "outfit-top": 26,
    "outfit-sleeves": 30,
    "outfit-bottom": 40,
    "outfit-pattern": 44,
    "outfit-trim": 48,
    "outfit-state": 55,
    "body-orientation": 27,
    "leg-structure": 32,
    "motion-response": 42,
    "prop-relation": 36,
    "prop-hand": 37,
    "prop-state": 38,
    "subject-placement": 12,
    "focus-target": 65,
  };

  function readMigratedStorage(primaryKey, legacyKeys, isValid) {
    const olderKeys = Array.isArray(legacyKeys) ? legacyKeys : [legacyKeys];
    for (const key of [primaryKey, ...olderKeys]) {
      try {
        const raw = localStorage.getItem(key);
        if (raw === null) continue;
        const parsed = JSON.parse(raw);
        if (!isValid(parsed)) continue;
        if (key !== primaryKey) {
          try {
            localStorage.setItem(primaryKey, JSON.stringify(parsed));
          } catch (_) {
            // Reading the legacy value is still useful when migration cannot be written.
          }
        }
        return parsed;
      } catch (_) {
        // A broken value should fall through to the other key or a clean default.
      }
    }
    return null;
  }

  function migratedStage(saved) {
    const version = Number(saved.version) || 0;
    const index = Math.trunc(Number(saved.currentStage) || 0);
    return Math.max(0, Math.min(DATA.stages.length - 1, index - (version >= 6 && version < 8 ? 1 : 0)));
  }

  function loadState() {
    const parsed = readMigratedStorage(
      STORAGE_KEY,
      LEGACY_STORAGE_KEYS,
      (value) => Boolean(value && typeof value === "object" && value.answers),
    );
    if (parsed) {
      const defaults = defaultState();
      return {
        ...defaults,
        ...parsed,
        version: DATA.version,
        currentStage: migratedStage(parsed),
        answers: { ...defaults.answers, ...(parsed.answers || {}) },
        custom: { ...(parsed.custom || {}) },
        details: { ...(parsed.details || {}) },
      };
    }
    return defaultState();
  }

  function persist() {
    window.clearTimeout(persist.statusTimer);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      el.saveStatus.textContent = "방금 자동 저장됨";
    } catch (_) {
      el.saveStatus.textContent = "자동 저장 실패 · 브라우저 저장 공간 확인";
      return false;
    }
    persist.statusTimer = window.setTimeout(() => {
      el.saveStatus.textContent = "이 기기에 자동 저장";
    }, 1600);
    return true;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function cleanTag(value) {
    let tag = String(value || "").trim().replace(/^,+|,+$/g, "").trim();
    const legacy = tag.match(/^\((.+):([0-9.]+)\)$/);
    if (legacy) tag = `${legacy[2]}::${legacy[1].trim()}::`;
    return tag;
  }

  function splitTagInput(rawValue) {
    const spans = String(rawValue || "").match(/\s*-?(?:\d+(?:\.\d+)?|\.\d+)::[\s\S]*?::|[^,]+/g) || [];
    return spans.map(cleanTag).filter(Boolean);
  }

  function stripWeight(value) {
    return String(value)
      .replace(/^-?[0-9.]+::/, "")
      .replace(/::$/, "")
      .trim()
      .toLowerCase();
  }

  function uniqueTags(tags) {
    const seen = new Set();
    return tags
      .map(cleanTag)
      .filter(Boolean)
      .filter((tag) => {
        const key = stripWeight(tag);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  function logicalTagCount(tags) {
    return tags.reduce((total, tag) => {
      const weighted = String(tag).match(/^-?[0-9.]+::([\s\S]*?)::$/);
      if (!weighted) return total + 1;
      return total + weighted[1].split(",").map((item) => item.trim()).filter(Boolean).length;
    }, 0);
  }

  function allSelectedIds() {
    return new Set(Object.values(state.answers).flat());
  }

  function hasAnswer(questionId, optionIds) {
    const wanted = Array.isArray(optionIds) ? optionIds : [optionIds];
    if (questionId === "scene-cast") return wanted.includes(state.answers[questionId]?.[0]);
    return (state.answers[questionId] || []).some((id) => wanted.includes(id));
  }

  // Scene casting is deliberately a single, mutually exclusive choice. Keeping
  // this helper strict prevents a stale draft with both legacy values from ever
  // compiling or surfacing partner-only controls in a solo scene.
  function isPartnerScene() {
    return state.answers["scene-cast"]?.[0] === "cast-partner";
  }

  function matchesCondition(condition) {
    if (!condition) return true;
    return Object.entries(condition).every(([questionId, optionIds]) => hasAnswer(questionId, optionIds));
  }

  function matchesAnyCondition(conditions) {
    if (!conditions?.length) return true;
    return conditions.some((condition) => matchesCondition(condition));
  }

  function isQuestionVisible(question) {
    if (!question) return false;
    if (!matchesCondition(question.visibleWhen)) return false;
    if (!matchesAnyCondition(question.visibleWhenAny)) return false;
    return true;
  }

  function getOption(question, optionId) {
    return question?.options?.find((item) => item.id === optionId) || null;
  }

  function heldHandDemand() {
    const propQuestion = questionMap.get("hand-prop");
    const prop = getOption(propQuestion, state.answers["hand-prop"]?.[0]);
    return Number(prop?.handDemand || 0);
  }

  function unavailableReason(question, optionItem) {
    if (!optionItem) return "선택지를 찾을 수 없어요.";
    if (!matchesCondition(optionItem.visibleWhen) || !matchesAnyCondition(optionItem.visibleWhenAny)) return "현재 장면 조건에서 사용할 수 없는 선택지예요.";
    if (["hand-action", "partner-action"].includes(question?.id)) {
      const demand = heldHandDemand() + Number(optionItem.handDemand || 0);
      if (demand > 2) return "손소품이 손을 차지하고 있어 이 동작은 함께 사용할 수 없어요.";
    }
    return "";
  }

  function isOptionUnavailable(question, optionItem) {
    return Boolean(unavailableReason(question, optionItem));
  }

  function visibleOptions(question) {
    return (question?.options || []).filter((item) => !isOptionUnavailable(question, item));
  }

  function isOptionSurfaceVisible(optionItem) {
    if (!optionItem) return false;
    if (!matchesCondition(optionItem.visibleWhen)) return false;
    if (!matchesAnyCondition(optionItem.visibleWhenAny)) return false;
    return true;
  }

  function getQuestion(questionId) {
    const base = questionMap.get(questionId);
    if (!base) return null;
    if (!base.dynamicPack) return base;
    const parentId = state.answers[base.dynamicPack]?.[0];
    const packs = DATA.dynamicPacks?.[base.dynamicPack] || (base.dynamicPack === "wardrobe" ? DATA.outfitPacks || {} : {});
    return { ...base, options: parentId ? packs[parentId] || [] : [] };
  }

  function catalogQuestions() {
    return DATA.stages.flatMap((stage) => stage.questions.map((question) => getQuestion(question.id)));
  }

  function allQuestions() {
    return catalogQuestions().filter(isQuestionVisible);
  }

  function getDetailGroups(question) {
    const own = (question.detailGroups || []).map((group) => ({
      ...group,
      section: group.section || sectionFor(question),
      options: group.options.map((item) =>
        Array.isArray(item)
          ? { ...item, id: item[0], label: item[1], tag: item[2], description: item[3] || "", source: item[4] || "suggested" }
          : item,
      ),
    }));
    return [...own, ...(DATA.detailPacks[question.id] || [])];
  }

  const unsafeTagPattern = /(?:\b(?:loli|child|children|teen|underage|minor|young\s*(?:girl|boy)|rape|forced|nonconsensual|sex|sexual|penetration|penis|vagina|pussy|cum|nude|nipples?)\b|bra[_\s-]?lift|panties?[_\s-]?around)/i;

  function unsafeTagReason(tag) {
    const clean = stripWeight(cleanTag(tag));
    if (!clean) return "빈 태그는 추가할 수 없어요.";
    if (unsafeTagPattern.test(clean)) return "노골적 성적 표현 또는 연령 안전성이 불명확한 태그는 이 앱에서 추가할 수 없어요.";
    const catalogItem = novelaiCatalogByTag.get(clean);
    if (catalogItem?.nsfw) return "노골적 태그로 분류된 항목은 이 앱에서 추가할 수 없어요.";
    return "";
  }

  function isSafeCustomTag(tag) {
    return !unsafeTagReason(tag);
  }

  function sanitizeState() {
    state.currentStage = Math.max(0, Math.min(DATA.stages.length - 1, Math.trunc(Number(state.currentStage) || 0)));
    if (state.studio) {
      const migrated = GUIDED.migrateStudio({ guided: state.guided, studio: state.studio, density: state.answers.density?.[0] }, STUDIO, isSafeCustomTag);
      state.guided = migrated.guided;
      const questionForSection = { character: "character-archetype", concept: "genre", background: "setting", composition: "framing", outfit: "wardrobe" };
      Object.entries(migrated.custom).forEach(([section, tags]) => {
        const questionId = questionForSection[section];
        if (questionId) state.custom[questionId] = uniqueTags([...tags, ...(state.custom[questionId] || [])]);
      });
      delete state.studio;
      needsMigrationSave = true;
    } else state.guided = GUIDED.normalize(state.guided);
    // Remove answers saved by the retired content-mode UI so upgraded drafts
    // immediately use the unified, non-graphic question flow.
    ["content-mode", "adult-confirmation"].forEach((questionId) => {
      delete state.answers[questionId];
      delete state.custom[questionId];
      delete state.details[questionId];
    });
    const activeQuestionIds = new Set();
    catalogQuestions().forEach((question) => {
      if (!question) return;
      const visible = isQuestionVisible(question);
      if (visible) activeQuestionIds.add(question.id);
      if (!visible) {
        delete state.answers[question.id];
        delete state.custom[question.id];
        delete state.details[question.id];
        return;
      }
      const validIds = [...new Set((state.answers[question.id] || []).filter((optionId) => {
        const optionItem = getOption(question, optionId);
        return optionItem && !isOptionUnavailable(question, optionItem);
      }))];
      if (question.id === "scene-cast") {
        // If a legacy draft contains both answers, favor the visible/default solo
        // choice so a partner cannot leak into an explicitly solo composition.
        state.answers[question.id] = [
          validIds.includes("cast-solo") ? "cast-solo" : validIds.includes("cast-partner") ? "cast-partner" : "cast-solo",
        ];
      } else if (question.multi) {
        const max = Number(question.max || validIds.length);
        if (validIds.length) state.answers[question.id] = validIds.slice(0, max);
        else delete state.answers[question.id];
      } else if (validIds.length) {
        state.answers[question.id] = [validIds.at(-1)];
      } else {
        delete state.answers[question.id];
      }
      const groups = getDetailGroups(question);
      Object.entries(state.details[question.id] || {}).forEach(([groupId, optionIds]) => {
        const group = groups.find((item) => item.id === groupId);
        const valid = (optionIds || []).filter((id) => group?.options.some((item) => item.id === id));
        if (valid.length) state.details[question.id][groupId] = valid;
        else delete state.details[question.id][groupId];
      });
      if (!Object.keys(state.details[question.id] || {}).length) delete state.details[question.id];
      const safeCustom = (state.custom[question.id] || []).filter(isSafeCustomTag);
      if (safeCustom.length) state.custom[question.id] = safeCustom;
      else delete state.custom[question.id];
    });
    Object.keys(state.custom).forEach((questionId) => {
      if (questionId !== "__global" && !activeQuestionIds.has(questionId)) delete state.custom[questionId];
    });
    const safeGlobal = (state.custom.__global || []).filter(isSafeCustomTag);
    if (safeGlobal.length) state.custom.__global = safeGlobal;
    else delete state.custom.__global;
  }

  function countStageAnswers(stage) {
    const guidedCount = GUIDED.compile(state.guided, isSafeCustomTag).selected.filter((item) => {
      const root = HIERARCHY?.byId.get(HIERARCHY.itemPaths.get(item.id)?.[0]);
      return root ? stage.questions.some((question) => question.id === root.questionId) : item.stageId === stage.id;
    }).length;
    return guidedCount + stage.questions.filter((question) => isQuestionVisible(getQuestion(question.id))).reduce((total, question) => {
      const baseCount = state.answers[question.id]?.length || 0;
      const detailCount = Object.values(state.details[question.id] || {}).flat().length;
      const customCount = state.custom[question.id]?.length || 0;
      return total + baseCount + detailCount + customCount;
    }, 0);
  }

  function countAllAnswers() {
    const activeIds = new Set(allQuestions().map((question) => question.id));
    const answerCount = Object.entries(state.answers)
      .filter(([key]) => activeIds.has(key) && !["density", "aspect", "core-emphasis"].includes(key))
      .reduce((sum, [, values]) => sum + values.length, 0);
    const detailCount = Object.entries(state.details).reduce(
      (sum, [questionId, groups]) => sum + (activeIds.has(questionId) ? Object.values(groups).flat().length : 0),
      0,
    );
    const customCount = Object.entries(state.custom).reduce(
      (sum, [questionId, tags]) => sum + (questionId === "__global" || activeIds.has(questionId) ? tags.length : 0),
      0,
    );
    return answerCount + detailCount + customCount + GUIDED.compile(state.guided, isSafeCustomTag).selected.length + (state.intent ? 1 : 0);
  }

  function selectOption(questionId, optionId) {
    const question = getQuestion(questionId);
    const optionItem = getOption(question, optionId);
    if (!question || !optionItem || !isQuestionVisible(question)) return false;

    const current = [...(state.answers[questionId] || [])];
    const alreadySelected = current.includes(optionId);

    if (!alreadySelected) {
      const reason = unavailableReason(question, optionItem);
      if (reason) {
        showToast(reason);
        return false;
      }
    }

    if (alreadySelected) {
      state.answers[questionId] = current.filter((id) => id !== optionId);
    } else if (question.multi) {
      let next = current;
      (question.exclusiveGroups || []).forEach((group) => {
        if (group.includes(optionId)) next = next.filter((id) => !group.includes(id));
      });
      const max = question.max || 99;
      if (next.length >= max) {
        showToast(`최대 ${max}개까지 선택할 수 있어요. 기존 선택을 먼저 해제해주세요.`);
        return false;
      }
      state.answers[questionId] = [...next, optionId];
    } else {
      state.answers[questionId] = [optionId];
    }

    if (!state.answers[questionId]?.length) delete state.answers[questionId];
    DATA.stages.forEach((stage) => {
      stage.questions.filter((item) => item.dynamicPack === questionId).forEach((item) => {
        delete state.answers[item.id];
        delete state.custom[item.id];
        delete state.details[item.id];
      });
    });
    sanitizeState();

    persist();
    renderAll();
    return true;
  }

  function chooseRecommended(questionId) {
    const question = getQuestion(questionId);
    const options = visibleOptions(question);
    if (!options.length) {
      showToast("먼저 위 질문에서 필요한 조건을 골라주세요.");
      return;
    }
    const current = state.answers[questionId] || [];
    if (question.multi && current.length >= (question.max || 99)) {
      showToast(`이미 최대 ${question.max}개를 골랐어요. 하나를 해제하면 새 방향을 추천할게요.`);
      return;
    }
    const selected = allSelectedIds();
    const available = options.filter((item) => !current.includes(item.id));
    const candidates = available.length ? available : options;
    const contextScore = (item) => (item.recommend || []).filter((id) => selected.has(id)).length;
    const strongestContext = Math.max(...candidates.map(contextScore), 0);
    const contextPool = strongestContext ? candidates.filter((item) => contextScore(item) === strongestContext) : candidates;
    const weighted = contextPool.map((item) => {
      const evidence = Number(item.referencePromptFrequency || 0);
      const referenceWeight = Math.max(0.12, Number(item.referenceWeight ?? 1));
      return {
        item,
        weight: referenceWeight * (1 + Math.log1p(evidence) * 0.28) * (1 + contextScore(item) * 0.55),
      };
    });
    const total = weighted.reduce((sum, item) => sum + item.weight, 0);
    let cursor = Math.random() * total;
    const choice = weighted.find((entry) => {
      cursor -= entry.weight;
      return cursor <= 0;
    })?.item || weighted.at(-1)?.item;
    if (choice && selectOption(questionId, choice.id)) {
      showToast(`${choice.label} 방향을 추천했어요. 참조 빈도와 현재 선택을 함께 반영했습니다.`);
    }
  }

  function addCustomTag(questionId, rawValue) {
    const values = splitTagInput(rawValue);
    if (!values.length) return;
    const rejected = values.filter((tag) => !isSafeCustomTag(tag));
    const safeValues = values.filter(isSafeCustomTag);
    if (!safeValues.length) {
      showToast(rejected.length ? unsafeTagReason(rejected[0]) : "추가할 태그가 없어요.");
      return;
    }
    const current = state.custom[questionId] || [];
    state.custom[questionId] = uniqueTags([...current, ...safeValues]);
    persist();
    renderAll();
    showToast(`${safeValues.length}개 직접 태그를 추가했어요.${rejected.length ? ` ${rejected.length}개는 안전 범위 밖이라 제외했습니다.` : ""}`);
  }

  function removeCustomTag(questionId, tag) {
    state.custom[questionId] = (state.custom[questionId] || []).filter((item) => item !== tag);
    if (!state.custom[questionId].length) delete state.custom[questionId];
    persist();
    renderAll();
  }

  function toggleDetail(questionId, groupId, optionId) {
    const question = getQuestion(questionId);
    const group = getDetailGroups(question).find((item) => item.id === groupId);
    if (!group) return;
    state.details[questionId] ||= {};
    const current = [...(state.details[questionId][groupId] || [])];
    const selected = current.includes(optionId);
    let next;
    if (selected) next = current.filter((id) => id !== optionId);
    else if ((group.max || 1) === 1) next = [optionId];
    else if (current.length >= group.max) {
      showToast(`이 세부 슬롯은 최대 ${group.max}개예요. 기존 선택을 먼저 해제해주세요.`);
      return;
    } else next = [...current, optionId];
    if (next.length) state.details[questionId][groupId] = next;
    else delete state.details[questionId][groupId];
    persist();
    renderAll();
    if (activeDialog?.mode === "details") renderDetailDialog(questionId);
  }

  function optionSourceLabel(source) {
    if (source === "corpus") return ["내 프롬프트", "corpus"];
    if (source === "official") return ["NovelAI 확인", "official"];
    if (source === "novelai") return ["NovelAI 태그", "official"];
    return ["설계 제안", "suggested"];
  }

  function renderIntentPicker() {
    el.intentPicker.innerHTML = DATA.intents
      .map(
        (intent) => `
          <button class="intent-chip ${state.intent === intent.id ? "selected" : ""}" type="button" data-intent="${intent.id}" aria-pressed="${state.intent === intent.id}" title="${escapeHtml(intent.description)}">
            ${escapeHtml(intent.label)}
          </button>`,
      )
      .join("");
  }

  function renderStageNav() {
    el.stageNav.innerHTML = DATA.stages
      .map((stage, index) => {
        const count = countStageAnswers(stage);
        const current = index === state.currentStage;
        return `
          <button class="stage-link ${count ? "done" : ""}" type="button" data-stage="${index}" ${current ? 'aria-current="step"' : ""}>
            <span class="stage-number">${count && !current ? "✓" : String(index + 2).padStart(2, "0")}</span>
            <span class="stage-name"><strong>${stage.short}</strong><small>${stage.subtitle}</small></span>
            ${count ? `<span class="stage-answer-count">${count}</span>` : ""}
          </button>`;
      })
      .join("");
  }

  function spriteStyleFor(optionItem) {
    const sprite = optionItem.sprite;
    const spriteColumns = Math.max(1, Number(sprite?.columns || 1));
    const spriteRows = Math.max(1, Number(sprite?.rows || 1));
    const spriteIndex = Math.max(0, Number(sprite?.index || 0));
    // Crop inside the cell, including its rounded corners and separator gutter.
    // Express the inset in cell coordinates so it does not drift on later rows.
    const metadata = window.PM_ATLAS_CROPS?.[optionItem.image?.split("/").pop()];
    const inset = Number(sprite?.inset ?? metadata?.inset ?? 0.04);
    const imageWidth = metadata?.width || spriteColumns;
    const imageHeight = metadata?.height || spriteRows;
    const cell = metadata?.cells?.[spriteIndex] || {
      x: spriteIndex % spriteColumns * imageWidth / spriteColumns,
      y: Math.floor(spriteIndex / spriteColumns) % spriteRows * imageHeight / spriteRows,
      width: imageWidth / spriteColumns, height: imageHeight / spriteRows,
    };
    const cellWidth = cell.width;
    const cellHeight = cell.height;
    // Center a square inside the measured cell. A non-square atlas must not
    // stretch faces or garments to fit the square card.
    const side = Math.min(cellWidth, cellHeight) * (1 - 2 * inset);
    const margin = Math.min(cellWidth, cellHeight) * inset;
    const insetX = margin + (cellWidth - 2 * margin - side) * (cell.anchorX ?? 0.5);
    const insetY = margin + (cellHeight - 2 * margin - side) * (cell.anchorY ?? 0.5);
    return sprite
      ? `--sprite-width:${imageWidth / side * 100}%;--sprite-height:${imageHeight / side * 100}%;--sprite-left:${-(cell.x + insetX) / side * 100}%;--sprite-top:${-(cell.y + insetY) / side * 100}%;`
      : `--visual:${escapeHtml(optionItem.visual || "linear-gradient(145deg,#ded8ff,#ffd9cb)")}`;
  }

  function renderDetailThumbnail(optionItem) {
    if (!optionItem.image || optionItem.noVisual || !optionItem.sprite) return "";
    return `<span class="detail-visual option-sprite" style="${spriteStyleFor(optionItem)}" aria-hidden="true"><img src="${escapeHtml(optionItem.image)}" alt="" loading="lazy" data-reference-image /></span>`;
  }

  function renderOptionCard(question, optionItem) {
    const selectedIds = state.answers[question.id] || [];
    const selected = selectedIds.includes(optionItem.id);
    const selectedSet = allSelectedIds();
    const recommended = (optionItem.recommend || []).some((id) => selectedSet.has(id));
    const unavailable = unavailableReason(question, optionItem);
    const source = optionSourceLabel(optionItem.source);
    const tagPreview = Object.values(optionItem.tags || {}).flat().slice(0, 2);
    const sprite = optionItem.sprite;
    const image = optionItem.image && !optionItem.noVisual
      ? `<div class="option-visual ${sprite ? "option-sprite" : ""}" style="${spriteStyleFor(optionItem)}"><img src="${escapeHtml(optionItem.image)}" alt="${escapeHtml(optionItem.label)} 선택 예시" loading="lazy" data-reference-image /></div>`
      : "";
    const swatch = optionItem.swatch || optionItem.visual
      ? `<span class="option-swatch" style="--swatch:${escapeHtml(optionItem.swatch || optionItem.visual)}" aria-hidden="true"></span>`
      : "";
    const evidence = Number(optionItem.referencePromptFrequency || 0);
    const referenceWeight = Number(optionItem.referenceWeight || 0);
    const referencePriority = Number(optionItem.referencePriority || 0);
    const referenceBadge = evidence >= 4 || referenceWeight >= 1.2
      ? `<span class="reference-badge" title="참조 프롬프트 빈도와 수동 우선도를 추천 확률에 반영합니다">참조 우선 ${evidence >= 4 ? `${evidence}회` : referencePriority >= 1.2 ? `${Math.round(referencePriority * 100)}%` : `${Math.round(referenceWeight * 100)}%`}</span>`
      : "";
    return `
      <button class="option-card ${selected ? "selected" : ""} ${image ? "has-image" : ""} ${unavailable ? "incompatible" : ""}" type="button" data-question="${question.id}" data-option="${optionItem.id}" aria-pressed="${selected}" ${unavailable ? `disabled aria-disabled="true" title="${escapeHtml(unavailable)}"` : ""}>
        ${recommended ? '<span class="recommend-badge">지금 답과 잘 맞아요</span>' : ""}
        ${referenceBadge}
        ${image}
        <span class="option-body">
          <span class="option-topline">
            <span class="option-label">${escapeHtml(optionItem.label)}</span>
            <span class="option-check" aria-hidden="true">✓</span>
          </span>
          ${swatch}
          <span class="option-desc">${escapeHtml(optionItem.description)}</span>
          <span class="source-badge ${source[1]}">${source[0]}</span>
          <span class="option-tags">${tagPreview.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</span>
          ${unavailable ? `<span class="option-unavailable">${escapeHtml(unavailable)}</span>` : ""}
        </span>
      </button>`;
  }

  function renderCustomChips(questionId) {
    const tags = state.custom[questionId] || [];
    if (!tags.length) return "";
    return `<div class="custom-chip-list" aria-label="직접 추가한 태그">${tags
      .map(
        (tag) => `<span class="custom-chip">${escapeHtml(tag)}<button type="button" data-action="remove-custom" data-question="${questionId}" data-tag="${escapeHtml(tag)}" aria-label="${escapeHtml(tag)} 삭제">×</button></span>`,
      )
      .join("")}</div>`;
  }

  function corpusItems() {
    const corpus = window.PM_CORPUS_LIBRARY;
    if (Array.isArray(corpus)) return corpus;
    return Array.isArray(corpus?.items) ? corpus.items : [];
  }

  function novelaiCatalogItems() {
    const catalog = window.PM_NOVELAI_TAG_CATALOG?.items || [];
    const categoryFor = (item) => {
      const source = `${item.category || ""} ${item.subCategory || ""}`;
      if (/(의상|패션|신발|양말|스타킹|수영복|옷)/.test(source)) return "outfit";
      if (/(장신구|액세서리|소품|머리장식|주얼리)/.test(source)) return "accessory";
      if (/(포즈|행동|손|표정)/.test(source)) return "action";
      if (/(구도|카메라|시점)/.test(source)) return "composition";
      if (/(배경|조명|분위기|색상|날씨)/.test(source)) return "background";
      if (/(캐릭터|얼굴|눈|헤어|피부|신체)/.test(source)) return "character";
      return "other";
    };
    return catalog
      .filter((item) => !item.nsfw && isSafeCustomTag(item.tag))
      .map((item) => ({ ...item, category: categoryFor(item), frequency: 0, source: "novelai" }));
  }

  function libraryCountFor(question) {
    const library = corpusItems();
    if (!library.length) return "전체 검색";
    const wanted = libraryCategories(question.id);
    const count = library.filter((item) => wanted.includes(item.category) || wanted.includes("all")).length;
    return `${count.toLocaleString("ko-KR")}개 내 스타일 코퍼스 + NovelAI 태그`;
  }

  function renderQuestion(question, index) {
    const options = (question.options || []).filter(isOptionSurfaceVisible);
    const detailGroups = getDetailGroups(question);
    const detailCount = Object.values(state.details[question.id] || {}).flat().length;
    const selectionLabel = question.multi ? `최대 ${question.max || "여러"}개` : "한 가지";
    const unavailable = question.dynamicPack && !state.answers[question.dynamicPack]?.length;
    const unavailableMessage = question.prerequisiteMessage || (question.dynamicPack === "wardrobe"
      ? "위 질문에서 의상의 큰 계열을 먼저 고르면 7~10개의 세부 유형이 열립니다."
      : "위 질문의 큰 계열을 먼저 고르면 이 세부 유형이 열립니다.");

    return `
      <section class="question-block" data-question-block="${question.id}">
        <div class="question-head">
          <div>
            <h3><span class="question-index">${String(index + 1).padStart(2, "0")}</span>${escapeHtml(question.title)}</h3>
            <p>${escapeHtml(question.description)}</p>
          </div>
          <span class="selection-limit">${selectionLabel}</span>
        </div>
        ${
          unavailable
            ? `<div class="library-empty">${unavailableMessage}</div>`
            : `<div class="option-grid ${question.visual ? "visual" : ""}">${options.map((item) => renderOptionCard(question, item)).join("")}</div>`
        }
        ${renderQuestionVocabulary(question)}
        ${question.id === "scene-cast" ? `<label class="guided-base"><input id="guided-use-base" type="checkbox" ${state.guided.useBase ? "checked" : ""} /> 개별 표현에도 장면 설정의 기본 인원 태그 추가</label>` : ""}
        ${
          unavailable
            ? ""
            : `<div class="question-tools">
                <button class="micro-button" type="button" data-action="recommend" data-question="${question.id}">모름 · 지금 답에서 추천</button>
                <input class="custom-input" data-custom-input="${question.id}" placeholder="목록에 없는 영문 태그를 직접 입력…" aria-label="${escapeHtml(question.title)} 직접 태그" />
                <button class="custom-add" type="button" data-action="add-custom" data-question="${question.id}">추가</button>
              </div>
              ${renderCustomChips(question.id)}
              <div>
                <button class="detail-trigger" type="button" data-action="search-tags" data-question="${question.id}">⌕ ${libraryCountFor(question)}</button>
                ${detailGroups.length ? `<button class="detail-trigger" type="button" data-action="open-details" data-question="${question.id}">＋ 세부 슬롯 ${detailCount ? `${detailCount}개 선택됨` : "열기"}</button>` : ""}
              </div>`
        }
      </section>`;
  }

  function renderFinishExtras() {
    return `
      <section class="question-block">
        <div class="question-head">
          <div>
            <h3><span class="question-index">＋</span>마지막 자유 입력</h3>
            <p>정해진 선택지가 상상을 자르지 않도록, 원하는 태그와 Undesired Content를 그대로 보존합니다.</p>
          </div>
          <span class="selection-limit">제한 없음</span>
        </div>
        <div class="final-freeform-grid">
          <label class="final-field">
            <strong>전체 프롬프트에 추가할 태그</strong>
            <small>쉼표로 구분 · 각 질문의 직접 입력과 합쳐집니다</small>
            <textarea id="global-custom-tags" rows="4" placeholder="예: intricate embroidery, windblown veil, translucent petals">${escapeHtml((state.custom.__global || []).join(", "))}</textarea>
          </label>
          <label class="final-field">
            <strong>Undesired Content 직접 입력</strong>
            <small>원본 스타일에는 없으므로 별도 출력에만 사용됩니다</small>
            <textarea id="custom-uc" rows="4" placeholder="예: multiple views, glowing eyes">${escapeHtml(state.customUC || "")}</textarea>
          </label>
        </div>
      </section>`;
  }

  function hierarchyView(questionId) {
    if (!hierarchyViews.has(questionId)) hierarchyViews.set(questionId, {
      open: false, nodeId: HIERARCHY.getRoot(questionId).id, query: "", page: 0, selectedOnly: false,
    });
    return hierarchyViews.get(questionId);
  }

  function isVocabularySelected(id) {
    return Object.prototype.hasOwnProperty.call(state.guided.selections, id);
  }

  function hierarchyArtwork(node) {
    const key = node.imageKey;
    if (!key) return "";
    const sheet = key.sheet === "world" ? "appearance-world" : "detail-action";
    return renderDetailThumbnail({
      image: `assets/visual-guides/options/thumb-hierarchy-${sheet}-v1.png`,
      sprite: { columns: 4, rows: 3, index: key.index },
    });
  }

  function vocabularyChoice(item) {
    const explanation = GUIDED_DESCRIPTIONS[item.id] || {};
    const label = explanation.label || item.label;
    const selected = isVocabularySelected(item.id);
    return `<div class="guided-choice-row"><button type="button" class="guided-choice ${selected ? "selected" : ""}" data-hierarchy-item="${item.id}" aria-pressed="${selected}"><strong>${escapeHtml(label)}</strong><small>${escapeHtml(item.tag)}</small>${explanation.description ? `<span class="guided-description">${escapeHtml(explanation.description)}</span>` : ""}</button>
      ${selected && item.weights.length > 1 ? `<select data-hierarchy-weight="${item.id}" aria-label="${escapeHtml(item.tag)} 강조값">${item.weights.map((weight) => `<option value="${weight ?? ""}" ${state.guided.selections[item.id] === weight ? "selected" : ""}>${weight === null ? "강조 없음" : `${weight}×`}</option>`).join("")}</select>` : ""}</div>`;
  }

  function renderQuestionVocabulary(question) {
    const root = HIERARCHY?.getRoot(question.id);
    if (!root) return "";
    const view = hierarchyView(question.id);
    const node = HIERARCHY.byId.get(view.nodeId) || root;
    const selected = root.allItems.filter((item) => isVocabularySelected(item.id));
    const summary = `<div class="vocabulary-heading"><button type="button" class="vocabulary-toggle" data-hierarchy-open="${question.id}" aria-expanded="${view.open}" aria-controls="vocabulary-${question.id}"><span>${view.open ? "−" : "＋"} 계열별 세부 선택</span><small>${root.allItems.length}개 표현${selected.length ? ` · ${selected.length}개 선택` : ""}</small></button></div>`;
    const chips = selected.length ? `<div class="custom-chip-list vocabulary-selected" aria-label="이 질문에서 선택한 세부 표현">${selected.slice(0, 4).map((item) => `<span class="custom-chip"><button type="button" class="vocabulary-reveal" data-hierarchy-reveal="${item.id}" title="선택한 표현의 분류와 강조값 보기">${escapeHtml((GUIDED_DESCRIPTIONS[item.id] || {}).label || item.label)}</button><button type="button" data-hierarchy-remove="${item.id}" aria-label="${escapeHtml(item.tag)} 선택 취소">×</button></span>`).join("")}${selected.length > 4 ? `<button type="button" class="micro-button" data-hierarchy-selected="${question.id}">선택한 ${selected.length}개 모두 보기</button>` : ""}</div>` : "";
    if (!view.open) return `<section class="question-vocabulary" data-hierarchy-question="${question.id}">${summary}<div id="vocabulary-${question.id}" hidden></div>${chips}</section>`;

    const query = view.query.trim().toLowerCase();
    const searching = Boolean(query) || view.selectedOnly;
    // Search spans this entire question; it does not hide a match in an
    // unopened branch. Ordinary browsing always follows the semantic tree.
    const source = searching ? root.allItems : node.items;
    const items = source.filter((item) => {
      const explanation = GUIDED_DESCRIPTIONS[item.id] || {};
      return item.variants.some((variant) => isSafeCustomTag(variant.text)) &&
        (!view.selectedOnly || isVocabularySelected(item.id)) && (!query ||
          `${item.searchText} ${explanation.label || ""} ${explanation.description || ""}`.toLowerCase().includes(query));
    });
    const path = [];
    for (let current = node; current; current = HIERARCHY.byId.get(current.parentId)) path.unshift(current);
    const visiblePath = searching ? [root] : path;
    const pages = Math.max(1, Math.ceil(items.length / 12));
    view.page = Math.max(0, Math.min(pages - 1, view.page));
    const visible = items.slice(view.page * 12, (view.page + 1) * 12);
    const branches = searching ? [] : node.children;
    return `<section class="question-vocabulary" data-hierarchy-question="${question.id}">${summary}
      <div id="vocabulary-${question.id}" class="vocabulary-body">
        <nav class="vocabulary-path" aria-label="세부 선택 분류 경로">${visiblePath.map((part, index) => `${index ? '<span aria-hidden="true">›</span>' : ""}<button type="button" data-hierarchy-node="${part.id}" ${!searching && part.id === node.id ? 'aria-current="location"' : ""}>${escapeHtml(index === 0 ? "전체 계열" : part.label)}</button>`).join("")}${searching ? `<span aria-current="location">› ${view.selectedOnly ? "선택한 표현" : "전체 분류 검색 결과"}</span>` : ""}</nav>
        <input class="custom-input vocabulary-search" data-hierarchy-search="${question.id}" value="${escapeHtml(view.query)}" placeholder="이 질문의 모든 세부 표현 검색 · 한국어 / 영문" aria-label="${escapeHtml(question.title)} 세부 표현 검색" />
        <div class="vocabulary-meta"><span>${searching ? `${items.length}개 표현` : branches.length ? "큰 계열 → 작은 계열 → 세부 표현" : `${node.allItems.length}개 세부 표현`}</span><label><input type="checkbox" data-hierarchy-selected-only="${question.id}" ${view.selectedOnly ? "checked" : ""} /> 선택한 표현만</label></div>
        ${branches.length ? `<div class="vocabulary-branches">${branches.map((branch) => {
          const count = branch.allItems.filter((item) => isVocabularySelected(item.id)).length;
          return `<button type="button" class="vocabulary-branch ${count ? "has-selection" : ""}" data-hierarchy-node="${branch.id}">${hierarchyArtwork(branch)}<span><strong>${escapeHtml(branch.label)}</strong><small>${branch.allItems.length}개 표현${branch.children.length ? ` · ${branch.children.length}개 하위 계열` : ""}${count ? ` · ${count}개 선택` : ""}</small></span><span aria-hidden="true">›</span></button>`;
        }).join("")}</div>` : ""}
        ${items.length || !branches.length ? `<div class="guided-choices vocabulary-choices">${visible.map(vocabularyChoice).join("") || '<p class="library-empty">일치하는 표현이 없습니다. 다른 검색어나 분류를 골라주세요.</p>'}</div>` : ""}
        ${pages > 1 ? `<div class="guided-pagination"><button type="button" class="micro-button" data-hierarchy-page="-1" data-hierarchy-question="${question.id}" ${view.page === 0 ? "disabled" : ""}>이전</button><span>${view.page + 1} / ${pages}</span><button type="button" class="micro-button" data-hierarchy-page="1" data-hierarchy-question="${question.id}" ${view.page + 1 >= pages ? "disabled" : ""}>다음</button></div>` : ""}
      </div>${chips}</section>`;
  }

  function refreshVocabulary(questionId, focus = null) {
    const container = el.stageContent.querySelector(`section[data-hierarchy-question="${CSS.escape(questionId)}"]`);
    if (!container) return;
    container.outerHTML = renderQuestionVocabulary(getQuestion(questionId));
    if (focus) {
      const target = el.stageContent.querySelector(focus);
      // Paging/filtering can remove or disable the control that initiated
      // the update. Keep keyboard navigation inside the same question.
      const fallback = el.stageContent.querySelector(`section[data-hierarchy-question="${CSS.escape(questionId)}"] [data-hierarchy-item]`) ||
        el.stageContent.querySelector(`[data-hierarchy-open="${CSS.escape(questionId)}"]`);
      (target && !target.disabled ? target : fallback)?.focus({ preventScroll: true });
    }
  }

  function updateVocabularySelection(itemId) {
    const root = HIERARCHY.byId.get(HIERARCHY.itemPaths.get(itemId)[0]);
    persist();
    renderStageNav();
    renderPrompt();
    el.answerCounter.textContent = `${countAllAnswers()}개 선택`;
    const stage = DATA.stages[state.currentStage];
    const count = countStageAnswers(stage);
    el.stageContent.querySelector(".stage-summary").textContent = `${count}개 디테일 선택됨`;
    const focused = document.activeElement;
    const attribute = focused?.dataset.hierarchyWeight ? "data-hierarchy-weight" : "data-hierarchy-item";
    refreshVocabulary(root.questionId, `[${attribute}="${itemId}"]`);
  }

  function updateVocabularyQuery(input) {
    const questionId = input.dataset.hierarchySearch;
    const view = hierarchyView(questionId);
    if (view.query === input.value) return;
    const cursor = input.selectionStart;
    view.query = input.value;
    view.page = 0;
    refreshVocabulary(questionId);
    const next = el.stageContent.querySelector(`[data-hierarchy-search="${CSS.escape(questionId)}"]`);
    next?.focus({ preventScroll: true }); next?.setSelectionRange(cursor, cursor);
  }

  function renderStage() {
    const stage = DATA.stages[state.currentStage];
    const questions = stage.questions.map((question) => getQuestion(question.id)).filter(isQuestionVisible);
    const count = countStageAnswers(stage);
    el.stageContent.innerHTML = `
      <header class="stage-header">
        <div>
          <span class="eyebrow">${String(state.currentStage + 2).padStart(2, "0")} · ${escapeHtml(stage.eyebrow.split(" · ").pop())}</span>
          <h2>${stage.title}</h2>
          <p>${stage.description}</p>
        </div>
        <span class="stage-summary">${count ? `${count}개 디테일 선택됨` : "아직 선택 전"}</span>
      </header>
      ${questions.map(renderQuestion).join("")}
      ${stage.id === "finish" ? renderFinishExtras() : ""}`;

    el.prevStage.disabled = state.currentStage === 0;
    const last = state.currentStage === DATA.stages.length - 1;
    el.nextLabel.textContent = last ? "프롬프트 복사" : `다음: ${DATA.stages[state.currentStage + 1].title}`;
    el.stageCounter.textContent = `${state.currentStage + 1} / ${DATA.stages.length}`;
    el.progressFill.style.width = `${((state.currentStage + 1) / DATA.stages.length) * 100}%`;
    el.answerCounter.textContent = `${countAllAnswers()}개 선택`;
    // Current cards load immediately from cache; stage-ahead preloading keeps
    // the next category from showing an empty lazy-image state on navigation.
    preloadStageImages(state.currentStage);
    preloadStageImages(state.currentStage + 1);
  }

  function selectedIntent() {
    return DATA.intents.find((item) => item.id === state.intent) || null;
  }

  function castBaseTags() {
    if (isPartnerScene()) {
      return ["1girl", "1boy", "2people", "adult woman", "adult man"];
    }
    return ["1girl", "solo", "adult woman"];
  }

  function gatherPrompt() {
    const density = state.answers.density?.[0] || "density-standard";
    const bundleLimit = { "density-light": 1, "density-standard": 2, "density-rich": Infinity }[density] || 2;
    const guidedResult = GUIDED.compile(state.guided, isSafeCustomTag);
    const explicitWinners = new Map(guidedResult.selected.map((item) => [GUIDED.keyFor(item.tag), item]));
    const registerCustom = (section, tags) => (tags || []).forEach((text) => {
      const key = GUIDED.keyFor(text);
      if (!explicitWinners.has(key)) explicitWinners.set(key, { text, section });
    });
    allQuestions().forEach((question) => {
      const section = sectionFor(question);
      if (["character", "concept", "background", "composition", "outfit"].includes(section)) registerCustom(section, state.custom[question.id]);
    });
    registerCustom("concept", state.custom.__global);
    const useBase = guidedResult.selected.length || state.guided.active ? state.guided.useBase : true;
    const baseCharacterTags = useBase ? castBaseTags() : [];
    const entries = {
      character: [{ order: 0, tags: baseCharacterTags }],
      concept: [],
      background: [],
      composition: [],
      outfit: [],
    };

    const push = (target, order, tags) => {
      if (!entries[target] || !tags?.length) return;
      entries[target].push({ order, tags });
    };

    const intent = selectedIntent();
    if (intent) push("concept", questionOrder.intent, intent.tags.concept);
    guidedResult.selected.forEach((item) => push(item.section, 1, [item.text]));

    allQuestions().forEach((question) => {
      (state.answers[question.id] || []).forEach((optionId) => {
        const item = getOption(question, optionId);
        if (!item) return;
        Object.entries(item.tags || {}).forEach(([sourceSection, tags]) => {
          if (sourceSection === "meta") return;
          let target = sourceSection;
          if (["mood", "background"].includes(sourceSection)) target = "background";
          if (["composition", "action"].includes(sourceSection)) target = "composition";
          if (["outfit", "accessory"].includes(sourceSection)) target = "outfit";
          if (question.id === "hand-prop") target = "composition";
          // Density controls automatic card elaboration only. Explicit detail
          // choices, source imports and free text are never silently truncated.
          push(target, questionOrder[question.id] || 50, item.preserveTags ? tags : tags.slice(0, bundleLimit));
        });
      });

      const groups = getDetailGroups(question);
      groups.forEach((group) => {
        (state.details[question.id]?.[group.id] || []).forEach((detailId) => {
          const detail = group.options.find((item) => item.id === detailId);
          if (!detail) return;
          let target = group.section || sectionForQuestion[question.id] || "background";
          if (["mood", "background"].includes(target)) target = "background";
          if (["composition", "action"].includes(target)) target = "composition";
          if (["outfit", "accessory"].includes(target)) target = "outfit";
          const detailTags = Array.isArray(detail.tag) ? detail.tag : [detail.tag];
          push(target, detailOrder[group.id] || (questionOrder[question.id] || 50) + 1, detailTags);
        });
      });

      const customTarget = sectionFor(question);
      if (customTarget) {
        push(customTarget, (questionOrder[question.id] || 50) + 8, state.custom[question.id] || []);
      }
    });

    push("concept", 90, state.custom.__global || []);

    const sections = {};
    Object.entries(entries).forEach(([key, sectionEntries]) => {
      sections[key] = uniqueTags(
        sectionEntries
          .sort((a, b) => a.order - b.order)
          .flatMap((entry) => entry.tags)
          .filter((tag) => {
            const winner = explicitWinners.get(GUIDED.keyFor(tag));
            return !winner || (winner.section === key && winner.text === tag);
          }),
      );
    });

    applyEmphasis(sections);

    const qualityTags = state.quality ? DATA.novelai.autoQualityTags : [];
    const baseKeys = new Set(baseCharacterTags.map(stripWeight));
    const baseCharacters = sections.character.filter((tag) => baseKeys.has(stripWeight(tag)));
    const characterDetails = sections.character.filter((tag) => !baseKeys.has(stripWeight(tag)));
    const styleOrder = DATA.corpus?.primaryOrder || ["background", "composition", "outfit"];
    const inStyleOrder = styleOrder.flatMap((section) => sections[section] || []);
    const flatTags = uniqueTags([
      ...baseCharacters,
      ...inStyleOrder,
      ...sections.concept,
      ...characterDetails,
      ...qualityTags,
    ]);

    const sectionLabels = [
      ["캐릭터", sections.character],
      ["컨셉", sections.concept],
      ["배경", sections.background],
      ["구도", sections.composition],
      ["의상", sections.outfit],
    ];
    if (qualityTags.length) sectionLabels.push(["원본 스타일 외 품질 태그", qualityTags]);

    const sectioned = sectionLabels
      .filter(([, tags]) => tags.length)
      .map(([label, tags]) => `[ ${label} ]\n${tags.join(", ")},`)
      .join("\n\n");

    // The source corpus never used a standalone negative-prompt section.
    // Keep strict-style output empty unless the user explicitly writes UC.
    const uc = uniqueTags(splitTagInput(state.customUC)).join(", ");

    return {
      sections,
      flatTags,
      tagCount: logicalTagCount(flatTags),
      flat: flatTags.length ? `${flatTags.join(", ")},` : "",
      sectioned,
      negative: uc ? `${uc},` : "",
    };
  }

  function applyEmphasis(sections) {
    const weight = Number(state.emphasis);
    if (!weight) return;
    const selected = state.answers["core-emphasis"]?.[0] || "emphasis-none";
    let target = selected.replace("emphasis-", "");
    if (target === "none") return;
    if (target === "auto") {
      target = sections.concept.length > 0 ? "concept" : sections.outfit.length > 0 ? "outfit" : "background";
    }
    if (target === "composition") target = "composition";
    if (!sections[target]?.length) return;
    const baseCharacterTagSet = new Set(["1girl", "solo", "1boy", "2people", "adult woman", "adult man"]);
    let remaining = 2;
    sections[target] = sections[target].map((tag) => {
      if (!remaining || /^-?[0-9.]+::/.test(tag) || baseCharacterTagSet.has(stripWeight(tag))) return tag;
      remaining -= 1;
      return `${weight}::${tag}::`;
    });
  }

  function buildWarnings(result) {
    const selected = allSelectedIds();
    const warnings = [];
    const handProp = Boolean(state.answers["hand-prop"]?.length);
    const gesture = state.answers["hand-action"]?.[0];
    const gestureOption = getOption(getQuestion("hand-action"), gesture);

    if (handProp && gestureOption && heldHandDemand() + Number(gestureOption.handDemand || 0) > 2) {
      warnings.push("손소품과 제스처의 손 점유가 겹칩니다. 충돌하는 카드는 자동으로 비활성화했어요.");
    }
    if (["close-up", "portrait", "upper-body"].some((id) => selected.has(id)) && (state.answers.footwear?.length || state.answers.legwear?.length)) {
      warnings.push("상반신보다 가까운 프레이밍에서는 레그웨어·신발 디테일이 거의 보이지 않을 수 있어요. 선택은 보존했습니다.");
    }
    if (selected.has("palette-mono") && ["hair-gradient", "hair-two-tone", "palette-neon"].some((id) => selected.has(id))) {
      warnings.push("모노크롬과 다색 지정이 함께 있어요. 의도한 포인트 컬러가 아니라면 하나를 조정해보세요.");
    }
    if (state.quality && result.flatTags.some((tag) => /text|typography|lettering/i.test(tag) && stripWeight(tag) !== "no text")) {
      warnings.push("텍스트 태그와 V4.5 자동 품질 태그의 ‘no text’가 충돌할 수 있어요.");
    }
    allQuestions().forEach((question) => {
      (state.answers[question.id] || []).forEach((optionId) => {
        const item = getOption(question, optionId);
        const conflict = (item?.conflicts || []).find((id) => selected.has(id));
        if (conflict) warnings.push(`${item.label} 선택과 다른 외형 선택이 충돌합니다. 두 태그는 그대로 보존했으니 의도를 확인해주세요.`);
      });
    });
    if (result.tagCount > 55) warnings.push(`${result.tagCount}개의 고밀도 프롬프트예요. 의도하지 않은 변형이나 중복된 의상·자세가 함께 선택되지 않았는지 확인해주세요.`);
    return [...new Set(warnings)];
  }

  function renderPrompt() {
    const result = gatherPrompt();
    const output = state.outputTab === "sectioned" ? result.sectioned : state.outputTab === "negative" ? result.negative : result.flat;
    el.promptOutput.textContent = output;
    el.emptyPrompt.style.display = result.tagCount === 0 ? "grid" : "none";
    const countText = `${result.tagCount} tags`;
    el.tagCount.textContent = countText;
    el.mobileTagCount.textContent = countText;

    const warnings = buildWarnings(result);
    el.warningList.innerHTML = warnings.length
      ? warnings.map((warning) => `<div class="warning-item"><span aria-hidden="true">!</span><span>${escapeHtml(warning)}</span></div>`).join("")
      : '<div class="warning-item ok"><span aria-hidden="true">✓</span><span>현재 선택에서 뚜렷한 충돌을 찾지 못했어요.</span></div>';
  }

  function renderDraftName() {
    const idea = state.idea.trim();
    el.draftName.textContent = idea ? idea.slice(0, 26) + (idea.length > 26 ? "…" : "") : "이름 없는 상상";
  }

  function renderAll() {
    sanitizeState();
    renderIntentPicker();
    renderStageNav();
    renderStage();
    renderPrompt();
    renderDraftName();
    el.ideaInput.value = state.idea;
    el.emphasisSelect.value = state.emphasis;
    el.emphasisSelect.disabled = (state.answers["core-emphasis"]?.[0] || "emphasis-none") === "emphasis-none";
    el.qualityToggle.checked = state.quality;
    if (el.corpusDna) {
      const prompts = Number(DATA.corpus?.prompts || 0).toLocaleString("ko-KR");
      el.corpusDna.textContent = prompts ? `${prompts}개 내 스타일 프롬프트 분석` : "내 스타일 기반";
    }
    document.querySelectorAll("[data-output-tab]").forEach((button) => {
      const selected = button.dataset.outputTab === state.outputTab;
      button.setAttribute("aria-selected", String(selected));
      button.setAttribute("tabindex", selected ? "0" : "-1");
      if (selected) el.promptOutput.setAttribute("aria-labelledby", button.id);
    });
    if (needsMigrationSave) { needsMigrationSave = false; persist(); }
  }

  function ideaWordMatches(text, rawWord) {
    const word = String(rawWord || "").trim().toLowerCase();
    if (!word) return false;
    if ([...word].length !== 1 || !/[가-힣]/.test(word)) return text.includes(word);
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const particle = "(?:은|는|이|가|을|를|과|와|도|만|의|에|에서|으로|로)?";
    return new RegExp(`(^|[\\s,.;:!?()])${escaped}${particle}(?=$|[\\s,.;:!?()])`).test(text);
  }

  function analyzeIdea() {
    const text = el.ideaInput.value.trim();
    state.idea = text;
    if (!text) {
      showToast("먼저 떠오른 장면을 한 문장으로 적어주세요.");
      return;
    }
    const lower = text.toLowerCase();
    let applied = 0;
    DATA.ideaRules.forEach((rule) => {
      if (!rule.words.some((word) => ideaWordMatches(lower, word))) return;
      Object.entries(rule.answers).forEach(([questionId, optionId]) => {
        const question = getQuestion(questionId);
        if (!question) return;
        if (question.multi) {
          const current = state.answers[questionId] || [];
          if (!current.includes(optionId) && current.length < (question.max || 99)) {
            state.answers[questionId] = [...current, optionId];
            applied += 1;
          }
        } else if (!state.answers[questionId]?.length) {
          state.answers[questionId] = [optionId];
          applied += 1;
        }
      });
    });

    if (!state.intent) {
      if (/화보|패션|editorial|fashion/.test(lower)) state.intent = "intent-fashion";
      else if (/액션|전투|달리|action|fight/.test(lower)) state.intent = "intent-action";
      else if (/전신|디자인|design/.test(lower)) state.intent = "intent-full-design";
      else if (/초상|얼굴|portrait/.test(lower)) state.intent = "intent-portrait";
      else state.intent = "intent-story";
      applied += 1;
    }

    persist();
    renderAll();
    el.ideaHint.textContent = applied ? `${applied}개 시작점을 찾았어요. 모든 선택은 바꿀 수 있어요.` : "특정 키워드는 못 찾았어요. 직접 고르면서 시작해도 괜찮아요.";
    showToast(applied ? `${applied}개 방향을 초안에 반영했어요.` : "문장을 저장했어요. 카드를 직접 골라주세요.");
  }

  function libraryCategories(questionId) {
    const target = sectionFor(getQuestion(questionId));
    if (target === "background" || target === "concept") return ["background", "concept", "mood", "other"];
    if (target === "outfit") return ["outfit", "accessory"];
    if (target === "composition") return ["composition", "action", "expression", "accessory"];
    if (target === "character") return ["character", "appearance", "other"];
    return ["all"];
  }

  function curatedLibrary() {
    const rows = [];
    allQuestions().forEach((question) => {
      question.options?.forEach((item) => {
        Object.entries(item.tags || {}).forEach(([category, tags]) => {
          if (category === "meta") return;
          tags.forEach((tag) => rows.push({ tag, frequency: 0, category, source: item.source }));
        });
      });
      getDetailGroups(question).forEach((group) => {
        group.options.forEach((item) => {
          const tags = Array.isArray(item.tag) ? item.tag : [item.tag];
          tags.forEach((tag) => rows.push({ tag, frequency: 0, category: group.section, source: item.source || "curated" }));
        });
      });
    });
    return rows;
  }

  function combinedLibrary() {
    if (combinedLibraryCache) return combinedLibraryCache;
    const map = new Map();
    [...corpusItems(), ...curatedLibrary(), ...novelaiCatalogItems()].forEach((item) => {
      const tag = cleanTag(item.tag);
      if (!tag || !isSafeCustomTag(tag)) return;
      const key = stripWeight(tag);
      const existing = map.get(key);
      if (!existing || (item.frequency || 0) > (existing.frequency || 0)) map.set(key, { ...item, tag });
    });
    combinedLibraryCache = [...map.values()].sort(
      (a, b) => (b.frequency || 0) - (a.frequency || 0) || a.tag.localeCompare(b.tag),
    );
    return combinedLibraryCache;
  }

  function openTagSearch(questionId) {
    const question = getQuestion(questionId);
    activeDialog = { mode: "search", questionId, query: "" };
    el.detailEyebrow.textContent = "LONG-TAIL LIBRARY";
    el.detailTitle.textContent = `${question.title} · 전체 검색`;
    renderSearchResults();
    showDialog(el.detailDialog);
    window.setTimeout(() => document.querySelector("#corpus-search-input")?.focus(), 50);
  }

  function renderSearchResults() {
    if (activeDialog?.mode !== "search") return;
    const questionId = activeDialog.questionId;
    const query = (activeDialog.query || "").trim().toLowerCase();
    const wanted = libraryCategories(questionId);
    const all = combinedLibrary();
    const scoped = all.filter((item) => {
      const matchesText = !query || item.tag.toLowerCase().includes(query);
      const matchesCategory = query || wanted.includes("all") || wanted.includes(item.category);
      return matchesText && matchesCategory;
    });
    const visible = scoped.slice(0, 120);
    const selected = new Set(state.custom[questionId] || []);
    el.detailContent.innerHTML = `
      <div class="search-panel">
        <div class="search-input-wrap">
          <input id="corpus-search-input" value="${escapeHtml(activeDialog.query || "")}" placeholder="영문 태그 검색 · 예: lace, ribbon, dynamic…" aria-label="전체 태그 검색" />
          <button class="button ghost" type="button" data-action="add-search-text">그대로 추가</button>
        </div>
        <div class="search-meta"><span>${scoped.length.toLocaleString("ko-KR")}개 결과 · 최대 120개 표시</span><span>내 코퍼스 + NovelAI 확인 태그</span></div>
        <div class="tag-search-results">
          ${
            visible.length
              ? visible
                  .map(
                    (item) => `<button class="tag-result ${selected.has(item.tag) ? "selected" : ""}" type="button" data-search-tag="${escapeHtml(item.tag)}" aria-pressed="${selected.has(item.tag)}"><code>${escapeHtml(item.tag)}</code><small>${item.frequency ? `${item.frequency}×` : ["official", "novelai"].includes(item.source) ? "NAI" : "+"}</small></button>`,
                  )
                  .join("")
              : '<div class="library-empty">일치하는 태그가 없어요. 검색어를 그대로 직접 태그로 추가할 수 있습니다.</div>'
          }
        </div>
      </div>`;
  }

  function renderDetailDialog(questionId) {
    const question = getQuestion(questionId);
    activeDialog = { mode: "details", questionId };
    el.detailEyebrow.textContent = "DEEP CONTROL";
    el.detailTitle.textContent = `${question.title} · 세부 조정`;
    const groups = getDetailGroups(question);
    el.detailContent.innerHTML = groups
      .map((group) => {
        const selected = new Set(state.details[questionId]?.[group.id] || []);
        return `
          <section class="detail-section">
            <h3>${escapeHtml(group.title)} <span class="selection-limit">최대 ${group.max || 1}개</span></h3>
            <div class="detail-chip-grid">
              ${group.options
                .map(
                  (item) => `<button class="detail-chip ${selected.has(item.id) ? "selected" : ""}" type="button" data-detail-question="${questionId}" data-detail-group="${group.id}" data-detail-option="${item.id}" aria-pressed="${selected.has(item.id)}">${renderDetailThumbnail(item)}<span class="detail-chip-copy"><span class="detail-chip-label">${escapeHtml(item.label)}</span><small>${escapeHtml(Array.isArray(item.tag) ? item.tag.join(", ") : item.tag)}</small>${item.source === "corpus" ? '<span class="source-badge corpus detail-source">내 프롬프트</span>' : ""}</span></button>`,
                )
                .join("")}
            </div>
          </section>`;
      })
      .join("");
    showDialog(el.detailDialog);
  }

  function showDialog(dialog) {
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function closeDialog(dialog) {
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  function showToast(message) {
    el.toast.textContent = message;
    el.toast.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => el.toast.classList.remove("show"), 2200);
  }

  async function copyCurrentOutput() {
    const result = gatherPrompt();
    const text = state.outputTab === "sectioned" ? result.sectioned : state.outputTab === "negative" ? result.negative : result.flat;
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    showToast(state.outputTab === "negative" ? "Undesired Content를 복사했어요." : "NovelAI용 프롬프트를 복사했어요.");
  }

  function getLibrary() {
    return readMigratedStorage(LIBRARY_KEY, LEGACY_LIBRARY_KEYS, Array.isArray) || [];
  }

  function saveToLibrary() {
    const library = getLibrary();
    const result = gatherPrompt();
    const title = state.idea.trim().slice(0, 42) || `상상 ${new Date().toLocaleDateString("ko-KR")}`;
    library.unshift({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      createdAt: new Date().toISOString(),
      tagCount: result.tagCount,
      state: JSON.parse(JSON.stringify(state)),
    });
    try {
      localStorage.setItem(LIBRARY_KEY, JSON.stringify(library.slice(0, 30)));
      showToast("이 기기의 보관함에 저장했어요.");
    } catch (_) {
      showToast("보관함에 저장하지 못했어요. 브라우저 저장 공간을 확인해주세요.");
    }
  }

  function renderLibrary() {
    const library = getLibrary();
    el.libraryList.innerHTML = library.length
      ? library
          .map(
            (item) => `<article class="library-item"><div><strong>${escapeHtml(item.title)}</strong><small>${new Date(item.createdAt).toLocaleString("ko-KR")} · ${item.tagCount} tags</small></div><div class="library-item-actions"><button class="button ghost small" type="button" data-load-draft="${item.id}">불러오기</button><button class="button ghost small" type="button" data-delete-draft="${item.id}">삭제</button></div></article>`,
          )
          .join("")
      : '<div class="library-empty">아직 저장한 상상이 없어요.<br />완성 프롬프트 아래의 ‘보관함에 저장’을 눌러보세요.</div>';
  }

  function goToStage(index) {
    state.currentStage = Math.max(0, Math.min(DATA.stages.length - 1, index));
    persist();
    renderAll();
    window.scrollTo({ top: 0, behavior: "smooth" });
    el.stageContent.focus({ preventScroll: true });
  }

  el.stageNav.addEventListener("click", (event) => {
    const button = event.target.closest("[data-stage]");
    if (button) goToStage(Number(button.dataset.stage));
  });

  el.intentPicker.addEventListener("click", (event) => {
    const button = event.target.closest("[data-intent]");
    if (!button) return;
    state.intent = state.intent === button.dataset.intent ? "" : button.dataset.intent;
    persist();
    renderAll();
  });

  el.stageContent.addEventListener("click", (event) => {
    const open = event.target.closest("[data-hierarchy-open]");
    if (open) {
      const questionId = open.dataset.hierarchyOpen;
      hierarchyView(questionId).open = !hierarchyView(questionId).open;
      refreshVocabulary(questionId, `[data-hierarchy-open="${questionId}"]`);
      return;
    }
    const branch = event.target.closest("[data-hierarchy-node]");
    if (branch) {
      const node = HIERARCHY.byId.get(branch.dataset.hierarchyNode);
      Object.assign(hierarchyView(node.questionId), { nodeId: node.id, query: "", page: 0, selectedOnly: false });
      refreshVocabulary(node.questionId, `[data-hierarchy-node="${node.id}"]`);
      return;
    }
    const reveal = event.target.closest("[data-hierarchy-reveal]");
    if (reveal) {
      const path = HIERARCHY.itemPaths.get(reveal.dataset.hierarchyReveal);
      const node = HIERARCHY.byId.get(path.at(-1));
      const itemIndex = node.items.findIndex((item) => item.id === reveal.dataset.hierarchyReveal);
      Object.assign(hierarchyView(node.questionId), { open: true, nodeId: node.id, query: "", selectedOnly: false, page: Math.floor(itemIndex / 12) });
      refreshVocabulary(node.questionId, `[data-hierarchy-item="${reveal.dataset.hierarchyReveal}"]`);
      return;
    }
    const selected = event.target.closest("[data-hierarchy-selected]");
    if (selected) {
      const questionId = selected.dataset.hierarchySelected;
      Object.assign(hierarchyView(questionId), { open: true, query: "", page: 0, selectedOnly: true });
      refreshVocabulary(questionId, `[data-hierarchy-selected="${questionId}"]`);
      return;
    }
    const item = event.target.closest("[data-hierarchy-item]");
    const remove = event.target.closest("[data-hierarchy-remove]");
    if (item || remove) {
      const id = item?.dataset.hierarchyItem || remove.dataset.hierarchyRemove;
      if (remove || isVocabularySelected(id)) delete state.guided.selections[id];
      else state.guided.selections[id] = null;
      updateVocabularySelection(id);
      return;
    }
    const page = event.target.closest("[data-hierarchy-page]");
    if (page) {
      const questionId = page.dataset.hierarchyQuestion;
      hierarchyView(questionId).page += Number(page.dataset.hierarchyPage);
      refreshVocabulary(questionId, `[data-hierarchy-page="${page.dataset.hierarchyPage}"][data-hierarchy-question="${questionId}"]`);
      return;
    }
    const optionButton = event.target.closest("[data-option][data-question]");
    if (optionButton) {
      selectOption(optionButton.dataset.question, optionButton.dataset.option);
      return;
    }
    const action = event.target.closest("[data-action]");
    if (!action) return;
    const questionId = action.dataset.question;
    if (action.dataset.action === "recommend") chooseRecommended(questionId);
    if (action.dataset.action === "add-custom") {
      const input = el.stageContent.querySelector(`[data-custom-input="${CSS.escape(questionId)}"]`);
      addCustomTag(questionId, input?.value);
    }
    if (action.dataset.action === "remove-custom") removeCustomTag(questionId, action.dataset.tag);
    if (action.dataset.action === "search-tags") openTagSearch(questionId);
    if (action.dataset.action === "open-details") renderDetailDialog(questionId);
  });

  el.stageContent.addEventListener("keydown", (event) => {
    const input = event.target.closest("[data-custom-input]");
    if (input && event.key === "Enter") {
      event.preventDefault();
      addCustomTag(input.dataset.customInput, input.value);
    }
  });

  el.stageContent.addEventListener("input", (event) => {
    if (event.target.matches("[data-hierarchy-search]")) {
      if (!event.isComposing) updateVocabularyQuery(event.target);
      return;
    }
    if (event.target.id === "global-custom-tags") {
      state.custom.__global = uniqueTags(splitTagInput(event.target.value).filter(isSafeCustomTag));
      if (!state.custom.__global.length) delete state.custom.__global;
      persist();
      renderPrompt();
    }
    if (event.target.id === "custom-uc") {
      state.customUC = event.target.value;
      persist();
      renderPrompt();
    }
  });

  el.stageContent.addEventListener("change", (event) => {
    if (event.target.matches("[data-hierarchy-weight]")) {
      const id = event.target.dataset.hierarchyWeight;
      state.guided.selections[id] = event.target.value === "" ? null : event.target.value;
      updateVocabularySelection(id);
      return;
    }
    if (event.target.matches("[data-hierarchy-selected-only]")) {
      const questionId = event.target.dataset.hierarchySelectedOnly;
      Object.assign(hierarchyView(questionId), { selectedOnly: event.target.checked, page: 0 });
      refreshVocabulary(questionId, `[data-hierarchy-selected-only="${questionId}"]`);
      return;
    }
    if (event.target.id === "guided-use-base") {
      state.guided.useBase = event.target.checked;
      persist(); renderPrompt(); return;
    }

  });

  el.stageContent.addEventListener("compositionend", (event) => {
    if (event.target.matches("[data-hierarchy-search]")) updateVocabularyQuery(event.target);
  });

  el.detailContent.addEventListener("click", (event) => {
    const detail = event.target.closest("[data-detail-option]");
    if (detail) {
      toggleDetail(detail.dataset.detailQuestion, detail.dataset.detailGroup, detail.dataset.detailOption);
      return;
    }
    const result = event.target.closest("[data-search-tag]");
    if (result && activeDialog?.mode === "search") {
      const questionId = activeDialog.questionId;
      const tag = result.dataset.searchTag;
      const current = state.custom[questionId] || [];
      state.custom[questionId] = current.includes(tag) ? current.filter((item) => item !== tag) : uniqueTags([...current, tag]);
      if (!state.custom[questionId].length) delete state.custom[questionId];
      persist();
      renderAll();
      renderSearchResults();
      return;
    }
    const action = event.target.closest("[data-action='add-search-text']");
    if (action && activeDialog?.mode === "search") {
      const input = el.detailContent.querySelector("#corpus-search-input");
      addCustomTag(activeDialog.questionId, input?.value);
      renderSearchResults();
    }
  });

  el.detailContent.addEventListener("input", (event) => {
    if (event.target.id !== "corpus-search-input" || activeDialog?.mode !== "search") return;
    const cursor = event.target.selectionStart;
    activeDialog.query = event.target.value;
    renderSearchResults();
    const next = el.detailContent.querySelector("#corpus-search-input");
    next?.focus();
    next?.setSelectionRange(cursor, cursor);
  });

  el.prevStage.addEventListener("click", () => goToStage(state.currentStage - 1));
  el.nextStage.addEventListener("click", () => {
    if (state.currentStage === DATA.stages.length - 1) copyCurrentOutput();
    else goToStage(state.currentStage + 1);
  });
  el.analyzeIdea.addEventListener("click", analyzeIdea);
  el.ideaInput.addEventListener("input", () => {
    state.idea = el.ideaInput.value;
    persist();
    renderDraftName();
  });
  el.ideaInput.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") analyzeIdea();
  });

  document.querySelectorAll("[data-output-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.outputTab = button.dataset.outputTab;
      persist();
      renderAll();
    });
  });
  el.promptTabs.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const tabs = [...el.promptTabs.querySelectorAll("[role='tab']")];
    const currentIndex = Math.max(0, tabs.indexOf(document.activeElement));
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    event.preventDefault();
    tabs[nextIndex].focus();
    tabs[nextIndex].click();
  });
  el.emphasisSelect.addEventListener("change", () => {
    state.emphasis = el.emphasisSelect.value;
    persist();
    renderPrompt();
  });
  el.qualityToggle.addEventListener("change", () => {
    state.quality = el.qualityToggle.checked;
    persist();
    renderPrompt();
  });
  el.copyPrompt.addEventListener("click", copyCurrentOutput);
  el.saveDraft.addEventListener("click", saveToLibrary);

  el.libraryButton.addEventListener("click", () => {
    renderLibrary();
    showDialog(el.libraryDialog);
  });
  el.closeLibrary.addEventListener("click", () => closeDialog(el.libraryDialog));
  el.closeDetail.addEventListener("click", () => closeDialog(el.detailDialog));

  el.libraryList.addEventListener("click", (event) => {
    const loadButton = event.target.closest("[data-load-draft]");
    const deleteButton = event.target.closest("[data-delete-draft]");
    const library = getLibrary();
    if (loadButton) {
      const item = library.find((draft) => draft.id === loadButton.dataset.loadDraft);
      if (item) {
        const defaults = defaultState();
        state = {
          ...defaults,
          ...(item.state || {}),
          version: DATA.version,
          currentStage: migratedStage(item.state || {}),
          answers: { ...defaults.answers, ...(item.state?.answers || {}) },
          custom: { ...(item.state?.custom || {}) },
          details: { ...(item.state?.details || {}) },
        };
        sanitizeState();
        persist();
        renderAll();
        closeDialog(el.libraryDialog);
        showToast("저장한 상상을 불러왔어요.");
      }
    }
    if (deleteButton) {
      if (!window.confirm("이 프리셋을 보관함에서 삭제할까요? 이 작업은 되돌릴 수 없습니다.")) return;
      const next = library.filter((draft) => draft.id !== deleteButton.dataset.deleteDraft);
      try {
        localStorage.setItem(LIBRARY_KEY, JSON.stringify(next));
        renderLibrary();
      } catch (_) {
        showToast("프리셋을 삭제하지 못했어요. 브라우저 저장 공간을 확인해주세요.");
      }
    }
  });

  el.resetButton.addEventListener("click", () => {
    if (!window.confirm("현재 편집 중인 선택을 모두 비우고 새로 시작할까요? 보관함의 프리셋은 남습니다.")) return;
    state = defaultState();
    persist();
    renderAll();
    showToast("새 상상을 시작할 준비가 됐어요.");
  });

  el.mobilePromptButton.addEventListener("click", () => {
    const open = !el.promptDock.classList.contains("mobile-open");
    el.promptDock.classList.toggle("mobile-open", open);
    el.mobilePromptButton.setAttribute("aria-expanded", String(open));
  });

  el.libraryDialog.addEventListener("click", (event) => {
    if (event.target === el.libraryDialog) closeDialog(el.libraryDialog);
  });
  el.detailDialog.addEventListener("click", (event) => {
    if (event.target === el.detailDialog) closeDialog(el.detailDialog);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !el.promptDock.classList.contains("mobile-open")) return;
    el.promptDock.classList.remove("mobile-open");
    el.mobilePromptButton.setAttribute("aria-expanded", "false");
    el.mobilePromptButton.focus();
  });

  document.addEventListener(
    "error",
    (event) => {
      if (event.target instanceof HTMLImageElement && event.target.matches("[data-reference-image]")) {
        event.target.hidden = true;
      }
    },
    true,
  );

  renderAll();
})();
