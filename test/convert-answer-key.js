// answer-key.md 의 표 → data/answer-key.js (window.ANSWER_KEY = { 프리셋번호: { 제도id: 판정 } })
// 실행: node test/convert-answer-key.js
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const VALID = ['해당', '확인 필요', '미해당'];
const md = fs.readFileSync(path.join(root, 'answer-key.md'), 'utf8');

const key = {};
let rows = 0;
const errors = [];
for (const line of md.split('\n')) {
  const cells = line.trim().replace(/^\||\|$/g, '').split('|').map((s) => s.trim());
  if (cells.length !== 5 || cells[0] === 'id' || !/^[a-z][a-z0-9]*(-[a-z0-9]+)+$/.test(cells[0])) continue; // 머리글 · 구분선 건너뜀
  const [id, , ...verdicts] = cells;
  verdicts.forEach((v, i) => {
    if (!VALID.includes(v)) { errors.push(`${id} #${i + 1}: "${v}"`); return; }
    (key[i + 1] = key[i + 1] || {})[id] = v;
  });
  rows++;
}
if (errors.length) { console.error('알 수 없는 판정 값:\n  ' + errors.join('\n  ')); process.exit(1); }

const out = `// answer-key.md 에서 test/convert-answer-key.js 가 생성 — 직접 고치지 말 것
window.ANSWER_KEY = ${JSON.stringify(key, null, 2)};
`;
fs.writeFileSync(path.join(root, 'data', 'answer-key.js'), out);
console.log(`data/answer-key.js 생성: 제도 ${rows}개 × 프리셋 ${Object.keys(key).length}개 = ${rows * Object.keys(key).length}칸`);
