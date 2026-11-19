// 판정 로직 — 브라우저(window.Logic)와 Node(require) 양쪽에서 동작, 외부 의존성 없음.
// 규칙은 CLAUDE.md "판정 규칙" · "구분 규칙" · "⚠ 이사 전에 확인할 것" 을 그대로 옮긴 것.
// LLM은 여기 관여하지 않는다: 같은 입력(+같은 답)이면 항상 같은 결과.
(function (root, factory) {
  const Logic = factory();
  if (typeof module === 'object' && module.exports) module.exports = Logic;
  else root.Logic = Logic;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ── 입력 구간 ──────────────────────────────────────────────
  const INCOME_BANDS = { p0_60: [0, 60], p60_100: [60, 100], p100_150: [100, 150], p150_up: [150, Infinity] };
  const GG_BANDS = { y0_1: [0, 1], y1_3: [1, 3], y3_up: [3, Infinity] };

  const LABELS = {
    status: { student: '학생', employed: '재직', jobseeker: '구직 중(미취업)', other: '기타' },
    housing: { monthly_rent: '월세', jeonse: '전세', with_parents: '부모님 집' },
    income: { p0_60: '중위소득 60% 이하', p60_100: '중위소득 60~100%', p100_150: '중위소득 100~150%', p150_up: '중위소득 150% 초과', unknown: '모름' },
    ggYears: { y0_1: '1년 미만', y1_3: '1~3년', y3_up: '3년 이상', unknown: '모름' },
  };
  const COND_LABEL = { age: '나이', residence: '거주', income: '소득', status: '신분', single: '1인 가구', housing: '주거 형태' };
  const COND_ORDER = ['age', 'residence', 'income', 'status', 'single', 'housing'];
  const VERDICT_LABEL = { eligible: '해당', check: '확인 필요', ineligible: '미해당' };
  const CATEGORY_BY_SCOPE = { before: 'lost', after: 'gained', national: 'kept' };
  const CATEGORY_LABEL = { gained: '새로 생김', lost: '사라짐', kept: '유지' };
  const CATEGORY_ORDER = ['lost', 'gained', 'kept']; // 화면 순서: 01 사라짐 · 02 새로 생김 · 03 유지
  const MARK = { pass: '✓', fail: '✗', unknown: '?' };

  // 테스트 프리셋 = 검증 입력 (CLAUDE.md "테스트 프리셋")
  const PRESETS = [
    { id: 1, name: '24세 사회초년생', input: { age: 24, status: 'employed', single: true, housing: 'monthly_rent', income: 'p60_100', ggYears: 'y3_up', moveDate: '2026-12-01' } },
    { id: 2, name: '21세 대학생', input: { age: 21, status: 'student', single: true, housing: 'monthly_rent', income: 'p0_60', ggYears: 'y3_up', moveDate: '2026-12-01' } },
    { id: 3, name: '소득 모름', input: { age: 26, status: 'jobseeker', single: true, housing: 'monthly_rent', income: 'unknown', ggYears: 'y1_3', moveDate: '2026-12-01' } },
  ];

  // ── 작은 도구들 ────────────────────────────────────────────
  const toArray = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);
  const pad2 = (n) => String(n).padStart(2, '0');
  const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
  const addYears = (ymd, years) => {
    const [y, m, d] = ymd.split('-').map(Number);
    return `${y + years}-${pad2(m)}-${pad2(d)}`;
  };
  const incomeRangeText = (c) => (c.minPct != null ? `중위소득 ${c.minPct}% 초과 ~ ${c.maxPct}% 이하` : `중위소득 ${c.maxPct}% 이하`);
  const matchesWhen = (when, input) => !when || Object.entries(when).every(([field, values]) => values.includes(input[field]));

  // 한국어 조사: 이름 끝의 괄호 설명을 떼고 마지막 한글 글자의 받침으로 고른다.
  function hasFinalConsonant(name) {
    const core = name.replace(/\s*\([^)]*\)\s*$/, '');
    const ch = [...core].reverse().find((c) => c >= '가' && c <= '힣');
    return ch ? (ch.charCodeAt(0) - 0xac00) % 28 !== 0 : false;
  }
  const withWa = (name) => `${name}${hasFinalConsonant(name) ? '과' : '와'}`;
  const withEun = (name) => `${name}${hasFinalConsonant(name) ? '은' : '는'}`;

  // ── 조건 하나의 기본 판정 (추가 질문 적용 전) ──────────────────
  // 반환: { result: pass|fail|unknown, inputText, check?: 확인 필요일 때 무엇을 확인할지, applyFrom? }
  function baseResult(key, c, scope, input) {
    switch (key) {
      case 'age': {
        if (!Number.isFinite(input.age)) return { result: 'unknown', inputText: '나이 미입력', check: '나이를 입력하세요.' };
        return { result: c.min <= input.age && input.age <= c.max ? 'pass' : 'fail', inputText: `만 ${input.age}세` };
      }
      case 'residence': {
        if (scope === 'after') {
          const r = { result: 'pass', inputText: `서울 마포구 전입 예정 (${input.moveDate || '날짜 미입력'})` };
          if (c.minYears != null && input.moveDate) r.applyFrom = addYears(input.moveDate, c.minYears);
          return r;
        }
        if (scope === 'national') return { result: 'pass', inputText: '전국 대상' };
        // before: 현재 수원 거주로 고정 → region pass. minYears 있으면 경기도 거주 기간과 비교.
        if (c.minYears == null) return { result: 'pass', inputText: '수원시 거주 (이사 전)' };
        const text = `경기도 거주 ${LABELS.ggYears[input.ggYears] || '모름'}`;
        const band = GG_BANDS[input.ggYears];
        if (!band) return { result: 'unknown', inputText: text, check: '경기도 거주 기간을 모릅니다. 주민등록초본의 주소 이력으로 확인하세요.' };
        const [lo, hi] = band;
        if (lo >= c.minYears) return { result: 'pass', inputText: text };
        if (hi <= c.minYears) return { result: 'fail', inputText: text };
        return { result: 'unknown', inputText: text, check: `경기도 거주 기간이 기준선(${c.minYears}년)에 걸쳐 있습니다. 주민등록초본으로 확인하세요.` };
      }
      case 'income': {
        const text = LABELS.income[input.income] || '모름';
        const band = INCOME_BANDS[input.income];
        if (!band) return { result: 'unknown', inputText: text, check: `소득을 모릅니다. 건강보험료로 가구 중위소득을 확인하세요. 기준은 ${incomeRangeText(c)}입니다.` };
        const [lo, hi] = band;
        const min = c.minPct != null ? c.minPct : 0;
        if (lo >= min && hi <= c.maxPct) return { result: 'pass', inputText: text };
        if (hi <= min || lo >= c.maxPct) return { result: 'fail', inputText: text };
        return { result: 'unknown', inputText: text, check: `소득 구간이 기준선에 걸쳐 있습니다. 건강보험료로 확인하세요. 기준은 ${incomeRangeText(c)}입니다.` };
      }
      case 'status': {
        const text = LABELS.status[input.status] || '미입력';
        if (c.allowed.includes(input.status)) return { result: 'pass', inputText: text };
        if (input.status === 'other') {
          const allowed = c.allowed.map((s) => LABELS.status[s]).join('·');
          return { result: 'unknown', inputText: text, check: `신분이 기타입니다. 공고의 신분 조건(${allowed})에 맞는지 확인하세요.` };
        }
        return { result: 'fail', inputText: text };
      }
      case 'single': {
        const text = input.single ? '1인 가구' : '1인 가구 아님';
        return { result: c.required && input.single === false ? 'fail' : 'pass', inputText: text };
      }
      case 'housing': {
        const text = LABELS.housing[input.housing] || '미입력';
        return { result: c.allowed.includes(input.housing) ? 'pass' : 'fail', inputText: text };
      }
      default:
        throw new Error(`알 수 없는 조건: ${key}`);
    }
  }

  // 활성 추가 질문의 답을 결과로 바꾼다. 답이 없으면 unknown.
  function applyAnswer(fu, answers) {
    const answer = answers[fu.id] != null ? answers[fu.id] : null;
    const opt = answer != null ? fu.options.find((o) => o.label === answer) : null;
    return {
      result: opt ? opt.result : 'unknown',
      followUp: { id: fu.id, question: fu.question, options: fu.options, answer },
    };
  }

  // ── 제도 하나 판정 ─────────────────────────────────────────
  function evaluatePolicy(policy, input, answers = {}, today = todayStr()) {
    const conditions = [];

    for (const key of COND_ORDER) {
      const c = policy.conditions[key];
      if (c == null) continue;
      const base = baseResult(key, c, policy.scope, input);
      const row = { key, label: COND_LABEL[key], quote: c.quote, inputText: base.inputText, base: base.result, result: base.result, check: base.check || null, followUp: null };
      if (base.applyFrom) row.applyFrom = base.applyFrom;

      // 기본 결과가 pass가 아니고 when이 맞는 질문이 있으면 → 그 질문이 결과를 정한다.
      if (base.result !== 'pass') {
        const fu = toArray(c.followUp).find((f) => matchesWhen(f.when, input));
        if (fu) {
          const a = applyAnswer(fu, answers);
          row.result = a.result;
          row.followUp = a.followUp;
          if (a.result === 'unknown') row.check = fu.question;
        }
      }
      conditions.push(row);
    }

    // blocking 꼬리표: 판정에 들어가는 조건처럼 취급 (답 전엔 unknown)
    const notes = [];
    for (const x of policy.extraChecks || []) {
      if (typeof x === 'string') { notes.push(x); continue; }
      if (!x.blocking) { notes.push(x.text); continue; }
      const fu = toArray(x.followUp).find((f) => matchesWhen(f.when, input));
      if (!fu) continue; // 이 입력에는 해당 없는 꼬리표
      const a = applyAnswer(fu, answers);
      conditions.push({
        key: 'extra', label: x.text, quote: x.quote, inputText: a.followUp.answer || '아직 답 안 함',
        base: 'unknown', result: a.result, check: a.result === 'unknown' ? fu.question : null, followUp: a.followUp,
      });
    }

    // 질문은 답에 따라 제도 판정이 바뀔 수 있을 때만 묻는다:
    // 질문과 무관한 다른 조건이 이미 fail이면 (예: 나이 초과) 답해도 미해당이므로 묻지 않음.
    for (const r of conditions) {
      if (!r.followUp) continue;
      r.followUp.askable = !conditions.some((o) => o !== r && o.result === 'fail' && !o.followUp);
    }

    const results = conditions.map((r) => r.result);
    const verdict = results.includes('fail') ? 'ineligible' : results.includes('unknown') ? 'check' : 'eligible';
    const category = verdict === 'ineligible' ? null : CATEGORY_BY_SCOPE[policy.scope];
    const applyClosed = !!(policy.applyEnd && policy.applyEnd < today);
    const applyFrom = (conditions.find((r) => r.applyFrom) || {}).applyFrom || null;

    let applyDisplay = policy.applyPeriod;
    if (applyClosed) applyDisplay = `${policy.applyEnd.slice(0, 4)}년 접수는 끝났습니다. 다음 공고를 확인하세요.`;
    else if (applyFrom) applyDisplay = `${applyFrom}부터 신청할 수 있습니다(전입 후 ${policy.conditions.residence.minYears}년). ${policy.applyPeriod}`;

    return {
      id: policy.id,
      policy,
      conditions,
      verdict,
      verdictLabel: VERDICT_LABEL[verdict],
      category,
      categoryLabel: category ? CATEGORY_LABEL[category] : null,
      checks: verdict === 'check' ? conditions.filter((r) => r.result === 'unknown' && r.check).map((r) => r.check) : [],
      notes, // "신청 전 추가 확인" 꼬리표 (판정과 무관)
      applyClosed,
      applyFrom,
      applyDisplay,
    };
  }

  // ── 전체 판정: 표 · 요약 · ⚠ · 질문 목록 ───────────────────────
  function evaluateAll(policies, input, answers = {}, today = todayStr()) {
    const all = policies.map((p) => evaluatePolicy(p, input, answers, today));
    const shown = CATEGORY_ORDER.flatMap((cat) => all.filter((r) => r.category === cat));
    const hidden = all.filter((r) => r.category === null);

    const summary = { gained: 0, lost: 0, kept: 0, check: 0 };
    for (const r of shown) { summary[r.category]++; if (r.verdict === 'check') summary.check++; }

    // 같은 id 질문은 화면에 처음 나오는 줄에서만 묻는다 (표 → 접힌 영역 순서)
    const questions = [];
    const seen = new Set();
    for (const r of [...shown, ...hidden]) {
      for (const c of r.conditions) {
        if (!c.followUp || !c.followUp.askable) continue;
        c.followUp.primary = !seen.has(c.followUp.id);
        if (c.followUp.primary) { seen.add(c.followUp.id); questions.push({ ...c.followUp, policyId: r.id }); }
      }
    }

    return { rows: shown, hidden, summary, warnings: buildWarnings(shown, today), questions, today };
  }

  // ⚠ 이사 전에 확인할 것 — 최대 3줄, 규칙 순서대로
  function buildWarnings(shown, today) {
    const out = [];
    // 1. 사라짐 + 해당 (이미 접수 마감된 건 "마무리하세요"가 의미 없으므로 제외)
    for (const r of shown) {
      if (r.category === 'lost' && r.verdict === 'eligible' && !r.applyClosed) {
        out.push({ type: 'lost', text: `${withEun(r.policy.name)} 전입하면 받을 수 없습니다. 이사 전에 신청과 수령을 마치세요.` });
      }
    }
    // 2. 중복 불가 쌍이 둘 다 표에 있음
    const shownIds = new Map(shown.map((r) => [r.id, r]));
    const pairs = new Set();
    for (const r of shown) {
      for (const otherId of r.policy.exclusiveWith || []) {
        const o = shownIds.get(otherId);
        const key = [r.id, otherId].sort().join('|');
        if (!o || pairs.has(key)) continue;
        pairs.add(key);
        out.push({ type: 'exclusive', text: `${withWa(r.policy.name)} ${withEun(o.policy.name)} 함께 받을 수 없습니다. 하나만 고르세요.` });
      }
    }
    // 3. 확인 필요 중 마감이 가장 가까운 것 (아직 마감 전)
    const upcoming = shown
      .filter((r) => r.verdict === 'check' && r.policy.applyEnd && r.policy.applyEnd >= today)
      .sort((a, b) => a.policy.applyEnd.localeCompare(b.policy.applyEnd))[0];
    if (upcoming) {
      out.push({ type: 'deadline', text: `${withEun(upcoming.policy.name)} ${upcoming.policy.applyEnd}에 마감합니다. 그 전에 확인할 것: ${upcoming.checks[0] || '자격 조건'}` });
    }
    return out.slice(0, 3);
  }

  return {
    PRESETS, LABELS, COND_LABEL, VERDICT_LABEL, CATEGORY_LABEL, MARK,
    INCOME_BANDS, GG_BANDS,
    baseResult, evaluatePolicy, evaluateAll, todayStr, withWa, withEun,
  };
});
