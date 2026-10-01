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

  // ── Modelo hierárquico v2 da probabilidade do Stars ──
  //
  // O modelo antigo (starsMonteCarlo acima) trata cada PONTO lançado como um
  // ensaio de Bernoulli: 300 pontos viram 300 moedas e a incerteza some. Aqui a
  // unidade de evidência é a AVALIAÇÃO (fração nota/máx), com três camadas:
  //   μ_g   ~ Beta(prior)                      rendimento global do aluno
  //   μ_d   ~ Beta(τ·μ_g, τ·(1−μ_g))           rendimento na disciplina d
  //   y     ~ Beta(κ·μ_d, κ·(1−μ_d))           fração de cada avaliação
  // κ (ruído por avaliação) e τ (quanto as disciplinas diferem entre si) são
  // aprendidos dos próprios dados em grade discreta. Prova e AC têm modelos
  // separados (AC costuma ser quase cheia e inflava a projeção das provas);
  // AC por entrega (split igual) é Bernoulli com Beta conjugada.

  const LANCZOS = [0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];

  function lgamma(x) {
    if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
    x -= 1;
    let a = LANCZOS[0];
    const t = x + 7.5;
    for (let i = 1; i < 9; i++) a += LANCZOS[i] / (x + i);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }

  function lbeta(a, b) { return lgamma(a) + lgamma(b) - lgamma(a + b); }

  function logSumExp(arr) {
    let mx = -Infinity;
    for (let i = 0; i < arr.length; i++) if (arr[i] > mx) mx = arr[i];
    if (mx === -Infinity) return -Infinity;
    let s = 0;
    for (let i = 0; i < arr.length; i++) s += Math.exp(arr[i] - mx);
    return mx + Math.log(s);
  }

  // Nota cheia (40/40) e zero são comuns, mas a Beta não tem massa em 0 e 1.
  // Correção de continuidade (Smithson & Verkuilen) com resolução de 20 passos:
  // 40/40 → 0,976; 0 → 0,024.
  const RESOLUCAO = 20;
  function squeeze(y) {
    const c = Math.max(0, Math.min(1, y));
    return (c * RESOLUCAO + 0.5) / (RESOLUCAO + 1);
  }
  // Inversa: fração simulada no espaço comprimido volta pra escala da nota.
  function unsqueeze(q) {
    return Math.max(0, Math.min(1, (q * (RESOLUCAO + 1) - 0.5) / RESOLUCAO));
  }

  // Estatística suficiente de um grupo de frações, com peso (histórico < 1).
  function betaStats(fracs, w) {
    const peso = w === undefined ? 1 : w;
    let s1 = 0, s2 = 0;
    fracs.forEach(y => { const q = squeeze(y); s1 += Math.log(q); s2 += Math.log(1 - q); });
    return { n: fracs.length * peso, s1: s1 * peso, s2: s2 * peso };
  }

  // Posterior em grade de (κ, τ, μ_g) marginalizando cada μ_d. Custo:
  // |κ|·|τ|·G·(grupos com dado)·G avaliações, ~1 ms por grupo com G=64.
  function hierBeta(groups, cfg) {
    const G = cfg.grid || 64;
    const mus = [];
    for (let j = 0; j < G; j++) mus.push((j + 0.5) / G);
    const lnMu = mus.map(Math.log);
    const ln1m = mus.map(m => Math.log(1 - m));

    // L[k][g][j]: log-verossimilhança do grupo g com μ_d = mus[j]
    const L = cfg.kappas.map(kap => {
      const lb = mus.map(m => lbeta(kap * m, kap * (1 - m)));
      return groups.map(gr => {
        if (!gr.n) return null;
        return mus.map((m, j) => -gr.n * lb[j] + (kap * m - 1) * gr.s1 + (kap * (1 - m) - 1) * gr.s2);
      });
    });

    // P[t][i][j]: log p(μ_d = mus[j] | μ_g = mus[i], τ), normalizado na grade
    const P = cfg.taus.map(tau => mus.map(mg => {
      const a = tau * mg, b = tau * (1 - mg);
      const row = mus.map((m, j) => (a - 1) * lnMu[j] + (b - 1) * ln1m[j]);
      const z = logSumExp(row);
      return row.map(v => v - z);
    }));

    const combos = [];
    const lps = [];
    const tmp = new Array(G);
    cfg.kappas.forEach((kap, k) => {
      cfg.taus.forEach((tau, t) => {
        for (let i = 0; i < G; i++) {
          let lp = Math.log(cfg.kappaW[k]) + Math.log(cfg.tauW[t])
            + (cfg.a0 - 1) * lnMu[i] + (cfg.b0 - 1) * ln1m[i];
          for (let g = 0; g < groups.length; g++) {
            const Lg = L[k][g];
            if (!Lg) continue;
            const Pi = P[t][i];
            for (let j = 0; j < G; j++) tmp[j] = Lg[j] + Pi[j];
            lp += logSumExp(tmp);
          }
          combos.push({ k, t, i });
          lps.push(lp);
        }
      });
    });
    const z = logSumExp(lps);
    const cdf = new Float64Array(lps.length);
    let acc = 0, muG = 0, kapMean = 0;
    for (let c = 0; c < lps.length; c++) {
      const w = Math.exp(lps[c] - z);
      acc += w;
      cdf[c] = acc;
      muG += w * mus[combos[c].i];
      kapMean += w * cfg.kappas[combos[c].k];
    }

    function pickCdf(arr, u) {
      let lo = 0, hi = arr.length - 1;
      const target = u * arr[hi];
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (arr[mid] < target) lo = mid + 1; else hi = mid;
      }
      return lo;
    }

    const condCache = new Map();
    function condCdf(h, g) {
      const key = h.k + ',' + h.t + ',' + h.i + ',' + g;
      let c = condCache.get(key);
      if (c) return c;
      const Lg = g >= 0 && g < groups.length ? L[h.k][g] : null;
      const Pi = P[h.t][h.i];
      const row = new Array(G);
      for (let j = 0; j < G; j++) row[j] = (Lg ? Lg[j] : 0) + Pi[j];
      const zz = logSumExp(row);
      c = new Float64Array(G);
      let s = 0;
      for (let j = 0; j < G; j++) { s += Math.exp(row[j] - zz); c[j] = s; }
      condCache.set(key, c);
      return c;
    }

    return {
      posteriorMean: muG,
      kappaMean: kapMean,
      drawHyper(rng) { return combos[pickCdf(cdf, rng())]; },
      kappa(h) { return cfg.kappas[h.k]; },
      // g fora do intervalo = disciplina sem nenhum dado (usa só o nível global)
      drawGroup(h, g, rng) {
        const j = pickCdf(condCdf(h, g), rng());
        const m = mus[j] + (rng() - 0.5) / G;
        return Math.min(0.999, Math.max(0.001, m));
      }
    };
  }

  // Priors fracos (força 5): prova centrada em 78%, AC em 90%. Quem usa um
  // tracker de Stars está acima da média, e com 1 nota por disciplina um prior
  // forte em 72% subestimava 0,6 pt por AP (tests/calibracao.js). κ e τ em grade
  // com pesos ~log-normal; τ alto = disciplinas parecidas entre si.
  const PROVA_CFG = {
    a0: 3.9, b0: 1.1,
    kappas: [4, 7, 12, 20, 35, 60], kappaW: [0.04, 0.1, 0.22, 0.28, 0.22, 0.14],
    taus: [12, 30, 70, 160], tauW: [0.2, 0.35, 0.3, 0.15]
  };
  const AC_CFG = {
    a0: 4.5, b0: 0.5,
    kappas: [3, 6, 10, 18, 30], kappaW: [0.12, 0.22, 0.3, 0.24, 0.12],
    taus: [10, 25, 60, 150], tauW: [0.2, 0.35, 0.3, 0.15]
  };
  const BIN_PRIOR = { a: 4.5, b: 0.5 };

  // Probabilidade do Stars por disciplina, com teto e aprovação.
  // inp.discs[i] = {
  //   total, known (pts já fixados, previsões incluídas), bonus (TP + extras),
  //   obs: { prova: [frações oficiais], ac: [frações], bin: [0|1] },
  //   slots: [{ type: 'prova'|'ac'|'bin', max }]
  // }
  // inp.history = [{ prova, ac, bin }] disciplinas de períodos arquivados
  // inp.need = pontos totais exigidos; inp.minFrac = aprovação por disciplina.
  // Sucesso = toda disciplina fecha ≥ minFrac·total (abaixo disso é AS, que
  // elimina) E Σ min(total, pontos + bônus) ≥ need.
  function starsProbability(inp) {
    const discs = inp.discs || [];
    const hist = inp.history || [];
    const hw = inp.historyWeight === undefined ? 0.5 : inp.historyWeight;
    const minFrac = inp.minFrac === undefined ? 0.7 : inp.minFrac;
    const need = inp.need;
    const rng = mulberry32(inp.seed >>> 0);

    const nSlots = discs.reduce((s, d) => s + d.slots.length, 0);
    let draws = inp.draws || 20000;
    if (nSlots > 24) draws = Math.min(draws, 10000);

    const provaGroups = discs.map(d => betaStats(d.obs.prova || [], 1))
      .concat(hist.map(h => betaStats(h.prova || [], hw)));
    const acGroups = discs.map(d => betaStats(d.obs.ac || [], 1))
      .concat(hist.map(h => betaStats(h.ac || [], hw)));
    let binA = BIN_PRIOR.a, binB = BIN_PRIOR.b;
    discs.forEach(d => (d.obs.bin || []).forEach(v => { if (v) binA++; else binB++; }));
    hist.forEach(h => (h.bin || []).forEach(v => { if (v) binA += hw; else binB += hw; }));

    const pm = hierBeta(provaGroups, Object.assign({}, PROVA_CFG, inp.provaCfg));
    const am = hierBeta(acGroups, Object.assign({}, AC_CFG, inp.acCfg));

    const D = discs.length;
    const perDisc = discs.map(() => ({ vals: new Float64Array(draws), approv: 0, stars: 0 }));
    const totals = new Float64Array(draws);
    let hits = 0, reprova = 0;

    for (let it = 0; it < draws; it++) {
      const hp = pm.drawHyper(rng);
      const ha = am.drawHyper(rng);
      const kp = pm.kappa(hp), ka = am.kappa(ha);
      const pBin = sampleBeta(binA, binB, rng);
      let sum = 0, ok = true;
      for (let i = 0; i < D; i++) {
        const d = discs[i];
        let pts = d.known;
        let muP = -1, muA = -1;
        for (let s = 0; s < d.slots.length; s++) {
          const sl = d.slots[s];
          if (sl.type === 'prova') {
            if (muP < 0) muP = pm.drawGroup(hp, i, rng);
            pts += sl.max * unsqueeze(sampleBeta(kp * muP, kp * (1 - muP), rng));
          } else if (sl.type === 'ac') {
            if (muA < 0) muA = am.drawGroup(ha, i, rng);
            pts += sl.max * unsqueeze(sampleBeta(ka * muA, ka * (1 - muA), rng));
          } else if (rng() < pBin) {
            pts += sl.max;
          }
        }
        const fin = Math.min(d.total, pts + (d.bonus || 0));
        perDisc[i].vals[it] = fin;
        if (fin >= minFrac * d.total - 1e-9) perDisc[i].approv++;
        else ok = false;
        if (fin >= 0.9 * d.total - 1e-9) perDisc[i].stars++;
        sum += fin;
      }
      totals[it] = sum;
      if (!ok) reprova++;
      if (ok && sum >= need - 1e-9) hits++;
    }

    const sorted = Array.from(totals).sort((x, y) => x - y);
    const mean = sorted.reduce((s, v) => s + v, 0) / draws;
    return {
      pct: (hits / draws) * 100,
      mean,
      p10: quantile(sorted, 0.10),
      p90: quantile(sorted, 0.90),
      pReprova: (reprova / draws) * 100,
      abilityProva: pm.posteriorMean,
      abilityAc: am.posteriorMean,
      perDisc: perDisc.map(pd => {
        const s = Array.from(pd.vals).sort((x, y) => x - y);
        return {
          mean: s.reduce((a, v) => a + v, 0) / draws,
          p10: quantile(s, 0.10),
          p90: quantile(s, 0.90),
          pApprov: (pd.approv / draws) * 100,
          pNove: (pd.stars / draws) * 100
        };
      }),
      draws
    };
  }

  return {
    fnv1a, mulberry32,
    sampleNormal, sampleGamma, sampleBeta,
    linearRegression, ewma, mean, coefVar, quantile,
    starsMonteCarlo,
    lgamma, lbeta, squeeze, unsqueeze, betaStats, hierBeta, starsProbability
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = CR9Math;
