// 공고 추가(AI) — extractConditions(rawText, scope) → Promise<policy>
//   mock: file:// 이거나 /api/health 실패, 또는 서버가 mode:"mock" → RAW_TEXTS의 예시 원문만 정리 (MOCK_EXTRACTIONS)
//   live: POST /api/extract → 서버가 LLM 호출 (추출만, 판정은 js/logic.js)
// 돌려준 결과는 화면에서 사람이 확인 · 수정한 뒤에만 목록에 넣는다.
(function () {
  'use strict';
  const MOCK_DELAY = 1500;
  const MOCK_ONLY = 'mock 모드에서는 예시 공고만 정리할 수 있어요. API 키 연결 후 사용 가능';
  const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const clone = (o) => JSON.parse(JSON.stringify(o));

  let modePromise = null;
  function getMode() {
    if (!modePromise) {
      modePromise = (async () => {
        if (location.protocol === 'file:') return 'mock';
        try {
          const ctl = new AbortController();
          const timer = setTimeout(() => ctl.abort(), 2000);
          const r = await fetch('api/health', { signal: ctl.signal, cache: 'no-store' });
          clearTimeout(timer);
          if (!r.ok) return 'mock';
          const d = await r.json();
          return d && d.mode === 'live' ? 'live' : 'mock';
        } catch { return 'mock'; }
      })();
    }
    return modePromise;
  }

  function mockExtract(rawText, scope) {
    const texts = window.RAW_TEXTS || {};
    const id = Object.keys(texts).find((k) => norm(texts[k]) === norm(rawText));
    const found = id && (window.MOCK_EXTRACTIONS || {})[id];
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (!found) { reject(new Error(MOCK_ONLY)); return; }
        const p = clone(found);
        p.scope = scope; // 구분은 사용자가 고른 값
        resolve({ policy: p, warnings: [] });
      }, MOCK_DELAY);
    });
  }

  async function liveExtract(rawText, scope) {
    let r, d;
    try {
      r = await fetch('api/extract', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rawText, scope }),
      });
      d = await r.json();
    } catch { throw new Error('서버에 연결하지 못했습니다.'); }
    if (!r.ok) {
      const e = new Error((d && d.error) || `서버 오류 (${r.status})`);
      e.details = (d && d.details) || [];
      throw e;
    }
    return { policy: d.policy, warnings: d.warnings || [] };
  }

  // 결과: policy 객체. 서버 경고(원문에 없는 quote 등)는 ExtractClient.lastWarnings에 둔다.
  async function extractConditions(rawText, scope) {
    if (!norm(rawText)) throw new Error('원문을 붙여 넣으세요.');
    const mode = await getMode();
    const { policy, warnings } = mode === 'live' ? await liveExtract(rawText, scope) : await mockExtract(rawText, scope);
    const errors = window.Schema ? window.Schema.validatePolicy(policy) : [];
    if (errors.length) { const e = new Error('추출 결과가 스키마와 맞지 않습니다.'); e.details = errors; throw e; }
    api.lastWarnings = warnings;
    return policy;
  }

  const api = { getMode, extractConditions, lastWarnings: [] };
  window.ExtractClient = api;
  window.extractConditions = extractConditions;
})();
