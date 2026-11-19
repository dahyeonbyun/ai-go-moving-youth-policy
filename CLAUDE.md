# 프로젝트: 이사 청년 제도 비교 (링커스 AI:GO 개인 프로젝트 · Level 3)

## 한 줄 정의
경기 수원시 → 서울 마포구로 이사하는 청년이 자기 조건을 넣으면, 이사 때문에 **새로 생기는 / 사라지는 / 유지되는** 청년 제도를 공고 원문 근거와 함께 표로 보여주는 웹 페이지.
Level 3 = 공고 원문을 붙여넣으면 LLM API가 자격 조건을 구조화 데이터로 정리해 주는 기능 포함.

## 반드시 지킬 원칙
1. **판정은 코드가 한다.** LLM은 공고 → 조건 데이터 *추출*만 한다. 해당 여부 판단을 LLM에 맡기지 않는다. 같은 입력이면 누가 몇 번 돌려도 같은 결과.
2. **정보가 없거나 "모름"이면 '확인 필요'.** 절대 '해당'으로 단정하지 않는다. (완료 조건: 잘못된 '해당' 0개)
3. **모든 조건에는 공고 원문 문장(quote)과 출처 링크**가 붙는다.
4. **데이터는 `raw/`의 원문에서만 만든다.** 원문에 없는 값을 추측해서 채우지 말 것. 불확실하면 `null`로 두고 나에게 물어볼 것.
5. **API 키는 `.env`에만.** 프런트엔드 코드·커밋에 절대 넣지 않는다. `.gitignore`에 `.env` 포함.
6. **`index.html`은 서버 없이 더블클릭으로 열어도 작동**해야 한다 (이때는 mock 모드). 그래서 데이터는 `fetch`로 JSON을 읽지 말고 `data/*.js`에 `window.XXX = ...` 형태로 넣는다.
7. 각 단계가 끝나면 **멈추고 결과를 요약해서 확인받은 뒤** 다음 단계로 간다.

## 고정 시나리오
- 이사 전: 경기도 · 수원시 / 이사 후: 서울시 · 마포구 / 그 외: 중앙부처(전국)
- 지역 선택 기능은 만들지 않는다.

## 폴더 구조
```
ai-go/
├─ CLAUDE.md
├─ index.html              빈 틀 (#stage) + 스크립트. 화면은 app.js가 해시 주소에 따라 그림
├─ css/style.css           디자인 토큰 · 화면 스타일
├─ fonts/                  Pretendard 400/600 woff2 + LICENSE.txt (OFL, 로컬 사용 — CDN 금지)
├─ js/logic.js             판정 로직 (브라우저 + Node 양쪽에서 동작, 외부 의존성 없음)
├─ js/app.js               해시 라우터 · 단계형 화면(소개 · 질문 7개 · 비교 중 · 결과 · 검증 · 공고 추가)
├─ js/extract-client.js    extractConditions(text) — mock/live 분기
├─ data/policies.js        window.POLICIES = [...]   (원문 대조 끝난 확정 데이터)
├─ data/raw-texts.js       window.RAW_TEXTS = {id: 원문}  (공고 추가 데모용)
├─ data/mock-extractions.js window.MOCK_EXTRACTIONS = {id: 추출결과}
├─ data/answer-key.js      window.ANSWER_KEY = ...  (내가 직접 만든 정답, answer-key.md에서 변환)
├─ prompts/extract.md      추출 지시문 (서버가 system prompt로 사용)
├─ server.js               로컬 서버: 정적 파일 + /api/extract (Node 18+, 의존성 없이)
├─ test/run-presets.js     node로 프리셋 3개 판정 결과 출력 + 정답 대조
├─ test/check-quotes.js    모든 quote가 raw/ 원문에 있는지 검사 + data/raw-texts.js 생성
├─ raw/                    공고 원문 .txt (제도별 1개, 첫 줄에 출처 URL)
├─ answer-key.md           내가 공고를 직접 읽고 만든 정답 판정
├─ .env.example            PROVIDER=, API_KEY=, MODEL=, PORT=3000
└─ .gitignore              .env
```

