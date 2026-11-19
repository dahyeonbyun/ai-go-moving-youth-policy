// node test/run-presets.js [--today=YYYY-MM-DD] [--detail]
// 프리셋 3개 × 제도 판정표 출력 (추가 질문 답 없음 = 처음 판정 기준) + 규칙 자체 점검 + 정답 대조(6단계)
const fs = require('fs');
const path = require('path');
const Logic = require('../js/logic.js');

const root = path.join(__dirname, '..');
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const today = args.today || Logic.todayStr();
const loadWindow = (file) => {
  const p = path.join(root, file);
  if (!fs.existsSync(p)) return null;
  const window = {};
  new Function('window', fs.readFileSync(p, 'utf8'))(window);
  return window;
};
const POLICIES = loadWindow('data/policies.js').POLICIES;
const ANSWER_KEY = (loadWindow('data/answer-key.js') || {}).ANSWER_KEY || null;

// 한글 2칸 폭을 고려한 정렬
const width = (s) => [...String(s)].reduce((w, c) => w + (/[ᄀ-ᅟ⺀-꓏가-힣豈-﫿＀-｠]/.test(c) ? 2 : 1), 0);
const pad = (s, n) => String(s) + ' '.repeat(Math.max(0, n - width(s)));
const shortName = (p) => p.name.replace(/\s*\([^)]*\)\s*$/, '');

// ── 1. 규칙 자체 점검 ────────────────────────────────────────
let fails = 0;
const expect = (label, actual, expected) => {
  const ok = actual === expected;
  if (!ok) fails++;
  console.log(`  ${ok ? '✓' : '✗'} ${label} → ${actual}${ok ? '' : ` (기대: ${expected})`}`);
};
console.log('\n[규칙 자체 점검]');
const seoulRentIncome = { minPct: 48, maxPct: 150 };
for (const [band, exp] of [['p0_60', 'unknown'], ['p60_100', 'pass'], ['p100_150', 'pass'], ['p150_up', 'fail'], ['unknown', 'unknown']]) {
  expect(`소득 (48, 150] × ${band}`, Logic.baseResult('income', seoulRentIncome, 'after', { income: band }).result, exp);
}
expect('소득 ~60% × p0_60', Logic.baseResult('income', { minPct: null, maxPct: 60 }, 'national', { income: 'p0_60' }).result, 'pass');
expect('소득 ~60% × p60_100', Logic.baseResult('income', { minPct: null, maxPct: 60 }, 'national', { income: 'p60_100' }).result, 'fail');
expect('거주 minYears 3 × y1_3', Logic.baseResult('residence', { minYears: 3 }, 'before', { ggYears: 'y1_3' }).result, 'fail');
expect('거주 minYears 2 × y1_3 (걸침)', Logic.baseResult('residence', { minYears: 2 }, 'before', { ggYears: 'y1_3' }).result, 'unknown');
expect('신분 other (허용 목록 밖)', Logic.baseResult('status', { allowed: ['jobseeker'] }, 'after', { status: 'other' }).result, 'unknown');

const molit = POLICIES.find((p) => p.id === 'molit-rent');
const p2 = Logic.PRESETS[1].input;
expect('국토부 × 프리셋2 (답 없음, blocking)', Logic.evaluatePolicy(molit, p2, {}, today).verdictLabel, '확인 필요');
expect('국토부 × 프리셋2 + 부모 소득 "예"', Logic.evaluatePolicy(molit, p2, { 'parents-income-100': '예' }, today).verdictLabel, '해당');
expect('국토부 × 프리셋2 + 부모 소득 "아니오"', Logic.evaluatePolicy(molit, p2, { 'parents-income-100': '아니오' }, today).verdictLabel, '미해당');
expect('국토부 × 프리셋2 + 부모 소득 "모름"', Logic.evaluatePolicy(molit, p2, { 'parents-income-100': '모름' }, today).verdictLabel, '확인 필요');
const gg = POLICIES.find((p) => p.id === 'gg-basic-income');
const gg24 = { ...Logic.PRESETS[2].input, age: 24 };
expect('경기 기본소득 × 24세·y1_3 (답 없음)', Logic.evaluatePolicy(gg, gg24, {}, today).verdictLabel, '확인 필요');
expect('경기 기본소득 × 24세·y1_3 + 합산 10년 "예"', Logic.evaluatePolicy(gg, gg24, { 'gg-total-10y': '예' }, today).verdictLabel, '해당');
expect('경기 기본소득 × 24세·ggYears 모름 + "아니오"', Logic.evaluatePolicy(gg, { ...gg24, ggYears: 'unknown' }, { 'gg-total-10y': '아니오' }, today).verdictLabel, '확인 필요');
expect('조사: 서울시 청년월세지원 + 와/과', Logic.withWa('서울시 청년월세지원'), '서울시 청년월세지원과');
expect('조사: 수원시 청년 주거 패키지 (…) + 와/과', Logic.withWa('수원시 청년 주거 패키지 (월세·이사비·중개보수)'), '수원시 청년 주거 패키지 (월세·이사비·중개보수)와');
expect('조사: 서울시 청년수당 + 은/는', Logic.withEun('서울시 청년수당'), '서울시 청년수당은');
expect('조사: 희망두배 청년통장 + 은/는', Logic.withEun('희망두배 청년통장'), '희망두배 청년통장은');
expect('조사: 서울시 청년월세지원 + 은/는', Logic.withEun('서울시 청년월세지원'), '서울시 청년월세지원은');
const ggAge26 = Logic.evaluatePolicy(gg, Logic.PRESETS[2].input, {}, today).conditions.find((c) => c.followUp);
expect('질문 숨김: 경기 기본소득 × 26세 (나이 fail → 합산 10년 질문 안 물음)', ggAge26.followUp.askable, false);
expect('질문 표시: 경기 기본소득 × 24세·y1_3', Logic.evaluatePolicy(gg, gg24, {}, today).conditions.find((c) => c.followUp).followUp.askable, true);
const molitP1 = Logic.evaluatePolicy(molit, Logic.PRESETS[0].input, {}, today).conditions.find((c) => c.followUp);
expect('질문 숨김: 국토부 × 프리셋1 (소득 fail → 부모 소득 질문 안 물음)', molitP1.followUp.askable, false);
const molitNo = Logic.evaluatePolicy(molit, p2, { 'parents-income-100': '아니오' }, today).conditions.find((c) => c.followUp);
expect('질문 유지: 국토부 × 프리셋2 + "아니오" (접혀도 답 변경 가능)', molitNo.followUp.askable, true);

