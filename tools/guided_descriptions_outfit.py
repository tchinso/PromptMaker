"""Build Korean visual explanations for the guided outfit vocabulary.

Run with Python's standard library; the repository's JavaScript data is read
through Node so item identities always match the application. No machine
translation service, network access, or hand-maintained ID list is involved.
"""
from __future__ import annotations

import json
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "site" / "guided-descriptions-outfit.js"


def mapping(text: str) -> dict[str, str]:
    return dict(line.split("|", 1) for line in text.strip().splitlines() if line.strip())


# Full expressions whose construction or styling is more useful than a literal
# word-by-word translation. These descriptions explain what becomes visible.
DESCRIPTIONS = mapping("""
bear hood|곰 귀가 달린 후드가 머리를 감싸 둥글고 포근한 실루엣을 만듭니다.
fluffy hem|옷자락 끝에 폭신한 털이나 부드러운 볼륨을 더해 가장자리를 도톰하게 만듭니다.
frilled lace collar with ribbon bow|레이스 프릴 칼라 중앙에 리본을 묶어 목선을 섬세하게 장식합니다.
puff sleeves|어깨나 소매 중간이 둥글게 부푼 퍼프소매로 팔의 실루엣을 풍성하게 만듭니다.
layered puff sleeves|퍼프소매를 여러 겹 겹쳐 어깨와 팔 주변에 층이 보이게 합니다.
white clerical collar|검은 옷과 대비되는 흰 성직자 칼라로 목 둘레를 단정하게 감쌉니다.
pastel puff sleeves|연한 파스텔색 퍼프소매가 어깨 주변에 둥근 볼륨을 만듭니다.
fitted bodice|상의 몸판을 몸에 맞게 재단해 허리선과 봉제 구조를 또렷하게 보입니다.
midriff|상의와 하의 사이의 복부가 보이는 길이로 옷을 조합합니다.
visible stomach|옷 사이로 복부가 드러나도록 상의 길이와 하의 높이를 조절합니다.
modest coverage|옷이 몸을 충분히 덮는 형태로 목선과 옷자락의 노출을 줄입니다.
relaxed fit|몸에 달라붙지 않는 여유로운 품으로 자연스러운 천 주름을 남깁니다.
puffy sheer sleeves|속이 은은히 비치는 얇은 천을 부풀린 소매로 가벼운 볼륨을 만듭니다.
long sleeves|손목까지 내려오는 긴 소매로 팔의 세로선을 이어줍니다.
buckled corset|허리를 잡아주는 코르셋에 버클을 더해 잠금 구조를 강조합니다.
asymmetrical design|좌우의 길이와 재단을 다르게 해 비대칭 실루엣을 만듭니다.
sleeveless|소매를 없애 어깨에서 팔로 이어지는 선을 드러냅니다.
layered ruffles|러플을 여러 층 쌓아 옷 표면과 자락에 풍성한 굴곡을 만듭니다.
detached sleeves|몸판과 떨어진 별도 소매로 어깨와 팔 사이에 빈 공간을 만듭니다.
black and deep blue layered fabrics|검정과 짙은 파란 천을 겹쳐 어두운 색 사이의 층과 재질 차이를 드러냅니다.
sheer lace sleeves|레이스 무늬 사이가 은은히 비치는 얇은 소매로 팔을 감쌉니다.
monochrome checkerboard piping|옷의 봉제선에 흑백 체커보드 파이핑을 둘러 재단선을 또렷하게 만듭니다.
ribbon bow at collar|칼라 바로 아래에 리본을 묶어 목선 중앙에 포인트를 만듭니다.
central corset lace-up details|몸판 중앙을 가로지르는 코르셋 끈 묶음이 허리 구조를 강조합니다.
cross string ties on torso|상의 몸통에 끈을 교차시켜 묶어 사선이 반복되는 재단을 만듭니다.
detachable puffy balloon sleeves|몸판과 분리되는 풍선형 소매를 달아 팔 주변에 큰 볼륨을 만듭니다.
off-shoulder|목선을 넓게 내려 양쪽 어깨가 드러나는 오프숄더 재단을 만듭니다.
oversized sleeves|팔보다 넉넉한 소매 폭과 길이로 천이 접히고 늘어지는 모습을 만듭니다.
buttoned up|단추를 끝까지 채워 앞섶과 칼라를 단정하게 정리합니다.
striped sleeve|소매에 줄무늬를 넣어 팔을 따라 반복되는 선을 만듭니다.
puffy sleeves|둥글게 부풀린 소매로 어깨와 팔의 부피를 강조합니다.
upturned collar|칼라를 위로 세워 목 주변에 각진 윤곽을 만듭니다.
pink and black striped arm warmers|분홍과 검정 줄무늬 암워머로 팔을 감싸 배색과 반복 무늬를 더합니다.
corset details|코르셋의 절개선과 끈 장식을 더해 몸판의 구조를 강조합니다.
animal ear hood|동물 귀가 달린 후드로 머리 위에 종족을 연상시키는 실루엣을 만듭니다.
corset-style waist|허리 부분을 코르셋처럼 좁혀 상체와 치마 사이의 굴곡을 강조합니다.
lace-up detail|천 사이를 교차하는 끈을 달아 조여 묶는 구조를 보여줍니다.
petticoat|치마 안에 페티코트를 받쳐 밑단이 넓게 퍼지는 볼륨을 만듭니다.
sailor collar|등으로 넓게 펼쳐지는 세일러 칼라로 해군복이나 교복 같은 인상을 더합니다.
rolled sleeves|소매를 접어 올려 팔 일부와 접힌 천의 두께를 드러냅니다.
suspenders|어깨에서 허리로 내려오는 서스펜더로 상의 위에 세로선을 더합니다.
layered|서로 다른 옷을 겹쳐 입혀 칼라와 밑단 사이에 층이 보이게 합니다.
ruffled hem|치마나 상의 밑단에 러플을 달아 물결처럼 굽이치는 가장자리를 만듭니다.
corset|허리를 감싸는 코르셋으로 몸판의 절개선과 조여진 형태를 강조합니다.
flower lapel decoration|재킷 라펠에 꽃을 달아 가슴 가까이에 작은 장식 포인트를 만듭니다.
bare arms|팔을 가리는 소매나 장식을 줄여 팔의 선이 그대로 보이게 합니다.
heart-shaped bodice|상의 몸판이나 가슴 윗선을 하트 모양으로 재단해 곡선 중심의 형태를 만듭니다.
cross-lacing|끈을 X자로 교차해 묶어 옷 표면에 반복되는 사선을 만듭니다.
corset lacing|코르셋의 양쪽 천을 끈으로 연결해 조이는 구조를 드러냅니다.
waist bow|허리에 리본 매듭을 달아 상의와 하의가 만나는 지점을 강조합니다.
ruffled layers|러플이 달린 천을 여러 층 겹쳐 옷자락의 깊이와 부피를 늘립니다.
black corset|검은 코르셋으로 허리선을 잡고 주변의 밝은 천과 대비를 만듭니다.
ribbon collar|목 둘레에 리본을 두르거나 묶어 칼라의 선을 부드럽게 장식합니다.
velvet peaked lapel|벨벳 재킷에 뾰족하게 솟은 피크드 라펠을 달아 격식 있는 목선을 만듭니다.
mermaid silhouette|허리와 힙은 좁게 잡고 무릎 아래를 펼쳐 인어 꼬리 같은 드레스선을 만듭니다.
sweetheart neckline|가슴 윗선을 두 개의 둥근 곡선으로 재단해 하트 상단 같은 목선을 만듭니다.
long draping train|드레스 뒤쪽의 긴 천 자락이 바닥에 늘어져 흐르는 방향을 만듭니다.
oversized ribbon|큰 리본으로 옷의 일부를 덮어 멀리서도 보이는 장식 중심을 만듭니다.
short sleeves|위팔을 덮는 짧은 소매로 가볍고 활동적인 실루엣을 만듭니다.
pink piping|옷의 가장자리와 봉제선에 분홍 파이핑을 넣어 재단선을 강조합니다.
shimmering tulle bodice|얇은 튤을 겹친 몸판에 반짝임을 더해 가볍고 빛나는 표면을 만듭니다.
waist ribbon bow|허리 둘레의 리본을 매듭으로 묶어 허리선과 치마 볼륨을 연결합니다.
matching arm ruffles|본 의상과 색과 소재를 맞춘 팔 러플로 손목이나 위팔을 장식합니다.
ribbed arm warmers|세로 골이 있는 니트 암워머로 팔을 감싸 짜임의 방향을 드러냅니다.
puffy short sleeves|짧고 둥글게 부푼 소매로 어깨와 위팔에 작은 볼륨을 만듭니다.
peter pan collar|둥근 끝의 피터팬 칼라로 목 둘레를 작고 부드럽게 감쌉니다.
bare shoulders|어깨를 덮는 천을 줄여 쇄골과 어깨선이 보이게 합니다.
frilled lace collar|레이스 가장자리를 프릴로 잡아 목 둘레에 섬세한 굴곡을 만듭니다.
detached lace sleeves|몸판에서 분리된 레이스 소매로 어깨를 비우고 팔의 장식만 남깁니다.
striped arm warmers|줄무늬 암워머로 팔을 감싸 반복되는 패턴을 더합니다.
fluffy animal hood|폭신한 털과 동물 귀가 있는 후드로 머리 주변에 둥근 볼륨을 만듭니다.
hood up|후드를 머리에 올려 얼굴 둘레를 천으로 감쌉니다.
zipper closed|지퍼를 끝까지 닫아 앞섶이 붙어 있는 단정한 형태를 만듭니다.
black hood|검은 후드가 머리와 얼굴 주변에 짙은 외곽선을 만듭니다.
puffy detached sleeves|몸판과 분리된 퍼프소매로 어깨를 비우면서 팔에는 둥근 볼륨을 남깁니다.
lace-up|옷의 양쪽 가장자리를 교차하는 끈으로 연결해 묶는 구조를 만듭니다.
halterneck|끈이나 천이 목 뒤로 이어져 어깨가 드러나는 홀터넥 재단을 만듭니다.
frog closures|전통 중국식 매듭단추로 앞섶을 잠가 작은 매듭이 줄지어 보이게 합니다.
large waist bow|허리에 큼직한 리본을 묶어 허리선 주변을 장식의 중심으로 만듭니다.
backless|등 부분을 크게 비운 재단으로 뒷모습의 선과 옷의 가장자리를 강조합니다.
bare back|옷이 등을 덮지 않는 형태로 등선이 보이게 합니다.
off shoulder|목선을 어깨 아래로 내려 쇄골과 양쪽 어깨를 드러냅니다.
butterfly bodice|나비 날개처럼 펼쳐진 몸판으로 상체에 좌우 대칭의 장식선을 만듭니다.
cleavage|상의 중앙의 목선을 낮춰 가슴 사이로 이어지는 네크라인을 보입니다.
rabbit hood|긴 토끼 귀가 달린 후드로 머리 위에 길게 솟은 실루엣을 만듭니다.
keyhole neckline|목선 아래에 작은 열쇠구멍 모양의 컷아웃을 내어 재단 포인트를 만듭니다.
corset waist|허리 부분을 코르셋처럼 조여 몸판의 좁아지는 형태를 강조합니다.
lace-up corset|교차하는 끈으로 앞이나 뒤를 조이는 코르셋의 구조를 보여줍니다.
lace-up ribbons|가느다란 리본을 끈처럼 교차해 묶어 부드러운 레이스업 장식을 만듭니다.
rolled-up sleeves|소매 끝을 여러 번 접어 올려 팔과 접힌 천 주름을 드러냅니다.
puff sleeves with frills|둥근 퍼프소매 끝에 프릴을 달아 볼륨과 잔잔한 굴곡을 함께 만듭니다.
unzipped|지퍼를 열어 겉옷의 앞섶과 안에 입은 옷이 함께 보이게 합니다.
flipper sleeves|펭귄 지느러미처럼 넓고 납작한 소매로 팔의 외곽을 바꿉니다.
lace hem|옷자락 끝에 레이스를 달아 천의 가장자리에 작은 무늬를 더합니다.
pink ribbon lacing|분홍 리본을 교차해 묶어 몸판이나 소매에 부드러운 사선 장식을 만듭니다.
tied hem|상의 밑단을 묶어 매듭과 모이는 천 주름을 만들고 길이를 조절합니다.
black arm warmers|검은 암워머가 팔을 감싸 손과 소매 사이에 짙은 색면을 만듭니다.
layered chiffon|가벼운 시폰을 여러 겹 겹쳐 얇은 천 사이의 투명도와 흐름을 드러냅니다.
sleeves past wrists|소매가 손목을 지나 손등까지 내려와 긴 소매의 여유를 보여줍니다.
ribbon corset|리본을 묶는 구조가 있는 코르셋으로 허리선을 잡고 매듭을 장식합니다.
wide sleeves|폭이 넓은 소매가 팔 아래로 늘어져 부드러운 천의 흐름을 만듭니다.
chinese-style collar|목을 세워 감싸는 중국식 칼라로 전통적인 상의 목선을 만듭니다.
striped long sleeve underneath|바깥 옷 아래에 긴 줄무늬 소매를 받쳐 입어 팔에서 레이어가 보이게 합니다.
lace-up front|상의 앞면에 교차하는 끈을 배치해 중앙 잠금 구조를 강조합니다.
frilled hem|옷자락 끝에 잔 프릴을 달아 가장자리를 물결 모양으로 만듭니다.
trailing bell sleeves|손목으로 갈수록 넓어지는 긴 벨소매가 뒤로 늘어져 동작선을 이어줍니다.
cloud collar|구름처럼 둥글게 굽은 운견 형태의 칼라로 어깨와 가슴 윗부분을 장식합니다.
corset panel|상의 일부에 코르셋처럼 단단한 패널을 넣어 몸판의 절개 구조를 강조합니다.
frilled neckline|목선 가장자리에 프릴을 둘러 얼굴 아래에 작은 굴곡을 만듭니다.
lace collar|레이스 칼라가 목 둘레에 섬세한 무늬와 얇은 가장자리를 만듭니다.
pink inner collar|겉칼라 안쪽에 분홍색 천이 보이게 해 목선에 작은 배색을 더합니다.
wide sleeve|소매 폭을 넓혀 팔 주변에 여유로운 천과 주름을 만듭니다.
vines wrapped around body|덩굴이 몸과 의상 둘레를 감싸 유기적인 곡선을 만듭니다.
bunny ear hood|긴 토끼 귀가 달린 후드로 머리 위에 두 갈래의 세로선을 만듭니다.
zipper|옷의 잠금선에 지퍼 이빨과 손잡이가 보이도록 재단합니다.
striped sleeves|양쪽 소매에 줄무늬를 넣어 팔을 따라 반복되는 선을 만듭니다.
ribbon lace-up hood|후드 둘레에 리본을 교차해 꿰어 얼굴 주변에 매듭과 끈 장식을 만듭니다.
large pink waist ribbon|허리에 큰 분홍 리본을 달아 허리선에 밝고 풍성한 장식 중심을 만듭니다.
lace details|천 표면과 가장자리에 레이스 무늬를 남겨 작은 디테일을 풍부하게 만듭니다.
fluffy white fur trim|옷의 가장자리에 폭신한 흰 털을 둘러 밝고 도톰한 윤곽을 만듭니다.
soft plush texture|봉제인형 같은 짧고 부드러운 털 질감으로 옷 표면을 포근하게 만듭니다.
pastel lace trim|파스텔색 레이스를 옷 가장자리에 둘러 색 대비를 부드럽게 만듭니다.
ruffles|천을 넓게 굽혀 만든 러플로 표면과 밑단에 큰 물결 주름을 더합니다.
soft fabric|부드럽게 접히고 몸을 따라 흐르는 천으로 자연스러운 주름을 만듭니다.
lace and frills|레이스 무늬와 잘게 잡힌 프릴을 함께 써 옷 가장자리를 섬세하게 장식합니다.
white and light blue patterned fabric|흰색과 하늘색이 반복되는 무늬 천으로 옷의 배색과 표면 패턴을 만듭니다.
opaque fabric|속이 비치지 않는 불투명한 천으로 옷의 색면과 재단을 또렷하게 유지합니다.
no transparent window|투명하게 비우는 부분 없이 천이 이어지도록 해 컷아웃이나 비침을 줄입니다.
lace|얇은 망과 구멍 사이의 무늬가 보이는 레이스 재질로 옷을 장식합니다.
lace trim|옷자락이나 칼라 가장자리에 레이스를 덧대 섬세한 윤곽을 만듭니다.
airy fabric|가볍고 공기를 머금은 천이 몸에서 살짝 떠서 부드럽게 퍼지도록 합니다.
spandex fabric texture|신축성 있는 스판덱스의 매끈한 표면과 팽팽한 주름을 표현합니다.
white wrist frills|손목에 흰 프릴을 둘러 소매 끝과 손 사이에 밝은 장식을 만듭니다.
fur trim|옷의 가장자리에 털 장식을 덧대 표면의 두께와 포근함을 강조합니다.
distressed grunge texture|닳거나 거칠어진 천 표면으로 오래 입은 옷 같은 사용감을 더합니다.
holographic texture|보는 각도에 따라 무지갯빛이 달라지는 홀로그램 표면을 만듭니다.
frills|좁은 천을 촘촘히 주름 잡은 프릴로 옷 가장자리에 잔잔한 볼륨을 더합니다.
lace trims|소매와 옷자락 등 여러 가장자리에 레이스를 둘러 마감 디테일을 늘립니다.
lace trimmings|옷의 끝부분을 레이스 장식으로 마무리해 얇은 무늬가 보이게 합니다.
lace-trimmed ruffles|물결치는 러플의 끝에 레이스를 덧대 두 종류의 가장자리 장식을 겹칩니다.
intricate fabric textures|옷을 이루는 천의 짜임과 주름을 촘촘하게 표현해 재질 차이를 드러냅니다.
detailed lace overlay|기본 천 위에 정교한 레이스를 겹쳐 아래 색과 위 무늬가 함께 보이게 합니다.
ruffled trim|옷의 가장자리에 넓은 물결 주름을 달아 밑단의 흐름을 강조합니다.
wet|물에 젖은 천의 짙어진 색과 약한 광택, 달라붙는 주름을 표현합니다.
see-through|천 너머의 색이나 안쪽 레이어가 은은히 보이는 비침을 더합니다.
detailed urban texture|도시적인 옷차림과 어울리는 거친 표면이나 미세한 재질 정보를 더합니다.
cable knit|굵은 실을 땋은 듯한 케이블 무늬로 니트의 입체적인 짜임을 보여줍니다.
transparent balloons|투명 풍선의 얇은 막과 반사광을 표현해 뒤쪽 색이 비치게 합니다.
white fur trim|옷자락과 소매 끝에 흰 털을 달아 밝고 부드러운 가장자리를 만듭니다.
white feather trim|옷의 가장자리에 흰 깃털을 달아 가볍고 잔잔하게 퍼지는 윤곽을 만듭니다.
black feather trim|옷의 가장자리에 검은 깃털을 달아 어둡고 섬세한 실루엣을 만듭니다.
ribbed knit|세로 골이 반복되는 골지 니트로 몸과 소매를 따라 짜임의 방향을 드러냅니다.
lots of frills|프릴을 여러 곳에 풍부하게 달아 옷 전체의 볼륨과 장식 밀도를 높입니다.
red ruffled trim|붉은 러플을 가장자리에 달아 물결 주름과 선명한 색 대비를 더합니다.
sheer curtains|얇은 커튼 너머로 빛이 퍼지게 해 공간에 부드러운 비침을 만듭니다.
soft frills|부드럽게 접힌 프릴로 날카롭지 않은 작은 굴곡을 더합니다.
floral lace|꽃 모양이 이어지는 레이스로 옷 표면에 섬세한 식물 무늬를 만듭니다.
white lace trim|흰 레이스를 옷 가장자리에 둘러 밝고 가느다란 무늬 테두리를 만듭니다.
pink lace frill trim|분홍 레이스를 프릴로 잡아 가장자리에 색과 잔 주름을 함께 더합니다.
sheer fabric|얇은 천 너머로 안쪽 레이어와 빛이 은은히 보이게 합니다.
frilled trim|옷의 끝부분을 작은 프릴로 마무리해 부드러운 가장자리를 만듭니다.
ruffle trim|폭이 있는 러플을 옷 가장자리에 달아 물결치는 윤곽을 만듭니다.
holographic fabric|천 표면에 각도에 따라 바뀌는 무지갯빛 반사를 더합니다.
pink ribbon laces|분홍 리본을 조이는 끈으로 써 교차선과 매듭을 장식처럼 드러냅니다.
detailed clothes|단추와 봉제선, 천 주름을 자세히 남겨 옷의 구조가 읽히게 합니다.
detailed costume|의상의 절개선과 소재, 장식의 마감을 자세히 보여줍니다.
clothing cling|천이 몸의 굴곡을 따라 붙으며 생기는 팽팽한 주름을 표현합니다.
open clothes|겉옷의 앞섶을 열어 안에 입은 옷과 겹침 구조가 보이게 합니다.
bra|상의 안에 받쳐 입는 브래지어 형태의 이너를 의상 레이어에 더합니다.
panties|하의 안에 받쳐 입는 팬티 형태의 이너를 의상 구성에 더합니다.
virgin killer sweater|등과 옆선을 크게 비우고 목을 감싸는 니트로 열린 뒷면의 재단을 보여줍니다.
no black tips|끝부분에 검은 배색을 넣지 않아 기본 의상의 색이 끝까지 이어지게 합니다.
decorative details|옷의 단추와 작은 부착 장식을 세밀하게 더해 표면의 정보량을 늘립니다.
visible skirt and stockings|화면에 치마와 스타킹이 함께 보이게 해 하체 의상의 조합을 드러냅니다.
fallen glass slipper on stairs|계단 위에 벗겨진 유리 구두를 놓아 투명한 신발과 장면의 흔적을 보여줍니다.
one bare foot|한쪽 발만 맨발로 드러내 양쪽 발의 차이를 만듭니다.
one glass slipper|한쪽 발에만 투명한 유리 구두를 신겨 맨발 쪽과 비대칭을 만듭니다.
elaborate glass slipper on one foot|한쪽 발에 정교한 유리 구두를 신겨 투명한 재질과 세부 장식을 강조합니다.
wearing high thigh-high stockings on both legs|양쪽 다리에 허벅지 위까지 올라오는 긴 스타킹을 신겨 다리의 세로선을 이어줍니다.
huge detailed sneaker soles|운동화 밑창을 크게 보여 홈과 두께, 표면 무늬가 눈에 띄게 합니다.
barefoot|신발과 양말을 벗은 맨발로 발의 형태와 바닥에 닿는 자세를 드러냅니다.
bandaid on knee|무릎에 작은 반창고를 붙여 다리의 한 지점에 생활감 있는 표식을 더합니다.
clothing racks with garments|옷이 걸린 행거를 배치해 여러 의상의 실루엣과 천의 층을 배경에 만듭니다.
matching outfit|함께 등장하는 옷들의 색과 디자인을 맞춰 통일감 있는 조합을 만듭니다.
""")

