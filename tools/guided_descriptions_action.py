"""Build Korean, image-specific descriptions for the props and camera vocabulary.

Uses the existing JavaScript corpus as its sole input. Generated descriptions
never replace prompt text; they explain spatial relationships and visible effects.
"""
from __future__ import annotations

import json
from pathlib import Path
import re
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
EXACT = {}
WORDS = {}
WORD_DATA = """
heart=하트|hair=머리카락|ribbon=리본|hat=모자|choker=초커|accessory=장식|belt=벨트|black=검은|white=흰|chain=체인|wing=날개|necklace=목걸이|lace=레이스|pink=분홍색|sticker=스티커|tail=꼬리|glove=장갑|large=큰|glowing=빛나는|bow=리본 매듭|balloon=풍선|small=작은|flower=꽃|red=붉은|bag=가방|ear=귀|silver=은색|ornament=장식|star=별|cross=십자가|tie=타이|petal=꽃잎|multiple=여러 개의|head=머리|colorful=알록달록한|cuff=커프스|foreground=화면 앞쪽|blue=파란색|veil=베일|fluffy=보송한|layered=여러 겹의|shaped=모양의|strawberry=딸기|headband=머리띠|strap=끈|pearl=진주|angel=천사|sweet=과자|harness=하네스|ring=반지|frilled=프릴이 달린|surrounded=둘러싸인|flying=날아가는|headdress=헤드드레스|bat=박쥐|charm=참 장식|crystal=수정|cat=고양이|headphones=헤드폰|waist=허리|pendant=펜던트|bubble=거품|wrist=손목|necktie=넥타이|cherry=체리|demon=악마|beret=베레모|earring=귀걸이|butterfly=나비|neck=목|long=긴|cake=케이크|multi=다채로운|confetti=색종이 조각|metal=금속|leather=가죽|bracelet=팔찌|cute=귀여운|water=물|jewelry=주얼리|giant=거대한|object=물체|guitar=기타|simple=단순한|crescent=초승달|moon=달|animal=동물|floral=꽃무늬|leaf=나뭇잎|obi=오비|candy=사탕|mini=작은|brooch=브로치|delicate=섬세한|witch=마녀|rose=장미|goggles=고글|cream=크림|bunny=토끼|sign=표지판|background=배경|firework=불꽃놀이|pastel=파스텔색|halo=후광|shoulder=어깨|microphone=마이크|particle=입자|buckle=버클|utility=수납용|messenger=메신저|goldfish=금붕어|fish=물고기|numerous=많은|clip=핀|beaded=구슬을 꿴|magical=마법의|mask=마스크|body=몸|jellyfish=해파리|horn=뿔|yellow=노란색|straw=밀짚|wand=지팡이|glass=유리|devil=악마|slice=조각|lantern=등불|telephone=전화기|clear=투명한|tiara=작은 왕관|dark=어두운|thigh=허벅지|parfait=파르페|ice=얼음|macaron=마카롱|floppy=늘어진|gift=선물|sky=하늘|lollipop=막대사탕|headset=헤드셋|thin=가는|plushie=봉제인형|pouch=파우치|pocket=주머니|crown=화관|cap=캡 모자|dust=먼지|horse=말|sphere=구체|swimming=헤엄치는|tiny=아주 작은|paint=물감|wristband=손목밴드|sunglasses=선글라스|ornate=화려하게 장식된|gilded=금박을 입힌|wine=와인|glasses=안경|antique=앤티크|many=많은|banner=배너|loose=느슨한|iv=수액|fake=인조|electric=전기|wedding=웨딩|tamagotchi=다마고치|blurry=흐린|cable=케이블|light=빛|baseball=야구|smartphone=스마트폰|vine=덩굴|bird=새|bonnet=보닛|detail=디테일|eye=눈|headwear=머리 장식|plush=봉제인형|fingerless=손가락이 드러나는|whipped=휘핑한|syrup=시럽|dessert=디저트|topping=토핑|cookie=쿠키|inner=안쪽의|snow=눈송이|corset=코르셋|rosary=묵주|gothic=고딕풍|parasol=양산|bubblegum=풍선껌|anniversary=기념일|decoration=장식|exploding=터지는|night=밤|full=가득한|headpiece=머리 장식|feathered=깃털로 된|sparkle=반짝임|dynamic=역동적인|double=두 겹의|idol=아이돌|backless=등이 열린|bodice=몸판|abstract=추상적인|poster=포스터|various=다양한|sized=크기의|teddy=테디|bear=곰|watch=시계|overflowing=넘쳐 흐르는|gemstone=보석|diamond=다이아몬드|ruby=루비|sapphire=사파이어|intricate=정교한|bone=뼈|like=같은|filigree=가느다란 세공|metallic=금속빛|integrated=하나로 붙은|collar=칼라|talisman=부적|spray=스프레이|can=통|paintbrush=붓|holographic=홀로그램의|acrylic=아크릴|panel=패널|bucket=양동이|pouring=쏟아지는|party=파티|porcelain=도자기|plate=접시|spilled=쏟아진|silverware=은식기|dripping=떨어지는|wax=촛농|skull=해골|snack=간식|flag=깃발|phone=전화기|case=케이스|pop=팝|socket=그립톡|holster=홀스터|drip=수액|blood=혈액|pack=팩|pill=알약|race=레이싱|spiked=뾰족한 스터드가 달린|abundant=풍성한|hourglass=모래시계|sand=모래|bunting=삼각 깃발 장식|tennis=테니스|ball=공|blossom=꽃|crossbody=몸을 가로지르는|studded=스터드가 달린|respirator=방독|exo=외부|frame=프레임|massive=아주 큰|bouquet=꽃다발|surface=표면|cracked=금이 간|band=밴드|aid=밴드|wrapped=감긴|loosened=느슨하게 푼|boutonniere=부토니에|hea=머리|standard=거치대|syringe=주사기|round=둥근|eyewear=안경|wearing=착용한|spade=스페이드|box=상자|sunflower=해바라기|tall=높은|pointy=뾰족한|sleep=수면용|winged=날개가 달린|shared=함께 쓴|draped=드리워진|both=양쪽|another=또 다른|colored=색이 있는|shape=모양|padlock=자물쇠|polka=물방울|dot=무늬|jar=유리병|cupid=큐피드|zero=무중력|gravity=중력|item=물건|anti=반대|cosmetic=화장품|handbag=핸드백|eyeshadow=아이섀도|palette=팔레트|storm=소용돌이|silk=실크|square=사각|iridescent=무지갯빛|bell=방울|norigae=노리개|covering=덮는|store=가게|gaming=게임용|contrail=비행운|street=거리|visor=챙 모자|whistle=호루라기|gorgeous=화려한|blooming=활짝 핀|beverage=음료|fruit=과일|vibrant=선명한|bottle=병|school=학교|techwear=테크웨어|lemon=레몬|element=요소|pants=바지|earflap=귀덮개|beige=베이지색|muffler=목도리|digital=디지털|shaved=갈아낸|hairpin=머리핀|donut=도넛|paper=종이|spirit=정령|weapon=무기|display=진열대|checkered=체크무늬|book=책|beanie=비니|kitty=고양이|o=고리형|handcuff=수갑|bandage=붕대|wristwatch=손목시계|elegant=우아한|chinese=중국풍|mixed=섞인|jewel=보석|stand=거치대|amp=앰프|rotary=다이얼식|cord=코드선|receiver=수화기|tulip=튤립|handgun=권총|shell=조개|twinkling=반짝이는|oversized=커다란|big=큰|gold=금색|candle=촛불|magic=마법|open=열린|bridal=신부용|chocolate=초콜릿|fast=패스트|food=음식|droplet=물방울|letter=글자|envelope=봉투|feather=깃털|arrow=화살|kerchief=두건|hairbow=머리 리본|ita=이타|garland=가랜드|playing=놀이용|card=카드|fairy=요정|blurred=흐려진|japanese=일본식|stop=정지|boater=보터|armillary=천구의|detached=분리된|brimmed=챙이 있는|neckerchief=목 스카프|clock=시계|hand=손|curled=말린|huge=아주 큰|bushy=풍성한|shark=상어|fin=지느러미|wolf=늑대|raccoon=너구리|fox=여우|headscarf=머리 스카프|bandana=반다나|ramune=라무네|fan=선풍기|marionette=마리오네트|string=끈|towel=수건|seashell=조개껍데기|starfish=불가사리|pumpkin=호박|autumn=가을|twintail=트윈테일|golden=금빛|mirror=거울|shard=파편|anchor=닻|sprinkle=작은 설탕 장식|made=만든|ground=바닥|capsule=캡슐|one=한쪽|medical=의료용|key=열쇠|ghost=유령|abuse=많이 단|cd=시디|disc=원반|gamepad=게임패드|joystick=조이스틱|pennant=삼각 깃발|gummy=젤리|cane=막대|purple=보라색|shooting=흘러가는|kanzashi=비녀|keychain=열쇠고리|cinnamoroll=시나모롤|carrot=당근|puff=슈|paw=동물 앞발
sofa=소파|bench=벤치|chair=의자|bed=침대|table=탁자|desk=책상|vehicle=탈것|motorcycle=오토바이|surfboard=서핑보드|skateboard=스케이트보드|skate=스케이트|carriage=마차|mushroom=버섯|monitor=모니터|vintage=빈티지|jewelry=보석|building=건물|grass=풀밭|floor=바닥|window=창문|rail=난간|railing=난간|circular=원형|platform=발판|inflatable=공기를 넣은|swim=수영|spoon=숟가락|fork=포크|acoustic=어쿠스틱|paintbrush=붓|roller=롤러|color=색|anemone=아네모네|helmet=헬멧|racing=레이싱|megaphone=확성기|frappuccino=프라푸치노|scythe=낫|popsicle=아이스바|serving=서빙용|tray=쟁반|burger=햄버거|drink=음료|menu=메뉴판|rabbit=토끼|toothbrush=칫솔|controller=조종기|game=게임|whisk=거품기|love=사랑|perfume=향수|gun=총|pillow=베개|skirt=치마|scroll=두루마리|parchment=양피지|courier=배달용|console=게임기|handheld=휴대용|flip=접이식|dango=당고|hairdryer=드라이어|dryer=드라이어|pear=배|feet=발|ear=귀|lip=입술|face=얼굴|cheek=볼|chin=턱|arm=팔|foot=발|hip=골반|chest=가슴|hood=후드|lightstick=응원봉|broom=빗자루|stair=계단|dango=당고|sugar=설탕|watergun=물총|dressing=옷차림|male=남성|woman=여성|medium=중간 크기의|sized=크기의|spilling=쏟아지는|glossy=매끈한 광택의|giant=거대한|small=작은|whipping=크게 휘두르는|forward=앞쪽|behind=뒤쪽|near=가까운|raised=올린|resting=받친|curled=굽힌|spread=펼친|palm=손바닥|splayed=벌린
"""
for row in WORD_DATA.strip().splitlines():
    for entry in row.split("|"):
        key, value = entry.strip().split("=", 1)
        WORDS[key] = value

