import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createContext, Script } from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const site = join(root, "site");
const errors = [];
const notes = [];

function fail(message) {
  errors.push(message);
}

function walk(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function display(path) {
  return relative(root, path).replaceAll("\\", "/");
}

const required = [
  "index.html",
  "styles.css",
  "data.js",
  "corpus-library.js",
  "novelai-tag-catalog.js",
  "freedom-data.js",
  "corpus-studio.js",
  "guided-options.js",
  "guided-corpus.js",
  "guided-descriptions-world.js",
  "guided-descriptions-outfit.js",
  "guided-descriptions-action.js",
  "guided-hierarchy.js",
  "atlas-crops.js",
  "app.js",
  "_headers",
];

for (const name of required) {
  const path = join(site, name);
  if (!existsSync(path) || !statSync(path).isFile()) {
    fail(`필수 정적 파일 누락: site/${name}`);
  }
}

const forbiddenEntrypoints = [
  join(root, "functions"),
  join(root, "worker"),
  join(root, "_worker.js"),
  join(site, "functions"),
  join(site, "_worker.js"),
];

for (const path of forbiddenEntrypoints) {
  if (existsSync(path)) fail(`Worker/Functions 진입점이 존재함: ${display(path)}`);
}

const retiredAssetTargets = [
  join(site, "assets", "reference"),
  join(site, "assets", "generated"),
  join(root, "tools", "reference-assets.json"),
];

for (const path of retiredAssetTargets) {
  if (existsSync(path)) fail(`은퇴한 이미지 자산이 남아 있음: ${display(path)}`);
}

const staticFiles = walk(site);
const textExtensions = new Set([".html", ".css", ".js", ".json", ".txt", ""]);
const textFiles = staticFiles.filter((path) => textExtensions.has(extname(path).toLowerCase()));

for (const path of textFiles) {
  const source = readFileSync(path, "utf8");

  if (/https?:\/\//i.test(source)) {
    fail(`외부 URL이 포함됨: ${display(path)}`);
  }

  if (/addEventListener\s*\(\s*["']fetch["']|export\s+default\s*\{\s*(?:async\s+)?fetch\s*\(/s.test(source)) {
    fail(`Worker fetch 핸들러로 보이는 코드가 포함됨: ${display(path)}`);
  }
}

const indexPath = join(site, "index.html");
if (existsSync(indexPath)) {
  const html = readFileSync(indexPath, "utf8");
  const dependencyPattern = /<(?:script|link)\b[^>]*(?:src|href)=["']([^"']+)["']/gi;

  for (const match of html.matchAll(dependencyPattern)) {
    const reference = match[1].split(/[?#]/, 1)[0];
    if (!reference || /^(?:https?:|data:|#)/i.test(reference)) continue;
    const target = resolve(site, reference.replace(/^\//, ""));
    if (!target.startsWith(site) || !existsSync(target)) {
      fail(`index.html 로컬 의존성 누락: ${reference}`);
    }
  }
}

// Load the data extensions exactly in the browser's script order. This catches
// broken stage IDs, dynamic-pack wiring, and malformed local catalogs that a
// text-only static check cannot see.
const renderedOptionImageReferences = new Set();
let thumbnailSelectionCount = 0;

function collectRenderedOptionImages(options) {
  for (const option of options || []) {
    if (typeof option?.image === "string" && option.image && !option.noVisual) {
      renderedOptionImageReferences.add(option.image);
    }
  }
}

function collectQuestionOptionImages(question) {
  collectRenderedOptionImages(question?.options);
  for (const group of question?.detailGroups || []) collectRenderedOptionImages(group?.options);
}

// Main-question and dynamic-pack choices render through renderOptionCard().
// Deep-control chips render the same compact crop, so every selectable item
// must point to a valid, non-duplicated 4×3 atlas cell within its own group.
function validateOptionCardThumbnails(options, label) {
  const seenCrops = new Map();
  for (const option of options || []) {
    if (!option?.image || option.noVisual) {
      fail(`${label}/${option?.id || "unknown"}에 카드 이미지가 없음`);
      continue;
    }
    const sprite = option.sprite;
    const isFourByThree = Number(sprite?.columns) === 4 && Number(sprite?.rows) === 3;
    const index = Number(sprite?.index);
    if (!isFourByThree || !Number.isInteger(index) || index < 0 || index >= 12) {
      fail(`${label}/${option.id}의 카드 스프라이트가 유효한 4×3 타일이 아님`);
      continue;
    }
    const cropKey = `${option.image}|${sprite.columns}|${sprite.rows}|${index}`;
    const previous = seenCrops.get(cropKey);
    if (previous) fail(`${label}에서 ${previous}와 ${option.id}가 같은 카드 타일을 공유함`);
    else seenCrops.set(cropKey, option.id);
    thumbnailSelectionCount += 1;
  }
}

function validateVisualReference(reference, label) {
  const normalized = reference.replaceAll("\\", "/");
  const visualGuideRoot = join(site, "assets", "visual-guides");
  const target = resolve(site, normalized);

  if (!normalized.startsWith("assets/visual-guides/")) {
    fail(`${label}가 visual-guides 밖을 참조함: ${reference}`);
    return;
  }
  if (target !== visualGuideRoot && !target.startsWith(`${visualGuideRoot}${sep}`)) {
    fail(`${label} 경로가 배포 디렉터리 밖을 가리킴: ${reference}`);
    return;
  }
  if (!existsSync(target) || !statSync(target).isFile()) {
    fail(`${label} 누락: site/${normalized}`);
  }
}

try {
  const sandbox = createContext({ window: {} });
  for (const name of ["data.js", "corpus-library.js", "novelai-tag-catalog.js", "freedom-data.js", "corpus-studio.js", "guided-options.js", "guided-corpus.js", "guided-descriptions-world.js", "guided-descriptions-outfit.js", "guided-descriptions-action.js", "guided-hierarchy.js", "atlas-crops.js"]) {
    new Script(readFileSync(join(site, name), "utf8"), { filename: `site/${name}` }).runInContext(sandbox);
  }
  const data = sandbox.window.PM_DATA;
  const corpus = sandbox.window.PM_CORPUS_LIBRARY;
  const novelaiCatalog = sandbox.window.PM_NOVELAI_TAG_CATALOG;
  const atlasCrops = sandbox.window.PM_ATLAS_CROPS;
  for (const node of sandbox.window.PM_GUIDED_HIERARCHY.byId.values()) {
    if (!node.imageKey) continue;
    const sheet = node.imageKey.sheet === "world" ? "appearance-world" : "detail-action";
    const reference = `assets/visual-guides/options/thumb-hierarchy-${sheet}-v1.png`;
    renderedOptionImageReferences.add(reference);
    validateVisualReference(reference, `세부 분류 ${node.id}`);
    if (!atlasCrops[reference.split("/").pop()]?.cells?.[node.imageKey.index]) fail(`세부 분류 실측 크롭 누락: ${node.id}`);
  }
  for (const [filename, crop] of Object.entries(atlasCrops || {})) {
    const path = join(site, "assets", "visual-guides", "options", filename);
    const png = readFileSync(path);
    if (png.readUInt32BE(16) !== crop.width || png.readUInt32BE(20) !== crop.height) fail(`아틀라스 실제 크기 불일치: ${filename}`);
    if (!(crop.inset >= 0.04 && crop.inset <= 0.1)) fail(`아틀라스 경계 여백이 유효하지 않음: ${filename}`);
    if (crop.cells) {
      if (crop.cells.length !== 12) fail(`아틀라스 개별 경계가 12개가 아님: ${filename}`);
      crop.cells.forEach((cell) => {
        if (!(cell.x >= 0 && cell.y >= 0 && cell.width > 0 && cell.height > 0 && cell.x + cell.width <= crop.width && cell.y + cell.height <= crop.height)) fail(`아틀라스 개별 경계가 이미지 밖을 참조함: ${filename}`);
        if ([cell.anchorX ?? .5, cell.anchorY ?? .5].some((value) => value < 0 || value > 1)) fail(`아틀라스 정렬 기준이 유효하지 않음: ${filename}`);
      });
    }
  }
  if (!Object.keys(atlasCrops || {}).length) fail("아틀라스 크기·여백 정보가 없음");
  const question = (stageId, questionId) => data?.stages?.find((stage) => stage.id === stageId)?.questions.find((item) => item.id === questionId);

  if (!data?.stages?.length) fail("브라우저 데이터가 로드되지 않음");
  if (!corpus?.items?.length || /References[\\/]/i.test(JSON.stringify(corpus.source || {}))) {
    fail("배포 코퍼스가 비어 있거나 로컬 References 경로를 포함함");
  }
  if (!novelaiCatalog?.items?.length) fail("NovelAI 태그 카탈로그가 로드되지 않음");
  if (question("scene", "content-mode") || question("scene", "adult-confirmation")) {
    fail("은퇴한 콘텐츠 모드/확인 질문이 아직 장면 단계에 남아 있음");
  }
  if (!question("scene", "mature-romance-tone") || !question("outfit", "mature-wardrobe-state")) {
    fail("기본 로맨스 또는 의상 분위기 질문이 누락됨");
  }

  const sceneCast = question("scene", "scene-cast");
  if (sceneCast?.multi || sceneCast?.max > 1) fail("장면 인원 선택은 단일 선택이어야 함");
  if (!sceneCast?.options?.some((item) => item.id === "cast-solo") || !sceneCast?.options?.some((item) => item.id === "cast-partner")) {
    fail("장면 인원 선택에 혼자/둘이 선택지가 모두 없음");
  }

  for (const questionId of ["partner-archetype", "partner-action", "mature-romance-tone"]) {
    const sceneQuestion = question("scene", questionId);
    const castCondition = sceneQuestion?.visibleWhen?.["scene-cast"];
    if (!sceneQuestion || !Array.isArray(castCondition) || !castCondition.includes("cast-partner")) {
      fail(`${questionId}는 둘이서 장면일 때만 보여야 함`);
    }
  }
  const soloActivity = question("scene", "solo-scene-activity");
  if (!soloActivity?.visibleWhen?.["scene-cast"]?.includes("cast-solo")) {
    fail("여성 단독 장면 전용 행동 질문이 없음");
  }
  const partnerGaze = question("camera", "gaze")?.options?.find((item) => item.id === "gaze-partner");
  if (!partnerGaze?.visibleWhen?.["scene-cast"]?.includes("cast-partner")) {
    fail("파트너를 보는 시선은 둘이서 장면일 때만 보여야 함");
  }

  const outfitDetail = question("outfit", "outfit-subtype-detail");
  const outfitDetailGroups = [
    ...(outfitDetail?.detailGroups || []),
    ...(data?.detailPacks?.["outfit-subtype-detail"] || []),
  ];
  if (!outfitDetailGroups.length || !outfitDetailGroups.every((group) => (group?.options?.length || 0) > 0)) {
    fail("복장 세부 질문에 채워진 세부 조절 그룹이 없음");
  }

  // The archetype source grid has an extra fox-girl cell after the cat-girl
  // cell. Because this question groups them into one animal-girl choice, the
  // remaining options must explicitly skip that cell instead of using their
  // array position as the crop index.
  const archetypeTiles = {
    human: 0,
    "animal-girl": 1,
    elf: 3,
    angel: 4,
    demon: 5,
    vampire: 6,
    fairy: 7,
    android: 8,
    doll: 9,
    "dragon-girl": 10,
  };
  const archetypeOptions = question("character", "character-archetype")?.options || [];
  for (const [id, expectedTile] of Object.entries(archetypeTiles)) {
    const option = archetypeOptions.find((item) => item.id === id);
    if (option?.image !== "assets/visual-guides/options/thumb-character-archetypes-v2.png" || option?.sprite?.index !== expectedTile) {
      fail(`캐릭터 종족 카드 ${id}의 아틀라스 타일이 ${expectedTile}번으로 고정되지 않음`);
    }
  }

  // High-signal visual controls use audited, semantic tile maps.  Keep these
  // assertions explicit so a generic sequential fallback cannot quietly
  // reconnect a label to an unrelated portrait or decorative filler cell.
  const validateExactAtlas = (options, label, image, ids) => {
    ids.forEach((id, index) => {
      const option = (options || []).find((item) => item.id === id);
      if (option?.image !== image || option?.sprite?.index !== index) {
        fail(`${label}/${id}의 카드 타일이 ${index}번으로 고정되지 않음`);
      }
    });
  };
  validateExactAtlas(question("character", "hair-length")?.options, "헤어 길이", "assets/visual-guides/options/thumb-hair-lengths-v3.png", [
    "hair-very-short", "hair-short", "hair-chin", "hair-medium", "hair-shoulder", "hair-long", "hair-very-long", "hair-absurd",
  ]);
  Object.entries(data.dynamicPacks?.["hair-style"] || {}).forEach(([styleId, options]) => {
    validateExactAtlas(options, `헤어 결·레이어/${styleId}`, "assets/visual-guides/options/thumb-hair-style-details-v2.png", options.map((item) => item.id));
  });
  validateExactAtlas(question("concept", "reference-style")?.options, "참조 그림체", "assets/visual-guides/options/thumb-concept-style-v3.png", [
    "style-nyankat-core", "style-sweet", "style-lace", "style-magic", "style-gothic", "style-retro", "style-summer", "style-minimal",
  ]);
  validateExactAtlas(data.outfitPacks?.["wardrobe-gothic"], "고딕 의상", "assets/visual-guides/options/thumb-outfit-gothic-v3.png", [
    "gothic-lolita", "sweet-lolita", "classic-lolita", "gothic-witch", "gothic-vampire", "gothic-punk", "gothic-nun", "gothic-doll", "gothic-editorial",
  ]);

  for (const stage of data?.stages || []) {
    for (const stageQuestion of stage.questions || []) {
      collectQuestionOptionImages(stageQuestion);
      validateOptionCardThumbnails(stageQuestion.options, `질문 ${stage.id}/${stageQuestion.id}`);
      for (const group of stageQuestion.detailGroups || []) {
        validateOptionCardThumbnails(group.options, `세부 조정 ${stage.id}/${stageQuestion.id}/${group.id}`);
      }
    }
  }
  for (const [packId, pack] of Object.entries(data?.outfitPacks || {})) {
    collectRenderedOptionImages(pack);
    validateOptionCardThumbnails(pack, `의상 팩 ${packId}`);
  }
  for (const [dynamicPackId, dynamicPack] of Object.entries(data?.dynamicPacks || {})) {
    for (const [packId, options] of Object.entries(dynamicPack || {})) {
      collectRenderedOptionImages(options);
      validateOptionCardThumbnails(options, `동적 팩 ${dynamicPackId}/${packId}`);
    }
  }
  for (const detailPack of Object.values(data?.detailPacks || {})) {
    for (const group of detailPack || []) {
      collectRenderedOptionImages(group?.options);
      validateOptionCardThumbnails(group.options, `세부 조정 팩 ${group.id}`);
    }
  }

  if ((question("character", "hair-color")?.options?.length || 0) < 30) fail("헤어색 팔레트가 30개보다 적음");
  if ((question("camera", "body-action")?.options?.length || 0) < 7) fail("몸 동작 세부 선택지가 부족함");
  if ((question("props", "hand-prop")?.options?.length || 0) < 7) fail("손소품 세부 선택지가 부족함");

  const wardrobe = question("outfit", "wardrobe")?.options || [];
  const weightFor = (id) => Number(wardrobe.find((item) => item.id === id)?.referenceWeight || 0);
  if (!(weightFor("wardrobe-uniform") > weightFor("wardrobe-tech") && weightFor("wardrobe-swim") > weightFor("wardrobe-tech"))) {
    fail("의상 참조 가중치가 고빈도 계열을 우선하지 않음");
  }
} catch (error) {
  fail(`브라우저 데이터 초기화 실패: ${error instanceof Error ? error.message : String(error)}`);
}

for (const reference of [...renderedOptionImageReferences].sort()) {
  validateVisualReference(reference, "렌더되는 선택지 이미지");
}

notes.push(`정적 파일 ${staticFiles.length}개`);
notes.push(`렌더되는 선택지 이미지 ${renderedOptionImageReferences.size}개`);
notes.push(`이미지 미리보기가 있는 선택 항목 ${thumbnailSelectionCount.toLocaleString("ko-KR")}개`);
notes.push("Cloudflare Worker/Pages Functions 없음");

if (errors.length) {
  console.error("정적 배포 검사 실패\n");
  for (const error of errors.slice(0, 20)) console.error(`- ${error}`);
  if (errors.length > 20) console.error(`- …나머지 ${errors.length - 20}개`);
  console.error(`\n오류 ${errors.length}개`);
  process.exitCode = 1;
} else {
  console.log("정적 배포 검사 통과\n");
  for (const note of notes) console.log(`- ${note}`);
}