## 화면 구성 (단계형, 해시 라우팅 — file://에서도 작동)
```
#/  소개 → #/q/1 ~ #/q/7 (질문 하나씩) → 비교 중(0.8초, 주소 없음) → #/result
#/check (검증) · #/add (공고 추가) — 결과 화면 맨 아래 작은 링크로만
```
- **입력값은 주소에 넣는다**: `#/result?age=24&status=employed&single=1&housing=monthly_rent&income=p60_100&gg=y3_up&move=2026-12-01`. 새로고침해도 결과 유지. 질문에서 답할 때마다 `history.replaceState`로 주소를 맞춘다.
- 주소의 입력이 모자라면 `#/result`는 첫 빈 질문으로 보낸다.
- **추가 질문 답은 메모리에만**. 결과의 입력이 바뀌면 답 · 펼침 상태를 비운다.

### 1. 소개 `#/`
- 좌: 작은 라벨 "청년 정책 비교" / 큰 제목 "이사 가면, 내 청년 제도는 어떻게 바뀔까"(56px 이상) / 회색 설명 2줄 / [비교하기](주요) + [예시 보기](보조)
- [예시 보기]: 예시 3개(프리셋)가 펼쳐지고, 고르면 질문을 건너뛰고 비교 중 → 결과. 펼친 상태에서 숫자키 1~3도 가능.
- 하단 작은 줄: "경기 수원시 → 서울 마포구 · 공고 원문 n건 · 기준일 YYYY-MM-DD" (가짜 사용자 수 · 평점 금지)
- 우: 직접 그린 SVG — 1px 단색 선, 채움 없음. 수원(집)·마포(건물) 선 아이콘을 점선 곡선으로 잇고, 작은 원이 곡선을 따라 5초 주기로 이동. 뒤의 옅은 동심원이 90초에 한 바퀴 회전.
- 모바일(≤860px): 일러스트가 제목 아래로.

### 2. 질문 `#/q/1` ~ `#/q/7`
- 화면 세로 중앙, 최대 폭 560px. 상단: [이전] · "02 / 07" · 얇은 진행선. 제목 32px/600 + 회색 보조 설명 한 줄.
- 전환: 앞으로 가면 이전 질문은 위로 사라지고 다음 질문이 아래에서 올라옴(400ms ease-out), 뒤로 가면 반대.
- 고르면 0.3초 뒤 자동으로 다음 (마우스·터치·숫자키. 방향키로 옮길 때는 고르기만). 이미 고른 것을 다시 눌러도 다음.
- 키보드: 숫자키 선택, Enter 다음, Esc 이전 (질문 1에서 Esc는 소개로).
- **브라우저 기본 컨트롤 금지**: `<select>`, number 스피너, 기본 라디오 모양을 쓰지 않는다.
  - 선택지: 세로 리스트 카드. 실제 `input[type=radio]`는 숨기고 label을 그린다(접근성 유지). 행 높이 68px 이상, 1px #E6E6E6, radius 10px, 간격 10px. 왼쪽 18px 원 → 선택 시 안쪽 점이 커짐(200ms). 가운데 라벨 17px + 보조 14px #8A8A8A. 오른쪽 숫자 키 힌트(#B5B5B5). hover 배경 #FAFAF9, 선택 테두리 #1E2A3B 1.5px · 배경 #F7F8FA.
  - 만 나이: 가운데 큰 숫자(64px, 밑줄만) + 양옆 원형 −/+ 버튼. 직접 입력 가능(숫자만). 빈 칸에서 −/+를 누르면 24.
  - 전입 예정일: 박스 없이 밑줄만 있는 큰 입력칸(32px, YYYY-MM-DD 자동 하이픈) + 빠른 선택 "이번 달 말 / 다음 달 1일 / 직접 선택"(직접 선택은 숨긴 날짜 선택기를 연다).