PHRASES = {
    "heart shaped": "하트 모양", "star shaped": "별 모양", "heart shape": "하트 모양",
    "medium sized": "중간 크기의", "various sized": "크기가 다양한",
    "hair ornament": "머리 장식", "hair ornaments": "머리 장식", "hair clips": "머리핀", "hair clip": "머리핀",
    "hair bow": "머리 리본", "hair bows": "머리 리본", "hair ribbons": "머리 리본", "hair ribbon": "머리 리본",
    "ear piercings": "귀 피어싱", "piercings": "피어싱", "polka dot": "물방울무늬", "multi colored": "여러 색의",
    "wrist cuffs": "손목 커프스", "neck ribbon": "목 리본", "ribbon tie": "리본 타이", "bow tie": "나비넥타이",
    "cross body": "몸을 가로지르는", "heart shaped sunglasses on hea": "머리 위 하트 선글라스",
    "blood pack": "혈액 팩", "iv drip": "수액 팩", "iv standard": "수액 거치대", "ice cream": "아이스크림",
    "pop socket": "그립톡", "paintbrush pouches": "붓 수납 파우치", "teddy bear": "곰 인형", "teddy bears": "곰 인형",
    "school bag": "학교 가방", "eye mask": "안대", "sleep mask": "수면 안대", "o ring": "원형 고리",
    "cherry blossom": "벚꽃", "cherry blossoms": "벚꽃", "cherry blossom petals": "벚꽃잎",
    "fast food": "패스트푸드", "fairy lights": "꼬마전구", "string lights": "줄 전구", "clock hands": "시곗바늘",
    "cream puffs": "슈크림 과자", "candy cane": "지팡이 사탕", "gummy bear": "곰 모양 젤리", "armillary sphere": "천구의",
    "wine glasses": "와인잔", "crystal wine glasses": "수정 와인잔", "japanese stop sign": "일본식 정지 표지판",
    "baseball bat": "야구방망이", "electric guitar": "일렉트릭 기타", "acoustic guitar": "어쿠스틱 기타",
    "game controller": "게임 컨트롤러", "handheld game console": "휴대용 게임기", "game console": "게임기",
    "flip phone": "폴더폰", "digital camera": "디지털카메라", "tennis racket": "테니스 라켓",
    "bubble wand": "비눗방울 막대", "water gun": "물총", "letter": "편지", "love letter": "러브레터",
    "heart padlock": "하트 자물쇠", "black roses": "검은 장미", "horse ears": "말 귀", "bunny ears": "토끼 귀",
    "cat ears": "고양이 귀", "animal ears": "동물 귀", "bat wings": "박쥐 날개", "demon horns": "악마 뿔",
    "angel wings": "천사 날개", "devil tail": "악마 꼬리", "fish tail": "물고기 꼬리", "cat tail": "고양이 꼬리",
    "fox tail": "여우 꼬리", "wolf tail": "늑대 꼬리", "shark fin": "상어 지느러미",
    "shaved ice": "빙수", "fake sweets": "디저트 모형", "plastic balls": "플라스틱 공",
    "pearl string": "진주 줄", "white birds": "흰 새", "shooting star": "유성", "spray cans": "스프레이 통",
    "sun visor": "선바이저", "top hat": "탑 햇", "small backpack": "작은 배낭", "hair accessory": "머리 장식",
    "gift boxes": "선물 상자", "gift box": "선물 상자", "eye mask on head": "이마에 올린 안대",
    "goldfish inside spheres": "구체 안의 금붕어", "goldfish": "금붕어", "bubblegum": "풍선껌",
    "multi layered": "여러 층의", "multi layer": "여러 층의", "wedding ring": "결혼반지",
    "waist pocket watch": "허리에 단 회중시계", "jewelry box": "보석함", "pocket watch": "회중시계",
    "heart earrings": "하트 귀걸이", "charm bracelet": "참 장식 팔찌", "guitar amp": "기타 앰프",
    "guitar strap": "기타 스트랩", "camera strap": "카메라 스트랩", "phone case": "휴대전화 케이스",
    "chinese lanterns": "중국식 등롱", "red paper lanterns": "붉은 종이 등롱", "tied hem": "묶은 옷단",
    "straw boater hat": "챙이 평평한 밀짚모자", "wide brimmed": "챙이 넓은", "fingerless gloves": "손가락이 드러나는 장갑",
    "loose tie": "느슨한 넥타이", "loosened tie": "느슨하게 푼 넥타이", "norigae": "노리개", "obi sash": "오비 띠",
    "long floppy": "길게 늘어진", "feathered wings": "깃털 날개", "straw hat": "밀짚모자", "cat ear": "고양이 귀",
    "light particles": "빛 입자", "dust particles": "먼지 입자", "water spheres": "물 구체",
    "band aids": "반창고", "pom pom": "폼폼", "pom poms": "폼폼", "cat paw": "고양이 앞발",
    "playing cards": "트럼프 카드", "cream puffs": "슈크림", "ice cream cone": "아이스크림 콘",
    "spade tail": "스페이드 끝 꼬리", "forehead talisman": "이마 부적", "skull necklace": "해골 목걸이",
}
UNKNOWN = set()
WORDS.update({
    "ankle": "발목", "apple": "사과", "backpack": "배낭", "beads": "구슬", "bindings": "묶는 끈",
    "camera": "카메라", "cookies": "쿠키", "dangling": "늘어뜨린", "eyepatch": "안대", "falling": "떨어지는",
    "floating": "떠 있는", "green": "초록색", "maid": "메이드", "neon": "네온", "peach": "복숭아",
    "pixel": "픽셀", "plastic": "플라스틱", "plushies": "봉제인형", "ruffled": "러플이 달린",
    "sailor": "세일러", "sash": "허리띠", "scattered": "흩어진", "single": "한쪽의", "sleeves": "소매",
    "soap": "비누", "striped": "줄무늬", "sun": "햇빛을 가리는", "tassels": "술 장식", "tied": "묶인",
    "translucent": "반투명한", "umbrella": "우산", "wide": "넓은",
})


def particle(text, pair="을를"):
    last = next((c for c in reversed(text) if "가" <= c <= "힣"), "가")
    return pair[0] if (ord(last) - 0xAC00) % 28 else pair[1]


def translate(text):
    """Translate compact noun phrases without reversing English prepositions."""
    text = text.lower().replace("-", " ").strip()
    if text in PHRASES:
        return PHRASES[text]
    for separator in [" with ", " around ", " on ", " in ", " of "]:
        if separator in text:
            first, second = text.split(separator, 1)
            a, b = translate(first), translate(second)
            if separator == " with ": return f"{b}{particle(b)} 더한 {a}"
            if separator == " around ": return f"{b} 주위의 {a}"
            if separator == " on ": return f"{b} 위의 {a}"
            if separator == " in ": return f"{b} 안의 {a}"
            return f"{b} {a}"
    if " and " in text:
        return "과 ".join(translate(part) for part in text.split(" and "))
    placeholders = {}
    for index, key in enumerate(sorted(PHRASES, key=len, reverse=True)):
        marker = f"ZZ{index}ZZ"
        if re.search(rf"(?<![a-z]){re.escape(key)}(?![a-z])", text):
            text = re.sub(rf"(?<![a-z]){re.escape(key)}(?![a-z])", marker, text)
            placeholders[marker] = PHRASES[key]
    words = []
    for token in text.split():
        if token in placeholders:
            words.append(placeholders[token]); continue
        token = token.strip(".,:'\"")
        if token in {"a", "an", "the", "by", "to", "over", "both"}:
            continue
        candidate = token
        if token not in WORDS:
            candidate = {"leaves": "leaf", "scarves": "scarf", "knives": "knife"}.get(token, token)
            if candidate.endswith("ies"): candidate = candidate[:-3] + "y"
            elif candidate.endswith("es") and candidate[:-2] in WORDS: candidate = candidate[:-2]
            elif candidate.endswith("s") and candidate[:-1] in WORDS: candidate = candidate[:-1]
        if candidate not in WORDS:
            UNKNOWN.add(token)
            words.append(f"[{token}]")
        else:
            words.append(WORDS[candidate])
    return " ".join(words).replace("  ", " ").strip()


def register(tags, label, description):
    for tag in tags.split("|"):
        EXACT[tag.strip().lower()] = {"label": label, "description": description}


def load_items():
    script = r"""
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=process.argv[1], output=process.argv[2],context=vm.createContext({window:{}});
for(const name of ['data','corpus-library','freedom-data','corpus-studio','guided-corpus'])
  vm.runInContext(fs.readFileSync(path.join(root,'site',name+'.js'),'utf8'),context);
fs.writeFileSync(output,JSON.stringify(context.window.PM_GUIDED_CORPUS.items.filter(item=>['props','camera'].includes(item.stageId))));
"""
    with tempfile.TemporaryDirectory(prefix="pm-guided-action-") as directory:
        path = Path(directory) / "items.json"
        subprocess.run(["node", "-e", script, str(ROOT), str(path)], check=True, cwd=ROOT)
        return json.loads(path.read_text(encoding="utf-8"))


# Framing: define the actual crop boundary, independently from pose or angle.
for tags, label, description in [
    ("close-up|close up|close-up shot|closer view", "가까이 담기", "피사체 가까이 카메라를 두어 얼굴이나 중심 부위를 크게 담고 주변 공간을 줄입니다."),
    ("portrait|portrait composition|upper body portrait", "초상 중심", "얼굴과 상반신을 중심으로 담아 표정과 인물의 인상이 장면의 중심이 됩니다."),
    ("cowboy shot|three-quarter shot|mid-thigh crop", "허벅지 위 크롭", "머리부터 허벅지 중간 정도까지 담아 손과 허리, 상의와 하의의 연결을 함께 보여줍니다."),
    ("upper body|upper body focus|upper body view|upper torso view", "상반신 중심", "상반신을 크게 담아 얼굴, 어깨, 가슴 쪽 의상 디테일을 강조합니다. 다리 전체는 담지 않습니다."),
    ("full body|full body shot|full shot|full-body shot|full body view|full body framing", "전신을 모두 담기", "머리부터 발끝까지 한 화면에 넣어 다리 자세와 신발, 의상 전체 실루엣을 확인할 수 있게 합니다."),
    ("medium close-up", "가까운 상반신", "얼굴과 어깨, 가슴 위쪽을 함께 담는 가까운 거리로 표정과 상의의 균형을 잡습니다."),
    ("waist-up|waist-up shot|waist up", "허리 위로 담기", "머리부터 허리까지 담아 표정과 팔, 손동작을 함께 보여줍니다."),
    ("mid-shot|medium shot|mid shot", "중간 거리 촬영", "클로즈업보다 거리를 두고 인물의 몸짓과 주변 공간 일부가 함께 보이게 합니다."),
    ("dynamic full-body shot", "움직이는 전신 구도", "발끝까지 보이는 전신 구도에 몸의 기울기와 움직임을 살려 전체 동작을 읽기 쉽게 합니다."),
    ("mid-shot to knee-shot", "중간 거리에서 무릎까지", "상반신 위주의 중간 샷에서 무릎이 보이는 길이까지 여유를 두어 다리 동작 일부를 보여줍니다."),
    ("high-angle mid-shot|medium shot from above", "위에서 담는 중간 샷", "카메라를 인물보다 높게 두고 내려다보며 상반신과 주변 공간을 중간 거리로 담습니다."),
    ("waist-up profile view", "허리 위 옆모습", "허리 위까지만 담되 얼굴과 몸을 옆으로 보여 목선과 옆 실루엣이 드러나게 합니다."),
    ("sharp focus on texture", "표면 질감에 초점", "천의 짜임이나 소재 표면에 초점을 맞춰 작은 재질 차이가 또렷하게 보이게 합니다."),
    ("focus on face|close-up face shot|headshot|face focus", "얼굴에 초점", "얼굴을 화면의 중심 정보로 두고 눈, 입, 미세한 표정이 우선 보이게 합니다."),
    ("focus on shoe", "신발에 초점", "신발을 크게 보이거나 선명하게 초점을 맞춰 발끝의 형태와 소재가 중심이 되게 합니다."),
    ("focus on hands|hand close-up", "손을 가까이 담기", "손과 손가락, 잡고 있는 소품을 크게 담아 손짓의 형태와 접촉 지점을 보여줍니다."),
    ("upper body outside", "상반신을 바깥으로", "상반신이 창문이나 구조물 바깥으로 나오는 구도로 인물과 공간 경계의 관계를 보여줍니다."),
    ("wide shot", "넓은 공간과 인물", "인물 주변을 넓게 담아 장소와 공간의 크기를 보여주고 인물의 화면 점유율을 낮춥니다."),
    ("chest-up shot|bust shot", "가슴 위로 담기", "가슴 위쪽부터 머리까지 담아 얼굴과 어깨의 선, 목 주변 의상을 함께 보여줍니다."),
    ("extreme close-up", "극단적인 근접", "눈이나 입, 표면의 일부가 화면을 크게 채울 정도로 접근해 매우 작은 디테일에 집중합니다."),
    ("buttocks view", "엉덩이 쪽을 담기", "골반과 엉덩이 쪽이 보이는 방향과 크롭을 지정합니다. 다른 신체 부위의 자세는 별도로 정합니다."),
    ("selfie", "셀카 구도", "인물이 직접 카메라를 들고 찍는 듯한 가까운 거리와 팔 방향, 사선 원근을 만듭니다."),
    ("focused framing", "초점이 분명한 프레임", "화면에서 주로 볼 대상이 뚜렷하도록 주변 요소를 정리하고 중심 피사체에 시선을 모읍니다."),
    ("mugshot", "머그샷 형식", "정면 기록 사진처럼 인물을 간결하게 배치합니다. 신장 눈금이나 표식 등은 별도 표현으로 더할 수 있습니다."),
]: register(tags, label, description)