PHRASES = mapping("""
relaxed fit|여유로운 핏
modest coverage|노출을 줄인 재단
visible stomach|보이는 복부
corset-style waist|코르셋형 허리
cross-lacing|교차 끈 묶음
peter pan collar|둥근 피터팬 칼라
frog closures|중국식 매듭단추
criss-cross patterned|교차선 무늬의
see-through|은은한 비침
white clerical collar|흰 성직자 칼라
chinese-style collar|중국식 칼라
trailing bell sleeves|길게 늘어진 벨소매
sleeves past wrists|손목 아래까지 오는 소매
magical girl|마법소녀풍
heart-themed|하트 테마의
candy-themed|사탕 테마의
hooded cape|후드가 달린 케이프
gothic lolita|고딕 로리타풍
sweet lolita|스위트 로리타풍
ghost bride|유령 신부풍
dress shirt|드레스 셔츠
off-shoulder|어깨가 드러나는
off shoulder|어깨가 드러나는
sailor collar|세일러 칼라
white and light blue|흰색과 하늘색
light blue and white|하늘색과 흰색
pink and light blue|분홍과 하늘색
pink and white|분홍과 흰색
black and white|흑백
pink and black|분홍과 검정
red and black|빨강과 검정
red and white|빨강과 흰색
navy and white|남색과 흰색
light blue|하늘색
dark purple|짙은 보라색
dark navy|짙은 남색
dark gray|짙은 회색
charcoal grey|짙은 차콜 회색
soft peachy|부드러운 복숭아색
pastel pink|파스텔 분홍색
double breasted|더블브레스트
double-breasted|더블브레스트
loose fit|품이 넉넉한
loose-fitting|품이 넉넉한
pastel-colored|파스텔색
pastel color|파스텔색
high-collar|높게 세운 칼라의
high-heeled|굽이 높은
high heels|하이힐
high thigh-high|허벅지 높이의
thigh-high stockings|허벅지까지 오는 스타킹
thigh-high socks|허벅지까지 오는 양말
thigh-highs|허벅지까지 오는 스타킹
thigh-high|허벅지까지 오는
knee-high|무릎 높이의
knee socks|니삭스
knee boots|무릎 높이의 부츠
leg warmers|레그워머
leg warmer|레그워머
arm warmers|암워머
leg wraps|다리 감개
garter belt|가터벨트
garter straps|가터 스트랩
garter strap|가터 스트랩
leg garter|다리 가터
mary jane shoes|메리제인 구두
mary janes|메리제인 구두
mary jane|메리제인 구두
combat boots|컴뱃 부츠
ballet pointe shoes|발레 토슈즈
ballet shoes|발레 슈즈
glass slipper|유리 구두
high-top sneakers|발목을 감싸는 운동화
formal shoes|정장 구두
platform footwear|두꺼운 통굽 신발
fishnet stockings|망사 스타킹
fishnet pantyhose|망사 팬티스타킹
fishnet tights|망사 타이즈
fishnet socks|망사 양말
sock suspenders|양말 고정용 서스펜더
short socks|짧은 양말
lace ankle socks|레이스 발목 양말
roller skates|롤러스케이트
pom pom|폼폼
pom poms|폼폼
polka dot|물방울무늬
paw print|동물 발바닥 무늬
cherry blossom|벚꽃
floral print|꽃무늬 프린트
floral pattern|꽃무늬
floral patterns|꽃무늬
floral appliques|꽃 모양 아플리케
rose-patterned|장미무늬
geometric pattern|기하학 무늬
chinese knots|중국식 매듭
safety pin|안전핀
safety pins|안전핀
name badge|이름 배지
anchor emblem|닻 문장
ribbon drawstring|리본 조임끈
pom pom drawstrings|폼폼이 달린 조임끈
candy-shaped|사탕 모양
candy wrappers|사탕 포장지
caramel drizzle|흘러내린 캐러멜
cross motifs|십자가 무늬
cross ornaments|십자가 장식
cross details|십자가 장식
heart motifs|하트 무늬
heart motif|하트 무늬
star motif|별 무늬
lace trim|레이스 테두리
lace-up|끈으로 여미는
cross-laced|교차 끈이 달린
lace-trimmed|레이스로 마감한
short sleeve|반소매
short-sleeved|반소매
long-sleeved|긴 소매의
puff sleeve|퍼프소매
puff-sleeve|퍼프소매
puffed-sleeve|퍼프소매
crop top|크롭 톱
crop tee|크롭 티셔츠
baby tee|짧고 몸에 붙는 티셔츠
t-shirt|티셔츠
t-shirts|티셔츠
sweater vest|니트 조끼
turtleneck sweater|터틀넥 스웨터
track jacket|트랙 재킷
bomber jacket|봄버 재킷
winter coat|겨울 코트
trench coat|트렌치코트
tactical vest|전술 조끼
utility vest|수납 포켓 조끼
tactical shorts|전술 반바지
cargo pants|카고 팬츠
parachute pants|낙하산형 와이드 팬츠
wide pants|와이드 팬츠
wide-leg pants|와이드 팬츠
wide sleeve|넓은 소매
denim overalls|데님 멜빵바지
denim mini skirt|데님 미니스커트
mini skirt|미니스커트
mini shorts|짧은 반바지
short shorts|아주 짧은 반바지
micro shorts|아주 짧은 반바지
button-down shirt|버튼다운 셔츠
china dress|치파오
qipao top|치파오 상의
modern hanbok|현대식 한복
japanese clothes|일본 전통복
one-piece swimsuit|원피스 수영복
bikini top|비키니 상의
bikini bottom|비키니 하의
bikini skirt|비키니 위에 겹친 치마
maid outfit|메이드 의상
maid dress|메이드 드레스
nurse dress|간호사 원피스
waitress uniform|웨이트리스 유니폼
postman uniform|우편 배달부 유니폼
conductor uniform|차장 유니폼
military uniform|군복
cheerleader uniform|치어리더 유니폼
school uniform|교복
idol stage outfit|아이돌 무대 의상
idol clothes|아이돌 의상
idol dress|아이돌 드레스
pastry chef apron|제과사 앞치마
apron dress|앞치마 원피스
pinafore dress|피나포어 원피스
wedding dress|웨딩드레스
slip dress|슬립 드레스
summer dress|여름 드레스
ball gown|볼가운
ballet tutu dress|발레 튀튀 드레스
cable knit|케이블 니트
ribbed knit|골지 니트
knit cardigan|니트 카디건
knitted capelet|니트 케이프렛
fur jacket|퍼 재킷
fur skirt|퍼 스커트
fairy dress|요정 드레스
armored|보호판을 덧댄
clear pvc|투명한 비닐 소재
paint-stained|물감이 묻은
paint stains|물감 자국
worn over|위에 겹쳐 입은
paired with a|함께 입는
wrapped around waist|허리에 묶은
worn off-shoulder|어깨 아래로 내려 걸친
over white lace shirt|흰 레이스 셔츠 위에 겹친
over shorts|반바지 위에 겹친
underneath|안에 받쳐 입은
inner white|안에 받쳐 입는 흰
inner black|안에 받쳐 입는 검은
inner top|이너 톱
all black|전체가 검은
white and frilled|흰 바탕에 프릴이 달린
""")

