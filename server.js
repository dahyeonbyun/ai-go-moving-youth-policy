// 로컬 서버: 정적 파일 + /api/health + /api/extract
// Node 18+ 내장 모듈과 내장 fetch만 사용 (npm 설치 없음).
// 실행: node server.js  →  http://localhost:3000
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

// ---------- .env 직접 파싱 ----------
function loadEnv(file) {
  const env = {};
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { return env; }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[m[1]] = v;
  }
  return env;
}

const fileEnv = loadEnv(path.join(ROOT, '.env'));
const cfg = (k, d = '') => (process.env[k] ?? fileEnv[k] ?? d);
const PROVIDER = cfg('PROVIDER', 'anthropic').toLowerCase();
const API_KEY = cfg('API_KEY');
const MODEL = cfg('MODEL');
const PORT = Number(cfg('PORT', '3000')) || 3000;
const MODE = API_KEY ? 'live' : 'mock';

const MAX_BODY = 200 * 1024; // 원문 200KB까지

// ---------- 정적 파일 ----------
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function serveStatic(req, res) {
  let rel;
  try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { return send(res, 400, 'Bad Request'); }
  if (rel.endsWith('/')) rel += 'index.html';
  const full = path.normalize(path.join(ROOT, rel));
  // 프로젝트 밖, 숨김 파일(.env 등), server.js 자체는 제공하지 않음
  if (!full.startsWith(ROOT + path.sep) || rel.split('/').some((p) => p.startsWith('.')) || full === __filename) {
    return send(res, 404, 'Not Found');
  }
  fs.readFile(full, (err, buf) => {
    if (err) return send(res, 404, 'Not Found');
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(full).toLowerCase()] || 'application/octet-stream' });
    res.end(buf);
  });
}

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type });
  res.end(body);
}
const sendJson = (res, status, obj) => send(res, status, JSON.stringify(obj), 'application/json; charset=utf-8');

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(Object.assign(new Error('원문이 너무 깁니다.'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// ---------- LLM 호출 ----------
const SYSTEM_PROMPT_FILE = path.join(ROOT, 'prompts', 'extract.md');

async function callLLM(system, user) {
  if (!MODEL) throw Object.assign(new Error('.env에 MODEL이 없습니다.'), { status: 500 });

  if (PROVIDER === 'anthropic') {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 4096, temperature: 0, system, messages: [{ role: 'user', content: user }] }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw upstreamError(r.status, data?.error?.message);
    return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  }

  if (PROVIDER === 'openai') {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({
        model: MODEL, temperature: 0, response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw upstreamError(r.status, data?.error?.message);
    return data.choices?.[0]?.message?.content || '';
  }

  throw Object.assign(new Error(`지원하지 않는 PROVIDER입니다: ${PROVIDER}`), { status: 500 });
}

function upstreamError(status, msg) {
  return Object.assign(new Error(`LLM API 오류 (${status})${msg ? ': ' + msg : ''}`), { status: 502 });
}

// 응답에서 JSON 객체만 꺼낸다 (코드블록 표시나 앞뒤 문장이 섞여 와도)
function parseJsonObject(text) {
  const s = String(text).replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  try { return JSON.parse(s); } catch {}
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch {} }
  return null;
}

// ---------- 스키마 검증 ----------
const STATUS = ['student', 'employed', 'jobseeker', 'other'];
const HOUSING = ['monthly_rent', 'jeonse', 'with_parents'];
const SCOPES = ['before', 'after', 'national'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isStr = (v) => typeof v === 'string' && v.trim() !== '';
const strOrNull = (v) => v === null || typeof v === 'string';
const dateOrNull = (v) => v === null || (typeof v === 'string' && DATE.test(v));

function validatePolicy(p) {
  const errors = [];
  const err = (m) => errors.push(m);
  if (!p || typeof p !== 'object' || Array.isArray(p)) return ['JSON 객체가 아닙니다.'];

  for (const k of ['id', 'name', 'org']) if (!isStr(p[k])) err(`${k}가 비어 있습니다.`);
  if (!SCOPES.includes(p.scope)) err('scope는 before / after / national 중 하나여야 합니다.');

  const c = p.conditions;
  if (!c || typeof c !== 'object' || Array.isArray(c)) {
    err('conditions가 객체가 아닙니다.');
  } else {
    const q = (name, o) => { if (!isStr(o.quote)) err(`${name}.quote가 비어 있습니다.`); };
    const check = {
      age(o) {
        if (!isNum(o.min) || !isNum(o.max)) err('age.min / age.max는 숫자여야 합니다.');
        else if (o.min > o.max) err('age.min이 age.max보다 큽니다.');
      },
      residence(o) {
        if (!isStr(o.region)) err('residence.region이 비어 있습니다.');
        if (!(o.minYears === null || o.minYears === undefined || isNum(o.minYears))) err('residence.minYears는 숫자 또는 null이어야 합니다.');
      },
      income(o) {
        if (!isNum(o.maxPct)) err('income.maxPct는 숫자여야 합니다.');
        if (!(o.minPct === null || o.minPct === undefined || isNum(o.minPct))) err('income.minPct는 숫자 또는 null이어야 합니다.');
        if (isNum(o.minPct) && isNum(o.maxPct) && o.minPct >= o.maxPct) err('income.minPct가 maxPct보다 크거나 같습니다.');
      },
      status(o) {
        if (!Array.isArray(o.allowed) || !o.allowed.length || o.allowed.some((v) => !STATUS.includes(v))) err(`status.allowed는 ${STATUS.join(' / ')} 중에서만 써야 합니다.`);
      },
      single(o) {
        if (o.required !== true) err('single.required는 true여야 합니다 (조건이 없으면 single을 null로).');
      },
      housing(o) {
        if (!Array.isArray(o.allowed) || !o.allowed.length || o.allowed.some((v) => !HOUSING.includes(v))) err(`housing.allowed는 ${HOUSING.join(' / ')} 중에서만 써야 합니다.`);
      },
    };
    for (const [key, fn] of Object.entries(check)) {
      const o = c[key];
      if (o === undefined) { c[key] = null; continue; }
      if (o === null) continue;
      if (typeof o !== 'object' || Array.isArray(o)) { err(`conditions.${key}는 객체 또는 null이어야 합니다.`); continue; }
      fn(o); q(key, o);
    }
    for (const key of Object.keys(c)) if (!(key in check)) err(`알 수 없는 조건 키입니다: ${key}`);
  }

  if (!Array.isArray(p.extraChecks) || p.extraChecks.some((v) => typeof v !== 'string')) err('extraChecks는 문장 배열이어야 합니다.');
  if (!Array.isArray(p.exclusiveWith) || p.exclusiveWith.some((v) => typeof v !== 'string')) err('exclusiveWith는 문자열 배열이어야 합니다.');
  for (const k of ['benefit', 'applyPeriod', 'howToApply', 'sourceUrl']) if (!strOrNull(p[k])) err(`${k}는 문자열 또는 null이어야 합니다.`);
  for (const k of ['applyStart', 'applyEnd', 'checkedAt']) if (!dateOrNull(p[k])) err(`${k}는 YYYY-MM-DD 또는 null이어야 합니다.`);
  return errors;
}

// LLM 결과에서 사람이 다는 항목(followUp · blocking 꼬리표)은 지운다
function stripHumanOnly(p) {
  if (p && p.conditions && typeof p.conditions === 'object') {
    for (const o of Object.values(p.conditions)) if (o && typeof o === 'object') delete o.followUp;
  }
  if (Array.isArray(p.extraChecks)) {
    p.extraChecks = p.extraChecks.map((v) => (v && typeof v === 'object' ? (isStr(v.text) ? v.text : null) : v)).filter((v) => v !== null);
  }
  return p;
}

// quote가 원문에 그대로 있는지 (공백 차이는 무시)
function missingQuotes(p, rawText) {
  const norm = (s) => String(s).replace(/\s+/g, ' ').trim();
  const raw = norm(rawText);
  const out = [];
  for (const [key, o] of Object.entries(p.conditions || {})) {
    if (o && isStr(o.quote) && !raw.includes(norm(o.quote))) out.push(key);
  }
  return out;
}

async function handleExtract(req, res) {
  if (MODE !== 'live') return sendJson(res, 503, { error: 'API 키가 없어 mock 모드입니다. .env에 API_KEY를 넣고 서버를 다시 켜세요.' });

  let body;
  try { body = JSON.parse(await readBody(req)); } catch (e) {
    return sendJson(res, e.status || 400, { error: e.status ? e.message : '요청 본문이 JSON이 아닙니다.' });
  }
  const rawText = typeof body?.rawText === 'string' ? body.rawText : '';
  const scope = body?.scope;
  if (!rawText.trim()) return sendJson(res, 400, { error: '원문이 비어 있습니다.' });
  if (!SCOPES.includes(scope)) return sendJson(res, 400, { error: 'scope는 before / after / national 중 하나여야 합니다.' });

  const system = fs.readFileSync(SYSTEM_PROMPT_FILE, 'utf8');
  const today = new Date().toISOString().slice(0, 10);
  const user = `구분(scope): ${scope}\n확인일(checkedAt): ${today}\n\n공고 원문:\n${rawText}`;

  const started = Date.now();
  let text;
  try { text = await callLLM(system, user); } catch (e) {
    console.error(`[extract] 실패: ${e.message}`);
    return sendJson(res, e.status || 502, { error: e.message });
  }

  const policy = parseJsonObject(text);
  if (!policy) {
    console.error('[extract] 응답에서 JSON을 찾지 못했습니다.');
    return sendJson(res, 502, { error: 'LLM 응답에서 JSON을 찾지 못했습니다.' });
  }
  stripHumanOnly(policy);
  policy.scope = scope; // 구분은 사용자가 고른 값으로 고정
  if (policy.checkedAt == null) policy.checkedAt = today;

  const errors = validatePolicy(policy);
  const unquoted = errors.length ? [] : missingQuotes(policy, rawText);
  console.log(`[extract] ${PROVIDER} · 원문 ${rawText.length}자 · ${Date.now() - started}ms · 오류 ${errors.length} · 원문에 없는 quote ${unquoted.length}`);

  if (errors.length) return sendJson(res, 422, { error: '추출 결과가 스키마와 맞지 않습니다.', details: errors, policy });
  return sendJson(res, 200, { policy, warnings: unquoted.map((k) => `${k}의 원문 문장이 붙여넣은 원문에서 그대로 찾아지지 않습니다.`) });
}

// ---------- 라우팅 ----------
const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://x');
  try {
    if (pathname === '/api/health' && req.method === 'GET') {
      return sendJson(res, 200, { mode: MODE, provider: MODE === 'live' ? PROVIDER : null });
    }
    if (pathname === '/api/extract') {
      if (req.method !== 'POST') return sendJson(res, 405, { error: 'POST만 받습니다.' });
      return await handleExtract(req, res);
    }
    if (pathname.startsWith('/api/')) return sendJson(res, 404, { error: '없는 API입니다.' });
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method Not Allowed');
    return serveStatic(req, res);
  } catch (e) {
    console.error(`[server] ${e.message}`);
    if (!res.headersSent) sendJson(res, 500, { error: '서버 오류' });
  }
});

if (require.main === module) {
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`http://localhost:${PORT}  (${MODE} 모드${MODE === 'live' ? ` · ${PROVIDER} · ${MODEL || 'MODEL 없음'}` : ' · .env에 API_KEY 없음'})`);
  });
}

module.exports = { validatePolicy, parseJsonObject, stripHumanOnly, missingQuotes };