def accessory_description(tag):
    name = translate(tag)
    if "wings on sleeves" in tag:
        return name, f"소매에 작은 날개 장식을 붙여 팔 움직임을 따라 천사나 박쥐의 날개 실루엣이 보이게 합니다."
    if "both heads" in tag:
        return "두 사람을 함께 덮는 검은 베일", "커다란 검은 레이스 베일을 두 사람의 머리 위에 함께 드리워 같은 천 아래 가까이 있는 관계를 보여줍니다."
    if "bindings" in tag:
        where = "손목" if "wrist" in tag else "발목"
        return name, f"붉은 리본을 {where} 주변에 감아 묶인 매듭과 리본 끝이 해당 관절 가까이에 보이게 합니다."
    if "tail" in tag:
        return name, f"{name}{particle(name)} 허리 뒤쪽에서 이어지는 꼬리로 더해 인물의 종족과 뒤쪽 실루엣을 바꿉니다."
    if "wing" in tag:
        return name, f"{name}{particle(name)} 등이나 의상 뒤쪽의 날개로 더해 몸 양옆으로 펼쳐지는 종족 실루엣을 만듭니다."
    if "horn" in tag:
        return name, f"{name}{particle(name)} 머리 위에 더해 뿔의 모양과 장식으로 악마나 판타지 종족의 인상을 만듭니다."
    if any(word in tag for word in ["animal ear", "cat ear", "bunny ear", "horse ear", "floppy ear"]):
        return name, f"{name}{particle(name)} 머리 위나 머리 장식에 더해 귀의 길이와 형태가 종족 실루엣으로 드러나게 합니다."
    if "halo" in tag:
        return name, f"{name}{particle(name)} 머리 위에 떠 있는 고리나 후광으로 배치해 얼굴 위쪽에 빛과 판타지의 상징을 더합니다."
    if "glove" in tag:
        return name, f"손에 {name}{particle(name)} 착용해 손가락의 노출과 손목 끝선, 손 주변의 소재 표현을 바꿉니다."
    if any(word in tag for word in ["eyepatch", "eyewear", "glasses", "goggles", "mask"]):
        position = "머리 위에 올려" if any(word in tag for word in ["on head", "on hat", "on hea"]) else "얼굴이나 눈 주변에 착용해"
        return name, f"{name}{particle(name)} {position} 눈과 얼굴 주변의 윤곽과 가려지는 부위를 바꿉니다."
    if any(word in tag for word in ["earring", "ear piercing"]):
        return name, f"귀에 {name}{particle(name)} 달아 얼굴 양옆의 작은 반짝임과 흔들리는 장식을 만듭니다."
    if any(word in tag for word in ["necklace", "choker", "necktie", "neck ribbon", "ribbon tie", "bow tie", "muffler", "neckerchief", "neck", "rosary"]):
        return name, f"목과 쇄골 주변에 {name}{particle(name)} 두어 목선의 빈 공간을 채우고 얼굴 아래쪽에 장식의 중심을 만듭니다."
    if any(word in tag for word in ["bracelet", "wrist", "cuff", "arm chain", "arm ribbon", "handcuff"]):
        return name, f"손목이나 팔에 {name}{particle(name)} 더해 팔 끝과 손동작 주변에 장식의 경계와 반복을 만듭니다."
    if "ring" in tag and "o-ring" not in tag:
        return name, f"손가락에 {name}{particle(name)} 착용해 가까이 보이는 손의 작은 금속이나 보석 포인트를 더합니다."
    if any(word in tag for word in ["thigh", "ankle"]):
        position = "허벅지" if "thigh" in tag else "발목"
        return name, f"{position}에 {name}{particle(name)} 더해 다리의 특정 위치를 감싸는 끈이나 장식의 선을 만듭니다."
    if any(word in tag for word in ["belt", "waist", "obi", "sash", "norigae", "pants chain"]):
        return name, f"허리나 골반 주변에 {name}{particle(name)} 배치해 상의와 하의의 경계를 강조하고 옆이나 아래로 늘어지는 장식을 만듭니다."
    if any(word in tag for word in ["bag", "backpack", "pouch"]):
        return name, f"{name}{particle(name)} 몸에 메거나 의상 옆에 달아 수납 소품의 부피와 어깨 또는 허리의 끈을 더합니다."
    if any(word in tag for word in ["harness", "holster", "strap", "exo-frame"]):
        return name, f"{name}{particle(name)} 몸통이나 어깨를 따라 배치해 벨트와 끈이 교차하는 구조와 기능적인 착용 실루엣을 만듭니다."
    if any(word in tag for word in ["veil", "headscarf", "bandana", "kerchief", "towel on head"]):
        return name, f"머리 주변에 {name}{particle(name)} 씌우거나 드리워 얼굴을 감싸는 천의 경계와 늘어지는 레이어를 만듭니다."
    if any(word in tag for word in ["hat", "cap", "beret", "bonnet", "beanie", "headdress", "headpiece", "headband", "headwear", "tiara", "crown", "hair"]):
        return name, f"머리나 헤어라인에 {name}{particle(name)} 더해 얼굴 위쪽의 윤곽과 머리카락 사이의 장식 포인트를 만듭니다."
    if "headphone" in tag or "headset" in tag:
        return name, f"{name}{particle(name)} 머리나 목에 착용해 귀 주변의 기기 형태와 연결된 밴드가 보이게 합니다."
    if "brooch" in tag or "pocket square" in tag or "boutonniere" in tag:
        return name, f"가슴이나 칼라 주변에 {name}{particle(name)} 달아 의상 앞면에 작은 장식과 색의 포인트를 더합니다."
    if "bandage" in tag:
        return name, f"{name}{particle(name)} 피부나 의상 위에 감아 겹치는 천의 선과 의료적인 스타일 단서를 더합니다."
    return name, f"{name}{particle(name)} 몸에 착용하는 장식으로 더해 의상의 작은 금속, 보석 또는 매달린 디테일을 채웁니다."


def prop_description(tag, floating=False):
    location, core = "", tag
    for prefix, placement in [
        ("floating ", "공중에 띄워"), ("falling ", "위에서 아래로 떨어뜨려"),
        ("flying ", "날아가는 방향으로 배치해"), ("scattered ", "장면 곳곳에 흩어 놓아"),
        ("surrounded by ", "인물 주변을 둘러싸게 해"), ("hanging ", "위쪽에서 매달아"),
    ]:
        if core.startswith(prefix):
            core = core[len(prefix):]; location = placement; break
    if core.endswith(" around"):
        core = core[:-7]; location = "인물 주변을 감싸게 해"
    if "foreground" in core:
        core = core.replace("in foreground", "").replace("foreground", "").strip()
        location = "카메라 가까운 화면 앞쪽에 놓아"
    if core.startswith("glowing "):
        core = core[len("glowing "):]; location = "빛을 내는 물체로 배치해"
    name = translate(core)
    label = (("떠 있는 " if location == "공중에 띄워" else "떨어지는 " if location == "위에서 아래로 떨어뜨려" else "") + name)
    if not location:
        location = "장면에 배치해" if floating else "소품으로 더해"
    if any(word in tag for word in ["flower", "petal", "rose", "tulip", "sunflower", "cherr", "leaf", "leaves"]):
        effect = "꽃이나 식물의 색과 부드러운 윤곽으로 계절감과 장식 밀도를 더합니다."
    elif any(word in tag for word in ["ribbon", "cable", "string", "cord", "chain", "garland", "bunting", "banner"]):
        effect = "가늘고 길게 이어지는 선으로 인물과 주변 공간을 연결하고 장식의 흐름을 만듭니다."
    elif any(word in tag for word in ["bubble", "water sphere", "bead", "balloon", "glass"]):
        effect = "둥근 부피와 투명한 반사, 겹침을 통해 장면의 앞뒤 깊이와 가벼운 질감을 더합니다."
    elif any(word in tag for word in ["cake", "sweet", "candy", "macaron", "dessert", "cookie", "cream", "syrup", "parfait", "chocolate", "donut", "food", "ice", "puff", "carrot"]):
        effect = "음식의 모양과 크림, 설탕 같은 질감으로 달콤한 디저트나 식사의 테마를 분명하게 합니다."
    elif any(word in tag for word in ["crystal", "gem", "diamond", "ruby", "sapphire", "pearl", "gold", "silver"]):
        effect = "보석이나 금속의 단단한 윤곽과 반사광으로 화면에 반짝이는 장식 포인트를 더합니다."
    elif any(word in tag for word in ["star", "moon", "planet", "armillary"]):
        effect = "별과 달의 상징적인 모양을 사용해 천체 테마와 밤하늘의 장식 리듬을 더합니다."
    elif any(word in tag for word in ["heart", "cupid", "gift", "letter", "envelope"]):
        effect = "하트나 선물, 메시지의 상징으로 애정과 기념일의 분위기를 시각적으로 더합니다."
    elif any(word in tag for word in ["butterfly", "bird", "jellyfish", "fish", "bat", "spirit", "feather"]):
        effect = "작은 생물이나 날개의 실루엣으로 인물 주변에 생동감과 부유하는 깊이를 만듭니다."
    elif any(word in tag for word in ["plush", "teddy", "pillow", "bear"]):
        effect = "부드러운 봉제 질감과 둥근 부피를 더해 인물 주변을 포근하고 장난스러운 공간으로 채웁니다."
    elif any(word in tag for word in ["sticker", "card", "poster", "cd", "disc"]):
        effect = "작은 평면 그림과 반복되는 도형을 더해 스크랩이나 스티커를 붙인 듯한 그래픽 밀도를 만듭니다."
    elif any(word in tag for word in ["firework", "lantern", "candle", "light", "glow", "neon"]):
        effect = "스스로 빛나는 광점과 주변의 반사를 더해 축제나 밤 장면의 밝기 차이를 만듭니다."
    elif any(word in tag for word in ["dust", "particle", "confetti", "sprinkle", "snow"]):
        effect = "작은 입자의 반복과 크기 차이로 공기 속 움직임과 전경에서 배경까지의 깊이를 더합니다."
    elif any(word in tag for word in ["camera", "phone", "tamagotchi", "gamepad", "joystick", "console", "fan"]):
        effect = "기기의 형태와 버튼을 장면의 생활 소품으로 보여 인물의 취미나 일상의 단서를 더합니다."
    elif any(word in tag for word in ["guitar", "microphone", "amp", "whistle"]):
        effect = "연주나 공연에 쓰는 장비의 형태를 더해 음악 활동과 무대의 상황이 읽히게 합니다."
    elif any(word in tag for word in ["iv", "blood", "pill", "syringe", "capsule"]):
        effect = "의료 기구나 약품의 형태로 병원과 메디컬 스타일의 소품 단서를 더합니다."
    elif any(word in tag for word in ["book", "hourglass", "wand", "weapon", "bat", "handgun"]):
        effect = "대상의 뚜렷한 형태를 행동의 중심 소품으로 두어 인물의 역할과 장면의 이야기 단서를 더합니다."
    else:
        effect = "대상의 고유한 모양과 부피를 인물 주변에 남겨 장면의 테마와 물건 사이의 거리감을 구체화합니다."
    if location == "인물 주변을 둘러싸게 해":
        return label, f"{name}{particle(name, '이가')} 인물 주변을 둘러싸게 해 {effect}"
    return label, f"{name}{particle(name)} {location} {effect}"


def action_description(item):
    tag = item["tag"].lower()
    facet = item["facet"]
    if tag in EXACT:
        return EXACT[tag]
    if facet == "accessory":
        label, description = accessory_description(tag)
    elif facet in {"floating", "prop"}:
        label, description = prop_description(tag, facet == "floating")
    elif facet == "hands":
        prefix = re.match(r"(?:(?:hands|hand|one hand|other hand) )?holding (.+)", tag)
        hugging = re.match(r"hugging (.+)", tag)
        if prefix:
            core = prefix[1]
            placement = ""
            for suffix, position in [(" near face", "얼굴 가까이에"), (" on chest", "가슴 앞에"), (" close", "몸 가까이에"), (" in one hand", "한 손에")]:
                if core.endswith(suffix): core = core[:-len(suffix)]; placement = position; break
            name = translate(core)
            label = f"{name} 들기"
            description = f"{name}{particle(name)} {placement} 손으로 잡거나 들어 손가락과 물건이 만나는 접촉 지점을 보여줍니다."
        elif hugging:
            name = translate(hugging[1]); label = f"{name} 안기"
            description = f"{name}{particle(name)} 팔로 감싸 몸 가까이 끌어안아 소품의 부피와 상체의 접촉을 보여줍니다."
        else:
            raise ValueError(f"Unexplained hand relationship: {tag}")
    elif facet == "pose":
        match = re.match(r"(sitting|standing|lying|leaning|riding) (?:on|in|against) (.+)", tag)
        eating = re.match(r"(?:eating|sucking|drinking through|playing|riding) (.+)", tag)
        if match:
            verb, core = match.groups(); name = translate(core)
            label = f"{name}에서 " + {"sitting": "앉기", "standing": "서기", "lying": "눕기", "leaning": "기대기", "riding": "타기"}[verb]
            description = {
                "sitting": f"{name}{particle(name, '을를')} 엉덩이의 지지점으로 삼아 앉히고 인물과 소품의 크기 관계와 발 위치를 보여줍니다.",
                "standing": f"{name} 위에 발을 두고 체중을 실어 몸을 세웁니다. 바닥과 발이 닿는 지지 관계를 분명하게 합니다.",
                "lying": f"{name} 위에 몸통과 골반을 내려 눕히고 몸이 닿는 표면과 주변 소품의 관계를 보여줍니다.",
                "leaning": f"{name}에 팔이나 상체를 기대어 몸의 무게를 받치고 지지면 쪽으로 기울어진 축을 만듭니다.",
                "riding": f"{name}에 몸을 얹거나 발을 올려 타는 자세를 만들고 탈것과 균형을 잡는 팔다리의 관계를 보여줍니다.",
            }[verb]
        elif tag == "leaning out of window":
            label, description = "창문 밖으로 몸 내밀기", "창틀을 경계로 상체를 바깥에 내밀어 몸의 일부는 실내에 남고 얼굴과 어깨는 바깥 공간으로 나오게 합니다."
        elif eating:
            name = translate(eating[1]); label = f"{name}을 사용하는 동작"
            if tag.startswith(("eating", "sucking")):
                description = f"{name}{particle(name)} 입 가까이에 가져가 먹거나 무는 순간을 표현하고 손과 입, 음식 사이의 거리를 보여줍니다."
            elif tag.startswith("playing"):
                description = f"{name}{particle(name)} 손으로 조작하거나 연주하는 자세로 두어 팔과 손의 방향이 소품에 연결되게 합니다."
            elif tag.startswith("riding"):
                description = f"{name}에 몸을 얹어 타거나 발로 지탱하는 자세를 만들고 몸의 균형을 소품과 연결합니다."
            else:
                description = f"{name}{particle(name)} 입에 대어 마시는 동작으로 얼굴과 음료 사이를 연결합니다."
        elif tag == "leaning":
            label, description = "몸 기대기", "몸의 축을 기울여 벽이나 소품, 팔 같은 다른 지지점에 체중 일부를 맡깁니다."
        else:
            raise ValueError(f"Unexplained body relationship: {tag}")
    else:
        raise ValueError(f"Missing precise {facet} description: {tag}")
    return {"label": label, "description": description.replace("  ", " ")}