WORDS = mapping("""
plush|플러시
pads|보호 패드
midriff|복부가 보이는 길이
crystal|수정 같은
opaque|불투명한
buckled|버클이 달린
design|디자인
detached|몸판과 분리된
deep|짙은
spandex|스판덱스
central|중앙의
detachable|떼어낼 수 있는
balloon|풍선형
wrist|손목
buttoned|단추를 채운
upturned|위로 세운
animal|동물
grunge|그런지풍
petticoat|페티코트
rolled|접어 올린
suspenders|서스펜더
trimmings|가장자리 장식
lapel|라펠
arms|팔
lacing|끈 묶음
layers|겹
gradient|그라데이션
dark-colored|어두운색
piping|파이핑
shimmering|은은하게 반짝이는
tulle|튤
arm|팔
ribbed|골지
urban|도시적인
shoulders|어깨
balloons|풍선
zipper|지퍼
halterneck|홀터넥
feather|깃털
backless|등이 열린 재단
butterfly|나비
cleavage|가슴 중앙의 낮은 목선
heart-shaped|하트 모양
curtains|커튼
sailor|세일러풍
keyhole|열쇠구멍 모양
rolled-up|접어 올린
unzipped|지퍼를 연 상태
flipper|지느러미형
wide|폭이 넓은
front|앞면
panel|패널
laces|끈
white|흰색
black|검은색
pink|분홍색
blue|파란색
red|붉은색
yellow|노란색
purple|보라색
navy|남색
cream|크림색
beige|베이지색
brown|갈색
grey|회색
gray|회색
mint|민트색
gold|금색
pastel|파스텔색
rainbow|무지갯빛
dark|어두운색
light|가벼운
soft|부드러운
delicate|섬세한
cute|귀여운
elegant|우아한
simple|단순한
stylish|세련된
vintage|빈티지풍
victorian|빅토리아 시대풍
celestial|천체 테마의
halloween|핼러윈풍
gothic|고딕풍
lolita|로리타풍
steampunk|스팀펑크풍
jersey|저지 소재
summer|여름용
sleepwear|잠옷
loungewear|라운지웨어
uniform|유니폼
dress|드레스
clothes|옷
clothing|의상
costume|의상
outfit|의상
attire|의상
shirt|셔츠
tee|티셔츠
top|톱
blouse|블라우스
sweater|스웨터
turtleneck|터틀넥
vest|조끼
cardigan|카디건
hoodie|후디
jacket|재킷
coat|코트
blazer|블레이저
suit|정장
tailcoat|연미복
ballgown|볼가운
gown|긴 드레스
minidress|미니드레스
sundress|얇은 여름 원피스
skirt|스커트
miniskirt|미니스커트
tutu|튀튀
shorts|반바지
pants|바지
trousers|바지
slacks|슬랙스
jeans|청바지
overalls|멜빵바지
cape|케이프
capelet|짧은 케이프
shawl|숄
windbreaker|바람막이
sweatshirt|스웨트셔츠
camisole|캐미솔
bodysuit|보디수트
swimsuit|수영복
bikini|비키니
bra|브래지어
panties|팬티
apron|앞치마
hanbok|한복
jeogori|저고리
chima|치마
qipao|치파오
yukata|유카타
jinbei|진베이
oversized|품이 큰
versized|품이 큰
baggy|통이 넓은
loose|느슨한
fitted|몸에 맞춘
tailored|재단이 정돈된
crisp|빳빳한
cropped|길이가 짧은
crop|짧은
short|짧은
long|긴
low-rise|허리선이 낮은
voluminous|풍성한
fluffy|폭신한
airy|가볍게 부푼
flared|밑으로 퍼지는
a-line|A라인
asymmetrical|비대칭
layered|여러 겹으로 겹친
tiered|층층이 겹친
frilly|프릴이 풍성한
frilled|프릴이 달린
ruffled|물결 주름이 잡힌
ruffle|러플
frill|프릴
pleated|주름 잡힌
strapless|어깨끈 없는
strap|어깨끈
sleeveless|민소매
collared|칼라가 달린
unbuttoned|단추를 푼
open|열어 입은
closed|닫힌
zippered|지퍼가 달린
zipped|지퍼를 올린
up|끝까지
wet|젖은
cling|몸을 따라 붙는
distressed|닳고 해진
shiny|윤기 나는
smooth|매끈한
sparkly|반짝이는
iridescent|오색 광택의
holographic|홀로그램
transparent|투명한
translucent|반투명한
sheer|은은히 비치는
silk|실크
satin|새틴
linen|리넨
chiffon|시폰
lace|레이스
mesh|망사
fur|털 소재
denim|데님
knit|니트
fabric|천
fabrics|천
texture|질감
textures|질감
plaid|체크무늬
gingham|깅엄 체크무늬
argyle|아가일무늬
striped|줄무늬
stripes|줄무늬
vertical|세로
patterned|무늬가 있는
pattern|무늬
patterns|무늬
checkered|바둑판무늬
graphic|그래픽
print|프린트
floral|꽃무늬
heart|하트
star|별
rose|장미
dragon|용
strawberry|딸기
flower|꽃
leaf|잎사귀
peach|복숭아
chocolate|초콜릿
candy|사탕
starfish|불가사리
shell|조개
mechanical|기계 장치
medical|의료 표식
cross|십자가
metal|금속
pearl|진주
ribbon|리본
ribbons|리본
bow|리본 매듭
bows|리본 매듭
trim|가장자리 장식
trims|가장자리 장식
decoration|장식
decorations|장식
ornament|장식
ornaments|장식
motif|무늬
motifs|무늬
embroidery|자수
stitching|봉제선
details|세부 장식
detail|세부 장식
detailed|정교한
decorative|장식용
intricate|촘촘하고 정교한
patches|패치
sticker|스티커
buttons|단추
button|단추
pins|핀
pin|핀
pom-pom|폼폼
drawstrings|조임끈
patchwork|조각천 이어붙이기
spikes|스파이크 장식
sparkling|반짝이는
rope|밧줄
accents|포인트 장식
excessive|아주 많은
many|여러 개의
multiple|여러 개의
large|큰
small|작은
huge|아주 큰
lots|많은
of|
and|및
with|함께 더한
like|같은 모양의
on|위의
at|위치의
in|안의
the|
a|
over|위에 겹친
under|아래에 받친
underneath|안에 받쳐 입은
inner|안쪽의
partially|일부에 사용한
matching|색과 형태를 맞춘
modified|변형한
complex|복잡하게 조합한
chest|가슴 앞
back|등 뒤
waist|허리
ear|귀
hem|밑단
collar|칼라
neckline|목선
sleeves|소매
sleeve|소매
puffy|부푼
puff|퍼프
hood|후드
corset|코르셋
bodice|몸판
bustier|뷔스티에
racing|레이싱
maid|메이드
nurse|간호사
nun|수녀
ballerina|발레리나
ballet|발레
rabbit|토끼
bunny|토끼
cat|고양이
dog|강아지
bear|곰
penguin|펭귄
panda|판다
dinosaur|공룡
squirrel|다람쥐
shark|상어
wolf|늑대
frog|개구리
duck|오리
raccoon|너구리
fox|여우
kigurumi|동물 잠옷
boots|부츠
shoes|신발
footwear|신발
sneakers|운동화
sneaker|운동화
socks|양말
stockings|스타킹
pantyhose|팬티스타킹
tights|타이즈
leggings|레깅스
thighhighs|허벅지까지 오는 스타킹
thighhigh|허벅지까지 오는 스타킹
kneehighs|무릎 높이 양말
legwear|다리 의상
leg|다리
thigh|허벅지
high|높은
knee|무릎
warmers|워머
garter|가터
straps|스트랩
buckles|버클
platform|두꺼운 통굽
chunky|두툼한
fishnet|망사
fishnets|망사 스타킹
loafers|로퍼
pumps|펌프스
sandals|샌들
slippers|슬리퍼
slipper|구두
winged|날개가 달린
bat|박쥐 모양의
soles|밑창
ties|묶는 끈
tied|묶은
mismatched|좌우가 서로 다른
single|한쪽만 신은
one|한 개의
bare|드러난
torn|찢어진
colorful|알록달록한
rainbow|무지갯빛
frills|프릴
ruffles|러플
straps|스트랩
layer|겹
overlay|덧댄 얇은 천
""")

