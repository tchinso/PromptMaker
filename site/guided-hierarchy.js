(function () {
  "use strict";

  // This is a view of the vocabulary, never a second set of prompt options.
  // Every leaf contains the original item object; IDs, weights and output
  // sections continue to belong to PM_GUIDED_CORPUS and saved guided state.
  const guided = window.PM_GUIDED_CORPUS;
  if (!guided?.items || !guided?.byId) throw new Error("Guided hierarchy requires the complete vocabulary.");

  const world = (index) => ({ sheet: "world", index });
  const detail = (index) => ({ sheet: "detail", index });
  const hosts = {
    "scene-cast": ["인원과 인물 사이의 관계", world(4)],
    "character-archetype": ["인물의 성격과 종족", world(3)],
    "hair-length": ["머리 길이", world(1)],
    "hair-style": ["머리 모양", world(1)],
    "hair-bang": ["앞머리", world(1)],
    "hair-color": ["머리 색", world(0)],
    "hair-color-treatment": ["머리 색의 배합과 표면", world(0)],
    eyes: ["눈의 색과 모양", world(2)],
    "eye-pupil": ["눈동자의 세부 모양", world(2)],
    "skin-tone": ["피부 표현", world(3)],
    "face-point": ["얼굴과 손톱의 포인트", world(2)],
    "body-type": ["체형과 인물 비례", world(3)],
    genre: ["장르와 테마", world(8)],
    "guided-medium": ["매체와 그림체", world(5)],
    setting: ["장소와 공간", world(6)],
    "time-weather": ["시간과 날씨", world(11)],
    palette: ["색과 배색", world(10)],
    "guided-graphic": ["화면의 그래픽 장식", world(8)],
    lighting: ["빛과 광학 효과", world(9)],
    atmosphere: ["분위기와 공기", world(11)],
    wardrobe: ["의상의 큰 계열과 유형", detail(1)],
    bottomwear: ["하의의 종류", detail(1)],
    "under-layer": ["이너와 속에 겹치는 옷", detail(1)],
    "outfit-fit": ["의상 실루엣과 핏", detail(0)],
    "guided-construction": ["의상의 구조와 장식", detail(0)],
    material: ["소재와 표면", detail(2)],
    legwear: ["양말과 다리 의상", detail(4)],
    footwear: ["신발", detail(4)],
    "hair-accessory": ["머리와 얼굴에 쓰는 소품", detail(5)],
    jewelry: ["착용 소품과 신체 장식", detail(6)],
    "hand-prop": ["손에 들거나 사용하는 소품", detail(7)],
    "scene-decor": ["장면의 소품과 부유 장식", detail(8)],
    framing: ["촬영 거리와 크롭", detail(11)],
    "guided-editorial": ["편집과 화면 구성", world(8)],
    "camera-direction": ["카메라 방향과 구도", detail(11)],
    "camera-height": ["카메라 높이", detail(11)],
    "body-action": ["몸의 자세와 움직임", detail(10)],
    "hand-action": ["손과 팔의 동작", detail(9)],
    gaze: ["시선의 방향", world(2)],
    expression: ["표정과 얼굴의 움직임", world(2)],
    "composition-extra": ["머리카락과 천의 움직임", detail(10)],
  };
  const rule = (id, label, expression, imageKey) => ({ id, label, expression, imageKey });
  const choose = (rules, text) => rules.find((entry) => !entry.expression || entry.expression.test(text));

  function questionFor(item) {
    const text = item.tag.toLowerCase();
    switch (item.facet) {
      case "interaction": return "scene-cast";
      case "proportion": return "body-type";
      case "appearance":
        if (/\b(?:solo|1girl|1boy|2girls?|2boys?|2people|multiple individuals|male|female)\b/.test(text)) return "scene-cast";
        if (/(?:hair|bangs?)/.test(text)) {
          if (/\b(?:flowers?|ornaments?|ribbons?|clips?|pins?)\b/.test(text)) return "hair-accessory";
          if (/\b(?:gradient|ombre|multicolor|streak|highlight|two.toned?|split.color)/.test(text)) return "hair-color-treatment";
          if (/\b(?:black|white|blond|blonde|red|blue|pink|purple|silver|brown|green|gray|grey|orange)\b/.test(text)) return "hair-color";
          if (/\bbangs?\b/.test(text)) return "hair-bang";
          if (/\b(?:long|short|medium|very long)\b/.test(text)) return "hair-length";
          return "hair-style";
        }
        if (/\b(?:pupil|heterochromia|iris)\b/.test(text)) return "eye-pupil";
        if (/\b(?:eyes?|eyelashes?)\b/.test(text) && !/eyeshadow|makeup/.test(text)) return "eyes";
        if (/\b(?:skin|tan|tanned|freckles)\b/.test(text)) return "skin-tone";
        if (/makeup|eyeshadow|cheek|nail|face|fang|lip/.test(text)) return "face-point";
        return "character-archetype";
      case "medium": return "guided-medium";
      case "graphics": return "guided-graphic";
      case "environment": return "setting";
      case "aesthetic": return "genre";
      case "light": return "lighting";
      case "palette": return "palette";
      case "air": return /\b(?:night|day|daytime|morning|evening|dusk|dawn|sunset|sunrise|winter|summer|spring|autumn|snow|snowflakes|rain|raining|raindrops|sunny|fog|misty|mist|halloween)\b/.test(text) ? "time-weather" : "atmosphere";
      case "outfit-base":
        if (/\b(?:inner|underneath|bra|panties|camisole|lingerie|underwear)\b/.test(text)) return "under-layer";
        if (/skirt|shorts|pants|trousers|slacks|jeans|\bchima\b/.test(text) && !/dress|shirt|\btop\b|overalls|t-shirt|bodysuit|outfit/.test(text)) return "bottomwear";
        return "wardrobe";
      case "construction": return /\b(?:fit|coverage|silhouette|asymmetrical|midriff|stomach|backless|bare back|cleavage|bare arms|bare shoulders)\b/.test(text) ? "outfit-fit" : "guided-construction";
      case "fabric": return "material";
      case "motif": return "guided-construction";
      case "legwear": return /\b(?:shoe|shoes|boots?|sneakers?|heels?|sandals?|loafers?|pumps|mary janes?|footwear|slippers?|barefoot|platforms?)\b/.test(text) ? "footwear" : "legwear";
      case "accessory": return /hair|\b(?:head|headwear|headpiece|headdress|headband|headscarf|headphones|headset|hat|cap|crown|tiara|bonnet|beret|beanie|veil|glasses|sunglasses|eyewear|goggles|visor|mask|eyepatch|bandana|kerchief|kanzashi|earflap)\b/.test(text) ? "hair-accessory" : "jewelry";
      case "floating": return "scene-decor";
      case "prop": return "hand-prop";
      case "layout": return "guided-editorial";
      case "gaze": return /look|gaz[ei]|glance|eye contact|staring|\bstare\b/.test(text) ? "gaze" : "expression";
      case "hands": return "hand-action";
      case "pose": return "body-action";
      case "framing": return "framing";
      case "camera": return /(?:high|low|eye.level|top.down|overhead|above|below)/.test(text) ? "camera-height" : "camera-direction";
      case "motion": return "composition-extra";
      default: throw new Error(`No guided question host for ${item.id}: ${item.facet}`);
    }
  }

  const families = {
    "scene-cast": [
      rule("cast", "인원과 중심 인물", /^(?:solo(?: focus)?|1girl|1boy|2girls?|2boys?|2people|multiple individuals|male|female)$/),
      rule("kiss", "입맞춤과 얼굴 맞대기", /kiss|forehead|cheek|nose|face/),
      rule("embrace", "포옹과 몸의 접촉", /hug|embrac|arm|waist|lap|chest/),
      rule("hands", "손을 통한 교감", /hand|finger|palm/),
      rule("distance", "거리와 몸의 방향", /lean|close|near|back|behind|front|side|toward/),
      rule("relationship", "시선과 관계의 분위기"),
    ],
    "guided-medium": [
      rule("watercolor", "수채화와 물감", /watercolor|\bpaint(?:ing)?\b|pigment|wash|wet.on.wet|granulation/, world(5)),
      rule("pixel", "픽셀과 게임 그래픽", /pixel|bit|dither|jagged/),
      rule("line", "선화와 스케치", /line|sketch|genga|trace|unpainted|production|animation|colored/),
      rule("flat", "평면 색면과 명암", /flat|shading|pop art/),
      rule("three-d", "입체와 종이 공예", /3d|poly|craft/),
      rule("photo", "사진과 필름", /photo|film/),
      rule("surface", "화구와 종이의 표면"),
    ],
    genre: [
      rule("gothic", "고딕과 로리타", /goth|lolita|jirai|dark fantasy/),
      rule("street", "스트리트와 서브컬처", /street|cyber|techwear|punk|y2k|subculture|decora|skater/),
      rule("retro", "레트로와 팝", /retro|vintage|1990|2000|vaporwave|pop art/),
      rule("fantasy", "판타지와 캐릭터 테마", /magical|angel|ethereal|jiangshi|umamusume|cosplay/),
      rule("sweet", "달콤한 테마와 장식", /cute|sweet|pastel|candy|rabbit|peach|strawberry|valentine|floral|sticker/),
      rule("fashion", "패션과 생활 스타일", /fashion|formal|casual|sportswear|idol|gender|layered|comfortable/),
      rule("mood", "분위기와 표현의 밀도"),
    ],
    setting: [
      rule("indoor", "실내와 생활 공간", /room|bed|pillow|bedding|indoor|interior|closet|kitchen|bathroom|living|\bcabin\b|sunroom|sofa|fireplace|blanket|cushion|playroom|treehouse/, world(6)),
      rule("city", "거리와 도시", /street|city|urban|skyline|skyscraper|building|town|road|crosswalk|rooftop|alley|utility pole|power lines|storefront|vending|catwalk/, world(7)),
      rule("nature", "정원과 자연", /garden|forest|flower|roses?|sunflower|plant|foliage|ivy|tree|field|grass|bush|bamboo|backyard|leaves/, world(7)),
      rule("water-sky", "하늘과 물의 공간", /sky|cloud|space|galaxy|nebula|starfield|starry|milky way|underwater|water|sea|ocean|beach|aquarium|fish tank|horizon/, world(7)),
      rule("venue", "학교와 공연·놀이 공간", /school|classroom|locker|stage|concert|idol|crowd|plaza|arcade|gaming|claw|park|carousel|ferris|merry.go.round|court|stadium|racetrack|track|poolparty/, world(7)),
      rule("historic", "전통·역사·판타지 건축", /church|cathedral|sacred|temple|burial|palace|castle|traditional|architecture|pavilion|engawa|japanese|statue|ruin|arch|pillar|ornate|carriage/, world(6)),
      rule("objects", "가구와 공간 속 사물", /table|desk|window|curtain|mirror|wall|floor|cabinet|gate|door|fence|panel|clock|gear|wire|plush|teddy|bear|toy|car|train|locomotive|supplies|object|poster|rug|tile|glass|menu/, world(6)),
      rule("backdrop", "단색과 장식 배경", null, world(8)),
    ],
    "guided-graphic": [
      rule("type", "문자와 타이포그래피", /text|typograph|headline|title|letter|character|digit|copyright|logo|cover lines|ascii|kaomoji/),
      rule("border", "테두리와 외곽선", /border|outline|frame|corner|edge/),
      rule("paper", "종이와 콜라주", /paper|tape|stamp|postmark|clip|tear|punch|notebook/),
      rule("pattern", "격자와 반복 문양", /grid|stripe|plaid|check|gingham|polka|pattern|halftone|screen tone|print/),
      rule("ui", "아이콘과 화면 표시", /icon|cursor|barcode|annotation|mark|number|arrow|code|data|error/),
      rule("drawing", "낙서와 물감", /graffiti|paint|doodle|hand.drawn|splatter/),
      rule("symbol", "하트·별·도형 장식"),
    ],
    lighting: [
      rule("natural", "햇빛과 달빛", /sun|daylight|daytime|morning|moon|window light/, world(9)),
      rule("electric", "조명기구와 네온", /neon|stage|concert|spotlight|streetlight|lightbulb|screen|city lights|string lights|fairy lights|chandelier|candle|candelabra|jack.o/, world(9)),
      rule("reflection", "반사와 굴절", /reflect|refract|caustic|iridescen|stained glass|rainbow/, world(9)),
      rule("particle", "반짝임과 빛 입자", /sparkl|glitter|twinkl|particles|dust|orbit/, world(9)),
      rule("glow", "발광과 마법 효과", /glow|magic|lumin|hologra|lightning|light effects|light projection/, world(9)),
      rule("shadow", "명암과 광원의 방향", /shadow|rim|backlight|contrast|chiaroscuro|dramatic|dim|soft flat/, world(9)),
      rule("lens", "초점과 렌즈 효과", /bokeh|blur|focus|flare|bloom|aberration|glitch|bleed|distortion/, world(9)),
      rule("tone", "빛의 색과 강도", null, world(9)),
    ],
    palette: [
      rule("pastel", "파스텔과 밝은 배색", /pastel|soft|pale|light|candy/),
      rule("dark", "어두운 색과 무채색", /dark|black|white|mono|gray|grey/),
      rule("warm", "따뜻한 색 계열", /pink|red|peach|yellow|orange|warm|gold/),
      rule("cool", "차가운 색 계열", /blue|cyan|purple|violet|green|cool|aqua|indigo/),
      rule("contrast", "다색과 대비·그라데이션"),
    ],
    "time-weather": [
      rule("night", "밤과 별이 뜬 시간", /night|starry|halloween/),
      rule("day", "낮과 햇살", /day|sunny/),
      rule("twilight", "해질녘과 시간의 변화", /dusk|dawn|evening|sunset|sunrise|transition/),
      rule("winter", "겨울과 눈", /winter|snow/),
      rule("summer", "여름과 계절", /summer|spring|autumn/),
      rule("rain", "비와 물방울", /rain/),
      rule("mist", "안개와 흐린 공기"),
    ],
    atmosphere: [
      rule("dream", "몽환과 꿈결", /dream|ethereal/),
      rule("magic", "마법과 신비", /magic|myst|fairytale|holy|aura/),
      rule("gentle", "따뜻하고 로맨틱한 기분", /warm|inviting|romantic|sweet|gentle|cute/),
      rule("energetic", "활기와 축제", /lively|party/),
      rule("dark", "어둡고 낯선 분위기", /dark|goth|eerie/),
      rule("particles", "공중의 입자와 연기", /particle|smoke|steam|dust|stardust/),
      rule("ambient", "공간에 흐르는 분위기"),
    ],
    wardrobe: [
      rule("dress", "드레스와 원피스", /dress|gown|sundress|ballgown|tutu/, detail(1)),
      rule("top", "셔츠와 상의", /shirt|blouse|\btop\b|\btee\b|turtleneck/, detail(1)),
      rule("outer", "재킷과 겉옷", /jacket|coat|windbreaker|cape|shawl|blazer/, detail(1)),
      rule("knit", "후디와 니트", /hoodie|sweatshirt|sweater|cardigan|knit|vest/, detail(1)),
      rule("traditional", "전통복과 시대 의상", /hanbok|jeogori|qipao|china dress|yukata|jinbei|japanese|victorian/, detail(1)),
      rule("uniform", "제복과 무대 의상", /uniform|maid|nurse|waitress|idol|conductor|chef|postman|racing|magical girl|tactical|suit/, detail(1)),
      rule("leisure", "수영복과 홈웨어", /swim|bikini|bodysuit|kigurumi|sleep|lounge/, detail(1)),
      rule("layers", "조합 의상과 레이어", null, detail(1)),
    ],
    bottomwear: [
      rule("skirt", "치마", /skirt|chima/, detail(1)),
      rule("shorts", "짧은 바지", /shorts/, detail(1)),
      rule("pants", "긴 바지", /pants|trousers|slacks|jeans/, detail(1)),
      rule("lower", "하의와 겹쳐 입기", null, detail(1)),
    ],
    "under-layer": [
      rule("inner-top", "속에 겹치는 상의", /shirt|\btee\b|turtleneck|\btop\b/, detail(1)),
      rule("camisole", "캐미솔과 얇은 이너", /camisole|slip/, detail(1)),
      rule("intimates", "언더웨어", /bra|panties|lingerie|underwear/, detail(1)),
      rule("inner-dress", "안쪽 원피스와 레이어", null, detail(1)),
    ],
    "outfit-fit": [
      rule("fit", "몸에 맞는 정도", /fit|bodice|corset/, detail(0)),
      rule("silhouette", "전체 실루엣과 균형", /silhouette|asymmetrical/, detail(0)),
      rule("coverage", "노출과 덮는 범위", null, detail(0)),
    ],
    "guided-construction": [
      rule("sleeves", "소매와 팔 부분", /sleeve|arm warm|arm ruffle/, detail(0)),
      rule("collar", "칼라와 목선", /collar|neckline|lapel|halterneck/, detail(0)),
      rule("body", "몸판·허리·여밈", /corset|bodice|waist|lacing|lace.up|cross.lac|zip|button|closure|suspender|ties|torso/, detail(0)),
      rule("layers", "밑단과 레이어", /hem|train|petticoat|layer|ruffle/, detail(1)),
      rule("hood", "후드와 머리 부분", /hood/, detail(5)),
      rule("ribbons", "리본과 매듭", /ribbon|bow|knot|drawstring/, detail(3)),
      rule("pattern", "문양·자수·프린트", /pattern|print|embroid|stripe|gingham|check|polka|patch|stitch|applique|motif/, detail(3)),
      rule("ornament", "장식과 마감", null, detail(3)),
    ],
    material: [
      rule("lace", "레이스와 얇은 소재", /lace|sheer|transparen|translucen|chiffon|tulle/, detail(2)),
      rule("soft", "털과 푹신한 표면", /fur|fluff|plush|soft|fuzzy/, detail(2)),
      rule("shiny", "반짝임과 매끈한 표면", /satin|silk|shiny|gloss|iridescen|metal|holo/, detail(2)),
      rule("knit", "니트와 직조", /knit|wool|rib|crochet|woven/, detail(2)),
      rule("firm", "가죽·데님·기능성 소재", /leather|denim|pvc|vinyl|technical|mesh/, detail(2)),
      rule("surface", "주름과 표면 마감", null, detail(2)),
    ],
    legwear: [
      rule("thighhigh", "허벅지까지 오는 양말", /thigh|over.knee/, detail(4)),
      rule("tights", "스타킹과 타이즈", /tights|pantyhose|stocking|fishnet/, detail(4)),
      rule("socks", "양말과 니삭스", /sock|knee.high/, detail(4)),
      rule("warmers", "레그워머와 다리 장식", /warmer|garter|strap/, detail(4)),
      rule("leg-detail", "다리 의상의 다른 디테일", null, detail(4)),
    ],
    footwear: [
      rule("boots", "부츠", /boot/, detail(4)),
      rule("sneakers", "운동화와 스니커즈", /sneaker|sport|running/, detail(4)),
      rule("formal", "구두와 힐", /heel|pump|mary jane|loafer/, detail(4)),
      rule("open", "샌들과 맨발", /sandal|barefoot|slipper/, detail(4)),
      rule("shoes", "신발의 형태와 장식", null, detail(4)),
    ],
    "hair-accessory": [
      rule("hat", "모자와 머리 덮개", /\b(?:hat|cap|beret|beanie|bonnet|headscarf|bandana|kerchief)\b/, detail(5)),
      rule("ribbon", "헤어 리본과 머리띠", /ribbon|bow|headband/, detail(5)),
      rule("ornament", "핀과 꽃·보석 장식", /ornament|pin|clip|crown|tiara|kanzashi|flower|tassel/, detail(5)),
      rule("veil", "베일과 헤드드레스", /veil|headdress|headpiece/, detail(5)),
      rule("audio", "헤드폰과 헤드셋", /headphone|headset/, detail(5)),
      rule("eyewear", "안경과 얼굴 소품", /glasses|eyewear|goggles|visor|mask|eyepatch/, detail(5)),
      rule("head-detail", "머리에 더하는 장식", null, detail(5)),
    ],
    jewelry: [
      rule("neck", "목과 가슴의 장식", /neck|choker|pendant|\btie\b|brooch|rosary|muffler|square/, detail(6)),
      rule("waist", "허리·벨트·스트랩", /belt|waist|buckle|strap|harness|holster|obi|sash|norigae/, detail(6)),
      rule("hands", "손·손목·팔 장식", /glove|cuff|wrist|bracelet|\brings?\b|arm chain|arm ribbon|binding/, detail(6)),
      rule("bag", "가방과 연결 소품", /bag|backpack|pouch|keychain|charm/, detail(7)),
      rule("ear", "귀걸이와 피어싱", /earring|piercing/, detail(6)),
      rule("fantasy", "귀·뿔·날개·꼬리", /\bears?\b|horn|wing|tail|halo|\bfin\b|exo.frame/, detail(6)),
      rule("chain", "체인과 연결 장식", /chain|handcuff/, detail(6)),
      rule("accessory", "보석과 착용 장식", null, detail(6)),
    ],
    "hand-prop": [
      rule("food", "음식과 음료", /cream|food|drink|coffee|tea|cake|candy|lollipop|dango|fruit|apple|peach|strawberry|cherry|lemon|burger|chocolate/, detail(7)),
      rule("paper", "책과 편지·종이", /book|letter|envelope|scroll|card|paper|menu|sign/, detail(7)),
      rule("device", "전자 기기와 게임", /phone|camera|game|console|tamagotchi|computer|headset/, detail(7)),
      rule("music", "악기와 공연 소품", /guitar|microphone|megaphone|lightstick/, detail(7)),
      rule("nature", "꽃과 식물", /flower|bouquet|rose|vines|plant/, detail(7)),
      rule("tools", "도구와 장비", /weapon|sword|gun|bow|scythe|racket|roller|brush|whisk|helmet|umbrella|lantern/, detail(7)),
      rule("keepsake", "장식품과 개인 소품", null, detail(7)),
    ],
    "scene-decor": [
      rule("flowers", "꽃과 잎·깃털", /flower|petal|rose|leaf|leaves|blossom|sunflower|tulip|feather/, detail(8)),
      rule("sweets", "과자와 음식", /sweet|candy|candies|chocolate|cake|cookie|macaron|donut|parfait|cream|syrup|fruit|strawberr|cherr|peach|lemon|dessert|topping|sprinkle|carrot|food|popsicle|gummy/, detail(8)),
      rule("animals", "나비·새·물속 생물", /butterfl|bird|jellyfish|goldfish|\bfish\b|\bbats?\b|cupids?|horse|starfish|shell/, detail(8)),
      rule("particles", "거품·눈·공중 입자", /bubble|bead|water|droplet|snow|dust|particle|contrail|sparkle|firework/, detail(8)),
      rule("celestial", "하트·별·달", /heart|star|moon|crescent|sphere/, detail(8)),
      rule("celebration", "풍선·리본·축제 장식", /balloon|ribbon|confetti|banner|bunting|lantern|garland|gift|pennant|talisman|playing cards/, detail(8)),
      rule("treasure", "보석과 금속 장식", /crystal|gem|diamond|ruby|rubies|sapphire|pearl|gold|silver|ornament|mirror|clock/, detail(8)),
      rule("objects", "스티커와 떠 있는 사물", null, detail(8)),
    ],
    "guided-editorial": [
      rule("print", "책·잡지·인쇄물", /magazine|cover|newspaper|book|poster|editorial|postcard/),
      rule("collage", "콜라주와 사진 모음", /collage|scrap|photo|polaroid|album/),
      rule("sheet", "시트와 여러 장면", /sheet|multiple|panel|comic|manga|views|sequence/),
      rule("game", "게임 화면과 HUD", /game|hud|status|training|raising|skill/),
      rule("ui", "컴퓨터 창과 인터페이스", /interface|window|menu|button|screen|dialog|taskbar|profile|cursor/),
      rule("layout", "화면 분할과 정보 배치"),
    ],
    expression: [
      rule("smile", "미소와 웃음", /smil|grin|smirk|happy|joy|cheer/),
      rule("eyes", "눈의 표정", /eye|wink|;\)/),
      rule("mouth", "입과 입술", /mouth|lip|tongue|teeth|:3|candy/),
      rule("blush", "홍조와 부끄러움", /blush|shy|bashful|embarrass|fluster|coy/),
      rule("sad", "슬픔과 긴장", /sad|melanchol|worr|distress|sorrow|frown|hesitant|sweat/),
      rule("confident", "자신감과 강한 감정", /confident|determin|serious|surpris|playful|cute|seductive|loving/),
      rule("calm", "차분함과 무표정"),
    ],
    gaze: [
      rule("viewer", "관객과 눈 맞추기", /viewer|camera|eye contact|direct gaze/),
      rule("up", "위쪽 보기", /up|sky/),
      rule("down", "아래쪽 보기", /down|lower/),
      rule("side", "옆·뒤·먼 곳 보기", /side|back|away|avert/),
      rule("object", "대상과 공간 바라보기"),
    ],
    "hand-action": [
      rule("hold", "소품 들기와 사용하기", /hold|\bin hand\b|held|phone to ear|talking on phone|speaking into|aiming|drawing bow|blowing bubbles|offering|presenting|hugging/, detail(9)),
      rule("face", "얼굴과 머리 주변", /\bface\b|mouth|lips?|chin|cheek|\bhead\b|eyes|forehead|\bneck\b/, detail(9)),
      rule("clothes", "옷과 착용 소품 만지기", /glasses|eyewear|hat|tie|collar|hood|veil|hair|pocket/, detail(9)),
      rule("gesture", "손가락과 손바닥 제스처", /peace|\bv hand\b|heart|claw|rawr|paw|palm|finger|salut|praying|clasp|together/, detail(9)),
      rule("arm", "팔을 들거나 뻗기", /rais|\bup\b|reach|outstretch|spread|limp/, detail(9)),
      rule("support", "몸과 바닥을 짚거나 받치기", /rest|brac|ground|lap|hip|shoulder|feet|knee|between legs|surface|macaron|support|lean/, detail(9)),
      rule("touch", "손의 위치와 접촉", null, detail(9)),
    ],
    "body-action": [
      rule("sit", "앉기와 걸터앉기", /sitt|seated|seiza|wariza|sidesaddle|straddl/, detail(10)),
      rule("lie", "눕기와 엎드리기", /lying|prone|reclin|on back|sleep|curled/, detail(10)),
      rule("stand", "서기와 무릎 자세", /standing|kneel|crouch|squat|one knee down|en pointe|tiptoes/, detail(10)),
      rule("motion", "걷기·달리기·춤", /walk|run|sprint|danc|ballet|ballerina|twirl|leap|jump|mid.air|midair|floating|flying|weightless|waddl/, detail(10)),
      rule("head", "고개와 상체 기울이기", /head|lean|bent posture|shoulder|upper body|arch|slouch|twist/, detail(10)),
      rule("legs", "다리의 방향과 교차", /\blegs?\b|feet|knee|dangl/, detail(10)),
      rule("activity", "놀이·식사·도구 사용", /eat|drink|suck|blow|play|sing|riding|skate|swing|tennis|archery|brush|yawn|puppet|bunny/, detail(10)),
      rule("posture", "자세의 인상과 몸의 방향", null, detail(10)),
    ],
    framing: [
      rule("close", "얼굴과 가까운 거리", /close|portrait|face|head|bust/, detail(11)),
      rule("upper", "상반신과 중간 거리", /upper|waist|cowboy|medium|thigh|chest/, detail(11)),
      rule("whole", "전신과 넓은 장면", /full|whole|wide|long shot/, detail(11)),
      rule("crop", "크롭과 화면 속 비중", null, detail(11)),
    ],
    "camera-direction": [
      rule("front", "정면에서 보기", /front|frontal|facing viewer/, detail(11)),
      rule("side", "옆과 뒤에서 보기", /side|profile|behind|back|shoulder|away/, detail(11)),
      rule("tilt", "기울어진 시점", /dutch|tilt|diagonal|angled/, detail(11)),
      rule("perspective", "원근과 깊이", /perspective|foreshorten|depth|wide angle/, detail(11)),
      rule("balance", "중심과 화면의 균형", /center|balance|square|vertical/, detail(11)),
      rule("composition", "역동성과 화면 구성", null, detail(11)),
    ],
    "camera-height": [
      rule("low", "아래에서 올려다보기", /low|below/, detail(11)),
      rule("high", "위에서 내려다보기", /high|above|top.down|overhead/, detail(11)),
      rule("eye", "눈높이에서 보기", null, detail(11)),
    ],
    "composition-extra": [
      rule("hair", "머리카락의 흐름", /hair/, detail(10)),
      rule("cloth", "옷과 천의 흩날림", /cloth|fabric|dress|skirt|ribbon|cape|veil/, detail(10)),
      rule("air", "바람과 공기의 흐름", /wind|breeze|air|particle/, detail(10)),
      rule("movement", "속도와 움직임의 효과", null, detail(10)),
    ],
  };

  const appearanceFamilies = [
    rule("hair-length", "길이와 머리의 흐름", /long|short|medium/, world(1)),
    rule("hair-style", "묶음과 머리의 형태", /bun|braid|tail|hair/, world(1)),
    rule("eyes", "눈과 눈동자", /eye|pupil|iris/, world(2)),
    rule("makeup", "화장과 얼굴 포인트", /makeup|eyeshadow|cheek|face|lip|fang/, world(2)),
    rule("nails", "손톱과 네일", /nail/, world(2)),
    rule("skin", "피부와 체형", /skin|body|proportion/, world(3)),
    rule("scale", "작은 비례와 크기", /chibi|deformed|miniature|giant/, world(3)),
    rule("character", "종족과 캐릭터성", null, world(3)),
  ];

  // Refinements describe the subject rather than an arbitrary alphabetic or
  // numbered bucket. Only populated categories become navigation choices.
  const contextual = [
    rule("flower", "꽃과 식물 모티프", /flower|floral|rose|blossom|leaf|leaves|vine|bamboo|plant|sunflower/),
    rule("animal", "동물과 생물 모티프", /\b(?:animals?|rabbits?|bunny|bunnies|cats?|dogs?|bears?|birds?|butterflies|butterfly|bats?|fish|sharks?|wolf|wolves|fox|foxes|frogs?|ducks?|pandas?|penguins?|raccoons?|squirrels?|dinosaurs?|paws?)\b/),
    rule("heart", "하트와 둥근 장식", /heart|round|bubble|balloon|polka|circle/),
    rule("star", "별·달·십자 장식", /star|moon|celestial|cross|angel|demon|horn|wing|halo/),
    rule("ribbon", "리본과 끈 장식", /ribbon|\bbows?\b|lace.up|lacing|strap|\bties?\b|cord|knot/),
    rule("pattern", "줄무늬·격자·반복 무늬", /strip|plaid|gingham|check|argyle|pattern|print|dot|grid/),
    rule("decorated", "프릴과 표면 장식", /frill|ruffle|\blace\b|embroid|trim|ornament|decor|\bfur\b|fluff|glitter|pearl|crystal|\bgold\b|\bsilver\b/),
    rule("plain", "기본 형태와 다른 변주"),
  ];
  const colors = [
    rule("pink-red", "분홍·빨강·보랏빛", /\b(?:pink|red|rose|purple|violet|crimson|scarlet|magenta|peach)\b/),
    rule("blue-green", "파랑·초록·청록빛", /\b(?:blue|green|cyan|aqua|mint|teal|indigo|navy)\b/),
    rule("light", "흰색과 밝은 색", /\b(?:white|ivory|cream|beige|yellow|gold|pastel|pale|light|soft)\b/),
    rule("dark", "검정과 어두운 색", /\b(?:black|dark|gray|grey|brown|charcoal)\b/),
    rule("multi", "다색과 색의 조합", /\b(?:rainbow|multicolor|multicolored|colorful|gradient|iridescent|holographic|color.blocked)\b/),
    rule("neutral", "색을 정하지 않은 표현"),
  ];
  const mediumDetails = [
    rule("wash", "물감의 번짐과 안료", /wash|wet|bleed|pool|bloom|dilut|pigment|granulation/),
    rule("surface", "화지·필름과 표면의 결", /paper|grain|canvas|texture|fiber|film/),
    rule("linework", "선·붓질과 드로잉", /stroke|line|sketch|brush|pencil|ink|genga|trace/),
    rule("coverage", "투명도와 칠하지 않은 여백", /transparent|translucent|unpainted|unfinished|blank|empty/),
    rule("coloring", "색면과 명암의 표현", /color|colour|shading|halftone|dither|contrast/),
    rule("technique", "기본 매체와 다른 표현 기법"),
  ];
  const positions = [
    rule("upper", "얼굴·머리·상체 주변", /\bface\b|\bhead\b|hair|mouth|lips?|chin|cheek|neck|shoulder|chest|upper|\bhat\b|hood/),
    rule("lower", "허리·다리·발 주변", /waist|\blegs?\b|knee|feet|foot|ankle|thigh|hip|\blap\b|floor|\bground\b/),
    rule("toward", "앞으로 향하거나 내밀기", /viewer|forward|front|toward|outstretch|reach|direct/),
    rule("side", "옆·뒤·기울어진 방향", /side|back|behind|tilt|angle|diagonal/),
    rule("up", "올리거나 공중으로", /\bup\b|rais|above|overhead|floating|flying|mid.air|jump|leap/),
    rule("down", "낮추거나 아래쪽으로", /down|lower|below|prone/),
    rule("relaxed", "편안하고 작은 동작", /relax|soft|gentle|slight|calm|rest|cute|playful/),
    rule("general", "전체 자세와 다른 방향"),
  ];
  const places = [
    rule("home", "방과 편안한 생활 공간", /bed|room|living|cushion|pillow|blanket|sofa|closet|cabin|fireplace|home/),
    rule("food", "카페·가게·식탁", /cafe|shop|store|kitchen|diner|table|menu|dessert|sweet|food/),
    rule("historic", "전통·고딕·판타지 공간", /goth|cathedral|church|temple|palace|castle|ancient|tradition|ornate|antique|japanese|korean|chinese|victorian|steampunk/),
    rule("city", "도시·교통·거리", /city|urban|street|road|town|skyline|building|\bcars?\b|train|vehicle|crosswalk|rooftop|alley/),
    rule("nature", "정원·숲·자연", /garden|forest|flower|rose|plant|tree|foliage|ivy|grass|field|bamboo/),
    rule("sky-water", "하늘·우주·물", /sky|cloud|space|galaxy|star|nebula|water|sea|ocean|beach|aquarium/),
    rule("play", "공연·놀이·학교", /stage|concert|idol|school|class|park|carousel|ferris|arcade|claw|game|play|court|stadium/),
    rule("spatial", "공간의 형태와 배경 디테일"),
  ];
  const outfitDetails = [
    rule("gothic", "고딕·로리타·클래식", /goth|lolita|nun|victorian|wedding|bridal|vintage|elegant/),
    rule("sweet", "프릴·리본·달콤한 디자인", /frill|ruffle|ribbon|bow|sweet|candy|cute|tutu/),
    rule("casual", "일상과 편안한 디자인", /casual|oversiz|loose|baggy|relax|hood|sweat|cardigan|knit|denim|t.shirt|\btee\b/),
    rule("formal", "셔츠·수트·단정한 디자인", /formal|tailor|suit|collar|button|blazer|dress shirt/),
    rule("active", "활동복·기능성 디자인", /sport|track|tactical|racing|cargo|utility|tech|military/),
    rule("shape", "길이와 재단의 변주", /mini|short|long|crop|sleeve|strap|pleat|layer|flare|tier|wide|asymmetr/),
    rule("style", "의상 유형의 다른 변주"),
  ];
  const objectDetails = [
    rule("flower", "꽃·식물·생물", /flower|bouquet|rose|petal|leaf|leaves|bird|butterfl|fish|shell|animal/),
    rule("food", "음식·과일·과자", /food|sweet|candy|lollipop|cake|cream|parfait|macaron|strawberr|peach|cherr|chocolate|dango|apple|fruit|burger|drink/),
    rule("soft", "인형·쿠션·부드러운 소품", /plush|teddy|bear|rabbit|pillow|cushion|soft|fluffy/),
    rule("device", "전자 기기와 도구", /phone|camera|game|tamagotchi|microphone|megaphone|guitar|gun|sword|bow|scythe|brush|racket|roller|whisk|helmet/),
    rule("paper", "종이·책·편지·스티커", /paper|book|letter|envelope|card|sticker|banner|sign|menu|scroll/),
    rule("ornament", "보석과 장식 소품", /jewel|crystal|gem|diamond|pearl|necklace|charm|ribbon|balloon|star|heart|moon|lantern/),
    rule("other", "사물의 형태와 배치"),
  ];
  const opticalDetails = [
    rule("warm", "따뜻한 빛", /warm|sun|yellow|gold|orange|candle|morning/),
    rule("cool", "차가운 빛", /cool|blue|cyan|moon|purple|violet/),
    rule("pink", "분홍빛과 다채로운 빛", /pink|rainbow|colorful|psychedelic|multicolor|stained glass/),
    rule("soft", "은은하고 부드럽게", /soft|gentle|faint|dream|dim|delicate|subtle|mist/),
    rule("strong", "강하고 선명하게", /strong|intense|bright|massive|powerful|dramatic|vibrant|high contrast/),
    rule("natural", "자연스러운 빛과 기본 효과"),
  ];

  const specificRefinements = {
    "setting:indoor": [
      rule("sleep", "침실과 침구", /bed|bedding|pillow|sheet/),
      rule("living", "거실과 편안한 실내", /living|sofa|rug|fireplace|cushion|blanket|cozy|sunroom/),
      rule("shop", "카페·상점·식당", /cafe|shop|diner|sweet|dessert/),
      rule("facility", "학교·의료·작업 공간", /school|class|medical|hospital|lab|desk|playroom/),
      rule("historic", "전통·고딕·장식 실내", /goth|cathedral|church|temple|palace|japanese|antique|dollhouse|ornate|jewelry box/),
      rule("utility", "욕실·주방·옷장", /bath|kitchen|closet/),
      rule("room", "방의 색과 기본 공간"),
    ],
    "setting:objects": [
      rule("windows", "창문·커튼·거울", /window|curtain|mirror|glass panel/),
      rule("furniture", "책상·탁자·가구", /desk|table|cabinet|chair|rug/),
      rule("surfaces", "벽·바닥·표면", /wall|floor|tiles?|poster/),
      rule("plush", "인형과 장난감", /plush|teddy|bear|toy/),
      rule("transport", "열차와 탈것", /train|locomotive|\bcar\b|vehicle/),
      rule("clockwork", "시계·기어·기계 장치", /clock|gear|wire/),
      rule("architecture", "문·울타리·공간 구조", /door|gate|fence|panel|arch/),
      rule("objects", "공간에 놓인 사물"),
    ],
    "setting:city": [
      rule("street", "거리·도로·골목", /street|road|crosswalk|alley|asphalt/),
      rule("skyline", "스카이라인과 높은 건물", /skyline|skyscraper|metropolis/),
      rule("buildings", "건물과 도시의 건축", /building|architecture|town|storefront/),
      rule("rooftop", "옥상과 높은 야외 공간", /rooftop|catwalk|terrace/),
      rule("infrastructure", "전신주와 거리 시설", /utility|power|vending/),
      rule("city", "도시의 전체 풍경"),
    ],
    "setting:nature": [
      rule("flowers", "꽃과 꽃밭", /flower|rose|sunflower|floral|blossom/),
      rule("forest", "숲과 나무", /forest|tree|bamboo/),
      rule("plants", "덩굴·잎·식물", /ivy|foliage|plant|bush|canopy|leaves/),
      rule("grass", "들판과 풀밭", /field|grass|hill/),
      rule("garden", "정원과 뒤뜰"),
    ],
    "setting:backdrop": [
      rule("solid", "단색과 빈 공간", /solid|white space|void|simple|clean|flat/),
      rule("gradient", "그라데이션과 색의 흐름", /gradient|pastel colored|colorful/),
      rule("surface", "질감과 반복 문양", /textured|pattern|check|gingham|grid|fluffy/),
      rule("decorative", "장식적이고 귀여운 배경", /decor|cute|kawaii|candy/),
      rule("surreal", "추상적이거나 복잡한 배경", /abstract|surreal|chaotic|clutter/),
      rule("background", "색과 기본 배경의 인상"),
    ],
    "setting:water-sky": [
      rule("space", "우주와 은하", /space|galaxy|starfield|nebula|milky/),
      rule("night-sky", "별이 있는 하늘", /starry|star/),
      rule("clouds", "구름", /cloud/),
      rule("sea", "바다와 해변", /sea|ocean|beach|foam|horizon/),
      rule("underwater", "물속과 수족관", /underwater|aquarium|fish tank/),
      rule("water", "수면과 물의 움직임", /water|splash|ripples/),
      rule("sky", "하늘의 색과 열린 공간"),
    ],
    "setting:venue": [
      rule("school", "학교와 교실", /school|class|locker/),
      rule("concert", "공연장과 무대", /stage|concert|idol/),
      rule("amusement", "놀이공원과 놀이기구", /amusement|carousel|ferris|merry.go.round/),
      rule("game", "게임장과 뽑기 기계", /arcade|gaming|claw|crane/),
      rule("sports", "운동장과 스포츠 공간", /court|stadium|track|skate|pool/),
      rule("crowd", "군중과 광장", /crowd|plaza/),
      rule("park", "공원과 야외 활동 공간"),
    ],
    "guided-graphic:type": [
      rule("title", "제목과 헤드라인", /title|headline|logo|cover lines/),
      rule("language", "일본어·영어·문자 표현", /japanese|english|chinese|ascii|kaomoji|html|pixel text|floating text/),
      rule("layout", "본문과 문자의 배치", /block|column|band|area|overlay|large text/),
      rule("style", "서체와 타이포의 인상", /typograph|lettering|text design|neon text/),
      rule("annotation", "주석과 임의 문자", /random|gibberish|annotation|copyright|character name/),
      rule("text", "기본 문자와 텍스트"),
    ],
    "hand-action:hold": [
      rule("food", "음식과 음료 들기", /food|candy|lollipop|chocolate|dessert|cream|fruit|strawberry|apple|peach|burger|drink|snack|dango|popsicle|frappuccino/),
      rule("flower", "꽃과 꽃다발 들기", /flower|bouquet/),
      rule("paper", "책·편지·종이 들기", /book|letter|envelope|scroll|sign|menu/),
      rule("device", "기기와 게임기 사용", /phone|camera|game|console|tamagotchi/),
      rule("music", "공연과 악기 연주", /microphone|megaphone|guitar|lightstick/),
      rule("tool", "도구와 장비 사용", /gun|bow|scythe|racket|roller|brush|whisk|dryer|toothbrush|helmet|lantern|umbrella|spoon|fork|tray|bottle|wand/),
      rule("soft", "인형·쿠션·가방 안기", /plush|teddy|rabbit|pillow|bag/),
      rule("object", "작은 소품과 다른 물건 들기"),
    ],
    "hand-action:face": [
      rule("mouth", "입가와 입술", /mouth|lip/),
      rule("chin", "턱을 받치거나 만지기", /chin/),
      rule("cheek", "뺨과 얼굴", /cheek|\bface\b/),
      rule("head", "머리와 이마", /head|forehead|eyes/),
      rule("neck", "목과 상체 주변"),
    ],
    "jewelry:hands": [
      rule("gloves", "장갑과 손을 덮는 소품", /glove/),
      rule("cuffs", "커프스와 손목 끝 장식", /cuff/),
      rule("bracelet", "팔찌와 손목 밴드", /bracelet|wrist/),
      rule("rings", "반지", /\brings?\b/),
      rule("ribbon", "팔의 리본과 연결 장식"),
    ],
    "jewelry:waist": [
      rule("belt", "벨트와 버클", /belt|buckle/),
      rule("harness", "하네스와 홀스터", /harness|holster/),
      rule("straps", "스트랩과 끈", /strap/),
      rule("traditional", "오비·띠·전통 장식", /obi|sash|norigae/),
      rule("waist", "허리에 더하는 장식"),
    ],
    "scene-decor:celestial": [
      rule("balloons", "하트 풍선", /balloon/),
      rule("stickers", "픽셀·스티커·기호", /pixel|sticker|shape/),
      rule("stars", "별과 별 장식", /star/),
      rule("moon", "달과 천체", /moon|crescent|sphere/),
      rule("hearts", "하트와 하트 장식"),
    ],
    "body-action:sit": [
      rule("ground", "바닥과 풀밭에 앉기", /floor|ground|grass|cross.leg|crossed.leg|seiza|wariza/),
      rule("furniture", "의자·침대·가구에 앉기", /chair|bench|sofa|bed|desk|table/),
      rule("vehicle", "탈것과 동물 위에 앉기", /vehicle|motorcycle|carriage|horse|surfboard|sidesaddle/),
      rule("fantasy", "거대한 물건과 판타지 좌석", /giant|massive|moon|parfait|macaron|mushroom|pumpkin|clock|monitor|building|sign/),
      rule("water", "물과 튜브 위에 앉기", /water|inflatable/),
      rule("knees", "다리를 모으거나 무릎을 접기", /knees|legs|straddl/),
      rule("sit", "앉은 자세의 기본과 인상"),
    ],
    "body-action:legs": [
      rule("crossed", "다리 교차와 모으기", /cross|together/),
      rule("bent", "무릎 굽히기와 접기", /bent|fold|drawn/),
      rule("raised", "한쪽 다리와 무릎 들기", /one leg|one knee|knees up/),
      rule("extended", "다리 뻗기와 원근", /extend|toward|forward/),
      rule("dangling", "다리 늘어뜨리기와 흔들기", /dangl|swing/),
      rule("air", "발이 지면에서 떨어지기", /off ground/),
      rule("legs", "다리의 위치와 보이는 범위"),
    ],
    "body-action:activity": [
      rule("eating", "먹기와 마시기", /eat|drink|suck|blow/),
      rule("play", "게임과 도구 사용", /game|brush|archery/),
      rule("performance", "연주와 노래", /guitar|sing/),
      rule("riding", "타기와 균형 잡기", /riding|skate|swing/),
      rule("acting", "몸짓과 캐릭터 동작"),
    ],
    "guided-construction:hood": [
      rule("rabbit", "토끼 귀 후드", /rabbit|bunny/),
      rule("cat-dog", "고양이·개·늑대·여우 후드", /cat|dog|wolf|fox/),
      rule("bear", "곰·판다·너구리·다람쥐 후드", /bear|panda|raccoon|squirrel/),
      rule("other-animal", "새·물속 생물·공룡 후드", /penguin|duck|frog|shark|dinosaur/),
      rule("shape", "후드 형태와 여밈"),
    ],
    "guided-editorial:ui": [
      rule("window", "컴퓨터 창과 패널", /window|panel/),
      rule("button", "메뉴와 선택 버튼", /menu|button|choice/),
      rule("dialog", "대화창과 텍스트 영역", /dialog|text box|text area/),
      rule("profile", "프로필과 상태 표시", /profile|status|info|data/),
      rule("screen", "전체 화면과 인터페이스", /screen|interface/),
      rule("ui", "화면의 다른 구성 요소"),
    ],
    "scene-decor:sweets": [
      rule("fruit", "과일과 과일 조각", /strawberr|cherr|peach|lemon|carrot/),
      rule("cakes", "케이크·파르페·크림", /cake|parfait|cream|topping|sprinkle|syrup/),
      rule("baking", "마카롱·쿠키·빵", /macaron|cookie|donut|puff/),
      rule("candy", "사탕과 초콜릿", /candy|candies|chocolate|gummy/),
      rule("food", "과자와 떠 있는 음식"),
    ],
    "scene-decor:objects": [
      rule("sticker", "스티커와 작은 그림", /sticker/),
      rule("soft", "인형과 쿠션", /plush|pillow|bear/),
      rule("paper", "봉투·카드·종이 소품", /envelope|card|banner|poster/),
      rule("light", "촛불과 조명 장식", /candle|wax|lights|lantern/),
      rule("personal", "화장품·가방·기기", /cosmetic|eyeshadow|handbag|phone|disc|cable|capsule/),
      rule("fantasy", "유령과 판타지 소품", /spirit|ghost|horn|skull/),
      rule("object", "사물의 모임과 전경 배치"),
    ],
    "hand-prop:keepsake": [
      rule("time", "시계와 시간 소품", /watch|clock|hourglass/),
      rule("medical", "의료와 실험 소품", /medical|iv drip|syringe|bandage/),
      rule("art", "물감과 미술 소품", /paint|brush|color/),
      rule("container", "접시·병·그릇", /plate|porcelain|bottle|jar|bucket|tray/),
      rule("toy", "인형과 장난감", /plush|toy|rabbit|teddy|bear/),
      rule("ornament", "작은 장식품과 개인 소품"),
    ],
    "guided-construction:ribbons": [
      rule("chest", "가슴과 몸판의 리본", /chest|front|bodice/),
      rule("waist", "허리와 뒤쪽의 리본", /waist|back/),
      rule("neck", "목과 칼라의 리본", /collar|neck/),
      rule("shape", "리본의 크기와 형태", /large|oversiz|long|heart|candy|pom|drawstring|knot/),
      rule("amount", "여러 개의 리본과 반복 장식", /many|multiple|lots|excessive|ribbons|bows/),
      rule("ribbon", "기본 리본과 색의 변주"),
    ],
  };

  function refiners(questionId, familyId) {
    const specific = specificRefinements[`${questionId}:${familyId}`];
    if (specific) return [specific, colors];
    if (["setting", "time-weather", "atmosphere"].includes(questionId)) return [places, colors];
    if (["lighting"].includes(questionId)) return [opticalDetails, contextual];
    if (["wardrobe", "bottomwear", "under-layer", "outfit-fit"].includes(questionId)) return [outfitDetails, colors];
    if (["guided-construction", "material", "legwear", "footwear"].includes(questionId)) return [contextual, colors];
    if (["hair-accessory", "jewelry"].includes(questionId)) return [contextual, colors];
    if (["hand-prop", "scene-decor"].includes(questionId)) return [objectDetails, colors];
    if (["body-action", "hand-action", "camera-direction", "camera-height", "framing", "gaze", "expression", "composition-extra", "scene-cast"].includes(questionId)) return [positions, objectDetails];
    if (["palette", "hair-color", "hair-color-treatment"].includes(questionId)) return [colors, opticalDetails];
    if (questionId === "guided-medium") return [mediumDetails, colors];
    return [contextual, colors];
  }

  const roots = new Map();
  const byId = new Map();
  const itemPaths = new Map();
  const questionByItem = new Map();
  const rootItems = new Map();
  const questionOrder = new Map((window.PM_DATA?.stages || []).flatMap((stage) => stage.questions).map((question, index) => [question.id, index]));
  const itemOrder = new Map(guided.items.map((item, index) => [item.id, index]));

  function node(id, label, questionId, parentId, imageKey) {
    const result = { id, label, questionId, parentId, children: [], items: [], allItems: [], imageKey };
    if (byId.has(id)) throw new Error(`Duplicate guided hierarchy node: ${id}`);
    byId.set(id, result);
    return result;
  }
  function partitions(items, rules) {
    const groups = new Map();
    for (const item of items) {
      const category = choose(rules, item.tag.toLowerCase());
      if (!category) throw new Error(`Unclassified guided expression: ${item.id}`);
      if (!groups.has(category.id)) groups.set(category.id, { category, items: [] });
      groups.get(category.id).items.push(item);
    }
    // Rule order is predictable to navigate; expression order always remains
    // original within leaves and each node's complete item list.
    return rules.filter((category) => groups.has(category.id)).map((category) => groups.get(category.id));
  }
  function finishLeaf(branch, items) {
    branch.items = items;
    branch.allItems = items.slice();
    let current = branch;
    const path = [];
    while (current) {
      path.unshift(current.id);
      current = byId.get(current.parentId);
    }
    for (const item of items) {
      if (itemPaths.has(item.id)) throw new Error(`Guided expression appears in two leaves: ${item.id}`);
      itemPaths.set(item.id, path.slice());
    }
  }
  function split(branch, items, candidates, depth) {
    branch.allItems = items.slice();
    if (items.length <= 12 || depth >= 3) { finishLeaf(branch, items); return; }
    // Skip a refinement that would produce a single redundant navigation step.
    let chosen = null;
    let nextCandidates = [];
    for (let index = 0; index < candidates.length; index++) {
      const groups = partitions(items, candidates[index]);
      if (groups.length > 1) { chosen = groups; nextCandidates = candidates.slice(index + 1); break; }
    }
    if (!chosen) { finishLeaf(branch, items); return; }
    for (const { category, items: subset } of chosen) {
      const child = node(`${branch.id}/${category.id}`, category.label, branch.questionId, branch.id, category.imageKey || branch.imageKey);
      branch.children.push(child);
      split(child, subset, nextCandidates, depth + 1);
    }
  }

  for (const item of guided.items) {
    const questionId = questionFor(item);
    if (!hosts[questionId]) throw new Error(`Unknown guided hierarchy question: ${questionId}`);
    if (questionOrder.size && !questionOrder.has(questionId)) throw new Error(`Missing guided hierarchy host question: ${questionId}`);
    questionByItem.set(item.id, questionId);
    if (!rootItems.has(questionId)) rootItems.set(questionId, []);
    rootItems.get(questionId).push(item);
  }
  const questionIds = [...rootItems.keys()].sort((a, b) => (questionOrder.get(a) ?? 0) - (questionOrder.get(b) ?? 0));
  for (const questionId of questionIds) {
    const [label, imageKey] = hosts[questionId];
    const root = node(`hierarchy-${questionId}`, label, questionId, null, imageKey);
    roots.set(questionId, root);
    const items = rootItems.get(questionId);
    root.allItems = items.slice();
    const rules = families[questionId] || appearanceFamilies;
    for (const { category, items: subset } of partitions(items, rules)) {
      const child = node(`${root.id}/${category.id}`, category.label, questionId, root.id, category.imageKey || imageKey);
      root.children.push(child);
      split(child, subset, refiners(questionId, category.id), 1);
    }
  }

  // Invariants execute against the live corpus, including newly added phrases.
  // Classification can add navigation but can never drop or clone vocabulary.
  if (itemPaths.size !== guided.items.length) throw new Error("Guided hierarchy must include every expression exactly once.");
  for (const branch of byId.values()) {
    if (branch.children.length && branch.items.length) throw new Error(`Mixed branch/leaf node: ${branch.id}`);
    if (branch.allItems.some((item, index) => index && itemOrder.get(branch.allItems[index - 1].id) > itemOrder.get(item.id))) throw new Error(`Guided hierarchy source order changed: ${branch.id}`);
  }

  window.PM_GUIDED_HIERARCHY = {
    version: 1, roots, byId, itemPaths, questionByItem, byQuestion: roots,
    getRoot: (questionId) => roots.get(questionId),
    getNode: (nodeId) => byId.get(nodeId) || null,
    getPath: (itemId) => (itemPaths.get(itemId) || []).map((nodeId) => byId.get(nodeId)),
    getItems: (nodeId) => byId.get(nodeId)?.allItems || [],
  };
})();
