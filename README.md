# 이사 청년 제도 비교

경기 수원시에서 서울 마포구로 이사하는 청년이 자기 조건을 넣으면, 이사 때문에 새로 생기는 / 사라지는 / 유지되는 청년 제도를 공고 원문 근거와 함께 보여주는 웹 페이지입니다.

- 판정은 코드(`js/logic.js`)가 합니다. 같은 입력이면 항상 같은 결과입니다.
- 정보가 없거나 "모름"이면 '확인 필요'로 표시하고, '해당'으로 단정하지 않습니다.
- 모든 조건에 공고 원문 문장과 출처 링크가 붙습니다.

## 시나리오

- 이사 전: 경기도 · 수원시
- 이사 후: 서울특별시 · 마포구
- 그 외: 중앙부처(전국) 제도

지역 선택 기능은 없습니다. 위 경로 하나로 고정되어 있습니다.

## 실행 방법

### 1. 서버 없이 (mock 모드)

`index.html`을 더블클릭해 브라우저로 엽니다. 설치할 것은 없습니다.

공고 추가(결과 화면 맨 아래 "공고 직접 추가해보기")는 이 모드에서 예시 공고로만 동작합니다.
[예시 공고] → [조건 정리] → 조건표 확인 · 수정 → [목록에 추가]를 누르면 결과에 「서울시 청년 부동산 중개보수 및 이사비 지원」이 새로 생깁니다. 추가한 제도는 페이지 메모리에만 있어 새로고침하면 사라집니다.

### 2. 로컬 서버 (live 모드)

Node 18 이상이 필요합니다. npm 설치는 필요 없습니다.

```bash
cp .env.example .env   # PROVIDER, API_KEY, MODEL 입력
node server.js         # http://localhost:3000
```

| `.env` 항목 | 값 |
|---|---|
| `PROVIDER` | `anthropic` 또는 `openai` |
| `API_KEY` | 해당 서비스의 API 키. 비어 있으면 서버가 mock 모드로 뜹니다 |
| `MODEL` | 사용할 모델 이름 |
| `PORT` | 기본 3000 |

서버가 하는 일:

- `GET /api/health`: `{ "mode": "live" | "mock", "provider": ... }`
- `POST /api/extract` `{ rawText, scope }`: `prompts/extract.md`를 지시문으로 써서 LLM(temperature 0)이 공고 원문을 조건 데이터로 정리합니다. 응답은 스키마 검사를 거쳐 돌려주고, 인용문이 원문에 그대로 없으면 경고를 붙입니다. 결과는 화면에서 사람이 확인한 뒤에만 목록에 추가됩니다.
- 그 밖의 주소: 프로젝트 정적 파일. `.env` 같은 숨김 파일과 `server.js`는 제공하지 않습니다.

LLM은 조건을 뽑기만 하고, 해당 여부 판정은 하지 않습니다. 키와 원문 전체는 콘솔에 찍지 않습니다.

### 테스트

```bash
node test/run-presets.js   # 예시 3명 × 제도별 판정 결과
node test/check-quotes.js  # 모든 인용문이 raw/ 원문에 있는지 검사
```

## 폴더 구조

```
ai-go/
├─ index.html              화면 틀 (해시 라우팅, file://에서도 작동)
├─ css/style.css           디자인 토큰 · 화면 스타일
├─ fonts/                  Pretendard woff2 (OFL)
├─ js/logic.js             판정 로직 (브라우저 + Node)
├─ js/app.js               단계형 화면 (소개 · 질문 · 결과 · 검증 · 공고 추가)
├─ js/extract-client.js    공고 추가: extractConditions(원문, 구분) — mock/live 분기
├─ js/schema.js            제도 데이터 스키마 검사 (화면 · 서버 공용)
├─ data/policies.js        원문 대조를 마친 제도 데이터
├─ data/raw-texts.js       공고 추가 데모용 원문
├─ data/mock-extractions.js 공고 추가 데모용 추출 결과
├─ prompts/extract.md      추출 지시문 (서버의 system prompt)
├─ server.js               로컬 서버: 정적 파일 + /api/extract
├─ raw/                    공고 원문 .txt (첫 줄에 출처 URL)
├─ test/                   판정 · 인용문 검사 스크립트
└─ .env.example            API 설정 예시 (.env는 커밋하지 않음)
```

## 주의

이 페이지는 참고용입니다. 신청 전에 공식 공고를 꼭 확인하세요.
