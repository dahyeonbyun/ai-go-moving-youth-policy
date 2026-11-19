// 화면 — 해시 라우팅으로 단계형 화면을 그린다. 판정은 전부 js/logic.js 가 한다.
//   #/            소개
//   #/q/1 ~ #/q/7 질문 하나씩
//   (비교 중 0.8초)
//   #/result      결과
//   #/check       검증 · #/add 공고 추가 (결과 화면 맨 아래 작은 링크)
// 입력값은 주소의 ?뒤에 넣어 새로고침해도 유지한다. 추가 질문 답은 메모리에만 둔다.
(function () {
  'use strict';
  const Logic = window.Logic;
  const POLICIES = window.POLICIES || [];
  const TODAY = Logic.todayStr();
  const RM = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const reduce = () => RM.matches;

  // ── 상태 (메모리) ─────────────────────────────
  const state = {
    draft: {},           // 질문 화면에서 채우는 입력값 (주소와 동기화)
    answers: {},         // 추가 질문 답 { 질문 id: 선택지 label }
    answersFor: null,    // 어떤 입력에 대한 답인지 (입력이 바뀌면 답을 비운다)
    added: [],           // 공고 추가(AI)로 넣은 제도 — 4단계
    expanded: new Set(), // 근거를 펼친 제도
    hiddenOpen: false,
    tableOpen: false,
    examplesOpen: false,
    animateResult: false, // 결과 첫 등장 때만 카운트업 · 순차 등장
    currentPath: null,
    advanceTimer: null,
    pointerPick: false,
  };

  // ── 작은 도구 ─────────────────────────────────
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tidy = (s) => String(s == null ? '' : s).replace(/\s*→\s*/g, ', '); // 원문의 화살표 기호는 화면에서만 쉼표로
  const allPolicies = () => POLICIES.concat(state.added);
  const shortName = (name) => name.replace(/\s*\([^)]*\)\s*$/, '');
  const pad2 = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  // ── 입력값 ↔ 주소 ─────────────────────────────
  const ENUMS = {
    status: ['student', 'employed', 'jobseeker', 'other'],
    housing: ['monthly_rent', 'jeonse', 'with_parents'],
    income: ['p0_60', 'p60_100', 'p100_150', 'p150_up', 'unknown'],
    ggYears: ['y0_1', 'y1_3', 'y3_up', 'unknown'],
  };
  const URL_KEY = { age: 'age', status: 'status', single: 'single', housing: 'housing', income: 'income', ggYears: 'gg', moveDate: 'move' };
  const ORDER = ['age', 'status', 'single', 'housing', 'income', 'ggYears', 'moveDate'];

  function validDate(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false;
    const [y, m, d] = s.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
  }
  const validAge = (v) => Number.isInteger(v) && v >= 0 && v <= 120;
  function isValid(key, v) {
    if (key === 'age') return validAge(v);
    if (key === 'single') return v === true || v === false;
    if (key === 'moveDate') return validDate(v);
    return ENUMS[key].includes(v);
  }
  function toQuery(input) {
    const q = new URLSearchParams();
    for (const k of ORDER) {
      if (!isValid(k, input[k])) continue;
      q.set(URL_KEY[k], k === 'single' ? (input[k] ? '1' : '0') : String(input[k]));
    }
    return q.toString();
  }
  function fromQuery(str) {
    const q = new URLSearchParams(str || '');
    const o = {};
    if (q.has('age') && /^\d{1,3}$/.test(q.get('age'))) o.age = Number(q.get('age'));
    if (q.has('single')) o.single = q.get('single') === '1' ? true : q.get('single') === '0' ? false : undefined;
    for (const k of ['status', 'housing', 'income', 'ggYears', 'moveDate']) if (q.has(URL_KEY[k])) o[k] = q.get(URL_KEY[k]);
    for (const k of Object.keys(o)) if (!isValid(k, o[k])) delete o[k];
    return o;
  }
  const firstMissing = (input) => ORDER.findIndex((k) => !isValid(k, input[k]));
  const isComplete = (input) => firstMissing(input) === -1;

  function parseHash() {
    const raw = location.hash.replace(/^#/, '') || '/';
    const i = raw.indexOf('?');
    const path = i === -1 ? raw : raw.slice(0, i);
    const query = i === -1 ? '' : raw.slice(i + 1);
    return { path: path || '/', input: fromQuery(query) };
  }
  function go(path, input) {
    const q = toQuery(input || state.draft);
    const target = '#' + path + (q ? '?' + q : '');
    if (location.hash === target) route(); else location.hash = target;
  }
  // 질문에 답할 때마다 주소도 맞춰 둔다 (새로고침 대비). 화면 전환은 일으키지 않는다.
  function syncHashQuietly() {
    const { path } = parseHash();
    const q = toQuery(state.draft);
    const url = location.href.split('#')[0] + '#' + path + (q ? '?' + q : ''); // 문서 주소 기준으로 (상대 주소 해석 차이 방지)
    try { history.replaceState(null, '', url); } catch (_) { /* 주소 갱신 실패는 화면 동작에 영향 없음 */ }
  }

  // ── 질문 정의 ─────────────────────────────────
  const QUESTIONS = [
    { key: 'age', type: 'age', title: '만 나이가 어떻게 되나요?', desc: '올해 생일이 지났는지를 따져 계산한 나이입니다.' },
    { key: 'status', type: 'choice', title: '지금 어떤 상태인가요?', desc: '가장 가까운 것을 고르세요.', options: [
      { v: 'student', label: '학생', sub: '대학 재학·휴학 포함' },
      { v: 'employed', label: '재직', sub: '아르바이트·계약직 포함' },
      { v: 'jobseeker', label: '구직 중', sub: '현재 일하지 않음' },
      { v: 'other', label: '기타', sub: '' },
    ] },
    { key: 'single', type: 'choice', title: '1인 가구인가요?', desc: '주민등록상 기준입니다.', options: [
      { v: true, label: '예', sub: '주민등록상 혼자' },
      { v: false, label: '아니오', sub: '가족·배우자와 함께' },
    ] },
    { key: 'housing', type: 'choice', title: '어떤 집에 살 예정인가요?', desc: '이사 후 기준', options: [
      { v: 'monthly_rent', label: '월세', sub: '' },
      { v: 'jeonse', label: '전세', sub: '' },
      { v: 'with_parents', label: '부모님 집', sub: '' },
    ] },
    { key: 'income', type: 'choice', title: '가구 소득은 어느 구간인가요?', desc: '2026년 기준 중위소득, 1인 가구 2,564,238원 기준', options: [
      { v: 'p0_60', label: '60% 이하', sub: '월 약 154만 원 이하' },
      { v: 'p60_100', label: '60~100%', sub: '월 약 154만~256만 원' },
      { v: 'p100_150', label: '100~150%', sub: '월 약 256만~385만 원' },
      { v: 'p150_up', label: '150% 초과', sub: '월 약 385만 원 초과' },
      { v: 'unknown', label: '모름', sub: '건강보험료 납부액으로 확인할 수 있습니다' },
    ] },
    { key: 'ggYears', type: 'choice', title: '경기도에 얼마나 살았나요?', desc: '주민등록상 경기도에 산 기간', options: [
      { v: 'y0_1', label: '1년 미만', sub: '' },
      { v: 'y1_3', label: '1~3년', sub: '' },
      { v: 'y3_up', label: '3년 이상', sub: '' },
      { v: 'unknown', label: '모름', sub: '' },
    ] },
    { key: 'moveDate', type: 'date', title: '언제 전입할 예정인가요?', desc: '서울 마포구로 전입신고할 날짜입니다.' },
  ];
  const TOTAL = QUESTIONS.length;

  // ── 화면 전환 ─────────────────────────────────
  // dir: 'up' 앞으로(새 화면이 아래에서 올라옴) · 'down' 뒤로 · 'fade'
  function mount(node, dir = 'fade', dur = 300) {
    const stage = $('#stage');
    // 빠르게 연달아 넘길 때: 이미 나가는 중인 화면은 바로 치우고, 지금 화면만 전환한다
    for (const leaving of stage.querySelectorAll(':scope > .leaving')) leaving.remove();
    const old = stage.firstElementChild;
    window.scrollTo(0, 0);
    node.style.setProperty('--dur', dur + 'ms');
    if (!old || reduce()) {
      stage.replaceChildren(node);
      focusScreen(node);
      return;
    }
    old.classList.add('leaving');
    old.style.setProperty('--dur', dur + 'ms');
    node.classList.add('from-' + dir);
    stage.appendChild(node);
    node.getBoundingClientRect(); // 시작 상태를 한 번 그리게 한다
    old.classList.add('to-' + dir);
    node.classList.remove('from-' + dir);
    setTimeout(() => old.remove(), dur + 40);
    focusScreen(node);
  }
  function focusScreen(node) {
    const target = node.querySelector('[data-autofocus]') || node.querySelector('h1');
    if (target) target.focus({ preventScroll: true });
  }

  // 선을 따라 움직이는 작은 점 (소개 · 비교 중). 화면에서 빠지면 멈춘다.
  function runAlongPath(svg, pathSel, dotSel, period) {
    const path = svg && svg.querySelector(pathSel);
    const dot = svg && svg.querySelector(dotSel);
    if (!path || !dot) return;
    const len = path.getTotalLength();
    const place = (t) => { const p = path.getPointAtLength(len * t); dot.setAttribute('cx', p.x.toFixed(2)); dot.setAttribute('cy', p.y.toFixed(2)); };
    if (reduce()) { place(0.5); return; }
    const start = performance.now();
    const tick = (now) => {
      if (!svg.isConnected) return;
      place(easeInOut(((now - start) % period) / period));
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // ── 소개 #/ ───────────────────────────────────
  const INTRO_ART = `
<svg viewBox="0 0 520 420" role="img" aria-label="경기 수원시에서 서울 마포구로 이어지는 점선">
  <g class="orbit" fill="none" stroke="#ececec" stroke-width="1">
    <circle cx="260" cy="210" r="70" stroke-dasharray="2 7"/>
    <circle cx="260" cy="210" r="125"/>
    <circle cx="260" cy="210" r="180" stroke-dasharray="1 9"/>
    <circle cx="260" cy="210" r="235"/>
  </g>
  <g fill="none" stroke="#111" stroke-width="1" stroke-linejoin="round" stroke-linecap="round">
    <path d="M96 318 v-26 l20 -16 l20 16 v26 z"/>
    <path d="M110 318 v-12 h12 v12"/>
    <path d="M384 128 v-44 h30 v44 z"/>
    <path d="M392 94 h6 M406 94 h2 M392 106 h6 M406 106 h2 M392 118 h6 M406 118 h2"/>
    <path d="M374 128 h50"/>
    <path id="route" d="M140 296 C 210 170, 300 330, 378 112" stroke-dasharray="3 6"/>
    <circle class="mover" cx="140" cy="296" r="4.5"/>
  </g>
  <g font-size="13" fill="#8a8a8a" font-family="Pretendard, sans-serif">
    <text x="116" y="344" text-anchor="middle">경기 수원시</text>
    <text x="399" y="154" text-anchor="middle">서울 마포구</text>
  </g>
</svg>`;
  const dataDate = () => allPolicies().map((p) => p.checkedAt).filter(Boolean).sort().pop() || '-';

  function renderIntro() {
    const L = Logic.LABELS;
    const examples = Logic.PRESETS.map((p, i) => {
      const sub = `${L.status[p.input.status]} · ${L.housing[p.input.housing]} · ${p.input.income === 'unknown' ? '소득 모름' : L.income[p.input.income]}`;
      return `<button type="button" class="opt" data-act="example" data-preset="${p.id}">
        <span class="opt-text"><span class="opt-label">${esc(p.name)}</span><span class="opt-sub">${esc(sub)}</span></span>
        <span class="opt-key" aria-hidden="true">${i + 1}</span></button>`;
    }).join('');
    document.title = '이사 청년 제도 비교';
    return el(`
<section class="screen intro">
  <div class="intro-grid">
    <p class="intro-label">청년 정책 비교</p>
    <h1 class="intro-title" tabindex="-1">이사 가면, 내 청년 제도는 어떻게 바뀔까</h1>
    <div class="intro-art">${INTRO_ART}</div>
    <p class="intro-desc">경기 수원시에서 서울 마포구로 옮기면 받을 수 있는 제도가 달라집니다.<br>조건 일곱 가지에 답하면 공고 원문을 근거로 비교합니다.</p>
    <div class="intro-actions">
      <button type="button" class="btn primary" data-act="start">비교하기</button>
      <button type="button" class="btn" data-act="examples" aria-expanded="${state.examplesOpen}" aria-controls="examples">예시 보기</button>
    </div>
    <div class="intro-examples collapse${state.examplesOpen ? ' open' : ''}" id="examples"><div class="collapse-inner">
      <div class="opts" role="group" aria-label="예시">${examples}</div>
    </div></div>
    <p class="intro-meta">경기 수원시 → 서울 마포구 · 공고 원문 ${allPolicies().length}건 · 기준일 ${esc(dataDate())}</p>
  </div>
</section>`);
  }

  // ── 질문 #/q/n ────────────────────────────────
  const endOfMonth = () => { const d = new Date(TODAY); return ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0)); };
  const nextMonthFirst = () => { const d = new Date(TODAY); return ymd(new Date(d.getFullYear(), d.getMonth() + 1, 1)); };

  function renderQuestion(n) {
    const q = QUESTIONS[n - 1];
    const v = state.draft[q.key];
    let control;
    if (q.type === 'choice') {
      control = `<div class="opts" role="radiogroup" aria-labelledby="q-title">` + q.options.map((o, i) => {
        const checked = v === o.v;
        return `<label class="opt${checked ? ' is-selected' : ''}">
          <input type="radio" name="q-opt" value="${esc(String(o.v))}" data-i="${i}"${checked ? ' checked' : ''}>
          <span class="opt-dot" aria-hidden="true"></span>
          <span class="opt-text"><span class="opt-label">${esc(o.label)}</span>${o.sub ? `<span class="opt-sub">${esc(o.sub)}</span>` : ''}</span>
          <span class="opt-key" aria-hidden="true">${i + 1}</span>
        </label>`;
      }).join('') + `</div>`;
    } else if (q.type === 'age') {
      control = `<div class="age">
          <button type="button" class="round" data-act="dec" aria-label="한 살 줄이기">−</button>
          <input class="age-input" id="age-input" data-autofocus inputmode="numeric" autocomplete="off" maxlength="3" placeholder="24" aria-labelledby="q-title" value="${validAge(v) ? v : ''}">
          <button type="button" class="round" data-act="inc" aria-label="한 살 늘리기">+</button>
        </div><p class="age-unit">세</p>`;
    } else {
      control = `<input class="date-input" id="date-input" data-autofocus inputmode="numeric" autocomplete="off" maxlength="10" placeholder="2026-12-01" aria-labelledby="q-title" aria-describedby="date-help" value="${validDate(v) ? v : ''}">
        <p class="sr" id="date-help">연도 네 자리, 월, 일 순서로 입력합니다.</p>
        <div class="quick" role="group" aria-label="빠른 선택">
          <button type="button" class="chip" data-act="eom" aria-pressed="${v === endOfMonth()}">이번 달 말</button>
          <button type="button" class="chip" data-act="nm1" aria-pressed="${v === nextMonthFirst()}">다음 달 1일</button>
          <button type="button" class="chip" data-act="pick" aria-pressed="false">직접 선택</button>
          <input type="date" class="native-date" tabindex="-1" aria-hidden="true">
        </div>`;
    }
    document.title = `${pad2(n)} / ${pad2(TOTAL)} · ${q.title}`;
    return el(`
<section class="screen q-screen" data-q="${n}">
  <div class="q-top">
    <div class="q-top-row">
      <button type="button" class="link-btn plain" data-act="prev">이전</button>
      <span class="q-count" aria-label="${n}번째 질문, 전체 ${TOTAL}개">${pad2(n)} / ${pad2(TOTAL)}</span>
    </div>
    <div class="progress" aria-hidden="true"><span style="width:${(n / TOTAL) * 100}%"></span></div>
  </div>
  <div class="q-body">
    <h1 class="q-title" id="q-title" tabindex="-1">${esc(q.title)}</h1>
    <p class="q-desc">${esc(q.desc)}</p>
    <div class="q-control">${control}</div>
    <p class="q-error" role="alert"></p>
    <div class="q-actions"><button type="button" class="btn primary" data-act="next"${isValid(q.key, v) ? '' : ' disabled'}>${n === TOTAL ? '비교하기' : '다음'}</button></div>
  </div>
</section>`);
  }

  const qScreen = () => $('#stage .q-screen:not(.leaving)');
  const currentQ = () => { const s = qScreen(); return s ? Number(s.dataset.q) : null; };
  function setNextEnabled(screen, ok) { const b = $('[data-act="next"]', screen); if (b) b.disabled = !ok; }
  function showQError(screen, msg) { const e = $('.q-error', screen); if (e) e.textContent = msg || ''; }

  function selectOption(screen, input, autoAdvance) {
    const n = Number(screen.dataset.q);
    const q = QUESTIONS[n - 1];
    state.draft[q.key] = q.options[Number(input.dataset.i)].v;
    for (const lab of screen.querySelectorAll('.opt')) lab.classList.toggle('is-selected', lab.contains(input));
    showQError(screen, '');
    setNextEnabled(screen, true);
    syncHashQuietly();
    clearTimeout(state.advanceTimer);
    if (autoAdvance) state.advanceTimer = setTimeout(() => { if (currentQ() === n) next(n); }, 300);
  }

  function next(n) {
    const q = QUESTIONS[n - 1];
    if (!isValid(q.key, state.draft[q.key])) {
      showQError(qScreen(), q.type === 'age' ? '0에서 120 사이의 숫자를 입력하세요.' : q.type === 'date' ? '날짜를 2026-12-01 형식으로 입력하세요.' : '하나를 고르세요.');
      return;
    }
    if (n < TOTAL) go(`/q/${n + 1}`);
    else startCompare({ ...state.draft });
  }
  const prev = (n) => (n > 1 ? go(`/q/${n - 1}`) : go('/'));

  function setAge(v) {
    const screen = qScreen();
    const inp = $('#age-input', screen);
    if (inp) inp.value = v;
    state.draft.age = v;
    showQError(screen, '');
    setNextEnabled(screen, true);
    syncHashQuietly();
  }
  function markQuick(screen, v) {
    for (const b of screen.querySelectorAll('.quick .chip')) {
      const a = b.dataset.act;
      b.setAttribute('aria-pressed', String((a === 'eom' && v === endOfMonth()) || (a === 'nm1' && v === nextMonthFirst())));
    }
  }
  function setDate(v) {
    const screen = qScreen();
    const inp = $('#date-input', screen);
    if (inp) inp.value = v;
    state.draft.moveDate = v;
    markQuick(screen, v);
    showQError(screen, '');
    setNextEnabled(screen, true);
    syncHashQuietly();
  }

  // ── 비교 중 ───────────────────────────────────
  function startCompare(input) {
    const node = el(`
<section class="screen comparing">
  <div>
    <svg viewBox="0 0 220 24" aria-hidden="true">
      <path id="cmp-line" d="M8 12 H212" fill="none" stroke="#111" stroke-width="1" stroke-dasharray="2 5"/>
      <circle class="cmp-dot" cx="8" cy="12" r="4" fill="none" stroke="#111" stroke-width="1"/>
    </svg>
    <p tabindex="-1" data-autofocus>공고 ${allPolicies().length}건과 비교하고 있습니다</p>
  </div>
</section>`);
    state.currentPath = 'comparing';
    mount(node, 'fade', 300);
    runAlongPath(node.querySelector('svg'), '#cmp-line', '.cmp-dot', 1600);
    setTimeout(() => { state.animateResult = true; go('/result', input); }, 800);
  }

  // ── 결과 #/result ─────────────────────────────
  const VERDICT_UI = { eligible: '해당', check: '확인 필요', ineligible: '해당 없음' };
  const DOT = { eligible: '●', check: '◐', ineligible: '○' };
  const RESULT_WORD = { pass: '충족', fail: '불충족', unknown: '확인 필요' };
  const LABEL_TO_UI = { '해당': '해당', '확인 필요': '확인 필요', '미해당': '해당 없음' };
  const SCOPE_LABEL = { before: '이사 전 · 경기 수원', after: '이사 후 · 서울 마포', national: '전국' };
  const GROUPS = [
    { cat: 'lost', no: '01', title: '사라지는 제도', empty: '이사로 사라지는 제도는 없습니다.' },
    { cat: 'gained', no: '02', title: '새로 생기는 제도', empty: '이사로 새로 생기는 제도는 없습니다.' },
    { cat: 'kept', no: '03', title: '그대로 유지되는 제도', empty: '그대로 유지되는 제도는 없습니다.' },
  ];
  // 공고 원문 링크 — 새 탭으로 연다. 화면 읽기 프로그램에는 어느 제도의 공고인지 알린다.
  const srcLink = (p) => `<a class="src-link" href="${esc(p.sourceUrl)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(p.name)} 공고 원문 (새 탭)">공고 원문</a>`;
  const verdictHtml = (v) => `<span class="verdict v-${v}"><span class="dot" aria-hidden="true">${DOT[v]}</span>${VERDICT_UI[v]}</span>`;

  function condChips(input) {
    const L = Logic.LABELS;
    const [, m, d] = input.moveDate.split('-').map(Number);
    return [
      `만 ${input.age}세`, L.status[input.status], input.single ? '1인 가구' : '1인 가구 아님', L.housing[input.housing],
      input.income === 'unknown' ? '소득 모름' : L.income[input.income], `경기도 ${L.ggYears[input.ggYears]}`, `${m}월 ${d}일 전입`,
    ];
  }

  function ledeHtml(s) {
    const N = (n) => `<span class="num" data-to="${n}">${n}</span>`;
    let main;
    if (s.gained && s.lost) main = `이사하면 ${N(s.gained)}개가 새로 생기고 ${N(s.lost)}개가 사라집니다.`;
    else if (s.gained) main = `이사하면 ${N(s.gained)}개가 새로 생기고, 사라지는 제도는 없습니다.`;
    else if (s.lost) main = `이사하면 ${N(s.lost)}개가 사라지고, 새로 생기는 제도는 없습니다.`;
    else main = '이사해도 새로 생기거나 사라지는 제도는 없습니다.';
    const sub = [];
    if (s.kept) sub.push(`${s.kept}개는 그대로 유지됩니다.`);
    if (s.check) sub.push(`이 가운데 ${s.check}개는 확인이 필요합니다.`);
    return `<p class="lede">${main}</p>${sub.length ? `<p class="lede-sub">${sub.join(' ')}</p>` : ''}`;
  }

  function checkLines(r) {
    if (r.verdict !== 'check') return [];
    return r.conditions.filter((c) => c.result === 'unknown').map((c) => {
      if (!c.followUp) return c.check;
      if (c.followUp.answer) return `${c.followUp.question} 모름으로 답했습니다. 공고와 서류로 확인하세요.`;
      return null; // 아직 답하지 않은 질문은 아래 선택지로 보여준다
    }).filter(Boolean);
  }

  function askHtml(r) {
    return r.conditions.filter((c) => c.followUp && c.followUp.askable).map((c) => {
      const fu = c.followUp;
      if (!fu.primary) {
        return `<div class="ask shared"><span class="ask-label">질문</span>위에서 답한 「${esc(fu.question)}」의 답(${esc(fu.answer || '아직 답하지 않음')})을 함께 씁니다.</div>`;
      }
      const btns = fu.options.map((o) =>
        `<button type="button" data-act="answer" data-qid="${esc(fu.id)}" data-label="${esc(o.label)}" aria-pressed="${fu.answer === o.label}">${esc(o.label)}</button>`).join('');
      return `<div class="ask"><span class="ask-label">질문</span><span class="ask-q">${esc(fu.question)}</span>
        <span class="seg" role="group" aria-label="${esc(fu.question)}">${btns}</span>
        ${fu.answer ? `<span class="ask-res">이 조건: ${RESULT_WORD[c.result]}</span>` : ''}</div>`;
    }).join('');
  }

  function evidenceHtml(r) {
    const p = r.policy;
    const conds = r.conditions.map((c) => `<li>
        <span class="c-name">${esc(c.label)}</span>
        <span class="c-quote">「${esc(c.quote)}」</span>
        <span class="c-mine">내 조건: ${esc(c.inputText)}</span>
        <span class="c-res r-${c.result}">${RESULT_WORD[c.result]}</span></li>`).join('');
    const notes = r.notes.length ? `<div class="ev-notes">신청 전 확인 (판정에는 반영하지 않습니다)<ul>${r.notes.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '';
    return `<div class="ev">
      <dl class="ev-meta">
        <dt>운영 주체</dt><dd>${esc(p.org)}</dd>
        <dt>지원 내용</dt><dd>${esc(tidy(p.benefit))}</dd>
        <dt>신청 기간</dt><dd>${esc(p.applyPeriod)}</dd>
        <dt>신청 방법</dt><dd>${esc(tidy(p.howToApply))}</dd>
      </dl>
      <ul class="ev-conds" aria-label="조건별 근거">${conds}</ul>
      ${notes}
      <p class="ev-source">${srcLink(p)}<span class="faint"> · 확인일 ${esc(p.checkedAt)}</span></p>
    </div>`;
  }

  function rowHtml(r, i, hidden) {
    const p = r.policy;
    const open = state.expanded.has(r.id);
    const reason = hidden
      ? `<p class="row-reason">맞지 않는 조건: ${esc(r.conditions.filter((c) => c.result === 'fail').map((c) => `${c.label}(${c.inputText})`).join(', '))}</p>`
      : '';
    return `<li class="row${state.animateResult && !hidden ? ' rise' : ''}" style="--i:${i}" data-id="${esc(r.id)}">
      <div class="row-head">
        <h3 class="row-name">${hidden ? `<span class="row-scope">${esc(SCOPE_LABEL[p.scope])}</span>` : ''}${esc(p.name)}</h3>
        ${verdictHtml(r.verdict)}
      </div>
      <p class="row-benefit" title="${esc(tidy(p.benefit))}">${esc(tidy(p.benefit))}</p>
      <p class="row-apply">${esc(r.applyDisplay)}</p>
      ${reason}
      ${checkLines(r).map((t) => `<p class="row-check">${esc(t)}</p>`).join('')}
      ${askHtml(r)}
      <div class="row-foot"><button type="button" class="link-btn" data-act="toggle" data-id="${esc(r.id)}" aria-expanded="${open}" aria-controls="ev-${esc(r.id)}">근거</button>${srcLink(p)}</div>
      <div class="collapse${open ? ' open' : ''}" id="ev-${esc(r.id)}"><div class="collapse-inner">${evidenceHtml(r)}</div></div>
    </li>`;
  }

  function tableHtml(out) {
    const rows = [...out.rows, ...out.hidden].map((r) => {
      const lines = checkLines(r);
      return `<tr>
        <td class="nowrap">${esc(r.categoryLabel || '해당 없음')}</td>
        <td><b>${esc(r.policy.name)}</b>${lines.length ? `<div class="faint">${esc(lines.join(' '))}</div>` : ''}</td>
        <td>${esc(r.policy.org)}</td>
        <td class="nowrap">${verdictHtml(r.verdict)}</td>
        <td>${esc(tidy(r.policy.benefit))}</td>
        <td>${esc(r.applyDisplay)}<div class="faint">${esc(tidy(r.policy.howToApply))}</div></td>
        <td class="nowrap">${srcLink(r.policy)}</td></tr>`;
    }).join('');
    return `<div class="table-wrap"><table class="cmp"><thead><tr><th>구분</th><th>제도</th><th>운영 주체</th><th>판정</th><th>지원 내용</th><th>신청 시기와 방법</th><th>출처</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function toggleBlock(act, label, open, id, inner) {
    return `<div class="toggle-line">
      <button type="button" data-act="${act}" aria-expanded="${open}" aria-controls="${id}"><span>${label}</span><span class="state">${open ? '닫기' : '열기'}</span></button>
      <div class="collapse${open ? ' open' : ''}" id="${id}"><div class="collapse-inner">${inner}</div></div>
    </div>`;
  }

  function resultInner(input) {
    const out = Logic.evaluateAll(allPolicies(), input, state.answers, TODAY);
    const q = toQuery(input);
    let i = 0;
    const groups = GROUPS.map((g) => {
      const list = out.rows.filter((r) => r.category === g.cat);
      return `<section class="group" aria-labelledby="g-${g.cat}">
        <div class="group-head"><span class="no">${g.no}</span><h2 id="g-${g.cat}">${g.title}</h2><span class="count">${list.length}개</span></div>
        ${list.length ? `<ul class="rows">${list.map((r) => rowHtml(r, i++, false)).join('')}</ul>` : `<p class="empty">${g.empty}</p>`}
      </section>`;
    }).join('');
    const warns = out.warnings.length
      ? out.warnings.map((w) => `<li>${esc(w.text)}</li>`).join('')
      : '<li class="muted">지금 조건으로는 이사 전에 서둘러 챙길 항목이 없습니다.</li>';
    const hiddenList = out.hidden.length ? `<ul class="rows">${out.hidden.map((r) => rowHtml(r, 0, true)).join('')}</ul>` : '<p class="empty">없습니다.</p>';
    return `
      <div class="res-top"><a class="home" href="#/">청년 정책 비교</a></div>
      <div class="cond-row" aria-label="내 조건">
        ${condChips(input).map((c) => `<span class="cond">${esc(c)}</span>`).join('')}
        <button type="button" class="link-btn" data-act="edit">조건 바꾸기</button>
      </div>
      <h1 class="sr" tabindex="-1">비교 결과</h1>
      ${ledeHtml(out.summary)}
      <aside class="memo" aria-labelledby="memo-h"><h2 id="memo-h">이사 전에 확인할 것</h2><ol>${warns}</ol></aside>
      ${groups}
      ${toggleBlock('hidden', `해당 없는 제도 ${out.hidden.length}개`, state.hiddenOpen, 'hidden-list', hiddenList)}
      ${toggleBlock('table', '표로 보기', state.tableOpen, 'table-view', tableHtml(out)).replace('class="toggle-line"', 'class="toggle-line" style="margin-top:0"')}
      <section class="sources" aria-labelledby="src-h">
        <h2 id="src-h">출처와 기준일</h2>
        <ol>${allPolicies().map((p) => `<li>${esc(p.name)} <a href="${esc(p.sourceUrl)}" target="_blank" rel="noopener">공고 원문</a> <span class="faint">확인일 ${esc(p.checkedAt)}</span></li>`).join('')}</ol>
        <p class="caution">신청 전에 공식 공고를 꼭 확인하세요. 이 페이지는 공고 원문을 옮겨 비교한 참고 자료이고, 선정 여부는 각 기관의 심사로 정해집니다.</p>
      </section>
      <nav class="foot-links" aria-label="더 보기"><a href="#/add?${q}">공고 직접 추가해보기</a><a href="#/check?${q}">검증</a></nav>`;
  }

  function renderResult(input) {
    const key = toQuery(input);
    if (state.answersFor !== key) { // 다른 조건이면 이전 답 · 펼침 상태를 비운다
      state.answers = {}; state.answersFor = key; state.expanded.clear(); state.hiddenOpen = false; state.tableOpen = false;
    }
    document.title = '비교 결과 · 이사 청년 제도 비교';
    return el(`<section class="screen"><div class="result" id="result">${resultInner(input)}</div></section>`);
  }

  // 답이 바뀌면 결과 내용만 다시 그린다 (전환 효과 없이)
  function refreshResult(focusSel) {
    const box = $('#result');
    if (!box) return;
    state.animateResult = false;
    box.innerHTML = resultInner(state.draft);
    const f = focusSel && box.querySelector(focusSel);
    if (f) f.focus({ preventScroll: true });
  }

  function countUp(root) {
    if (reduce()) return;
    const nums = root.querySelectorAll('.num');
    for (const n of nums) n.textContent = '0';
    const start = performance.now();
    const dur = 700;
    let done = false;
    const finish = () => { done = true; for (const n of nums) n.textContent = n.dataset.to; };
    const tick = () => {
      if (done || !root.isConnected) return;
      const t = Math.min(1, Math.max(0, (performance.now() - start) / dur));
      const e = 1 - Math.pow(1 - t, 3);
      for (const n of nums) n.textContent = String(Math.round(Number(n.dataset.to) * e));
      if (t < 1) requestAnimationFrame(tick); else finish();
    };
    requestAnimationFrame(tick);
    // 탭이 가려져 프레임이 멈춰도 최종 숫자는 반드시 보이게
    setTimeout(finish, dur + 150);
  }

  // 펼치기: 내용은 그대로 두고 높이만 바꾼다
  function toggleCollapse(btn, open) {
    btn.setAttribute('aria-expanded', String(open));
    const panel = document.getElementById(btn.getAttribute('aria-controls'));
    if (panel) panel.classList.toggle('open', open);
    const st = btn.querySelector('.state');
    if (st) st.textContent = open ? '닫기' : '열기';
  }

  // ── 검증 #/check ──────────────────────────────
  function renderCheck(input) {
    const KEY = window.ANSWER_KEY || null;
    const results = Logic.PRESETS.map((pr) => {
      const out = Logic.evaluateAll(POLICIES, pr.input, {}, TODAY);
      const map = {};
      for (const r of out.rows.concat(out.hidden)) map[r.id] = r.verdictLabel;
      return { pr, map };
    });
    let total = 0, match = 0, wrong = 0;
    const head = '<thead><tr><th>제도</th>' + results.map(({ pr }) => `<th>${esc(pr.name)}<br><span class="faint">정답 / 결과</span></th>`).join('') + '</tr></thead>';
    const body = POLICIES.map((p) => '<tr><td>' + esc(shortName(p.name)) + '</td>' + results.map(({ pr, map }) => {
      const exp = KEY && KEY[pr.id] ? KEY[pr.id][p.id] : null;
      const act = map[p.id];
      let cls = '';
      if (exp) { total++; if (exp === act) match++; else { cls = ' class="mismatch"'; if (act === '해당') wrong++; } }
      return `<td${cls}><span class="faint">${esc(exp ? LABEL_TO_UI[exp] : '-')}</span> / ${esc(LABEL_TO_UI[act])}</td>`;
    }).join('') + '</tr>').join('');
    let score;
    if (!KEY) score = '정답 파일(data/answer-key.js)이 아직 없습니다. 지금은 결과만 표시합니다.';
    else {
      const rate = total ? (match / total) * 100 : 0;
      score = `일치율 ${match}/${total}(${rate.toFixed(1)}%), 잘못된 해당 ${wrong}개. 완료 조건은 ${rate >= 90 && wrong === 0 ? '통과' : '미통과'}입니다.`;
    }
    const back = isComplete(input) ? `#/result?${toQuery(input)}` : '#/';
    document.title = '검증 · 이사 청년 제도 비교';
    return el(`<section class="screen"><div class="page verify">
      <div class="res-top"><a class="home" href="${back}">결과로 돌아가기</a></div>
      <h1 tabindex="-1">검증</h1>
      <p class="page-desc">예시 세 명의 처음 판정을 직접 만든 정답과 대조합니다. 추가 질문의 답은 반영하지 않습니다. 기준일 ${esc(TODAY)}.</p>
      <p class="verify-score">${esc(score)}</p>
      <div class="table-wrap" style="margin-top:20px"><table class="cmp">${head}<tbody>${body}</tbody></table></div>
      <p class="faint small" style="margin-top:10px">밑줄은 정답과 다른 칸입니다. 기준: 일치율 90% 이상, 잘못된 해당 0개.</p>
    </div></section>`);
  }

  // ── 공고 추가 #/add (4단계에서 채움) ──────────
  function renderAdd(input) {
    const back = isComplete(input) ? `#/result?${toQuery(input)}` : '#/';
    document.title = '공고 직접 추가 · 이사 청년 제도 비교';
    return el(`<section class="screen"><div class="page">
      <div class="res-top"><a class="home" href="${back}">결과로 돌아가기</a></div>
      <h1 tabindex="-1">공고 직접 추가</h1>
      <p class="page-desc">공고 원문을 붙여 넣으면 자격 조건을 표로 옮기고, 확인을 거쳐 비교 목록에 더합니다. 이 화면은 다음 단계에서 연결합니다.</p>
    </div></section>`);
  }

  // ── 라우터 ────────────────────────────────────
  function route() {
    const { path, input } = parseHash();
    const prevPath = state.currentPath;
    state.draft = { ...input };
    clearTimeout(state.advanceTimer);

    const qm = path.match(/^\/q\/(\d)$/);
    if (qm) {
      const n = Math.min(Math.max(Number(qm[1]), 1), TOTAL);
      const pm = prevPath && prevPath.match(/^\/q\/(\d)$/);
      const dir = pm ? (n >= Number(pm[1]) ? 'up' : 'down') : (prevPath === '/result' ? 'down' : 'up');
      state.currentPath = `/q/${n}`;
      mount(renderQuestion(n), dir, 400);
      return;
    }
    if (path === '/result') {
      if (!isComplete(input)) { go(`/q/${firstMissing(input) + 1}`, input); return; }
      state.currentPath = path;
      const node = renderResult(input);
      mount(node, 'fade', 300);
      if (state.animateResult) countUp(node);
      state.animateResult = false;
      return;
    }
    if (path === '/check') { state.currentPath = path; mount(renderCheck(input), 'fade'); return; }
    if (path === '/add') { state.currentPath = path; mount(renderAdd(input), 'fade'); return; }
    state.currentPath = '/';
    const node = renderIntro();
    mount(node, prevPath && prevPath.startsWith('/q/') ? 'down' : 'fade');
    runAlongPath(node.querySelector('svg'), '#route', '.mover', 5000);
  }

  // ── 이벤트 (위임) ─────────────────────────────
  function onClick(e) {
    const t = e.target.closest('[data-act]');
    if (!t || !$('#stage').contains(t) || t.closest('.leaving')) return;
    const n = currentQ();
    switch (t.dataset.act) {
      case 'start': go('/q/1', {}); break;
      case 'examples': state.examplesOpen = t.getAttribute('aria-expanded') !== 'true'; toggleCollapse(t, state.examplesOpen); break;
      case 'example': {
        const p = Logic.PRESETS.find((x) => String(x.id) === t.dataset.preset);
        if (p) startCompare({ ...p.input });
        break;
      }
      case 'prev': prev(n); break;
      case 'next': next(n); break;
      case 'inc': case 'dec': {
        const cur = validAge(state.draft.age) ? state.draft.age : null;
        setAge(cur == null ? 24 : Math.min(120, Math.max(0, cur + (t.dataset.act === 'inc' ? 1 : -1))));
        break;
      }
      case 'eom': setDate(endOfMonth()); break;
      case 'nm1': setDate(nextMonthFirst()); break;
      case 'pick': {
        const nd = $('.native-date', qScreen());
        if (nd && typeof nd.showPicker === 'function') {
          try { nd.value = validDate(state.draft.moveDate) ? state.draft.moveDate : ''; nd.showPicker(); break; } catch (_) { /* 아래로 */ }
        }
        const di = $('#date-input', qScreen()); if (di) di.focus();
        break;
      }
      case 'edit': go('/q/1', parseHash().input); break;
      case 'toggle': {
        const id = t.dataset.id;
        const open = !state.expanded.has(id);
        if (open) state.expanded.add(id); else state.expanded.delete(id);
        toggleCollapse(t, open);
        break;
      }
      case 'hidden': state.hiddenOpen = !state.hiddenOpen; toggleCollapse(t, state.hiddenOpen); break;
      case 'table': state.tableOpen = !state.tableOpen; toggleCollapse(t, state.tableOpen); break;
      case 'answer':
        state.answers[t.dataset.qid] = t.dataset.label;
        // 조건 → 제도 판정 → 구분 → 요약 → 확인할 것 전부 다시 계산
        refreshResult(`[data-act="answer"][data-qid="${CSS.escape(t.dataset.qid)}"][data-label="${CSS.escape(t.dataset.label)}"]`);
        break;
      default: break;
    }
  }

  function onInput(e) {
    const screen = qScreen();
    if (!screen) return;
    if (e.target.id === 'age-input') {
      const digits = e.target.value.replace(/\D/g, '').slice(0, 3);
      if (digits !== e.target.value) e.target.value = digits;
      const v = digits === '' ? undefined : Number(digits);
      if (validAge(v)) { state.draft.age = v; showQError(screen, ''); } else delete state.draft.age;
      setNextEnabled(screen, validAge(v));
      syncHashQuietly();
    } else if (e.target.id === 'date-input') {
      const d = e.target.value.replace(/\D/g, '').slice(0, 8);
      const f = d.length > 6 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}` : d.length > 4 ? `${d.slice(0, 4)}-${d.slice(4)}` : d;
      if (f !== e.target.value) e.target.value = f;
      if (validDate(f)) { state.draft.moveDate = f; showQError(screen, ''); } else delete state.draft.moveDate;
      markQuick(screen, f);
      setNextEnabled(screen, validDate(f));
      syncHashQuietly();
    }
  }

  function onChange(e) {
    const t = e.target;
    if (t.classList.contains('native-date')) { if (validDate(t.value)) setDate(t.value); return; }
    if (t.name === 'q-opt') {
      selectOption(t.closest('.q-screen'), t, state.pointerPick); // 클릭·숫자키면 0.3초 뒤 다음, 방향키면 고르기만
      state.pointerPick = false;
    }
  }

  function onKey(e) {
    if (e.altKey || e.ctrlKey || e.metaKey || e.isComposing) return;
    const n = currentQ();
    if (n) {
      const screen = qScreen();
      const q = QUESTIONS[n - 1];
      if (e.key === 'Escape') { e.preventDefault(); prev(n); return; }
      if (e.key === 'Enter') {
        if (e.target.matches('button:not([data-act="next"])')) return; // 다른 버튼은 자기 동작
        e.preventDefault(); next(n); return;
      }
      if (q.type === 'choice' && /^[1-9]$/.test(e.key)) {
        const inp = screen.querySelectorAll('input[name="q-opt"]')[Number(e.key) - 1];
        if (inp) { e.preventDefault(); inp.checked = true; inp.focus({ preventScroll: true }); selectOption(screen, inp, true); }
      }
      return;
    }
    if (state.currentPath === '/' && state.examplesOpen && /^[1-3]$/.test(e.key)) {
      const p = Logic.PRESETS[Number(e.key) - 1];
      if (p) startCompare({ ...p.input });
    }
  }

  // 4단계(공고 추가)에서 쓴다
  window.App = { state, allPolicies, go, addPolicy(p) { state.added.push(p); } };

  document.addEventListener('click', onClick);
  // 마우스·터치로 고르면 0.3초 뒤 다음으로. 이미 골라 둔 것을 다시 눌러도 다음으로 간다.
  document.addEventListener('pointerdown', (e) => {
    const opt = e.target.closest('.q-screen .opt');
    if (!opt) return;
    state.pointerPick = true;
    const inp = opt.querySelector('input');
    if (inp && inp.checked) {
      opt.addEventListener('click', () => { state.pointerPick = false; selectOption(opt.closest('.q-screen'), inp, true); }, { once: true });
    }
  });
  document.addEventListener('input', onInput);
  document.addEventListener('change', onChange);
  document.addEventListener('keydown', onKey);
  window.addEventListener('hashchange', route);
  route();
})();
