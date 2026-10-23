"""Build Korean visual explanations for the four world/character guided steps.

The source expressions remain untouched. Exact definitions explain techniques
and interactions; compositional entries retain each expression's colors,
materials, objects and spatial relationships. No network or third-party modules.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STAGES = {"scene", "character", "concept", "mood"}
EXACT: dict[str, tuple[str, str]] = {}


def definitions(rows: str) -> None:
    for row in rows.strip().splitlines():
        if row.strip():
            tag, label, description = row.split("|", 2)
            EXACT[tag.lower()] = (label, description)


definitions("""
solo|인물 한 명|다른 인물 없이 한 캐릭터만 그려 외형과 자세에 시선을 모읍니다.
solo focus|한 인물에 집중|다른 요소보다 주인공 한 명이 중심에 오도록 인물의 비중을 높입니다.
1girl|여성 한 명|화면에 등장하는 여성 캐릭터 수를 한 명으로 지정합니다.
1boy|남성 한 명|화면에 등장하는 남성 캐릭터 수를 한 명으로 지정합니다.
2people|두 사람|두 인물이 함께 등장하는 장면을 만듭니다. 둘 사이의 거리와 동작은 별도로 고릅니다.
multiple individuals|여러 인물|단독 초상보다 여러 사람이 있는 장면을 요청합니다.
magical girl|마법소녀 캐릭터|마법을 사용하는 변신 히로인의 캐릭터성을 더합니다. 의상과 마법 소품은 따로 조합할 수 있습니다.
witch girl|마녀 캐릭터|마술과 주술을 연상시키는 여성 캐릭터를 요청합니다. 모자나 지팡이는 별도로 선택합니다.
shimmering makeup|빛나는 메이크업|화장 부위에 작은 광택과 반짝임을 넣어 얼굴이 빛을 받는 느낌을 강조합니다.
soft glitter eyeshadow|은은한 글리터 눈화장|눈꺼풀 주변에 잔잔한 반짝임을 더합니다. 강한 발광보다 화장품의 미세한 광택에 가깝습니다.
dark smoky makeup|어두운 스모키 화장|눈 주위의 짙은 음영을 넓게 번지게 해 강하고 신비로운 인상을 만듭니다.
pale skin|창백한 피부|피부를 밝고 혈색이 옅은 톤으로 표현합니다.
whipped cream on cheek|볼에 묻은 생크림|볼에 작은 생크림 자국을 남겨 디저트와 연결되는 장난스러운 순간을 만듭니다.
soft hair|부드러운 머릿결|머리카락의 결을 거칠지 않고 가볍고 매끈하게 표현합니다.
painted nails|색을 칠한 손톱|손톱에 매니큐어 색을 넣어 손끝의 작은 패션 디테일을 드러냅니다.
heart face sticker|얼굴의 하트 스티커|얼굴에 작은 하트 스티커를 붙여 화장과 장식의 포인트를 만듭니다.
nail polish|매니큐어|손톱을 맨손톱 대신 광택과 색이 있는 네일로 표현합니다.
face stickers|얼굴 스티커|볼이나 눈가에 작은 스티커 장식을 붙입니다. 의상 장식과 구분되는 얼굴의 포인트입니다.
dark nail polish|짙은 매니큐어|손톱을 어두운 색으로 칠해 손끝의 대비를 높입니다.
hair buns|묶어 올린 번 헤어|머리카락을 둥글게 말아 올린 덩어리로 묶어 머리 윤곽을 만듭니다.
mermaid|인어 캐릭터|사람의 상체와 물고기 꼬리가 결합된 인어의 신체 형태를 요청합니다.
long wavy hair|긴 웨이브 머리|길게 내려오는 머리카락에 완만한 물결을 넣어 부피와 흐름을 만듭니다.
short wavy hair|짧은 웨이브 머리|짧은 길이의 머리카락을 곧게 붙이지 않고 물결치는 덩어리로 표현합니다.
face details|얼굴 세부 묘사|얼굴의 눈·코·입과 작은 형태를 더 또렷하게 묘사하도록 요청합니다.
wet hair|젖은 머리카락|머리카락을 젖어 모인 가닥과 윤기로 표현해 물에 닿은 상태를 드러냅니다.
fang|송곳니|입 안에 뾰족한 송곳니를 드러내 캐릭터의 장난기나 비인간적 특징을 더합니다.
flowers in hair|머리에 꽂은 꽃|꽃을 배경에 흩뿌리는 대신 머리카락 사이에 꽂은 장식으로 배치합니다.
heart sticker on cheek|볼의 하트 스티커|볼 위에 하트 모양 스티커를 붙여 얼굴의 한 지점을 강조합니다.
black nails|검은 손톱|손톱을 검게 칠해 손끝에 선명한 어두운 포인트를 만듭니다.
chibi|치비 비례|머리를 크게, 몸과 팔다리를 짧게 줄여 작은 데포르메 캐릭터로 그립니다.
chibi only|치비만 등장|일반 비례 인물과 섞지 않고 치비 비례의 캐릭터만 그립니다.
super deformed|강한 데포르메|머리와 얼굴을 크게 과장하고 몸을 매우 작게 줄여 장난감 같은 비례를 만듭니다.
tiny chibi character|아주 작은 치비|큰 머리의 치비 캐릭터를 장면 안에서도 작게 배치합니다.
miniature size|미니어처 크기|캐릭터나 대상이 주변 사물보다 작게 느껴지도록 상대적인 크기를 줄입니다.
chibi-style character expressions|치비식 표정|눈과 입의 모양을 크게 단순화해 감정이 즉시 읽히는 데포르메 표정을 만듭니다.
giant|거대한 크기|대상을 주변 공간이나 소품보다 크게 만들어 압도적인 스케일을 줍니다.
leaning towards other|상대 쪽으로 기울이기|한 인물의 상체를 다른 인물 쪽으로 기울여 접근하는 움직임을 만듭니다.
close interaction|가까운 상호작용|두 인물이 서로 가까이에서 행동을 주고받도록 거리와 동작을 연결합니다.
kissing|입맞춤|두 인물이 입을 맞추는 순간을 요청합니다. 얼굴의 거리와 방향이 가까워집니다.
faces close together|가까이 붙은 두 얼굴|두 얼굴 사이의 간격을 좁혀 서로의 표정이 한 화면에서 연결되게 합니다.
overlapping bodies|겹쳐 보이는 몸|두 인물의 몸 윤곽이 화면에서 일부 겹치게 배치해 깊이와 접촉감을 줍니다.
intimate pose|친밀한 자세|몸의 방향과 거리를 가까이 잡아 서로 편안하고 친근한 관계를 드러냅니다.
natural interaction|자연스러운 교감|두 인물이 따로 포즈를 취하기보다 서로의 동작에 반응하는 순간처럼 표현합니다.
body contact|몸의 접촉|두 인물의 어깨나 몸이 맞닿도록 배치해 물리적인 가까움을 드러냅니다.
kissing pose|입맞춤 자세|두 인물이 입맞춤을 할 수 있도록 얼굴과 상체의 방향을 서로 맞춥니다.
one hand holding woman's head|한 손으로 여성의 머리 받치기|한 인물의 손이 여성 인물의 머리를 받치거나 감싸도록 손과 머리를 연결합니다.
close distance|짧은 인물 간 거리|두 인물 사이의 빈 공간을 줄여 가까이 서 있거나 앉은 관계를 만듭니다.
intimate angle|친밀한 촬영 각도|두 인물의 가까운 얼굴과 접촉이 잘 보이는 각도로 장면을 잡습니다.
receiving kiss|입맞춤을 받는 순간|한 인물이 다른 인물에게 입맞춤을 받는 쪽으로 역할을 나눕니다.
intimate distance|친밀한 거리|얼굴과 몸이 가까운 거리에서 서로에게 집중하는 장면을 만듭니다.
intimate embrace from behind|뒤에서 가까이 안기|뒤에 선 인물이 앞사람을 가까이 감싸는 포옹을 만듭니다.
head to head proximity|머리를 가까이 대기|두 인물의 머리를 서로 가까이 붙여 얼굴 사이의 간격을 최소화합니다.
leaning against partner|파트너에게 기대기|인물이 파트너의 몸을 지지점으로 삼아 어깨나 상체를 기대게 합니다.
one arm around partner's waist|한 팔로 파트너 허리 감싸기|한쪽 팔이 상대의 허리 뒤나 옆으로 둘러지도록 팔의 연결을 지정합니다.
facing partner|파트너를 마주 보기|인물의 얼굴과 몸 방향을 관객보다 파트너 쪽으로 돌립니다.
half-embrace|한쪽으로 가볍게 안기|몸 전체를 완전히 감싸기보다 한쪽 팔과 어깨로 상대를 가볍게 안습니다.
holding other character|다른 인물을 붙잡기|손이나 팔로 상대 인물을 잡아 두 몸 사이의 동작을 연결합니다.
sitting on lap|무릎 위에 앉기|한 인물이 다른 인물의 무릎을 지지점으로 삼아 앉게 합니다.
hugging from behind|뒤에서 포옹하기|상대의 등 뒤에서 팔을 둘러 안는 위치 관계를 만듭니다.
arms around neck|목에 팔 두르기|양팔이나 팔의 곡선이 상대의 목 뒤를 감싸도록 배치합니다.
hand on another's head|상대 머리에 손 얹기|손이 자기 머리가 아닌 다른 인물의 머리 위에 닿도록 지정합니다.
interacting poses|서로 연결된 자세|각자의 독립된 포즈보다 두 인물의 손·시선·몸 방향이 맞물리는 자세를 만듭니다.
carrying another|상대를 들어 옮기기|한 인물이 다른 인물의 체중을 팔이나 몸으로 받쳐 들어 올립니다.
princess carry|가로로 안아 들기|한 팔로 등, 다른 팔로 무릎 아래를 받쳐 상대를 가로로 안아 듭니다.
looking at another|다른 인물 바라보기|시선을 카메라가 아닌 함께 있는 인물에게 향하게 합니다.
being carried|안겨서 들리기|다른 인물에게 들려 지면에서 체중이 떠 있는 쪽의 자세를 만듭니다.
tight hold on waist|허리를 단단히 잡기|손이나 팔로 상대 허리를 확실히 붙잡아 접촉 지점을 강조합니다.
intimacy|친밀감|두 인물이 가까운 거리와 부드러운 반응으로 친밀한 관계를 드러내게 합니다.
tight embrace around neck|목을 감싸 꼭 안기|팔을 상대의 목 뒤로 가까이 둘러 상체가 밀착되는 포옹을 만듭니다.
face close|얼굴을 가까이|상대나 카메라와 얼굴의 거리를 줄여 표정과 가까운 느낌을 강조합니다.
head-to-head|머리를 맞대기|두 인물의 이마나 머리 옆면이 서로 가까이 닿는 구도를 만듭니다.
holding waist|허리 잡기|손이나 팔의 접촉점을 상대의 허리로 지정합니다.
face-to-face|얼굴을 마주하기|두 인물이 서로의 얼굴을 정면으로 마주 보도록 방향을 맞춥니다.
standing behind another|다른 인물 뒤에 서기|두 인물의 앞뒤 위치를 나눠 한 명이 다른 한 명의 뒤에 서게 합니다.
drying another's hair|상대 머리 말려주기|한 인물이 다른 인물의 젖은 머리카락을 말려 주는 돌봄 동작을 만듭니다.
soft line|부드러운 선|윤곽선을 날카롭고 굵게 끊기보다 가늘고 부드럽게 이어 그립니다.
expressive painting|표현적인 회화|붓질과 색의 흔적을 드러내며 형태보다 감정과 손맛이 느껴지는 회화로 만듭니다.
watercolor (medium)|수채화 매체|물에 푼 안료가 종이에 스며드는 수채화의 투명도와 번짐을 사용합니다.
messy lineart doodles|헝클어진 선화 낙서|정리된 윤곽 대신 빠르게 겹쳐 그은 선과 작은 낙서가 남게 합니다.
pixelated windows|픽셀로 된 창|컴퓨터 창의 모서리와 요소를 작은 사각 픽셀 단위로 각지게 표현합니다.
pop art shading|팝아트 음영|부드러운 명암 대신 선명한 색면과 그래픽적인 음영을 사용해 만화적 대비를 만듭니다.
flat color|평면 색면|한 영역을 대체로 같은 색으로 채워 복잡한 명암보다 색 덩어리가 먼저 보이게 합니다.
pixel art|픽셀 아트|그림을 작은 사각 도트로 구성해 윤곽과 색 단계를 픽셀 단위로 표현합니다.
dithering|디더링|서로 다른 색의 점을 교차 배치해 적은 색으로 중간 명암이나 그라데이션을 흉내 냅니다.
pixel art nurse maid uniform|픽셀 간호·메이드 의상|간호사와 메이드 요소가 있는 의상을 사각 도트의 픽셀 아트로 표현합니다.
flat illustration style|평면 일러스트 화풍|복잡한 질감과 입체 명암을 줄이고 단순한 형태와 색면으로 그림을 구성합니다.
clean line art|정돈된 선화|겹친 스케치 선을 줄이고 경계가 분명하고 매끈한 윤곽선을 사용합니다.
16-bit|16비트 게임풍|옛 게임 그래픽처럼 제한된 색 단계와 픽셀 덩어리로 형태를 표현합니다.
jagged lines|계단식 선|윤곽선을 매끈한 곡선 대신 작은 계단처럼 꺾인 가장자리로 만듭니다.
flat colors|평평하게 채운 색|영역마다 균일한 색을 채워 색면 사이의 경계가 잘 보이게 합니다.
lineart outline|선화 윤곽|색이나 빛보다 선으로 형태의 바깥 경계를 뚜렷하게 정의합니다.
sketch|스케치|완성된 채색보다 형태를 빠르게 잡은 밑그림과 손으로 그은 선을 남깁니다.
rough lines|거친 선|매끈하게 정리하지 않은 들쭉날쭉한 선과 필압 흔적을 드러냅니다.
old film|오래된 필름|옛 필름 특유의 색바램과 거친 입자를 더해 오래된 사진 같은 화면을 만듭니다.
analog photography|아날로그 사진|디지털의 매끈함보다 필름의 색감·입자·빛 번짐을 가진 사진 느낌을 요청합니다.
rough sketch lines|거친 스케치 선|여러 번 덧그은 탐색선과 미완성 선을 남겨 밑그림의 과정을 보여 줍니다.
jagged edges|각진 가장자리|경계가 연속적인 곡선보다 작은 각과 계단 형태로 끊겨 보이게 합니다.
low poly|로우 폴리|적은 수의 다각형 면으로 입체를 구성해 표면이 각지고 단순한 3차원 형태가 되게 합니다.
papercraft|종이 공작|종이를 접고 오려 붙인 듯한 면과 접힌 모서리로 대상의 입체감을 만듭니다.
smooth shading|매끈한 음영|명암이 면마다 끊기지 않고 부드럽게 이어져 둥근 표면처럼 보이게 합니다.
retro 3d|레트로 3차원 그래픽|초기 3차원 게임처럼 단순한 입체 모델과 옛 렌더링의 분위기를 더합니다.
3d model|3차원 모델|손그림보다 공간에 놓인 입체 모델을 렌더링한 형태로 표현합니다.
animation genga|애니메이션 원화|채색 완성본보다 움직임의 핵심 자세를 잡은 애니메이션 제작 원화처럼 그립니다.
lineart|선화|색면보다 인물과 사물의 형태를 정리한 윤곽선이 중심이 되는 그림입니다.
color trace lines|색 구분선|원화 작업처럼 그림자나 채색 영역의 경계를 서로 다른 색 선으로 표시합니다.
unpainted|미채색|색을 완전히 채우지 않은 영역을 남겨 선화나 종이 바탕이 보이게 합니다.
no shading|음영 생략|그림자와 입체 명암을 줄여 밝기 변화가 적은 평면적인 화면을 만듭니다.
blue color trace|파란 색 구분선|채색 영역이나 그림자 경계를 파란 보조선으로 남겨 제작 원화 느낌을 줍니다.
rough linework|거친 선 작업|선의 굵기와 방향이 조금씩 흔들리는 손그림 흔적을 살립니다.
animation paper|애니메이션 작업지|완성 장면보다 원화와 보조선이 놓인 제작용 종이처럼 보이게 합니다.
production art|제작 과정의 그림|완성 이미지보다 디자인·설정·원화처럼 제작 중인 그림의 성격을 더합니다.
traditional media|전통 화구|디지털의 균일한 표면보다 종이와 실제 화구의 흔적이 느껴지는 질감을 요청합니다.
flat illustration|평면 일러스트|입체 렌더링을 줄이고 간결한 윤곽과 색 덩어리로 대상이 읽히게 합니다.
watercolor painting|수채화 그림|투명한 물감층과 종이에 스며드는 번짐으로 색을 표현합니다.
translucent watercolor|투명한 수채|아래의 선과 색이 비쳐 보이는 얇은 수채 물감층을 사용합니다.
watercolor wash|넓게 번진 수채 워시|물을 많이 머금은 색을 넓게 펼쳐 균일하지 않은 부드러운 색면을 만듭니다.
diluted paint|묽게 푼 물감|안료 농도를 낮춰 종이 바탕이 잘 비치고 색이 옅게 퍼지게 합니다.
wet-on-wet|젖은 종이 위 채색|젖은 바탕에 물감을 얹어 색의 경계가 자연스럽게 퍼지고 서로 섞이게 합니다.
blooming watercolor|꽃처럼 번진 수채|마르지 않은 물감이 주변으로 퍼지며 불규칙한 번짐 자국을 만들게 합니다.
pigment bleeding|안료 번짐|색의 경계를 또렷하게 닫지 않고 이웃한 영역으로 안료가 스며들게 합니다.
watercolor pooling|고인 수채 물감|물감이 가장자리나 낮은 부분에 고여 진한 테두리와 농도 차이가 생기게 합니다.
partially colored|부분 채색|그림 전체를 채우지 않고 일부만 색을 넣어 채색부와 선화가 함께 보이게 합니다.
unpainted areas|채색하지 않은 영역|종이 바탕이나 선화만 보이는 빈 부분을 의도적으로 남깁니다.
faded edges|옅어진 가장자리|대상의 가장자리로 갈수록 색을 흐리게 해 바탕으로 사라지는 느낌을 만듭니다.
feathered edges|솜털처럼 풀린 경계|선명한 경계 대신 가늘게 번져 나가는 부드러운 가장자리를 만듭니다.
paper grain|종이의 입자|종이 섬유의 미세한 요철과 결을 보여 매끈한 디지털 표면을 줄입니다.
pigment granulation|안료의 알갱이|안료가 종이 요철에 고르지 않게 쌓인 작은 점과 얼룩을 남깁니다.
transparent washes|투명한 워시 겹침|얇은 색층을 겹쳐 아래 색이 비치고 겹친 곳의 농도가 달라지게 합니다.
loose brushwork|자유로운 붓질|작은 부분을 모두 다듬기보다 크고 느슨한 붓 자국으로 형태를 암시합니다.
simple flat illustration|단순한 평면 그림|세부 질감과 음영을 줄여 적은 형태와 색면만으로 이미지를 구성합니다.
8bit style|8비트 게임풍|매우 제한된 색과 큼직한 픽셀로 초기 게임 그래픽 같은 단순함을 만듭니다.
""")

definitions("""
cyberpunk|사이버펑크|네온·전자 장치·도시적 요소를 섞어 기술적인 미래 분위기를 만듭니다.
cute rabbit theme|귀여운 토끼 테마|토끼의 귀·모양·장식에서 가져온 귀여운 시각 요소로 장면의 테마를 맞춥니다.
sweet lolita aesthetic|스위트 로리타 미감|파스텔·리본·레이스 같은 달콤하고 장식적인 로리타 분위기를 더합니다.
cute pastel skater-girl street fashion|파스텔 스케이터 패션|스케이트보드 문화의 편한 스트리트 실루엣에 귀여운 파스텔 색을 섞습니다.
pastel aesthetic|파스텔 미감|강한 원색보다 부드럽고 밝은 저채도 색을 중심으로 장면을 통일합니다.
oversized street fashion|오버사이즈 스트리트|몸보다 큰 옷의 부피와 느슨한 실루엣을 스트리트 패션의 중심으로 잡습니다.
casual aesthetic|캐주얼 미감|격식 있는 차림보다 편안한 일상복과 자연스러운 생활 분위기를 강조합니다.
ethereal fashion|비현실적으로 가벼운 패션|가볍게 흐르는 소재와 섬세한 장식으로 꿈속처럼 가녀린 분위기를 더합니다.
umamusume st|우마무스메풍|원본의 우마무스메 스타일 약칭을 유지한 표현입니다. 경주·아이돌 캐릭터를 연상시키는 디자인 방향을 요청합니다.
epic feel|장대한 인상|작은 일상 컷보다 규모와 존재감이 크게 느껴지는 장면을 만듭니다.
jiangshi cosplay|강시 코스프레|중국 강시를 연상시키는 전통 복장과 부적 등의 캐릭터 요소를 더합니다.
goth lolita chi-pao fusion|고딕 로리타·치파오 혼합|검고 장식적인 로리타 요소와 치파오의 칼라·여밈·실루엣을 섞습니다.
decadent|퇴폐적인 화려함|풍성한 장식과 어두운 색조를 통해 쇠락한 사치나 고혹적인 분위기를 만듭니다.
dark fantasy|다크 판타지|마법과 비현실적 공간에 어두운 색·그림자·불길한 요소를 섞습니다.
gothic|고딕|어두운 색조와 성당·첨탑·장식적 문양 같은 고딕 요소를 더합니다.
elegant gender-neutral styling|우아한 중성적 스타일|성별에 치우친 장식보다 정돈된 선과 품격 있는 중성적 스타일을 요청합니다.
kitsch|키치|선명한 색과 장난감 같은 장식, 이질적인 소품을 섞어 일부러 유쾌하고 과장된 화면을 만듭니다.
pop art|팝아트|광고·만화처럼 선명한 색과 굵은 형태를 사용해 그래픽적인 인상을 만듭니다.
pop art style|팝아트 화풍|대중 인쇄물과 만화를 연상시키는 강한 색면과 눈에 띄는 그래픽을 더합니다.
gothic lolita|고딕 로리타|검은색 중심의 드레스에 레이스·프릴·리본을 겹쳐 고딕과 인형 같은 장식을 섞습니다.
floral arrangement|꽃의 구성|꽃을 무작위로 흩뿌리기보다 서로 어울리는 덩어리와 흐름으로 배치합니다.
romantic scenery|낭만적인 풍경|부드러운 색과 장식적인 자연 요소로 감성적이고 다정한 공간을 만듭니다.
cyber-streetwear|사이버 스트리트웨어|도시적 캐주얼에 전자 장치·네온·기능성 장비 같은 미래 요소를 섞습니다.
techwear|테크웨어|스트랩·포켓·기능성 소재와 구조적인 옷을 중심으로 기술적인 패션을 만듭니다.
lolita style|로리타 스타일|볼륨 있는 스커트와 레이스·리본·프릴 같은 장식적인 복식 요소를 더합니다.
cyber-y2k elements|사이버 Y2K 요소|2000년대 초 디지털 디자인과 미래적인 광택·전자 장식을 섞습니다.
jirai kei|지뢰계 패션|검정·분홍 대비와 리본·레이스 등 일본 서브컬처의 섬세하고 어두운 장식을 더합니다.
subculture fashion|서브컬처 패션|주류 일상복보다 특정 취향이 드러나는 강한 실루엣과 장식을 요청합니다.
distressed fashion|낡고 해진 패션|찢김·해짐·색바램 같은 사용 흔적을 옷의 의도적인 디테일로 만듭니다.
surrealism|초현실주의|현실에서는 어울리기 어려운 크기와 사물을 결합해 꿈처럼 비논리적인 장면을 만듭니다.
vaporwave aesthetic|베이퍼웨이브 미감|분홍·보라·청록과 옛 디지털 그래픽을 섞어 복고적 가상 공간의 느낌을 줍니다.
techwear aesthetic|테크웨어 미감|기능성 장비와 옷의 구조적 선을 강조해 실용적이고 미래적인 분위기를 만듭니다.
elegant|우아함|장식과 자세의 선을 정돈해 과격함보다 차분하고 품격 있는 인상을 만듭니다.
gothic lolita style|고딕 로리타 스타일|어두운 색의 드레스와 촘촘한 레이스·리본으로 고딕 인형 같은 분위기를 더합니다.
cluttered|복잡하게 채우기|빈 공간을 넓게 남기기보다 여러 물건과 디테일이 겹치는 밀도 높은 화면을 만듭니다.
decora|데코라|색색의 헤어핀·리본·작은 소품을 많이 겹쳐 장식 자체가 주인공이 되는 스타일을 만듭니다.
peach-themed fashion|복숭아 테마 패션|복숭아의 분홍·살구색과 과일 모양을 의상의 색과 장식에 반영합니다.
delicate fashion style|섬세한 패션|굵고 무거운 장식보다 가는 선과 작은 디테일이 느껴지는 옷차림을 요청합니다.
arrangement|의도적인 배치|사물과 장식이 서로 어울리는 위치와 흐름을 가지도록 구성을 요청합니다.
peaceful|평온함|급격한 동작과 강한 대비보다 안정된 자세와 부드러운 공간감을 더합니다.
chaotic cute|혼잡하고 귀여움|귀여운 소품과 색을 질서정연하게 정리하지 않고 활기 있게 겹쳐 놓습니다.
sweet lolita|스위트 로리타|리본·레이스·볼륨 있는 치마에 밝고 달콤한 색을 더한 로리타 차림을 요청합니다.
retro artstyle|복고 화풍|현대적인 매끈함보다 과거 인쇄물·애니메이션을 연상시키는 색과 선을 요청합니다.
retro pop style|레트로 팝 스타일|복고적인 형태에 밝고 선명한 팝 컬러와 경쾌한 장식을 섞습니다.
yume kawaii|유메카와이|꿈같이 부드러운 파스텔과 별·구름·리본 같은 귀여운 장식을 섞습니다.
energetic|활기참|정적인 분위기보다 움직임과 선명한 리듬이 느껴지는 장면을 만듭니다.
sportswear|스포츠웨어|운동복의 가벼운 소재와 활동적인 실루엣을 패션의 중심으로 잡습니다.
casual fashion|일상 캐주얼|격식 있는 복식보다 셔츠·니트·데님 같은 편안한 일상복 방향을 요청합니다.
pastel aesthetics|파스텔 분위기|옅고 부드러운 색을 인물과 배경에 함께 사용해 화면의 대비를 순하게 만듭니다.
comfortable|편안함|긴장된 자세와 딱딱한 공간보다 몸을 편히 두고 쉬는 느낌을 강조합니다.
layered street fashion|겹친 스트리트 패션|이너와 겉옷의 길이·색·부피 차이가 보이도록 여러 옷을 겹칩니다.
retro pop|레트로 팝|옛 디자인의 형태와 경쾌한 색을 섞어 복고적인 시각적 리듬을 만듭니다.
y2k|Y2K 스타일|2000년대 초의 디지털·패션 감각을 반영해 반짝이는 소재와 과감한 소품을 더합니다.
idol|아이돌 콘셉트|무대에서 시선을 끄는 화려한 복식과 표정·연출을 중심으로 캐릭터를 만듭니다.
lolita fashion|로리타 패션|인형 같은 볼륨과 레이스·리본·프릴이 겹쳐진 장식적인 옷차림을 요청합니다.
formal|격식 있는 분위기|편한 차림보다 정돈된 복장과 곧은 선을 통해 공식적인 인상을 만듭니다.
magical girl theme|마법소녀 테마|변신 히로인·마법 문양·장식적인 의상으로 장면의 테마를 맞춥니다.
valentine|밸런타인 테마|하트·선물·초콜릿과 분홍·빨강 계열을 이용해 다정하고 달콤한 분위기를 만듭니다.
sticker aesthetics|스티커 미감|대상과 장식을 잘라 붙인 스티커 조각처럼 분리해 보이는 그래픽 감각을 더합니다.
cute decorative elements|귀여운 장식 요소|둥근 형태와 작은 귀여운 장식을 더해 장면의 빈 부분을 채웁니다.
vaporwave|베이퍼웨이브|파스텔 네온과 옛 디지털 화면·기하학 요소로 복고적인 가상 공간을 만듭니다.
punk style|펑크 스타일|강한 대비·거친 소재·금속 장식 등으로 반항적이고 날카로운 패션을 요청합니다.
decora style|데코라 스타일|작은 장식과 색을 다수 겹쳐 화려하고 장난감 같은 패션을 만듭니다.
1990s|1990년대 분위기|1990년대의 인쇄·패션·디지털 그래픽을 연상시키는 복고 감각을 더합니다.
vintage|빈티지|새것의 선명함보다 오래된 물건의 색바램과 장식적 형태를 느끼게 합니다.
retro|레트로|과거의 패션이나 디자인에서 가져온 색·형태·장식을 사용합니다.
moody|감정적인 분위기|밝은 일상감보다 짙은 명암과 절제된 감정이 느껴지는 분위기를 만듭니다.
formal wear|포멀웨어|정장·드레스처럼 격식이 느껴지는 복장의 선과 실루엣을 요청합니다.
cute design|귀여운 디자인|둥근 형태와 작은 장식, 친근한 비례가 드러나는 디자인을 만듭니다.
chaotic|혼란스러운 구성|사물과 선의 방향을 다양하게 겹쳐 질서보다 복잡하고 소란스러운 인상을 줍니다.
maximalist|맥시멀리즘|여백보다 풍부한 색·무늬·장식이 차지하는 밀도를 높입니다.
fashion illustration|패션 일러스트|옷의 실루엣과 소재·장식이 잘 읽히도록 패션 디자인을 중심으로 그립니다.
maximalist fashion|장식이 풍부한 패션|단순한 한 벌보다 여러 소재·무늬·소품을 겹쳐 옷차림의 밀도를 높입니다.
otaku subculture decor|오타쿠 서브컬처 장식|캐릭터 굿즈와 취향이 드러나는 장식물을 공간에 더합니다.
medical pop aesthetic|메디컬 팝 미감|의료 도구와 기호를 선명하고 귀여운 팝 컬러의 장식으로 섞습니다.
y2k aesthetic|Y2K 미감|2000년대 초의 디지털 화면과 광택 있는 소재를 연상시키는 분위기를 만듭니다.
tanabata festival|칠석 축제|대나무와 소원 종이·리본 같은 칠석 장식으로 계절 축제의 맥락을 만듭니다.
angelcore aesthetic|엔젤코어 미감|흰색·빛·날개 같은 천사 이미지를 섞어 맑고 성스러운 분위기를 더합니다.
minimal|미니멀|색과 사물의 수를 줄여 큰 여백과 단순한 형태가 눈에 들어오게 합니다.
retro 2000s aesthetic|2000년대 복고 감각|초기 인터넷과 당시 패션의 디지털 장식을 가져와 향수를 줍니다.
retro game aesthetic|레트로 게임 미감|오래된 게임의 도트·화면 구성·제한된 색감을 연상시키는 요소를 더합니다.
strawberry themed sweet lolita|딸기 테마 스위트 로리타|스위트 로리타의 리본·프릴에 딸기 무늬와 빨강·분홍 계열을 섞습니다.
""")

definitions("""
dreamy clouds|몽환적인 구름|구름의 경계와 색을 부드럽게 만들어 실제 날씨보다 꿈속 풍경 같은 느낌을 줍니다.
magical particles|마법의 입자|공기 중에 작은 마법 입자를 흩뿌려 공간 전체에 비현실적인 기운을 더합니다.
magical aura|마법의 기운|인물이나 사물 주변에 마법이 감도는 듯한 분위기와 색의 기운을 만듭니다.
night|밤|배경의 시간대를 밤으로 잡아 주변 밝기를 낮추고 인공 조명이나 달빛이 드러나게 합니다.
dreamy|몽환적|현실의 날카로운 경계를 줄이고 부드러운 색과 공기로 꿈같은 인상을 만듭니다.
winter atmosphere|겨울 분위기|찬 공기와 옅은 색조 등 겨울을 연상시키는 분위기를 더합니다.
gothic garden at dusk|황혼의 고딕 정원|해가 저무는 어두운 정원에 고딕의 장식적인 인상을 섞습니다.
misty atmosphere|안개 낀 공기|공기 중에 옅은 안개층을 넣어 멀리 있는 대상의 경계와 대비를 흐립니다.
sunset|일몰|해가 지는 시간대의 낮은 빛과 따뜻한 하늘색으로 하루가 끝나는 순간을 만듭니다.
dreamy pastel environment|몽환적인 파스텔 공간|공간을 부드러운 파스텔 색과 희미한 경계로 감싸 꿈속처럼 표현합니다.
party particles|파티의 작은 입자|작은 장식 조각이 공중에 흩어진 듯한 효과로 축제의 활기를 더합니다.
night cityscape below|아래로 펼쳐진 밤 도시|인물 아래쪽으로 어두운 도시와 불빛이 보이게 해 높은 장소의 밤 풍경을 만듭니다.
romantic atmosphere|낭만적인 분위기|부드러운 색과 감성적인 공간감으로 다정하고 낭만적인 장면을 만듭니다.
holy atmosphere|성스러운 분위기|차분하고 맑은 공기감으로 의식이나 성소를 연상시키는 경건함을 더합니다.
soft dreamy background|부드러운 꿈속 배경|배경의 대비와 경계를 낮춰 인물 뒤 공간이 부드럽게 퍼져 보이게 합니다.
magical ambience|마법적인 공간감|특정 마법 도구보다 공간 전체에 마법이 감도는 분위기를 요청합니다.
summer atmosphere|여름 분위기|따뜻하고 밝은 계절감으로 여름의 공기와 활기를 더합니다.
sunny beach|맑은 날의 해변|햇빛이 비치는 해변으로 설정해 밝은 바다와 모래의 분위기를 만듭니다.
dreamy misty backdrop|꿈처럼 안개 낀 배경|안개가 배경의 경계를 흐리게 하고 부드러운 몽환감을 더하게 합니다.
evening atmosphere|저녁 분위기|낮보다 차분하고 어둑한 저녁의 공기감을 더합니다.
warm and inviting atmosphere|따뜻하고 아늑한 분위기|공간이 차갑고 낯설기보다 편하게 머물고 싶은 장소처럼 느껴지게 합니다.
dreamy atmosphere|꿈같은 분위기|선명한 현실감보다 부드럽게 떠 있는 듯한 몽환적인 공기를 더합니다.
ethereal space/chapel|비현실적인 성소 공간|예배당이나 공간을 가볍고 신비로운 공기로 감싸 현실에서 떨어진 듯 보이게 합니다.
eerie mist|으스스한 안개|안개로 시야를 가리고 차갑고 불길한 분위기를 더합니다.
lively atmosphere|생기 있는 분위기|정숙하고 정적인 장면보다 사람과 장식의 활력이 느껴지는 공간을 만듭니다.
ethereal|가볍고 비현실적|형태와 빛이 가볍게 떠 있는 듯한 섬세하고 신비로운 인상을 더합니다.
grand staircase at night|밤의 거대한 계단|웅장한 계단을 밤 공간에 배치해 어둠 속의 층과 깊이를 강조합니다.
smoke in air|공기 중의 연기|공간에 연기층을 넣어 시야가 흐려지고 빛과 그림자가 걸리게 합니다.
sunny day|햇빛 맑은 날|맑은 낮의 햇빛과 밝은 주변 환경으로 선명한 일광 장면을 만듭니다.
raining|내리는 비|공중에서 빗줄기가 떨어지는 날씨를 표현해 장면에 수직적인 움직임을 더합니다.
steam|수증기|따뜻한 물체에서 나온 듯한 옅은 수증기를 넣어 열과 습기를 느끼게 합니다.
winter garden|겨울 정원|따뜻한 계절의 무성함보다 차가운 계절감이 드러나는 정원을 배경으로 만듭니다.
snowflakes|눈송이|작은 눈송이를 공중이나 장식에 넣어 겨울의 차가움과 입자감을 더합니다.
night water|밤의 물|밤에 놓인 수면으로 설정해 어두운 물색과 빛의 반사가 드러나게 합니다.
night sky|밤하늘|하늘을 어둡게 해 별이나 달빛이 드러나는 밤의 배경을 만듭니다.
mystical atmosphere|신비로운 분위기|평범한 생활 공간보다 알려지지 않은 힘이나 비밀이 느껴지는 공기를 더합니다.
dreamlike|꿈속 같은 느낌|사물과 공간이 현실보다 부드럽고 비현실적으로 이어지게 합니다.
magical atmosphere|마법이 감도는 분위기|빛과 공기에 마법적인 기운을 더해 일상적인 공간과 다른 느낌을 만듭니다.
night and day transition|낮과 밤의 전환|한 화면에 낮과 밤의 빛이 바뀌거나 공존하는 시간의 전환을 표현합니다.
dreamy atmosphe|몽환적인 공기|원본의 축약된 분위기 표현으로, 장면을 꿈처럼 부드럽고 흐릿하게 만듭니다.
subtle dust motes|은은한 먼지 입자|공기 중의 아주 작은 먼지 알갱이를 약하게 보여 공간의 깊이와 고요함을 더합니다.
dark gothic atmosphere|어두운 고딕 분위기|짙은 색과 그늘로 공간을 감싸 장식적이고 묵직한 고딕 정서를 더합니다.
pastel magical atmosphere|파스텔 마법 분위기|옅은 파스텔 색에 마법적인 빛과 공기를 섞어 밝고 신비롭게 만듭니다.
dreamy pink closet|몽환적인 분홍 옷장 공간|분홍색 옷장이나 드레스룸을 부드러운 꿈속 공간처럼 표현합니다.
fairytale atmosphere|동화 같은 분위기|현실적인 일상보다 장식적이고 상상력이 느껴지는 동화 속 공간감을 더합니다.
gentle aura|온화한 기운|인물이나 공간 주변에 강한 압박감보다 차분하고 부드러운 느낌을 더합니다.
ethereal atmosphere|비현실적인 공기감|공간이 무겁고 선명하기보다 빛과 안개 속에 가볍게 떠 있는 듯 보이게 합니다.
misty background|안개 낀 배경|배경에 안개를 넣어 먼 사물의 색과 윤곽이 옅어지게 합니다.
rain|비|빗방울이나 빗줄기가 있는 날씨로 장면의 습기와 흐린 공기를 표현합니다.
raining outside|창밖에 내리는 비|비가 실내가 아닌 바깥에서 내리도록 해 안과 밖의 분위기를 나눕니다.
raindrops|빗방울|큰 비구름보다 작은 물방울 자체가 보이도록 해 젖은 날씨를 표현합니다.
daytime|낮 시간|인공 조명 중심의 밤보다 자연광이 있는 낮의 밝기를 기준으로 장면을 만듭니다.
warm atmosphere|따뜻한 분위기|색과 공기를 따뜻하게 느끼게 해 차가운 인상을 줄입니다.
soft snow|부드러운 눈|눈을 거칠고 몰아치는 형태보다 가볍고 포근하게 표현합니다.
pastel winter street|파스텔 겨울 거리|겨울 거리의 차가운 공기에 옅은 파스텔 색을 섞어 부드럽게 만듭니다.
day|낮|주변 공간을 낮의 자연광이 있는 시간대로 설정합니다.
heavy rain|거센 비|빗줄기의 양과 밀도를 높여 약한 비보다 강하게 쏟아지는 날씨를 만듭니다.
summer|여름|밝고 따뜻한 계절감으로 한여름의 공기와 장소를 연상시키게 합니다.
dreamy blue sky|몽환적인 푸른 하늘|푸른 하늘을 부드러운 경계와 색으로 표현해 현실보다 꿈같이 보이게 합니다.
lively aura|활기 있는 기운|인물이나 주변 공간에 밝고 움직임이 느껴지는 생기를 더합니다.
dark atmosphere|어두운 분위기|공간 전체의 정서를 무겁고 어둡게 해 밝은 일상감과 다른 인상을 줍니다.
summer vibe|여름의 느낌|구체적인 날씨보다 따뜻하고 가벼운 여름의 인상을 장면에 더합니다.
cute atmosphere|귀여운 분위기|공간의 색과 장식을 부드럽고 친근하게 해 귀여운 정서를 만듭니다.
nostalgic atmosphere|향수 어린 분위기|지금의 선명한 현실보다 오래된 기억처럼 익숙하고 아련하게 느껴지게 합니다.
sunny sky|햇빛 맑은 하늘|어두운 구름보다 밝고 햇빛이 느껴지는 하늘을 배경으로 만듭니다.
stardust|별가루|작은 빛의 입자를 흩뿌려 우주나 마법을 연상시키는 반짝이는 공기를 만듭니다.
night stage|밤 무대|밤의 어두운 주변 공간 안에서 무대와 조명이 두드러지게 합니다.
winter room|겨울의 방|실내 공간에 차가운 계절감과 겨울의 포근한 대비를 더합니다.
autumn cafe terrace|가을 카페 테라스|카페 바깥 테라스에 가을의 색과 차분한 공기를 더합니다.
halloween night|핼러윈 밤|밤의 어두운 공간에 핼러윈을 연상시키는 축제와 으스스한 분위기를 더합니다.
fog|짙은 안개|공기 중에 비교적 두꺼운 안개층을 넣어 먼 거리의 시야와 대비를 낮춥니다.
starry night sky|별이 많은 밤하늘|어두운 밤하늘 위에 많은 별을 배치해 넓고 반짝이는 배경을 만듭니다.
sweet atmosphere|달콤한 분위기|부드러운 색과 귀여운 장식으로 디저트처럼 달고 다정한 정서를 만듭니다.
grayscale|회색조|색상을 빼고 흰색부터 검정까지의 밝기 차이로 화면을 표현합니다.
monochrome|단색조|여러 색을 섞기보다 한 색 계열의 밝고 어두운 변화로 화면을 통일합니다.
oversaturated|과한 채도|색의 채도를 강하게 높여 현실적인 색보다 자극적이고 선명하게 보이게 합니다.
limited palette|제한된 팔레트|사용하는 색의 수를 줄여 서로 구분되는 적은 색으로 화면을 구성합니다.
black and palette|검정을 포함한 팔레트|검정이 들어간 배색을 요청합니다. 나머지 색 이름은 원문에 명시되지 않았습니다.
theme|주제에 맞춘 색|색과 장식을 한 주제에 맞춰 통일하도록 요청합니다. 구체적인 주제는 다른 선택과 함께 정합니다.
color palette swatches|팔레트 색상 견본|그림 안에 사용 색을 보여 주는 작은 색상 견본들이 함께 보이게 합니다.
blue effect|푸른색 효과|파란 계열의 시각 효과로 화면에 차갑고 시원한 색의 기운을 더합니다.
solid color|단일한 색면|여러 무늬나 그라데이션보다 하나의 균일한 색으로 영역을 채웁니다.
soft gradient|부드러운 그라데이션|색과 밝기가 급격히 끊기지 않고 천천히 이어지도록 만듭니다.
vivid gradient|선명한 그라데이션|채도가 높은 색들이 서로 이어져 바뀌는 강한 색의 흐름을 만듭니다.
rainbow arcs|무지개 곡선|여러 색이 나란히 이어진 무지개를 둥근 곡선 형태로 배치합니다.
rainbow|무지개 배색|빨강부터 보라까지 여러 색을 함께 사용해 다채로운 색의 흐름을 만듭니다.
pastel rainbow|파스텔 무지개|무지개의 여러 색을 옅고 부드러운 파스텔 톤으로 낮춰 표현합니다.
macaron color palette|마카롱 팔레트|마카롱을 연상시키는 옅은 분홍·민트·크림 등 부드러운 색을 배합합니다.
strawberry theme|딸기 색 테마|딸기를 연상시키는 빨강·분홍과 밝은 보조색으로 색과 장식의 인상을 맞춥니다.
""")

# Longest phrases win: "light blue" is a color, while "blue lighting" is
# illumination; "stained glass" denotes a material rather than dirty glass.
PHRASES: dict[str, str] = {}


def words(rows: str) -> None:
    for row in rows.strip().splitlines():
        if row.strip():
            source, target = row.split("|", 1)
            PHRASES[source] = target


words("""
light blue|하늘색
deep blue|짙푸른
pale blue|옅은 파랑
pastel blue|파스텔 파랑
pastel pink|파스텔 분홍
soft pink|연분홍
hot pink|핫핑크
neon pink|네온 분홍
dark purple|짙은 보라
deep purple|깊은 보라
deep indigo|짙은 남색
dark crimson|짙은 진홍
cool blue|차가운 파랑
black and white|흑백
pink-blue-purple|분홍·파랑·보라
purple-black|보라·검정
blue and black|파랑·검정
pink and white|분홍·하양
pink and purple|분홍·보라
purple and pink|보라·분홍
blue and pink|파랑·분홍
pink and blue|분홍·파랑
pink and mint|분홍·민트
pink and cream|분홍·크림
pink and cyan|분홍·청록
cyan and purple|청록·보라
blue yellow|파랑·노랑
light-colored|밝은 색
dark-colored|어두운 색
pastel colored|파스텔 색의
color scheme|배색
color palette|팔레트
colorful poolparty|알록달록한 풀 파티
stained glass|스테인드글라스
starry sky|별이 가득한 하늘
clear sky|맑은 하늘
cloudy sky|구름 낀 하늘
sky background|하늘 배경
sky ceiling|하늘이 그려진 천장
city skyline|도시 스카이라인
urban skyline|도시의 건물 윤곽
city street|도시 거리
urban street scene|도시의 거리 풍경
urban alley|도시 골목
city park|도시 공원
skate park|스케이트보드 공원
amusement park|놀이공원
merry-go-round|회전목마
ferris wheel|관람차
idol concert venue|아이돌 공연장
idol stage|아이돌 무대
concert stage|콘서트 무대
crowd area|관객 구역
cheering crowd|응원하는 관중
outdoor plaza|야외 광장
entrance gate|입구의 문
night cityscape|밤의 도시 풍경
gothic cathedral|고딕 대성당
church interior|교회 내부
chinese temple|중국 사원
burial ground|묘지
medical lab|의료 실험실
hospital setting|병원 공간
medical supplies|의료 용품
gaming cabinets|게임 기계
arcade machine|아케이드 게임기
arcade machines|아케이드 게임기
claw machine|인형 뽑기 기계
claw crane|인형 뽑기 집게
tennis court|테니스 코트
dirt track|흙 트랙
asphalt road|아스팔트 도로
sports car|스포츠카
retro car|복고풍 자동차
train window frame|열차 창틀
steam locomotive|증기 기관차
european architecture|유럽풍 건축
korean architecture|한국식 건축
chinese architecture|중국식 건축
traditional architecture|전통 건축
japanese house|일본식 주택
wooden cabin|나무 오두막
treehouse interior|나무 위 집의 내부
cozy living room|아늑한 거실
living room|거실
cozy bedroom|아늑한 침실
bedroom interior|침실 내부
cozy indoor|아늑한 실내
bright backyard|밝은 뒷마당
walk-in closet|걸어 들어가는 드레스룸
reading nook|작은 독서 공간
wooden window seat|창가의 나무 좌석
window seat|창가 좌석
dessert shop|디저트 가게
dessert cafe|디저트 카페
sweet shop|과자 가게
maid cafe|메이드 카페
cafe interior|카페 내부
retro diner|복고풍 다이너
cafe table and chairs|카페 테이블과 의자
menu board|메뉴판
display cabinet|진열장
jewelry box|보석함
velvet interior|벨벳으로 된 내부
velvet table runner|벨벳 테이블 러너
table runner|테이블 위의 긴 장식 천
tufted background|단추로 눌러 고정한 푹신한 배경
red velvet curtains|빨간 벨벳 커튼
lace curtains|레이스 커튼
frilled tablecloth|프릴 식탁보
patterned tablecloth|무늬 있는 식탁보
bed sheet|침대 시트
white bedding|흰 침구
soft bedding|부드러운 침구
floor cushion|바닥 방석
leather sofa|가죽 소파
plush toys|봉제 인형
stuffed toys|봉제 인형
stuffed toy|봉제 인형
stuffed bear|곰 인형
teddy bear|테디베어 인형
rabbit plush|토끼 봉제 인형
pile of plushies|쌓인 봉제 인형
plushies on shelves|선반 위의 봉제 인형
room clutter|방 안에 어지럽게 놓인 물건
floor objects|바닥 위 물건
object set|여러 사물의 모음
school equipment|학교 비품
school environment|학교 공간
open lockers|열린 사물함
cluttered desk|물건이 어지러운 책상
power lines|전선
utility pole|전봇대
tangled wires|엉킨 전선
metal catwalk|금속 공중 통로
chainlink fence|마름모 철망 울타리
glass panel|유리판
large window view|큰 창 너머의 풍경
window view|창밖 풍경
starry sky ceiling|밤하늘을 그린 천장
rooftop terrace|옥상 테라스
open-air|야외의
cloth fabric|천
tulle fabric|얇은 튈 천
draped curtains|주름 잡아 늘어뜨린 커튼
frozen statues|얼어붙은 조각상
stone statues|돌 조각상
ivy-covered|담쟁이덩굴로 덮인
climbing ivy|타고 오르는 담쟁이덩굴
plant canopy|식물이 덮는 천장
dense foliage|빽빽한 잎사귀
indoor plants|실내 식물
field of sunflowers|해바라기 들판
flower field|꽃밭
flower bed|화단
bed of roses|장미가 가득 깔린 자리
lush bed of flowers|꽃이 무성하게 깔린 자리
rose garden|장미 정원
bamboo garden|대나무 정원
bamboo tree|대나무
palace garden|궁전 정원
grassy field|풀밭
green fields|푸른 들판
grassy hill|풀이 덮인 언덕
cherry blossom trees|벚나무
morning glory flowers|나팔꽃
palm tree|야자수
bare trees|잎이 없는 나무
frosted trees|서리가 낀 나무
floral ground|꽃이 깔린 바닥
water-like floor|물처럼 보이는 바닥
galaxy surface|은하처럼 보이는 표면
shallow water|얕은 물
clear water|맑은 물
water drops|물방울
water splash|튀어 오르는 물
water ripples|수면의 잔물결
sea foam|바다의 흰 거품
inner tube|튜브
inflatable floats|공기를 넣은 튜브
kiddie pool|작은 어린이용 풀장
fish tank|어항
aquarium tunnel|수족관 터널
outer space|우주 공간
milky way|은하수
starfield|별이 가득한 공간
nebula|성운
clockwork|시계 장치
clock faces|시계 문자판
rotating gears|회전하는 톱니바퀴
inner mechanisms|내부 기계 장치
giant gears|거대한 톱니바퀴
light rays|빛줄기
god rays|구름 사이로 퍼지는 빛줄기
sunlight streaming through windows|창문을 통과해 들어오는 햇빛
sunlight through window|창문을 통과하는 햇빛
sunlight from window|창문에서 들어오는 햇빛
sunlight streaming in|안으로 흘러 들어오는 햇빛
dust particles in sunlight|햇빛 속 먼지 입자
soft focus|부드러운 초점
rim lighting|윤곽 조명
rim light|윤곽 빛
backlighting|역광
backlight|역광
light reflections|빛 반사
glass reflections|유리 반사
colorful light reflections|여러 색의 빛 반사
light effects|빛 효과
glow sticks in audience|관객석의 응원봉
glow sticks|응원봉
color trace|색 구분선
chromatic aberration|색수차
chiaroscuro lighting|강한 명암 대비 조명
time distortion effect|시간 왜곡 효과
ground reflection|지면 반사
reflected light|반사된 빛
reflective surface|빛을 반사하는 표면
rainbow refraction|무지개 굴절
water refraction|물의 굴절
water caustics|물빛 무늬
moonlight beams|달빛 줄기
dappled sunlight|잎 사이로 얼룩져 비치는 햇빛
dappled light|얼룩처럼 비치는 빛
string lights|줄에 매단 작은 조명
fairy lights|작은 장식 전구
fairy dust|요정 가루
sun glare|강하게 눈부신 햇빛
lens flare|렌즈 플레어
sunbeams|햇살 줄기
streetlight|가로등
lightbulbs|전구
lightning bolts|번개 줄기
zigzag lightning|지그재그 번개
multi-branch candelabra|여러 갈래의 촛대
chandelier lighting|샹들리에 조명
candlelight|촛불
daylight|낮의 자연광
morning light|아침 빛
window light|창문 빛
screen glow|화면에서 나오는 빛
drop shadow|뒤로 떨어지는 그림자
color bleed|색 번짐
magic circle|마법진
magic circles|마법진
star light projection|별 모양 빛의 투사
glowing star lights|빛나는 별 조명
heart sparkles|하트 반짝임
star sparkles|별 반짝임
delicate sparkling orbit|가늘게 반짝이는 궤도
giant glowing jack-o'-lantern|빛나는 거대한 호박 등
moonlit graveyard|달빛을 받는 묘지
warm and cool light contrast|따뜻한 빛과 차가운 빛의 대비
heart (symbol)|하트 기호
star (pattern)|별무늬
star symbol|별 기호
star shapes|별 모양
geometric shapes|기하학 도형
simple shapes|단순한 도형
hourglass icon|모래시계 아이콘
cassette tape icon|카세트테이프 아이콘
envelope icon|봉투 아이콘
email icon|이메일 아이콘
cross icon|십자가 아이콘
medical icons|의료 아이콘
love icon|사랑 아이콘
like icon|좋아요 아이콘
skill icons|스킬 아이콘
training status icons|훈련 상태 아이콘
specific camera and setting icons|카메라와 설정 아이콘
pixel cursor|픽셀 커서
cursor icons|커서 아이콘
heart icons|하트 아이콘
pixel icons|픽셀 아이콘
ribbon icon|리본 아이콘
heart shape|하트 모양
heart patterns|하트 무늬
heart motifs|하트 모티프
heart motif|하트 모티프
fruit pattern|과일무늬
cherry motif|체리 모티프
ribbon motifs|리본 모티프
plaid pattern|격자 체크무늬
checkered pattern|체크무늬
grid pattern|격자무늬
grid lines|격자선
grid background|격자 배경
polka dot pattern|물방울무늬
polka dot background|물방울무늬 배경
gingham background|깅엄 체크 배경
transparent checkered background|투명도를 나타내는 체크 배경
graphic patterns|그래픽 무늬
halftone dots|망점
halftone pattern|망점 무늬
screen tone|스크린톤
starburst|별처럼 퍼지는 방사형 장식
speech bubbles|말풍선
heart speech bubbles|하트 말풍선
doodle hearts|낙서 하트
cross marks|십자가 표시
snowflake marks|눈송이 표시
paw prints|발바닥 자국
lined notebook paper|줄이 있는 공책 종이
visible paper texture|눈에 보이는 종이결
glossy paper texture|광택 있는 종이 질감
paper clip|클립
washi tape|종이 장식 테이프
raw paper tear-outs|거칠게 뜯은 종이 조각
torn paper edges|찢어진 종이 가장자리
postage stamp border|우표의 톱니 테두리
corner punch holes|모서리의 펀치 구멍
cut number annotation|컷 번호 주석
circled letter marks|동그라미 친 문자 표시
yellow highlight marks|노란 강조 표시
red correction marks|빨간 수정 표시
annotation arrows|주석 화살표
horizontal line pattern clouds|가로줄 무늬 구름
vertical stripes|세로 줄무늬
vertical text band|세로 글자 띠
bottom text area|하단 글자 영역
column text|열로 나뉜 글
text blocks|글자 덩어리
text overlay|겹쳐 놓은 글자
text design|글자 디자인
text logo|글자 로고
large title text|큰 제목 글자
large text on background|배경 위의 큰 글자
random text|임의의 글자
random characters for titles|제목용 임의 문자
random digits for data|데이터용 임의 숫자
gibberish error text|의미 없는 오류 글자
english headline|영어 헤드라인
cover lines|표지의 짧은 문구
character name text on board|보드 위의 캐릭터 이름
japanese text|일본어 글자
chinese text|중국어 글자
html code text overlay|겹쳐 놓은 웹페이지 코드 글자
ascii art|문자로 만든 그림
floating kaomoji|떠 있는 문자 이모티콘
handwritten japanese text|손으로 쓴 일본어
copyright mark|저작권 표시
bubble lettering|둥근 풍선 글씨
graffiti walls|낙서가 있는 벽
graffiti murals|그래피티 벽화
blackboard graffiti|칠판 낙서
graffiti elements|그래피티 요소
paint splatters|물감이 튄 자국
paint splash border|물감이 튄 테두리
dripping paint border|물감이 흘러내린 테두리
paint mess|어지러운 물감 흔적
spiderweb corner|모서리의 거미줄
ornate engravings|화려한 새김 장식
baroque filigree|바로크식 금속 세공 문양
ornate picture frames|화려한 액자
oval decorative frame|타원형 장식 프레임
gothic rounded frame|둥근 고딕 프레임
pink rounded rectangle border|분홍 둥근 사각 테두리
lace frame border|레이스 프레임 테두리
lace border|레이스 테두리
decorative border|장식 테두리
frame border|프레임 테두리
doodle borders|낙서 테두리
character outline|캐릭터 외곽선
glowing animal ears outline|빛나는 동물 귀 외곽선
glowing bow outlines|빛나는 리본 외곽선
neon pink ribbon outlines|네온 분홍 리본 외곽선
ribbon banner|리본 모양 배너
badge decorations on surface|표면의 배지 장식
small ribbon decorations|작은 리본 장식
large bows|큰 리본 장식
sticker art|스티커 아트
sticker style|스티커 스타일
no pattern|무늬 없음
""")

words("""
soft|부드러운
pastel|파스텔
pink|분홍
blue|파랑
white|흰색
glowing|빛나는
neon|네온
dark|어두운
colorful|알록달록한
large|큰
dreamy|몽환적인
warm|따뜻한
vibrant|생생한
ornate|화려한
red|빨강
urban|도시의
cute|귀여운
decorative|장식적인
fluffy|폭신한
solid|단색의
cozy|아늑한
wooden|나무로 된
black|검정
purple|보라
yellow|노랑
fantasy|판타지
starry|별이 가득한
winter|겨울
retro|복고풍
pixel|픽셀
distant|멀리 있는
bold|굵은
deep|깊은
misty|안개 낀
dramatic|극적인
summer|여름
sunny|햇빛 맑은
giant|거대한
inner|안쪽의
luminous|밝게 빛나는
intense|강렬한
clear|맑은
ancient|고대의
messy|어지러운
gentle|은은한
holographic|홀로그램의
cluttered|물건이 빽빽한
heavy|짙은
random|임의의
colored|색이 있는
simple|단순한
traditional|전통적인
sweet|달콤한
abstract|추상적인
themed|테마가 있는
romantic|낭만적인
subtle|희미한
intricate|정교한
steampunk|스팀펑크
overlapping|겹쳐 있는
exposed|드러난
ethereal|가볍고 비현실적인
long|긴
blurred|흐릿한
realistic|현실적인
clean|깔끔한
iridescent|보는 각도에 따라 색이 변하는
forgotten|잊힌
explosive|폭발하듯 퍼진
scarlet|선홍색
crimson|진홍색
psychedelic|환각적인
grand|웅장한
noir|누아르풍
cracked|금이 간
rainy|비가 오는
reflected|반사된
blurry|흐릿한
pale|옅은
frosted|서리 낀
frozen|얼어붙은
twinkling|깜박이며 빛나는
central|중앙의
powerful|강한
massive|커다란
cinematic|영화 같은
magical|마법 같은
bright|밝은
white|흰색
hot|강렬한
opulent|호화로운
lush|무성한
gentle|은은한
ornamental|장식적인
peaceful|평온한
cool|차가운
thin|가는
thick|두꺼운
torn|찢어진
rounded|모서리가 둥근
transparent|투명한
grey|회색
gray|회색
small|작은
glossy|광택 있는
horizontal|가로의
mint|민트색
cream|크림색
beige|베이지색
vivid|선명한
soft|부드러운
and|·
in|안의
on|위의
with|함께 있는
at|곳의
from|에서 나오는
through|통과하는
of|의
for|용
the|
a|
an|
inside|안쪽의
below|아래의
outdoors|야외
indoors|실내
outdoor|야외
indoor|실내
background|배경
backdrop|배경
lighting|조명
light|빛
lights|조명
glow|광채
atmosphere|분위기
sky|하늘
clouds|구름
cloud|구름
text|글자
color|색
colors|색상
border|테두리
room|방
water|물
window|창문
windows|창문
interior|내부
pattern|무늬
theme|테마
palette|팔레트
stage|무대
night|밤
roses|장미
rose|장미
particles|입자
heart|하트
city|도시
frame|프레임
frames|프레임
icon|아이콘
icons|아이콘
glass|유리
wall|벽
walls|벽
street|거리
garden|정원
park|공원
star|별
stars|별
grid|격자
floor|바닥
sparkling|반짝이는
scheme|구성
typography|타이포그래피
paper|종이
bed|침대
ribbon|리본
ribbons|리본
checkered|체크무늬
cafe|카페
shadows|그림자
shadow|그림자
sparkles|반짝임
sparkle|반짝임
gothic|고딕
graffiti|그래피티
bokeh|초점 밖의 둥근 빛망울
architecture|건축물
rainbow|무지개
paint|물감
outline|외곽선
outlines|외곽선
tones|색조
tone|톤
cityscape|도시 풍경
reflections|반사
reflection|반사
crowd|군중
space|공간
amusement|놀이
table|테이블
bedroom|침실
curtains|커튼
curtain|커튼
japanese|일본식
magic|마법
aura|기운
dim|어슴푸레한
rays|빛줄기
dust|먼지
surface|표면
effect|효과
effects|효과
velvet|벨벳
shapes|모양
splash|물보라
chinese|중국식
ground|지면
rim|윤곽
glitch|화면 깨짐
reflection|반사
medical|의료
cursor|커서
galaxy|은하
day|낮
overlay|겹침
trees|나무
green|초록
desk|책상
motif|모티프
screen|화면
error|오류
sunflowers|해바라기
town|마을
bedding|침구
pillows|베개
rooftop|옥상
terrace|테라스
object|사물
closet|옷장
plaid|격자무늬
palace|궁전
character|캐릭터
fairy|요정
car|자동차
rain|비
daytime|낮
toys|인형
patterned|무늬가 있는
fence|울타리
tree|나무
elements|요소
art|그림
board|판
ocean|바다
flowers|꽃
flower|꽃
forest|숲
plushies|봉제 인형
lines|선
line|선
lace|레이스
cherry|체리
floating|떠 있는
highlights|밝은 부분의 포인트 색
mystical|신비로운
symbol|기호
bear|곰
dessert|디저트
shop|가게
old|오래된
stone|돌
statues|조각상
ruins|폐허
aesthetic|미감의
view|풍경
reflecting|반사되는
sacred|성스러운
quiet|고요한
gradient|그라데이션
seaside|바닷가
idol|아이돌
decorations|장식
entrance|입구
area|구역
evening|저녁
engraving|새김
box|상자
indigo|남색
flares|퍼지는 강한 빛
cobblestone|조약돌로 포장한
door|문
studio|스튜디오
underwater|물속
smoky|연기 같은
faint|희미한
beach|해변
focus|초점
glass|유리
contrast|대비
climbing|타고 오르는
performance|공연
classroom|교실
chandelier|샹들리에
mirror|거울
sand|모래
plushie|봉제 인형
arcade|오락실
stadium|경기장
train|열차
skyscrapers|고층 빌딩
arches|아치
raw|거친
hand-drawn|손으로 그린
band|띠
barcode|바코드
bandages|붕대
bloom|밝은 빛이 번지는 효과
accents|포인트
hospital|병원
plants|식물
clutter|어지럽게 놓인 물건
shape|모양
banner|배너
castle|성
sheet|시트
draped|주름 잡아 늘어뜨린
fabric|천
twisting|비틀린
set|모음
stripes|줄무늬
decora|데코라
void|빈 공간
korean|한국식
pavilion|정자
golden|금빛
tiles|타일
buildings|건물
crosswalk|횡단보도
toy|장난감
delicate|섬세한
celestial|천체 같은
racetrack|경주로
building|건물
drops|물방울
scene|장면
triangles|삼각형
dollhouse|인형의 집
antique|골동품풍
kawaii|귀여운
decorated|장식한
illuminated|조명을 받은
tower|탑
stylized|도안화한
blocks|덩어리
snow|눈
storefront|가게 정면
futuristic|미래적인
cables|케이블
animal|동물
ears|귀
bow|리본
ghost|유령
strawberry|딸기
bolts|번개 줄기
name|이름
strong|강한
elegant|우아한
oval|타원형
ceiling|천장
vase|꽃병
spotlight|스포트라이트
cumulonimbus|적란운
horizon|수평선
tufted|단추로 고정한 푹신한
sparkler|스파클러 불꽃
bushes|관목
archway|아치 통로
pillars|기둥
tiled|타일을 붙인
bathroom|욕실
kitchen|주방
brick|벽돌
painted|그려진
wings|날개
filled|가득 찬
posters|포스터
projection|투사
lake|호수
swatches|색상 견본
arrows|화살표
carriage|마차
planets|행성
theatrical|연극 무대 같은
miniature|미니어처
checkered|체크무늬
postmark|소인
dimly lit|어둑하게 조명된
surreal|초현실적인
chaotic|혼란스러운
rug|러그
sunroom|햇볕이 드는 방
fireplace|벽난로
blanket|담요
playroom|놀이방
messy|어지러운
engawa|일본식 툇마루
shelves|선반
foam|거품
bats|박쥐
orange|주황
broken|깨진
mirrors|거울
cushions|쿠션
concrete|콘크리트
starburst|별 모양 방사 장식
headline|큰 표제
machines|기계
dripping|흘러내리는
texture|질감
copyright|저작권
rectangle|사각형
textured|질감이 있는
candy|사탕
visible|눈에 보이는
tanzaku|소원 종이
strips|긴 띠
hanging|매달린
neon|네온
prints|자국
cover|표지
snowflake|눈송이
envelope|봉투
""")

words("""
sunlight|햇빛
moonlight|달빛
cabin|객실
cathedral|대성당
vibe|분위기
mural|벽화
dynamic|역동적인
detailed|상세한
cyan|청록
y2k|이천년대 초반풍
vaporwave|베이퍼웨이브
cyberpunk|사이버펑크
metropolis|대도시
glitter|작은 반짝이
carousel|회전목마
bordered|테두리가 있는
graphic|그래픽
floral|꽃무늬
tape|테이프
sun|태양
european|유럽풍
geometric|기하학적인
aquarium|수족관
moonlit|달빛이 비치는
flat|평평한
vending machines|자동판매기
""")

definitions("""
time distortion effect|시간 왜곡 효과|시계나 주변 공간의 흐름이 어긋나는 듯한 효과로 정상적인 시간감에서 벗어난 장면을 만듭니다.
iridescent|각도에 따라 변하는 광택|한 가지 색의 광택 대신 보는 각도에 따라 여러 색이 바뀌는 표면을 만듭니다.
holographic|홀로그램 효과|얇고 반투명한 빛의 면과 여러 색의 광택으로 실체가 없는 투영체처럼 표현합니다.
holograms|홀로그램 투영체|입체나 화면이 빛으로 투사되어 공중에 떠 있는 것처럼 보이게 합니다.
glitch|화면 깨짐|디지털 화면이 어긋나거나 일부 픽셀이 깨진 듯한 불규칙한 흔적을 더합니다.
glitch effect|디지털 오류 효과|화면 일부를 어긋내고 깨뜨려 신호 오류가 난 디지털 이미지처럼 만듭니다.
pixel glitch|픽셀 오류|일부 픽셀의 색과 위치가 어긋난 듯한 작은 사각형의 깨짐을 더합니다.
chromatic aberration|색수차|윤곽의 빨강·파랑 등 색 성분을 약간 어긋나게 해 렌즈 가장자리 같은 색 번짐을 만듭니다.
caustics|굴절된 빛 무늬|물이나 투명체를 통과한 빛이 주변 표면에 밝고 불규칙한 무늬로 모이게 합니다.
water caustics|물빛 무늬|수면을 통과한 빛이 바닥이나 인물 표면에 흔들리는 그물 같은 밝은 무늬를 만듭니다.
rainbow refraction|무지개 굴절|투명체를 지난 빛이 여러 색으로 갈라져 무지개 띠와 작은 색 조각이 보이게 합니다.
water refraction|물의 굴절|물 너머의 형태나 빛이 꺾이고 일렁여 물속 특유의 시각적 왜곡을 만듭니다.
high contrast|강한 명암 대비|밝은 부분과 어두운 부분의 차이를 크게 벌려 형태가 강하게 읽히게 합니다.
bloom|밝은 빛의 번짐|밝은 부분이 경계를 넘어 부드럽게 퍼져 강한 광원이 주변 공기까지 빛나게 합니다.
color bleed|색 번짐|색이 자신의 경계를 넘어 주변으로 스며들어 색면 사이의 경계가 풀리게 합니다.
drop shadow|떨어지는 그림자|대상의 바로 뒤나 아래에 어긋난 그림자를 넣어 바탕에서 떠 있는 느낌을 만듭니다.
central powerful glow from the bouquet and feet|꽃다발·발에서 중앙으로 퍼지는 강한 빛|꽃다발과 발 부근을 강한 발광 지점으로 삼아 중앙의 인물과 주변 공간을 비춥니다.
warm and cool light contrast|따뜻한 빛·차가운 빛 대비|노랑·주황 계열과 파랑 계열의 빛을 함께 써 인물의 양쪽이나 공간에 색 대비를 만듭니다.
psychedelic neon|환각적인 네온|강렬한 네온 색이 비현실적으로 뒤섞여 자극적이고 몽롱한 빛의 분위기를 만듭니다.
sun glare|눈부신 햇빛|햇빛이 눈을 찌르는 듯 강하게 번져 일부가 하얗게 날아가는 눈부심을 더합니다.
lens flare|렌즈 플레어|강한 광원이 카메라 렌즈에 들어온 듯 빛줄기나 둥근 반사 무늬를 더합니다.
sparkler|스파클러 불꽃|손에 드는 작은 불꽃 막대에서 가느다란 불꽃이 사방으로 튀는 효과를 넣습니다.
lightning bolts|번개 줄기|하늘이나 공간을 가르는 가지 모양의 밝은 번개를 넣어 순간적인 에너지를 만듭니다.
zigzag lightning|지그재그 번개|빛의 선을 연속된 꺾인 모양으로 만들어 번개 같은 날카로운 에너지를 더합니다.
soft focus|부드러운 초점|세부 경계의 날카로움을 낮춰 선과 빛이 살짝 퍼지는 부드러운 화면을 만듭니다.
soft focus background|부드러운 초점의 배경|배경의 세부를 또렷하게 고정하지 않고 살짝 흐려 인물과 거리를 둡니다.
soft flat lighting|부드럽고 평평한 조명|그림자 경계와 명암 차이를 줄여 형태가 고르고 부드럽게 보이게 합니다.
chiaroscuro lighting|강한 명암법 조명|밝은 주광과 깊은 어둠을 맞대어 인물의 부피와 극적인 분위기를 강조합니다.
delicate sparkling orbit|섬세하게 반짝이는 궤도|작은 빛 점들이 가는 원이나 타원 궤도를 따라 이어져 인물 주위를 감싸게 합니다.
star light projection|별 모양 빛 투사|주변 표면에 별 모양으로 잘린 빛이 비치게 해 조명의 모양을 드러냅니다.
glowing star lights|빛나는 별 조명|별 모양의 작은 광원을 배치해 어두운 공간에 별의 윤곽이 빛나게 합니다.
lit multi-branch candelabra|불이 켜진 여러 갈래 촛대|여러 초가 달린 촛대에 불을 켜 작은 불꽃들이 모인 따뜻한 광원을 만듭니다.
glow sticks in audience|관객석의 응원봉|관객이 든 응원봉을 작은 색 광원으로 보여 무대 밖까지 공연의 빛을 채웁니다.
glowing blue sand|빛나는 파란 모래|모래 알갱이나 모래밭이 파랗게 발광해 지면 자체가 마법적인 빛을 내게 합니다.
glowing inner mechanisms|빛나는 내부 장치|기계 안쪽의 구조가 빛을 내어 틈새와 부품의 깊이가 보이게 합니다.
glowing cables|빛나는 케이블|케이블을 따라 빛이 흐르는 듯 표현해 전선의 경로와 기술적인 에너지를 강조합니다.
glowing ghost|빛나는 유령|유령의 몸이나 윤곽이 빛을 내어 어두운 배경에서 반투명한 존재감이 드러나게 합니다.
glowing planets|빛나는 행성|행성의 표면이나 가장자리가 발광해 우주 공간에 떠 있는 광원처럼 보이게 합니다.
glowing object|빛나는 물체|선택한 물체가 주변 빛을 받는 데 그치지 않고 스스로 빛을 내는 것처럼 표현합니다.
illuminated tower|조명을 받은 탑|탑에 조명을 비춰 어두운 주변보다 높이와 건축 윤곽이 뚜렷하게 보이게 합니다.
moonlit graveyard|달빛 아래 묘지|묘지에 차가운 달빛을 비춰 어두운 구조물과 빈 공간의 으스스함을 더합니다.
giant glowing jack-o'-lantern|거대한 발광 호박 등|속에서 빛이 새어 나오는 거대한 핼러윈 호박 등을 배치해 크기와 불빛을 강조합니다.
large stylized "LEMON" typography|커다란 레몬 제목 디자인|영문 레몬 글자를 크게 도안화해 배경의 장식과 제목 역할을 하게 합니다.
pixel text "SUGAR PARTY"|픽셀 글씨로 쓴 슈거 파티|슈거 파티라는 영문 문구를 사각 픽셀 글꼴로 배치해 레트로 게임 화면 같은 인상을 만듭니다.
floating text "ZERO"|공중에 떠 있는 제로 글자|영문 제로 글자가 배경 속에 떠 있는 듯 보이게 해 디지털 문구를 공간의 장식으로 만듭니다.
floating text "ERROR"|공중에 떠 있는 오류 글자|영문 오류 글자를 허공의 화면 요소처럼 배치해 고장 난 디지털 공간의 인상을 만듭니다.
large title text "CHERRY"|큰 체리 제목 글자|영문 체리 문구를 큰 제목으로 넣어 잡지 표지나 포스터처럼 주제와 시각적 중심을 만듭니다.
urban skate park|도시 스케이트 공원|경사로와 주행 공간이 있는 도시의 스케이트보드 공원을 배경으로 배치합니다.
sacred environment|성스러운 공간|의식이나 예배를 연상시키는 공간으로 설정해 고요하고 경건한 장소감을 만듭니다.
velvet interior|벨벳으로 된 내부|공간 안쪽의 표면을 부드럽고 깊은 색의 벨벳으로 감싸 작은 상자나 방의 고급스러운 질감을 만듭니다.
forgotten burial ground|잊힌 묘지|오래되고 사람의 손이 닿지 않은 묘역을 배경으로 잡아 쓸쓸하고 으스스한 공간을 만듭니다.
dollhouse|인형의 집|작은 방과 가구가 보이는 인형의 집을 배경으로 만들어 미니어처의 크기와 세밀함을 살립니다.
rooftop|옥상|건물 꼭대기의 열린 공간을 지면으로 삼아 하늘과 먼 도시가 보이는 높이감을 만듭니다.
pastel interior|파스텔 실내|방 안의 벽과 가구를 옅은 파스텔 색으로 맞춰 공간 전체가 부드럽고 밝게 느껴지게 합니다.
reading nook|작은 독서 공간|책을 읽기 위해 마련한 아늑한 구석을 배경으로 잡아 조용히 머무는 생활 공간을 만듭니다.
flower vase|꽃병|꽃을 담은 병을 배경의 가구나 바닥에 놓아 작은 수직 장식과 생활감을 더합니다.
sweet kitchen|달콤한 분위기의 주방|조리 공간을 귀엽고 부드러운 색과 장식으로 표현해 디저트를 만드는 주방 같은 인상을 줍니다.
urban alley|도시 골목|좁게 이어지는 건물 사이의 길을 배경으로 잡아 벽과 원근이 가까이 모이게 합니다.
vending machines|자동판매기|음료나 상품을 진열한 자동판매기를 배치해 도시 거리의 생활 디테일과 밝은 기계 면을 더합니다.
spiderweb corner|모서리의 거미줄|화면 구석에 가는 거미줄을 붙여 고딕이나 핼러윈의 오래되고 으스스한 장식을 만듭니다.
colorful tanzaku strips hanging|색색의 소원 종이 매달기|길쭉한 색종이 소원 표찰이 가지나 끈에 매달려 칠석 축제의 수직 장식을 만들게 합니다.
vibrant lights reflecting on glass|유리에 반사된 선명한 조명|유리 표면에 여러 선명한 조명색이 비쳐 창과 거울의 표면이 잘 드러나게 합니다.
an open-air rooftop terrace with draped white tulle fabric|흰 튈 천을 늘어뜨린 옥상 테라스|열린 옥상 테라스에 얇은 흰 튈 천을 드리워 하늘과 천의 부드러운 흐름이 함께 보이게 합니다.
""")

definitions("""
thin outlines|가는 외곽선|대상의 경계를 가는 선으로 정리해 두꺼운 테두리보다 가볍고 섬세하게 분리합니다.
white outline|흰 외곽선|인물이나 사물의 가장자리에 흰 선을 둘러 바탕에서 오려 붙인 듯 분리합니다.
no pattern|무늬 없음|바탕이나 지정 영역의 반복 무늬를 없애 단순한 색면이 보이게 합니다.
transparent checkered background|투명도를 나타내는 체크 배경|그래픽 편집기의 투명 영역처럼 회색 사각 체크를 바탕에 보이게 합니다. 실제 파일 투명도와는 다른 시각 표현입니다.
geometric|기하학 그래픽|구체적인 장소 대신 삼각형·사각형·곡선 같은 기본 도형으로 화면을 장식합니다.
visible paper texture|눈에 보이는 종이결|종이 섬유와 요철이 화면에 드러나 손으로 만든 인쇄물이나 그림의 표면처럼 느껴지게 합니다.
glossy paper texture|광택 있는 종이 질감|매끈한 코팅지처럼 빛이 반사되는 종이 표면을 표현해 잡지나 인쇄물의 물성을 더합니다.
red tufted background|빨간 단추 누빔 배경|빨간 천을 단추로 눌러 고정한 푹신한 배경으로 깊은 주름과 반복되는 오목한 표면을 만듭니다.
overlapping giant clock faces|겹쳐 놓은 거대한 시계판|커다란 시계 문자판을 여러 겹 포개어 인물 뒤에 시간과 기계의 원형 구조를 쌓습니다.
pink-blue-purple highlights|분홍·파랑·보라 포인트 빛|밝게 빛나는 부분에 분홍·파랑·보라가 함께 나타나도록 해 다채로운 마법 조명색을 만듭니다.
soft grey shadow|부드러운 회색 그림자|검게 닫힌 그림자 대신 경계가 부드러운 회색 그림자를 넣어 물체의 부피를 가볍게 드러냅니다.
holographic particles|홀로그램 입자|작은 반투명한 빛 조각이 공중에 떠 있는 듯 보이게 해 디지털 투영의 깊이를 더합니다.
pastel pink and white checkered cafe interior|파스텔 분홍·하양 체크 카페|카페의 벽이나 가구에 옅은 분홍과 흰색의 체크무늬를 넣어 공간의 색과 반복 패턴을 맞춥니다.
deep indigo starfield|짙은 남색의 별 공간|깊은 남색 공간에 작은 별들을 흩뿌려 어둡고 넓게 이어지는 우주의 원경을 만듭니다.
nebula blue clouds|푸른 성운 구름|우주의 성운이 푸른 구름처럼 퍼져 보이게 해 기체의 덩어리와 깊은 공간감을 만듭니다.
water-like floor|물처럼 보이는 바닥|바닥을 단단한 불투명 면 대신 물 같은 투명도와 반사를 가진 표면으로 표현합니다.
galaxy surface|은하 같은 표면|표면에 별과 은하의 무늬가 펼쳐져 지면 자체가 우주처럼 보이게 합니다.
warm luminous vibe|따뜻하게 빛나는 분위기|따뜻한 계열의 빛이 공간에 은은하게 퍼져 밝고 포근하게 느껴지게 합니다.
neon pink and cyan lighting|네온 분홍·청록 조명|네온 분홍과 청록의 빛이 서로 다른 방향이나 표면에 비쳐 두 색의 강한 대비를 만듭니다.
cyan and purple neon lighting|청록·보라 네온 조명|청록과 보라의 선명한 인공광으로 주변 표면을 물들여 디지털 도시 같은 분위기를 만듭니다.
pink inner border|분홍 안쪽 테두리|화면 바깥 가장자리보다 조금 안쪽에 분홍 선을 둘러 그림의 안쪽 영역을 구분합니다.
soft celestial backlight|부드러운 천체 역광|인물 뒤에서 천체의 빛처럼 은은한 역광이 들어와 윤곽이 부드럽게 드러나게 합니다.
urban skyline|도시의 스카이라인|높이가 서로 다른 건물들이 하늘과 맞닿아 만드는 윤곽을 보여 도시의 규모와 원경을 드러냅니다.
clear water|투명한 물|물속의 바닥이나 대상이 비칠 만큼 물을 맑고 투명하게 표현해 수심과 잠긴 형태가 보이게 합니다.
pixel cursor|픽셀 마우스 커서|마우스 포인터의 화살표 윤곽을 계단식 사각 픽셀로 그려 옛 컴퓨터 화면의 조작 기호를 만듭니다.
column text|여러 단으로 나눈 글|신문이나 잡지처럼 본문을 세로로 길게 여러 단에 나눠 배치해 편집 지면의 구조를 만듭니다.
""")


def particle(text: str, pair: str) -> str:
    last = text.rstrip()[-1]
    final = (ord(last) - 0xAC00) % 28 if "가" <= last <= "힣" else 0
    if pair == "으로":
        return "으로" if final and final != 8 else "로"
    return {"을": ("을", "를"), "이": ("이", "가"), "은": ("은", "는")}[pair][0 if final else 1]


def translate(tag: str) -> tuple[str, list[str]]:
    # Work on English spans only so Korean replacements cannot be reprocessed.
    pattern = re.compile(r"(?<![a-z0-9])(?:" + "|".join(re.escape(key) for key in sorted(PHRASES, key=len, reverse=True)) + r")(?![a-z0-9])", re.I)
    value = pattern.sub(lambda match: PHRASES[match.group(0).lower()], tag.lower())
    unknown = re.findall(r"[a-z]+(?:'[a-z]+)?", value)
    value = re.sub(r"\s*[-/]\s*", "·", value)
    value = re.sub(r"\s*·\s*", "·", value)
    value = re.sub(r"\s+", " ", value).strip(" ·")
    return value, unknown


# An anchor explains what the requested object does visually; translated
# modifiers preserve the exact requested color, scale, placement and material.
ENV_EFFECTS: list[tuple[str, str]] = [
    (r"aquarium tunnel", "투명한 수조 통로 바깥으로 물과 생물이 보이게 해 물속을 걷는 듯한 깊이를 줍니다."),
    (r"inside claw machine", "인형 뽑기 기계의 유리 안쪽을 장면의 공간으로 삼아 인형과 집게가 가까이 둘러싸게 합니다."),
    (r"inside ferris wheel cabin", "관람차의 작은 객실 안에 장면을 두어 창문 너머의 높이와 실내의 가까운 거리를 대비시킵니다."),
    (r"jewelry box", "보석함 안쪽의 벽과 장식이 인물을 둘러싸는 작은 공간으로 배치합니다."),
    (r"window view|large window|window in background", "창문을 인물 뒤의 큰 공간 요소로 배치해 실내와 창밖의 깊이를 나눕니다."),
    (r"window seat", "창가에 앉거나 기댈 수 있는 낮은 좌석을 만들어 창과 인물의 동작을 연결합니다."),
    (r"train window frame", "열차 창의 단단한 사각 경계가 보이게 해 차내와 바깥 풍경을 구분합니다."),
    (r"rooftop terrace", "높은 야외 공간과 난간·천 장식의 개방감을 살려 하늘이 가까운 장소로 만듭니다."),
    (r"teddy bear|stuffed bear|rabbit plush|plushie|plush toys|stuffed toy", "봉제 인형의 둥근 덩어리와 부드러운 표면을 주변에 배치해 포근한 소품의 밀도를 더합니다."),
    (r"bed of roses|rose|flowers|sunflower|flower field|flower bed|floral|morning glory", "꽃의 색과 겹친 꽃잎을 주변에 채워 자연스럽고 장식적인 배경의 덩어리를 만듭니다."),
    (r"stained glass", "색유리 조각과 그 경계가 보이게 해 건축물 안에 장식적인 색면을 만듭니다."),
    (r"starry sky ceiling", "천장에 별이 있는 밤하늘을 펼쳐 실내가 하늘 아래처럼 느껴지게 합니다."),
    (r"\bsky\b|starfield|nebula", "인물 뒤쪽에 넓은 하늘의 색면과 원경을 펼쳐 열린 공간감을 만듭니다."),
    (r"cloud", "부피가 있는 구름 덩어리를 겹쳐 하늘이나 배경에 부드러운 층과 깊이를 더합니다."),
    (r"cityscape|skyline|city|metropolis|skyscraper|town|building|european town", "여러 건물의 높이와 겹침이 보이게 해 인물 뒤에 도시의 규모와 거리감을 만듭니다."),
    (r"cathedral|church|temple|palace interior", "기둥과 벽·창이 둘러싼 종교적이거나 장대한 실내 구조를 배경으로 만듭니다."),
    (r"architecture|palace|castle|pavilion|japanese house|cabin|treehouse", "건축 양식의 지붕과 기둥·벽 구조가 보이게 해 장면의 문화와 공간 성격을 정합니다."),
    (r"amusement park|carousel|merry-go-round|ferris wheel", "놀이기구의 둥근 형태와 장식을 배치해 축제와 놀이공원의 장소감을 만듭니다."),
    (r"stage|stadium|venue|crowd|audience", "무대와 관객이 차지하는 면적을 만들어 공연이나 행사가 열리는 장소임을 드러냅니다."),
    (r"arcade|gaming cabinet|claw crane|claw machine", "게임 기계의 화면과 단단한 박스형 구조를 배치해 오락 공간의 밀도를 만듭니다."),
    (r"medical|hospital", "진료와 실험을 연상시키는 공간이나 도구를 배치해 의료 시설의 맥락을 드러냅니다."),
    (r"dessert|sweet shop|cafe|diner|storefront|menu board", "가게의 가구와 진열·간판 요소를 배치해 먹고 쉬는 상업 공간의 분위기를 만듭니다."),
    (r"classroom|school|locker", "교실 가구와 학교 비품을 배치해 학교 생활 공간의 구조가 읽히게 합니다."),
    (r"garden|forest|ivy|foliage|canopy|tree|bush|plants|bamboo", "식물의 줄기와 잎을 겹쳐 놓아 인물 주변에 자연의 층과 무성함을 만듭니다."),
    (r"grassy|green field|hill", "잔디나 풀의 넓은 면을 펼쳐 탁 트인 지면과 완만한 지형을 만듭니다."),
    (r"ocean|seaside|beach|sea foam", "바다와 해변의 넓은 수평 공간을 만들어 물과 육지의 경계가 느껴지게 합니다."),
    (r"underwater|aquarium|fish tank", "시야 주변을 물이나 수조가 감싸게 해 물속의 깊이와 투명한 공간감을 만듭니다."),
    (r"water splash|water drops|water ripples|clear water|shallow water|water-like", "물의 표면과 움직이는 경계를 넣어 젖은 질감이나 수면의 흔들림이 보이게 합니다."),
    (r"tube|floats|pool|poolparty", "물놀이 공간의 튜브와 풀장 요소를 배치해 밝고 가벼운 여름 장소감을 만듭니다."),
    (r"bedroom|living room|sunroom|playroom|room|indoors|indoor", "인물 주변에 실내의 벽과 가구가 이어지도록 해 닫힌 생활 공간의 깊이를 만듭니다."),
    (r"bed|bedding|pillow|blanket|cushion|rug", "눌리고 접히는 천과 푹신한 표면을 배치해 쉬거나 몸을 지지하는 자리를 만듭니다."),
    (r"sofa|table|desk|seat|chairs|cabinet|closet|shelves", "가구의 평면과 다리·수납 구조를 배치해 인물의 크기와 실내 동선을 드러냅니다."),
    (r"curtain|tablecloth|runner|tulle", "천을 늘어뜨리거나 펼쳐 주름과 부드러운 곡선이 공간의 장식이 되게 합니다."),
    (r"clockwork|gear|clock faces", "톱니와 시계 부품의 반복을 배치해 기계적인 복잡함과 원형의 리듬을 만듭니다."),
    (r"wire|cable|power lines|utility pole", "길게 이어지는 선과 연결 구조를 드러내 도시나 기계 공간의 선형 디테일을 만듭니다."),
    (r"statue|arches|archway|pillars|ruins", "돌 구조물의 두께와 높낮이를 배치해 오래된 공간의 무게와 깊이를 만듭니다."),
    (r"train|locomotive|carriage|car", "탈것의 차체와 창·바퀴 같은 구조를 배치해 이동 공간의 맥락을 만듭니다."),
    (r"street|road|crosswalk|track|racetrack|tennis court|catwalk|engawa", "길이나 통로가 이어지는 방향을 보여 인물이 서 있는 지면과 이동 경로를 만듭니다."),
    (r"floor|stone tiles|wall|fence|gate|door|glass panel|brick", "바닥이나 벽의 단단한 면과 경계가 보이게 해 인물을 둘러싼 공간의 구조를 만듭니다."),
    (r"window", "창의 틀과 바깥쪽이 함께 보이게 해 실내와 외부의 경계를 만듭니다."),
    (r"mirror", "거울 표면과 반사되는 공간을 넣어 화면 안에 겹친 시야와 깊이를 만듭니다."),
    (r"space|galaxy|milky way", "멀리 이어지는 우주와 별의 공간을 펼쳐 일상적인 방이나 도시에서 벗어난 규모를 만듭니다."),
    (r"horizon", "먼 하늘과 지면 또는 수면이 만나는 수평선을 드러내 넓은 원경을 만듭니다."),
    (r"fireplace", "벽난로의 구조를 실내에 배치해 불을 피우고 모이는 생활 공간의 중심을 만듭니다."),
    (r"objects|object set|clutter", "여러 사물이 차지하는 면적과 겹침을 늘려 배경의 생활감과 밀도를 더합니다."),
    (r"white space|soft void", "세부 사물 없이 넓고 비어 있는 면을 남겨 인물의 윤곽과 여백을 강조합니다."),
    (r"background|backdrop", "인물 뒤의 바탕을 지정해 장면 전체의 색면·표면·장식 밀도를 바꿉니다."),
    (r"outdoor|outdoors|backyard", "벽으로 닫히지 않은 바깥 공간을 배경으로 잡아 지면과 원경이 이어지게 합니다."),
]

GRAPHIC_EFFECTS: list[tuple[str, str]] = [
    (r"no pattern", "바탕을 무늬 없이 비워 색면과 인물의 윤곽이 먼저 보이게 합니다."),
    (r"large title|typography|headline|cover lines|text logo", "글자의 크기와 굵기가 그림의 큰 덩어리가 되어 표지나 포스터 같은 시각적 위계를 만듭니다."),
    (r"random|gibberish", "읽을 수 있는 문장보다 임의의 문자 모양을 장식과 정보처럼 배치합니다. 특정 문구를 정확히 지정하지는 않습니다."),
    (r"text|lettering|ascii|kaomoji|copyright", "글자나 문자 기호를 이미지 위에 배치해 인쇄물·화면 요소가 함께 있는 구성을 만듭니다."),
    (r"icon|cursor", "작은 기호와 아이콘을 배치해 컴퓨터 화면이나 안내 그래픽 같은 정보 요소를 더합니다."),
    (r"annotation|letter marks|punch holes|highlight marks|correction marks", "작업 과정에서 붙인 듯한 표기와 흔적을 더해 원화·설정 자료의 성격을 드러냅니다."),
    (r"speech bubbles", "말풍선 모양의 빈 면을 넣어 인물의 감정이나 만화적인 대화 공간을 만듭니다."),
    (r"outline", "대상 가장자리를 따라 선을 둘러 배경과 인물 또는 장식을 뚜렷하게 분리합니다."),
    (r"border|frame|bordered", "화면이나 대상 둘레를 장식선으로 감싸 안쪽 그림과 바깥 공간의 경계를 만듭니다."),
    (r"grid|checkered|plaid|gingham", "반복되는 수직·수평선이나 사각형 면을 깔아 배경에 규칙적인 간격과 색의 리듬을 만듭니다."),
    (r"halftone|screen tone", "작은 점의 크기와 간격을 반복해 인쇄 만화처럼 명암과 질감을 표현합니다."),
    (r"polka dot", "같은 크기나 서로 다른 크기의 둥근 점을 반복해 경쾌한 바탕 무늬를 만듭니다."),
    (r"paper texture|notebook paper", "종이의 표면이나 줄을 드러내 디지털 배경보다 실제 인쇄·노트처럼 느껴지게 합니다."),
    (r"paper tear|torn paper|tape|paper clip|postmark", "뜯고 붙이거나 고정한 흔적을 남겨 실제 종이 조각을 조합한 스크랩북 느낌을 만듭니다."),
    (r"graffiti|doodle|hand-drawn", "손으로 빠르게 그린 선과 낙서를 남겨 정돈된 도형보다 자유로운 장식을 만듭니다."),
    (r"paint splat|paint mess", "물감이 튀거나 흩어진 불규칙한 흔적으로 배경에 방향감과 거친 색 덩어리를 더합니다."),
    (r"ribbon|bows", "리본의 곡선과 매듭 모양을 그래픽 장식으로 배치해 화면의 흐름과 귀여운 포인트를 만듭니다."),
    (r"engraving|filigree", "가는 선이 복잡하게 얽힌 장식을 표면에 새겨 고전적인 세공의 밀도를 더합니다."),
    (r"sticker", "잘라 붙인 작은 그림 조각처럼 경계가 분리된 장식을 배치합니다."),
    (r"barcode", "줄무늬 바코드를 작은 인쇄 요소로 더해 상품 표지나 편집 디자인의 인상을 만듭니다."),
    (r"badge", "작은 배지 장식을 표면에 붙인 듯 배치해 취향이 드러나는 세부 요소를 더합니다."),
    (r"heart|star|fruit|cherry|paw|snowflake|cross", "알아볼 수 있는 상징 모양을 장식이나 반복 무늬로 배치해 화면의 주제를 드러냅니다."),
    (r"geometric|triangles|simple shapes", "사물 묘사 대신 도형의 각과 곡면을 배치해 추상적인 그래픽 구성을 만듭니다."),
    (r"stripes|horizontal line", "평행한 선을 반복해 화면에 일정한 방향과 간격을 만듭니다."),
    (r"graphic background|graphic patterns", "실제 장소 대신 그래픽 무늬와 색면으로 인물 뒤의 공간을 구성합니다."),
]


def light_effect(tag: str) -> str:
    patterns = [
        (r"bokeh", "초점 밖의 빛을 둥글고 흐린 덩어리로 만들어 인물 뒤에 거리감과 반짝임을 더합니다."),
        (r"blurry background|blurred crowd", "먼 배경이나 군중의 세부를 흐려 인물의 경계가 상대적으로 또렷하게 보이게 합니다."),
        (r"reflections|reflection|reflective", "표면 위에 주변의 빛과 형태가 비치게 해 유리·물·바닥의 반사 성질을 드러냅니다."),
        (r"rim light|backlight", "인물 가장자리나 뒤에서 빛이 들어오게 해 어두운 윤곽을 가는 빛으로 분리합니다."),
        (r"dappled", "잎이나 가림막 사이로 걸러진 빛이 작은 얼룩으로 떨어져 표면에 불규칙한 밝기를 만듭니다."),
        (r"sunlight|sunbeams|sun rays|sun$|daylight|daytime", "태양에서 오는 빛이 표면과 공간을 비춰 자연광의 밝기와 방향이 느껴지게 합니다."),
        (r"moonlight|moonlit", "달빛이 비치는 듯한 차갑고 약한 빛을 넣어 밤의 어둠과 인물 윤곽을 나눕니다."),
        (r"window light", "창문 쪽에서 빛이 들어오게 해 얼굴과 실내의 한 방향을 밝힙니다."),
        (r"rays|beams", "공간을 가로지르는 빛줄기가 보이게 해 광원의 방향과 공기 중 깊이를 드러냅니다."),
        (r"sparkle|glitter|twinkling|sparkling", "작은 점과 별 모양의 하이라이트를 흩뿌려 표면이나 공기가 반짝이는 느낌을 만듭니다."),
        (r"particles|fairy dust", "작은 입자가 빛을 내도록 해 공기 중에 떠 있는 점과 공간의 깊이를 보여 줍니다."),
        (r"magic circle", "원을 이루는 마법 문양을 광학 효과처럼 배치해 인물 주변에 마법의 중심을 만듭니다."),
        (r"shadow", "빛이 닿지 않는 영역의 모양과 농도를 강조해 물체의 부피와 바닥과의 관계를 드러냅니다."),
        (r"string lights|fairy lights|lightbulbs", "작은 전구를 여러 개 배치해 공간에 반복되는 점광원과 따뜻한 장식을 만듭니다."),
        (r"neon", "채도가 높은 인공광이 물체의 윤곽과 표면을 물들여 밤이나 전자 공간 같은 인상을 만듭니다."),
        (r"holographic", "실체가 없는 투영 빛처럼 여러 색이 얇게 겹치고 비쳐 보이게 합니다."),
        (r"stage|concert|theatrical|spotlight|chandelier|candlelight|streetlight", "특정 조명 장치에서 빛이 들어오도록 해 장면의 장소와 주목 지점을 함께 드러냅니다."),
        (r"screen glow", "화면 자체가 광원이 되어 주변 얼굴이나 손에 인공적인 빛이 반사되게 합니다."),
        (r"soft", "그림자의 경계를 완만하게 풀어 표면의 명암이 부드럽게 이어지게 합니다."),
        (r"dim|heavy|dark", "광량을 낮추거나 그늘을 짙게 해 밝은 부분이 제한된 어두운 공간을 만듭니다."),
        (r"warm", "노랑·주황 계열의 빛이 표면에 섞이도록 해 따뜻한 광원의 인상을 만듭니다."),
        (r"blue|cool", "푸른 계열의 빛이 인물과 주변 표면을 물들여 차가운 조명색을 만듭니다."),
        (r"realistic", "광원의 위치에 맞춰 명암과 반사가 이어지도록 해 자연스러운 빛의 반응을 만듭니다."),
        (r"studio|clean", "인물의 형태와 색이 잘 읽히도록 정돈된 광원을 배치합니다."),
        (r"dramatic|cinematic|dynamic", "광원의 방향과 밝기 차이를 강조해 형태에 극적이거나 움직임이 느껴지는 명암을 더합니다."),
        (r"glow|glowing|luminous", "대상이나 빛의 중심이 스스로 발광하는 듯 주변까지 광채가 퍼지게 합니다."),
        (r"lighting|light", "광원의 색과 밝기를 표면에 반영해 장면의 명암과 조명 분위기를 바꿉니다."),
    ]
    for pattern, effect in patterns:
        if re.search(pattern, tag):
            return effect
    raise ValueError(f"Missing light effect: {tag}")


def composed(item: dict) -> tuple[str, str, list[str]]:
    tag, facet = item["tag"].lower(), item["facet"]
    label, unknown = translate(tag)
    lead = f"{label}{particle(label, '으로')} "
    if facet == "palette":
        if "highlights" in tag:
            effect = "밝은 부분의 포인트 색이 여러 색으로 갈라져 보이게 합니다."
        elif "contrast" in tag:
            effect = "서로 다른 밝기나 색이 맞닿아 화면의 대비를 선명하게 만듭니다."
        elif "pastel" in tag:
            effect = "채도를 순하게 낮춘 옅은 색들이 인물과 배경에 함께 나타나게 합니다."
        elif "neon" in tag or "vibrant" in tag or "vivid" in tag:
            effect = "선명한 색의 비중을 높여 색면이 강하고 또렷하게 눈에 들어오게 합니다."
        else:
            effect = "인물과 배경에 반복되는 중심 색을 정해 화면의 색감을 통일합니다."
    elif facet == "environment":
        effect = next((effect for pattern, effect in ENV_EFFECTS if re.search(pattern, tag)), None)
        if effect is None:
            raise ValueError(f"Missing environment effect: {tag}")
    elif facet == "graphics":
        effect = next((effect for pattern, effect in GRAPHIC_EFFECTS if re.search(pattern, tag)), None)
        if effect is None:
            raise ValueError(f"Missing graphic effect: {tag}")
    elif facet == "light":
        effect = light_effect(tag)
    else:
        raise ValueError(f"Missing exact definition for {facet}: {tag}")
    return label, lead + effect, unknown


def load_items(input_path: Path | None) -> list[dict]:
    if input_path:
        return json.loads(input_path.read_text(encoding="utf-8"))
    node = r"const fs=require('fs'),vm=require('vm');const c={window:{}};for(const f of ['corpus-library','guided-corpus'])vm.runInNewContext(fs.readFileSync('site/'+f+'.js','utf8'),c);process.stdout.write(JSON.stringify(c.window.PM_GUIDED_CORPUS.items.map(i=>({id:i.id,tag:i.tag,label:i.label,facet:i.facet,stageId:i.stageId,section:i.section}))));"
    result = subprocess.run(["node", "-e", node], cwd=ROOT, check=True, stdout=subprocess.PIPE)
    return json.loads(result.stdout.decode("utf-8"))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path)
    parser.add_argument("--output", type=Path, default=ROOT / "site" / "guided-descriptions-world.js")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    items = [item for item in load_items(args.input) if item["stageId"] in STAGES]
    output = {}
    unresolved = {}
    coverage = Counter()
    for item in items:
        tag = item["tag"].lower()
        if tag in EXACT:
            label, description = EXACT[tag]
            unknown = []
            coverage["curated"] += 1
        else:
            label, description, unknown = composed(item)
            coverage["composed"] += 1
        if unknown:
            unresolved[item["tag"]] = unknown
        if len(re.findall("[가-힣]", description)) < 15:
            raise ValueError(f"Description does not explain the image effect: {tag}: {description}")
        output[item["id"]] = {"label": label, "description": description}
    if unresolved:
        raise ValueError("Untranslated source words: " + json.dumps(unresolved, ensure_ascii=False, indent=2))
    source = '// Generated by tools/guided_descriptions_world.py; original English tags remain in the corpus.\n(function () {\n  "use strict";\n  Object.assign(window.PM_GUIDED_DESCRIPTIONS ||= {}, ' + json.dumps(output, ensure_ascii=False, indent=2) + ');\n})();\n'
    if args.check:
        if args.output.read_text(encoding="utf-8") != source:
            raise SystemExit("World descriptions are stale; rebuild with guided_descriptions_world.py")
    else:
        args.output.write_text(source, encoding="utf-8")
    print(f"World descriptions: {len(output)} items; {coverage['curated']} curated, {coverage['composed']} fully translated compositions, 0 untranslated; {'verified' if args.check else 'written'}.")


if __name__ == "__main__":
    main()