def build():
    items = load_items()
    result, missing = {}, []
    for item in items:
        try:
            result[item["id"]] = action_description(item)
        except ValueError as error:
            missing.append(str(error))
    if UNKNOWN or missing:
        raise SystemExit(json.dumps({"unknownWords": sorted(UNKNOWN), "missing": missing}, ensure_ascii=False, indent=2))
    assert len(result) == len(items)
    for value in result.values():
        assert re.search(r"[가-힣]", value["description"])
        assert len(value["description"]) >= 24
        assert "[" not in value["description"], value
    target = ROOT / "site/guided-descriptions-action.js"
    target.write_text("// Generated by tools/guided_descriptions_action.py; original prompt text is untouched.\n"
                      "window.PM_GUIDED_DESCRIPTIONS = Object.assign(window.PM_GUIDED_DESCRIPTIONS || {}, "
                      + json.dumps(result, ensure_ascii=False, indent=2) + ");\n", encoding="utf-8")
    print(f"Wrote {len(result)} Korean descriptions for props and camera to {target}")


# Facial expression and gaze: eye direction does not rotate the whole head.
for tags, label, description in [
    ("looking at viewer|looking at camera|gazing at viewer|direct gaze|direct eye contact|eye contact", "관객과 눈 맞추기", "눈동자의 시선을 카메라나 관객에게 향하게 해 화면 밖 사람과 마주 보는 관계를 만듭니다."),
    ("looking up|upward glance|gazing upward|gazing at sky", "위쪽을 보는 시선", "눈동자를 위쪽으로 향하게 해 하늘이나 머리 위 대상에 관심이 있는 듯 보이게 합니다. 고개 각도는 별도로 정할 수 있습니다."),
    ("looking up at viewer", "아래에서 관객 올려다보기", "인물보다 높은 위치의 카메라를 눈동자로 올려다보게 하여 위아래의 시선 관계를 보여줍니다."),
    ("looking down|downward gaze|downcast eyes", "아래로 내린 시선", "눈동자가 아래쪽을 향하게 해 바닥이나 손의 소품을 보는 느낌과 차분한 인상을 만듭니다."),
    ("looking away|averted gaze|looking to side|sideways glance", "옆이나 바깥으로 시선 돌리기", "눈동자를 카메라에서 비켜 옆이나 화면 바깥으로 향하게 해 직접 눈을 맞추는 느낌을 줄입니다."),
    ("looking back at viewer|turned looking at viewer|looking back", "뒤돌아보며 관객 보기", "몸의 진행 방향과 얼굴 방향을 달리해 고개를 뒤로 돌리고 관객을 보는 순간을 만듭니다."),
    ("looking at object", "소품을 보는 시선", "카메라 대신 장면 안의 물건에 눈동자의 방향을 맞춰 인물과 소품의 관계를 분명하게 합니다."),
    ("looking into eyes", "서로의 눈 바라보기", "다른 인물의 눈을 시선의 목표로 삼아 가까운 인물 사이의 눈맞춤을 만듭니다."),
    ("looking through frame|looking through glass", "프레임이나 유리 너머 보기", "프레임 또는 유리 면을 사이에 두고 그 너머로 시선을 보내 인물과 앞쪽 구조물의 관계를 만듭니다."),
    ("gazing up with love", "애정을 담아 올려다보기", "위쪽 상대를 향한 시선에 부드러운 눈매와 애정 어린 인상을 더합니다."),
    ("looking down smiling", "아래를 보며 미소", "시선을 아래로 내린 상태에서 입가에 미소를 더해 손의 소품이나 가까운 상대를 다정하게 바라보는 느낌을 줍니다."),
    ("eyes closed|closed eyes|close eyes", "감은 눈", "양쪽 눈꺼풀을 닫아 시선 대신 입가와 몸짓으로 표정이 전달되게 합니다."),
    ("wink|winking|playfully winking|one eye closed|;)", "한쪽 눈 윙크", "한쪽 눈만 감고 다른 쪽은 열어 장난스럽거나 친근하게 신호를 보내는 표정을 만듭니다."),
    ("wide eyes|wide open eyes", "크게 뜬 눈", "눈꺼풀을 평소보다 크게 열어 놀람이나 강한 주의가 눈의 크기로 드러나게 합니다."),
    ("half-closed eyes|drowsy expression", "반쯤 감긴 졸린 눈", "눈꺼풀을 아래로 내려 눈을 반쯤 감고 얼굴의 긴장을 풀어 졸리거나 나른한 인상을 줍니다."),
    ("dead eyes|lifeless|blank stare|expressionless|emotionless expression", "감정이 억제된 눈과 얼굴", "눈의 생기와 표정 변화를 줄여 멍하거나 무표정한 인상을 만듭니다."),
    ("shadowed eyes", "그늘에 가려진 눈", "눈 주변을 그림자로 눌러 눈동자가 덜 드러나고 표정이 어둡거나 읽기 어렵게 보이게 합니다."),
    ("bright sparkling eyes|sparkling eyes", "반짝이는 눈", "눈동자에 선명한 반짝임과 밝은 하이라이트를 넣어 기대감이나 활기 있는 인상을 줍니다."),
    ("simple eyes", "단순화한 눈", "눈동자와 눈매의 세부 묘사를 줄여 기호처럼 간결한 얼굴 인상을 만듭니다."),
    ("teary eyes", "눈물이 고인 눈", "눈가에 눈물이나 촉촉한 윤기를 더해 감정이 눈에 맺혀 보이게 합니다."),
    ("smile|smiling|slight smile|soft smile|gentle smile|sweet smile|cute smile", "부드러운 미소", "입꼬리를 완만하게 올려 과장된 웃음보다 작고 다정한 미소가 보이게 합니다."),
    ("cheerful smile|happy smile|joyful smile|happy", "밝고 즐거운 웃음", "입꼬리와 볼, 눈매의 밝은 변화를 함께 사용해 즐겁고 기분 좋은 표정을 만듭니다."),
    ("soft and playful smile|playful smile|playful grin|playful expression|cute expression", "장난스러운 웃음", "눈매와 입꼬리에 작은 비대칭이나 웃는 힘을 더해 장난스럽고 생기 있는 표정을 만듭니다."),
    ("smirking at viewer|playful smirk|confident smirk", "자신 있는 한쪽 미소", "입꼬리 한쪽을 더 올리거나 눈매에 여유를 주어 장난스럽고 자신 있는 웃음을 만듭니다."),
    ("cheerful open mouth wide smile|open mouth smile", "입을 벌린 환한 웃음", "입을 열고 입꼬리를 크게 올려 웃음의 크기와 즐거운 감정을 뚜렷하게 보여줍니다."),
    ("closed mouth|calm closed mouth", "다문 입", "입술을 붙여 입 안이 보이지 않게 하고 차분하거나 절제된 얼굴 인상을 만듭니다."),
    ("open mouth|slight open mouth|parted lips|slightly parted lips", "살짝 열린 입술", "입술 사이에 작은 틈을 남겨 숨 쉬거나 말하려는 순간의 미묘한 표정을 만듭니다."),
    ("slender lips pressed softly", "가볍게 맞댄 가는 입술", "가는 입술을 힘주어 깨물지 않고 부드럽게 맞대어 절제된 입가를 만듭니다."),
    ("pouting", "삐죽 내민 입", "입술을 앞으로 모으거나 입꼬리를 내려 토라지거나 투정하는 듯한 입 모양을 만듭니다."),
    ("tongue out", "혀를 내민 표정", "입 밖으로 혀 끝을 보이게 해 장난스럽거나 짓궂은 표정을 만듭니다."),
    ("gritted teeth", "이를 악문 입", "윗니와 아랫니를 맞물린 상태가 보이게 하여 긴장이나 힘을 주는 감정을 표현합니다."),
    ("glossy pink lips", "윤기 있는 분홍 입술", "입술을 분홍색으로 표현하고 작은 광택을 더해 촉촉한 표면과 입가의 존재감을 강조합니다."),
    ("dark red lips", "짙은 붉은 입술", "입술에 어두운 붉은색을 주어 얼굴 안에서 강하고 선명한 색의 포인트를 만듭니다."),
    ("blush|blush on cheeks|blushing|blushes|slight blush", "볼의 홍조", "볼 주변에 붉거나 분홍빛의 기운을 더해 수줍음이나 따뜻한 얼굴 온도를 표현합니다."),
    ("blushing deeply", "짙게 물든 홍조", "볼과 얼굴 주변의 붉은 기운을 강하게 올려 크게 부끄러워하거나 달아오른 표정을 만듭니다."),
    ("shy expression|bashful gaze|gaze lowered shyly|embarrassed|flustered", "수줍고 당황한 표정", "시선을 낮추거나 비키고 얼굴의 긴장과 홍조를 더해 부끄럽거나 당황한 반응을 표현합니다."),
    ("coy expression|seductive", "은근하게 끄는 눈빛", "눈매와 입가의 힘을 조절해 직접적인 큰 동작 없이 은근히 관심을 끄는 표정을 만듭니다."),
    ("worried expression|worried face|distressed face|hesitant", "걱정하거나 망설이는 얼굴", "눈썹과 입가에 긴장을 주고 시선에 확신을 줄여 걱정하거나 주저하는 감정을 표현합니다."),
    ("sad|melancholic|sorrowful expression", "슬프고 쓸쓸한 표정", "눈썹과 입꼬리를 부드럽게 낮추고 시선의 활기를 줄여 슬픔이나 쓸쓸함을 표현합니다."),
    ("surprised expression|surprised", "놀란 표정", "눈을 크게 뜨거나 입을 열고 눈썹을 들어 예상하지 못한 일에 반응하는 얼굴을 만듭니다."),
    ("serene expression|soft expression|cool expression", "차분하게 정돈된 표정", "눈썹과 입가의 긴장을 줄여 조용하고 평온하거나 담담한 얼굴 인상을 만듭니다."),
    ("confident expression|intense determined expression|serious", "의지가 분명한 표정", "눈매와 시선에 힘을 주고 입가를 단단하게 정리해 자신감이나 결심이 드러나게 합니다."),
    ("loving expression", "애정 어린 표정", "눈매와 미소를 부드럽게 연결해 바라보는 대상에 대한 다정함과 애정을 표현합니다."),
    ("dreamy expression", "꿈꾸는 듯한 표정", "눈과 입의 긴장을 낮추고 시선에 약한 멍함을 더해 꿈결처럼 몽환적인 인상을 만듭니다."),
    ("staring", "시선을 고정하기", "한 대상에 눈동자의 방향을 오래 고정하는 듯 표현해 강한 관심이나 응시하는 관계를 만듭니다."),
    ("sweat|sweatdrop", "땀방울로 감정 표시", "얼굴이나 관자놀이에 작은 땀방울을 더해 긴장, 당황, 더위 같은 상태가 보이게 합니다."),
    ("candy in mouth", "입에 문 사탕", "사탕이 입술 사이에 보이게 하여 입 모양과 작은 소품의 관계를 만듭니다."),
    ("slight frown", "살짝 찌푸린 얼굴", "눈썹 사이와 입가에 작은 긴장을 넣어 크게 화내기보다 약한 불편함이나 집중을 표현합니다."),
    ("trembling lips", "떨리는 입술", "입술의 힘과 윤곽을 불안정하게 표현해 울기 직전이나 긴장한 순간의 감정을 더합니다."),
    (":3", "고양이 같은 입 모양", "입술 윤곽을 작고 둥근 고양이 입처럼 단순화해 장난스럽고 귀여운 표정을 만듭니다."),
]: register(tags, label, description)

