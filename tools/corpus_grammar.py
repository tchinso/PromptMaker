"""Semantic layers derived from Image Prompt 1–17, not tag popularity.

Specific relationships precede nouns: 'holding skirt' is an action, 'floating
ribbons' are scenery, and 'lace frame' is graphic design, not camera framing.
Unknown phrases remain available verbatim instead of being dropped.
"""
import re

# id, Korean label, output section, regular expression
FACETS = [
    ("medium", "화풍·매체", "concept", r"pixel art|\d+[- ]?bit|8bit|watercolor|wet-on-wet|pigment|wash(?:es)?\b|diluted paint|paper grain|unpainted|partially colored|feathered edges|faded edges|loose brushwork|low poly|papercraft|3d model|retro 3d|genga|lineart|line art|sketch|linework|color trace|no shading|flat colors?|flat illustration|traditional media|production art|analog photography|old film|dithering|jagged lines|smooth shading"),
    ("proportion", "비례·크기", "character", r"\bchibi\b|super deformed|miniature size|tiny .*character|^giant$"),
    ("layout", "화면·편집 레이아웃", "composition", r"magazine|collage|scrapbook|sticker sheet|character sheet|reference sheet|multiple views|multi-window|three.panel|panel.*(?:layout|view|shot|row)|photo strip|photo booth strip|album cover|game screen|interface|hud layout|insets?|comic panels|graphic design layout|polaroid|window frame|computer windows|dialog|popup|taskbar|loading bar|score bar|slot machine (?:frame|reels)|ms paint|retro computer ui|\bui elements\b"),
    ("graphics", "테두리·텍스트·그래픽", "background", r"border|frame|outline|typograph|text|lettering|headline|barcode|copyright|annotation|postmark|paper tear|torn paper|washi tape|grid|halftone|checkered background|gingham background|plaid background|polka dot background|cursor|icons?|kaomoji|ascii|cut number|circled letter|punch holes|correction marks|highlight marks|screen tone|sticker style|sticker art"),
    ("gaze", "시선·표정", "composition", r"looking|gazing|gaze|eye contact|eyes?|smil|smirk|wink|blush|pout|mouth|lips|teeth|expression|grin|tongue|fluster|embarrass|worried|surpris|sorrow|emotionless|expressionless|blank stare|sweatdrop|^:3$"),
    ("interaction", "인물 간 상호작용", "composition", r"partner|another|other character|towards other|kissing|receiving kiss|embrace|arms around neck|body contact|head.to.head|face.to.face|princess carry|being carried|sitting on lap|holding waist|hold on waist|holding woman's head|intimate|close distance|close interaction|faces? close|overlapping bodies"),
    ("hands", "손·소품 동작", "composition", r"holding|carrying|gripping|wielding|hands?\b|arms?\b|fingers?\b|palm|peace sign|v hand|paw pose|claw pose|rawr pose|praying|saluting|aiming|drawing bow|adjusting|touching|reaching|offering|hugging|bracing|clasped|chin rest"),
    ("pose", "몸·다리·지지점", "composition", r"pose|posture|stance|sitting|seated|standing|kneeling|wariza|seiza|lying|prone|reclining|leaning|crouch|squat|jump|running|sprint|walking|dancing|twirling|flying|riding|skating|eating|drinking|sleeping|playing|singing|bending|bent|legs?|knees?|feet|en pointe|weightless|slouch|mid.?air|mid.stride|curled up|sidesaddle|arching|twisted body|head tilt|tilting head|head resting|head leaning|body angled|angled body|^floating$|floating dynamically|swinging|leaping|sucking|brushing teeth|yawning|blowing bubblegum"),
    ("framing", "거리·크롭", "composition", r"close.?up|portrait|full.body|upper.body|lower.body|cowboy shot|medium shot|mid.shot|waist.up|knee.shot|three.quarter shot|wide shot|face shot|bust shot|chest.up|full shot|headshot|mid.thigh crop|focus on|face focus|focused framing|closer view"),
    ("camera", "카메라·원근·방향", "composition", r"angle|perspective|foreshorten|from above|from below|from behind|from side|top.down|overhead|eye.level|profile|front view|back view|side view|rear view|view from|facing|frontal|composition|framing|centered|centrally|center|symmetrical|positioning|depth|wide.angle"),
    ("motion", "머리·천·움직임", "composition", r"wind|flowing hair|floating hair|blowing hair|hair spread|flying hair|movement|motion blur|trailing dress|swirling.*ribbon"),
    ("floating", "부유물·전경·장면 소품", "background", r"floating|falling|scattered|surrounded|foreground|zero.gravity|anti.gravity|storm|confetti|petal|balloons?|bubbles?|soap bubbles|sweets|candies|macaron|gummy bear|sticker|clock hands|butterfl|jellyfish|goldfish|bird|giant .*moon|giant .*pumpkin|mirror frames"),
    ("light", "광원·반사·광학", "background", r"light|glow|bokeh|flare|sparkle|sparkling|glitter|shadows?|reflec|refraction|caustic|sunbeams?|god rays|bloom|chromatic|color bleed|holograph|iridescen|glitch|soft focus|blurr|screen glow|high contrast|illumination"),
    ("palette", "팔레트·색 관계", "background", r"palette|color scheme|colors?\b|tones?\b|theme$|monochrome|grayscale|pink.blue|purple.black|oversaturated|vibrant$"),
    ("air", "공기·시간·계절", "background", r"atmosphere|ambien|aura|vibe|dreamy|dreamlike|ethereal|mist|fog|smoke|steam|dust|particles|rain|snow|sunny|night|daytime|morning|evening|sunset|sunrise|summer|winter|autumn|spring|season"),
    ("environment", "장소·공간·무대", "background", r"background|backdrop|sky|cloud|city|street|room|interior|garden|forest|beach|seaside|ocean|underwater|water|pool|sea foam|aquarium|cathedral|chapel|church|palace|architecture|temple|cafe|shop|kitchen|diner|school|classroom|arcade|stage|stadium|racetrack|road|park|carousel|merry.go.round|ferris|train|carriage|locomotive|roof|terrace|engawa|house|cabin|indoors?|outdoors?|wall|window|door|gate|fence|floor|ground|table|chair|sofa|bed|pillow|cushion|blanket|curtain|shelf|shelves|desk|cabinet|clockwork|gear|mirror|flower field|field of|roses|foliage|sunflower|bamboo|plush|objects|props|cloth|tanzaku|monitor|machine|vending|clock faces"),
    ("outfit-base", "의상 바탕·아이템", "outfit", r"dress|gown|skirt|shirt|tee\b|top\b|blouse|jacket|coat|hoodie|sweater|cardigan|pants|trousers|shorts|bodysuit|bikini|swimsuit|uniform|suit\b|vest|apron|camisole|kimono|yukata|jinbei|hanbok|jeogori|chima|qipao|cheongsam|kigurumi|tutu|cape|poncho|overalls|sleepwear|loungewear|pajama"),
    ("construction", "겹침·실루엣·재단", "outfit", r"layer|underneath|inner |worn over|oversized|fitted|loose.fit|relaxed fit|silhouette|neckline|collar|sleeves?|bodice|corset|petticoat|off.shoulder|backless|strapless|halterneck|bare shoulders|bare back|asymmetr|pleated|suspenders|clothing cling|open clothes|unzipped|zipped|zipper|buttoned|hood up|hood|hem|waist|piping|closures|lace.up|lacing|cross.lac|cross.string"),
    ("fabric", "소재·표면", "outfit", r"fabric|texture|denim|leather|velvet|silk|satin|chiffon|tulle|knit|spandex|pvc|fur trim|feather trim|fluffy hem|lace|frill|ruffle|mesh|sheer|translucent|transparent|wet clothes|wet$"),
    ("motif", "문양·봉제·디테일", "outfit", r"embroid|applique|stitch|pattern|print|motif|patch|button|sequin|trim|pin\b|pins\b|ribbon|bow\b|bows\b|decoration|ornament"),
    ("legwear", "다리 의상·신발", "outfit", r"stocking|thigh.?high|kneehigh|socks?|tights|pantyhose|fishnet|leg.?warm|legwear|leg wraps|garter|shoes|boots|sneakers|slippers|heels|sandals|loafers|mary janes|footwear|barefoot|pointe shoes|roller skates"),
    ("accessory", "액세서리·착용 소품", "outfit", r"jewel|choker|necklace|earring|bracelet|rings?\b|brooch|pendant|belt|buckle|straps?|harness|gloves?|cuffs?|headband|headdress|hair.?clip|hairpin|headscarf|bandana|hat|cap\b|beret|bonnet|veil|tiara|crown|halo|wings?|ears|tail|horns?|goggles|glasses|eyewear|headphones|headset|mask|rosary|bag|purse|backpack|parasol|umbrella|chain|charm|tassel|kanzashi|norigae|obi|sash|necktie|tie\b|talisman|holster|eyepatch|bandage|bandaid"),
    ("prop", "독립 소품", "composition", r"microphone|guitar|gun|scythe|bat\b|controller|gamepad|console|tamagotchi|whisk|fork|spoon|bottle|phone|camera|book|bouquet|lightstick|wand|helmet|sign|tray|lollipop|popsicle|ice cream|skateboard|racket|paintbrush|scroll|envelope|letter|hourglass|fruit|apple|peach|dango"),
    ("appearance", "외형·캐릭터성", "character", r"hair|skin|makeup|eyeshadow|nails|nail polish|fang|mermaid|magical girl|witch girl|^solo|^1girl|^2people|^2girls"),
    ("aesthetic", "테마·스타일 혼합", "concept", r"aesthetic|style|fashion|lolita|gothic|kitsch|decora|y2k|vaporwave|cyberpunk|steampunk|jirai|idol|angelcore|fantasy|subculture|retro|punk|pop art|surreal|cute|sweet|romantic|elegant|peaceful|energetic|moody|maximalist|minimal|detailed"),
]


