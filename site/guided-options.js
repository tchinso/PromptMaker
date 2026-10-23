(function () {
  "use strict";
  const data = window.PM_DATA;
  const root = "assets/visual-guides/options/";
  const sheets = {
    a: "thumb-guided-medium-layout-v1.png", b: "thumb-guided-graphics-settings-v1.png",
    c: "thumb-guided-construction-v1.png", d: "thumb-guided-pose-support-v1.png",
  };
  const card = (id, label, description, tags, sheet, index) => ({
    id, label, description, tags, source: "corpus", preserveTags: true,
    image: root + sheets[sheet], sprite: { columns: 4, rows: 3, index },
    thumbnailAudit: { atlasName: `guided-${sheet}`, tile: index, status: "verified:guided-manifest" },
  });
  const question = (stageId, id, title, section, options) => {
    data.stages.find((stage) => stage.id === stageId).questions.push({
      id, title, section, options, multi: true, max: options.length, visual: true,
      description: "원하는 표현을 여러 개 조합하세요. 카드와 계열별 세부 선택은 밀도에 관계없이 보존됩니다.",
    });
  };
  question("concept", "guided-medium", "어떤 매체와 그림체로 표현할까요?", "concept", [
    card("guided-watercolor", "투명 수채화", "맑은 물감·번짐·종이 입자", { concept: ["watercolor painting", "translucent watercolor", "pigment bleeding", "paper grain"] }, "a", 0),
    card("guided-genga", "애니메이션 원화", "작화 선·색 구분선·미채색 영역", { concept: ["animation genga", "color trace lines", "unpainted", "rough linework"] }, "a", 1),
    card("guided-pixel", "16비트 픽셀", "도트·디더링·각진 선", { concept: ["pixel art", "16-bit", "dithering", "jagged lines"] }, "a", 2),
    card("guided-flat", "플랫 일러스트", "단순한 형태와 평면 색면", { concept: ["flat illustration", "flat colors", "no shading"] }, "a", 3),
    card("guided-halftone", "팝아트·망점", "코믹 색면과 하프톤", { concept: ["pop art shading"], background: ["halftone dots"] }, "a", 4),
    card("guided-film", "빈티지 필름", "아날로그 촬영과 부드러운 초점", { concept: ["analog photography", "old film"], background: ["soft focus"] }, "a", 5),
  ]);
  question("camera", "guided-editorial", "한 장을 어떤 편집 화면으로 구성할까요?", "composition", [
    card("guided-magazine", "잡지 표지", "큰 제목·커버 문구·바코드", { composition: ["magazine cover"], background: ["typography", "barcode"] }, "a", 6),
    card("guided-scrapbook", "스크랩북 콜라주", "종이 조각과 테이프로 겹친 화면", { composition: ["scrapbook", "collage layout"], background: ["torn paper edges", "washi tape"] }, "a", 7),
    card("guided-character-sheet", "캐릭터 디자인 시트", "정면·후면·측면과 세부 확대", { composition: ["character sheet", "multiple views", "front view", "back view", "side view"] }, "a", 8),
    card("guided-sticker-sheet", "스티커 시트", "여러 포즈와 흰 외곽선", { composition: ["sticker sheet", "multiple views"], background: ["white outline"] }, "a", 9),
    card("guided-retro-ui", "레트로 컴퓨터 창", "겹친 창·작업 표시줄·커서", { composition: ["retro pc interface", "multi-window layout"], background: ["taskbar", "pixel cursor"] }, "a", 10),
    card("guided-game-hud", "캐릭터 육성 게임 화면", "프로필·상태·대화·선택 버튼", { composition: ["full game screen capture of cute character raising game", "complex layered interface", "training status icons", "floating menu buttons"] }, "a", 11),
  ]);
  question("concept", "guided-graphic", "배경 위에 어떤 그래픽 장식을 얹을까요?", "background", [
    card("guided-white-outline", "흰 스티커 외곽선", "인물을 잘라 붙인 듯한 윤곽", { background: ["white outline", "sticker style"] }, "b", 0),
    card("guided-heart-border", "하트·레이스 테두리", "화면 안쪽의 장식 프레임", { background: ["heart motifs", "lace border"] }, "b", 1),
    card("guided-title", "큰 제목과 타이포", "제목과 본문이 차지하는 편집 면적", { background: ["large title text", "text blocks", "bold typography"] }, "b", 2),
    card("guided-graffiti", "그래피티·버블 글씨", "낙서와 둥근 레터링", { background: ["graffiti", "bubble lettering", "doodle hearts"] }, "b", 3),
    card("guided-holo-ui", "홀로그램 패널", "투명 디지털 창과 아이콘", { background: ["holographic elements", "digital interface elements", "glowing outlines"] }, "b", 4),
    card("guided-photostrip", "폴라로이드·사진 띠", "여러 작은 사진을 배치", { composition: ["polaroid frames", "photo booth strip", "multiple small photos"] }, "b", 5),
  ]);
  question("concept", "guided-setting", "공간과 스케일을 더 구체적으로 고를까요?", "background", [
    card("guided-aquarium", "수중·수족관 터널", "해파리·기포·물의 굴절", { background: ["aquarium tunnel", "underwater", "floating jellyfish", "water caustics"] }, "b", 6),
    card("guided-dollhouse", "미니어처 돌하우스", "작은 가구·진열장·커튼", { background: ["dollhouse", "antique room", "display cabinet", "red curtains"] }, "b", 7),
    card("guided-dessert-space", "거대한 디저트 공간", "캐릭터보다 큰 파르페와 마카롱", { background: ["strawberry parfait", "cute dessert shop background", "macarons"] }, "b", 8),
    card("guided-carousel", "밤의 회전목마", "놀이기구 조명과 먼 보케", { background: ["carousel", "amusement park", "night", "warm lighting", "bokeh"] }, "b", 9),
    card("guided-tanabata", "칠석 대나무 정원", "색색의 탄자쿠와 리본", { background: ["bamboo tree", "tanabata festival", "colorful tanzaku strips hanging", "ribbons"] }, "b", 10),
    card("guided-train", "열차와 창밖 풍경", "실내 창틀과 벚꽃의 거리감", { background: ["train", "train window frame", "cherry blossoms"] }, "b", 11),
  ]);
  question("outfit", "guided-construction", "의상의 구조와 겹침을 어떻게 쌓을까요?", "outfit", [
    card("guided-petticoat", "페티코트·겹프릴", "치마 아래 볼륨과 여러 겹의 끝단", { outfit: ["petticoat", "layered ruffles"] }, "c", 0),
    card("guided-balloon-sleeves", "분리형 벌룬 소매", "몸판과 분리된 부푼 소매", { outfit: ["detachable puffy balloon sleeves"] }, "c", 1),
    card("guided-long-sleeves", "손목을 덮는 소매", "손보다 길게 내려오는 오버사이즈", { outfit: ["oversized sleeves", "sleeves past wrists"] }, "c", 2),
    card("guided-striped-inner", "줄무늬 이너 겹침", "짧은 겉상의 아래 긴 소매", { outfit: ["striped long sleeve underneath", "layered outfit"] }, "c", 3),
    card("guided-unzipped-hood", "열린 동물 후드·이너", "후드 겉옷과 흰 티셔츠를 분리", { outfit: ["animal ear hood", "unzipped", "inner white t-shirt"] }, "c", 4),
    card("guided-corset-panel", "코르셋·교차 끈", "몸판의 패널과 레이스업", { outfit: ["corset panel", "cross-lacing"] }, "c", 5),
    card("guided-cloud-collar", "넓은 소매·차이나 칼라", "구름 칼라와 매듭 여밈", { outfit: ["wide sleeves", "cloud collar", "frog closures"] }, "c", 6),
    card("guided-heart-bodice", "하트형 몸판", "곡선 목선과 하트 실루엣", { outfit: ["sweetheart neckline", "heart-shaped bodice"] }, "c", 7),
    card("guided-mermaid-gown", "머메이드·긴 트레인", "몸선을 따라 좁아졌다 펼쳐지는 밑단", { outfit: ["mermaid silhouette", "long draping train"] }, "c", 8),
    card("guided-suspender-layers", "서스펜더·겹치마", "멜빵과 레이어드 하의", { outfit: ["suspenders", "layered skirt"] }, "c", 9),
    card("guided-lace-sleeves", "레이스 겉소매", "불투명한 몸판 위 얇은 소매", { outfit: ["sheer lace sleeves", "layered clothing"] }, "c", 10),
    card("guided-asymmetric", "비대칭·한쪽 소매", "좌우가 다른 재단과 분리 소매", { outfit: ["asymmetrical design", "detached sleeves"] }, "c", 11),
  ]);
  question("camera", "guided-pose-support", "몸과 다리는 어디에 어떻게 기대나요?", "composition", [
    card("guided-cross-legged", "바닥에 양반다리", "바닥을 지지하는 교차된 다리", { composition: ["sitting cross-legged on the floor"] }, "d", 0),
    card("guided-wariza", "무릎을 접은 W자 앉기", "무릎 앞·발 옆의 지지 구조", { composition: ["sitting", "wariza"] }, "d", 1),
    card("guided-side-recline", "무릎을 굽혀 옆으로 눕기", "몸의 옆면과 접힌 다리", { composition: ["reclining on side", "bent knees"] }, "d", 2),
    card("guided-prone-chin", "엎드려 양손에 턱", "팔꿈치와 손이 얼굴을 받침", { composition: ["lying on stomach", "resting chin on hands"] }, "d", 3),
    card("guided-one-hand-support", "한 손을 짚고 뒤로 기대기", "등 뒤의 한 손으로 무게를 받침", { composition: ["leaning back on one hand"] }, "d", 4),
    card("guided-raised-knee", "세운 무릎에 팔 얹기", "한쪽 무릎과 팔의 연결", { composition: ["one knee up", "arm resting on knee"] }, "d", 5),
    card("guided-ballet-leap", "그랑 주테 발레 도약", "공중에서 펼친 다리와 팔", { composition: ["grand jeté ballet leap", "mid-air graceful pose"] }, "d", 6),
    card("guided-legs-foreground", "다리를 앞으로·강한 원근", "발과 다리가 카메라에 가까운 시점", { composition: ["legs toward viewer", "foreshortening"] }, "d", 7),
    card("guided-skateboard", "스케이트보드 위 낮은 자세", "보드 위에서 균형 잡은 무게", { composition: ["riding skateboard", "dynamic pose"] }, "d", 8),
    card("guided-macaron-seat", "마카롱 위에 걸터앉기", "큰 디저트와 늘어뜨린 다리", { composition: ["sitting on giant macaron", "legs dangling"] }, "d", 9),
    card("guided-moon-seat", "달 위에 앉기", "달의 곡면을 지지점으로 사용", { composition: ["sitting on moon", "floating hair"] }, "d", 10),
    card("guided-window-lean", "열차 창밖으로 기대기", "창틀을 넘은 상체와 모자 손짓", { composition: ["leaning out of window", "hand on hat"] }, "d", 11),
  ]);
  // Retain deep controls after the earlier question-ID rename.
  for (const [oldId, newId] of [["pose", "body-action"], ["face", "face-point"], ["body", "body-type"]]) {
    const existing = data.detailPacks[newId] || [];
    data.detailPacks[newId] = [...existing, ...(data.detailPacks[oldId] || []).filter((group) => !existing.some((other) => other.id === group.id))];
  }
  // Broad decisions precede their refinements; visual packs join the topic
  // they explain instead of collecting at the beginning of the section.
  const questionOrder = {
    concept: ["genre", "guided-medium", "reference-style", "setting", "guided-setting", "time-weather", "palette", "guided-graphic"],
    outfit: ["wardrobe", "outfit-subtype", "outfit-subtype-detail", "bottomwear", "under-layer", "outfit-fit", "guided-construction", "mature-wardrobe-state", "material", "legwear", "footwear"],
    camera: ["framing", "guided-editorial", "composition-layout", "camera-direction", "camera-height", "body-action", "guided-pose-support", "hand-action", "gaze", "expression", "composition-extra"],
  };
  Object.entries(questionOrder).forEach(([stageId, ids]) => {
    const stage = data.stages.find((item) => item.id === stageId);
    const ranks = new Map(ids.map((id, index) => [id, index]));
    stage.questions.sort((a, b) => (ranks.get(a.id) ?? ids.length) - (ranks.get(b.id) ?? ids.length));
  });
  data.version = 8;
})();