# Labels for opaque/idiomatic fashion terms and clauses that otherwise produce
# an unnatural adjective order. English source tags remain separately visible.
LABELS = mapping("""
cropped baby tee|짧고 몸에 붙는 베이비 티셔츠
pastel-colored loose fit hoodie|품이 넉넉한 파스텔색 후디
white lace thigh-high stockings|흰 레이스 허벅지 스타킹
white lace thighhighs|흰 레이스 허벅지 스타킹
floral garter|꽃 장식 가터
crystal ballet shoes|수정 같은 투명한 발레 슈즈
frilled lace collar with ribbon bow|리본으로 묶은 레이스 프릴 칼라
ribbon bow at collar|칼라의 리본 매듭
waist ribbon bow|허리의 리본 매듭
ribbon bow on chest|가슴 앞 리본 매듭
polka dot ribbon on ear|귀에 단 물방울무늬 리본
black mary jane shoes with cross ornaments|십자가 장식이 달린 검은 메리제인 구두
thigh garter straps with buckles|버클로 고정하는 허벅지 가터 스트랩
chunky sneakers with rainbow soles|무지갯빛 밑창의 두툼한 운동화
roller skates with bows|리본 장식이 달린 롤러스케이트
collared blouse with lace trim|레이스 테두리의 칼라 블라우스
puff sleeves with frills|프릴로 마감한 퍼프소매
pink chima|분홍 한복 치마
""") | mapping("""
steampunk attire: fitted puffed-sleeve blouse|스팀펑크풍의 몸에 맞는 퍼프소매 블라우스
layered frill skirt with cross motifs and lace trim|십자가 무늬와 레이스 테두리를 더한 겹프릴 스커트
cropped black tactical shorts with straps|스트랩이 달린 검은 전술 쇼츠
denim overalls with paint stains|물감 자국이 있는 데님 멜빵바지
clear pvc jacket with rainbow trim|무지갯빛 테두리의 투명 비닐 재킷
ruffled bikini with sheer overlay|얇은 시어 레이어를 덧댄 러플 비키니
worn over dark loose-fitting shirt|품이 넉넉한 어두운 셔츠 위에 겹쳐 입기
layered t-shirt over shorts|반바지 위로 겹쳐 내려오는 티셔츠
partially silk shirt|일부에 실크를 사용한 셔츠
soft peachy chiffon top with ruffle details|러플이 달린 부드러운 복숭아색 시폰 톱
tiered skirt with small peach and leaf embroidery|작은 복숭아와 잎사귀 자수를 넣은 층층 스커트
light blue vertical striped puff-sleeve top with lace trim|레이스 테두리의 하늘색 세로줄 퍼프소매 톱
paired with a white skirt|흰 스커트를 함께 입기
yellow plaid bustier top over white lace shirt|흰 레이스 셔츠 위에 겹친 노란 체크 뷔스티에
blue denim mini skirt with white ribbon trim|흰 리본 테두리의 파란 데님 미니스커트
loose yellow jacket worn off-shoulder|어깨 아래로 느슨하게 걸친 노란 재킷
white frilled dress underneath|안에 받쳐 입은 흰 프릴 드레스
striped crop top underneath|안에 받쳐 입은 줄무늬 크롭 톱
pink crop top underneath|안에 받쳐 입은 분홍 크롭 톱
black turtleneck underneath|안에 받쳐 입은 검은 터틀넥
black crop top underneath|안에 받쳐 입은 검은 크롭 톱
star pins on blazer|블레이저에 단 별 모양 핀
virgin killer sweater|등과 옆선이 열린 터틀넥 니트
clothing cling|몸의 선을 따라 붙는 천
wet clothes|젖은 옷
open clothes|앞섶을 열어 입은 옷
bra|브래지어 이너
panties|팬티 이너
clothing racks with garments|옷이 걸린 행거
fluffy airy pancake tutu|가볍고 넓게 퍼지는 원반형 튀튀
low-rise parachute pants|허리선이 낮은 낙하산형 와이드 팬츠
white china dress|흰 치파오
dark suspender skirt|서스펜더가 달린 어두운 스커트
strap dress|어깨끈 드레스
white tank top|흰 탱크톱
visible skirt and stockings|치마와 스타킹이 함께 보임
fallen glass slipper on stairs|계단에 벗겨진 유리 구두
one bare foot|한쪽 맨발
one glass slipper|한쪽 유리 구두
elaborate glass slipper on one foot|한쪽 발에 신은 정교한 유리 구두
wearing high thigh-high stockings on both legs|양쪽 다리의 긴 허벅지 스타킹
huge detailed sneaker soles|크고 정교한 운동화 밑창
ballet pointe shoes with ribbon ties|리본으로 묶은 발레 토슈즈
bandaid on knee|무릎의 반창고
barefoot|맨발
leg warmers|레그워머
legwear|다리 의상
no black tips|끝부분의 검은 배색 제외
lots of pink ribbons|풍부한 분홍 리본
many tied bows|여러 개 묶은 리본 매듭
polka dot ribbon on ear|귀에 단 물방울무늬 리본
chocolate and candy decorations|초콜릿과 사탕 장식
ribbon like candy wrappers|사탕 포장지 같은 리본
heart name badge|하트 모양 이름 배지
heart-shaped bodice|하트 모양 몸판
cross string ties on torso|몸판의 교차 끈
monochrome checkerboard piping|흑백 체커보드 파이핑
long draping train|바닥에 길게 흐르는 드레스 자락
velvet peaked lapel|벨벳 피크드 라펠
sweetheart neckline|하트 곡선의 스위트하트 목선
mermaid silhouette|무릎 아래가 퍼지는 머메이드 실루엣
cloud collar|구름 곡선의 운견 칼라
no transparent window|투명하게 비운 부분 없이
vines wrapped around body|몸을 감싸는 덩굴
striped long sleeve underneath|안에 받쳐 입은 긴 줄무늬 소매
""")


