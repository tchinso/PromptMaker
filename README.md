# PromptMaker

Image Prompt 1–17의 원본 표현을 의미별 레이어로 다시 정리해, NovelAI 이미지 프롬프트를 조합하는 정적 웹 앱입니다. 장면·외형·컨셉·분위기·의상·소품·구도의 일반 선택 단계에서 표현을 독립적으로 조합합니다.

205개 프롬프트의 571개 섹션·변형에 등장하는 4,964개 표현을 3,217개 개별 선택지로 연결했습니다. 모든 표현을 머리·눈·의상·소품 등 해당 질문의 **계열별 세부 선택**에 통합했습니다. 큰 계열 → 작은 계열 → 세부 표현으로 좁혀 고르며, 필요한 분류는 디테일 계열을 한 단계 더 거칩니다. 한 번에 최대 12개 표현을 표시하고, 한국어·영문·설명 검색은 해당 질문의 모든 분류를 함께 찾습니다. 다른 계열이나 기본 선택지로 바꿔도 선택한 개별 표현과 원본 강조값은 보존됩니다. 선택 요약을 누르면 원래 분류와 강조값으로 돌아갑니다. 모든 개별 표현에는 한국어 설명과 원래 영문 태그를 함께 표시하며, 생성 프롬프트에는 원본 영문 표현과 강조값을 사용합니다. 이전 보관함과 자동 저장본도 같은 ID로 이어서 사용합니다.

그림 카드 48개는 매체·편집 화면·그래픽·공간·의상 구조·복합 자세를 직접 보여줍니다. 계층 분류에는 새로 생성한 그림 24개를 사용하며, 개별 태그의 정확한 차이는 이름과 설명으로 표시합니다. 새 카드와 개별 선택은 밀도에 관계없이 모두 유지합니다. 기존 카드의 자동 디테일은 간결·기본·고밀도에서 영역별 1개·2개·전체 태그를 사용하며, 직접 고른 세부 슬롯과 입력은 항상 보존합니다. 새 작업에는 빈도 기반 스타일 태그를 강제로 추가하지 않습니다.

이 저장소의 배포 대상은 `site/` 하나입니다. 빌드 도구, 서버, Cloudflare Worker, Pages Functions를 사용하지 않습니다.

## 로컬 미리보기

저장소 루트에서 정적 서버를 실행합니다.

```powershell
py -m http.server 4173 --directory site
```

그다음 <http://127.0.0.1:4173/>을 엽니다. `index.html`을 파일로 직접 여는 방식보다 정적 서버 미리보기를 권장합니다.

배포 전 검사는 Node.js 외 의존성이 없습니다.

```powershell
node tools/verify-static-site.mjs
node tools/verify-prompt-behavior.mjs
node tools/verify-guided-corpus.mjs
node tools/verify-guided-descriptions.mjs
node tools/verify-guided-hierarchy.mjs
```

검사는 필수 파일, HTML의 로컬 의존성, 선택 카드·세부 조정 칩의 이미지 연결, 실제 셀 경계, 외부 네트워크 주소, Worker/Functions 진입점 유무를 확인합니다. 배포용 이미지는 `site/assets/visual-guides/options/` 아래의 ImageGen 카드용 아틀라스만 허용하며, 이전 `assets/reference`, `assets/generated`, `tools/reference-assets.json`가 남아 있으면 실패합니다.

이미지 크기와 경계 여백은 `site/atlas-crops.js`에서 관리합니다. 균등한 4×3 시트는 기본 분할을 사용하고, 행·열 크기 또는 그림 개수가 다른 시트는 `tools/atlas_cell_bounds.json`의 그림별 좌표로 자릅니다. 초상은 상단 정렬을 지원하며, 카드와 세부 칩에 동일한 정사각형 크롭을 사용해 비율 왜곡을 방지합니다. 새 계층 그림은 경계선 없는 4×3 시트를 생성하고 실측 셀에서 12px 안쪽의 안전 영역에 크롭 여백을 추가합니다. 이미지 변경 후 `python tools/build_atlas_crops.py`로 갱신하고 실제 테두리·인접 그림 유입을 확인하세요. [기존 카드 생성 프롬프트](docs/guided-image-prompts.json)와 [계층 분류 그림의 생성 프롬프트·실측 좌표](docs/hierarchy-image-prompts.json)도 함께 보관합니다.

## 로컬 스타일 코퍼스 갱신

`C:\Codex\Image Prompt`의 HTML과 저장소 루트의 `novelai_tags.json`은 제작 시에만 쓰는 로컬 입력입니다. 원본 그림은 GitHub와 배포 산출물에 포함하지 않습니다. 배포 대상인 `site/`는 원본 경로에 의존하지 않고, 생성된 코퍼스·의미 레이어·태그 카탈로그만 사용합니다. 원본 아카이브가 있는 작업 환경에서만 아래를 실행해 이를 다시 만듭니다. `--source`를 생략하면 저장소의 `References/`를 사용합니다.

```powershell
py tools/extract_corpus_library.py --source "C:\Codex\Image Prompt"
node tools/build-novelai-tag-catalog.mjs
node tools/verify-static-site.mjs
node tools/verify-prompt-behavior.mjs
```