for tags, label, description in [
    ("full game screen capture of cute character raising game", "캐릭터 육성 게임 화면", "캐릭터 그림과 상태창, 대화창, 선택 버튼을 한 화면에 배치해 육성 게임의 실제 화면처럼 구성합니다."),
    ("complex layered interface|layered screen interface|high-fidelity hud layout", "여러 겹의 게임 인터페이스", "인물 앞뒤에 여러 정보창과 상태 표시를 겹쳐 복잡한 게임 화면의 정보 구조를 만듭니다."),
    ("chibi icons|chibi character inset", "작은 치비 삽입 그림", "주요 인물과 별개로 작은 데포르메 캐릭터 그림을 화면 모서리나 정보 영역에 삽입합니다."),
    ("top-left rounded character profile card with soft gradients and stats", "왼쪽 위 캐릭터 정보 카드", "화면 왼쪽 위에 둥근 모서리와 부드러운 색 번짐을 가진 프로필 카드를 두고 능력치 정보를 함께 배치합니다."),
    ("stamina bar", "체력 막대", "게임 화면의 일부에 현재 체력을 나타내는 가로 막대를 배치해 상태 정보가 보이게 합니다."),
    ("top-right support card list", "오른쪽 위 지원 카드 목록", "화면 오른쪽 위에 여러 지원 캐릭터나 아이템 카드를 목록 형태로 배치합니다."),
    ("bottom large dialogue box with text", "화면 아래 큰 대화창", "화면 하단에 글자가 들어가는 넓은 대화 상자를 두어 인물 그림과 대사의 영역을 나눕니다."),
    ("choice buttons|floating menu buttons", "선택 버튼 묶음", "누를 수 있을 듯한 선택지나 메뉴 버튼을 화면 위에 겹쳐 게임이나 앱의 조작 영역을 만듭니다."),
    ("floating computer windows|computer windows|multi-window layout|multi-window composition", "겹쳐 놓은 컴퓨터 창", "여러 컴퓨터 창을 크기와 위치를 달리해 겹쳐 놓고 앞뒤 순서가 있는 화면 레이아웃을 만듭니다."),
    ("web browser interface|retro computer ui|retro pc interface|retro windows os interface", "레트로 컴퓨터 화면", "제목 표시줄과 창 테두리, 작은 버튼을 사용해 옛 컴퓨터 운영체제나 브라우저의 화면 형식을 만듭니다."),
    ("digital interface elements|ui elements", "디지털 인터페이스 요소", "정보창이나 아이콘, 버튼 같은 화면 요소를 그림에 겹쳐 디지털 기기의 조작 화면처럼 보이게 합니다."),
    ("magazine cover layout|magazine cover|y2k magazine cover|y2k magazine", "잡지 표지 레이아웃", "인물 사진이나 그림 위에 큰 제목과 작은 기사 문구, 부호를 배치해 잡지의 표지처럼 구성합니다."),
    ("magazine collage layout|collage|collage layout|collage background", "이미지를 겹친 콜라주", "여러 사진이나 그림 조각을 크기와 각도를 달리해 겹쳐 놓고 하나의 편집된 화면으로 연결합니다."),
    ("character sheet|reference sheet", "캐릭터 설정 시트", "한 캐릭터의 여러 방향과 표정, 작은 디테일 그림을 정리해 디자인 참고용 시트처럼 배치합니다."),
    ("sticker sheet|sticker sheet style", "스티커 시트", "캐릭터와 소품을 서로 떨어진 작은 그림으로 반복하고 각각의 외곽선을 살려 스티커 묶음처럼 보이게 합니다."),
    ("multiple views", "여러 방향을 한 화면에", "같은 인물의 정면과 옆면, 뒷면 등을 한 화면에 나누어 배치해 여러 방향을 동시에 보여줍니다."),
    ("computer window frame|floating window frame|window frame", "컴퓨터 창 프레임", "그림 가장자리에 창의 제목줄과 테두리를 두어 인물이 컴퓨터 창 안에 있는 듯한 경계를 만듭니다."),
    ("album cover", "앨범 커버", "음반의 정사각 커버처럼 중심 이미지와 제목, 여백을 묶어 음악 패키지의 앞면 같은 구성을 만듭니다."),
    ("graphic design layout", "그래픽 편집 레이아웃", "인물 그림과 도형, 글자, 여백을 서로 맞물리게 배치해 디자인된 인쇄물의 화면 구조를 만듭니다."),
    ("popups|dialog boxes|dialog box|popup", "팝업 대화 상자", "다른 화면 위에 작은 대화 상자를 띄워 제목과 내용, 버튼이 있는 창의 앞뒤 층을 만듭니다."),
    ("system alerts|warning window|error popup", "경고와 오류 창", "경고 기호나 오류 문구가 담긴 작은 창을 겹쳐 컴퓨터의 알림이나 이상 상태를 표현합니다."),
    ("polaroid border|polaroid frames|polaroid photo", "폴라로이드 사진 프레임", "그림 둘레에 두께가 있는 흰 사진 테두리를 두어 즉석 사진을 붙인 듯한 구성을 만듭니다."),
    ("scrapbook|pastel pink scrapbook background", "스크랩북 편집", "사진 조각과 메모, 테이프 같은 작은 요소를 종이 위에 붙여 개인 기록장처럼 따뜻한 편집 화면을 만듭니다."),
    ("perfume advertisement", "향수 광고 지면", "향수병과 인물, 제목과 여백을 함께 설계해 향과 브랜드 이미지를 보여주는 광고 같은 구성을 만듭니다."),
    ("three full body panels in a row", "전신 그림 세 칸 가로 배치", "머리부터 발끝까지 보이는 전신 그림 세 개를 가로 한 줄로 나란히 놓아 복장과 방향을 비교할 수 있게 합니다."),
    ("portrait close-up panel at bottom right", "오른쪽 아래 얼굴 확대 칸", "주요 그림과 별개로 화면 오른쪽 아래에 얼굴을 크게 보여주는 보조 패널을 삽입합니다."),
    ("small detail insets on the right: eye close-up|eye close-up inset", "눈 디테일 확대 삽입", "주요 인물 그림 옆에 작은 확대 칸을 두고 눈의 형태와 색, 장식 세부를 따로 보여줍니다."),
    ("clean layout", "정돈된 편집 화면", "패널과 글자 사이 간격을 분명히 두고 겹침을 정리해 각 정보가 쉽게 구분되는 화면을 만듭니다."),
    ("comic panels", "만화 칸 나누기", "한 화면을 여러 만화 패널로 나누어 다른 시점이나 순간을 순서 있게 보여줍니다."),
    ("japanese music magazine", "일본 음악 잡지 형식", "인물 화보에 큰 제목과 촘촘한 기사 문구를 결합해 일본 음악 잡지의 표지나 특집 지면 같은 인상을 만듭니다."),
    ("ms paint window", "그림판 프로그램 창", "간단한 도구 모음과 캔버스가 보이는 옛 그림판 프로그램의 창 안에 이미지를 배치합니다."),
    ("taskbar", "화면 아래 작업 표시줄", "화면 하단에 시작 버튼이나 실행 아이콘이 있는 긴 막대를 넣어 컴퓨터 바탕화면 형식을 만듭니다."),
    ("loading bar", "진행률 막대", "일부가 채워진 가로 막대를 넣어 무언가를 불러오거나 진행 중인 상태를 화면 요소로 표현합니다."),
    ("arcade slot machine frame", "아케이드 슬롯 기계 프레임", "그림 둘레에 오락기와 슬롯머신의 장식 프레임을 두어 화면이 게임 기계의 일부처럼 보이게 합니다."),
    ("navy header bar", "네이비색 상단 표시줄", "화면이나 창의 위쪽에 짙은 남색 가로 막대를 넣어 제목 영역과 아래 내용을 구분합니다."),
    ("slot machine reels at bottom", "하단 슬롯 릴", "화면 아래에 그림이나 숫자가 돌아가는 슬롯머신 릴을 나란히 배치합니다."),
    ("button panel", "버튼 패널", "여러 버튼을 한 구역에 묶어 조작 장치나 게임 화면의 입력 영역을 만듭니다."),
    ("score bar", "점수 표시 영역", "현재 점수나 기록이 들어가는 막대 영역을 배치해 게임 진행 정보를 더합니다."),
    ("side photo strip|photo booth strip", "세로로 이어진 사진 띠", "작은 사진 여러 장을 세로로 연결해 즉석 사진기에서 나온 사진 띠처럼 배치합니다."),
    ("multiple small photos", "작은 사진 여러 장", "주요 이미지 주변에 서로 다른 크기나 각도의 작은 사진을 여러 장 배치해 기록과 콜라주 느낌을 더합니다."),
    ("search bar", "검색 입력창", "입력 칸과 검색 기호를 가진 긴 막대를 화면 위에 넣어 검색 서비스나 브라우저의 형식을 더합니다."),
]: register(tags, label, description)
register("a three-panel vertically stacked image layout. top panel: high-angle overhead view of a person lying down. middle panel: waist-up medium shot against the sky. bottom panel: low-angle eye-level close-up of a person lying down. each panel is filled with scattered props like varied mirror balls",
         "서로 다른 시점의 세로 삼단 화면", "화면을 위아래 세 칸으로 나눕니다. 위는 누운 인물을 내려다보는 시점, 가운데는 하늘을 배경으로 한 허리 위 샷, 아래는 누운 인물을 낮게 담은 근접 샷이며 각 칸에 미러볼 같은 소품을 흩뿌립니다.")


# Camera geometry. Height, direction, perspective and composition stay distinct.
for tags, label, description in [
    ("low angle|low-angle|low-angle shot|from below", "아래에서 올려다보기", "카메라를 인물보다 낮게 두어 위로 올려다봅니다. 가까운 다리나 하체가 상대적으로 크게 보이고 세로선이 강조됩니다."),
    ("slight low angle|slightly low angle", "조금 낮은 카메라", "시선 높이보다 카메라를 살짝 낮춰 과도한 왜곡 없이 인물의 존재감과 세로선을 더합니다."),
    ("extreme low angle", "아주 낮은 카메라", "지면 가까이에서 강하게 올려다보아 앞쪽 신체와 발의 크기, 수직 원근을 크게 강조합니다."),
    ("dynamic low-angle", "역동적인 낮은 시점", "낮은 위치에서 올려다보면서 몸의 사선과 원근을 함께 살려 움직임을 크게 느끼게 합니다."),
    ("feet-first low-angle perspective", "발이 먼저 다가오는 낮은 원근", "발을 카메라에 가장 가깝게 두고 아래에서 올려다보아 발과 다리가 크게 보이는 깊이감을 만듭니다."),
    ("high angle|high angle view|from above", "위에서 내려다보기", "카메라를 인물보다 높은 곳에 두어 내려다봅니다. 머리와 어깨가 가까워지고 발 쪽은 상대적으로 멀어집니다."),
    ("overhead shot|high-angle top-down view|top-down angle|top-down perspective|top-down view", "정수리 위 수직 시점", "인물의 바로 위에서 아래를 향해 촬영해 몸과 바닥, 주변 소품의 평면 배치를 보여줍니다."),
    ("eye-level angle", "눈높이 시점", "인물의 눈과 비슷한 높이에 카메라를 두어 위아래 원근을 억제하고 자연스럽게 마주 보는 느낌을 줍니다."),
    ("front view|view from front|frontal view|front-facing|facing viewer", "정면으로 마주 보기", "카메라가 인물의 앞쪽을 향해 얼굴과 몸통의 정면을 보여줍니다. 시선의 방향은 별도로 고를 수 있습니다."),
    ("side profile|side angle view|profile view|side view|from side|profile", "옆모습 시점", "인물의 옆쪽에서 촬영해 코와 턱, 몸의 측면 실루엣을 보여줍니다."),
    ("from slightly side view|slightly angled", "약한 측면 각도", "정면에서 조금 벗어난 사선 방향으로 촬영해 얼굴과 몸의 입체감이 자연스럽게 드러나게 합니다."),
    ("from behind|back view|facing away", "뒤에서 바라보기", "인물의 등과 뒷머리가 카메라 쪽을 향하도록 합니다. 얼굴을 보이게 하려면 뒤돌아보기 표현을 함께 고릅니다."),
    ("looking back over shoulder|looking over shoulder", "어깨 너머로 뒤돌아보기", "몸은 뒤쪽을 향한 상태에서 고개를 어깨 너머로 돌려 얼굴과 등, 어깨선이 함께 보이게 합니다."),
    ("over the shoulder|over shoulder", "어깨 너머 촬영", "앞쪽 인물의 어깨 일부를 전경에 두고 그 너머의 대상이나 공간을 바라보는 구도를 만듭니다."),
    ("dutch angle|tilted camera angle|tilted angle|tilted perspective|diagonal angle", "기울인 카메라", "카메라의 수평선을 기울여 화면 전체가 사선으로 흐르게 하고 불안정하거나 역동적인 리듬을 만듭니다."),
    ("perspective", "앞뒤 원근", "가까운 것과 먼 것의 크기 차이를 드러내어 평면 화면 안에 공간의 깊이를 만듭니다."),
    ("foreshortening|foreshortened legs", "원근에 의한 길이 압축", "팔이나 다리가 카메라를 향해 뻗을 때 가까운 끝은 크게, 뒤쪽 길이는 짧게 보이게 해 강한 입체감을 만듭니다."),
    ("dynamic perspective|dramatic perspective", "강한 원근 변화", "앞뒤의 크기 차이와 사선 수렴을 크게 살려 인물과 공간이 카메라 쪽으로 다가오는 듯한 깊이를 줍니다."),
    ("soft perspective", "완만한 원근", "가까운 부위와 먼 부위의 크기 차이를 완만하게 표현해 인물의 비례가 부드럽고 자연스럽게 보이게 합니다."),
    ("depth of field", "초점 거리의 깊이", "초점이 맞는 거리와 흐려지는 거리를 구분해 주인공과 앞뒤 배경을 분리합니다."),
    ("shallow depth of field", "얕은 심도", "좁은 거리 범위에만 초점을 맞추고 그 앞뒤는 흐려 피사체를 배경에서 강하게 분리합니다."),
    ("wide angle", "넓은 화각", "한 화면에 넓은 공간을 넣고 가까운 물체와 화면 가장자리의 원근 차이를 더 크게 보여줍니다."),
    ("strong depth", "깊은 공간감", "전경과 중경, 배경의 거리 차이를 분명히 하여 화면 안쪽으로 이어지는 깊이를 강조합니다."),
    ("centered composition|centered|centered character", "중앙에 인물 배치", "주요 인물을 화면 중앙에 두어 시선을 바로 모으고 좌우의 안정적인 균형을 만듭니다."),
    ("balanced positioning|balanced composition", "균형 잡힌 배치", "인물과 큰 소품의 위치, 여백을 조절해 어느 한쪽으로 시각적 무게가 과하게 쏠리지 않게 합니다."),
    ("dramatic centered composition", "중앙에 집중하는 극적 구도", "중앙 인물에 시선을 강하게 모으면서 주변의 선과 명암, 여백이 중심을 받쳐주게 합니다."),
    ("centered and cozy framing", "편안한 중앙 프레임", "인물을 안정적으로 중앙에 두고 가까운 주변 공간을 함께 보여 아늑한 거리감을 만듭니다."),
    ("cinematic angle|cinematic framing|cinematic composition", "영화적인 화면 구성", "인물과 공간의 거리, 시선 방향과 여백을 함께 설계해 영화의 한 장면 같은 장면성을 더합니다."),
    ("dynamic angle|dramatic angle", "움직임을 살리는 앵글", "정적인 정면보다 과감한 사선과 높이 차이를 사용해 인물 동작과 공간의 긴장감을 강조합니다."),
    ("dynamic composition", "역동적인 요소 배치", "인물과 소품의 사선 방향을 이어 화면 속 시선이 움직이도록 배치합니다."),
    ("busy composition|chaotic composition", "밀집된 복잡한 화면", "여러 인물이나 소품이 겹치고 화면 곳곳을 채우게 하여 정보가 많고 분주한 리듬을 만듭니다."),
    ("dreamy framing", "꿈결 같은 프레이밍", "윤곽과 여백, 주변 요소를 부드럽게 연결해 현실적인 기록 사진보다 몽환적인 장면감을 더합니다."),
    ("square image|square aspect ratio", "정사각 화면", "가로와 세로가 같은 화면 비율을 의도해 인물과 소품을 사각형 안에서 균형 있게 배치합니다."),
    ("vertical composition", "세로로 긴 구도", "인물의 키와 의상 자락, 위아래 공간을 따라 세로 방향으로 시선이 흐르게 배치합니다."),
    ("dynamic perspective from inside", "내부에서 밖으로 향하는 원근", "공간이나 구조물의 안쪽에서 바깥을 보는 방향으로 근경과 원경을 연결하고 원근을 강조합니다."),
    ("coat over shoulders", "어깨에 걸친 코트", "코트를 소매에 완전히 끼우기보다 어깨 위에 걸쳐 등과 어깨 주변에 별도의 겉레이어를 만듭니다."),
]: register(tags, label, description)