def extract_items() -> list[dict]:
    node = shutil.which("node")
    if not node:
        raise SystemExit("Node is required to read the repository's JavaScript vocabulary.")
    script = r"""
const fs = require('node:fs'), vm = require('node:vm');
const context = vm.createContext({ window: {} });
for (const file of ['data', 'corpus-library', 'freedom-data', 'guided-corpus']) {
  vm.runInContext(fs.readFileSync('site/' + file + '.js', 'utf8'), context);
}
const items = context.window.PM_GUIDED_CORPUS.items.filter(item => item.stageId === 'outfit');
fs.writeFileSync(process.argv[1], JSON.stringify(items), 'utf8');
"""
    with tempfile.TemporaryDirectory(prefix="promptmaker-outfit-") as directory:
        path = Path(directory) / "items.json"
        subprocess.run([node, "-e", script, str(path)], cwd=ROOT, check=True, capture_output=True, text=True)
        return json.loads(path.read_text(encoding="utf-8"))


LEXICON = {**WORDS, **PHRASES}
PHRASE_PATTERN = re.compile(r"(?<![a-z-])(" + "|".join(
    re.escape(key) for key in sorted(LEXICON, key=lambda key: (-len(key), key))
) + r")(?![a-z-])")

ANIMAL_FEATURES = {
    "rabbit": "길게 솟은 토끼 귀", "cat": "뾰족한 고양이 귀",
    "dog": "강아지 귀와 주둥이", "bear": "둥근 곰 귀",
    "penguin": "펭귄의 둥근 머리와 부리", "panda": "판다의 둥근 귀와 검은 눈 무늬",
    "dinosaur": "공룡 머리와 작은 돌기", "squirrel": "작은 다람쥐 귀",
    "shark": "상어 입과 지느러미", "wolf": "뾰족한 늑대 귀",
    "frog": "위로 솟은 개구리 눈", "duck": "넓적한 오리 부리",
    "raccoon": "너구리의 귀와 눈 주변 무늬", "fox": "길고 뾰족한 여우 귀",
}