# Morphology is explicit: allowing arbitrary suffixes after every alternative
# made `wind` match `window`, `text` match `texture`, and `leg` match `leggings`.
# Keep these additions separate so the source-derived vocabulary remains legible.
FACET_ADDITIONS = {
    "medium": r"pixelated|jagged edges|soft line|rough lines|animation paper|expressive painting|pop art shading",
    "layout": r"button panel|profile card|support card|choice buttons|stamina bar|header bar|search bar|system alerts|multiple small photos|clean layout|perfume advertisement|dialogue box|floating menu buttons|warning window",
    "graphics": r"typography|bordered|outlines?|borders?|frames?|icons?|annotations?|graffiti|cover lines|doodle|heart \(symbol\)|heart shape|star symbol|star shapes|cross marks|random characters for titles|random digits for data|spiderweb corner|paint splatters?|paint mess|paint splashes|geometric shapes|simple shapes|triangles|starburst|paper clip|tape|lined notebook paper|baroque filigree|ornate engravings",
    "gaze": r"smil(?:e|es|ing)|smirk(?:s|ing)?|wink(?:s|ing)?|blush(?:es|ing)?|pout(?:s|ing)?|grin(?:s|ning)?|flustered|embarrassed|surprised|sorrowful|staring|glance|frown|happy|sad|serious|melancholic|hesitant|distressed face|sweat|seductive|lifeless",
    "interaction": r"intimacy|natural interaction|hugging from behind|interacting poses",
    "hands": r"pointing|held|presenting gift|lifting chin|bringing fruit|fork near lips|gun to head|hiding lower face|phone to ear|talking on phone|speaking into megaphone|making a heart|blowing bubbles",
    "pose": r"crouching|squatting|jumping|sprinting|slouching|leaping|lean forward|tilted head|head tilted|head slightly bowed|shrugging shoulders|straddling|lifting higher|ballet leap|hitting tennis ball|mimic bunny gesture|upper body slightly arched|on back|slight tilt",
    "framing": r"upper torso view|buttocks view|selfie",
    "camera": r"foreshortening|foreshortened|over (?:the )?shoulder|square (?:aspect ratio|image)|slightly angled",
    "motion": r"windblown|wind-blown|ponytail flow|flowing brown hair|whipping .*tail",
    "floating": r"butterflies|macarons|petals|stars?|hearts?|cherries|strawberries|cookies|dessert toppings|syrup|whipped cream|sprinkles|parfait|cake|cakes|cream puffs|donut|shaved ice|chocolate|chocolates|candy cane|carrot|fish|leaves|flowers?|petals?|crystals?|diamonds|pearls|gemstones|rubies|sapphires|seashells|starfish|gift boxes|ornaments|decorations|confetti|fireworks|lanterns|beads|marionette strings|moon|armillary sphere|spheres?|garland|bunting|banner|banners|contrail|cherry blossoms|gilded skulls|white floral elements|tulip|spilled red wine|dripping wax|bubblegum",
    "light": r"lights|lighting|glowing|sparkles|reflections?|reflected|reflective|refractions?|caustics|holographic|holograms|iridescent|blurred|blurry|illumina(?:ted|tion)|sunlight|moonlight|moonlit|daylight|backlight(?:ing)?|spotlight|candlelight|sun glare|lit|dimly lit|neon|lightning|luminous|lightbulbs|streetlight|sparkler|bright sun|magic circles",
    "palette": r"^(?:pastel )?rainbow(?: arcs)?$|^colorful$|^pastel$|^soft gradient$|^vivid gradient$|^vivid pastel$|black and white contrast|white and pastel blue|blue effect|beige|^pink$",
    "air": r"atmospheric|ambience|ambient|misty|foggy|rainy|raining|raindrops|snowflakes|stardust|day|dusk|dust motes",
    "environment": r"cityscape|skyscrapers|bedroom|bathroom|playroom|sunroom|backyard|alley|metropolis|castle|town|storefront|closet|hospital|medical lab|medical supplies|tennis court|court|buildings?|bushes|trees?|plants?|ivy|ruins|arches|archway|statues|pillars|pavilion|staircase|stairs|stone tiles|racks|lockers|roof(?:top)?|reading nook|horizon|starfield|galaxy|milky way|outer space|^space$|white space|soft void|environment|claw crane|fish tank|flower vase|tablecloth|table runner|jewelry box|teddy bear|stuffed toys?|plushies|plushie|dollhouse|rug|fireplace|venue|equipment|crowd|floats|car|sports car|steam locomotive|telephone cord|wires|power lines|utility pole|glass panel|stained glass|crosswalk|catwalk|dirt track|field|bedding|skyline|object set|menu board",
    "outfit-base": r"clothes|clothing|outfit|attire|costume|minidress|miniskirt|sundress|ballgown|sweatshirt|blazer|turtleneck|windbreaker|jeans|slacks|bra|panties|shawl|tailcoat|jersey|capelet",
    "construction": r"layered|layers|sleeveless|lapel|modest coverage|cleavage|midriff|bare arms|visible stomach|asymmetrical design",
    "fabric": r"textures?|frills|frilled|frilly|ruffles|ruffled|knitted|trimmings|see-through|glossy paper|visible paper texture",
    "motif": r"embroidery|embroidered|appliques?|stitching|patterns|prints|motifs|patches|patchwork|buttons|trims|ribbons|bows|decorations|ornaments|stripes|striped|anchor emblem|heart name badge|chinese knots|pom[- ]poms?|drawstrings|spikes|caramel drizzle details|cross details|decorative details|no black tips",
    "legwear": r"leggings|kneehighs|stockings|thighhighs|thigh-highs|legwear|leg straps|knee pads|bare foot|glass slipper|pumps|sneaker soles",
    "accessory": r"accessories|accessory|jewelry|earrings|bracelets|buckles|headpiece|headwear|beanie|muffler|neckerchief|kerchief|pocket square|boutonniere|piercings?|sun visor|wristbands?|wristwatch|handcuffs|utility pouches|hairbows?|hair ornaments?|hair ribbons?|sunglasses|hair accessories|hair accessory|eye mask|eyepatch|towel on head|shark fin|keychain",
    "prop": r"handgun|weapon|beverage|smartphone|telephone|telephone receiver|rotary telephone|whistle|joystick|electric fan|blood pack|iv drip|iv standard|pills|syringes|snack bags|wine glasses|porcelain plates|paint buckets|pocket watch",
    "appearance": r"1boy|2boys|male|female|multiple individuals|face details|eyes make up",
    "aesthetic": r"streetwear|sportswear|formal wear|formal|techwear|yume kawaii|cosplay|chi-pao fusion|fashion|sticker aesthetics|peach-themed fashion|ethereal fashion|cute rabbit theme|magical girl theme|1990s|vintage|valentine|tanabata festival|surrealism|decadent|epic feel|chaotic|cluttered|arrangement|comfortable",
}
FACETS = [(key, label, section, pattern + "|" + FACET_ADDITIONS.get(key, r"(?!)"))
          for key, label, section, pattern in FACETS]
