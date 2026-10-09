// Normalización y cruce de nombres de entidades contra el directorio.
const Matcher = (() => {
  const STOP = new Set(['de', 'la', 'las', 'el', 'los', 'del', 'y', 'e', 'sa', 's', 'a', 'sas', 'ltda', 'colombia', 'colombiana', 'banco']);

  const normalize = (s) => String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  const tokens = (s) => normalize(s).split(' ').filter((t) => t && !STOP.has(t));

  function lev(a, b) {
    const m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[n];
  }

  // Puntaje de un nombre del oficio contra un nombre del directorio (0..1).
  function score(qTokens, cTokens) {
    if (!qTokens.length || !cTokens.length) return 0;
    const q = new Set(qTokens), c = new Set(cTokens);
    const inter = [...q].filter((t) => c.has(t)).length;
    if (inter === q.size && inter === c.size) return 1;
    if (inter === q.size || inter === c.size) return 0.7; // uno contiene al otro
    const qs = [...qTokens].sort().join(' '), cs = [...cTokens].sort().join(' ');
    const sim = 1 - lev(qs, cs) / Math.max(qs.length, cs.length);
    return sim >= 0.82 ? sim * 0.8 : 0;
  }

  // Devuelve { status: 'encontrado'|'verificar'|'no', entry, candidates, score, via }
  function match(query, entries) {
    const q = tokens(query);
    const scored = [];
    entries.forEach((entry) => {
      let best = 0, via = entry.nombre;
      [entry.nombre, ...(entry.alias || [])].forEach((v) => {
        const s = score(q, tokens(v));
        if (s > best) { best = s; via = v; }
      });
      if (best > 0) scored.push({ entry, score: best, via });
    });
    scored.sort((a, b) => b.score - a.score);
    if (!scored.length) return { status: 'no', candidates: [], score: 0 };
    const top = scored[0];
    const tied = scored.filter((s) => s.score === top.score);
    const candidates = scored.slice(0, 3);
    if (top.score >= 1 && tied.length === 1) return { status: 'encontrado', entry: top.entry, via: top.via, candidates, score: top.score };
    if (top.score >= 0.65) return { status: 'verificar', entry: tied.length === 1 ? top.entry : null, via: top.via, candidates, score: top.score, ambiguo: tied.length > 1 };
    return { status: 'no', candidates, score: top.score };
  }

  // Entidades del directorio nombradas en el texto (para advertir de posibles omisiones).
  function scanText(text, entries) {
    const hay = ` ${normalize(text)} `;
    return entries.filter((e) => [e.nombre, ...(e.alias || [])].some((v) => {
      const n = normalize(v);
      return n.length >= 4 && hay.includes(` ${n} `);
    }));
  }

  return { normalize, tokens, match, scanText };
})();
if (typeof module !== 'undefined') module.exports = Matcher;