def translated_label(tag: str) -> str:
    key = tag.lower()
    if key in LABELS:
        return LABELS[key]
    if key.endswith(" hood up"):
        animal = key.removesuffix(" hood up")
        if animal in WORDS:
            return f"머리에 쓴 {WORDS[animal]} 후드"
    label = PHRASE_PATTERN.sub(lambda match: LEXICON[match.group(1)], key)
    label = re.sub(r"\s+", " ", label).strip(" :,")
    label = label.replace("리본 리본 매듭", "리본 매듭").replace("두툼한 두꺼운 통굽", "두툼한 통굽")
    # A source spelling or newly added phrase must never silently leave an
    # English-only explanation behind; expand the glossary before rebuilding.
    remaining = re.findall(r"[a-z]+(?:-[a-z]+)*", label)
    if remaining:
        raise ValueError(f"Missing Korean vocabulary for {tag!r}: {remaining}")
    return label


def object_particle(text: str) -> str:
    char = text[-1]
    if "가" <= char <= "힣":
        return "을" if (ord(char) - ord("가")) % 28 else "를"
    return "을"


def description(item: dict, label: str) -> str:
    tag = item["tag"].lower()
    if tag in DESCRIPTIONS:
        return DESCRIPTIONS[tag]
    extra = {
        "wet clothes": "젖은 옷의 색이 짙어지고 천이 몸의 선을 따라 붙으며 생기는 주름과 광택을 표현합니다.",
        "heart-themed clothing": "하트 모양의 재단이나 무늬, 장식을 의상 전체에 반복해 같은 테마로 묶습니다.",
        "summer outfit": "가벼운 천과 짧은 소매를 중심으로 더운 계절에 어울리는 옷차림을 만듭니다.",
        "light clothing": "얇고 무게감이 적은 옷으로 천이 가볍게 접히고 움직이는 모습을 만듭니다.",
        "pastel clothing": "연하고 부드러운 파스텔색 옷으로 옷차림의 색 대비를 낮춥니다.",
        "pastel clothes": "파스텔색을 중심으로 옷을 조합해 밝고 부드러운 색면을 만듭니다.",
        "pastel color clothes": "의상 전체를 연한 파스텔 배색으로 맞춰 은은한 색 차이를 만듭니다.",
        "sleepwear": "잠옷의 느슨한 품과 부드러운 천 주름으로 편안한 실내 옷차림을 만듭니다.",
        "loungewear": "품이 여유롭고 부드러운 라운지웨어로 집에서 쉬는 듯한 옷차림을 만듭니다.",
        "magical girl outfit": "마법소녀풍의 장식적인 상하의와 리본, 변신 의상 같은 실루엣을 만듭니다.",
        "pink chima": "분홍 한복 치마가 허리 아래로 넓게 퍼지게 해 풍성한 자락과 주름을 만듭니다.",
        "steampunk attire: fitted puffed-sleeve blouse": "몸판은 꼭 맞고 소매는 부푼 블라우스로 스팀펑크풍의 단정하고 장식적인 상체선을 만듭니다.",
        "light blue vertical striped puff-sleeve top with lace trim": "하늘색 세로줄 톱에 퍼프소매와 레이스 테두리를 더해 부푼 소매와 가는 무늬를 함께 보입니다.",
        "yellow plaid bustier top over white lace shirt": "흰 레이스 셔츠 위에 노란 체크 뷔스티에를 겹쳐 칼라와 소매, 짧은 몸판의 층을 보입니다.",
        "complex denim and lace outfit": "두꺼운 데님과 얇은 레이스를 복잡하게 겹쳐 천의 질감과 투명도 차이를 강조합니다.",
        "cross-laced clothes": "옷 앞면이나 옆선을 교차하는 끈으로 연결해 묶는 구조가 보이게 합니다.",
        "bunny hooded cape": "긴 토끼 귀가 달린 케이프로 머리와 어깨를 감싸 아래로 펼쳐지는 자락을 만듭니다.",
        "white tank top": "흰 탱크톱의 민소매와 간결한 몸판으로 가벼운 상체 실루엣을 만듭니다.",
    }
    if tag in extra:
        return extra[tag]
    if tag.endswith(" hood up"):
        animal = tag.removesuffix(" hood up")
        return f"{WORDS[animal]} 후드를 머리에 올려 얼굴 주위에 {ANIMAL_FEATURES[animal]}의 형상이 보이게 합니다."
    if "kigurumi" in tag:
        animal = tag.removesuffix(" kigurumi")
        return f"넉넉한 {WORDS[animal]} 잠옷에 {ANIMAL_FEATURES[animal]} 형상의 후드를 더해 동물 같은 실루엣을 만듭니다."
    subject = label + object_particle(label)
    if item["facet"] == "legwear":
        # Define unfamiliar shoe heads for every color/material variant, rather
        # than merely saying that the selected shoe will be visible.
        if "mary jane" in tag:
            return f"{subject} 신겨 낮게 파인 구두 위로 발등을 가로지르는 스트랩이 보이게 합니다."
        if "loafer" in tag:
            return f"{subject} 신겨 끈 없이 발을 넣는 낮은 구두의 넓은 발등과 얕은 입구를 보여줍니다."
        if "pumps" in tag:
            return f"{subject} 신겨 발등이 깊게 파이고 뒤꿈치에 굽이 있는 구두의 선을 강조합니다."
        if "combat boots" in tag:
            return f"{subject} 신겨 높은 발목과 앞쪽의 끈, 두꺼운 밑창이 있는 군화형 실루엣을 만듭니다."
        if "pointe" in tag:
            return f"{subject} 신겨 발끝을 받치는 단단한 앞코와 발목을 감아 묶는 리본을 보여줍니다."
        if "sandals" in tag:
            return f"{subject} 신겨 발가락과 발등이 드러나고 끈으로 발을 고정하는 열린 신발 형태를 보여줍니다."
        if "high-top" in tag:
            return f"{subject} 신겨 운동화의 발목 부분이 위로 올라와 발을 감싸는 모습을 보여줍니다."
        if "roller skates" in tag:
            return f"{subject} 신겨 신발 아래의 작은 바퀴와 발목을 잡는 부츠 구조를 보여줍니다."
        if "slippers" in tag:
            return f"{subject} 신겨 뒤꿈치가 열려 있고 발을 가볍게 끼우는 실내화 형태를 보여줍니다."
        if "mismatched" in tag:
            effect = "양쪽 다리의 색이나 무늬를 달리해 비대칭을 만듭니다"
        elif "platform" in tag:
            effect = "두꺼운 밑창으로 발끝에 무게감과 높이를 더합니다"
        elif "fishnet" in tag:
            effect = "그물 모양의 망사 무늬가 다리를 따라 보이게 합니다"
        elif "garter" in tag or "straps" in tag or "suspenders" in tag:
            effect = "다리 둘레의 끈과 잠금 구조를 드러냅니다"
        elif "leg warmer" in tag:
            effect = "종아리 주변에 접히는 천과 도톰한 볼륨을 만듭니다"
        elif "thigh" in tag:
            effect = "허벅지까지 이어지는 긴 다리 의상선을 만듭니다"
        elif "socks" in tag or "kneehighs" in tag:
            effect = "발과 종아리에 양말의 길이와 무늬가 보이게 합니다"
        elif any(word in tag for word in ["tights", "pantyhose", "stockings", "leggings"]):
            effect = "다리를 따라 이어지는 색면과 표면 무늬를 만듭니다"
        elif "boots" in tag:
            effect = "발목이나 종아리를 감싸는 신발의 높이와 재단을 보여줍니다"
        elif "ballet" in tag:
            effect = "발끝의 가는 형태와 발레화의 끈 구조를 강조합니다"
        elif "ribbon" in tag or "bows" in tag or "pom pom" in tag:
            effect = "발끝의 매듭 장식과 신발 실루엣을 함께 보여줍니다"
        elif "winged" in tag:
            effect = "신발 옆으로 작은 날개 장식이 펼쳐지게 합니다"
        else:
            effect = "발끝에서 색과 신발 형태가 읽히게 합니다"
        return f"{subject} 더해 {effect}."
    if item["facet"] == "motif":
        if "embroidery" in tag:
            effect = "실로 수놓은 무늬가 천 표면에 도드라지게 합니다"
        elif any(word in tag for word in ["pattern", "print", "stripes", "motif"]):
            effect = "반복 무늬가 옷의 색면 위에서 읽히게 합니다"
        elif "button" in tag:
            effect = "앞섶이나 장식선에 작은 잠금 포인트를 만듭니다"
        elif "patch" in tag:
            effect = "옷 위에 덧붙인 표식과 천의 층을 보여줍니다"
        elif "trim" in tag:
            effect = "옷의 가장자리에 색과 장식선을 둘러줍니다"
        elif "ribbon" in tag or "bow" in tag:
            effect = "매듭과 늘어진 끈이 보이는 장식 포인트를 만듭니다"
        elif "pin" in tag or "badge" in tag:
            effect = "옷 위에 부착한 작은 금속 장식이나 표식을 드러냅니다"
        elif "pom" in tag or "fur" in tag:
            effect = "옷 표면에 폭신한 부착 장식의 볼륨을 더합니다"
        elif "stitching" in tag:
            effect = "천을 이어 붙인 봉제선이 선명하게 보이게 합니다"
        else:
            effect = "옷의 표면에 해당 모양의 부착 장식이 보이게 합니다"
        return f"{subject} 더해 {effect}."
    if item["facet"] == "outfit-base":
        # Common garment heads carry a plain-language definition across their
        # many colors and finishes. The label retains each precise modifier.
        if "minidress" in tag:
            return f"{subject} 입혀 치맛단이 허벅지 위에서 끝나는 짧은 원피스의 길이를 보여줍니다."
        if "miniskirt" in tag or "mini skirt" in tag:
            return f"{subject} 입혀 허벅지 위에서 끝나는 짧은 치맛단과 드러난 다리의 비율을 보여줍니다."
        if "pinafore" in tag:
            return f"{subject} 입혀 소매 없는 원피스의 어깨끈과 안에 받쳐 입은 셔츠가 함께 보이게 합니다."
        if "slip dress" in tag:
            return f"{subject} 입혀 가는 어깨끈과 몸을 따라 곧게 흐르는 얇은 원피스의 선을 보여줍니다."
        if "sundress" in tag:
            return f"{subject} 입혀 가벼운 천과 넓은 목선, 여름용 원피스의 산뜻한 자락을 보여줍니다."
        if "tailcoat" in tag:
            return f"{subject} 입혀 앞은 짧고 뒤 자락은 길게 두 갈래로 갈라지는 연미복 재단을 보여줍니다."
        if "ballgown" in tag:
            return f"{subject} 입혀 몸에 맞는 상체 아래로 무도회용 긴 치마가 넓게 펼쳐지게 합니다."
        if "tutu" in tag:
            return f"{subject} 입혀 얇은 망사 천을 겹친 발레 치마가 허리 아래에서 가볍게 퍼지게 합니다."
        if "china dress" in tag or "qipao" in tag:
            return f"{subject} 입혀 목을 세운 칼라와 비스듬한 여밈이 있는 중국식 옷의 재단을 보여줍니다."
        if "hanbok" in tag:
            return f"{subject} 입혀 짧은 저고리와 넓게 퍼지는 치마가 만나는 한국 전통복의 비율을 보여줍니다."
        if "jeogori" in tag:
            return f"{subject} 입혀 목의 깃과 겹쳐 여미는 앞섶, 가슴의 고름이 있는 짧은 상의를 보여줍니다."
        if "jinbei" in tag:
            return f"{subject} 입혀 옆을 끈으로 묶는 짧은 상의와 반바지가 한 벌인 일본식 여름옷을 보여줍니다."
        if "yukata" in tag:
            return f"{subject} 입혀 넓은 소매와 겹친 앞섶을 허리띠로 고정한 가벼운 일본식 여름옷을 보여줍니다."
        if "capelet" in tag:
            return f"{subject} 둘러 어깨만 짧게 덮고 팔은 자유롭게 드러나는 작은 망토 형태를 보여줍니다."
        if "bustier" in tag:
            return f"{subject} 겹쳐 입혀 어깨끈이 가늘거나 없는 짧은 몸판이 가슴과 허리를 잡아주게 합니다."
        if any(word in tag for word in ["underneath", "inner ", "worn over", "over shorts", "layered", "paired with"]):
            effect = "안팎의 옷과 서로 다른 길이의 밑단이 함께 보이게 합니다"
        elif "open" in tag or "unbuttoned" in tag:
            effect = "열린 앞섶과 안쪽 레이어가 보이게 합니다"
        elif "off-shoulder" in tag:
            effect = "낮게 내려온 목선과 드러난 어깨를 보여줍니다"
        elif "sleeveless" in tag:
            effect = "소매가 없는 어깨선과 상체 재단을 보여줍니다"
        elif "oversized" in tag or "versized" in tag or "baggy" in tag or "loose" in tag:
            effect = "넉넉한 품에서 생기는 큰 천 주름과 여유로운 실루엣을 만듭니다"
        elif "frill" in tag or "ruffl" in tag:
            effect = "물결치는 가장자리와 풍성한 천 주름을 보여줍니다"
        elif "pleated" in tag:
            effect = "규칙적인 주름이 자락을 따라 이어지게 합니다"
        elif "tiered" in tag:
            effect = "서로 다른 높이의 치맛단이 층층이 보이게 합니다"
        elif "crop" in tag:
            effect = "짧은 상의 길이와 허리선의 간격을 강조합니다"
        elif any(word in tag for word in ["sheer", "translucent", "transparent"]):
            effect = "얇은 겉천과 그 너머의 안쪽 레이어가 함께 보이게 합니다"
        elif any(word in tag for word in ["uniform", "maid", "nurse", "idol", "apron", "conductor"]):
            effect = "해당 역할을 떠올리게 하는 의상의 재단과 구성품을 보여줍니다"
        elif re.search(r"\bsuit\b", tag) or "blazer" in tag:
            effect = "라펠과 몸판의 정돈된 재단선을 강조합니다"
        elif any(word in tag for word in ["yukata", "qipao", "hanbok", "jeogori", "chima", "jinbei", "japanese"]):
            effect = "전통 의상의 목선과 여밈, 자락의 형태를 보여줍니다"
        elif any(word in tag for word in ["knit", "sweater", "cardigan"]):
            effect = "포근한 짜임과 접힌 소매의 두께를 드러냅니다"
        elif "skirt" in tag or "dress" in tag or "tutu" in tag or "gown" in tag:
            effect = "허리에서 이어지는 치맛자락의 길이와 퍼짐을 보여줍니다"
        elif any(word in tag for word in ["pants", "shorts", "trousers", "slacks", "jeans"]):
            effect = "허리선과 다리를 따라 내려오는 하의의 통을 보여줍니다"
        elif "hoodie" in tag:
            effect = "후드와 소매가 만드는 편안한 실루엣을 보여줍니다"
        elif any(word in tag for word in ["jacket", "coat", "windbreaker"]):
            effect = "앞섶과 소매, 겉옷 자락의 형태를 보여줍니다"
        elif "swimsuit" in tag or "bodysuit" in tag:
            effect = "상체에서 하체로 이어지는 한 벌 재단과 몸에 맞는 선을 보여줍니다"
        elif "bikini" in tag:
            effect = "분리된 수영복의 끈과 작은 몸판이 만드는 실루엣을 보여줍니다"
        elif "camisole" in tag:
            effect = "가는 어깨끈과 얇은 몸판이 만드는 가벼운 실루엣을 보여줍니다"
        elif "turtleneck" in tag:
            effect = "목을 높게 감싸는 칼라와 상체의 세로선을 보여줍니다"
        elif "overalls" in tag:
            effect = "어깨에서 내려오는 멜빵과 가슴 앞의 큰 덧판을 보여줍니다"
        elif "cape" in tag or "shawl" in tag:
            effect = "어깨에서 아래로 퍼지는 겉천의 흐름과 가장자리를 보여줍니다"
        elif "vest" in tag:
            effect = "소매 없는 몸판과 안에 받쳐 입은 상의 사이의 층을 보여줍니다"
        elif "shirt" in tag or "tee" in tag:
            if "strip" in tag or "gingham" in tag or "graphic" in tag or "print" in tag:
                effect = "상의의 넓은 몸판 위에 반복 무늬나 프린트가 보이게 합니다"
            elif "silk" in tag:
                effect = "실크의 매끄러운 반사와 칼라 아래로 흐르는 천 주름을 보여줍니다"
            elif "linen" in tag:
                effect = "리넨의 가는 짜임과 자연스럽게 구겨지는 주름을 보여줍니다"
            elif "collar" in tag or "dress shirt" in tag:
                effect = "접힌 칼라와 앞단추 선으로 단정한 상체 재단을 보여줍니다"
            elif "short" in tag:
                effect = "짧은 소매와 단정한 몸판으로 위팔이 드러나는 길이를 만듭니다"
            else:
                effect = "목선에서 소매와 밑단으로 이어지는 셔츠의 형태를 보여줍니다"
        elif "blouse" in tag:
            effect = "부드러운 몸판 주름과 칼라, 소매의 볼륨이 보이게 합니다"
        elif "top" in tag:
            effect = "상의 몸판의 색과 무늬, 허리에서 끝나는 길이가 보이게 합니다"
        else:
            raise ValueError(f"Missing garment-specific visual effect: {tag}")
        return f"{subject} 의상에 적용해 {effect}."
    # All construction/fabric phrases are deliberately curated above; a new
    # source expression must receive a visual explanation before publication.
    raise ValueError(f"Missing curated {item['facet']} description: {tag}")


def build() -> None:
    items = extract_items()
    output: dict[str, dict[str, str]] = {}
    for item in items:
        label = translated_label(item["tag"])
        explanation = description(item, label)
        assert re.search(r"[가-힣]", explanation), item["tag"]
        assert not re.search(r"[a-z]{2,}", explanation, re.I), (item["tag"], explanation)
        assert explanation.endswith("."), item["tag"]
        output[item["id"]] = {"label": label, "description": explanation}
    assert len(output) == len(items), "Duplicate guided outfit IDs"
    text = '(function () {\n  "use strict";\n  // Generated by tools/guided_descriptions_outfit.py.\n  Object.assign(window.PM_GUIDED_DESCRIPTIONS ||= {}, '
    text += json.dumps(output, ensure_ascii=False, indent=2)
    text += ');\n})();\n'
    TARGET.write_text(text, encoding="utf-8", newline="\n")
    print(f"Wrote {len(output)} Korean outfit descriptions to {TARGET.name}; untranslated=0, missing=0.")


if __name__ == "__main__":
    build()