- 질문과 보조 설명

| # | 질문 | 설명 | 선택지 (보조 설명) |
|---|---|---|---|
| 1 | 만 나이가 어떻게 되나요? | 올해 생일이 지났는지를 따져 계산한 나이입니다. | 숫자 |
| 2 | 지금 어떤 상태인가요? | 가장 가까운 것을 고르세요. | 학생(대학 재학·휴학 포함) / 재직(아르바이트·계약직 포함) / 구직 중(현재 일하지 않음) / 기타 |
| 3 | 1인 가구인가요? | 주민등록상 기준입니다. | 예(주민등록상 혼자) / 아니오(가족·배우자와 함께) |
| 4 | 어떤 집에 살 예정인가요? | 이사 후 기준 | 월세 / 전세 / 부모님 집 |
| 5 | 가구 소득은 어느 구간인가요? | 2026년 기준 중위소득, 1인 가구 2,564,238원 기준 | 60% 이하(월 약 154만 원 이하) / 60~100%(월 약 154만~256만 원) / 100~150%(월 약 256만~385만 원) / 150% 초과(월 약 385만 원 초과) / 모름(건강보험료 납부액으로 확인할 수 있습니다) |
| 6 | 경기도에 얼마나 살았나요? | 주민등록상 경기도에 산 기간 | 1년 미만 / 1~3년 / 3년 이상 / 모름 |
| 7 | 언제 전입할 예정인가요? | 서울 마포구로 전입신고할 날짜입니다. | 날짜 · 마지막 버튼은 [비교하기] |

### 3. 비교 중
가운데 1px 점선 위를 작은 원이 이동 + "공고 n건과 비교하고 있습니다" 한 줄. 0.8초 후 `#/result`.

