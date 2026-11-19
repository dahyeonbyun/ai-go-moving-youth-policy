// node test/check-quotes.js
// 1) POLICIES·MOCK_EXTRACTIONS의 모든 quote가 raw/<id>.txt 원문에 그대로 들어 있는지 검사 (공백 차이는 무시)
// 2) 스키마의 기본 형식(enum·숫자·날짜) 검사
// 3) data/raw-texts.js를 raw/ 원문으로 다시 만든다 (★ 제도)
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const load = (file) => {
  const window = {};
  new Function('window', fs.readFileSync(path.join(root, file), 'utf8'))(window);
  return window;
};
const POLICIES = load('data/policies.js').POLICIES;
const MOCK = load('data/mock-extractions.js').MOCK_EXTRACTIONS;
const DEMO_IDS = Object.keys(MOCK);

const norm = (s) => s.replace(/\s+/g, ' ').trim();
const STATUS = ['student', 'employed', 'jobseeker', 'other'];
const HOUSING = ['monthly_rent', 'jeonse', 'with_parents'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

let errors = 0;
const err = (id, msg) => { errors++; console.log(`  ✗ [${id}] ${msg}`); };

// followUp 검사: 형식 + "모름"(unknown) 선택지 필수 + 같은 id는 같은 질문 문장
const INPUT_VALUES = {
  status: STATUS, housing: HOUSING, single: [true, false],
  income: ['p0_60', 'p60_100', 'p100_150', 'p150_up', 'unknown'],
  ggYears: ['y0_1', 'y1_3', 'y3_up', 'unknown'],
};
const questionById = {};
let followUpCount = 0;
const checkFollowUp = (pid, fu) => {
  for (const f of Array.isArray(fu) ? fu : [fu]) {
    followUpCount++;
    if (!f.id || !f.question || !Array.isArray(f.options)) { err(pid, `followUp 형식 이상: ${JSON.stringify(f)}`); continue; }
    if (questionById[f.id] && questionById[f.id] !== f.question) err(pid, `followUp id ${f.id} 의 질문 문장이 다른 곳과 다름`);
    questionById[f.id] = f.question;
    if (!f.options.every((o) => o.label && ['pass', 'fail', 'unknown'].includes(o.result))) err(pid, `followUp ${f.id} 선택지 result 이상`);
    if (!f.options.some((o) => o.label === '모름' && o.result === 'unknown')) err(pid, `followUp ${f.id} 에 "모름"(unknown) 없음`);
    for (const [field, vals] of Object.entries(f.when || {})) {
      if (!INPUT_VALUES[field]) err(pid, `followUp ${f.id} when 의 입력 항목 ${field} 이상`);
      else if (!vals.every((v) => INPUT_VALUES[field].includes(v))) err(pid, `followUp ${f.id} when.${field} 값 이상`);
    }
  }
};

for (const p of [...POLICIES, ...Object.values(MOCK)]) {
  const rawFile = path.join(root, 'raw', `${p.id}.txt`);
  if (!fs.existsSync(rawFile)) { err(p.id, `raw/${p.id}.txt 없음`); continue; }
  const raw = norm(fs.readFileSync(rawFile, 'utf8'));
  let n = 0;
  for (const [key, c] of Object.entries(p.conditions)) {
    if (c === null) continue;
    n++;
    if (!c.quote || !raw.includes(norm(c.quote))) err(p.id, `${key}.quote 가 원문에 없음: "${c.quote}"`);
    if (key === 'age' && !(Number.isFinite(c.min) && Number.isFinite(c.max) && c.min <= c.max)) err(p.id, 'age min/max 이상');
    if (key === 'income' && !(Number.isFinite(c.maxPct) && (c.minPct === null || c.minPct < c.maxPct))) err(p.id, 'income minPct/maxPct 이상');
    if (key === 'status' && !(c.allowed || []).every((v) => STATUS.includes(v))) err(p.id, 'status 값 이상');
    if (key === 'housing' && !(c.allowed || []).every((v) => HOUSING.includes(v))) err(p.id, 'housing 값 이상');
    if (key === 'single' && c.required !== true) err(p.id, 'single.required 는 true 여야 함');
    if (c.followUp) checkFollowUp(p.id, c.followUp);
  }
  for (const x of p.extraChecks) {
    if (typeof x === 'string') continue;
    if (!x.text) err(p.id, `extraChecks 객체에 text 없음`);
    if (x.blocking) {
      n++;
      if (!x.quote || !raw.includes(norm(x.quote))) err(p.id, `blocking 꼬리표 quote 가 원문에 없음: "${x.quote}"`);
      if (!x.followUp) err(p.id, `blocking 꼬리표에 followUp 없음 (답할 방법이 없음)`);
    }
    if (x.followUp) checkFollowUp(p.id, x.followUp);
  }
  if (!['before', 'after', 'national'].includes(p.scope)) err(p.id, 'scope 이상');
  for (const k of ['applyStart', 'applyEnd', 'checkedAt']) if (p[k] !== null && !DATE.test(p[k])) err(p.id, `${k} 날짜 형식 이상`);
  for (const other of p.exclusiveWith) {
    if (![...POLICIES.map((x) => x.id), ...DEMO_IDS].includes(other)) err(p.id, `exclusiveWith 의 ${other} 가 없는 id`);
  }
  console.log(`  ${errors ? '·' : '✓'} ${p.id.padEnd(16)} 조건 ${n}개`);
}

// raw-texts.js 재생성 (★ 제도만)
const rawTexts = {};
for (const id of DEMO_IDS) rawTexts[id] = fs.readFileSync(path.join(root, 'raw', `${id}.txt`), 'utf8');
fs.writeFileSync(
  path.join(root, 'data/raw-texts.js'),
  '// ★ 데모용 공고 원문 (raw/ 에서 test/check-quotes.js 가 자동 생성 — 직접 고치지 말 것)\n' +
    `window.RAW_TEXTS = ${JSON.stringify(rawTexts, null, 2)};\n`
);
console.log(`\n  followUp ${followUpCount}개 (질문 id ${Object.keys(questionById).length}종)`);
console.log(`  data/raw-texts.js 생성: ${DEMO_IDS.join(', ')}`);
if (POLICIES.some((p) => DEMO_IDS.includes(p.id))) err('★', '데모 제도가 POLICIES에도 들어 있음');

console.log(errors ? `\nFAIL — 오류 ${errors}개` : '\nPASS — 모든 quote가 원문에 있음');
process.exit(errors ? 1 : 0);
