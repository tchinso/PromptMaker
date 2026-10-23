(function () {
  "use strict";

  // Ordinary steps use their own vocabulary and state. No source bundle,
  // studio selection or density setting is needed to choose a source phrase.
  const corpus = window.PM_CORPUS_LIBRARY;
  if (!corpus?.sourcePrompts || !corpus?.grammar?.facets) throw new Error("Guided vocabulary requires the source corpus.");

  const stages = ["scene", "character", "concept", "mood", "outfit", "props", "camera"];
  const stageForFacet = {
    interaction: "scene", proportion: "character", appearance: "character",
    medium: "concept", environment: "concept", graphics: "concept", aesthetic: "concept",
    light: "mood", palette: "mood", air: "mood",
    "outfit-base": "outfit", construction: "outfit", fabric: "outfit", motif: "outfit", legwear: "outfit",
    floating: "props", accessory: "props", prop: "props",
    hands: "camera", pose: "camera", framing: "camera", camera: "camera", motion: "camera", gaze: "camera", layout: "camera",
  };
  const sectionStage = { character: "character", concept: "concept", background: "concept", outfit: "outfit", composition: "camera" };
  const aliases = {
    medium: "화풍 매체 그림체 수채화 종이 픽셀 도트 스케치 선화 작화 입체 3d",
    proportion: "비례 크기 치비 데포르메 작은 거대",
    layout: "레이아웃 편집 화면 패널 분할 잡지 표지 콜라주 UI 게임 창 인터페이스 스티커 시트",
    graphics: "그래픽 테두리 프레임 글씨 문자 텍스트 타이포 무늬 장식 도형 종이",
    gaze: "시선 표정 눈 미소 웃음 입 얼굴 홍조 감정",
    interaction: "관계 상호작용 파트너 둘 커플 포옹 키스 접촉 거리",
    hands: "손 손가락 팔 잡기 들기 만지기 손짓 소품 동작",
    pose: "자세 포즈 몸 다리 무릎 발 서기 앉기 눕기 달리기 걷기 춤 공중",
    framing: "거리 크롭 클로즈업 초상 전신 상반신 하반신 허리 얼굴 촬영",
    camera: "카메라 구도 원근 방향 앵글 시점 시야 위 아래 뒤 옆 정면 대칭",
    motion: "움직임 머리카락 천 바람 흩날림 모션 역동",
    floating: "부유물 전경 장면 소품 꽃 꽃잎 별 하트 나비 풍선 거품 과자 장식",
    light: "광원 조명 빛 반사 광학 발광 네온 햇빛 그림자 반짝임 흐림",
    palette: "팔레트 색상 색조 색감 배색 대비 파스텔 무채색 그라데이션",
    air: "공기 분위기 시간 계절 날씨 안개 비 눈 아침 밤 저녁 여름 겨울",
    environment: "장소 공간 무대 배경 실내 실외 하늘 도시 거리 방 정원 숲 바다 가구 창문",
    "outfit-base": "의상 옷 바탕 아이템 드레스 치마 셔츠 상의 자켓 코트 바지 수영복 유니폼 전통복",
    construction: "재단 겹침 레이어 실루엣 소매 칼라 목선 허리 주름 끈 어깨",
    fabric: "소재 표면 재질 질감 레이스 프릴 새틴 실크 벨벳 가죽 데님 니트 시스루 투명",
    motif: "문양 봉제 디테일 자수 프린트 패턴 장식 리본 단추 바느질 무늬",
    legwear: "다리 의상 신발 양말 스타킹 타이즈 부츠 구두 운동화 샌들 맨발",
    accessory: "액세서리 착용 소품 보석 목걸이 귀걸이 반지 팔찌 머리 장식 모자 안경 벨트 가방 날개 꼬리",
    prop: "독립 소품 책 전화 카메라 마이크 기타 무기 꽃다발 우산 음식 음료",
    appearance: "외형 캐릭터 인물 머리카락 피부 화장 눈 손톱 성별 인원",
    aesthetic: "테마 컨셉 스타일 혼합 패션 고딕 로리타 키치 레트로 판타지 사이버 펑크 귀여운 우아한",
  };
  const labels = {
    "solo": "혼자", "1girl": "여성 한 명", "1boy": "남성 한 명", "2people": "두 사람", "2girls": "여성 두 명", "2boys": "남성 두 명",
    "multiple individuals": "여러 인물", "male": "남성", "female": "여성", "chibi": "치비 비례", "super deformed": "강한 데포르메",
    "close-up": "클로즈업", "portrait": "초상", "full body": "전신", "full-body": "전신", "upper body": "상반신", "upper-body": "상반신",
    "cowboy shot": "허벅지 위로 담기", "medium shot": "중간 거리", "wide shot": "넓은 장면", "bust shot": "가슴 위로 담기",
    "from above": "위에서 내려다보기", "from below": "아래에서 올려다보기", "from behind": "뒤에서 보기", "from side": "옆에서 보기",
    "dutch angle": "기울인 카메라", "foreshortening": "강한 원근 단축", "dynamic angle": "역동적인 앵글", "dynamic pose": "역동적인 자세",
    "looking at viewer": "관객 바라보기", "looking away": "시선 돌리기", "looking up": "위 보기", "looking down": "아래 보기",
    "closed eyes": "감은 눈", "one eye closed": "한쪽 눈 감기", "smile": "미소", "smiling": "미소 짓기", "blush": "홍조", "open mouth": "벌린 입", ":3": "고양이 같은 입 모양",
    "standing": "서 있기", "sitting": "앉아 있기", "kneeling": "무릎 꿇기", "lying": "누워 있기", "walking": "걷기", "running": "달리기", "dancing": "춤추기",
    "floating": "공중에 뜨기", "head tilt": "고개 기울이기", "head tilt up": "고개 들어 기울이기", "hand near mouth": "손을 입가에 두기",
    "watercolor": "수채화", "watercolor painting": "수채화 그림", "pixel art": "픽셀 아트", "lineart": "선화", "sketch": "스케치", "traditional media": "전통 화구",
    "magazine cover": "잡지 표지", "collage": "콜라주", "scrapbook": "스크랩북", "sticker sheet": "스티커 시트", "character sheet": "캐릭터 시트", "multiple views": "여러 방향 보기",
    "white outline": "흰 외곽선", "black outline": "검은 외곽선", "white border": "흰 테두리", "black border": "검은 테두리", "halftone": "망점", "heart (symbol)": "하트 기호",
    "simple background": "단순한 배경", "white background": "흰 배경", "black background": "검은 배경", "starry sky": "별이 가득한 하늘", "pastel fantasy sky": "파스텔 판타지 하늘",
    "bedroom": "침실", "garden": "정원", "forest": "숲", "beach": "해변", "underwater": "물속", "indoors": "실내", "outdoors": "실외", "classroom": "교실",
    "soft lighting": "부드러운 조명", "backlighting": "역광", "rim lighting": "윤곽 조명", "bokeh": "보케", "glow": "발광", "sparkles": "반짝임", "sunlight": "햇빛", "moonlight": "달빛",
    "warm and cool light contrast": "따뜻한 빛과 차가운 빛의 대비", "pastel colors": "파스텔 색상", "monochrome": "단색", "blue color scheme": "파란 배색",
    "dreamy": "몽환적", "mist": "안개", "fog": "짙은 안개", "rain": "비", "snow": "눈", "night": "밤", "sunset": "일몰", "sunrise": "일출",
    "gothic lolita": "고딕 로리타", "sweet lolita": "스위트 로리타", "cyberpunk": "사이버펑크", "steampunk": "스팀펑크", "y2k": "Y2K", "vaporwave": "베이퍼웨이브",
    "black dress": "검은 드레스", "white dress": "흰 드레스", "black pinafore dress": "검은 피나포어 드레스", "light blue yukata": "하늘색 유카타",
    "oversized hoodie": "오버사이즈 후디", "pleated skirt": "플리츠 스커트", "puffy sleeves": "부푼 소매", "off shoulder": "드러낸 어깨", "layered skirt": "겹친 치마",
    "lace trim": "레이스 테두리", "frills": "프릴", "ruffles": "러플", "velvet": "벨벳", "satin": "새틴", "silk": "실크", "denim": "데님", "leather": "가죽",
    "ribbon": "리본", "bows": "리본 장식", "embroidery": "자수", "floral pattern": "꽃무늬", "striped": "줄무늬", "polka dots": "물방울무늬",
    "black thighhighs": "검은 허벅지 스타킹", "white thighhighs": "흰 허벅지 스타킹", "black tights": "검은 타이즈", "white socks": "흰 양말", "blue leg warmers": "파란 레그워머", "barefoot": "맨발",
    "pearl necklace": "진주 목걸이", "heart charm": "하트 참", "choker": "초커", "beret": "베레모", "glasses": "안경", "sunglasses": "선글라스", "halo": "후광", "angel wings": "천사 날개",
    "floating ribbons": "공중에 떠 있는 리본", "floating crystals": "공중에 떠 있는 수정", "floating petals": "공중에 떠 있는 꽃잎", "soap bubbles": "비눗방울", "confetti": "색종이 조각",
    "book": "책", "bouquet": "꽃다발", "microphone": "마이크", "electric guitar": "일렉트릭 기타", "umbrella": "우산", "smartphone": "스마트폰",
    "trick": "트릭 동작", "time distortion effect": "시간 왜곡 효과", "colorful poolparty": "알록달록한 풀 파티", "mugshot": "머그샷", "colorful plastic balls": "알록달록한 플라스틱 공",
    "geometric": "기하학 그래픽", "vines wrapped around body": "몸을 감싼 덩굴", "umamusume st": "우마무스메 스타일", "cables": "케이블", "rose": "장미", "green vines": "초록 덩굴",
  };
  const weightedText = /^(-?(?:\d+(?:\.\d+)?|\.\d+))::([\s\S]+)::$/;
  const keyFor = (text) => {
    const clean = String(text ?? "").trim();
    return (clean.match(weightedText)?.[2] || clean).replace(/\s+/g, " ").trim().toLowerCase();
  };
  const renderText = (tag, weight) => weight == null ? tag : `${weight}::${tag}::`;
  const facets = corpus.grammar.facets.map((facet) => ({ ...facet }));
  const facetById = new Map(facets.map((facet) => [facet.id, facet]));
  const facetOrder = new Map(facets.map((facet, index) => [facet.id, index]));
  const fallbackFacet = {
    "trick": "pose", "time distortion effect": "light", "colorful poolparty": "environment", "mugshot": "framing",
    "colorful plastic balls": "floating", "geometric": "graphics", "vines wrapped around body": "construction",
    "umamusume st": "aesthetic", "cables": "prop", "rose": "prop", "green vines": "prop",
  };

  // Reuse a Korean card label only when that card denotes this exact single
  // expression. A composite card's name would hide its actual source meaning.
  for (const stage of window.PM_DATA?.stages || []) {
    for (const question of stage.questions || []) {
      for (const option of question.options || []) {
        const tags = Object.values(option.tags || {}).flat().filter((tag) => typeof tag === "string");
        if (tags.length === 1 && /[가-힣]/.test(option.label || "")) labels[keyFor(tags[0])] ||= option.label;
      }
    }
  }

  function hash(text) {
    let value = 0x811c9dc5;
    for (let index = 0; index < text.length; index++) value = Math.imul(value ^ text.charCodeAt(index), 0x01000193);
    return (value >>> 0).toString(36);
  }

  const items = [];
  const byKey = new Map();
  const byId = new Map();
  const occurrenceToItem = new Map();
  for (const [promptId, prompt] of Object.entries(corpus.sourcePrompts)) {
    for (const [sectionIndex, sourceSection] of prompt.sections.entries()) {
      for (const [tagIndex, tag] of sourceSection.tags.entries()) {
        const semanticKey = `${tag.section}\u0000${keyFor(tag.tag)}`;
        let item = byKey.get(semanticKey);
        if (!item) {
          const facet = tag.facet.startsWith("free-") ? fallbackFacet[keyFor(tag.tag)] || tag.facet : tag.facet;
          const stageId = stageForFacet[facet] || sectionStage[tag.section] || "concept";
          const id = `guided-${tag.section}-${hash(semanticKey)}`;
          if (byId.has(id)) throw new Error(`Guided vocabulary ID collision: ${semanticKey}`);
          item = {
            id, tag: tag.tag, label: labels[keyFor(tag.tag)] || tag.tag, section: tag.section,
            facet, stageId, order: items.length, weights: [null], defaultWeight: null, sources: [],
          };
          byKey.set(semanticKey, item);
          byId.set(id, item);
          items.push(item);
        }
        const weight = tag.weight == null ? null : String(tag.weight);
        if (!item.weights.includes(weight)) item.weights.push(weight);
        const occurrenceId = `${promptId}:${sectionIndex}:${tagIndex}`;
        item.sources.push({
          id: occurrenceId, promptId, pageId: prompt.pageId, title: prompt.title,
          sectionIndex, sectionLabel: sourceSection.label, tagIndex, weight,
          tag: tag.tag, rawTag: tag.rawTag ?? tag.tag, facet: tag.facet, section: tag.section,
        });
        occurrenceToItem.set(occurrenceId, item.id);
      }
    }
  }

  const groupsByStage = new Map(stages.map((stageId) => [stageId, []]));
  const groupMap = new Map();
  for (const item of items) {
    const id = `${item.stageId}:${item.facet}`;
    if (!groupMap.has(id)) {
      const group = { id, facet: item.facet, stageId: item.stageId, label: facetById.get(item.facet)?.label || "추가 표현", section: item.section, items: [] };
      groupMap.set(id, group);
      groupsByStage.get(item.stageId).push(group);
    }
    groupMap.get(id).items.push(item);
    item.weights.sort((a, b) => a == null ? -1 : b == null ? 1 : Number(a) - Number(b) || a.localeCompare(b));
    item.variants = item.weights.map((weight) => ({ weight, text: renderText(item.tag, weight) }));
    item.searchText = [item.label, item.tag, aliases[item.facet] || "", facetById.get(item.facet)?.label || "",
      ...item.sources.flatMap((source) => [source.title, source.sectionLabel, source.rawTag]),
    ].join(" ").toLowerCase();
  }
  for (const stageGroups of groupsByStage.values()) {
    stageGroups.sort((a, b) => (facetOrder.get(a.facet) ?? facets.length) - (facetOrder.get(b.facet) ?? facets.length));
  }
  const groups = stages.flatMap((stageId) => groupsByStage.get(stageId));

  function normalize(value = {}) {
    const selections = {};
    const input = value && typeof value === "object" && !Array.isArray(value) ? value.selections : null;
    if (input && typeof input === "object" && !Array.isArray(input)) {
      for (const [id, chosen] of Object.entries(input)) {
        const item = byId.get(id);
        if (!item) continue;
        const weight = chosen == null ? null : typeof chosen === "string" || (typeof chosen === "number" && Number.isFinite(chosen)) ? String(chosen) : null;
        selections[id] = item.weights.includes(weight) ? weight : null;
      }
    }
    return { selections, useBase: value?.useBase === true, active: value?.active === true };
  }

  function compile(value, allow = () => true) {
    const state = normalize(value);
    const selected = Object.entries(state.selections).map(([id, weight]) => {
      const item = byId.get(id);
      return { ...item, weight, text: renderText(item.tag, weight) };
    }).filter((item) => allow(item.text)).sort((a, b) => {
      // Output follows the corpus grammar independently of the step housing
      // each control. Stable sorting retains the user's selection order inside
      // a layer, including drafts materialized from several source variants.
      const outputFacet = (item) => item.sources[0]?.facet || item.facet;
      return (facetOrder.get(outputFacet(a)) ?? facets.length) - (facetOrder.get(outputFacet(b)) ?? facets.length);
    });
    return { selected, total: selected.length, omitted: 0 };
  }

  // Retire source bundles by materializing only the draft's currently compiled
  // expressions. The result contains ordinary selections and ordinary custom
  // text, never block IDs, pins, exclusions or other hidden source state.
  function migrateStudio(value = {}, studioCompiler, allow = () => true) {
    const guided = normalize(value?.guided);
    const custom = {};
    if (!studioCompiler?.compile || !studioCompiler?.normalize) return { guided, custom };
    const old = studioCompiler.normalize(value?.studio);
    const oldActive = Boolean(old.blocks.length || old.pins.length || Object.values(old.custom || {}).flat().length);
    const guidedActive = guided.active || Object.keys(guided.selections).length > 0;
    const existingKeys = new Set(Object.keys(guided.selections).map((id) => keyFor(byId.get(id).tag)));
    for (const source of studioCompiler.compile(old, value?.density, allow).selected) {
      if (existingKeys.has(keyFor(source.tag))) continue;
      const item = byKey.get(`${source.section}\u0000${keyFor(source.tag)}`);
      const weight = source.weight == null ? null : String(source.weight);
      // Unsupported custom weights belong to ordinary free text; silently
      // coercing them to an available source weight would change the draft.
      if (item && item.tag === source.tag && item.weights.includes(weight)) {
        guided.selections[item.id] = weight;
      } else {
        (custom[source.section] ||= []).push(source.text);
      }
    }
    guided.useBase = guidedActive ? guided.useBase : oldActive ? old.useBase : guided.useBase;
    guided.active = guidedActive || oldActive;
    return { guided, custom };
  }

  window.PM_GUIDED_CORPUS = {
    version: 1, stages, facets, groups, groupsByStage, items, byId, occurrenceToItem,
    normalize, compile, migrateStudio, keyFor, getGroups: (stageId) => groupsByStage.get(stageId) || [],
  };
})();