### 4. 결과 `#/result` (최대 폭 760px)
1. 상단: 작은 홈 링크 "청년 정책 비교" · 내 조건 요약 칩 한 줄 + [조건 바꾸기](→ `#/q/1`, 기존 답이 채워진 상태)
2. 큰 한 줄 결론 "이사하면 3개가 새로 생기고 2개가 사라집니다." — 숫자는 처음 볼 때만 카운트업. 아래 보조 문장 "1개는 그대로 유지됩니다. 이 가운데 4개는 확인이 필요합니다."
3. **이사 전에 확인할 것**: 왼쪽 1px 세로선 하나 있는 메모 블록 (최대 3줄, 아래 규칙)
4. 섹션 "01 사라지는 제도" / "02 새로 생기는 제도" / "03 그대로 유지되는 제도" — 제목 + 얇은 가로선. 비어 있으면 "…없습니다."
   - 제도는 카드 대신 1px 선으로 나눈 리스트 행: 제도명(600) · 판정 표시 · 지원 내용 한 줄(넘치면 말줄임) · 신청 시기 · [근거] 펼치기(높이 애니메이션) · 행 오른쪽 아래 "공고 원문" 링크
   - "공고 원문" 링크: `sourceUrl`을 새 탭으로(`target=_blank`, `rel=noopener noreferrer`). 회색(#8A8A8A) 글자, 밑줄 없음, hover 때만 밑줄. 화면 읽기용 이름 "○○ 공고 원문 (새 탭)".
   - 판정은 색 대신 점 + 글자: 해당 ●(#111) / 확인 필요 ◐(#555) / 해당 없음 ○(#B5B5B5). 화면 표기는 "해당 없음", 내부 값 · 정답표는 "미해당".
   - 확인 필요 행: 확인할 것 짧은 평서문 (예: "소득 구간이 기준선에 걸쳐 있습니다. 건강보험료로 확인하세요.") + 추가 질문이 있으면 "질문 ○○" + 작은 세그먼트 버튼 [예 | 아니오 | 모름]. 누르면 즉시 재계산(전환 효과 없이 내용만 다시 그림).
     - 같은 id 질문은 처음 나오는 행에서만 묻고, 다른 행은 "위에서 답한 「○○」의 답을 함께 씁니다."
     - 답한 질문은 고른 답을 표시하고 다시 바꿀 수 있음 (해당 없음으로 접혀도 마찬가지). "모름"이면 계속 확인 필요.
   - [근거] 펼친 내용: 운영 주체 · 지원 내용(전체) · 신청 기간 · 신청 방법 / 조건별 `조건 | 「공고 원문」 | 내 조건 | 결과(충족/불충족/확인 필요)` / 신청 전 확인(`extraChecks`, 판정에 반영 안 함) / 맨 아래 "공고 원문" 링크 · 확인일
   - 행은 처음 볼 때만 60ms 간격으로 순차 등장.
5. "해당 없는 제도 n개" 접힘 (구분 · 맞지 않는 조건 표시)
6. "표로 보기" 접힘 → 비교표 `구분 | 제도 | 운영 주체 | 판정 | 지원 내용 | 신청 시기와 방법 | 출처(공고 원문 링크)` (가로 스크롤 허용)
7. 출처와 기준일 + "신청 전에 공식 공고를 꼭 확인하세요." + 맨 아래 작은 링크 "공고 직접 추가해보기"(`#/add`) · "검증"(`#/check`)

### 5. 검증 `#/check`
프리셋 3개 × 제도별 `정답 / 결과` 표(다른 칸은 밑줄), 일치율, 잘못된 '해당' 개수, 완료 조건 통과/미통과 (일치율 ≥ 90% AND 잘못된 해당 = 0) — 추가 질문 답과 무관하게 처음 판정 기준. [결과로 돌아가기].

### 6. 공고 추가 `#/add`
구분 선택(이사 전/이사 후/중앙) · 원문 입력칸 · [예시 공고] · [조건 정리] → 조건표(항목 · 추출값 · 원문 문장 · 수정 가능) → [목록에 추가] → 비교 결과 즉시 갱신 (페이지 메모리에만 저장). 4단계에서 구현.

## 디자인 원칙
- **색**: `#111` / `#555` / `#8A8A8A` / `#E6E6E6` / 배경 `#FFFFFF`, 보조 `#FAFAF9`. 포인트는 잉크 네이비 `#1E2A3B` 한 색만 (주요 버튼, 선택 상태, 링크). 빨강·노랑·초록 배지 금지.
- **형태**: 이모지·아이콘 금지(⚠ ✓ ✨ 화살표 기호 등 — 소개 하단 줄의 경로 표기만 예외). 그라데이션 금지, 그림자 없음. 카드 대신 1px 선으로 나눈 리스트.
- **버튼**: 알약형. 주요 = #1E2A3B 배경 흰 글씨, 보조 = 흰 배경 1px 테두리. radius: 버튼 999px, 선택 카드 10px, 나머지 8px 이하.
- **글자**: Pretendard(`fonts/`의 woff2, CDN 금지), 굵기 400/600만. 제목 자간 -0.02em, 본문 16~17px, 행간 1.6, 숫자 tabular-nums.
- **문구**: 짧은 평서문. 느낌표 · 홍보 문구("한눈에", "스마트하게", "AI가 분석" 등) 금지. 버튼: "비교하기", "예시 보기", "다음", "이전", "조건 바꾸기", "근거".
  - 데이터(원문)의 `→`는 화면에서만 쉼표로 바꿔 보여준다. 원문 문장(quote)은 그대로.
- **움직임** (CSS + 바닐라 JS, 라이브러리 없음): 화면 전환은 페이드 + 12px 이동, 리스트 행 60ms 간격 순차 등장, 버튼 hover 시 1px 떠오름 · 누를 때 scale 0.98. bounce · 과한 scale 금지. `prefers-reduced-motion`이면 모든 움직임을 끈다(일러스트 점은 가운데 정지, 카운트업 없음).
- 외부 CDN 없음. 모바일 375px에서 가로 스크롤 없이 읽힐 것 (비교표는 표 안에서만 가로 스크롤).

## 입력 항목 (값은 코드에서 이 enum 사용)
| 항목 | key | 값 |
|---|---|---|
| 만 나이 | `age` | 숫자 |
| 신분 | `status` | `student` 학생 / `employed` 재직 / `jobseeker` 구직 중(미취업) / `other` 기타 |
| 1인 가구 | `single` | `true` / `false` |
| 주거 형태 (이사 후 기준) | `housing` | `monthly_rent` 월세 / `jeonse` 전세 / `with_parents` 부모님 집 |
| 소득 구간 (가구 기준 중위소득) | `income` | `p0_60` / `p60_100` / `p100_150` / `p150_up` / `unknown` |
| 경기도 거주 기간 | `ggYears` | `y0_1` / `y1_3` / `y3_up` / `unknown` |
| 전입 예정일 | `moveDate` | `YYYY-MM-DD` |

## 데이터 스키마 (`window.POLICIES`의 원소)
```json
{
  "id": "seoul-rent",
  "name": "서울시 청년월세지원",
  "org": "서울특별시",
  "scope": "after",
  "conditions": {
    "age":       { "min": 19, "max": 39, "quote": "원문 문장" },
    "residence": { "region": "서울", "minYears": null, "quote": "원문 문장" },
    "income":    { "minPct": null, "maxPct": 150, "quote": "원문 문장" },
    "status":    null,
    "single":    null,
    "housing":   { "allowed": ["monthly_rent"], "quote": "원문 문장" }
  },
  "extraChecks": ["무주택 여부", "임차보증금 기준"],
  "exclusiveWith": ["molit-rent"],
  "benefit": "월 최대 20만 원, 최대 12개월",
  "applyPeriod": "원문 그대로",
  "applyStart": "YYYY-MM-DD 또는 null",
  "applyEnd": "YYYY-MM-DD 또는 null (상시면 null)",
  "howToApply": "원문 그대로",
  "sourceUrl": "https://...",
  "checkedAt": "2026-11-14"
}
```
- `scope`: `before`(경기·수원) / `after`(서울·마포) / `national`(전국)
- 조건이 원문에 없으면 그 키는 `null` (= 검사하지 않음).
- `income.minPct`: "기준 중위소득 N% 초과 ~ M% 이하"처럼 하한이 있을 때만 N. 하한이 없으면 `null`. 허용 범위는 `(minPct, maxPct]` (minPct가 null이면 0부터).

### 추가 질문 `followUp` (조건 또는 extraChecks 객체에 붙임)
'확인 필요'(또는 입력만으론 미해당)의 원인이 질문 하나로 풀리는 조건에 단다. 사람이 원문을 보고 직접 쓴다 (LLM 추출 결과에는 넣지 않음).
```json
"status": {
  "allowed": ["jobseeker"], "quote": "원문 문장",
  "followUp": {
    "id": "allowance-graduating",
    "when": { "status": ["student"] },
    "question": "졸업예정자인가요?",
    "options": [
      { "label": "예",     "result": "pass" },
      { "label": "아니오", "result": "fail" },
      { "label": "모름",   "result": "unknown" }
    ]
  }
}
```
- 한 조건에 질문이 여러 개면 `followUp`을 배열로 쓴다 (입력값에 따라 다른 질문).
- `when`: 입력 항목 → 값 목록. 입력이 맞을 때만 질문이 활성. 없으면 항상 활성.
- `options`에는 **항상 `"모름"` → `unknown`** 포함.
- 같은 `id`는 같은 질문 문장. 답은 `id`별로 한 번 저장해 여러 제도가 공유하고, 답은 **label**로 저장한다 → 같은 id라도 `when`이 다르면 선택지별 result를 다르게 둘 수 있음 (예: 경기 기본소득 `ggYears=unknown`일 때 "아니오"는 unknown).

### blocking 꼬리표 (`extraChecks`의 객체 원소)
```json
{ "text": "원가구(부모 포함) 기준 중위소득 100% 이하", "blocking": true,
  "quote": "원문 문장", "followUp": { "id": "parents-income-100", "question": "…", "options": [ … ] } }
```
- `extraChecks` 원소는 문자열(안내 꼬리표, 판정 무관) 또는 이 객체.
- `blocking: true`면 판정에 들어가는 조건처럼 취급: 답 전엔 unknown(→ 최대 '확인 필요'), 답하면 선택지의 result. quote·followUp 필수.
- 위 숫자는 형식 예시일 뿐. 실제 값은 반드시 `raw/` 원문에서.
- 입력 6개 항목으로 판정할 수 없는 조건(무주택, 부모 소득, 재산, 수급자 제외, 유사사업 참여 이력 등)은 `conditions`가 아니라 `extraChecks`에 문장으로 넣는다.

## 판정 규칙 (`js/logic.js`)
조건별 결과: `pass` / `fail` / `unknown`
- **age**: `min ≤ age ≤ max` → pass, 아니면 fail. (공고가 출생일 범위로 되어 있으면 만 나이로 환산해서 저장)
- **residence**
  - scope `before`: 사용자는 현재 수원 거주로 고정 → region은 pass. `minYears`가 있으면 `ggYears` 구간 `[lo, hi)`와 비교: `lo ≥ minYears` → pass, `hi ≤ minYears` → fail, 그 외 → unknown. `ggYears=unknown` → unknown. 구간: y0_1=[0,1), y1_3=[1,3), y3_up=[3,∞)
  - scope `after`: 전입 후 기준이므로 region은 pass. `minYears`가 있으면 판정은 그대로 두고 **신청 가능일 = moveDate + minYears**를 신청 시기 칸에 표시.
  - scope `national`: pass.
- **income**: `unknown` → unknown. 입력 구간 `[lo, hi]` (p0_60=[0,60], p60_100=(60,100], p100_150=(100,150], p150_up=(150,∞)), 허용 범위 `(minPct, maxPct]` (minPct=null이면 0).
  - 입력 구간이 허용 범위 안에 **완전히 들어가면** pass: `lo ≥ minPct` AND `hi ≤ maxPct`
  - **완전히 벗어나면** fail: `hi ≤ minPct` OR `lo ≥ maxPct`
  - **걸치면** unknown
  - 예) 서울 청년월세 (48, 150]: p0_60 → unknown, p60_100 → pass, p100_150 → pass, p150_up → fail
- **status**: `allowed`에 포함 → pass. 미포함인데 입력이 `other` → unknown. 그 외 미포함 → fail.
- **single**: `required:true`인데 1인 가구 아님 → fail.
- **housing**: `allowed`에 포함 → pass, 아니면 fail.

추가 질문 적용 (위 기본 규칙 다음에):
- 조건의 기본 결과가 pass가 **아니고**, 입력이 `followUp.when`에 맞으면 그 질문이 활성.
  - 답이 없으면 → **unknown** (기본 결과가 fail이었어도 unknown으로 — 질문으로 풀릴 수 있으므로)
  - 답이 있으면 → 고른 선택지의 `result`
- blocking 꼬리표: 답 없음 → unknown, 답 있음 → 선택지의 `result`. 다른 조건과 똑같이 제도 판정에 들어간다.
- 질문은 **답에 따라 판정이 바뀔 수 있을 때만 화면에 묻는다**: 질문이 없는 다른 조건이 이미 fail이면 (예: 나이 초과) 묻지 않는다 (`followUp.askable = false`).
- 답이 바뀌면 조건 → 제도 판정 → 구분 → 요약 → 이사 전에 확인할 것을 전부 다시 계산한다.
- **검증 패널·`test/run-presets.js`는 답이 하나도 없는 상태(처음 판정)로 계산.** `answer-key.md`의 정답도 처음 판정 기준.

제도 판정:
- fail이 하나라도 있으면 **미해당**
- fail이 없고 unknown이 있으면 **확인 필요**
- 전부 pass(또는 null)면 **해당**

## 구분 규칙
- `before` 제도 → 해당/확인 필요면 **사라짐**. 미해당이면 접힌 영역으로 (원래 못 받던 건 잃을 것도 없음)
- `after` 제도 → 해당/확인 필요면 **새로 생김**. 미해당이면 접힌 영역
- `national` 제도 → 해당/확인 필요면 **유지**. 미해당이면 접힌 영역

## 이사 전에 확인할 것 (최대 3줄, 이 순서로 채움)
1. 사라짐 + 해당인 제도: "○○은 전입하면 받을 수 없습니다. 이사 전에 신청과 수령을 마치세요." — 단, 올해 접수가 이미 끝난 제도는 제외
2. `exclusiveWith`로 묶인 두 제도가 둘 다 목록에 있으면: "○○과 △△는 함께 받을 수 없습니다. 하나만 고르세요."
3. 확인 필요 중 `applyEnd`가 가장 가까운 것(마감 전): "○○은 YYYY-MM-DD에 마감합니다. 그 전에 확인할 것: …"
(조사 은/는·과/와는 이름의 받침에 맞춘다)
신청 기간이 이미 지났으면 신청 시기 칸에 "2026년 접수는 끝났습니다. 다음 공고를 확인하세요."로 표시.

## 테스트 프리셋 (예시 불러오기 버튼 = 검증 입력)
| # | 이름 | age | status | single | housing | income | ggYears | moveDate |
|---|---|---|---|---|---|---|---|---|
| 1 | 24세 사회초년생 | 24 | employed | true | monthly_rent | p60_100 | y3_up | 2026-12-01 |
| 2 | 21세 대학생 | 21 | student | true | monthly_rent | p0_60 | y3_up | 2026-12-01 |
| 3 | 소득 모름 | 26 | jobseeker | true | monthly_rent | unknown | y1_3 | 2026-12-01 |

## 공고 추가(AI) — `js/extract-client.js`
```
extractConditions(rawText, scope) → Promise<policy 객체(스키마 동일)>
```
- **모드 결정**: 페이지가 `file://`이거나 `GET /api/health` 실패 → `mock`. 성공하고 서버가 `mode:"live"`를 주면 `live`.
- **mock**: `RAW_TEXTS`에 있는 원문과 일치하면 1.5초 뒤 `MOCK_EXTRACTIONS[id]` 반환. 일치하지 않으면 "mock 모드에서는 예시 공고만 정리할 수 있어요. API 키 연결 후 사용 가능" 안내.
- **live**: `POST /api/extract {rawText, scope}` → 서버가 LLM 호출.
- 반환값은 화면에서 **사람이 확인·수정한 뒤에만** 목록에 추가. 스키마 검증 실패 시 오류 표시.
- LLM 추출 결과에는 `followUp`·blocking 꼬리표를 만들지 않는다 (사람이 원문을 보고 다는 것).
- 데모용으로 제도 1개(아래 후보의 ★)는 `POLICIES`에서 빼고 `RAW_TEXTS`·`MOCK_EXTRACTIONS`에만 둔다 → 시연 때 "원문 붙여넣기 → 추가 → 표에 새 줄 생김"을 보여주기 위함.

## 서버 — `server.js`
- Node 18+ 내장 모듈과 내장 `fetch`만 사용 (npm 설치 없음). `.env`는 직접 파싱.
- `GET /` 등: 프로젝트 폴더 정적 파일 제공 → live 모드는 `http://localhost:3000`으로 연다.
- `GET /api/health` → `{ mode: API_KEY ? "live" : "mock", provider }`
- `POST /api/extract` → `prompts/extract.md`를 system prompt로, 원문을 user 메시지로 보내 JSON 받기. `temperature: 0`. 응답에서 JSON만 파싱해 스키마 검증 후 반환.
- `PROVIDER=anthropic`: `POST https://api.anthropic.com/v1/messages`, 헤더 `x-api-key`, `anthropic-version: 2023-06-01`
- `PROVIDER=openai`: `POST https://api.openai.com/v1/chat/completions`, `response_format: {type:"json_object"}`
- 모델 이름은 `MODEL` 환경변수로 받는다 (코드에 고정하지 않음). 제공받는 API가 이 둘이 아니면 그때 어댑터를 추가한다.
- 키·원문 전체를 콘솔에 찍지 않는다.

## 추출 지시문
`prompts/extract.md` 참고 (서버의 system prompt이자 1단계 수작업 추출 규칙).

## 작업 순서 (단계마다 멈추고 확인받기)
- **1단계 · 데이터 추출**: `raw/*.txt`를 `prompts/extract.md` 규칙대로 직접 읽고 정리 → `data/policies.js`, `data/mock-extractions.js`(★ 제도), `data/raw-texts.js`(★ 제도) 작성. 그다음 **제도별로 조건·quote 목록을 표로 보여주고 멈춘다** (내가 원문과 대조).
- **2단계 · 판정 로직**: `js/logic.js` + `test/run-presets.js`. `node test/run-presets.js`로 프리셋 3개 × 제도 결과표를 출력하고 멈춘다.
- **3단계 · 화면**: `index.html` + `js/app.js`. 더블클릭으로 열어 프리셋 3개가 작동하는지 확인.
- **4단계 · 공고 추가(mock)**: `js/extract-client.js` + 공고 추가 섹션. mock으로 ★ 제도 추가 흐름 확인.
- **5단계 · 서버(live)**: `server.js`, `.env.example`, `.gitignore`. 키가 없으면 mock으로 뜨는지까지만 확인. 키가 오면 `.env`에 넣고 ★ 제도를 live로 추출해 mock 결과와 비교.
- **6단계 · 검증**: 내가 쓴 `answer-key.md`를 `data/answer-key.js`로 변환, 검증 패널·`test/run-presets.js`에서 일치율과 잘못된 '해당' 개수 확인.

## 범위 밖 (만들지 않음)
지역 선택, 공고 자동 수집·크롤링, 로그인, DB·영구 저장, 배포.

## 수집할 공고 후보 (`raw/`에 넣을 것, 8개 + 데모용 1개)
| 파일명(제안) | scope | 제도 | 확인처 |
|---|---|---|---|
| gg-basic-income.txt | before | 경기도 청년기본소득 | 잡아바 / 온통청년 |
| suwon-transit.txt | before | 수원시 사회초년생 청년 무상교통 | suwon.go.kr 새빛 생활비 패키지 |
| suwon-housing.txt | before | 수원시 청년 주거 패키지(월세·이사비·중개보수) | suwon.go.kr 새빛 생활비 패키지 |
| suwon-exam-fee.txt | before | 수원시 어학·자격시험 응시료 지원 | suwon.go.kr 교육 > 청년 |
| seoul-rent.txt | after | 서울시 청년월세지원 | 서울주거포털 / 청년몽땅정보통 |
| seoul-allowance.txt | after | 서울시 청년수당 | 청년몽땅정보통 |
| mapo-savings.txt | after | 마포구 희망두배 청년통장 | 서울시 자산형성지원사업 누리집 |
| molit-rent.txt | national | 국토부 청년월세 지원 | 복지로 / 마이홈 |
| seoul-moving.txt | after ★ | 서울시 청년 부동산 중개보수 및 이사비 지원 (데모용, POLICIES에서 제외) | 청년몽땅정보통 |