# Motion describes what moves and the visible trace it leaves.
for tags, label, description in [
    ("wind blowing hair|wind-blown hair|windblown hair|blowing hair|flying hair", "바람에 날리는 머리", "머리카락이 바람 방향을 따라 옆이나 뒤로 흩날리게 하여 정적인 자세에도 움직임을 더합니다."),
    ("flowing hair|long flowing hair", "길게 흐르는 머리", "머리카락의 긴 가닥이 부드러운 곡선으로 이어져 몸 주변에 흐름과 실루엣을 만듭니다."),
    ("flowing brown hair", "흐르는 갈색 머리", "갈색 머리카락이 길고 부드러운 곡선을 따라 흐르게 하여 머리색과 움직임을 함께 지정합니다."),
    ("floating hair", "공중에 뜬 머리카락", "중력보다 부유감을 우선해 머리카락이 몸 주변으로 떠오르거나 퍼지게 합니다."),
    ("hair spread out", "펼쳐진 머리카락", "머리카락을 한 방향으로 모으지 않고 주변으로 넓게 펼쳐 누운 자세나 부유 장면의 실루엣을 만듭니다."),
    ("wind|wind-blown|wind lift", "바람의 힘", "머리카락과 옷자락, 가벼운 소품이 같은 바람 방향으로 들리거나 밀리게 하여 장면의 공기를 보여줍니다."),
    ("wind particles", "바람을 타는 입자", "작은 입자를 일정한 흐름으로 날려 바람이 지나가는 방향과 장면의 움직임을 보이게 합니다."),
    ("motion blur", "움직임 잔상", "빠르게 움직이는 부위나 배경에 방향성 있는 흐림을 남겨 속도와 이동 방향을 보여줍니다."),
    ("powerful motion blur", "강한 속도 잔상", "크고 뚜렷한 방향성 흐림을 사용해 빠른 이동과 힘 있는 동작을 강조합니다."),
    ("very long swirling sheer ribbons", "매우 긴 얇은 리본의 회전", "얇고 비치는 긴 리본이 인물 주변을 휘감는 곡선으로 회전해 넓은 공간의 흐름을 만듭니다."),
    ("long flying ribbons", "길게 휘날리는 리본", "긴 리본 끝이 뒤쪽이나 옆으로 날려 의상에서 바깥 공간으로 이어지는 움직임의 선을 만듭니다."),
    ("whipping horse tail", "힘차게 휘는 말꼬리", "말의 꼬리가 한 방향으로 빠르게 휘어져 달리기나 방향 전환의 힘을 드러냅니다."),
    ("trailing dress", "뒤로 끌리는 드레스", "드레스의 긴 자락이 이동 방향 뒤로 따라오게 하여 걸음과 바람, 의상의 길이를 함께 보여줍니다."),
    ("dynamic ponytail flow", "포니테일의 큰 흐름", "묶은 머리의 꼬리 부분이 동작을 따라 크게 휘어져 고개와 몸의 움직임을 이어줍니다."),
    ("flowing movement", "이어지는 유연한 움직임", "몸과 옷자락, 머리카락의 방향이 끊기지 않는 곡선으로 연결되어 동작이 매끄럽게 보이게 합니다."),
]: register(tags, label, description)

