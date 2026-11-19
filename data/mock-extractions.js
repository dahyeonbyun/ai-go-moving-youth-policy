// ★ 데모용: POLICIES에는 넣지 않고, "공고 추가(AI)" mock 모드에서 이 결과를 돌려준다.
// raw/seoul-moving.txt 를 prompts/extract.md 규칙대로 정리한 것.
window.MOCK_EXTRACTIONS = {
  "seoul-moving": {
    "id": "seoul-moving",
    "name": "서울시 청년 부동산 중개보수 및 이사비 지원",
    "org": "서울특별시",
    "scope": "after",
    "conditions": {
      "age": { "min": 19, "max": 39, "quote": "- (연령) 2026년 기준 만 19~39세 청년 ('86.1.1~'07.12.31 출생)" },
      "residence": { "region": "서울", "minYears": null, "quote": "○ 지원대상 : 2024년 1월 1일 이후 서울로 전입 또는 서울 내에서 이사 후 전입신고 완료한 청년가구" },
      "income": { "minPct": null, "maxPct": 150, "quote": "- (소득) 가구당 기준 중위소득 150% 이하" },
      "status": null,
      "single": null,
      "housing": { "allowed": ["monthly_rent", "jeonse"], "quote": "- (주택) 거래금액 2억원 이하 전·월세 거주 ※ 거래금액 = 임차보증금 + (월세액 × 100)" }
    },
    "extraChecks": [
      "신청자 청년 본인 무주택자",
      "거래금액 2억원 이하 (임차보증금 + 월세액 × 100)",
      "부모 소유 주택을 임차한 경우 제외",
      "생계·의료·주거급여 수급자 제외",
      "다른 기관에서 중개보수·이사비 지원을 받았으면 불가",
      "2년 이상 복무한 제대군인은 최대 만 42세까지"
    ],
    "exclusiveWith": [],
    "benefit": "최대 40만원 실비 지원 ※ 생애 1회 (부동산 중개보수 및 이사비, 개별 신청 가능)",
    "applyPeriod": "2026. 8. 18.(화) 10:00 ~ 8.31.(월) 18:00 (하반기)",
    "applyStart": "2026-08-18",
    "applyEnd": "2026-08-31",
    "howToApply": "'청년몽땅정보통' 온라인 신청",
    "sourceUrl": "https://youth.seoul.go.kr/infoData/sprtInfo/view.do?sprtInfoId=72895",
    "checkedAt": "2026-11-14"
  }
};
