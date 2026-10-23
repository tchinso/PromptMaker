(function () {
  "use strict";

  const data = window.PM_DATA;
  if (!data) throw new Error("Base prompt data is missing.");

  const catalogItems = window.PM_CORPUS_LIBRARY?.items || [];
  const catalogByTag = new Map(catalogItems.map((item) => [String(item.tag).toLowerCase(), item]));
  const makeOption = (id, label, description, section, tags, extra = {}) => ({
    id,
    label,
    description,
    tags: { [section]: Array.isArray(tags) ? tags : [tags] },
    source: "corpus",
    noVisual: true,
    ...extra,
  });
  const makeMeta = (id, label, description, extra = {}) =>
    makeOption(id, label, description, "meta", [], { source: "official", ...extra });
  const makeDetailOption = (id, label, tag, description = "", source = "suggested") => ({
    id,
    label,
    tag,
    description,
    source,
    tags: { outfit: Array.isArray(tag) ? tag : [tag] },
  });
  const makeOutfitDetailGroup = (id, title, max, options) => ({
    id,
    title,
    section: "outfit",
    max,
    options: options.map(([optionId, label, tag, description, source]) => makeDetailOption(optionId, label, tag, description, source)),
  });

  const getStage = (id) => data.stages.find((stage) => stage.id === id);
  const getQuestion = (stageId, questionId) => getStage(stageId)?.questions.find((question) => question.id === questionId);
  const insertAfter = (stageId, afterId, question) => {
    const questions = getStage(stageId).questions;
    const index = questions.findIndex((item) => item.id === afterId);
    if (index < 0) throw new Error(`Cannot insert ${question.id}; ${afterId} was not found.`);
    questions.splice(index + 1, 0, question);
  };
  const replaceQuestion = (stageId, questionId, patch) => {
    const question = getQuestion(stageId, questionId);
    if (!question) throw new Error(`Cannot update missing question: ${questionId}`);
    Object.assign(question, patch);
  };

  // This stage is intentionally non-graphic. Relationship and styling choices
  // are part of the ordinary flow; there is no separate content-mode gate.
  data.stages.unshift({
    id: "scene",
    short: "장면",
    title: "장면과 관계",
    subtitle: "여성 단독 또는 여성+남성 파트너",
    eyebrow: "02 · SCENE & RELATIONSHIP",
    description: "성인 여성 단독 장면 또는 성인 여성+남성 파트너 장면을 먼저 확정합니다. 장면에 맞지 않는 행동과 시선은 자동으로 숨깁니다.",
    questions: [
      {
        id: "scene-cast",
        section: "character",
        title: "이번 장면은 혼자인가요, 파트너가 있나요?",
        description: "파트너를 고르면 출력에서 solo를 제거하고 1girl, 1boy, 2people을 넣습니다. 둘 모두 성인으로 고정됩니다.",
        options: [
          makeMeta("cast-solo", "혼자", "한 명의 성인 여성 캐릭터에 집중", { referenceWeight: 2.4 }),
          makeMeta("cast-partner", "성인 남성 파트너와", "성인 여성 1명과 성인 남성 1명의 투샷·관계 장면", { referenceWeight: 0.7 }),
        ],
      },
      {
        id: "solo-scene-activity",
        section: "composition",
        title: "혼자일 때 어떤 순간을 담을까요?",
        description: "여성 단독 장면에서만 열립니다. 둘이 필요한 행동은 이 목록에 넣지 않았어요.",
        visibleWhen: { "scene-cast": ["cast-solo"] },
        options: [
          makeOption("solo-reading", "창가에서 독서", "책과 빛에 집중하는 조용한 한 장면", "action", ["reading a book", "looking at book"], { referenceWeight: 1.25 }),
          makeOption("solo-stroll", "혼자 산책", "가볍게 걷는 전신 실루엣", "action", ["walking alone", "relaxed posture"], { referenceWeight: 1.05 }),
          makeOption("solo-cafe", "카페의 한 컷", "음료와 창가를 곁들인 일상 장면", "action", ["sitting at cafe", "holding a drink"], { referenceWeight: 1.15 }),
          makeOption("solo-flowers", "꽃다발을 든 순간", "꽃을 보거나 카메라에 건네는 구도", "action", ["holding bouquet", "looking at flowers"], { referenceWeight: 0.9 }),
          makeOption("solo-camera", "카메라를 든 산책", "한 손의 소품과 시선을 살린 장면", "action", ["holding camera", "looking at viewer"], { referenceWeight: 0.7, handDemand: 1 }),
          makeOption("solo-mirror", "거울 앞 스타일링", "머리나 리본을 정리하는 패션 컷", "action", ["mirror", "adjusting hair"], { referenceWeight: 1.0 }),
          makeOption("solo-stage", "무대의 독무", "가벼운 춤과 조명으로 움직임을 남김", "action", ["solo performance", "dancing"], { referenceWeight: 0.65, handDemand: 0 }),
          makeOption("solo-garden", "정원에서 하늘 보기", "꽃과 바람을 배경으로 올려다보는 순간", "action", ["walking in garden", "looking up"], { referenceWeight: 0.85 }),
        ],
      },
      {
        id: "partner-archetype",
        section: "character",
        title: "파트너의 분위기는 어느 쪽인가요?",
        description: "남성은 한 명만 추가하며, 장면의 스타일을 보완하는 짧은 태그만 넣습니다.",
        visibleWhen: { "scene-cast": ["cast-partner"] },
        options: [
          makeOption("partner-soft", "부드러운 데일리", "니트·창가·차분한 가까운 거리", "character", ["adult man", "soft expression"], { referenceWeight: 1.2 }),
          makeOption("partner-classic", "클래식 포멀", "정장·꽃·에디토리얼 균형", "character", ["adult man", "formal attire"], { referenceWeight: 0.8 }),
          makeOption("partner-artist", "아티스트", "카메라·책·스튜디오와 잘 맞는 감성", "character", ["adult man", "artist"], { referenceWeight: 0.7 }),
          makeOption("partner-campus", "대학 캠퍼스", "성인 대학생의 가벼운 캐주얼", "character", ["adult man", "college student"], { referenceWeight: 1.0 }),
          makeOption("partner-fantasy", "판타지 수호자", "마법·궁전·의식 장면을 받쳐줌", "character", ["adult man", "fantasy knight"], { referenceWeight: 1.0 }),
          makeOption("partner-gothic", "고딕 뮤즈", "검은 장미와 벨벳의 대비", "character", ["adult man", "gothic fashion"], { referenceWeight: 0.9 }),
          makeOption("partner-idol", "무대 파트너", "스포트라이트와 댄스 장면에 적합", "character", ["adult man", "stage performer"], { referenceWeight: 0.55 }),
          makeOption("partner-summer", "여름 데이트", "바다·카페·산책과 자연스러운 톤", "character", ["adult man", "casual summer clothes"], { referenceWeight: 0.9 }),
        ],
      },
      {
        id: "partner-action",
        section: "composition",
        title: "둘은 어떤 관계 동작을 하나요?",
        description: "포즈·손 동작과 함께 조합됩니다. 손소품이 양손을 차지하면 양손 동작은 자동으로 비활성화됩니다.",
        visibleWhen: { "scene-cast": ["cast-partner"] },
        options: [
          makeOption("partner-walk", "나란히 걷기", "같은 방향으로 발을 맞춘 자연스러운 투샷", "action", ["walking together", "close distance"], { referenceWeight: 1.1, handDemand: 0 }),
          makeOption("partner-hold-hands", "연인 손깍지", "손을 맞잡고 시선을 나누는 장면", "action", ["holding hands", "intertwined fingers"], { referenceWeight: 1.0, handDemand: 1 }),
          makeOption("partner-hug", "포옹", "어깨와 팔로 가까운 거리를 만드는 동작", "action", ["hugging", "arms around each other"], { referenceWeight: 1.0, handDemand: 2 }),
          makeOption("partner-forehead", "이마 맞대기", "눈을 감거나 낮춘 조용한 친밀감", "action", ["forehead touch", "close distance"], { referenceWeight: 0.8, handDemand: 0 }),
          makeOption("partner-kiss", "가벼운 키스", "성인 커플의 비노골적 로맨틱 클로즈업", "action", ["kissing", "romantic couple"], { referenceWeight: 0.75, handDemand: 1 }),
          makeOption("partner-dance", "슬로 댄스", "손과 자세가 연결된 우아한 투샷", "action", ["dancing together", "close embrace"], { referenceWeight: 0.75, handDemand: 2 }),
          makeOption("partner-gift", "꽃·선물 건네기", "소품을 관계의 중심으로 두는 장면", "action", ["giving flowers", "looking at each other"], { referenceWeight: 0.8, handDemand: 1 }),
          makeOption("partner-share", "음료 나누기", "카페·여름·일상 장면용의 작은 상호작용", "action", ["sharing a drink", "smiling at each other"], { referenceWeight: 0.7, handDemand: 1 }),
          makeOption("partner-back-hug", "뒤에서 감싸기", "한 명이 다른 인물 뒤에서 포근하게 감쌈", "action", ["hugging from behind", "looking at viewer"], { referenceWeight: 0.9, handDemand: 2 }),
          makeOption("partner-sit", "함께 앉기", "소파·계단·창가에서 가까이 앉은 균형", "action", ["sitting together", "close distance"], { referenceWeight: 0.95, handDemand: 0 }),
        ],
      },
      {
        id: "mature-romance-tone",
        section: "composition",
        title: "둘 사이의 거리감과 조명은 어떻게 남길까요?",
        description: "성인 여성+남성 파트너 장면에서만 열립니다. 조명·공간·거리감으로 차분한 로맨스 무드를 더합니다.",
        visibleWhen: { "scene-cast": ["cast-partner"] },
        options: [
          makeOption("mature-candle", "촛불과 느린 대화", "따뜻한 점광과 가까운 시선", "mood", ["candlelight", "intimate atmosphere"]),
          makeOption("mature-rain", "비 오는 창가", "젖은 창과 낮은 조도의 로맨틱한 거리", "mood", ["rainy window", "soft backlighting"]),
          makeOption("mature-dance", "늦은 밤의 댄스", "벨벳·음악·느린 동작 중심", "mood", ["nighttime", "slow dance atmosphere"]),
          makeOption("mature-quiet", "조용한 어깨 기대기", "편안하고 신뢰감 있는 가까운 프레임", "mood", ["quiet intimate atmosphere", "soft focus"]),
          makeOption("mature-editorial", "패션 에디토리얼", "정돈된 의상과 낮은 시선의 절제된 화보", "mood", ["fashion editorial", "soft pink rim light"]),
          makeOption("mature-suite", "호텔 라운지", "고급스러운 공간과 우아한 거리감", "mood", ["elegant hotel lounge", "warm ambient light"]),
          makeOption("mature-moon", "달빛 테라스", "푸른 밤과 가벼운 포옹의 대비", "mood", ["moonlight", "romantic terrace"]),
          makeOption("mature-flowers", "꽃과 편지", "선물·장미·부드러운 손동작의 로맨스", "mood", ["rose petals", "love letter"]),
        ],
      },
    ],
  });

  // 01. Major appearance type → 7–10 detailed variants.
  replaceQuestion("character", "character-archetype", {
    title: "사람에 가까운가요, 판타지에 가까운가요?",
    description: "큰 종족을 먼저 고른 뒤, 다음 질문에서 7~10개 세부 유형을 고를 수 있어요.",
    section: "character",
    options: [
      makeOption("human", "휴먼", "현대·패션·일상에 가장 자유로운 기본형", "character", "human", { referenceWeight: 2.1 }),
      makeOption("animal-girl", "동물귀 소녀", "귀·꼬리·방울 장식으로 모에 포인트를 더함", "character", ["animal ears", "animal tail"], { referenceWeight: 1.5 }),
      makeOption("elf", "엘프", "긴 귀와 고전 판타지의 맑은 인상", "character", ["elf", "pointy ears"], { referenceWeight: 1.0 }),
      makeOption("angel", "천사", "날개·후광·빛의 실루엣", "character", ["angel", "halo", "angel wings"], { referenceWeight: 0.9 }),
      makeOption("demon", "악마", "뿔·꼬리·고딕 포인트", "character", ["demon girl", "demon horns"], { referenceWeight: 1.15 }),
      makeOption("vampire", "뱀파이어", "창백한 피부와 우아한 밤의 캐릭터", "character", ["vampire", "fangs"], { referenceWeight: 0.9 }),
      makeOption("fairy", "요정·정령", "작은 빛·날개·꽃 모티프", "character", ["fairy", "fairy wings"], { referenceWeight: 0.9 }),
      makeOption("android", "안드로이드", "인공 관절과 발광 회로의 SF형", "character", ["android", "mechanical parts"], { referenceWeight: 0.35 }),
      makeOption("doll", "돌·인형", "도자기 피부와 리본·레이스의 장식성", "character", ["doll", "porcelain skin"], { referenceWeight: 0.95 }),
      makeOption("dragon-girl", "드래곤 소녀", "뿔·비늘·날개를 조절하는 강한 판타지형", "character", ["dragon girl", "dragon horns"], { referenceWeight: 0.55 }),
    ],
  });

  const speciesPack = {
    human: [["campus", "대학생 데일리", "adult college student"], ["sweet", "스위트 히로인", "cute adult woman"], ["fashion", "패션 모델", "fashion model"], ["idol", "아이돌", "idol"], ["artist", "아티스트", "artist"], ["maid", "클래식 메이드", "maid"], ["office", "오피스", "office lady"], ["summer", "여름 휴일", "summer outfit"], ["gothic", "고딕 뮤즈", "gothic fashion"], ["athlete", "라이트 스포츠", "sportswear"]],
    "animal-girl": [["cat", "캣걸", "cat girl"], ["fox", "폭스걸", "fox girl"], ["bunny", "버니걸", "bunny girl"], ["wolf", "울프걸", "wolf girl"], ["dog", "도그걸", "dog girl"], ["horse", "호스걸", "horse girl"], ["sheep", "쉽걸", "sheep girl"], ["raccoon", "너구리 소녀", "raccoon girl"]],
    elf: [["moon", "문 엘프", "moon elf"], ["forest", "포레스트 엘프", "forest elf"], ["high", "하이 엘프", "high elf"], ["dark", "다크 엘프", "dark elf"], ["flower", "플라워 엘프", "flower elf"], ["winter", "윈터 엘프", "winter elf"], ["mage", "엘프 메이지", "elf mage"], ["archer", "엘프 아처", "elf archer"]],
    angel: [["seraph", "세라프", "seraph"], ["guardian", "가디언 엔젤", "guardian angel"], ["fallen", "폴른 엔젤", "fallen angel"], ["choir", "콰이어 엔젤", "angelic choir"], ["sun", "선 엔젤", "sunlight halo"], ["moon", "문 엔젤", "moon halo"], ["messenger", "메신저", "angel messenger"], ["garden", "가든 엔젤", "flower angel"]],
    demon: [["succubus", "서큐버스풍", "succubus"], ["oni", "오니", "oni horns"], ["bat", "배트 윙", "bat wings"], ["devil", "리본 데빌", "devil tail"], ["fire", "파이어 데몬", "fire magic"], ["rose", "로즈 데몬", "black rose"], ["punk", "펑크 데몬", "punk fashion"], ["royal", "로열 데몬", "demon princess"]],
    vampire: [["gothic", "고딕 뱀파이어", "gothic vampire"], ["ballroom", "볼룸 뱀파이어", "ball gown"], ["rose", "로즈 뱀파이어", "red roses"], ["moon", "문라이트", "moonlight"], ["maid", "뱀파이어 메이드", "maid"], ["school", "성인 아카데미", "academy uniform"], ["modern", "모던 나이트", "modern gothic fashion"], ["aristocrat", "아리스토크랫", "vampire aristocrat"]],
    fairy: [["butterfly", "버터플라이", "butterfly wings"], ["flower", "플라워 스프라이트", "flower fairy"], ["water", "워터 스피릿", "water fairy"], ["star", "스타 스피릿", "star fairy"], ["mushroom", "머시룸 스프라이트", "mushroom fairy"], ["crystal", "크리스털 스피릿", "crystal fairy"], ["cloud", "클라우드 스피릿", "cloud fairy"], ["night", "나이트 스피릿", "night fairy"]],
    android: [["idol", "사이버 아이돌", "cyber idol"], ["maid", "안드로이드 메이드", "android maid"], ["pilot", "메카 파일럿", "mecha pilot"], ["hacker", "네온 해커", "hacker"], ["doll", "돌 안드로이드", "android doll"], ["nurse", "메디컬 유닛", "medical android"], ["street", "스트리트 유닛", "cyber streetwear"], ["armor", "라이트 아머", "light armor"]],
    doll: [["porcelain", "포슬린 돌", "porcelain doll"], ["gothic", "고딕 돌", "gothic doll"], ["ballerina", "발레 돌", "ballerina"], ["sweet", "스위트 돌", "sweet lolita"], ["clockwork", "클락워크 돌", "clockwork"], ["flower", "플라워 돌", "flower ornament"], ["swan", "스완 돌", "swan dress"], ["toy", "빈티지 토이", "vintage toy"]],
    "dragon-girl": [["ruby", "루비 드래곤", "red dragon scales"], ["ice", "아이스 드래곤", "ice dragon"], ["cloud", "클라우드 드래곤", "cloud dragon"], ["flower", "플라워 드래곤", "flower dragon"], ["maid", "드래곤 메이드", "dragon maid"], ["knight", "드래곤 나이트", "dragon knight"], ["moon", "문 드래곤", "moon dragon"], ["tiny-wing", "리틀 윙", "small dragon wings"]],
  };
  data.dynamicPacks ||= {};
  data.dynamicPacks["character-archetype"] = Object.fromEntries(
    Object.entries(speciesPack).map(([parentId, rows]) => [
      parentId,
      rows.map(([id, label, tag]) => makeOption(`${parentId}-${id}`, label, "선택한 큰 종족 안에서 더 구체적인 분위기", "character", tag, { referenceWeight: 0.8 })),
    ]),
  );
  insertAfter("character", "character-archetype", {
    id: "character-archetype-detail",
    section: "character",
    title: "어떤 세부 유형에 가까운가요?",
    description: "위의 큰 종족을 고르면 7~10개 세부 유형이 열립니다.",
    dynamicPack: "character-archetype",
  });

  // 02. Hair silhouette/binding and bangs are separate controls.
  replaceQuestion("character", "hair-style", {
    title: "머리 형태와 묶음의 큰 계열은 무엇인가요?",
    description: "형태·묶음의 방향을 고른 뒤 세부 변주를 더합니다.",
    section: "character",
    options: getQuestion("character", "hair-style").options.map((item) => ({ ...item, noVisual: true })),
  });
  const hairDetailRows = [
    ["sleek", "매끈하고 정돈된 결", "sleek hair"], ["fluffy", "가볍게 부푼 결", "fluffy hair"], ["side-locks", "긴 옆머리", "long sidelocks"], ["ahoge", "작은 아호게", "ahoge"], ["face-frame", "얼굴을 감싼 레이어", "face-framing hair"], ["wispy", "가벼운 잔머리", "wispy hair"], ["windblown", "바람에 흐르는 결", "windblown hair"], ["glossy", "유광 하이라이트", "glossy hair"]];
  const hairStyleIds = getQuestion("character", "hair-style").options.map((item) => item.id);
  data.dynamicPacks["hair-style"] = Object.fromEntries(
    hairStyleIds.map((parentId) => [
      parentId,
      hairDetailRows.map(([id, label, tag]) => makeOption(`${parentId}-${id}`, label, "선택한 헤어 형태에 추가하는 결·레이어 변주", "character", tag, { referenceWeight: id === "side-locks" || id === "fluffy" ? 1.15 : 0.75 })),
    ]),
  );
  insertAfter("character", "hair-style", {
    id: "hair-style-detail",
    section: "character",
    title: "그 형태의 결·레이어는 어떻게 남길까요?",
    description: "선택한 머리 형태에 맞는 8개 세부 변주입니다.",
    dynamicPack: "hair-style",
  });
  insertAfter("character", "hair-style-detail", {
    id: "hair-bang",
    section: "character",
    title: "앞머리는 어떤 형태인가요?",
    description: "앞머리는 얼굴 인상을 크게 바꾸므로 머리 묶음과 분리합니다.",
    options: [
      makeOption("bang-none", "앞머리 없음", "이마와 얼굴선을 시원하게 드러냄", "character", "no bangs", { referenceWeight: 0.55 }),
      makeOption("bang-blunt", "일자 앞머리", "또렷하고 인형 같은 프레임", "character", "blunt bangs", { referenceWeight: 1.0 }),
      makeOption("bang-see-through", "시스루 앞머리", "가볍고 부드러운 여백", "character", "see-through bangs", { referenceWeight: 1.1 }),
      makeOption("bang-side", "사이드 스윕", "한쪽으로 흐르는 성숙한 선", "character", "side-swept bangs", { referenceWeight: 0.9 }),
      makeOption("bang-curtain", "커튼뱅", "양쪽으로 얼굴을 감싸는 레이어", "character", "curtain bangs", { referenceWeight: 0.8 }),
      makeOption("bang-hime", "히메컷", "옆선이 또렷하게 끊기는 전통적 프레임", "character", "hime cut", { referenceWeight: 0.7 }),
      makeOption("bang-asym", "비대칭 앞머리", "한쪽을 길게 남긴 그래픽 포인트", "character", "asymmetrical bangs", { referenceWeight: 0.55 }),
      makeOption("bang-curly", "컬 앞머리", "가볍게 말린 부드러운 질감", "character", "curly bangs", { referenceWeight: 0.65 }),
      makeOption("bang-long", "긴 앞머리", "눈가를 스치는 로맨틱한 길이", "character", "long bangs", { referenceWeight: 0.8 }),
      makeOption("bang-parted", "가르마 앞머리", "자연스럽게 갈라진 성인 데일리 인상", "character", "parted bangs", { referenceWeight: 0.9 }),
    ],
  });

  // 03. Thirty common anime-friendly hair palettes; treatment is independent.
  const hairPaletteRows = [
    ["black-hair", "01 · 잉크 블랙", "black hair", "#26252c", 1.5], ["dark-brown-hair", "02 · 다크 브라운", "dark brown hair", "#4f342d", 1.35], ["brown-hair", "03 · 소프트 브라운", "brown hair", "#845d49", 1.35], ["light-brown-hair", "04 · 라이트 브라운", "light brown hair", "#b78360", 1.1], ["blonde-hair", "05 · 허니 블론드", "blonde hair", "#e6c06e", 1.1], ["platinum-blonde", "06 · 플래티넘 블론드", "platinum blonde hair", "#f4e8c7", 0.9], ["white-hair", "07 · 스노 화이트", "white hair", "#edeef2", 1.25], ["silver-hair", "08 · 실버 그레이", "silver hair", "#b9bec8", 1.1], ["grey-hair", "09 · 애시 그레이", "grey hair", "#8d9098", 0.85], ["red-hair", "10 · 크림슨 레드", "red hair", "#ac3f4d", 0.95], ["auburn-hair", "11 · 오번", "auburn hair", "#8d4934", 0.7], ["orange-hair", "12 · 애프리콧 오렌지", "orange hair", "#df7f48", 0.75], ["pink-hair", "13 · 캔디 핑크", "pink hair", "#ee9dbd", 1.3], ["light-pink-hair", "14 · 베이비 핑크", "light pink hair", "#f4c8d9", 1.1], ["rose-hair", "15 · 로즈 핑크", "rose hair", "#c66a88", 0.85], ["purple-hair", "16 · 미스틱 퍼플", "purple hair", "#8465bc", 1.05], ["lavender-hair", "17 · 라벤더", "lavender hair", "#b39ad7", 0.9], ["violet-hair", "18 · 딥 바이올렛", "violet hair", "#5d417e", 0.65], ["blue-hair", "19 · 크리스털 블루", "blue hair", "#5d8fd4", 1.0], ["light-blue-hair", "20 · 스카이 블루", "light blue hair", "#9ccbe2", 0.9], ["aqua-hair", "21 · 아쿠아", "aqua hair", "#61c8d1", 0.8], ["teal-hair", "22 · 틸", "teal hair", "#3e9f9a", 0.65], ["green-hair", "23 · 에메랄드 그린", "green hair", "#4d9b6d", 0.65], ["mint-hair", "24 · 민트", "mint green hair", "#9ed9c8", 0.8], ["yellow-hair", "25 · 레몬 옐로", "yellow hair", "#ecd55d", 0.45], ["gold-hair", "26 · 골드", "gold hair", "#d5a33e", 0.55], ["burgundy-hair", "27 · 버건디", "burgundy hair", "#6f3447", 0.6], ["navy-hair", "28 · 미드나이트 네이비", "navy blue hair", "#33436d", 0.55], ["rainbow-hair", "29 · 레인보우", "rainbow hair", "linear-gradient(90deg,#f6a1b7,#ffe477,#82d7c4,#91a8e8)", 0.3], ["multicolored-hair", "30 · 멀티컬러", "multicolored hair", "linear-gradient(90deg,#df78ae,#856bd2,#64b5dd)", 0.45],
  ];
  replaceQuestion("character", "hair-color", {
    title: "머리색은 어떤 팔레트인가요?",
    description: "남성향 애니메이션에서 자주 쓰이는 기본 팔레트 30개를, 내 참조 코퍼스 빈도로 다시 가중했습니다.",
    section: "character",
    options: hairPaletteRows.map(([id, label, tag, swatch, referenceWeight]) => makeOption(id, label, "색상 처리와 그라데이션은 다음 질문에서 따로 정합니다.", "character", tag, { swatch, noVisual: false, referenceWeight })),
  });
  insertAfter("character", "hair-color", {
    id: "hair-color-treatment",
    section: "character",
    title: "색이 머리카락에 어떻게 놓이나요?",
    description: "기본 팔레트와 별도로 선택해 투톤·그라데이션·포인트의 자유도를 높입니다.",
    options: [
      makeOption("hair-solid", "단색 그대로", "가장 안정적이고 선명한 한 가지 색", "character", "solid hair color", { referenceWeight: 1.5 }),
      makeOption("hair-two-tone", "투톤 분할", "두 색이 명확히 갈리는 그래픽 처리", "character", "two-tone hair", { referenceWeight: 0.85 }),
      makeOption("hair-gradient", "끝으로 흐르는 그라데이션", "중간부터 끝으로 부드럽게 바뀜", "character", "gradient hair", { referenceWeight: 0.9 }),
      makeOption("hair-colored-tips", "컬러 팁", "끝부분만 다른 색으로 물들임", "character", "colored tips", { referenceWeight: 0.75 }),
      makeOption("hair-inner", "이너 컬러", "겉머리 안쪽에 숨은 두 번째 색", "character", "inner hair color", { referenceWeight: 0.65 }),
      makeOption("hair-streaks", "굵은 브리지", "몇 가닥의 선명한 색 포인트", "character", "hair streaks", { referenceWeight: 0.6 }),
      makeOption("hair-highlights", "미세 하이라이트", "빛에 따라 은은하게 보이는 결", "character", "hair highlights", { referenceWeight: 0.9 }),
      makeOption("hair-ombre", "옴브레", "뿌리와 끝의 농도를 길게 전환", "character", "ombre hair", { referenceWeight: 0.55 }),
      makeOption("hair-split-dye", "스플릿 다이", "좌우가 서로 다른 색으로 나뉨", "character", "split-color hair", { referenceWeight: 0.4 }),
      makeOption("hair-iridescent", "오로라 광택", "조명에 따라 살짝 무지개빛이 스침", "character", "iridescent hair", { referenceWeight: 0.35 }),
    ],
  });

  // 04. Eye color, pupil motif, and heterochromia are independent.
  const eyeRows = [
    ["blue-eyes", "클리어 블루", "blue eyes", "#5599d8"], ["aqua-eyes", "아쿠아", "aqua eyes", "#52c5c4"], ["teal-eyes", "틸", "teal eyes", "#39999a"], ["green-eyes", "에메랄드", "green eyes", "#4da36e"], ["lime-eyes", "라임", "lime green eyes", "#a7c44a"], ["brown-eyes", "웜 브라운", "brown eyes", "#8b684f"], ["amber-eyes", "앰버", "amber eyes", "#c48d35"], ["golden-eyes", "골든", "golden eyes", "#d4b44d"], ["grey-eyes", "실버 그레이", "grey eyes", "#9aa4af"], ["black-eyes", "잉크 블랙", "black eyes", "#34333c"], ["purple-eyes", "글로우 퍼플", "purple eyes", "#8b69c8"], ["violet-eyes", "딥 바이올렛", "violet eyes", "#623f91"], ["pink-eyes", "캔디 핑크", "pink eyes", "#eb84b0"], ["red-eyes", "루비 레드", "red eyes", "#c94855"], ["orange-eyes", "탠저린", "orange eyes", "#df7e43"], ["yellow-eyes", "레몬 옐로", "yellow eyes", "#ead558"], ["white-eyes", "펄 화이트", "white eyes", "#e9e9ee"], ["rainbow-eyes", "레인보우", "rainbow eyes", "linear-gradient(90deg,#e799bb,#edd969,#64c7c5,#8e88dd)"], ["multicolored-eyes", "다색 홍채", "multicolored eyes", "linear-gradient(90deg,#b86fa4,#7f9bdd,#6dbd9b)"], ["glowing-eyes", "은은한 발광", "glowing eyes", "#d4bdf3"]];
  replaceQuestion("character", "eyes", {
    title: "눈동자에 남길 가장 강한 색은 무엇인가요?",
    description: "눈색을 먼저 고르고, 오드아이·별·하트 동공은 다음 질문에서 따로 조절합니다.",
    section: "character",
    options: eyeRows.map(([id, label, tag, swatch]) => makeOption(id, label, "동공 모양과 별개로 유지되는 기본 홍채색", "character", tag, { swatch, noVisual: false, referenceWeight: ["blue-eyes", "purple-eyes", "pink-eyes", "amber-eyes"].includes(id) ? 1.05 : 0.7 })),
  });
  insertAfter("character", "eyes", {
    id: "eye-pupil",
    section: "character",
    title: "동공과 홍채에 넣을 별도 특징은 무엇인가요?",
    description: "색 선택을 덮어쓰지 않고, 오드아이·특수 동공·광택을 하나 더합니다.",
    options: [
      makeOption("pupil-natural", "기본 원형", "색과 속눈썹에 집중하는 안정적인 눈", "character", "round pupils", { referenceWeight: 1.0 }),
      makeOption("pupil-heterochromia", "오드아이", "좌우 눈의 색을 다르게 남김", "character", "heterochromia", { referenceWeight: 0.75 }),
      makeOption("pupil-star", "별 동공", "스파클과 마법광을 눈에 모음", "character", "star-shaped pupils", { referenceWeight: 0.85 }),
      makeOption("pupil-heart", "하트 동공", "스위트·로맨틱한 감정 포인트", "character", "heart-shaped pupils", { referenceWeight: 0.7 }),
      makeOption("pupil-flower", "꽃 동공", "정원·요정 계열에 어울리는 모티프", "character", "flower-shaped pupils", { referenceWeight: 0.5 }),
      makeOption("pupil-diamond", "다이아 동공", "주얼리처럼 또렷한 광택", "character", "diamond-shaped pupils", { referenceWeight: 0.45 }),
      makeOption("pupil-slit", "세로 슬릿", "고양이·뱀파이어·드래곤 계열", "character", "slit pupils", { referenceWeight: 0.55 }),
      makeOption("pupil-gradient", "그라데이션 홍채", "안쪽과 바깥쪽의 색 농도를 달리함", "character", "gradient eyes", { referenceWeight: 0.55 }),
      makeOption("pupil-glossy", "유리구슬 광택", "큰 하이라이트와 맑은 반사", "character", "glossy eyes", { referenceWeight: 1.15 }),
      makeOption("pupil-sparkle", "반짝임이 많은 홍채", "별점처럼 작은 반사광을 여러 개", "character", "sparkling eyes", { referenceWeight: 1.2 }),
    ],
  });

  // 05. Skin and face points are intentionally independent.
  replaceQuestion("character", "face", {
    id: "skin-tone",
    title: "피부색과 피부 결은 어디에 가깝나요?",
    description: "참조 스타일의 밝고 부드러운 팔레트 중심으로 고르고, 얼굴 원포인트는 다음 질문에서 따로 선택합니다.",
    section: "character",
    options: [
      makeOption("skin-porcelain", "포슬린", "차갑고 맑은 인형 같은 밝은 톤", "character", ["porcelain skin", "pale skin"], { swatch: "linear-gradient(90deg,#fff1e8,#f6d9d2)", noVisual: false, referenceWeight: 1.0 }),
      makeOption("skin-pale", "페일", "고딕·실버·라벤더에 잘 맞는 밝은 톤", "character", "pale skin", { swatch: "linear-gradient(90deg,#f7e5dc,#ebcfc9)", noVisual: false, referenceWeight: 1.05 }),
      makeOption("skin-fair", "페어", "자연스럽고 맑은 기본 밝기", "character", "fair skin", { swatch: "linear-gradient(90deg,#f3d8c8,#e9bfae)", noVisual: false, referenceWeight: 1.4 }),
      makeOption("skin-ivory", "아이보리", "크림빛이 섞인 부드러운 톤", "character", "ivory skin", { swatch: "linear-gradient(90deg,#f4dfc9,#e8c69e)", noVisual: false, referenceWeight: 0.9 }),
      makeOption("skin-peach", "피치", "살구빛 온기가 도는 밝은 톤", "character", "peach skin", { swatch: "linear-gradient(90deg,#f5d1be,#e9ad93)", noVisual: false, referenceWeight: 1.05 }),
      makeOption("skin-rosy", "로지", "은은한 홍조가 기본으로 깔린 톤", "character", ["fair skin", "rosy cheeks"], { swatch: "linear-gradient(90deg,#f4d3cc,#e7aeb1)", noVisual: false, referenceWeight: 0.9 }),
      makeOption("skin-warm", "웜 베이지", "햇빛과 골드 계열에 자연스러운 밝은 톤", "character", "warm skin tone", { swatch: "linear-gradient(90deg,#eec39f,#d89970)", noVisual: false, referenceWeight: 0.65 }),
      makeOption("skin-light-tan", "라이트 선키스드", "여름·스포츠용의 가벼운 햇볕 톤", "character", "light tan", { swatch: "linear-gradient(90deg,#dca06f,#bf774c)", noVisual: false, referenceWeight: 0.4 }),
      makeOption("skin-soft", "소프트 스킨", "색보다 결을 부드럽고 매끈하게 강조", "character", ["soft skin", "smooth skin"], { swatch: "linear-gradient(90deg,#f7d8cf,#efbdb8)", noVisual: false, referenceWeight: 1.2 }),
    ],
  });
  insertAfter("character", "skin-tone", {
    id: "face-point",
    section: "character",
    title: "얼굴에 남길 작은 원포인트는 무엇인가요?",
    description: "점뿐 아니라 스티커·밴드·주얼리·메이크업처럼 작은 기억점을 하나 고릅니다.",
    options: [
      makeOption("face-point-none", "없음", "피부·눈·표정만 또렷하게", "character", "clean face", { referenceWeight: 0.8 }),
      makeOption("face-point-freckles", "주근깨", "햇살과 코지한 인상을 더함", "character", "freckles", { referenceWeight: 0.7 }),
      makeOption("face-point-mole-eye", "눈 밑 점", "시선을 모으는 작은 뷰티 마크", "character", "mole under eye", { referenceWeight: 0.7 }),
      makeOption("face-point-mole-mouth", "입가 점", "립 라인과 작은 표정 포인트", "character", "mole under mouth", { referenceWeight: 0.55 }),
      makeOption("face-point-heart-sticker", "하트 스티커", "볼에 붙인 팝한 하트", "character", "heart face sticker", { referenceWeight: 0.8 }),
      makeOption("face-point-star-sticker", "별 스티커", "아이돌·꿈결 스타일의 광점", "character", "star face sticker", { referenceWeight: 0.75 }),
      makeOption("face-point-bandage", "작은 밴드", "귀엽고 장난스러운 생활감", "character", "bandage on face", { referenceWeight: 0.55 }),
      makeOption("face-point-cheek-mark", "볼 문양", "판타지·동물귀 계열의 심볼", "character", "cheek mark", { referenceWeight: 0.55 }),
      makeOption("face-point-tear-gem", "눈가 보석", "주얼리처럼 반짝이는 눈가 장식", "character", "face jewel", { referenceWeight: 0.45 }),
      makeOption("face-point-soft-makeup", "소프트 메이크업", "핑크 섀도·볼 홍조·작은 광택", "character", ["soft makeup", "blush"], { referenceWeight: 1.0 }),
    ],
  });

  // 06. Height and body silhouette are independent and intentionally moe-leaning.
  replaceQuestion("character", "body", {
    id: "height",
    title: "키와 세로 비율은 어떻게 잡을까요?",
    description: "키를 먼저 고르고, 다음 질문에서 부드러운 체형 균형을 고릅니다.",
    section: "character",
    options: [
      makeOption("height-petite", "아담한 키", "귀엽고 응축된 비율", "character", "short female", { referenceWeight: 1.0 }),
      makeOption("height-short", "조금 작은 편", "프레임 안에서 다정한 균형", "character", "short woman", { referenceWeight: 0.85 }),
      makeOption("height-average", "보통 키", "어떤 장르에도 자연스러운 기본", "character", "average height", { referenceWeight: 1.4 }),
      makeOption("height-graceful", "우아한 평균 비율", "드레스와 포즈에 안정적인 세로선", "character", "graceful proportions", { referenceWeight: 0.9 }),
      makeOption("height-leggy", "다리가 긴 비율", "패션·전신샷에서 선명한 실루엣", "character", "long legs", { referenceWeight: 1.0 }),
      makeOption("height-tall", "큰 키", "롱코트·화보·군중 속 존재감", "character", "tall female", { referenceWeight: 0.65 }),
      makeOption("height-model", "모델형 세로선", "길고 정돈된 패션 에디토리얼 비율", "character", "fashion model proportions", { referenceWeight: 0.55 }),
      makeOption("height-fairy", "작은 판타지 비율", "요정·인형 캐릭터의 가벼운 인상", "character", "petite adult woman", { referenceWeight: 0.65 }),
    ],
  });
  insertAfter("character", "height", {
    id: "body-type",
    section: "character",
    title: "체형의 가장 큰 균형은 무엇인가요?",
    description: "모에한 실루엣과 의상 드레이프를 중심으로, 과도한 근육질·중량감보다 부드러운 변주를 넓혔습니다.",
    options: [
      makeOption("body-petite", "쁘띠", "가볍고 섬세한 기본 체형", "character", "petite", { referenceWeight: 1.15 }),
      makeOption("body-slender", "슬렌더", "길고 얇은 선이 살아나는 체형", "character", ["slender", "slim waist"], { referenceWeight: 1.25 }),
      makeOption("body-soft", "소프트 슬림", "각을 줄이고 부드럽게 이어지는 선", "character", "soft body", { referenceWeight: 1.0 }),
      makeOption("body-curvy-soft", "소프트 커비", "과장보다 드레스 라인을 살리는 곡선", "character", ["curvy", "soft curves"], { referenceWeight: 0.9 }),
      makeOption("body-ballerina", "발레리나", "가볍고 유연한 팔다리의 균형", "character", "ballerina physique", { referenceWeight: 0.75 }),
      makeOption("body-athletic-light", "라이트 애슬레틱", "테니스·댄스에 맞는 가벼운 탄력", "character", "toned body", { referenceWeight: 0.6 }),
      makeOption("body-hourglass", "모래시계", "허리와 골반을 은은하게 잇는 균형", "character", "hourglass figure", { referenceWeight: 0.7 }),
      makeOption("body-longline", "롱라인", "코트·드레스에 잘 맞는 긴 몸통 인상", "character", "long torso", { referenceWeight: 0.55 }),
      makeOption("body-doll", "돌 실루엣", "작은 어깨와 정돈된 인형 같은 비율", "character", "doll-like body", { referenceWeight: 0.75 }),
      makeOption("body-natural", "내추럴", "특정 체형 태그를 최소화한 자연스러운 균형", "character", "natural body proportions", { referenceWeight: 1.1 }),
    ],
  });

  // Reference signature: selected by default in app.js, but fully removable.
  insertAfter("concept", "genre", {
    id: "reference-style",
    section: "background",
    title: "참조 그림체의 어느 결을 가장 자주 쓰고 싶나요?",
    description: "자주 등장한 파스텔·레이스·스파클을 우선으로 두되, 고딕·레트로·여름은 별도 분기로 유지합니다.",
    options: [
      makeOption("style-nyankat-core", "NyanKat 코어", "부드러운 빛, 스파클, 섬세한 장식의 기본 결", "background", ["soft lighting", "sparkles", "detailed background"], { referenceWeight: 2.4 }),
      makeOption("style-sweet", "스위트 파스텔", "핑크·하트·리본·부드러운 보케", "background", ["pastel colors", "floating hearts", "soft bokeh"], { referenceWeight: 2.1 }),
      makeOption("style-lace", "레이스 에디토리얼", "프릴·레이스·고급 소재의 가까운 디테일", "outfit", ["lace trim", "frills", "refined material detail"], { referenceWeight: 2.0 }),
      makeOption("style-magic", "매지컬 드림", "빛 입자·꽃·부유물의 판타지 결", "background", ["magical atmosphere", "floating particles", "dreamy atmosphere"], { referenceWeight: 1.5 }),
      makeOption("style-gothic", "고딕 로맨스", "블랙·장미·벨벳·낮은 조도의 우아함", "background", ["dark gothic atmosphere", "black roses", "dramatic lighting"], { referenceWeight: 1.0 }),
      makeOption("style-retro", "레트로 팝", "도트·강한 테두리·밝은 그래픽 리듬", "background", ["retro pop style", "colorful background", "dynamic angle"], { referenceWeight: 0.75 }),
      makeOption("style-summer", "투명한 여름", "하늘·물·강한 햇빛·바람의 기분", "background", ["blue sky", "sunny day", "sparkling water"], { referenceWeight: 0.8 }),
      makeOption("style-minimal", "미니멀 포커스", "배경을 단순화해 캐릭터에 집중", "background", ["simple background", "soft lighting"], { referenceWeight: 0.65 }),
    ],
  });

  // 09–13. Keep the high-level outfit groups, but separate lower layers and enrich accessories/props.
  // The limited option budget is deliberately concentrated on the wardrobe
  // families that dominate the reference archive. Low-frequency families stay
  // usable, but expose fewer subtype paths so they do not dilute recommendations.
  const highVariationWardrobes = new Set([
    "wardrobe-uniform",
    "wardrobe-swim",
    "wardrobe-casual",
    "wardrobe-traditional",
    "wardrobe-sports",
    "wardrobe-gothic",
  ]);
  ["wardrobe-tech", "wardrobe-formal", "wardrobe-professional"].forEach((wardrobeId) => {
    if (data.outfitPacks?.[wardrobeId]) data.outfitPacks[wardrobeId] = data.outfitPacks[wardrobeId].slice(0, wardrobeId === "wardrobe-tech" ? 3 : 5);
  });
  const focusedOutfitDetails = {
    "wardrobe-uniform": [
      ["sailor", "세일러 칼라 + 리본", ["sailor collar", "ribbon tie"]],
      ["plaid", "체크 주름과 넥타이", ["plaid pleated skirt", "necktie"]],
      ["cardigan", "카디건 레이어", ["school cardigan", "collared shirt"]],
      ["vest", "스웨터 베스트", ["sweater vest", "pleated skirt"]],
      ["puff", "퍼프소매 블라우스", ["puff sleeves", "white blouse"]],
      ["ribbon", "큰 가슴 리본", ["large ribbon", "ribbon trim"]],
      ["loose-socks", "루즈 삭스 + 메리제인", ["loose socks", "mary janes"]],
    ],
    "wardrobe-swim": [
      ["frill", "프릴 트림", ["frilled swimsuit", "ribbon"]],
      ["highwaist", "하이웨이스트", ["high-waist bikini bottom", "retro swimsuit"]],
      ["sport", "스포티 스트랩", ["sport swimsuit", "racerback swimsuit"]],
      ["skirted", "스커트 레이어", ["skirted swimsuit", "swimsuit bottom"]],
      ["rashguard", "가벼운 래시가드", ["rash guard", "swim shorts"]],
      ["sailor", "세일러 마린", ["sailor swimsuit", "navy ribbon"]],
      ["coverup", "시폰 커버업", ["sheer cover-up", "beachwear"]],
    ],
    "wardrobe-casual": [
      ["knit", "케이블 니트", ["cable knit", "soft knit fabric"]],
      ["layered", "티셔츠 레이어", ["inner white t-shirt", "layered clothes"]],
      ["denim", "데님 쇼츠", ["denim shorts", "casual outfit"]],
      ["oversized", "오버사이즈 후디", ["oversized hoodie", "long sleeves"]],
      ["cottage", "코티지 레이스", ["white dress", "lace trim"]],
      ["yume", "유메카와이", ["pastel clothes", "ribbons"]],
      ["street", "팝 스트리트", ["graphic print", "chunky sneakers"]],
    ],
    "wardrobe-traditional": [
      ["hanbok", "한복 리본", ["modern hanbok", "norigae"]],
      ["kimono", "기모노 오비", ["kimono", "obi"]],
      ["qipao", "치파오 파이핑", ["china dress", "contrast piping"]],
      ["veil", "반투명 베일", ["translucent veil", "flower hair ornament"]],
      ["floral", "꽃 자수", ["floral embroidery", "falling petals"]],
      ["festival", "축제 유카타", ["yukata", "hair ribbon"]],
      ["lace-fusion", "레이스 퓨전", ["traditional clothing", "lace trim"]],
    ],
    "wardrobe-sports": [
      ["tennis", "테니스 스커트", ["tennis outfit", "pleated skirt"]],
      ["track", "트랙 재킷", ["track jacket", "sneakers"]],
      ["dance", "댄스 레그워머", ["dancewear", "leg warmers"]],
      ["ballet", "발레 튜튜", ["ballet tutu", "ballet shoes"]],
      ["cheer", "치어 리본", ["cheerleader", "pom poms"]],
      ["outdoor", "아웃도어 윈드브레이커", ["windbreaker", "shorts"]],
      ["racing", "레이싱 재킷", ["racing jacket", "thighhighs"]],
    ],
    "wardrobe-gothic": [
      ["lace", "레이스 프릴", ["lace trim", "frills"]],
      ["ribbon", "리본 코르셋", ["ribbon choker", "corset bodice"]],
      ["rose", "블랙 로즈", ["black roses", "velvet"]],
      ["doll", "돌 로리타", ["gothic lolita", "doll-like outfit"]],
      ["nun", "고딕 누드레스", ["nun dress", "rosary"]],
      ["sweet", "스위트 로리타", ["sweet lolita", "pink frilled dress"]],
      ["punk", "리본 펑크", ["punk fashion", "safety pins"]],
    ],
  };
  // Rare families still get concrete, useful finish choices. They intentionally
  // stay shorter than the six recurring families above so the recommendation
  // budget remains concentrated on the user's reference vocabulary.
  const compactOutfitDetails = {
    "wardrobe-formal": [
      ["satin", "새틴 드레이프", ["satin fabric", "flowing fabric"]],
      ["gloves", "롱 글러브", ["opera gloves", "formal outfit"]],
      ["jewelry", "진주·보석 포인트", ["pearl jewelry", "elegant accessories"]],
      ["wrap", "숄·케이프 레이어", ["evening shawl", "capelet"]],
      ["hem", "긴 자락과 트레인", ["long dress", "dress train"]],
    ],
    "wardrobe-professional": [
      ["apron", "프릴 에이프런", ["frilled apron", "ribbon trim"]],
      ["collar", "단정한 칼라", ["collared shirt", "neat uniform"]],
      ["badge", "명찰·브로치", ["name tag", "brooch"]],
      ["service", "서비스 소품", ["serving tray", "professional uniform"]],
      ["loafers", "로퍼와 양말", ["loafers", "ankle socks"]],
    ],
    "wardrobe-fantasy": [
      ["cape", "짧은 망토", ["short cape", "fantasy costume"]],
      ["ornament", "금빛 장식", ["gold trim", "ornate clothing"]],
      ["sleeves", "분리 소매", ["detached sleeves", "flowing sleeves"]],
      ["emblem", "문장·별 모티프", ["emblem", "star motif"]],
      ["boots", "모험가 부츠", ["lace-up boots", "fantasy footwear"]],
    ],
    "wardrobe-tech": [
      ["panels", "대비 패널", ["color-blocked clothes", "technical fabric"]],
      ["straps", "스트랩과 버클", ["straps", "buckles"]],
      ["glow", "작은 발광선", ["glowing trim", "neon accent"]],
      ["visor", "바이저 포인트", ["visor", "futuristic accessories"]],
    ],
  };
  data.dynamicPacks["outfit-subtype"] = {};
  Object.entries(data.outfitPacks || {}).forEach(([wardrobeId, subtypeOptions]) => {
    const detailRows = focusedOutfitDetails[wardrobeId] || compactOutfitDetails[wardrobeId] || compactOutfitDetails["wardrobe-fantasy"];
    subtypeOptions.forEach((subtype) => {
      data.dynamicPacks["outfit-subtype"][subtype.id] = detailRows.map(([id, label, tags]) =>
        makeOption(
          `${subtype.id}-detail-${id}`,
          label,
          highVariationWardrobes.has(wardrobeId)
            ? `${subtype.label} 선택에 맞춘 내 참조 고빈도 의상 변주`
            : `${subtype.label}의 핵심 실루엣을 빠르게 선명하게 만드는 디테일`,
          "outfit",
          tags,
          { referenceWeight: highVariationWardrobes.has(wardrobeId) ? 1.25 : 0.32 },
        ),
      );
    });
  });
  replaceQuestion("outfit", "outfit-subtype", {
    title: "1/3 · 고른 계열 안에서 어떤 옷인가요?",
    description: "큰 계열을 고르면 그 계열의 7~10개(희소 계열은 3~5개) 실제 의상 유형이 바로 열립니다.",
    prerequisiteMessage: "1/3 · 바로 위에서 의상의 큰 계열을 먼저 고르면, 그 계열 전용 세부 유형이 열립니다.",
  });
  insertAfter("outfit", "outfit-subtype", {
    id: "outfit-subtype-detail",
    section: "outfit",
    title: "2/3 · 선택한 옷의 방향은 어느 쪽으로 밀어볼까요?",
    description: "선택한 의상 유형에 맞춘 카드가 열립니다. 자주 쓰는 계열은 7개, 희소 계열은 핵심 3~5개로 좁혀 두었습니다.",
    dynamicPack: "outfit-subtype",
    multi: true,
    max: 2,
    prerequisiteMessage: "2/3 · 위에서 실제 의상 유형 하나를 고르면, 그 옷에 맞춘 변주 카드와 3/3 마감 슬롯이 열립니다.",
    detailGroups: [
      makeOutfitDetailGroup("outfit-palette", "3/3 · 색 조합", 1, [
        ["palette-ivory-navy", "아이보리 + 네이비", ["ivory", "navy blue"], "교복·세일러·클래식 계열에 잘 맞는 선명한 대비"],
        ["palette-pink-white", "파스텔 핑크 + 화이트", ["pastel pink", "white trim"], "스위트·프릴·여름 계열의 부드러운 조합"],
        ["palette-black-rose", "블랙 + 로즈", ["black clothes", "rose red accent"], "고딕·파티 계열의 짙은 포인트"],
        ["palette-aqua-white", "아쿠아 + 화이트", ["aqua blue", "white trim"], "수영복·스포츠웨어의 맑은 대비"],
        ["palette-red-gold", "진홍 + 골드", ["vermilion", "gold trim"], "전통복·판타지 의상의 장식성"],
        ["palette-cream-brown", "크림 + 브라운", ["cream color", "brown accent"], "니트·카페·내추럴 캐주얼용"],
        ["palette-monochrome", "모노크롬", ["monochrome clothes", "contrast trim"], "미니멀·테크·에디토리얼 정리"],
      ]),
      makeOutfitDetailGroup("outfit-structure", "3/3 · 칼라와 몸통 구조", 1, [
        ["structure-sailor", "세일러 칼라", "sailor collar", "넓은 칼라와 리본이 만드는 고빈도 스쿨 실루엣"],
        ["structure-bow", "큰 리본 타이", "large ribbon", "가슴·목선에 확실한 시선 포인트"],
        ["structure-corset", "코르셋 보디스", "corset bodice", "고딕·드레스·판타지의 허리 구조"],
        ["structure-high-collar", "하이 칼라", "high collar", "단정하거나 미스터리한 세로선"],
        ["structure-square-neck", "스퀘어 넥", "square neckline", "드레스와 캐주얼 블라우스의 깔끔한 목선"],
        ["structure-piping", "스포티 파이핑", "contrast piping", "스포츠·수영복·테크웨어의 기능적 선"],
        ["structure-obi", "오비·허리 매듭", "obi", "기모노·유카타·전통 퓨전의 중심선"],
        ["structure-capelet", "짧은 케이프렛", "capelet", "판타지·포멀에 한 겹 더하는 어깨 실루엣"],
      ]),
      makeOutfitDetailGroup("outfit-material", "3/3 · 가까이 보이는 소재", 1, [
        ["material-cotton", "매트 코튼", "cotton fabric", "일상·교복의 깨끗한 표면"],
        ["material-knit", "케이블 니트", "cable knit", "포근한 짜임과 부피감"],
        ["material-satin", "광택 새틴", "satin fabric", "드레스·리본에 흐르는 하이라이트"],
        ["material-lace", "섬세한 레이스", "lace trim", "프릴·고딕·전통 퓨전의 가장자리"],
        ["material-chiffon", "가벼운 시폰", "chiffon fabric", "수영복 커버업·드레스의 얇은 레이어"],
        ["material-brocade", "자수 브로케이드", "embroidered brocade", "전통·판타지의 장식 패턴"],
        ["material-jersey", "스포츠 저지", "sports jersey", "활동복의 매끈한 기능성 표면"],
        ["material-velvet", "딥 벨벳", "velvet fabric", "고딕·포멀의 깊은 음영"],
      ]),
      makeOutfitDetailGroup("outfit-trim", "3/3 · 가장자리와 장식", 2, [
        ["trim-frills", "프릴", "frills", "참조에서 자주 쓰인 부드러운 볼륨"],
        ["trim-lace", "레이스 트림", "lace trim", "소매·치마단을 섬세하게 마감"],
        ["trim-pleats", "정돈된 주름", "pleated skirt", "교복·스포츠·아이돌 계열의 리듬"],
        ["trim-embroidery", "꽃 자수", "floral embroidery", "전통·코티지·드레스의 표면 정보"],
        ["trim-buttons", "버튼과 버클", ["decorative buttons", "buckles"], "테일러드·테크·유니폼의 구조감"],
        ["trim-ribbon", "작은 리본 트림", "ribbon trim", "헤어장식과 연결하기 좋은 포인트"],
        ["trim-sequins", "스팽글 포인트", "sequins", "무대·파티의 작은 반짝임"],
        ["trim-star", "별 모티프", "star motif", "마법소녀·유메카와이 쪽 장식"],
      ]),
      makeOutfitDetailGroup("outfit-layer", "3/3 · 겉레이어와 신발", 1, [
        ["layer-cardigan", "카디건", "cardigan", "교복·니트·카페 장면에 자연스러운 한 겹"],
        ["layer-cropped-jacket", "크롭 재킷", "cropped jacket", "스포츠·스트리트·테크 쪽 균형"],
        ["layer-sheer-cover", "시폰 커버업", "sheer cover-up", "여름·수영복 위의 가벼운 레이어"],
        ["layer-apron", "에이프런", "apron", "메이드·카페·코티지의 즉시 읽히는 실루엣"],
        ["layer-detached", "분리 소매", "detached sleeves", "판타지·댄스·고딕의 팔 라인"],
        ["layer-sash", "허리 새시", "waist sash", "드레스·전통복의 중심선을 정리"],
        ["finish-mary-janes", "메리제인", "mary janes", "교복·고딕 쪽의 단정한 발끝"],
        ["finish-sneakers", "청키 스니커즈", "chunky sneakers", "캐주얼·스포츠의 활동성"],
        ["finish-boots", "레이스업 부츠", "lace-up boots", "판타지·고딕·테크의 무게감"],
        ["finish-sandals", "스트랩 샌들", "strappy sandals", "여름·드레스의 가벼운 마무리"],
      ]),
    ],
  });
  insertAfter("outfit", "outfit-subtype-detail", {
    id: "bottomwear",
    section: "outfit",
    title: "바지·치마·드레스 하의는 무엇으로 마무리할까요?",
    description: "레그웨어와 분리해 하의 실루엣을 더 자유롭게 조합합니다.",
    options: [
      makeOption("bottom-pleated", "주름치마", "참조에서 가장 자주 쓰인 가벼운 스쿨·아이돌 실루엣", "outfit", "pleated skirt", { referenceWeight: 2.0 }),
      makeOption("bottom-a-line", "A라인 스커트", "허리에서 부드럽게 퍼지는 기본형", "outfit", "a-line skirt", { referenceWeight: 1.0 }),
      makeOption("bottom-tiered", "티어드 스커트", "레이스·러플을 여러 겹 담는 형태", "outfit", "tiered skirt", { referenceWeight: 1.1 }),
      makeOption("bottom-mini", "미니스커트", "가벼운 데일리·팝·아이돌용", "outfit", "miniskirt", { referenceWeight: 0.85 }),
      makeOption("bottom-pencil", "펜슬 스커트", "포멀·에디토리얼의 세로선", "outfit", "pencil skirt", { referenceWeight: 0.45 }),
      makeOption("bottom-shorts", "쇼츠", "여름·스포츠·레이서의 활동성", "outfit", "shorts", { referenceWeight: 0.95 }),
      makeOption("bottom-denim-shorts", "데님 쇼츠", "캐주얼과 여름의 질감", "outfit", "denim shorts", { referenceWeight: 0.8 }),
      makeOption("bottom-wide-pants", "와이드 팬츠", "중성적인 실루엣과 바람의 흐름", "outfit", "wide-leg pants", { referenceWeight: 0.4 }),
      makeOption("bottom-cargo", "카고 팬츠", "스트리트·테크의 포켓 구조", "outfit", "cargo pants", { referenceWeight: 0.25 }),
      makeOption("bottom-long-dress", "롱 드레스 스커트", "판타지·포멀의 긴 자락", "outfit", "long dress", { referenceWeight: 0.8 }),
    ],
  });
  insertAfter("outfit", "bottomwear", {
    id: "under-layer",
    section: "outfit",
    title: "보이는 수영복 하의·이너 레이어가 있나요?",
    description: "수영복·치마·드레스와 자유롭게 조합할 수 있는 이너 레이어입니다.",
    options: [
      makeOption("under-none", "보이지 않음", "겉옷 실루엣만 유지", "outfit", "fully covered lower body", { referenceWeight: 1.0 }),
      makeOption("under-swim-brief", "클래식 수영 하의", "원피스·비키니의 간결한 기본 하의", "outfit", "swimsuit bottom", { referenceWeight: 0.75 }),
      makeOption("under-highwaist", "하이웨이스트 수영 하의", "복고적이고 안정적인 허리선", "outfit", "high-waist bikini bottom", { referenceWeight: 0.65 }),
      makeOption("under-skirted", "스커트 수영 하의", "수영복 위에 가벼운 스커트 레이어", "outfit", "skirted swimsuit", { referenceWeight: 0.6 }),
      makeOption("under-shorts", "스윔 쇼츠", "스포츠·래시가드와 맞는 기능성 하의", "outfit", "swim shorts", { referenceWeight: 0.65 }),
      makeOption("under-inner-shorts", "이너 쇼츠", "치마 아래에 보이는 안전한 레이어", "outfit", "inner shorts", { referenceWeight: 0.8 }),
      makeOption("under-bloomers", "블루머", "로리타·발레·프릴 의상용의 둥근 레이어", "outfit", "bloomers", { referenceWeight: 0.55 }),
      makeOption("under-slip", "드레스 슬립", "시폰·레이스 아래의 차분한 이너", "outfit", "dress slip", { referenceWeight: 0.5 }),
    ],
  });
  insertAfter("outfit", "outfit-fit", {
    id: "mature-wardrobe-state",
    section: "outfit",
    title: "의상 레이어와 소재 연출은 어떻게 잡을까요?",
    description: "레이어·소재·날씨 변화로 의상에 분위기와 질감을 더합니다.",
    options: [
      makeOption("mature-clothed", "정돈된 의상 유지", "안정적인 기본 실루엣", "outfit", ["fully clothed", "intact outfit"], { referenceWeight: 1.05 }),
      makeOption("mature-cardigan", "오픈 카디건 레이어", "드레스 또는 캐미솔 위의 가벼운 겉옷", "outfit", ["open cardigan", "layered loungewear"], { referenceWeight: 0.8 }),
      makeOption("mature-draped", "어깨에 걸친 재킷", "아우터를 어깨에 느슨하게 두는 화보식 연출", "outfit", ["jacket draped over shoulders", "soft fabric folds"], { referenceWeight: 0.65 }),
      makeOption("mature-collar", "느슨한 칼라와 리본", "정돈된 셔츠의 칼라·리본을 부드럽게 푼 질감", "outfit", ["loose collar", "ribbon detail"], { referenceWeight: 0.75 }),
      makeOption("mature-rain", "비에 젖은 겉옷", "비 오는 창가·테라스에 어울리는 소재 변화", "outfit", ["wet outer clothing", "rainy atmosphere"], { referenceWeight: 0.55 }),
      makeOption("mature-robe", "드레스 위 새틴 로브", "이브닝 드레스 위에 광택 로브를 겹친 실루엣", "outfit", ["satin robe", "evening dress"], { referenceWeight: 0.6 }),
      makeOption("mature-coverup", "시폰 커버업", "수영복 또는 드레스 위의 가벼운 외부 레이어", "outfit", ["sheer cover-up", "layered outfit"], { referenceWeight: 0.65 }),
      makeOption("mature-wrap", "이브닝 랩", "목선·어깨를 감싼 천으로 조명을 받는 패션 연출", "outfit", ["evening wrap", "refined fabric detail"], { referenceWeight: 0.6 }),
    ],
  });
  replaceQuestion("outfit", "legwear", {
    title: "스타킹·양말·맨다리 레이어는 무엇인가요?",
    description: "하의와 분리된 마지막 다리 레이어입니다.",
    section: "outfit",
    options: [
      makeOption("bare-legs", "베어 레그", "양말 없이 깨끗한 다리선", "outfit", "bare legs", { referenceWeight: 0.8 }),
      makeOption("ankle-socks", "앵클 삭스", "가볍고 일상적인 길이", "outfit", "ankle socks", { referenceWeight: 0.7 }),
      makeOption("crew-socks", "루즈 크루 삭스", "참조에 자주 보인 주름진 캐주얼 레이어", "outfit", "loose socks", { referenceWeight: 1.25 }),
      makeOption("kneehighs", "니하이", "무릎 아래에서 끊기는 단정한 양말", "outfit", "kneehighs", { referenceWeight: 0.8 }),
      makeOption("thighhighs", "사이하이", "허벅지 경계가 생기는 긴 양말", "outfit", "thighhighs", { referenceWeight: 1.05 }),
      makeOption("white-thighhighs", "화이트 사이하이", "파스텔·레이스·스위트 스타일의 밝은 포인트", "outfit", "white thighhighs", { referenceWeight: 1.1 }),
      makeOption("pantyhose", "팬티스타킹", "발끝까지 이어지는 매끈한 한 겹", "outfit", "pantyhose", { referenceWeight: 0.65 }),
      makeOption("fishnets", "피시넷", "고딕·펑크용의 망사 질감", "outfit", "fishnet pantyhose", { referenceWeight: 0.55 }),
      makeOption("striped-thighhighs", "스트라이프 사이하이", "레트로·팝한 리듬을 더함", "outfit", "striped thighhighs", { referenceWeight: 0.45 }),
      makeOption("leg-warmers", "레그 워머", "Y2K·댄스·스위트 온 에어 계열", "outfit", "leg warmers", { referenceWeight: 0.85 }),
    ],
  });
  replaceQuestion("props", "hair-accessory", {
    title: "머리 위의 포인트는 무엇인가요?",
    description: "참조 스타일의 리본·클립·꽃 장식을 우선으로 두고 10개로 넓혔습니다.",
    section: "outfit",
    options: [
      makeOption("hair-ribbon", "큰 리본", "스위트·교복·로리타의 대표 포인트", "accessory", "hair ribbon", { referenceWeight: 1.35 }),
      makeOption("hair-clips", "헤어 클립", "작은 별·하트·컬러 핀의 리듬", "accessory", "hair clips", { referenceWeight: 1.25 }),
      makeOption("hair-bow", "보우 클립", "한쪽에 모이는 리본 실루엣", "accessory", "hair bow", { referenceWeight: 1.1 }),
      makeOption("hair-flower", "꽃 장식", "정원·전통·드레스의 부드러운 초점", "accessory", "flower hair ornament", { referenceWeight: 0.9 }),
      makeOption("hair-headband", "헤드밴드", "메이드·프레피·캐주얼의 정돈된 선", "accessory", "headband", { referenceWeight: 0.7 }),
      makeOption("hair-beret", "베레모", "레트로·아티스트·가을 데일리", "accessory", "beret", { referenceWeight: 0.55 }),
      makeOption("hair-maid", "메이드 헤드드레스", "레이스와 프릴의 밀도를 올림", "accessory", "maid headdress", { referenceWeight: 0.65 }),
      makeOption("hair-tiara", "티아라", "공주·발레·포멀의 작은 광점", "accessory", "tiara", { referenceWeight: 0.55 }),
      makeOption("hair-horns", "작은 뿔 장식", "데몬·드래곤의 가벼운 판타지 포인트", "accessory", "horn hair ornament", { referenceWeight: 0.45 }),
      makeOption("hair-halo", "후광·별 링", "천사·아이돌·드림 계열의 상단 광원", "accessory", "halo", { referenceWeight: 0.55 }),
    ],
  });
  replaceQuestion("props", "jewelry", {
    title: "얼굴 가까이에 반짝일 장식은 무엇인가요?",
    description: "목·귀·얼굴 프레임에 가까운 장식 10개를 분리해 고릅니다.",
    section: "outfit",
    options: [
      makeOption("jewel-choker", "블랙 초커", "참조에 반복된 고딕·스트리트의 핵심", "accessory", "black choker", { referenceWeight: 1.25 }),
      makeOption("jewel-ribbon-choker", "리본 초커", "레이스·프릴 의상과 가까운 포인트", "accessory", "ribbon choker", { referenceWeight: 1.0 }),
      makeOption("jewel-pearl", "진주", "포멀·드레스·클래식한 광택", "accessory", "pearl jewelry", { referenceWeight: 0.7 }),
      makeOption("jewel-drop-earrings", "드롭 이어링", "얼굴 옆 세로선을 늘림", "accessory", "drop earrings", { referenceWeight: 0.65 }),
      makeOption("jewel-hoops", "후프 이어링", "레트로·스트리트의 둥근 반사", "accessory", "hoop earrings", { referenceWeight: 0.5 }),
      makeOption("jewel-star", "별 이어링", "아이돌·드림 계열의 작은 광점", "accessory", "star earrings", { referenceWeight: 0.65 }),
      makeOption("jewel-heart", "하트 이어링", "스위트·로맨스와 자연스럽게 연결", "accessory", "heart earrings", { referenceWeight: 0.75 }),
      makeOption("jewel-crystal", "크리스털 펜던트", "마법·보석·차가운 하이라이트", "accessory", "crystal pendant", { referenceWeight: 0.6 }),
      makeOption("jewel-face-chain", "페이스 체인", "고딕·오컬트의 섬세한 금속선", "accessory", "face chain", { referenceWeight: 0.45 }),
      makeOption("jewel-glasses", "안경", "지적·캠퍼스·에디토리얼용의 얼굴 프레임", "accessory", "glasses", { referenceWeight: 0.6 }),
    ],
  });
  replaceQuestion("props", "hand-prop", {
    title: "손에 들거나 사용하는 물건은 무엇인가요?",
    description: "소품은 한 가지로 제한하고, 양손 제스처와 충돌하는 카드는 자동으로 비활성화합니다.",
    section: "composition",
    options: [
      makeOption("prop-none", "없음", "손 제스처를 가장 자유롭게 사용", "accessory", "empty hands", { referenceWeight: 1.4, handDemand: 0 }),
      makeOption("prop-bouquet", "꽃다발", "로맨스·포멀·정원의 부드러운 초점", "accessory", "bouquet", { referenceWeight: 0.95, handDemand: 1 }),
      makeOption("prop-book", "책", "카페·방·마법 서재의 이야기성", "accessory", "book", { referenceWeight: 0.65, handDemand: 1 }),
      makeOption("prop-phone", "스마트폰", "데일리·시티팝·셀피의 생활감", "accessory", "smartphone", { referenceWeight: 0.65, handDemand: 1 }),
      makeOption("prop-umbrella", "우산", "비·도시·뒷모습 구도의 축", "accessory", "umbrella", { referenceWeight: 0.7, handDemand: 1 }),
      makeOption("prop-drink", "음료", "카페·여름·데이트의 작은 색 포인트", "accessory", "drink", { referenceWeight: 0.55, handDemand: 1 }),
      makeOption("prop-plush", "플러시", "방·파스텔·스위트 연출의 말랑한 전경", "accessory", "plushie", { referenceWeight: 0.75, handDemand: 2 }),
      makeOption("prop-microphone", "마이크", "아이돌·무대·노래하는 동작", "accessory", "microphone", { referenceWeight: 0.55, handDemand: 1 }),
      makeOption("prop-camera", "카메라", "아티스트·여행·시선 연출", "accessory", "camera", { referenceWeight: 0.45, handDemand: 2 }),
      makeOption("prop-magic-wand", "마법 지팡이", "판타지·별·입자의 방향을 잡음", "accessory", "magic wand", { referenceWeight: 0.55, handDemand: 1 }),
    ],
  });

  // 14–21. Separate screen structure, body action, hand action, gaze, and expression.
  insertAfter("camera", "framing", {
    id: "composition-layout",
    section: "composition",
    title: "구도 자체의 화면 구조는 어떻게 놓을까요?",
    description: "카메라 높이·방향과 분리한 화면 배치입니다.",
    options: [
      makeOption("layout-centered", "정중앙", "아이콘처럼 또렷한 대칭 중심", "composition", "centered composition", { referenceWeight: 0.9 }),
      makeOption("layout-thirds", "3분할", "한쪽 여백과 배경 이야기를 남김", "composition", "rule of thirds", { referenceWeight: 0.65 }),
      makeOption("layout-diagonal", "대각선 흐름", "몸·리본·소품이 화면을 가로지름", "composition", "diagonal composition", { referenceWeight: 1.0 }),
      makeOption("layout-symmetry", "대칭", "궁전·스튜디오·인형 같은 균형", "composition", "symmetrical composition", { referenceWeight: 0.6 }),
      makeOption("layout-frame", "프레임 인 프레임", "창·문·꽃으로 인물을 둘러쌈", "composition", "frame within frame", { referenceWeight: 0.65 }),
      makeOption("layout-foreground", "큰 전경", "꽃·리본·손을 앞에 두어 깊이를 만듦", "composition", "foreground elements", { referenceWeight: 0.8 }),
      makeOption("layout-layered", "레이어드 깊이", "전경·중경·배경을 모두 살림", "composition", "layered composition", { referenceWeight: 1.0 }),
      makeOption("layout-negative", "여백 중심", "미니멀한 배경과 작은 인물", "composition", "negative space", { referenceWeight: 0.4 }),
      makeOption("layout-split", "스플릿 레이아웃", "색·거울·양면을 나눈 그래픽 구성", "composition", "split composition", { referenceWeight: 0.45 }),
      makeOption("layout-spiral", "원형 흐름", "꽃잎·마법·머리카락이 감싸는 구도", "composition", "spiral composition", { referenceWeight: 0.5 }),
    ],
  });
  replaceQuestion("camera", "framing", {
    title: "화면에 어디까지 담을까요?",
    description: "얼굴부터 넓은 배경까지 10개의 프레이밍을 선택합니다.",
    section: "composition",
    visual: true,
    options: [
      makeOption("extreme-close-up", "익스트림 클로즈업", "눈·입술·얼굴 포인트만 크게", "composition", "extreme close-up", { referenceWeight: 0.75 }),
      makeOption("close-up", "클로즈업", "얼굴과 표정에 집중", "composition", "close-up", { referenceWeight: 1.05 }),
      makeOption("portrait", "포트레이트", "머리와 어깨를 중심으로", "composition", "portrait", { referenceWeight: 0.85 }),
      makeOption("upper-body", "상반신", "손동작 일부까지 담는 기준 프레임", "composition", "upper body", { referenceWeight: 1.25 }),
      makeOption("waist-up", "웨이스트업", "의상 상단과 제스처의 균형", "composition", "waist up", { referenceWeight: 0.7 }),
      makeOption("cowboy-shot", "카우보이 샷", "허벅지 위까지, 의상과 손의 균형", "composition", "cowboy shot", { referenceWeight: 1.0 }),
      makeOption("knees-up", "니 샷", "무릎 위까지 담는 패션 구도", "composition", "knees up", { referenceWeight: 0.55 }),
      makeOption("full-body", "전신", "신발까지 모든 실루엣을 확인", "composition", "full body", { referenceWeight: 1.3 }),
      makeOption("wide-shot", "와이드 샷", "인물과 장소의 비중을 함께", "composition", "wide shot", { referenceWeight: 0.65 }),
      makeOption("very-wide", "베리 와이드", "큰 세계 속 작은 인물의 서사", "composition", "very wide shot", { referenceWeight: 0.45 }),
    ],
  });
  replaceQuestion("camera", "angle", {
    id: "camera-direction",
    title: "카메라는 어느 방향에서 바라보나요?",
    description: "높이는 다음 질문에서 따로 고릅니다.",
    section: "composition",
    options: [
      makeOption("camera-front", "정면", "가장 직접적인 시선과 표정", "composition", "front view", { referenceWeight: 1.2 }),
      makeOption("camera-three-quarter", "정면 3/4", "얼굴·어깨·의상을 함께 보이는 기본", "composition", "three-quarter view", { referenceWeight: 0.85 }),
      makeOption("camera-side", "측면", "동작 방향과 실루엣을 강조", "composition", "side view", { referenceWeight: 0.6 }),
      makeOption("camera-profile", "완전한 프로필", "코와 턱선이 옆으로 선명", "composition", "profile", { referenceWeight: 0.45 }),
      makeOption("camera-back", "등 뒤", "어깨 너머의 배경과 머리 장식", "composition", "from behind", { referenceWeight: 0.55 }),
      makeOption("camera-over-shoulder", "오버 숄더", "가까운 어깨 너머의 거리감", "composition", "over-the-shoulder shot", { referenceWeight: 0.6 }),
      makeOption("camera-looking-back", "뒤돌아보기", "몸은 멀어지고 얼굴은 카메라로", "composition", "looking back", { referenceWeight: 0.9 }),
      makeOption("camera-pov", "POV", "관객이 장면 안에 있는 듯한 시점", "composition", "pov", { referenceWeight: 0.45 }),
      makeOption("camera-mirror", "거울 너머", "반사와 이중 프레임의 에디토리얼", "composition", "mirror reflection", { referenceWeight: 0.4 }),
      makeOption("camera-overhead", "완전한 탑뷰", "침대·꽃·원형 레이아웃을 한 번에", "composition", "top-down view", { referenceWeight: 0.55 }),
    ],
  });
  insertAfter("camera", "camera-direction", {
    id: "camera-height",
    section: "composition",
    title: "카메라 높이는 어디에 있나요?",
    description: "방향과 분리하면 과도한 앵글 태그 충돌을 줄일 수 있습니다.",
    options: [
      makeOption("height-eye", "눈높이", "안정적이고 자연스러운 기준", "composition", "eye-level shot", { referenceWeight: 1.1 }),
      makeOption("height-slight-high", "살짝 위", "얼굴과 어깨를 가볍게 내려다봄", "composition", "slightly high angle", { referenceWeight: 0.65 }),
      makeOption("height-high", "하이앵글", "작고 섬세한 인상과 배경 패턴", "composition", "high angle", { referenceWeight: 0.75 }),
      makeOption("height-top", "바로 위", "눕거나 소품에 둘러싸인 장면", "composition", "from above", { referenceWeight: 0.8 }),
      makeOption("height-slight-low", "살짝 아래", "다리·의상 자락을 조금 더 길게", "composition", "slightly low angle", { referenceWeight: 0.55 }),
      makeOption("height-low", "로우앵글", "동작과 하늘·천장을 크게", "composition", "low angle", { referenceWeight: 0.65 }),
      makeOption("height-ground", "지면 가까이", "신발·꽃·물보라를 전경에 크게", "composition", "ground-level view", { referenceWeight: 0.35 }),
      makeOption("height-dutch", "기울어진 높이", "팝·긴장·움직임을 더하는 더치 앵글", "composition", "dutch angle", { referenceWeight: 0.85 }),
    ],
  });
  replaceQuestion("camera", "pose", {
    id: "body-action",
    title: "몸의 가장 큰 동작 구조는 무엇인가요?",
    description: "손의 세부 동작과 분리해 몸 전체의 축을 먼저 정합니다.",
    section: "composition",
    options: [
      makeOption("action-standing", "편안히 서기", "한쪽 다리에 무게를 둔 기본", "action", ["standing", "contrapposto"], { referenceWeight: 0.85 }),
      makeOption("action-sitting", "앉기", "의자·바닥·창가에서 안정적인 구조", "action", "sitting", { referenceWeight: 1.15 }),
      makeOption("action-leaning", "기대기", "벽·창·소품에 몸을 가볍게 기울임", "action", "leaning", { referenceWeight: 0.9 }),
      makeOption("action-walking", "걷기", "한 발 앞, 머리와 옷자락이 흐름", "action", ["walking", "mid-stride"], { referenceWeight: 0.75 }),
      makeOption("action-running", "달리기", "상체를 기울인 큰 속도감", "action", ["running", "dynamic pose"], { referenceWeight: 0.55 }),
      makeOption("action-dancing", "춤추기", "팔과 다리가 곡선을 만드는 무대 동작", "action", ["dancing", "dynamic pose"], { referenceWeight: 0.75 }),
      makeOption("action-floating", "부유하기", "중력 없이 머리·천·입자가 퍼짐", "action", ["floating", "weightlessness"], { referenceWeight: 0.85 }),
      makeOption("action-kneeling", "무릎을 굽히기", "낮은 중심과 정면 실루엣", "action", "kneeling", { referenceWeight: 0.55 }),
      makeOption("action-reclining", "기대어 눕기", "소파·꽃·침구와 긴 선을 만듦", "action", "reclining", { referenceWeight: 0.65 }),
      makeOption("action-turning", "돌아서는 순간", "머리카락·치맛자락이 따라오는 회전", "action", "turning around", { referenceWeight: 0.7 }),
    ],
  });
  replaceQuestion("camera", "gesture", {
    id: "hand-action",
    title: "손은 무엇을 하고 있나요?",
    description: "소품의 손 점유와 충돌하는 양손 동작은 카드에서 비활성화됩니다.",
    section: "composition",
    options: [
      makeOption("hands-relaxed", "자연스럽게 내림", "손가락 힘을 빼고 몸 옆에 둠", "action", "relaxed hands", { referenceWeight: 0.8, handDemand: 0 }),
      makeOption("hands-wave", "손 흔들기", "한 손을 들어 밝게 인사", "action", "waving", { referenceWeight: 0.7, handDemand: 1 }),
      makeOption("hands-peace", "브이 사인", "얼굴 옆 한 손의 팝한 포즈", "action", "peace sign", { referenceWeight: 0.65, handDemand: 1 }),
      makeOption("hands-face", "얼굴 가까이", "손끝이 볼·입술·턱 근처에 머묾", "action", "hand near face", { referenceWeight: 0.95, handDemand: 1 }),
      makeOption("hands-hair", "머리카락 만지기", "한 가닥을 잡거나 귀 뒤로 넘김", "action", "touching own hair", { referenceWeight: 0.75, handDemand: 1 }),
      makeOption("hands-collarbone", "쇄골 가까이", "조용하고 우아한 상반신 포즈", "action", "hand near collarbone", { referenceWeight: 0.8, handDemand: 1 }),
      makeOption("hands-skirt", "치맛자락 잡기", "한 손 또는 양손으로 자락을 가볍게 듦", "action", "holding skirt", { referenceWeight: 0.7, handDemand: 1 }),
      makeOption("hands-heart", "두 손 하트", "손을 모아 하트 모양을 만듦", "action", "heart hands", { referenceWeight: 0.65, handDemand: 2 }),
      makeOption("hands-open", "팔을 크게 펼침", "환영·자유·무대의 넓은 동작", "action", "arms spread", { referenceWeight: 0.55, handDemand: 2 }),
      makeOption("hands-reach", "카메라로 손 뻗기", "강한 원근과 관객 상호작용", "action", ["reaching towards viewer", "foreshortening"], { referenceWeight: 0.85, handDemand: 1 }),
    ],
  });
  replaceQuestion("camera", "gaze", {
    title: "시선은 어디에 머무나요?",
    description: "강한 감정을 만들되 선택지를 6개로 정리해 포즈와의 충돌을 줄였습니다.",
    section: "composition",
    options: [
      makeOption("gaze-viewer", "카메라", "가장 직접적인 눈맞춤", "composition", "looking at viewer", { referenceWeight: 2.5 }),
      makeOption("gaze-side", "화면 밖 옆", "무언가를 생각하는 듯한 거리감", "composition", "looking to the side", { referenceWeight: 0.7 }),
      makeOption("gaze-down", "아래", "수줍음·고요함·소품 집중", "composition", "looking down", { referenceWeight: 0.65 }),
      makeOption("gaze-up", "위", "하늘·빛·큰 공간을 향한 시선", "composition", "looking up", { referenceWeight: 0.55 }),
      makeOption("gaze-partner", "파트너", "둘 사이의 상호작용에 시선을 고정", "composition", "looking at another", { visibleWhen: { "scene-cast": ["cast-partner"] }, referenceWeight: 0.65 }),
      makeOption("gaze-away", "멀리", "서정적·몽환적인 장면의 여백", "composition", "looking away", { referenceWeight: 0.6 }),
    ],
  });
  replaceQuestion("camera", "expression", {
    title: "얼굴에는 어느 정도의 감정을 남길까요?",
    description: "가장 많이 쓰이는 표정 결을 8개로 정리했습니다.",
    section: "composition",
    options: [
      makeOption("expression-soft", "부드러운 미소", "참조 스타일에 가장 잘 맞는 다정한 기본", "composition", "soft smile", { referenceWeight: 1.2 }),
      makeOption("expression-bright", "밝은 미소", "팝·아이돌·여름의 큰 에너지", "composition", "bright smile", { referenceWeight: 0.85 }),
      makeOption("expression-shy", "수줍음", "볼 홍조와 작은 시선 회피", "composition", ["shy", "blush"], { referenceWeight: 0.95 }),
      makeOption("expression-dreamy", "몽환", "힘을 뺀 눈꺼풀과 부드러운 입", "composition", "dreamy expression", { referenceWeight: 0.85 }),
      makeOption("expression-calm", "담담함", "감정을 절제한 깨끗한 얼굴", "composition", "neutral expression", { referenceWeight: 0.75 }),
      makeOption("expression-playful", "장난스러움", "가벼운 미소와 팝한 리듬", "composition", "playful expression", { referenceWeight: 0.7 }),
      makeOption("expression-surprised", "놀람", "커진 눈과 열린 표정", "composition", "surprised", { referenceWeight: 0.5 }),
      makeOption("expression-melancholy", "쓸쓸함", "비·밤·블루아워에 어울리는 서정성", "composition", "melancholic expression", { referenceWeight: 0.6 }),
    ],
  });
  replaceQuestion("camera", "composition-extra", {
    title: "화면 구조에 한 가지 장치를 더할까요?",
    description: "참조에서 자주 보인 깊이·반사·입자·인쇄감을 10개로 확장합니다.",
    section: "composition",
    options: [
      makeOption("extra-dof", "얕은 심도", "얼굴을 남기고 배경을 부드럽게 날림", "background", "depth of field", { referenceWeight: 1.1 }),
      makeOption("extra-bokeh", "보케", "둥근 빛망울로 거리감을 만듦", "background", "bokeh", { referenceWeight: 0.8 }),
      makeOption("extra-reflection", "반사", "거울·물·창에 두 번째 레이어", "composition", "reflection", { referenceWeight: 0.65 }),
      makeOption("extra-foreground", "전경 꽃·리본", "카메라 가까운 장식으로 깊이를 만듦", "background", "foreground flowers", { referenceWeight: 0.95 }),
      makeOption("extra-sparkles", "스파클", "참조에서 가장 자주 쓰인 작은 광점", "background", "sparkles", { referenceWeight: 2.2 }),
      makeOption("extra-petals", "흐르는 꽃잎", "바람과 방향을 보이는 부유물", "background", "falling petals", { referenceWeight: 0.9 }),
      makeOption("extra-hearts", "떠다니는 하트", "파스텔·로맨스·스위트 포인트", "background", "floating hearts", { referenceWeight: 1.15 }),
      makeOption("extra-ribbons", "부유 리본", "프레임을 감싸는 곡선", "background", "floating ribbons", { referenceWeight: 0.75 }),
      makeOption("extra-halftone", "하프톤", "레트로 포스터 같은 인쇄감", "background", "halftone texture", { referenceWeight: 0.45 }),
      makeOption("extra-film", "필름 그레인", "향수 어린 입자와 색감", "background", "film grain", { referenceWeight: 0.55 }),
    ],
  });

  // The recommendation pool is deliberately not uniform. The six wardrobe
  // families below are the user's recurring visual vocabulary; low-frequency
  // branches remain available but do not crowd them out in random suggestions.
  const wardrobeReferenceWeights = {
    "wardrobe-uniform": 2.35,
    "wardrobe-swim": 2.3,
    "wardrobe-casual": 2.1,
    "wardrobe-gothic": 1.95,
    "wardrobe-traditional": 1.72,
    "wardrobe-sports": 1.45,
    "wardrobe-fantasy": 1.05,
    "wardrobe-professional": 0.72,
    "wardrobe-formal": 0.58,
    "wardrobe-tech": 0.22,
  };
  getQuestion("outfit", "wardrobe")?.options.forEach((item) => {
    if (wardrobeReferenceWeights[item.id] != null) {
      item.referenceWeight = wardrobeReferenceWeights[item.id];
      item.referencePriority = wardrobeReferenceWeights[item.id];
    }
  });

  const clearLegacyOptionArt = (options) => {
    (options || []).forEach((item) => {
      if (typeof item.image === "string" && /^assets\/(?:reference|generated)(?:\/|$)/.test(item.image)) {
        delete item.image;
        item.noVisual = true;
      }
    });
  };
  data.stages.forEach((stage) => stage.questions.forEach((question) => clearLegacyOptionArt(question.options)));
  data.stages.forEach((stage) => stage.questions.forEach((question) => {
    (question.detailGroups || []).forEach((group) => clearLegacyOptionArt(group.options));
  }));
  Object.values(data.outfitPacks || {}).forEach(clearLegacyOptionArt);
  Object.values(data.dynamicPacks || {}).forEach((packs) => Object.values(packs).forEach(clearLegacyOptionArt));
  Object.values(data.detailPacks || {}).forEach((groups) => groups.forEach((group) => clearLegacyOptionArt(group.options)));

  // Every selectable card receives a crop of a dedicated ImageGen thumbnail
  // tile. A tile is never a stage banner: it is a small, option-specific visual
  // intended to make hair length, wardrobe silhouettes, props, and framing
  // readable before the user has to infer them from a tag label.
  const thumbnailRoot = "assets/visual-guides/options/";
  const thumbnailAtlases = {
    "scene-solo": ["thumb-scene-solo-v1.png"],
    "scene-partner": ["thumb-scene-partner-v1.png"],
    "scene-relationship": ["thumb-scene-relationship-v1.png"],
    "scene-cast-v2": ["thumb-scene-cast-v2.png"],
    "scene-solo-v2": ["thumb-scene-solo-v2.png"],
    "scene-partner-archetype-v2": ["thumb-scene-partner-archetype-v2.png"],
    "scene-partner-action-v2": ["thumb-scene-partner-action-v2.png"],
    "scene-romance-tone-v2": ["thumb-scene-romance-tone-v2.png"],
    "character-archetypes": ["thumb-character-archetypes-v1.png"],
    "character-archetypes-v2": ["thumb-character-archetypes-v2.png"],
    "character-human-variants-v2": ["thumb-character-human-variants-v2.png"],
    "character-animal-variants-v2": ["thumb-character-animal-variants-v2.png"],
    "character-elf-variants-v2": ["thumb-character-elf-variants-v2.png"],
    "character-angel-variants-v2": ["thumb-character-angel-variants-v2.png"],
    "character-demon-variants-v2": ["thumb-character-demon-variants-v2.png"],
    "character-vampire-variants-v2": ["thumb-character-vampire-variants-v2.png"],
    "character-fairy-variants-v2": ["thumb-character-fairy-variants-v2.png"],
    "character-android-variants-v2": ["thumb-character-android-variants-v2.png"],
    "character-doll-variants-v2": ["thumb-character-doll-variants-v2.png"],
    "character-dragon-variants-v2": ["thumb-character-dragon-variants-v2.png"],
    "age-impression-v2": ["thumb-age-impression-v2.png"],
    "body-height-v2": ["thumb-body-height-v2.png"],
    "body-type-v2": ["thumb-body-type-v2.png"],
    "hair-lengths": ["thumb-hair-lengths-v1.png"],
    "hair-style-bangs": ["thumb-hair-style-bangs-v1.png"],
    "hair-lengths-v3": ["thumb-hair-lengths-v3.png"],
    "hair-styles-v2": ["thumb-hair-styles-v2.png"],
    "hair-bangs-v2": ["thumb-hair-bangs-v2.png"],
    "hair-treatment-v2": ["thumb-hair-treatment-v2.png"],
    "hair-colors": ["thumb-hair-colors-a-v1.png", "thumb-hair-colors-b-v1.png", "thumb-hair-colors-c-v1.png"],
    "hair-colors-v2": ["thumb-hair-colors-a-v2.png", "thumb-hair-colors-b-v2.png", "thumb-hair-colors-c-v2.png"],
    "hair-style-details-v2": ["thumb-hair-style-details-v2.png"],
    "hair-detail-bangs-v2": ["thumb-hair-detail-bangs-v2.png"],
    "hair-detail-texture-v2": ["thumb-hair-detail-texture-v2.png"],
    "hair-color-layout-v2": ["thumb-hair-color-layout-v2.png"],
    "hair-color-finish-v2": ["thumb-hair-color-finish-v2.png"],
    "eyes-face-body": ["thumb-eyes-face-body-v1.png", "thumb-eyes-face-body-b-v1.png"],
    "eyes-colors-a-v2": ["thumb-eyes-colors-a-v2.png"],
    "eyes-colors-b-v2": ["thumb-eyes-colors-b-v2.png"],
    "eyes-colors-v2": ["thumb-eyes-colors-a-v2.png", "thumb-eyes-colors-b-v2.png"],
    "eye-pupil-v2": ["thumb-eye-pupil-v2.png"],
    "skin-face-v2": ["thumb-skin-face-v2.png"],
    "face-point-v2": ["thumb-face-point-v2.png"],
    "character-fantasy-ears-v2": ["thumb-character-fantasy-ears-v2.png"],
    "character-fantasy-traits-v2": ["thumb-character-fantasy-traits-v2.png"],
    "eye-shape-v2": ["thumb-eye-shape-v2.png"],
    "eye-detail-pupil-v2": ["thumb-eye-detail-pupil-v2.png"],
    "eye-frame-v2": ["thumb-eye-frame-v2.png"],
    "face-shape-v2": ["thumb-face-shape-v2.png"],
    "nose-shape-v2": ["thumb-nose-shape-v2.png"],
    "mouth-shape-v2": ["thumb-mouth-shape-v2.png"],
    "ear-shape-v2": ["thumb-ear-shape-v2.png"],
    "facial-detail-v2": ["thumb-facial-detail-v2.png"],
    "body-bust-v2": ["thumb-body-bust-v2.png"],
    "body-proportion-v2": ["thumb-body-proportion-v2.png"],
    "body-torso-v2": ["thumb-body-torso-v2.png"],
    "body-hips-v2": ["thumb-body-hips-v2.png"],
    "world-setting": ["thumb-world-setting-v1.png"],
    "mood-lighting": ["thumb-mood-lighting-v1.png"],
    "concept-genre-v2": ["thumb-concept-genre-v2.png"],
    "concept-style-v3": ["thumb-concept-style-v3.png"],
    "concept-setting-v3": ["thumb-concept-setting-v3.png"],
    "concept-weather-v3": ["thumb-concept-weather-v3.png"],
    "concept-palette-v3": ["thumb-concept-palette-v3.png"],
    "mood-tone-a-v2": ["thumb-mood-tone-a-v2.png"],
    "mood-tone-b-v2": ["thumb-mood-tone-b-v2.png"],
    "mood-lighting-v2": ["thumb-mood-lighting-v2.png"],
    "mood-atmosphere-v2": ["thumb-mood-atmosphere-v2.png"],
    "mood-camera-finish-v2": ["thumb-mood-camera-finish-v2.png"],
    "finish-density-v2": ["thumb-finish-density-v2.png"],
    "finish-aspect-v2": ["thumb-finish-aspect-v2.png"],
    "finish-emphasis-v2": ["thumb-finish-emphasis-v2.png"],
    "outfit-families": ["thumb-outfit-families-v1.png"],
    "outfit-academy-casual": ["thumb-outfit-academy-casual-v1.png"],
    "outfit-casual": ["thumb-outfit-casual-b-v1.png"],
    "outfit-formal-professional": ["thumb-outfit-formal-professional-v1.png"],
    "outfit-summer-sport": ["thumb-outfit-summer-sport-v1.png"],
    "outfit-trad-goth-fantasy": ["thumb-outfit-trad-goth-fantasy-v1.png"],
    "outfit-components": ["thumb-outfit-components-v1.png"],
    "outfit-components-plus": ["thumb-outfit-components-v1.png", "thumb-outfit-academy-casual-v1.png"],
    "outfit-materials": ["thumb-outfit-materials-v1.png"],
    "props-accessories": ["thumb-props-accessories-v1.png"],
    "props-hair-accessory": ["thumb-props-hair-accessory-v2.png"],
    "props-jewelry": ["thumb-props-jewelry-v2.png"],
    "props-hand": ["thumb-props-hand-v2.png"],
    "props-decor": ["thumb-props-decor-v2.png"],
    "outfit-family-v2": ["thumb-outfit-family-v2.png"],
    "outfit-swim-v2": ["thumb-outfit-swim-v2.png"],
    "outfit-swim-details-v2": ["thumb-outfit-swim-details-v2.png"],
    "outfit-uniform-v2": ["thumb-outfit-uniform-v2.png"],
    "outfit-uniform-details-v2": ["thumb-outfit-uniform-details-v2.png"],
    "outfit-casual-v2": ["thumb-outfit-casual-v2.png"],
    "outfit-casual-details-v2": ["thumb-outfit-casual-details-v2.png"],
    "outfit-formal-v2": ["thumb-outfit-formal-v2.png"],
    "outfit-professional-v2": ["thumb-outfit-professional-v2.png"],
    "outfit-professional-details-v2": ["thumb-outfit-professional-details-v2.png"],
    "outfit-sports-v2": ["thumb-outfit-sports-v2.png"],
    "outfit-sports-details-v2": ["thumb-outfit-sports-details-v2.png"],
    "outfit-fantasy-v4": ["thumb-outfit-fantasy-v4.png"],
    "outfit-fantasy-details-v2": ["thumb-outfit-fantasy-details-v2.png"],
    "outfit-gothic-v3": ["thumb-outfit-gothic-v3.png"],
    "outfit-gothic-details-v2": ["thumb-outfit-gothic-details-v2.png"],
    "outfit-traditional-v2": ["thumb-outfit-traditional-v2.png"],
    "outfit-traditional-details-v2": ["thumb-outfit-traditional-details-v2.png"],
    "outfit-formal-details-v2": ["thumb-outfit-formal-details-v2.png"],
    "outfit-tech-v2": ["thumb-outfit-tech-v2.png"],
    "outfit-tech-details-v2": ["thumb-outfit-tech-details-v2.png"],
    "outfit-bottomwear-v2": ["thumb-outfit-bottomwear-v2.png"],
    "outfit-underlayer-v2": ["thumb-outfit-underlayer-v2.png"],
    "outfit-fit-v2": ["thumb-outfit-fit-v2.png"],
    "outfit-legwear-v2": ["thumb-outfit-legwear-v2.png"],
    "outfit-footwear-v2": ["thumb-outfit-footwear-v2.png"],
    "outfit-material-v2": ["thumb-outfit-material-a-v2.png", "thumb-outfit-material-b-v2.png"],
    "outfit-mature-state-v2": ["thumb-outfit-mature-state-v2.png"],
    "camera-framing": ["thumb-camera-framing-v1.png"],
    "camera-pose": ["thumb-camera-pose-v1.png"],
    "camera-framing-v2": ["thumb-camera-framing-v2.png"],
    "camera-layout-v2": ["thumb-camera-layout-v2.png"],
    "camera-direction-v2": ["thumb-camera-direction-v2.png"],
    "camera-height-v2": ["thumb-camera-height-v2.png"],
    "camera-body-action-v2": ["thumb-camera-body-action-v2.png"],
    "camera-hand-action-v2": ["thumb-camera-hand-action-v2.png"],
    "camera-gaze-expression-v2": ["thumb-camera-gaze-expression-v2.png"],
    "camera-expression-extra-v2": ["thumb-camera-expression-extra-v2.png"],
  };
  const thumbnailCapacity = 12;
  const assignThumbnail = (item, atlasName, tile, audit = "provisional") => {
    const pages = thumbnailAtlases[atlasName];
    if (!item || !pages?.length || !Number.isInteger(tile) || tile < 0) return;
    const requestedPage = Math.floor(tile / thumbnailCapacity);
    // Legacy broad sheets may be used only while a later explicit mapping
    // replaces them. Preserve their historical wrap behaviour for that
    // provisional pass, but never permit it in a verified manifest.
    const page = pages[requestedPage] ? requestedPage : requestedPage % pages.length;
    if (!pages[page] || (audit !== "provisional" && requestedPage !== page)) {
      throw new Error(`Thumbnail atlas ${atlasName} has no page for tile ${tile}.`);
    }
    item.image = `${thumbnailRoot}${pages[page]}`;
    item.noVisual = false;
    item.sprite = {
      columns: 4,
      rows: 3,
      index: tile % thumbnailCapacity,
    };
    // Keep the selection-to-tile decision inspectable. The QA script reads this
    // marker so a future broad sequential fallback cannot silently replace an
    // option-specific crop with an unrelated image.
    item.thumbnailAudit = { atlasName, tile, status: audit };
  };
  const assignThumbnails = (options, atlasName, offset = 0, audit = "provisional") => {
    (options || []).forEach((item, index) => assignThumbnail(item, atlasName, offset + index, audit));
  };
  const thumbnailOptionId = (item) => item?.id || item?.[0];
  const assignExactThumbnailSet = (options, atlasName, ids, auditKey) => {
    const byId = new Map((options || []).filter(Boolean).map((item) => [thumbnailOptionId(item), item]));
    const expected = Array.isArray(ids) ? ids : [];
    expected.forEach((id, tile) => {
      const item = byId.get(id);
      if (!item) throw new Error(`Thumbnail manifest ${auditKey} references missing option ${id}.`);
      assignThumbnail(item, atlasName, tile, `verified:${auditKey}`);
      byId.delete(id);
    });
    if (byId.size) {
      throw new Error(`Thumbnail manifest ${auditKey} is missing: ${[...byId.keys()].join(", ")}.`);
    }
  };
  const assignVerifiedThumbnailMap = (options, auditKey, mapping) => {
    const byId = new Map((options || []).filter(Boolean).map((item) => [thumbnailOptionId(item), item]));
    Object.entries(mapping || {}).forEach(([id, spec]) => {
      const item = byId.get(id);
      const [atlasName, tile] = Array.isArray(spec) ? spec : [];
      if (!item) throw new Error(`Thumbnail manifest ${auditKey} references missing option ${id}.`);
      assignThumbnail(item, atlasName, tile, `verified:${auditKey}`);
      byId.delete(id);
    });
    if (byId.size) {
      throw new Error(`Thumbnail manifest ${auditKey} is missing: ${[...byId.keys()].join(", ")}.`);
    }
  };
  const questionAtlas = {
    "scene-cast": "scene-cast-v2",
    "solo-scene-activity": "scene-solo-v2",
    "partner-archetype": "scene-partner-archetype-v2",
    "partner-action": "scene-partner-action-v2",
    "mature-romance-tone": "scene-romance-tone-v2",
    "character-archetype": "character-archetypes-v2",
    "age-impression": "age-impression-v2",
    "hair-length": "hair-lengths-v3",
    "hair-style": "hair-styles-v2",
    "hair-bang": "hair-bangs-v2",
    "hair-color": "hair-colors-v2",
    "hair-color-treatment": "hair-treatment-v2",
    eyes: "eyes-colors-v2",
    "eye-pupil": "eye-pupil-v2",
    "skin-tone": "skin-face-v2",
    "face-point": "face-point-v2",
    height: "body-height-v2",
    "body-type": "body-type-v2",
    genre: "concept-genre-v2",
    "reference-style": "concept-style-v3",
    setting: "concept-setting-v3",
    "time-weather": "concept-weather-v3",
    palette: "concept-palette-v3",
    tone: "mood-tone-a-v2",
    lighting: "mood-lighting-v2",
    atmosphere: "mood-atmosphere-v2",
    "camera-finish": "mood-camera-finish-v2",
    wardrobe: "outfit-family-v2",
    bottomwear: "outfit-bottomwear-v2",
    "under-layer": "outfit-underlayer-v2",
    "outfit-fit": "outfit-fit-v2",
    "mature-wardrobe-state": "outfit-mature-state-v2",
    material: "outfit-material-v2",
    legwear: "outfit-legwear-v2",
    footwear: "outfit-footwear-v2",
    "hair-accessory": "props-hair-accessory",
    jewelry: "props-jewelry",
    "hand-prop": "props-hand",
    "scene-decor": "props-decor",
    framing: "camera-framing-v2",
    "composition-layout": "camera-layout-v2",
    "camera-direction": "camera-direction-v2",
    "camera-height": "camera-height-v2",
    "body-action": "camera-body-action-v2",
    "hand-action": "camera-hand-action-v2",
    gaze: "camera-gaze-expression-v2",
    expression: "camera-gaze-expression-v2",
    "composition-extra": "camera-expression-extra-v2",
    density: "finish-density-v2",
    aspect: "finish-aspect-v2",
    "core-emphasis": "finish-emphasis-v2",
  };
  const questionThumbnailOffset = {
  };
  data.stages.forEach((stage) => {
    stage.questions.forEach((question) => {
      const atlasName = questionAtlas[question.id] || (stage.id === "props" ? "props-accessories" : stage.id === "camera" ? "camera-pose" : "mood-lighting");
      assignThumbnails(question.options, atlasName, questionThumbnailOffset[question.id] || 0);
    });
  });
  const assignOneThumbnail = (item, atlasName, tile, audit = "provisional") => assignThumbnail(item, atlasName, tile, audit);
  const assignQuestionThumbnailSet = (stageId, questionId, atlasName, ids) => {
    assignExactThumbnailSet(getQuestion(stageId, questionId)?.options || [], atlasName, ids, questionId);
  };

  // Props use object-only atlases in the literal card order. This is explicit
  // on purpose: adding a new prop cannot shift a book into the beret slot.
  assignQuestionThumbnailSet("props", "hair-accessory", "props-hair-accessory", [
    "hair-ribbon", "hair-clips", "hair-bow", "hair-flower", "hair-headband",
    "hair-beret", "hair-maid", "hair-tiara", "hair-horns", "hair-halo",
  ]);
  assignQuestionThumbnailSet("props", "jewelry", "props-jewelry", [
    "jewel-choker", "jewel-ribbon-choker", "jewel-pearl", "jewel-drop-earrings", "jewel-hoops",
    "jewel-star", "jewel-heart", "jewel-crystal", "jewel-face-chain", "jewel-glasses",
  ]);
  assignQuestionThumbnailSet("props", "hand-prop", "props-hand", [
    "prop-none", "prop-bouquet", "prop-book", "prop-phone", "prop-umbrella",
    "prop-drink", "prop-plush", "prop-microphone", "prop-camera", "prop-magic-wand",
  ]);
  assignQuestionThumbnailSet("props", "scene-decor", "props-decor", [
    "motif-ribbon", "motif-heart", "motif-star", "motif-rose", "motif-crystal",
    "motif-sticker", "motif-candy", "motif-chain", "motif-butterfly", "motif-tech",
  ]);

  // The archetype atlas contains separate cat-girl and fox-girl tiles. The
  // selector exposes them together as one "animal-girl" choice, so every
  // following crop must skip the unused fox-girl cell (tile 2). A sequential
  // assignment here shifts elf → angel → demon → … by one tile.
  assignVerifiedThumbnailMap(getQuestion("character", "character-archetype")?.options || [], "character-archetype", {
    human: ["character-archetypes-v2", 0],
    "animal-girl": ["character-archetypes-v2", 1],
    elf: ["character-archetypes-v2", 3],
    angel: ["character-archetypes-v2", 4],
    demon: ["character-archetypes-v2", 5],
    vampire: ["character-archetypes-v2", 6],
    fairy: ["character-archetypes-v2", 7],
    android: ["character-archetypes-v2", 8],
    doll: ["character-archetypes-v2", 9],
    "dragon-girl": ["character-archetypes-v2", 10],
  });
  assignQuestionThumbnailSet("character", "age-impression", "age-impression-v2", [
    "age-18-20", "age-early-20s", "age-late-20s", "age-30s", "age-40s", "age-middle", "age-elderly", "age-ageless",
  ]);
  assignQuestionThumbnailSet("character", "hair-length", "hair-lengths-v3", [
    "hair-very-short", "hair-short", "hair-chin", "hair-medium", "hair-shoulder", "hair-long", "hair-very-long", "hair-absurd",
  ]);
  assignQuestionThumbnailSet("character", "hair-style", "hair-styles-v2", [
    "straight", "wavy", "curly", "bob", "ponytail", "side-ponytail", "twintails", "braid", "half-updo", "hair-bun",
  ]);
  assignQuestionThumbnailSet("character", "hair-bang", "hair-bangs-v2", [
    "bang-none", "bang-blunt", "bang-see-through", "bang-side", "bang-curtain",
    "bang-hime", "bang-asym", "bang-curly", "bang-long", "bang-parted",
  ]);
  assignQuestionThumbnailSet("character", "hair-color-treatment", "hair-treatment-v2", [
    "hair-solid", "hair-two-tone", "hair-gradient", "hair-colored-tips", "hair-inner",
    "hair-streaks", "hair-highlights", "hair-ombre", "hair-split-dye", "hair-iridescent",
  ]);
  assignVerifiedThumbnailMap(getQuestion("character", "eyes")?.options || [], "eyes", {
    "blue-eyes": ["eyes-colors-a-v2", 0], "aqua-eyes": ["eyes-colors-a-v2", 1],
    "teal-eyes": ["eyes-colors-a-v2", 2], "green-eyes": ["eyes-colors-a-v2", 3],
    "lime-eyes": ["eyes-colors-a-v2", 4], "brown-eyes": ["eyes-colors-a-v2", 5],
    "amber-eyes": ["eyes-colors-a-v2", 6], "golden-eyes": ["eyes-colors-a-v2", 7],
    "grey-eyes": ["eyes-colors-a-v2", 8], "black-eyes": ["eyes-colors-a-v2", 9],
    "purple-eyes": ["eyes-colors-a-v2", 10], "violet-eyes": ["eyes-colors-a-v2", 11],
    "pink-eyes": ["eyes-colors-b-v2", 0], "red-eyes": ["eyes-colors-b-v2", 1],
    "orange-eyes": ["eyes-colors-b-v2", 2], "yellow-eyes": ["eyes-colors-b-v2", 3],
    "white-eyes": ["eyes-colors-b-v2", 4], "rainbow-eyes": ["eyes-colors-b-v2", 5],
    "multicolored-eyes": ["eyes-colors-b-v2", 6], "glowing-eyes": ["eyes-colors-b-v2", 7],
  });
  assignQuestionThumbnailSet("character", "eye-pupil", "eye-pupil-v2", [
    "pupil-natural", "pupil-heterochromia", "pupil-star", "pupil-heart", "pupil-flower",
    "pupil-diamond", "pupil-slit", "pupil-gradient", "pupil-glossy", "pupil-sparkle",
  ]);
  assignQuestionThumbnailSet("character", "skin-tone", "skin-face-v2", [
    "skin-porcelain", "skin-pale", "skin-fair", "skin-ivory", "skin-peach",
    "skin-rosy", "skin-warm", "skin-light-tan", "skin-soft",
  ]);
  assignQuestionThumbnailSet("character", "face-point", "face-point-v2", [
    "face-point-none", "face-point-freckles", "face-point-mole-eye", "face-point-mole-mouth", "face-point-heart-sticker",
    "face-point-star-sticker", "face-point-bandage", "face-point-cheek-mark", "face-point-tear-gem", "face-point-soft-makeup",
  ]);
  assignQuestionThumbnailSet("character", "height", "body-height-v2", [
    "height-petite", "height-short", "height-average", "height-graceful", "height-leggy", "height-tall", "height-model", "height-fairy",
  ]);
  assignQuestionThumbnailSet("character", "body-type", "body-type-v2", [
    "body-petite", "body-slender", "body-soft", "body-curvy-soft", "body-ballerina", "body-athletic-light",
    "body-hourglass", "body-longline", "body-doll", "body-natural",
  ]);

  // Camera atlases are separated by visual grammar instead of sharing one
  // generic pose sheet. Each list is the row-major ImageGen contract.
  assignQuestionThumbnailSet("camera", "framing", "camera-framing-v2", [
    "extreme-close-up", "close-up", "portrait", "upper-body", "waist-up",
    "cowboy-shot", "knees-up", "full-body", "wide-shot", "very-wide",
  ]);
  assignQuestionThumbnailSet("camera", "composition-layout", "camera-layout-v2", [
    "layout-centered", "layout-thirds", "layout-diagonal", "layout-symmetry", "layout-frame",
    "layout-foreground", "layout-layered", "layout-negative", "layout-split", "layout-spiral",
  ]);
  assignQuestionThumbnailSet("camera", "camera-direction", "camera-direction-v2", [
    "camera-front", "camera-three-quarter", "camera-side", "camera-profile", "camera-back",
    "camera-over-shoulder", "camera-looking-back", "camera-pov", "camera-mirror", "camera-overhead",
  ]);
  assignQuestionThumbnailSet("camera", "camera-height", "camera-height-v2", [
    "height-eye", "height-slight-high", "height-high", "height-top", "height-slight-low",
    "height-low", "height-ground", "height-dutch",
  ]);
  assignQuestionThumbnailSet("camera", "body-action", "camera-body-action-v2", [
    "action-standing", "action-sitting", "action-leaning", "action-walking", "action-running",
    "action-dancing", "action-floating", "action-kneeling", "action-reclining", "action-turning",
  ]);
  assignQuestionThumbnailSet("camera", "hand-action", "camera-hand-action-v2", [
    "hands-relaxed", "hands-wave", "hands-peace", "hands-face", "hands-hair",
    "hands-collarbone", "hands-skirt", "hands-heart", "hands-open", "hands-reach",
  ]);
  assignVerifiedThumbnailMap(getQuestion("camera", "gaze")?.options || [], "gaze", {
    "gaze-viewer": ["camera-gaze-expression-v2", 0],
    "gaze-side": ["camera-gaze-expression-v2", 1],
    "gaze-down": ["camera-gaze-expression-v2", 2],
    "gaze-up": ["camera-gaze-expression-v2", 3],
    "gaze-partner": ["camera-gaze-expression-v2", 4],
    "gaze-away": ["camera-gaze-expression-v2", 5],
  });
  assignVerifiedThumbnailMap(getQuestion("camera", "expression")?.options || [], "expression", {
    "expression-soft": ["camera-gaze-expression-v2", 6],
    "expression-bright": ["camera-gaze-expression-v2", 7],
    "expression-shy": ["camera-gaze-expression-v2", 8],
    "expression-dreamy": ["camera-gaze-expression-v2", 9],
    "expression-calm": ["camera-gaze-expression-v2", 10],
    "expression-playful": ["camera-gaze-expression-v2", 11],
    "expression-surprised": ["camera-expression-extra-v2", 0],
    "expression-melancholy": ["camera-expression-extra-v2", 1],
  });
  assignVerifiedThumbnailMap(getQuestion("camera", "composition-extra")?.options || [], "composition-extra", {
    "extra-dof": ["camera-expression-extra-v2", 2],
    "extra-bokeh": ["camera-expression-extra-v2", 3],
    "extra-reflection": ["camera-expression-extra-v2", 4],
    "extra-foreground": ["camera-expression-extra-v2", 5],
    "extra-sparkles": ["camera-expression-extra-v2", 6],
    "extra-petals": ["camera-expression-extra-v2", 7],
    "extra-hearts": ["camera-expression-extra-v2", 8],
    "extra-ribbons": ["camera-expression-extra-v2", 9],
    "extra-halftone": ["camera-expression-extra-v2", 10],
    "extra-film": ["camera-expression-extra-v2", 11],
  });

  // Wardrobe cards and their first-level construction choices are all bound to
  // a purpose-built sheet. In particular, swimsuit variants never inherit a
  // sportswear or school-uniform crop by array position.
  assignQuestionThumbnailSet("outfit", "wardrobe", "outfit-family-v2", [
    "wardrobe-uniform", "wardrobe-swim", "wardrobe-casual", "wardrobe-formal", "wardrobe-professional",
    "wardrobe-sports", "wardrobe-fantasy", "wardrobe-gothic", "wardrobe-traditional", "wardrobe-tech",
  ]);
  assignQuestionThumbnailSet("outfit", "bottomwear", "outfit-bottomwear-v2", [
    "bottom-pleated", "bottom-a-line", "bottom-tiered", "bottom-mini", "bottom-pencil",
    "bottom-shorts", "bottom-denim-shorts", "bottom-wide-pants", "bottom-cargo", "bottom-long-dress",
  ]);
  assignQuestionThumbnailSet("outfit", "under-layer", "outfit-underlayer-v2", [
    "under-none", "under-swim-brief", "under-highwaist", "under-skirted",
    "under-shorts", "under-inner-shorts", "under-bloomers", "under-slip",
  ]);
  assignQuestionThumbnailSet("outfit", "outfit-fit", "outfit-fit-v2", [
    "fit-structured", "fit-fitted", "fit-relaxed", "fit-oversized", "fit-layered", "fit-cropped",
    "fit-longline", "fit-voluminous", "fit-asymmetric", "fit-soft-cling", "fit-open-back", "fit-shoulder-cutout",
  ]);
  assignQuestionThumbnailSet("outfit", "legwear", "outfit-legwear-v2", [
    "bare-legs", "ankle-socks", "crew-socks", "kneehighs", "thighhighs",
    "white-thighhighs", "pantyhose", "fishnets", "striped-thighhighs", "leg-warmers",
  ]);
  assignQuestionThumbnailSet("outfit", "footwear", "outfit-footwear-v2", [
    "sneakers", "chunky-sneakers", "loafers", "mary-janes", "pumps",
    "ankle-boots", "knee-boots", "combat-boots", "sandals", "barefoot",
  ]);
  assignQuestionThumbnailSet("outfit", "mature-wardrobe-state", "outfit-mature-state-v2", [
    "mature-clothed", "mature-cardigan", "mature-draped", "mature-collar",
    "mature-rain", "mature-robe", "mature-coverup", "mature-wrap",
  ]);
  assignVerifiedThumbnailMap(getQuestion("outfit", "material")?.options || [], "material", {
    cotton: ["outfit-material-v2", 0], knit: ["outfit-material-v2", 1], satin: ["outfit-material-v2", 2],
    lace: ["outfit-material-v2", 3], chiffon: ["outfit-material-v2", 4], velvet: ["outfit-material-v2", 5],
    leather: ["outfit-material-v2", 6], denim: ["outfit-material-v2", 7], metallic: ["outfit-material-v2", 8],
    holographic: ["outfit-material-v2", 9], "wet-cotton": ["outfit-material-v2", 10], "soft-sheer": ["outfit-material-v2", 11],
    "sculpted-rib-knit": ["outfit-material-v2", 12],
  });
  assignQuestionThumbnailSet("scene", "scene-cast", "scene-cast-v2", ["cast-solo", "cast-partner"]);
  assignQuestionThumbnailSet("scene", "solo-scene-activity", "scene-solo-v2", [
    "solo-reading", "solo-stroll", "solo-cafe", "solo-flowers", "solo-camera", "solo-mirror", "solo-stage", "solo-garden",
  ]);
  assignQuestionThumbnailSet("scene", "partner-archetype", "scene-partner-archetype-v2", [
    "partner-soft", "partner-classic", "partner-artist", "partner-campus", "partner-fantasy", "partner-gothic", "partner-idol", "partner-summer",
  ]);
  assignQuestionThumbnailSet("scene", "partner-action", "scene-partner-action-v2", [
    "partner-walk", "partner-hold-hands", "partner-hug", "partner-forehead", "partner-kiss",
    "partner-dance", "partner-gift", "partner-share", "partner-back-hug", "partner-sit",
  ]);
  assignQuestionThumbnailSet("scene", "mature-romance-tone", "scene-romance-tone-v2", [
    "mature-candle", "mature-rain", "mature-dance", "mature-quiet", "mature-editorial", "mature-suite", "mature-moon", "mature-flowers",
  ]);
  assignQuestionThumbnailSet("concept", "genre", "concept-genre-v2", [
    "genre-daily", "genre-school", "genre-fashion", "genre-idol", "genre-beach", "genre-fantasy", "genre-occult", "genre-traditional", "genre-cyber", "genre-surreal",
  ]);
  assignQuestionThumbnailSet("concept", "reference-style", "concept-style-v3", [
    "style-nyankat-core", "style-sweet", "style-lace", "style-magic", "style-gothic", "style-retro", "style-summer", "style-minimal",
  ]);
  assignQuestionThumbnailSet("concept", "setting", "concept-setting-v3", [
    "setting-studio", "setting-bedroom", "setting-classroom", "setting-city", "setting-cafe", "setting-nature", "setting-beach", "setting-palace", "setting-shrine", "setting-industrial",
  ]);
  assignQuestionThumbnailSet("concept", "time-weather", "concept-weather-v3", [
    "morning", "midday", "golden-hour", "blue-hour", "night", "rain", "snow", "wind", "mist", "fireworks",
  ]);
  assignQuestionThumbnailSet("concept", "palette", "concept-palette-v3", [
    "palette-pink", "palette-sky", "palette-ice", "palette-crimson", "palette-violet", "palette-neon", "palette-amber", "palette-botanical", "palette-muted", "palette-mono",
  ]);
  assignVerifiedThumbnailMap(getQuestion("mood", "tone")?.options || [], "tone", {
    "tone-cheerful": ["mood-tone-a-v2", 0], "tone-calm": ["mood-tone-a-v2", 1], "tone-dreamy": ["mood-tone-a-v2", 2],
    "tone-romantic": ["mood-tone-a-v2", 3], "tone-nostalgic": ["mood-tone-a-v2", 4], "tone-mysterious": ["mood-tone-a-v2", 5],
    "tone-melancholy": ["mood-tone-a-v2", 6], "tone-dark": ["mood-tone-a-v2", 7], "tone-tense": ["mood-tone-a-v2", 8],
    "tone-grand": ["mood-tone-a-v2", 9], "tone-rainlight-dressing": ["mood-tone-a-v2", 10], "tone-steamed-window": ["mood-tone-a-v2", 11],
    "tone-coy-editorial": ["mood-tone-b-v2", 0],
  });
  assignQuestionThumbnailSet("mood", "lighting", "mood-lighting-v2", [
    "soft-light", "backlight", "window-light", "neon-light", "candle-light", "moon-light", "spotlight", "volumetric", "high-key", "low-key",
  ]);
  assignQuestionThumbnailSet("mood", "atmosphere", "mood-atmosphere-v2", [
    "sparkles", "floating-hearts", "petals", "magic-particles", "bubbles", "confetti", "butterflies", "glitch", "embers", "snow-dust",
  ]);
  assignQuestionThumbnailSet("mood", "camera-finish", "mood-camera-finish-v2", [
    "dof", "bokeh", "bloom", "lens-flare", "film-grain", "soft-focus", "sharp-focus", "fisheye", "halftone",
  ]);
  assignQuestionThumbnailSet("finish", "density", "finish-density-v2", ["density-light", "density-standard", "density-rich"]);
  assignQuestionThumbnailSet("finish", "aspect", "finish-aspect-v2", [
    "ratio-square", "ratio-portrait", "ratio-tall", "ratio-story", "ratio-landscape", "ratio-wide",
  ]);
  assignQuestionThumbnailSet("finish", "core-emphasis", "finish-emphasis-v2", [
    "emphasis-concept", "emphasis-character", "emphasis-background", "emphasis-composition", "emphasis-outfit", "emphasis-none",
  ]);
  Object.values(data.dynamicPacks["character-archetype"] || {}).forEach((options) => {
    assignThumbnails(options, "character-archetypes", 0);
  });
  const characterVariantAtlases = {
    human: "character-human-variants-v2",
    "animal-girl": "character-animal-variants-v2",
    elf: "character-elf-variants-v2",
    angel: "character-angel-variants-v2",
    demon: "character-demon-variants-v2",
    vampire: "character-vampire-variants-v2",
    fairy: "character-fairy-variants-v2",
    android: "character-android-variants-v2",
    doll: "character-doll-variants-v2",
    "dragon-girl": "character-dragon-variants-v2",
  };
  Object.entries(data.dynamicPacks["character-archetype"] || {}).forEach(([archetype, options]) => {
    assignExactThumbnailSet(options, characterVariantAtlases[archetype], options.map((item) => item.id), `character-${archetype}`);
  });
  Object.entries(data.dynamicPacks["hair-style"] || {}).forEach(([styleId, options]) => {
    // These controls all share one semantic atlas.  Mapping it explicitly
    // keeps `side-locks` and `ahoge` attached to their own visible examples
    // instead of inheriting the unrelated bangs sheet.
    assignExactThumbnailSet(options, "hair-style-details-v2", options.map((item) => item.id), `hair-style-detail-${styleId}`);
  });
  const subtypeFamily = new Map();
  Object.entries(data.outfitPacks || {}).forEach(([familyId, options]) => {
    const atlasName = familyId === "wardrobe-casual"
      ? "outfit-casual"
      : familyId === "wardrobe-formal" || familyId === "wardrobe-professional"
        ? "outfit-formal-professional"
        : familyId === "wardrobe-uniform"
      ? "outfit-academy-casual"
      : familyId === "wardrobe-swim" || familyId === "wardrobe-sports"
        ? "outfit-summer-sport"
        : familyId === "wardrobe-traditional" || familyId === "wardrobe-gothic" || familyId === "wardrobe-fantasy"
          ? "outfit-trad-goth-fantasy"
          : "outfit-families";
    assignThumbnails(options, atlasName, 0);
    options.forEach((option) => subtypeFamily.set(option.id, familyId));
  });
  Object.entries(data.dynamicPacks["outfit-subtype"] || {}).forEach(([subtypeId, options]) => {
    const familyId = subtypeFamily.get(subtypeId) || "";
    const atlasName = familyId === "wardrobe-casual"
      ? "outfit-casual"
      : familyId === "wardrobe-formal" || familyId === "wardrobe-professional"
        ? "outfit-formal-professional"
        : familyId === "wardrobe-uniform"
      ? "outfit-academy-casual"
      : familyId === "wardrobe-swim" || familyId === "wardrobe-sports"
        ? "outfit-summer-sport"
        : familyId === "wardrobe-traditional" || familyId === "wardrobe-gothic" || familyId === "wardrobe-fantasy"
          ? "outfit-trad-goth-fantasy"
          : "outfit-components";
    assignThumbnails(options, atlasName, 0);
  });

  const outfitPackThumbnailSets = {
    "wardrobe-uniform": ["outfit-uniform-v2", [
      "uniform-sailor", "uniform-blazer", "uniform-cardigan", "uniform-vest", "uniform-pinafore",
      "uniform-bolero", "uniform-plaid", "uniform-summer", "uniform-winter",
    ]],
    "wardrobe-swim": ["outfit-swim-v2", [
      "swim-onepiece", "swim-racerback", "swim-sport-two", "swim-tankini", "swim-rashguard",
      "swim-highwaist", "swim-halter", "swim-triangle", "swim-bandeau", "swim-monokini",
    ]],
    "wardrobe-casual": ["outfit-casual-v2", [
      "casual-knit", "casual-shirt", "casual-denim", "casual-preppy", "casual-y2k", "casual-decora",
      "casual-cottage", "casual-minimal", "casual-loungewear", "casual-openback-cable",
      "casual-rain-window-tee", "casual-open-robe",
    ]],
    "wardrobe-formal": ["outfit-formal-v2", [
      "formal-cocktail", "formal-gown", "formal-suit", "formal-tuxedo", "formal-bridal",
    ]],
    "wardrobe-professional": ["outfit-professional-v2", [
      "pro-classic-maid", "pro-cafe-maid", "pro-office", "pro-librarian", "pro-nurse",
    ]],
    "wardrobe-sports": ["outfit-sports-v2", [
      "sport-tracksuit", "sport-tennis", "sport-running", "sport-yoga", "sport-dance",
      "sport-cycling", "sport-boxing", "sport-cheer", "sport-outdoor",
    ]],
    "wardrobe-fantasy": ["outfit-fantasy-v4", [
      "fantasy-magical", "fantasy-witch", "fantasy-knight", "fantasy-paladin", "fantasy-mage",
      "fantasy-alchemist", "fantasy-ranger", "fantasy-princess", "fantasy-fairy",
    ]],
    "wardrobe-gothic": ["outfit-gothic-v3", [
      "gothic-lolita", "sweet-lolita", "classic-lolita", "gothic-witch", "gothic-vampire",
      "gothic-punk", "gothic-nun", "gothic-doll", "gothic-editorial",
    ]],
    "wardrobe-traditional": ["outfit-traditional-v2", [
      "traditional-hanbok", "traditional-kimono", "traditional-yukata", "traditional-miko", "traditional-qipao",
      "traditional-hanfu", "traditional-victorian", "traditional-regency", "traditional-fusion",
    ]],
    "wardrobe-tech": ["outfit-tech-v2", ["tech-urban", "tech-cyber-idol", "tech-bodysuit"]],
  };
  Object.entries(outfitPackThumbnailSets).forEach(([familyId, [atlasName, ids]]) => {
    assignExactThumbnailSet(data.outfitPacks?.[familyId] || [], atlasName, ids, familyId);
  });

  // The dynamic packs intentionally reuse the same detail vocabulary across
  // related base garments. Match on the declared suffix, never on the selected
  // garment's array position, so every swimsuit displays the frill/high-waist/
  // sport/skirted/rashguard/sailor/cover-up sequence correctly.
  const outfitSubtypeDetailSets = {
    "wardrobe-uniform": ["outfit-uniform-details-v2", ["sailor", "plaid", "cardigan", "vest", "puff", "ribbon", "loose-socks"]],
    "wardrobe-swim": ["outfit-swim-details-v2", ["frill", "highwaist", "sport", "skirted", "rashguard", "sailor", "coverup"]],
    "wardrobe-casual": ["outfit-casual-details-v2", ["knit", "layered", "denim", "oversized", "cottage", "yume", "street"]],
    "wardrobe-formal": ["outfit-formal-details-v2", ["satin", "gloves", "jewelry", "wrap", "hem"]],
    "wardrobe-professional": ["outfit-professional-details-v2", ["apron", "collar", "badge", "service", "loafers"]],
    "wardrobe-sports": ["outfit-sports-details-v2", ["tennis", "track", "dance", "ballet", "cheer", "outdoor", "racing"]],
    "wardrobe-fantasy": ["outfit-fantasy-details-v2", ["cape", "ornament", "sleeves", "emblem", "boots"]],
    "wardrobe-gothic": ["outfit-gothic-details-v2", ["lace", "ribbon", "rose", "doll", "nun", "sweet", "punk"]],
    "wardrobe-traditional": ["outfit-traditional-details-v2", ["hanbok", "kimono", "qipao", "veil", "floral", "festival", "lace-fusion"]],
    "wardrobe-tech": ["outfit-tech-details-v2", ["panels", "straps", "glow", "visor"]],
  };
  Object.entries(data.dynamicPacks["outfit-subtype"] || {}).forEach(([subtypeId, options]) => {
    const familyId = subtypeFamily.get(subtypeId);
    const [atlasName, suffixes] = outfitSubtypeDetailSets[familyId] || [];
    if (!atlasName) return;
    const mapping = Object.fromEntries((options || []).map((item) => {
      const suffix = item.id.split("-detail-").at(-1);
      const tile = suffixes.indexOf(suffix);
      if (tile < 0) throw new Error(`Thumbnail manifest ${familyId} has no detail tile for ${item.id}.`);
      return [item.id, [atlasName, tile]];
    }));
    assignVerifiedThumbnailMap(options, `${subtypeId}-detail`, mapping);
  });
  // Detail controls are normally presented as compact dialog chips rather
  // than full cards. They still get a matching tile so a color treatment,
  // collar, sleeve, prop relation, or pose refinement is readable at a
  // glance instead of being text-only.
  const detailQuestionAtlas = {
    "character-archetype": "character-archetypes",
    "hair-style": "hair-style-bangs",
    "hair-color": "hair-colors",
    eyes: "eyes-face-body",
    face: "eyes-face-body",
    body: "eyes-face-body",
    setting: "world-setting",
    wardrobe: "outfit-components-plus",
    "hand-prop": "props-accessories",
    framing: "camera-framing",
    pose: "camera-pose",
    "outfit-subtype-detail": "outfit-components-plus",
  };
  const detailGroupAtlas = {
    "outfit-material": "outfit-materials",
    "outfit-palette": "outfit-components-plus",
    "outfit-structure": "outfit-academy-casual",
  };
  const assignDetailGroupThumbnails = (groups, questionId) => {
    (groups || []).forEach((group) => {
      assignThumbnails(group.options, detailGroupAtlas[group.id] || detailQuestionAtlas[questionId] || "mood-lighting");
    });
  };
  data.stages.forEach((stage) => stage.questions.forEach((question) => {
    assignDetailGroupThumbnails(question.detailGroups, question.id);
  }));
  Object.entries(data.detailPacks || {}).forEach(([questionId, groups]) => {
    assignDetailGroupThumbnails(groups, questionId);
  });

  const frequencyForTags = (tags) => {
    let raw = 0;
    let promptCount = 0;
    new Set(tags.map((tag) => String(tag).toLowerCase())).forEach((tag) => {
      const item = catalogByTag.get(tag);
      if (!item) return;
      raw += Number(item.frequency || 0);
      promptCount += Array.isArray(item.sourcePromptIds) ? item.sourcePromptIds.length : 0;
    });
    return { raw, promptCount };
  };
  const tuneOption = (item) => {
    const tags = Object.values(item.tags || {}).flat();
    const evidence = frequencyForTags(tags);
    item.referenceFrequency = evidence.raw;
    item.referencePromptFrequency = evidence.promptCount;
    if (item.referenceWeight == null) {
      // Log scale preserves long-tail variety while giving recurring reference
      // motifs a meaningful advantage in the recommendation sampler.
      item.referenceWeight = Number((0.38 + Math.min(1.85, Math.log1p(evidence.promptCount) * 0.47)).toFixed(2));
    }
  };
  const tuneQuestion = (question) => {
    question.options?.forEach(tuneOption);
    question.detailGroups?.forEach((group) => group.options?.forEach((item) => tuneOption(Array.isArray(item) ? { tags: { other: [item[2]] } } : item)));
  };
  data.stages.forEach((stage) => stage.questions.forEach(tuneQuestion));
  Object.values(data.outfitPacks || {}).flat().forEach(tuneOption);
  Object.values(data.dynamicPacks || {}).forEach((packs) => Object.values(packs).flat().forEach(tuneOption));

  const source = window.PM_CORPUS_LIBRARY;
  if (source?.source && source?.stats) {
    data.corpus = {
      ...data.corpus,
      pages: source.source.pages,
      prompts: source.source.prompts,
      tags: source.stats.items,
      occurrences: source.stats.occurrences,
      primaryOrder: ["background", "composition", "outfit"],
    };
  }
  data.referenceProfile = {
    label: "NyanKat / local reference frequency",
    highWeightMotifs: ["looking at viewer", "full body", "upper body", "soft lighting", "sparkles", "frills", "lace trim", "pleated skirt", "floating hearts"],
    lowWeightMotifs: ["techwear", "cargo pants", "industrial interior"],
  };
  data.version = 5;
})();