추천은 원시 태그 수치를 프롬프트 강조값으로 바꾸지 않습니다. 대신 같은 의미군의 프롬프트 등장 빈도와 수동 우선도를 가중 추첨에 반영합니다. 교복·수영복·캐주얼·프릴/고딕·전통복·스포츠웨어는 세부 변주와 추천 비중을 높이고, 테크웨어처럼 희소한 계열은 핵심 선택지만 유지합니다.

한국어 설명은 세 생성기에서 관리합니다. 코퍼스 표현을 바꿨다면 아래 명령으로 갱신합니다. 새 표현에 대한 번역·설명 규칙이 빠지면 생성기 또는 설명 검사에서 확인할 수 있습니다.

```powershell
py tools/guided_descriptions_world.py
py tools/guided_descriptions_outfit.py
py tools/guided_descriptions_action.py
node tools/verify-guided-descriptions.mjs
```

브라우저 검사는 실행 중인 로컬 서버와 Playwright를 사용합니다. 전체 선택·저장·기존 이미지 검사는 `node tools/verify-guided-browser.cjs`, 계층의 모든 표현 접근·강조값·한국어 검색·한글 조합 입력·모바일·새 이미지 크롭은 `node tools/verify-hierarchy-browser.cjs`, 설명 표시는 `node tools/verify-guided-descriptions-browser.cjs`로 확인합니다.

로맨스·관계·의상 분위기 선택지는 기본 흐름에서 바로 사용할 수 있습니다. 노골적 성행위, 노골적 노출, 속옷 조작 태그는 카탈로그 검색과 직접 입력에서 제외됩니다.

## Cloudflare Pages 배포

Cloudflare 대시보드에서 Git 저장소를 Pages 프로젝트로 연결하고 다음 값으로 설정합니다.

| 설정 | 값 |
|---|---|
| Framework preset | `None` |
| Root directory | 비움 (저장소 루트) |
| Build command | 비움 |
| Build output directory | `site` |
| Environment variables | 없음 |

저장하면 Cloudflare Pages가 `site/`의 파일을 그대로 배포합니다. 별도의 서버 코드나 런타임 설정은 필요하지 않습니다.

`site/_headers`에는 보안 헤더와 캐시 정책이 들어 있습니다. `/assets/*`는 긴 immutable 캐시를 사용하므로, 배포 후 이미지를 교체할 때는 파일명을 바꾸는 것이 가장 안전합니다. 같은 파일명을 유지했다면 Cloudflare 캐시를 제거해야 할 수 있습니다.

## 정적 앱 구조

```text
site/
├─ index.html           # 앱 셸
├─ styles.css           # 전체 UI 스타일
├─ data.js              # 단계·선택지·세부 조절 데이터
├─ corpus-library.js    # 로컬 프롬프트 코퍼스 라이브러리
├─ novelai-tag-catalog.js # 로컬 NovelAI 태그 카탈로그의 배포용 스냅샷
├─ freedom-data.js      # 참조 빈도 기반 확장 질문·가중치
├─ corpus-studio.js     # 이전 저장본 변환용 호환 컴파일러
├─ guided-options.js    # 새 그림 카드 48개·단계별 확장 질문
├─ guided-corpus.js     # 전체 원본 표현의 개별 선택·강조값·저장본 변환
├─ guided-hierarchy.js  # 모든 개별 표현을 기존 질문과 의미 계층에 연결
├─ guided-descriptions-*.js # 세계·인물, 의상, 소품·구도의 한국어 설명
├─ atlas-crops.js       # 실제 이미지 크기·검수한 경계 여백
├─ app.js               # 상태 관리와 프롬프트 컴파일러
├─ assets/
│  └─ visual-guides/options/ # 선택 카드·세부 칩용 ImageGen 타일
└─ _headers             # Cloudflare Pages 응답 헤더
```

데이터나 앱 코드를 바꾼 뒤에도 별도 빌드는 하지 않습니다. 변경 사항을 커밋하고 Pages 배포가 끝나면 새 버전이 반영됩니다.

## 데이터와 개인정보

- 프롬프트 생성과 검색은 브라우저 안에서만 수행됩니다.
- 현재 작업 상태와 저장한 프리셋은 해당 브라우저의 `localStorage`에만 보관됩니다.
- 앱은 API, 분석 도구, 로그인, 원격 동기화를 사용하지 않습니다.
- `site/_headers`의 CSP는 앱의 외부 네트워크 연결을 차단합니다 (`connect-src 'none'`).
- 브라우저의 해당 사이트 데이터를 지우면 자동 저장 상태와 프리셋도 삭제됩니다.
- Cloudflare가 정적 파일 요청에 대해 제공하는 일반적인 CDN/접속 로그는 앱 자체의 프롬프트 저장·전송 기능과는 별개입니다.

## Workers/Functions 미사용 확인

이 앱에는 `functions/`, `_worker.js`, Worker `fetch` 핸들러가 필요하지 않습니다. Pages 설정에서도 Functions나 Worker 바인딩을 추가하지 마세요. 동적 기능이 필요해지기 전까지 배포 구조는 순수 정적으로 유지합니다.