PATTERNS = {key: re.compile(r"(?<!\w)(?:" + pattern + r")(?:s|es)?(?!\w)", re.I)
            for key, _, _, pattern in FACETS}
SECTIONS = {key: section for key, _, section, _ in FACETS}


def classify(tag, category, label):
    # Garment nouns carrying their own material/trim stay intact as one phrase.
    tag = tag.lower()
    if tag in {":3", ";)"}:
        return "gaze", "composition"
    strong_action = re.search(r"\b(?:holding|carrying|gripping|wielding|adjusting|touching|hugging|sitting|lying|standing|leaning|riding)\b", tag)
    if not strong_action and re.search(r"\b(?:top hat|floating halo)\b", tag):
        return "accessory", "outfit"
    if not strong_action and re.search(r"\b(?:leg warmers?|leg wraps|arm warmers?|arm ruffles)\b", tag):
        return ("legwear" if tag.startswith("leg") or "leg " in tag else "construction"), "outfit"
    # These expressions contain ordinary body/wardrobe nouns, but refer to
    # graphics, physical scenery or garments. Resolve the relationship first.
    overrides = [
        ("layout", r"portrait close-up panel|chibi (?:character inset|icons)|profile card|support card|ms paint window|warning window|bottom large dialogue box"),
        ("light", r"sunlight .*window|window light|central powerful glow|lightning|rainbow refraction|heart sparkles|star sparkles|star light projection|glowing star lights"),
        ("environment", r"train window frame|wooden window seat|chainlink fence|morning glory flowers|steam locomotive|stained glass windows?|^(?:large |open |rainy |moonlit )?window(?: in background| view)?$|jewelry box$|painted wings on wall|stuffed bear|tablecloth|table runner|reading nook|palm tree|flower (?:bed|field|vase)|fish tank|lush bed of flowers|light(?: blue)? background|light-colored roses"),
        ("graphics", r"hand-drawn|heart speech bubbles|^speech bubbles$|graphic background|(?<!lineart )outline|paper texture|snowflake marks|star \(pattern\)"),
        ("accessory", r"(?:hair|head|neck|arm) (?:ornaments?|accessor(?:y|ies)|bows?|ribbons?|chains?)|hairbows?|ribbon twintails|eye mask|eyepatch|round eyewear|ribbon (?:ankle|wrist) bindings|gift bow on head|ribbon tied on neck|pants chain|^exo-frame$"),
        ("accessory", r"roses around neck|pearl string"),
        ("motif", r"sticker patches"),
        ("fabric", r"soft plush texture|spandex fabric texture|intricate fabric textures"),
        ("appearance", r"^(?!.*floating).*\b(?:makeup|eyeshadow|face stickers?|face sticker|sticker on cheek|whipped cream on cheek)"),
        ("prop", r"phone case|crystal wine glasses|winged heart wand|waist pocket watch"),
        ("motion", r"flying hair|flying ribbons|swirling sheer ribbons"),
        ("floating", r"clock hands|flying (?:birds|confetti|flowers|petals|smartphone|cupids)|another peach in foreground|falling heart playing cards|blooming flowers|multi-layered strawberry cake|^ornate golden mirror frames$"),
        ("legwear", r"(?:legwear|leggings|knee[- ]high|knee socks|kneehighs|knee boots|leg garter|leg straps|knee pads|thigh-high stockings on both legs|bandaid on knee)"),
        ("framing", r"mid-shot to knee-shot|focus on hands|hand close-up"),
        ("camera", r"feet-first low-angle|foreshortened legs"),
        ("pose", r"shoulders angled forward"),
        ("construction", r"bare arms|long draping train"),
        ("gaze", r"looking through frame"),
        ("aesthetic", r"cute rabbit theme|magical girl theme|ethereal fashion|peach-themed fashion|sticker aesthetics|street fashion|cyber-streetwear"),
        ("palette", r"macaron color palette|light blue theme|neon color scheme|neon pink and blue palette"),
    ]
    # Actions must still override worn-item nouns ("holding hair ribbon").
    if not strong_action:
        for facet, pattern in overrides:
            if re.search(r"\b(?:" + pattern + r")\b", tag):
                return facet, SECTIONS[facet]
    priorities = ["medium", "layout", "proportion", "graphics", "interaction", "hands",
                  "pose", "framing", "camera", "motion"]
    wardrobe = ["legwear", "outfit-base", "accessory", "construction", "fabric", "motif", "appearance"]
    scenery = ["floating", "light", "palette", "air", "environment"]
    # A scene's scattered flowers/ribbons are not automatically worn accessories.
    background_only = "배경" in label and "의상" not in label and "구도" not in label
    # Floating objects outrank garment nouns, while butterfly bodices and
    # balloon sleeves stay worn. Motion words need an actual scene relationship.
    scene_relation = re.search(r"\b(?:floating|scattered|surrounded|falling|foreground|zero.gravity|anti.gravity)\b", tag)
    if scene_relation:
        priorities.append("floating")
        scenery.remove("floating")
    priorities.append("gaze")
    worn_anchor = any(PATTERNS[key].search(tag) for key in
                      ["outfit-base", "legwear", "accessory", "construction"])
    if background_only and not worn_anchor and not scene_relation and re.search(r"\b(?:patterns?|motifs?|prints?)\b", tag):
        # Printed scene motifs are graphic decoration, even when the motif
        # noun also names an independently floating object (heart/star/fruit).
        priorities.insert(priorities.index("floating") if "floating" in priorities else len(priorities), "motif")
        wardrobe.remove("motif")
    priorities += (["prop"] + scenery + wardrobe if background_only and not worn_anchor
                   else wardrobe + ["prop"] + scenery)
    priorities += ["aesthetic"]
    ordered = sorted(FACETS, key=lambda row: priorities.index(row[0]))
    for facet, _, section, pattern in ordered:
        if PATTERNS[facet].search(tag):
            if (facet == "motif" and "배경" in label and "의상" not in label
                    and not re.search(r"\b(?:embroid\w*|applique\w*|stitch\w*|trim\w*|buttons?)\b", tag)):
                return "graphics", "background"
            return facet, section
    section = {"action": "composition", "expression": "composition", "accessory": "outfit",
               "other": "concept"}.get(category, category)
    if section == "concept" and "배경" in label and "의상" not in label:
        section = "background"
    if section == "concept" and "의상" in label and "구도" not in label:
        section = "outfit"
    return f"free-{section}", section