# Distinct support points are important when reproducing the original poses.
for tags, label, description in [
    ("sitting|sitting pose|seated position|sitting on ground|sitting on floor", "바닥이나 지지점에 앉기", "엉덩이를 바닥이나 좌석에 두고 체중을 받치는 앉은 자세입니다. 다리 모양과 손의 지지점은 따로 조합할 수 있습니다."),
    ("sitting cross-legged on the floor|sitting crossed-legged|sitting cross-legged", "바닥에 양반다리", "엉덩이를 바닥에 두고 두 다리를 몸 앞에서 교차해 접습니다. 서 있는 자세의 다리 꼬기와 구분됩니다."),
    ("legs crossed|crossed legs|one leg crossed", "한쪽 다리 꼬기", "한쪽 다리를 다른 쪽 다리 앞이나 위로 교차해 다리 선이 겹치게 합니다. 팔을 교차하는 동작은 포함하지 않습니다."),
    ("wariza", "무릎을 접은 W자 앉기", "엉덩이를 바닥에 두고 무릎을 앞으로 접으며 발과 종아리를 양옆으로 벌려 W자 형태로 앉습니다."),
    ("seiza", "정좌", "두 무릎을 바닥에 붙이고 발등과 종아리 위에 엉덩이를 얹는 가지런한 무릎 앉기입니다."),
    ("kneeling|kneeling pose|one knee down", "무릎으로 체중 받치기", "한쪽 또는 양쪽 무릎을 바닥의 지지점으로 삼습니다. 엉덩이를 발 위에 완전히 얹는 정좌와는 별도로 조절합니다."),
    ("one knee up|knees up|knees drawn up|curled up", "무릎을 몸 쪽으로 당기기", "앉거나 누운 상태에서 무릎을 가슴 쪽으로 끌어올려 다리를 접고 몸의 실루엣을 응축합니다."),
    ("knees folded|bent knees|bent legs|knees slightly bent", "접히거나 굽힌 무릎", "무릎 관절을 펴지 않고 굽혀 다리에 각도와 유연함을 줍니다. 앉기나 서기 같은 큰 자세와 함께 사용합니다."),
    ("legs extended", "다리를 길게 뻗기", "무릎을 펴서 다리가 몸에서 바깥쪽으로 길게 이어지도록 합니다. 발끝 방향은 별도로 지정할 수 있습니다."),
    ("legs together", "다리 모으기", "두 다리의 무릎과 발 방향을 가깝게 모아 하나의 정돈된 세로 실루엣을 만듭니다."),
    ("legs toward viewer", "다리를 관객 쪽으로", "다리와 발끝을 카메라 방향으로 향하게 해 발이 가까워지는 원근과 다리 길이의 압축을 만듭니다."),
    ("dangling legs|legs dangling|swinging legs", "앉아서 다리 늘어뜨리기", "높은 지지점에 앉아 발이 바닥에 닿지 않게 두 다리를 아래로 내리거나 가볍게 흔듭니다."),
    ("one leg forward", "한쪽 다리를 앞으로", "한쪽 발과 다리를 몸 앞쪽으로 내밀어 좌우 다리의 앞뒤 거리와 체중 차이를 드러냅니다."),
    ("one leg up|one leg raised", "한쪽 다리 들기", "한쪽 다리를 바닥에서 들어 올려 두 다리의 높이에 차이를 만들고 한쪽 지지로 무게를 옮깁니다."),
    ("standing|elegant standing pose|side standing view|standing centrally", "서 있는 몸의 축", "발을 바닥에 두고 몸을 세워 지탱합니다. 골반과 어깨의 각도, 발의 간격은 다른 표현으로 조합합니다."),
    ("standing on tiptoes|en pointe", "발끝으로 서기", "뒤꿈치를 들고 발끝에 체중을 실어 다리와 몸의 세로선을 길게 보이게 합니다."),
    ("lying down|lying on ground", "몸을 눕히기", "몸통과 골반을 바닥이나 지지면에 내려 수평에 가까운 자세를 만듭니다. 어느 쪽으로 누울지는 따로 고릅니다."),
    ("lying on back|on back", "등을 대고 눕기", "등을 바닥이나 침대에 붙이고 얼굴과 몸의 앞면이 위쪽을 향하게 눕습니다."),
    ("lying on stomach|prone|center prone view", "엎드리기", "배 쪽을 바닥에 붙여 엎드린 자세를 만듭니다. 팔꿈치나 손으로 턱을 받치는 동작과 조합할 수 있습니다."),
    ("reclining on side", "옆으로 기대어 눕기", "몸의 한쪽 옆면을 바닥이나 쿠션에 대어 옆으로 눕고 어깨와 골반의 측면 선을 보여줍니다."),
    ("reclining pose", "비스듬히 기대어 눕기", "상체를 완전히 세우지 않고 뒤나 옆의 지지점에 기대어 반쯤 누운 편안한 자세를 만듭니다."),
    ("leaning forward|upper body leaning forward|slight lean forward|male leaning forward", "상체를 앞으로 기울이기", "골반이나 발의 지지점을 유지한 채 상체를 앞쪽으로 기울여 얼굴과 어깨가 상대적으로 가까워지게 합니다."),
    ("leaning back|leaning backward slightly|female leaning backward", "몸을 뒤로 기대기", "몸의 중심을 뒤쪽으로 이동시켜 상체가 골반이나 발의 지지점보다 뒤에 놓이게 합니다."),
    ("leaning back on one hand", "한 손으로 뒤를 받치기", "앉은 몸 뒤쪽 바닥에 한 손을 짚고 팔로 상체의 체중을 받쳐 뒤로 기댑니다. 단순히 손을 뒤로 보내는 동작과 다릅니다."),
    ("crouching|crouching on floor|squatting", "낮게 쪼그려 앉기", "무릎과 엉덩이를 깊게 굽혀 몸을 바닥 가까이 낮추고 발에 체중을 둡니다."),
    ("slouching", "구부정한 상체", "어깨와 등을 앞으로 둥글게 말아 힘이 풀리거나 지친 듯한 몸의 축을 만듭니다."),
    ("upper body slightly arched", "완만하게 휜 상체", "상체의 축을 약하게 뒤로 휘어 가슴과 어깨, 허리선이 완만한 곡선을 이루게 합니다."),
    ("twisted body|angled body|diagonal pose|diagonal dynamic pose", "비틀거나 사선으로 놓은 몸", "어깨와 골반의 방향을 어긋나게 하거나 몸 전체를 사선으로 놓아 정면의 평행한 축을 깨뜨립니다."),
    ("head tilt|slight head tilt|slightly tilting head to the side|tilting head|leaning head|head leaning|tilted head|slight tilt", "고개를 옆으로 기울이기", "목의 세로축을 기준으로 고개를 한쪽 어깨 쪽으로 기울여 얼굴에 사선과 부드러운 비대칭을 줍니다."),
    ("head tilt up|head tilted up", "고개 들어 올리기", "턱과 얼굴을 위쪽으로 향하게 들어 목선과 아래에서 보이는 얼굴의 각도를 바꿉니다."),
    ("head tilted down|head slightly bowed", "고개 숙이기", "턱을 아래로 내려 얼굴이 바닥 쪽을 향하게 합니다. 눈동자의 시선만 내리는 동작과는 구분됩니다."),
    ("shoulders angled forward", "어깨를 앞으로", "어깨를 몸의 앞쪽으로 모아 몸통의 전면이 조금 좁아지고 상체가 가까워 보이게 합니다."),
    ("floating|mid-air|midair|weightless|dynamic floating pose|floating dynamically|mid-air graceful pose", "공중에 떠 있는 몸", "발이 지면에 체중을 싣지 않은 채 공중에 몸이 떠 있게 하여 다리와 옷자락이 가볍게 흐르도록 합니다."),
    ("both feet off ground|jumping|leaping|dynamic jumping pose", "두 발을 떼고 도약", "두 발을 동시에 바닥에서 떼어 도약의 한순간을 담습니다. 무릎과 팔의 방향으로 힘의 흐름을 더할 수 있습니다."),
    ("grand jeté ballet leap", "그랑 주테 발레 도약", "공중에서 두 다리를 앞뒤로 크게 벌리는 발레 도약으로, 긴 다리 선과 떠 있는 몸의 곡선을 보여줍니다."),
    ("dynamic landing pose", "착지하는 순간", "도약 뒤 한쪽 발이나 무릎으로 바닥을 받아내며 몸을 낮춰 착지의 충격과 무게 이동을 표현합니다."),
    ("walking", "걷는 중간 동작", "두 발의 앞뒤 위치를 달리하고 한쪽으로 체중을 옮겨 걸음을 내딛는 순간을 만듭니다."),
    ("mid-stride sprint", "전력 질주의 한 걸음", "달리는 중 발이 앞뒤로 크게 벌어지는 순간을 포착해 보폭과 몸의 추진력을 강조합니다."),
    ("running down stairs", "계단을 내려 달리기", "발을 높이가 다른 계단에 번갈아 놓고 상체를 앞으로 보내 아래쪽으로 달리는 동작을 만듭니다."),
    ("dancing|twirling|graceful ballerina pose|playful ballet pose", "춤추는 몸의 흐름", "팔과 다리, 골반의 방향을 이어 균형을 옮기거나 회전하는 춤의 실루엣을 만듭니다."),
    ("archery stance", "활쏘기 자세", "다리를 벌려 중심을 고정하고 한쪽 팔은 활을 향해 뻗으며 다른 쪽은 시위를 당기는 축을 만듭니다."),
    ("martial arts stance", "무술의 중심 잡기", "발의 간격과 굽힌 무릎으로 중심을 낮추고 팔을 준비 위치에 두어 공격이나 방어 직전의 자세를 만듭니다."),
    ("puppet pose", "꼭두각시 같은 자세", "관절의 꺾임과 힘이 풀린 팔다리로 줄에 매달리거나 조종되는 인형 같은 실루엣을 만듭니다."),
    ("jiangshi pose", "강시처럼 뻗은 자세", "팔을 몸 앞쪽으로 나란히 뻗어 강시의 뻣뻣한 실루엣을 만듭니다. 뛰거나 서 있는 몸축과 조합합니다."),
    ("standing behind", "뒤쪽에 서기", "다른 인물이나 소품보다 뒤쪽에 서 있도록 앞뒤 위치를 지정합니다."),
    ("standing in front|sitting in front", "앞쪽에 자리 잡기", "다른 인물이나 소품보다 카메라에 가까운 앞쪽 위치에 몸을 두어 겹침 순서를 정합니다."),
    ("legs half-submerged in water|sitting in water", "물에 잠긴 하체", "물 높이가 다리나 앉은 하체 일부를 덮도록 해 수면과 몸이 만나는 경계를 보여줍니다."),
    ("sidesaddle", "양다리를 한쪽으로 두고 타기", "말이나 탈것에 걸터앉되 두 다리를 같은 쪽으로 내려 옆으로 타는 실루엣을 만듭니다."),
    ("straddling", "양쪽으로 다리를 벌려 걸터앉기", "지지물의 양쪽으로 다리를 나누어 두고 골반을 그 위에 얹어 타거나 걸터앉는 자세를 만듭니다."),
    ("shrugging shoulders", "어깨 으쓱하기", "양쪽 어깨를 목 쪽으로 들어 올려 난처함이나 장난스러운 반응이 몸짓으로 보이게 합니다."),
    ("yawning", "하품하는 순간", "입을 크게 벌리고 얼굴과 몸의 힘을 풀어 졸리거나 막 깨어난 순간을 표현합니다."),
    ("sleeping", "잠든 자세", "몸과 얼굴의 힘을 풀고 잠든 상태를 표현합니다. 눕는 방향이나 기대는 지지점은 별도로 조합합니다."),
    ("blowing bubblegum", "풍선껌 불기", "입 앞에 둥근 풍선껌이 부풀게 하여 얼굴 가까이에 장난스러운 소품과 행동을 만듭니다."),
    ("brushing teeth", "양치하는 동작", "칫솔을 입가에 대고 이를 닦는 행동을 보여주어 세면대나 아침 일상의 단서를 만듭니다."),
    ("singing", "노래하는 순간", "입과 상체의 움직임으로 노래하는 장면을 표현합니다. 마이크나 무대 소품은 별도로 조합합니다."),
    ("hitting tennis ball", "테니스공을 치는 순간", "라켓을 휘두르는 팔과 몸의 회전, 다리의 지지를 연결해 공을 치는 동작을 만듭니다."),
    ("dynamic pose|energetic pose|energetic posture|energetic idol pose|playful action pose|trick", "힘 있는 동작", "몸의 축과 팔다리의 방향에 큰 변화를 주어 서 있는 기본 자세보다 운동감과 동작의 순간이 뚜렷하게 보이게 합니다."),
    ("static pose", "멈춘 자세", "큰 이동이나 회전을 줄여 몸의 축을 안정적으로 고정하고 인물과 의상 자체에 시선을 모읍니다."),
    ("relaxed pose|relaxed posture|soft relaxed posture|gentle pose|casual pose|relaxed confident posture", "힘을 뺀 편안한 자세", "어깨와 관절의 긴장을 낮추고 체중을 자연스럽게 지지점에 실어 일상적이고 편안한 몸짓을 만듭니다."),
    ("cute pose|cute playful pose|adorable pose|playful pose|endearing and lively posture|bashful pose", "귀엽고 장난스러운 몸짓", "고개의 기울기와 접힌 팔다리, 작은 비대칭을 사용해 다정하거나 수줍고 장난스러운 몸짓을 더합니다."),
    ("elegant pose", "우아한 몸의 선", "목과 어깨, 팔과 다리의 선을 길고 부드럽게 이어 과도한 힘보다 정돈된 균형을 강조합니다."),
    ("waddling pose", "뒤뚱거리는 몸짓", "몸의 중심을 좌우로 옮기고 짧은 보폭을 사용해 균형을 잡으며 뒤뚱거리는 동작을 만듭니다."),
    ("slightly bent posture", "살짝 굽힌 몸", "허리나 무릎의 축을 조금 굽혀 곧게 선 자세보다 유연하고 낮아진 실루엣을 만듭니다."),
    ("legs visible", "다리가 보이는 배치", "옷자락이나 소품에 다리가 완전히 가려지지 않도록 다리 선을 화면 안에 남깁니다."),
    ("lifting higher", "더 높이 들어 올리기", "동작의 대상이나 몸의 일부를 기존 지지점보다 위로 들어 올려 높이 차이를 강조합니다."),
]: register(tags, label, description)