// ── 2. 프리셋 × 제도 판정표 (처음 판정) ──────────────────────────
const results = Logic.PRESETS.map((pr) => ({ preset: pr, out: Logic.evaluateAll(POLICIES, pr.input, {}, today) }));
const verdictOf = (out, id) => [...out.rows, ...out.hidden].find((r) => r.id === id);

console.log(`\n[프리셋 × 제도 판정] 기준일 ${today} · 추가 질문 답 없음(처음 판정)`);
const nameW = Math.max(...POLICIES.map((p) => width(shortName(p)))) + 2;
const colW = 24;
console.log('  ' + pad('제도', nameW) + pad("구분", 8) + Logic.PRESETS.map((p) => pad(`#${p.id} ${p.name}`, colW)).join(''));
console.log('  ' + '─'.repeat(nameW + 8 + colW * 3));
for (const p of POLICIES) {
  const scope = { before: '이사전', after: '이사후', national: '전국' }[p.scope];
  const cells = results.map(({ out }) => {
    const r = verdictOf(out, p.id);
    const marks = r.conditions.map((c) => Logic.MARK[c.result]).join('');
    return pad(`${r.verdictLabel} ${marks}`, colW);
  });
  console.log('  ' + pad(shortName(p), nameW) + pad(scope, 8) + cells.join(''));
}
console.log('  (✓✗? = 조건별 결과, 순서: 나이·거주·소득·신분·1인가구·주거·blocking 중 해당 제도에 있는 것만)');

// ── 3. 프리셋별 상세 ─────────────────────────────────────────
for (const { preset, out } of results) {
  const s = out.summary;
  console.log(`\n[#${preset.id} ${preset.name}] 새로 생김 ${s.gained} · 사라짐 ${s.lost} · 유지 ${s.kept} · 확인 필요 ${s.check}`);
  for (const r of out.rows) {
    console.log(`  ${pad(r.categoryLabel, 10)}${pad(r.verdictLabel, 10)}${shortName(r.policy)}  — ${r.applyDisplay}`);
    for (const c of r.checks) console.log(`  ${' '.repeat(20)}? ${c}`);
    if (args.detail) for (const c of r.conditions) console.log(`  ${' '.repeat(20)}${Logic.MARK[c.result]} 「${c.quote}」 ↔ ${c.inputText}`);
  }
  console.log(`  ${pad('(접힘)', 10)}해당 안 되는 제도 ${out.hidden.length}개: ${out.hidden.map((r) => shortName(r.policy)).join(', ')}`);
  if (out.questions.length) console.log(`  추가 질문: ${out.questions.map((q) => q.question).join(' / ')}`);
  console.log('  ⚠ 이사 전에 확인할 것');
  if (!out.warnings.length) console.log('    (없음)');
  for (const w of out.warnings) console.log(`    - ${w.text}`);
}

// ── 4. 정답 대조 (data/answer-key.js 가 생기면) ─────────────────
console.log('\n[정답 대조]');
if (!ANSWER_KEY) {
  console.log('  data/answer-key.js 없음 — 6단계에서 answer-key.md 변환 후 대조합니다.');
} else {
  let total = 0, match = 0, wrongEligible = 0;
  for (const { preset, out } of results) {
    for (const p of POLICIES) {
      const expected = (ANSWER_KEY[preset.id] || {})[p.id];
      if (!expected) continue;
      const actual = verdictOf(out, p.id).verdictLabel;
      total++;
      if (actual === expected) match++;
      else {
        if (actual === '해당') wrongEligible++;
        console.log(`  ✗ #${preset.id} ${shortName(p)}: 정답 ${expected} / 결과 ${actual}`);
      }
    }
  }
  const rate = total ? (match / total) * 100 : 0;
  const pass = rate >= 90 && wrongEligible === 0;
  console.log(`  일치 ${match}/${total} (${rate.toFixed(1)}%) · 잘못된 '해당' ${wrongEligible}개 → 완료 조건 ${pass ? 'PASS' : 'FAIL'}`);
  if (!pass) fails++;
}

console.log(fails ? `\n자체 점검 실패 ${fails}개` : '\n자체 점검 모두 통과');
process.exit(fails ? 1 : 0);