def annotate(library):
    definitions = [{"id": key, "label": label, "section": section} for key, label, section, _ in FACETS]
    definitions.extend({"id": f"free-{section}", "label": f"{label} · 자유 서술", "section": section}
                       for section, label in [("background", "배경"), ("composition", "구도"),
                                              ("outfit", "의상"), ("character", "캐릭터"), ("concept", "컨셉")])
    counts = {}
    for prompt in library["sourcePrompts"].values():
        for source in prompt["sections"]:
            for item in source["tags"]:
                facet, section = classify(item["tag"], item["category"], source["label"])
                item.update(facet=facet, section=section)
                counts.setdefault(facet, set()).add(item["tag"])
    library["grammar"] = {"facets": definitions, "coverage": {key: len(tags) for key, tags in counts.items()}}
    library["version"] = 2
    return library


def write_report(library, path):
    source = library["source"]
    lines = ["# Image Prompt 1–17 재분류", "",
             f"{source['pages']}개 HTML · {source['prompts']}개 원본 프롬프트. 원본의 섹션·변형·강조값을 보존하고, 표현마다 의미 레이어를 부여합니다.", "",
             f"원본 표현 {library['stats']['sourceOccurrences']:,}개를 보존합니다. 일반 태그 사전은 남성 관련 표현 {library['stats']['excludedMaleCharacterTags']}개를 제외한 {library['stats']['occurrences']:,}회 출현 · 고유 표현 {library['stats']['items']:,}개이며, 해당 표현도 원본 변형에서는 선택할 수 있습니다.", "",
             "## 원본에서 확인한 구성 원칙", "",
             "- 배경은 장소에 국한되지 않습니다. 화면 레이아웃, UI, 테두리, 타이포그래피, 부유 소품, 광학 효과를 별도로 조합합니다.",
             "- 의상은 하나의 계열로 잠그지 않습니다. 바탕 의복, 레이어, 재단, 소재, 문양, 착용 소품을 서로 다른 원본에서도 가져옵니다.",
             "- 몸·다리·지지점, 손·소품 행동, 시선, 카메라 거리, 방향과 원근을 분리합니다. 복합 서술은 문장을 쪼개지 않고 그대로 보존합니다.",
             "- 색상·성별·동물·캐릭터 A/B 등 원본 변형은 별도 선택 단위입니다. 함께 선택하는 경우에만 합칩니다.",
             "- 일반적인 품질 태그를 자동 추가하지 않습니다. 원본 가중치, 텍스트 인용문, 다중 뷰와 편집 레이아웃을 보존합니다.",
             "- 원본 섹션 전문(rawText)과 정규화 전 표현(rawTag)을 함께 보관합니다. 색상 자리표시자와 원본 철자도 이 필드에서 확인할 수 있습니다.",
             "- 원본 표현은 일반 단계의 개별 선택으로 조합하며, 강조값과 명시적으로 고른 표현은 밀도에 관계없이 보존합니다. 이전 원본 조합 단계의 저장본은 당시 밀도로 출력되던 표현을 일반 선택·직접 입력으로 변환합니다.",
             "- 원본 검수를 바탕으로 작성한 분류 규칙은 tools/corpus_grammar.py에 있습니다. 같은 입력에서 같은 결과를 재생성하며, 애매한 표현도 자유 서술 레이어에 남깁니다.", "",
             "## 의미 레이어", "", "| 레이어 | 고유 표현 수 | 출력 영역 |", "|---|---:|---|"]
    for facet in library["grammar"]["facets"]:
        lines.append(f"| {facet['label']} | {library['grammar']['coverage'].get(facet['id'], 0)} | {facet['section']} |")
    lines += ["", "## 전체 원본 목록", "", "| ID | 원본 | 섹션·변형 | 표현 수 |", "|---|---|---:|---:|"]
    for key, prompt in library["sourcePrompts"].items():
        lines.append(f"| {key} | {prompt['title']} | {len(prompt['sections'])} | {sum(len(s['tags']) for s in prompt['sections'])} |")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