# Hands: contact, support and object manipulation are separate relationships.
for tags, label, description in [
    ("the other hand bracing against surface|hands on ground", "손으로 지지면 받치기", "손바닥을 바닥이나 단단한 면에 붙여 팔로 상체의 무게를 받칩니다. 소품을 들거나 허공에 손을 놓는 동작과 다릅니다."),
    ("resting chin on hands|chin rest|hand on chin|hand near chin", "손으로 턱 받치기", "손을 턱 아래나 가까이에 두어 고개를 받치거나 생각하는 듯한 작은 지지점을 만듭니다."),
    ("head resting on arms|resting head on crossed arms", "팔 위에 머리 기대기", "접거나 교차한 팔을 받침으로 삼아 머리의 무게를 내려놓고 상체의 긴장을 풉니다."),
    ("arm resting on knee", "무릎 위에 팔 받치기", "굽히거나 세운 무릎 위에 팔을 얹어 팔꿈치와 손의 안정적인 지지점을 만듭니다."),
    ("hands clasped|hands clasped together|clasped hands|hands together|praying pose", "두 손 모으기", "두 손을 맞대거나 깍지처럼 모아 가슴이나 얼굴 앞에 둡니다. 기도하는 자세나 수줍은 몸짓에 연결할 수 있습니다."),
    ("hands together near chest", "가슴 앞에서 두 손 모으기", "두 손을 가슴 가까이 모아 팔의 폭을 줄이고 인물의 중심에 작고 조심스러운 손짓을 만듭니다."),
    ("hands forming heart|heart hand pose|making a heart with hands|hands making heart", "손으로 하트 만들기", "양손의 손가락을 구부려 하나의 하트 윤곽이 이어지도록 모읍니다. 손에 하트 소품을 드는 것과는 다릅니다."),
    ("peace sign|v hand|double peace sign", "손가락 V 사인", "검지와 중지를 벌려 V자 모양을 만듭니다. 두 손을 쓰는 표현은 얼굴 양옆에 반복할 수 있습니다."),
    ("claw pose|rawr pose|paw pose|mimic bunny gesture", "동물 발 같은 손짓", "손가락을 접거나 손목을 안쪽으로 구부려 발톱이나 동물 앞발을 흉내 내는 장난스러운 손짓을 만듭니다."),
    ("hands up near head like bunny ears|fingers curled above head", "머리 위 토끼귀 손짓", "두 손을 머리 위나 양옆에 올리고 손가락을 접거나 세워 토끼 귀처럼 보이는 실루엣을 만듭니다."),
    ("arms up|arms raised|hands up|raising arm|one hand raised|hand up", "팔을 위로 들기", "어깨에서 팔을 들어 손이 머리나 어깨보다 높은 위치에 오게 하여 위로 뻗는 동작을 만듭니다."),
    ("arms outstretched|arms spread wide", "팔을 넓게 펼치기", "팔을 몸통에서 바깥쪽으로 벌려 양옆의 공간을 넓게 쓰고 열린 실루엣을 만듭니다."),
    ("reaching out|reaching towards viewer|hand reaching out|paws reaching out to viewer", "관객 쪽으로 손 뻗기", "팔과 손을 카메라를 향해 내밀어 가까운 손이 크게 보이고 몸까지 이어지는 앞뒤 원근을 만듭니다."),
    ("reaching out to stars", "별을 향해 손 뻗기", "손을 위쪽이나 멀리 있는 별을 향해 뻗어 손끝과 별 사이의 목표 방향을 연결합니다."),
    ("palm facing forward|palms out", "손바닥을 앞에 보이기", "손등 대신 손바닥 면이 카메라나 앞쪽을 향하게 하여 열린 손의 형태를 보여줍니다."),
    ("fingers slightly splayed", "손가락을 살짝 벌리기", "손가락 사이를 조금씩 벌려 손이 뭉쳐 보이지 않고 자연스럽게 펼쳐진 형태가 되게 합니다."),
    ("arms limp", "힘없이 늘어진 팔", "어깨와 팔꿈치의 힘을 풀어 팔이 몸 아래쪽으로 자연스럽게 처지게 합니다."),
    ("hand in pocket|one hand in pocket", "한 손을 주머니에", "손 하나를 의상 주머니 안에 넣어 한쪽 팔이 몸 가까이 고정되는 편안한 비대칭을 만듭니다."),
    ("hand on hip|one hand on hip|hands on hips", "허리에 손 얹기", "손바닥을 허리나 골반 옆에 대고 팔꿈치를 바깥으로 벌려 자신감 있는 몸의 윤곽을 만듭니다."),
    ("other hand behind head", "반대 손을 머리 뒤로", "다른 손을 머리 뒤쪽으로 올려 팔꿈치가 옆으로 열리고 어깨선에 비대칭이 생기게 합니다."),
    ("hands on cheeks|one hand on cheek|hand on own face", "볼에 손 대기", "손바닥이나 손가락을 볼에 대어 얼굴 가까이 작은 접촉과 표정의 프레임을 만듭니다."),
    ("hand near mouth|hand near lips|hands near mouth|hand to mouth|finger to mouth|touching lips|hand near face|hands near face|one hand raised near face", "입가나 얼굴 가까이 손", "손이나 손가락을 얼굴 가까이 올려 시선을 표정 쪽으로 모읍니다. 입을 완전히 가릴지는 다른 표현으로 정합니다."),
    ("hand covering mouth|holding mouth", "손으로 입 가리기", "손을 입 앞에 겹쳐 입 모양 일부를 가리고 놀람이나 수줍음 같은 반응을 손짓으로 보여줍니다."),
    ("hand near neck", "목 가까이에 손 두기", "손을 목선 주변으로 올려 얼굴과 칼라, 목 장식 쪽으로 시선을 이어줍니다."),
    ("hand shading eyes|hand at forehead|saluting", "이마 위로 손 올리기", "손을 이마나 눈 위쪽에 올려 햇빛을 가리거나 경례하는 듯한 또렷한 팔 각도를 만듭니다."),
    ("hand on hat|hand adjusting hat|holding hat brim|touching headwear", "모자에 손 대기", "손가락을 모자나 챙에 붙여 눌러 잡거나 위치를 고치는 동작을 만듭니다."),
    ("adjusting eyewear|hands on glasses", "안경 고쳐 쓰기", "손가락을 안경테나 다리에 대어 안경 위치를 올리거나 정리하는 섬세한 동작을 만듭니다."),
    ("one hand adjusting collar|adjusting tie", "칼라나 넥타이 정리", "손을 목 아래 의상에 대어 칼라나 넥타이를 당기고 정리하는 동작을 만듭니다."),
    ("lifting chin", "턱을 들어 올리기", "손으로 턱 아래를 받쳐 얼굴이 위쪽을 향하도록 하는 접촉 동작을 만듭니다."),
    ("hands on lap|hands between legs|hands on feet", "앉은 하체 가까이에 손", "앉은 자세에서 손을 무릎 위나 두 다리 사이, 발 가까이에 내려 상체와 하체의 연결을 만듭니다."),
    ("one hand lightly touching male arm or chest", "파트너의 팔이나 가슴에 손", "한 손으로 남성 파트너의 팔이나 가슴을 가볍게 짚어 두 인물 사이의 접촉 지점과 가까운 거리를 보여줍니다."),
    ("hands on shoulders", "어깨에 두 손 대기", "손을 어깨 위에 얹어 인물의 어깨선을 손으로 감싸거나 다른 인물과의 접촉을 만듭니다."),
    ("hands holding hood", "후드를 손으로 잡기", "손으로 후드의 양옆이나 가장자리를 잡아 머리 주변 천의 형태를 당기거나 정리합니다."),
    ("hand holding hair|one hand touching head|hands near head", "머리카락 가까이 손", "손을 머리 쪽으로 올려 머리카락을 잡거나 정리하는 동작과 얼굴 주변의 비대칭을 만듭니다."),
    ("gently holding veil", "베일을 가볍게 잡기", "얇은 베일 가장자리를 손끝으로 잡아 천이 당겨지는 방향과 얼굴 주변의 투명한 레이어를 보여줍니다."),
    ("cute open hand gesture next to cheek", "볼 옆의 열린 손", "볼 옆에 손바닥을 펴고 손가락을 가볍게 벌려 얼굴을 감싸는 귀여운 손짓을 만듭니다."),
    ("one hand making a peace sign or resting on a plushie", "V 사인 또는 인형 위의 손", "한 손으로 V 사인을 하거나 봉제인형 위에 손을 얹는 두 가지 원본 동작을 표현합니다."),
    ("one hand clasped near face", "얼굴 가까이 모은 한 손", "한 손을 가볍게 접거나 모아 얼굴 가까이에 두고 작은 긴장과 수줍은 인상을 만듭니다."),
    ("hiding lower face with envelope", "편지봉투로 얼굴 아래 가리기", "봉투를 입과 턱 앞에 들어 얼굴 아래쪽을 가리고 눈과 손으로 표정이 전달되게 합니다."),
    ("holding the massive glowing bouquet tightly to the chest", "큰 빛의 꽃다발을 가슴에 안기", "크고 발광하는 꽃다발을 양팔로 가슴 가까이 끌어안아 몸과 소품이 밀착된 형태를 만듭니다."),
    ("glittering clear umbrella with star decorations held overhead", "머리 위의 별 장식 투명 우산", "별 장식이 달린 반짝이는 투명 우산을 머리 위에 들어 우산과 얼굴, 손의 수직 관계를 보여줍니다."),
    ("bringing fruit to mouth|fork near lips", "음식을 입 가까이", "과일이나 포크를 입가로 가져가 먹기 직전의 거리와 손끝의 방향을 표현합니다."),
    ("talking on phone|phone to ear", "전화기를 귀에 대기", "전화기를 귀 가까이에 붙이고 손으로 지탱해 통화하는 행동이 읽히게 합니다."),
    ("speaking into megaphone", "확성기로 말하기", "확성기의 좁은 쪽을 입 가까이에 대고 넓은 입구는 바깥을 향하게 하여 소리치는 행동을 표현합니다."),
    ("aiming bow|drawing bow", "활시위를 당겨 조준하기", "한쪽 손은 활을 앞으로 지탱하고 다른 손은 얼굴 옆으로 시위를 당겨 목표 방향으로 긴장된 선을 만듭니다."),
    ("aiming forward", "앞쪽으로 조준하기", "손에 든 물건의 끝과 팔의 방향이 몸 앞쪽의 목표를 향하도록 맞춥니다."),
    ("presenting gift|offering food", "선물이나 음식을 내밀기", "소품을 몸 앞쪽으로 내밀어 상대나 관객에게 건네는 거리와 손의 방향을 만듭니다."),
    ("blowing bubbles", "비눗방울 불기", "입 가까이에 방울 도구를 대고 바깥으로 비눗방울이 생기게 하여 손과 입, 거품의 흐름을 연결합니다."),
    ("floating hands", "공중에 떠 있는 손", "손이 지지면에 닿지 않고 공중에 놓이게 하여 가볍거나 비현실적인 손의 위치를 만듭니다."),
    ("gun to head|pointing gun at own head", "머리 쪽을 향한 총의 방향", "소품 총의 총구가 인물의 머리 쪽을 향하도록 하는 방향 표현입니다. 발사나 부상은 지정하지 않습니다."),
    ("holding", "손으로 잡는 동작", "손가락을 대상 주변으로 모아 쥐는 동작을 지정합니다. 무엇을 잡을지는 별도의 소품 선택으로 정합니다."),
    ("hands on macaron", "마카롱에 손 짚기", "큰 마카롱 위에 손을 대어 앉은 몸의 지지점이나 디저트와의 접촉을 보여줍니다."),
    ("glowing heart in hands", "손 안의 빛나는 하트", "양손 사이에 발광하는 하트를 두어 손바닥과 소품의 빛이 얼굴이나 몸 쪽으로 이어지게 합니다."),
    ("hand on towel", "수건에 손 대기", "손을 수건에 붙여 잡거나 누르는 동작을 만들고 몸과 천의 접촉을 보여줍니다."),
]: register(tags, label, description)



register("fork in hand", "손에 쥔 포크", "포크의 손잡이를 손가락으로 감싸 쥐어 손과 식기가 연결된 상태를 보여줍니다.")
register("dynamic sitting on a massive ornate clock", "커다란 장식 시계에 앉기", "거대한 장식 시계를 엉덩이의 지지점으로 삼아 앉고 팔다리의 사선으로 역동적인 균형을 만듭니다.")
register("swinging", "그네를 타는 움직임", "그네나 매달린 지지점 위에서 몸이 앞뒤로 오가는 순간을 표현해 다리와 머리카락에 이동의 흐름을 더합니다.")
register("dynamic editorial pose", "역동적인 화보 자세", "어깨와 골반의 축을 달리하고 팔다리를 과감한 사선으로 배치해 의상과 몸의 선이 강조되는 화보 자세를 만듭니다.")
register("sitting at table", "탁자 앞에 앉기", "탁자 앞의 좌석에 앉아 몸통과 팔이 탁자 면에 가까이 오게 합니다. 탁자 위에 앉는 자세와 구분됩니다.")
register("flying", "하늘을 나는 몸", "지면의 지지 없이 몸이 공중을 이동하도록 하여 몸통과 팔다리가 진행 방향을 따르는 비행 자세를 만듭니다.")
register("eating", "음식을 먹는 순간", "손이나 식기, 음식이 입과 연결되는 행동을 보여주어 먹는 상황이 읽히게 합니다. 음식의 종류는 따로 고릅니다.")
register("rosary", "십자가가 달린 묵주", "구슬을 꿴 줄과 끝에 달린 십자가 장식입니다. 목에 걸거나 손에 들려 종교적인 의상과 기도 장면의 단서를 더합니다.")
register("norigae", "허리 아래로 늘어지는 노리개", "허리에 단 장식 매듭 아래로 구슬이나 패물, 긴 술이 늘어지는 한복 장식입니다. 허리선 아래에 세로로 흐르는 장식 포인트를 만듭니다.")
register("armillary sphere", "천체 궤도를 나타내는 천구의", "천체의 궤도를 나타내는 여러 금속 고리를 구형으로 겹친 모형입니다. 고리의 교차와 중심축으로 천문학적이거나 고전적인 마법 연구실의 단서를 더합니다.")
register("massive glowing bouquet of stars and light", "별과 빛으로 이루어진 거대한 발광 꽃다발", "꽃 대신 별과 빛이 모여 이루어진 커다란 발광 꽃다발을 배치합니다. 인물과 비교되는 큰 부피와 얼굴 주변을 밝히는 광원 역할을 함께 더합니다.")
register("surrounded by various sized teddy bears and cute plushies", "크기가 다른 곰 인형과 봉제인형에 둘러싸이기", "크기가 다른 곰 인형과 귀여운 봉제인형으로 인물 주변을 둘러싸 포근한 부피감과 인형 사이의 앞뒤 겹침을 만듭니다.")
register("waist pocket watch", "허리에서 늘어지는 회중시계", "허리나 벨트에서 체인으로 연결되어 늘어지는 작은 휴대 시계입니다. 둥근 시계 몸체와 가는 체인으로 클래식하거나 스팀펑크풍의 의상 디테일을 더합니다.")
register("beret", "둥글고 납작한 베레모", "챙 없이 둥글고 납작한 형태의 부드러운 모자입니다. 머리 위에 비스듬히 얹어 헤어라인과 한쪽으로 기울어진 모자 실루엣을 만듭니다.")
register("utility belt with spray cans", "스프레이 통을 끼운 수납 벨트", "허리 벨트의 수납칸이나 고리에 여러 스프레이 통을 끼운 장비입니다. 둥근 통의 반복과 기능적인 허리 장식으로 그래피티 작업의 단서를 더합니다.")
register("wrist cuffs", "손목을 감싸는 별도 커프스", "손목을 고리처럼 감싸는 별도의 장식 소매끝입니다. 소매와 분리해 착용하거나 장갑 끝에 겹쳐 손목의 경계와 볼륨을 더할 수 있습니다.")

register("hand near mouth|hand near lips", "입가 가까이에 둔 한 손", "한 손을 입술 가까이에 두어 손끝과 입가로 시선을 모읍니다. 입술에 닿는 접촉은 별도로 지정할 수 있습니다.")
register("hands near mouth", "입가 가까이에 모은 두 손", "두 손을 입 주변에 모아 얼굴 아래쪽을 감싸는 구도를 만듭니다. 두 손 사이의 간격과 손끝의 방향을 함께 보여줍니다.")
register("hands near face", "얼굴 가까이에 둔 두 손", "두 손을 얼굴 가까이에 올려 볼이나 턱 주변에 손의 윤곽이 함께 보이게 합니다.")
register("hand near face", "얼굴 가까이에 둔 한 손", "한 손을 볼이나 턱 가까이에 두어 얼굴과 손이 한곳에 모이는 작은 제스처를 만듭니다.")
register("one hand raised near face", "얼굴 옆으로 들어 올린 한 손", "한 손을 얼굴 높이까지 들어 올려 팔의 올라가는 선과 얼굴 옆의 손 모양이 함께 보이게 합니다.")
register("touching lips", "손끝으로 입술에 닿기", "손끝이 입술에 직접 닿도록 배치해 입술과 손가락의 접촉 지점을 또렷하게 보여줍니다.")
register("hand to mouth", "입가로 가져간 손", "한 손을 입 쪽으로 가져가 입가를 짚거나 가까이 대는 제스처를 만듭니다. 손과 입의 위치 관계를 강조합니다.")
register("finger to mouth", "입가로 가져간 손가락", "손가락 하나를 입가로 가져가 손가락 끝과 입술 사이의 작은 거리에 시선을 모읍니다.")

if __name__ == "__main__":
    build()
