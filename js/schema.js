// 제도 데이터 스키마 검사 — 브라우저(window.Schema)와 Node(require) 양쪽에서 동작. 외부 의존성 없음.
(function (root, factory) {
  const Schema = factory();
  if (typeof module === 'object' && module.exports) module.exports = Schema;
  else root.Schema = Schema;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const STATUS = ['student', 'employed', 'jobseeker', 'other'];
  const HOUSING = ['monthly_rent', 'jeonse', 'with_parents'];
  const SCOPES = ['before', 'after', 'national'];
  const DATE = /^\d{4}-\d{2}-\d{2}$/;

  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
  const isStr = (v) => typeof v === 'string' && v.trim() !== '';
  const strOrNull = (v) => v === null || typeof v === 'string';
  const dateOrNull = (v) => v === null || (typeof v === 'string' && DATE.test(v));
  const numOrNull = (v) => v === null || v === undefined || isNum(v);
  const enumList = (v, list) => Array.isArray(v) && v.length > 0 && v.every((x) => list.includes(x));

  const CHECK = {
    age(o, err) {
      if (!isNum(o.min) || !isNum(o.max)) err('age.min / age.max는 숫자여야 합니다.');
      else if (o.min > o.max) err('age.min이 age.max보다 큽니다.');
    },
    residence(o, err) {
      if (!isStr(o.region)) err('residence.region이 비어 있습니다.');
      if (!numOrNull(o.minYears)) err('residence.minYears는 숫자 또는 null이어야 합니다.');
    },
    income(o, err) {
      if (!isNum(o.maxPct)) err('income.maxPct는 숫자여야 합니다.');
      if (!numOrNull(o.minPct)) err('income.minPct는 숫자 또는 null이어야 합니다.');
      if (isNum(o.minPct) && isNum(o.maxPct) && o.minPct >= o.maxPct) err('income.minPct가 maxPct보다 크거나 같습니다.');
    },
    status(o, err) {
      if (!enumList(o.allowed, STATUS)) err(`status.allowed는 ${STATUS.join(' / ')} 중에서만 써야 합니다.`);
    },
    single(o, err) {
      if (o.required !== true) err('single.required는 true여야 합니다 (조건이 없으면 single을 null로).');
    },
    housing(o, err) {
      if (!enumList(o.allowed, HOUSING)) err(`housing.allowed는 ${HOUSING.join(' / ')} 중에서만 써야 합니다.`);
    },
  };

  // 오류 문장 배열을 돌려준다 (빈 배열 = 통과). 빠진 조건 키는 null로 채운다.
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
      for (const [key, fn] of Object.entries(CHECK)) {
        const o = c[key];
        if (o === undefined) { c[key] = null; continue; }
        if (o === null) continue;
        if (typeof o !== 'object' || Array.isArray(o)) { err(`conditions.${key}는 객체 또는 null이어야 합니다.`); continue; }
        fn(o, err);
        if (!isStr(o.quote)) err(`${key}.quote가 비어 있습니다.`);
      }
      for (const key of Object.keys(c)) if (!(key in CHECK)) err(`알 수 없는 조건 키입니다: ${key}`);
    }

    if (!Array.isArray(p.extraChecks) || p.extraChecks.some((v) => typeof v !== 'string')) err('extraChecks는 문장 배열이어야 합니다.');
    if (!Array.isArray(p.exclusiveWith) || p.exclusiveWith.some((v) => typeof v !== 'string')) err('exclusiveWith는 문자열 배열이어야 합니다.');
    for (const k of ['benefit', 'applyPeriod', 'howToApply', 'sourceUrl']) if (!strOrNull(p[k])) err(`${k}는 문자열 또는 null이어야 합니다.`);
    for (const k of ['applyStart', 'applyEnd', 'checkedAt']) if (!dateOrNull(p[k])) err(`${k}는 YYYY-MM-DD 또는 null이어야 합니다.`);
    return errors;
  }

  return { validatePolicy, STATUS, HOUSING, SCOPES };
});
