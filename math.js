'use strict';

// Núcleo matemático puro do CR9 — zero DOM, zero estado do app.
// Roda no browser (window.CR9Math) e em node (module.exports) pros testes.

const CR9Math = (() => {

  // ── PRNG determinístico ──

  // FNV-1a 32-bit: seed estável a partir de uma string de estado.
  function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ── Samplers ──

  function sampleNormal(rng) {
    // Box-Muller; u1 ∈ (0,1] pra evitar log(0)
    const u1 = 1 - rng();
    const u2 = rng();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  // Marsaglia-Tsang; shape < 1 via boost gamma(shape+1) * u^(1/shape)
  function sampleGamma(shape, rng) {
    if (shape < 1) {
      const u = rng() || 1e-12;
      return sampleGamma(shape + 1, rng) * Math.pow(u, 1 / shape);
    }
    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    for (;;) {
      let x, v;
      do {
        x = sampleNormal(rng);
        v = 1 + c * x;
      } while (v <= 0);
      v = v * v * v;
      const u = rng();
      if (u < 1 - 0.0331 * x * x * x * x) return d * v;
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  }

  function sampleBeta(a, b, rng) {
    const sa = Math.max(a, 0.01);
    const sb = Math.max(b, 0.01);
    const g1 = sampleGamma(sa, rng);
    const g2 = sampleGamma(sb, rng);
    const s = g1 + g2;
    return s > 0 ? g1 / s : 0.5;
  }

  // ── Estatística descritiva/serial ──

  // Regressão linear por mínimos quadrados com x = índice (0..n-1).
  function linearRegression(ys) {
    const n = ys.length;
    if (n < 3) return null;
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (let i = 0; i < n; i++) {
      sx += i; sy += ys[i];
      sxx += i * i; sxy += i * ys[i];
    }
    const den = n * sxx - sx * sx;
    if (den === 0) return null;
    const slope = (n * sxy - sx * sy) / den;
    const intercept = (sy - slope * sx) / n;
    const meanY = sy / n;
    let ssRes = 0, ssTot = 0;
    for (let i = 0; i < n; i++) {
      const fit = intercept + slope * i;
      ssRes += (ys[i] - fit) * (ys[i] - fit);
      ssTot += (ys[i] - meanY) * (ys[i] - meanY);
    }
    const r2 = ssTot < 1e-12 ? 1 : Math.max(0, 1 - ssRes / ssTot);
    return { slope, intercept, r2, n };
  }

  // Média móvel exponencial; retorna o valor final da suavização.
  function ewma(values, lambda) {
    if (!values.length) return null;
    let e = values[0];
    for (let i = 1; i < values.length; i++) e = lambda * values[i] + (1 - lambda) * e;
    return e;
  }

  function mean(values) {
    if (!values.length) return null;
    return values.reduce((s, v) => s + v, 0) / values.length;
  }

  // Coeficiente de variação (desvio-padrão populacional / média).
  function coefVar(values) {
    const n = values.length;
    if (n < 3) return null;
    const m = mean(values);
    if (m === null || m <= 0) return null;
    const variance = values.reduce((s, v) => s + (v - m) * (v - m), 0) / n;
    const sd = Math.sqrt(variance);
    return { cv: sd / m, mean: m, sd, n };
  }

  // Quantil com interpolação linear sobre array JÁ ordenado.
  function quantile(sorted, q) {
    const n = sorted.length;
    if (!n) return null;
    const pos = (n - 1) * q;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  }

  // ── Probabilidade do Stars ──
  //
  // Posterior Beta(alpha, beta) do rendimento (alpha = prior 7 + pts ganhos,
  // beta = prior 3 + pts perdidos) + Monte Carlo hierárquico dos slots restantes:
  // por draw, habilidade r ~ Beta(alpha, beta) (incerteza epistêmica); por slot,
  // fração ~ Beta(kappa·r, kappa·(1−r)) (ruído aleatório por avaliação).
  // Sucesso quando (ganho atual + simulado) >= need... aqui `need` já vem líquido:
  // pontos que faltam nos slots restantes. Retorna pct e a faixa credível dos
  // pontos simulados (p10/p90 sobre o total dos slots).
  function starsMonteCarlo(opts) {
    const slots = opts.slots || [];
    const need = opts.need;
    const alpha = Math.max(opts.alpha, 0.01);
    const beta = Math.max(opts.beta, 0.01);
    const kappa = opts.kappa || 12;
    let draws = opts.draws || 20000;
    if (slots.length > 16) draws = Math.min(draws, 10000); // guarda de perf
    const rng = mulberry32(opts.seed >>> 0);

    if (!slots.length) {
      return { pct: need <= 0 ? 100 : 0, mean: 0, p10: 0, p90: 0, draws: 0 };
    }

    const totals = new Array(draws);
    let hits = 0;
    for (let i = 0; i < draws; i++) {
      const r = sampleBeta(alpha, beta, rng);
      const a = Math.max(kappa * r, 0.01);
      const b = Math.max(kappa * (1 - r), 0.01);
      let total = 0;
      for (let j = 0; j < slots.length; j++) {
        total += slots[j].max * sampleBeta(a, b, rng);
      }
      totals[i] = total;
      if (total >= need) hits++;
    }
    totals.sort((x, y) => x - y);
    const sum = totals.reduce((s, v) => s + v, 0);
    return {
      pct: (hits / draws) * 100,
      mean: sum / draws,
      p10: quantile(totals, 0.10),
      p90: quantile(totals, 0.90),
      draws
    };
  }

  return {
    fnv1a, mulberry32,
    sampleNormal, sampleGamma, sampleBeta,
    linearRegression, ewma, mean, coefVar, quantile,
    starsMonteCarlo
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = CR9Math;
