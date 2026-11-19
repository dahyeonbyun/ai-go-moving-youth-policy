// 원문 대조용 확정 데이터. 값은 raw/*.txt 원문에서만 가져온다 (CLAUDE.md 원칙 4).
// quote는 원문 문장을 그대로 복사한 것 — test/check-quotes.js 로 원문 포함 여부를 검사한다.
window.POLICIES = [
  // ───────────────────────── 이사 전: 경기도 · 수원시 ─────────────────────────
  {
    "id": "gg-basic-income",
    "name": "경기도 청년기본소득",
    "org": "경기도 · 수원특례시",
    "scope": "before",
    "conditions": {
      "age": { "min": 24, "max": 24, "quote": "24세 청년(신청일 현재 수원시 거주 청년) 중 경기도에 최근 3년 이상 계속 거주 또는 합산 10년 이상 거주자" },
      "residence": {
        "region": "경기", "minYears": 3,
        "quote": "24세 청년(신청일 현재 수원시 거주 청년) 중 경기도에 최근 3년 이상 계속 거주 또는 합산 10년 이상 거주자",
        "followUp": [
          {
            "id": "gg-total-10y",
            "when": { "ggYears": ["y0_1", "y1_3"] },
            "question": "경기도에 합산 10년 이상 살았나요?",
            "options": [
              { "label": "예", "result": "pass" },
              { "label": "아니오", "result": "fail" },
              { "label": "모름", "result": "unknown" }
            ]
          },
          {
            "id": "gg-total-10y",
            "when": { "ggYears": ["unknown"] },
            "question": "경기도에 합산 10년 이상 살았나요?",
            "options": [
              { "label": "예", "result": "pass" },
              { "label": "아니오", "result": "unknown" },
              { "label": "모름", "result": "unknown" }
            ]
          }
        ]
      },
      "income": null,
      "status": null,
      "single": null,
      "housing": null
    },
    "extraChecks": [
      "분기별 출생일 범위 확인 (4분기: 01. 10. 02. ~ 02. 10. 01. 출생)"
    ],
    "exclusiveWith": [],
    "benefit": "25만원 분기별 지급(총 100만원), 수원시 지역화폐로 지급",
    "applyPeriod": "1분기 26. 03. 03. ~ 26. 04. 01. / 2분기 26. 06. 01. ~ 26. 06. 30. / 3분기 26. 09. 01. ~ 26. 10. 02. / 4분기 26. 11. 02. ~ 26. 12. 01.",
    "applyStart": "2026-11-02",
    "applyEnd": "2026-12-01",
    "howToApply": "온라인 신청(apply.jobaba.net)",
    "sourceUrl": "https://www.suwon.go.kr/sw-www/deptHome/dep_edu/culture04/culture04-02/culture04-02-04.jsp",
    "checkedAt": "2026-11-14"
  },
  {
    "id": "suwon-transit",
    "name": "수원시 사회초년생 청년 무상교통",
    "org": "수원특례시",
    "scope": "before",
    "conditions": {
      "age": { "min": 19, "max": 23, "quote": "신청일 기준 19세~23세인 주민등록상 수원시 거주 청년" },
      "residence": { "region": "수원", "minYears": null, "quote": "신청일 기준 19세~23세인 주민등록상 수원시 거주 청년" },
      "income": null,
      "status": null,
      "single": null,
      "housing": null
    },
    "extraChecks": [
      "K-패스 카드 발급·회원가입 필요 (「수원시 사회초년생 청년 교통비 지원 서비스」 미신청시 혜택 불가)"
    ],
    "exclusiveWith": [],
    "benefit": "연간 최대 28만원(월 23,100원) 버스비 지원, K-패스 실제 사용금액 월별 지급",
    "applyPeriod": "2026. 1. 1. ~ 지속",
    "applyStart": "2026-01-01",
    "applyEnd": null,
    "howToApply": "K-패스 카드 발급 → K-패스 회원가입 → 수원시 청년 교통비 자동 가입",
    "sourceUrl": "https://www.suwon.go.kr/sw-www/saebitinfo/saebitinfo-01.jsp",
    "checkedAt": "2026-11-14"
  },
  {
    "id": "suwon-housing",
    "name": "수원시 청년 주거 패키지 (월세·이사비·중개보수)",
    "org": "수원특례시",
    "scope": "before",
    "conditions": {
      "age": { "min": 19, "max": 39, "quote": "(주소기준) 신청일 기준 수원시에 거주하는 19세~ 39세 1인 가구 미혼청년" },
      "residence": { "region": "수원", "minYears": null, "quote": "(주소기준) 신청일 기준 수원시에 거주하는 19세~ 39세 1인 가구 미혼청년" },
      "income": { "minPct": null, "maxPct": 120, "quote": "(소득기준) 기준 중위소득 120% 이하(건강보험료 납부 기준)" },
      "status": null,
      "single": { "required": true, "quote": "(주소기준) 신청일 기준 수원시에 거주하는 19세~ 39세 1인 가구 미혼청년" },
      "housing": { "allowed": ["monthly_rent"], "quote": "(주택기준) 임차보증금 1억원 이하이면서 월세 60만원 이하 민간건물에 거주하는 무주택자" }
    },
    "extraChecks": [
      "미혼",
      "무주택자, 임차보증금 1억원 이하·월세 60만원 이하 민간건물",
      "국토부 및 지자체 청년 월세 지원사업 참여자 제외",
      "기초생활수급자(생계·의료·주거·교육) 제외",
      "정부 및 지자체의 청년주거지원 사업 참여자 제외",
      "생애 1회"
    ],
    "exclusiveWith": ["molit-rent"],
    "benefit": "월세 및 이사비, 중개보수비 포함 1인당 최대 100만원 (월세 월 10만원 내 5개월/최대 50만원 + 이사비·중개보수비 최대 50만원)",
    "applyPeriod": "2026. 1. 19.(월) 09:00 ~ 1. 30.(금) 18:00",
    "applyStart": "2026-01-19",
    "applyEnd": "2026-01-30",
    "howToApply": "온라인 신청(잡아바 어플라이)",
    "sourceUrl": "https://www.suwon.go.kr/sw-www/saebitinfo/saebitinfo-01.jsp",
    "checkedAt": "2026-11-14"
  },
  {
    "id": "suwon-exam-fee",
    "name": "수원시 어학·자격시험 응시료 지원 (청년 역량강화 기회지원)",
    "org": "수원특례시",
    "scope": "before",
    "conditions": {
      "age": { "min": 19, "max": 39, "quote": "○ 지원대상 : 신청일 기준 수원시 거주 미취업 청년(19 ~ 39세*)" },
      "residence": { "region": "수원", "minYears": null, "quote": "○ 지원대상 : 신청일 기준 수원시 거주 미취업 청년(19 ~ 39세*)" },
      "income": null,
      "status": {
        "allowed": ["student", "jobseeker"],
        "quote": "○ 지원대상 : 신청일 기준 수원시 거주 미취업 청년(19 ~ 39세*)",
        "followUp": {
          "id": "exam-unemployed-at-test",
          "when": { "status": ["employed"] },
          "question": "시험 볼 때 미취업이었거나 1년 미만 계약직이었나요?",
          "options": [
            { "label": "예", "result": "pass" },
            { "label": "아니오", "result": "fail" },
            { "label": "모름", "result": "unknown" }
          ]
        }
      },
      "single": null,
      "housing": null
    },
    "extraChecks": [
      "시험 응시일 당시 미취업이어야 함 (건강보험 직장가입자 제외, 1년 미만 계약 단기 노동자는 미취업 간주, 신청 시 취업 여부는 무관)",
      "2025. 12. 1. ~ 2026. 11. 30. 응시분만 지원",
      "국민취업지원제도·경기여성취업지원금 등 유사사업 참여 기간의 응시료는 제외",
      "지원분야(1,005종)에 해당하는 시험인지 확인"
    ],
    "exclusiveWith": [],
    "benefit": "어학·자격시험 응시료 실비 계좌 지급(1인당 연 최대 30만원)",
    "applyPeriod": "2026. 5. 11.(월) 09:00 ~ 12. 4.(금) 18:00 (예산 소진 시 조기 종료)",
    "applyStart": "2026-05-11",
    "applyEnd": "2026-12-04",
    "howToApply": "온라인신청 — 경기도일자리재단 통합접수시스템(잡아바 어플라이) 내 신청서 작성 및 필수서류 업로드",
    "sourceUrl": "https://www.suwon.go.kr/sw-www/deptHome/dep_edu/culture04/culture04-02/culture04-02-03.jsp",
    "checkedAt": "2026-11-14"
  },

  // ───────────────────────── 이사 후: 서울시 · 마포구 ─────────────────────────
  {
    "id": "seoul-rent",
    "name": "서울시 청년월세지원",
    "org": "서울특별시",
    "scope": "after",
    "conditions": {
      "age": { "min": 19, "max": 39, "quote": "ㅇ (연령) 19세 ~ 39세 이하 (주민등록등본상 1986. 1. 1. ~ 2007. 12. 31.)" },
      "residence": { "region": "서울", "minYears": null, "quote": "ㅇ (주소) 신청일 기준, 서울에 주민등록이 되어있고 실제 거주하는 청년" },
      "income": { "minPct": 48, "maxPct": 150, "quote": "ㅇ (소득요건) 가구당 기준 중위소득 48% 초과 ~ 150% 이하" },
      "status": null,
      "single": null,
      "housing": { "allowed": ["monthly_rent"], "quote": "ㅇ (거주) 임차보증금 8천만원 이하면서 월세 60만원 이하 월세 거주" }
    },
    "extraChecks": [
      "임차보증금 8천만원 이하·월세 60만원 이하 (월세 초과 시 보증금 환산액+월세 90만원 이하)",
      "1인 가구가 아니면 한부모가족·청년 신혼부부(무자녀) 등 신청 유형 해당 여부",
      "건강보험 피부양자면 부양자(부모 등) 소득 기준으로 확인",
      "본인 주택 미소유, 일반재산 1억 3천만원 이하, 차량시가표준액 2,500만원 미만",
      "생계·의료·주거급여 수급자 제외",
      "공공임대주택 거주자 제외, 임대인이 부모·배우자면 제외",
      "서울시 청년월세 기수혜자 제외",
      "의무복무 제대군인은 최대 42세까지 연장"
    ],
    "exclusiveWith": ["molit-rent", "seoul-allowance"],
    "benefit": "월 최대 20만원(최대 12개월/240만원) ※ 생애 1회",
    "applyPeriod": "2026. 5. 6.(수) 10:00 ~ 5. 19.(화) 18:00 (마감)",
    "applyStart": "2026-05-06",
    "applyEnd": "2026-05-19",
    "howToApply": "서울주거포털 온라인 신청 (방문 및 우편 접수 불가)",
    "sourceUrl": "https://housing.seoul.go.kr/site/main/board/notice/12667",
    "checkedAt": "2026-11-14"
  },
  {
    "id": "seoul-allowance",
    "name": "서울시 청년수당",
    "org": "서울특별시",
    "scope": "after",
    "conditions": {
      "age": { "min": 19, "max": 34, "quote": "연령: 만 19세 ~ 34세 (1991. 5. 1. ~ 2007. 5. 31. 출생자)" },
      "residence": { "region": "서울", "minYears": null, "quote": "거주: 신청일 기준 주민등록상 서울시 거주자" },
      "income": { "minPct": null, "maxPct": 150, "quote": "소득: 2026년 4월 기준 중위소득 150% 이하 (건강보험료 기준)" },
      "status": {
        "allowed": ["jobseeker"],
        "quote": "취업 여부: 미취업 청년 또는 단기 근로 청년",
        "followUp": [
          {
            "id": "allowance-graduating",
            "when": { "status": ["student"] },
            "question": "졸업예정자인가요?",
            "options": [
              { "label": "예", "result": "pass" },
              { "label": "아니오", "result": "fail" },
              { "label": "모름", "result": "unknown" }
            ]
          },
          {
            "id": "allowance-short-work",
            "when": { "status": ["employed"] },
            "question": "주 30시간 이하 또는 3개월 이하 근로계약인가요?",
            "options": [
              { "label": "예", "result": "pass" },
              { "label": "아니오", "result": "fail" },
              { "label": "모름", "result": "unknown" }
            ]
          }
        ]
      },
      "single": null,
      "housing": null
    },
    "extraChecks": [
      "대학/대학원 재학생·휴학생은 제외 (졸업예정자는 신청 가능)",
      "단기 근로자는 근로계약서 필수 제출",
      "기초생활수급자 및 차상위계층 제외",
      "군필자는 복무 기간에 따라 최대 만 37세까지 연장"
    ],
    "exclusiveWith": ["seoul-rent"],
    "benefit": "매월 50만 원 × 최대 6개월 (체크카드 지급) + 맞춤형 성장 프로그램",
    "applyPeriod": "2026. 5. 27.(수) 10:00 ~ 5. 29.(금) 16:00 (2차 추가 모집)",
    "applyStart": "2026-05-27",
    "applyEnd": "2026-05-29",
    "howToApply": "'청년몽땅정보통(youth.seoul.go.kr)'에서 온라인 신청 (방문이나 우편 접수는 불가능)",
    "sourceUrl": "https://youth.seoul.go.kr/infoData/sprtInfo/view.do?sprtInfoId=70372",
    "checkedAt": "2026-11-14"
  },
  {
    "id": "mapo-savings",
    "name": "희망두배 청년통장",
    "org": "서울특별시 (마포구 거주자 포함)",
    "scope": "after",
    "conditions": {
      "age": { "min": 18, "max": 34, "quote": "신청 자격은 서울시에 거주중인 만 18세 이상 34세 이하(1991.1.1.~2008.12.31.) 청년으로 4대보험 가입 이력 또는 원천징수 영수증 등으로 최근 1년간 3개월 이상 근로했음을 증빙할 수 있어야 한다." },
      "residence": { "region": "서울", "minYears": null, "quote": "신청 자격은 서울시에 거주중인 만 18세 이상 34세 이하(1991.1.1.~2008.12.31.) 청년으로 4대보험 가입 이력 또는 원천징수 영수증 등으로 최근 1년간 3개월 이상 근로했음을 증빙할 수 있어야 한다." },
      "income": null,
      "status": {
        "allowed": ["employed"],
        "quote": "모집 대상: 서울 거주 18~34세 근로 청년(월평균 소득 255만 원 이하, 최근 1년 내 3개월 이상 근로 또는 현재 3개월 이상 근로)",
        "followUp": {
          "id": "savings-work-3m",
          "when": { "status": ["jobseeker", "student"] },
          "question": "최근 1년 안에 3개월 이상 일했나요? (알바 포함)",
          "options": [
            { "label": "예", "result": "pass" },
            { "label": "아니오", "result": "fail" },
            { "label": "모름", "result": "unknown" }
          ]
        }
      },
      "single": null,
      "housing": null
    },
    "extraChecks": [
      "본인 근로소득 월 255만 원(세전) 이하",
      "부양의무자(부모·배우자) 소득 연 1억 원 미만, 재산 9억 원 미만",
      "최근 1년간 3개월 이상 근로 증빙 (4대보험 가입 이력·원천징수 영수증 등)"
    ],
    "exclusiveWith": [],
    "benefit": "매월 본인저축 15만 원 + 매칭 15만 원 → 만기 적립금 (2년) 720만, (3년) 1,080만",
    "applyPeriod": "6.8(월)~6.19(금)",
    "applyStart": "2026-06-08",
    "applyEnd": "2026-06-19",
    "howToApply": "온라인 신청: account.welfare.seoul.kr",
    "sourceUrl": "https://mediahub.seoul.go.kr/archives/2018375",
    "checkedAt": "2026-11-14"
  },

  // ───────────────────────── 중앙부처(전국) ─────────────────────────
  {
    "id": "molit-rent",
    "name": "국토부 청년월세 지원",
    "org": "국토교통부",
    "scope": "national",
    "conditions": {
      "age": { "min": 19, "max": 34, "quote": "○ 19~34세 부모님과 별도 거주 무주택 청년" },
      "residence": null,
      "income": { "minPct": null, "maxPct": 60, "quote": "- (원가구) 기준 중위소득 100% 이하, (청년가구) 기준 중위소득 60% 이하" },
      "status": null,
      "single": null,
      "housing": { "allowed": ["monthly_rent"], "quote": "○ 19~34세 부모님과 별도 거주 무주택 청년" }
    },
    "extraChecks": [
      {
        "text": "원가구(부모 포함) 기준 중위소득 100% 이하",
        "blocking": true,
        "quote": "- (원가구) 기준 중위소득 100% 이하, (청년가구) 기준 중위소득 60% 이하",
        "followUp": {
          "id": "parents-income-100",
          "question": "부모님 가구 소득이 기준 중위소득 100% 이하인가요?",
          "options": [
            { "label": "예", "result": "pass" },
            { "label": "아니오", "result": "fail" },
            { "label": "모름", "result": "unknown" }
          ]
        }
      },
      "무주택",
      "2차('24.2~'27.12) 지원 수혜자는 2차 사업이 끝난 이후에 신청 가능",
      "만 30세 미만 미혼이면 별도 거주 부모도 가구원으로 입력"
    ],
    "exclusiveWith": ["seoul-rent", "suwon-housing"],
    "benefit": "월 20만원씩 최대 24개월(회) 간 지원(생애 1회), 실제 납부하는 월세의 최대 20만원까지",
    "applyPeriod": "2026년 3월 30일(월) 09시 ~ 2026년 5월 29일(금) 16시",
    "applyStart": "2026-03-30",
    "applyEnd": "2026-05-29",
    "howToApply": "복지로에서 온라인으로 신청 (청년 본인 신청)",
    "sourceUrl": "https://www.bokjiro.go.kr/ssis-tbu/cms/pc/customer/notice/1309500_1141.html",
    "checkedAt": "2026-11-14"
  }
];
