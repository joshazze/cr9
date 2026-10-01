'use strict';

// Testes do núcleo puro — rodar com: node tests/math.test.js
const assert = require('assert');
const M = require('../math.js');

let passed = 0;
function ok(name, fn) {
  fn();
  passed++;
  console.log('ok - ' + name);
}

ok('fnv1a vetores conhecidos', () => {
  assert.strictEqual(M.fnv1a(''), 0x811c9dc5);
  assert.strictEqual(M.fnv1a('a'), 0xe40c292c);
});

ok('mulberry32 determinístico e em [0,1)', () => {
  const a = M.mulberry32(42), b = M.mulberry32(42), c = M.mulberry32(43);
  const sa = [a(), a(), a(), a(), a()];
  const sb = [b(), b(), b(), b(), b()];
  assert.deepStrictEqual(sa, sb);
  assert.notDeepStrictEqual(sa, [c(), c(), c(), c(), c()]);
  sa.forEach(v => assert.ok(v >= 0 && v < 1));
});

ok('sampleBeta momentos (média e variância, 50k draws)', () => {
  const rng = M.mulberry32(7);
  const a = 7, b = 3, n = 50000;
  let sum = 0, sumSq = 0;
  for (let i = 0; i < n; i++) { const x = M.sampleBeta(a, b, rng); sum += x; sumSq += x * x; }
  const meanEmp = sum / n;
  const varEmp = sumSq / n - meanEmp * meanEmp;
  const meanTheo = a / (a + b);                                // 0.7
  const varTheo = (a * b) / ((a + b) * (a + b) * (a + b + 1)); // 0.0190909...
  assert.ok(Math.abs(meanEmp - meanTheo) < 0.01, 'mean ' + meanEmp);
  assert.ok(Math.abs(varEmp - varTheo) < 0.005, 'var ' + varEmp);
});

ok('sampleGamma shape<1 não degenera', () => {
  const rng = M.mulberry32(11);
  for (let i = 0; i < 1000; i++) {
    const g = M.sampleGamma(0.5, rng);
    assert.ok(isFinite(g) && g >= 0);
  }
});

ok('linearRegression exata em reta', () => {
  const r = M.linearRegression([1, 3, 5, 7]);
  assert.ok(Math.abs(r.slope - 2) < 1e-12);
  assert.ok(Math.abs(r.intercept - 1) < 1e-12);
  assert.ok(Math.abs(r.r2 - 1) < 1e-12);
  assert.strictEqual(r.n, 4);
});

ok('linearRegression série plana e n<3', () => {
  const flat = M.linearRegression([5, 5, 5]);
  assert.strictEqual(flat.slope, 0);
  assert.strictEqual(flat.r2, 1);
  assert.strictEqual(M.linearRegression([1, 2]), null);
});

ok('ewma calculado à mão', () => {
  // e0=1; e1=0.5*2+0.5*1=1.5; e2=0.5*3+0.5*1.5=2.25
  assert.strictEqual(M.ewma([1, 2, 3], 0.5), 2.25);
  assert.strictEqual(M.ewma([], 0.5), null);
});

ok('coefVar calculado à mão + edges', () => {
  const r = M.coefVar([2, 4, 6]);
  // média 4, var pop 8/3, sd 1.63299..., cv 0.40825...
  assert.ok(Math.abs(r.mean - 4) < 1e-12);
  assert.ok(Math.abs(r.cv - Math.sqrt(8 / 3) / 4) < 1e-12);
  assert.strictEqual(M.coefVar([1, 2]), null);
  assert.strictEqual(M.coefVar([0, 0, 0]), null);
});

ok('quantile interpolação linear', () => {
  const s = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  assert.strictEqual(M.quantile(s, 0.5), 5.5);
  assert.strictEqual(M.quantile(s, 0), 1);
  assert.strictEqual(M.quantile(s, 1), 10);
});

ok('starsMonteCarlo determinístico por seed', () => {
  const opts = { slots: [{ max: 40 }, { max: 40 }, { max: 20 }], need: 60, alpha: 77, beta: 33, seed: 123 };
  const r1 = M.starsMonteCarlo(opts);
  const r2 = M.starsMonteCarlo(opts);
  assert.strictEqual(r1.pct, r2.pct);
  assert.strictEqual(r1.p10, r2.p10);
  const r3 = M.starsMonteCarlo({ ...opts, seed: 124 });
  assert.notStrictEqual(r1.pct, r3.pct);
});

ok('starsMonteCarlo monotônico em need', () => {
  const base = { slots: [{ max: 40 }, { max: 40 }, { max: 20 }], alpha: 77, beta: 33, seed: 5 };
  const fácil = M.starsMonteCarlo({ ...base, need: 40 });
  const difícil = M.starsMonteCarlo({ ...base, need: 90 });
  assert.ok(fácil.pct >= difícil.pct, fácil.pct + ' vs ' + difícil.pct);
});

ok('starsMonteCarlo extremos', () => {
  // rendimento quase certo de ~95% e need bem abaixo da média ⇒ ~100
  const alto = M.starsMonteCarlo({ slots: [{ max: 40 }, { max: 40 }], need: 40, alpha: 950, beta: 50, seed: 9 });
  assert.ok(alto.pct > 99, 'alto ' + alto.pct);
  // need acima do máximo possível ⇒ 0
  const zero = M.starsMonteCarlo({ slots: [{ max: 40 }], need: 41, alpha: 70, beta: 30, seed: 9 });
  assert.strictEqual(zero.pct, 0);
  // sem slots
  const vazio = M.starsMonteCarlo({ slots: [], need: 10, alpha: 7, beta: 3, seed: 1 });
  assert.strictEqual(vazio.pct, 0);
  assert.strictEqual(M.starsMonteCarlo({ slots: [], need: 0, alpha: 7, beta: 3, seed: 1 }).pct, 100);
});

ok('starsMonteCarlo faixa credível coerente', () => {
  const r = M.starsMonteCarlo({ slots: [{ max: 40 }, { max: 40 }, { max: 20 }], need: 60, alpha: 77, beta: 33, seed: 3 });
  assert.ok(r.p10 <= r.mean && r.mean <= r.p90);
  assert.ok(r.p10 >= 0 && r.p90 <= 100);
});

ok('starsMonteCarlo orçamento de tempo (20k draws)', () => {
  const t0 = Date.now();
  M.starsMonteCarlo({ slots: [{ max: 40 }, { max: 40 }, { max: 20 }, { max: 40 }, { max: 40 }, { max: 20 }], need: 120, alpha: 100, beta: 40, seed: 77 });
  const dt = Date.now() - t0;
  assert.ok(dt < 120, 'demorou ' + dt + 'ms');
});

// ── Modelo hierárquico v2 ──

// Disciplina padrão: AP1 lançada, AP2 + 2 ACs de 10 em aberto.
function discPadrao(ap1, extra) {
  return Object.assign({
    total: 100, known: ap1, bonus: 0,
    obs: { prova: [ap1 / 40], ac: [], bin: [] },
    slots: [{ type: 'prova', max: 40 }, { type: 'ac', max: 10 }, { type: 'ac', max: 10 }]
  }, extra || {});
}
const prob = (discs, o) => M.starsProbability(Object.assign({ discs, need: 90 * discs.length, draws: 6000, seed: 5 }, o));

ok('lgamma bate com fatorial e Γ(1/2)', () => {
  assert.ok(Math.abs(M.lgamma(5) - Math.log(24)) < 1e-10);
  assert.ok(Math.abs(M.lgamma(0.5) - Math.log(Math.sqrt(Math.PI))) < 1e-10);
  assert.ok(Math.abs(M.lbeta(2, 3) - Math.log(1 / 12)) < 1e-10);
});

ok('squeeze/unsqueeze são inversas e ficam dentro de (0,1)', () => {
  [0, 0.25, 0.9, 1].forEach(y => {
    const q = M.squeeze(y);
    assert.ok(q > 0 && q < 1);
    assert.ok(Math.abs(M.unsqueeze(q) - y) < 1e-12);
  });
});

ok('starsProbability determinístico pela seed', () => {
  const ds = [discPadrao(36), discPadrao(35), discPadrao(37), discPadrao(34)];
  assert.strictEqual(prob(ds).pct, prob(ds).pct);
});

ok('nota maior nunca reduz a chance', () => {
  const baixo = prob([discPadrao(33), discPadrao(33), discPadrao(33), discPadrao(33)]).pct;
  const alto = prob([discPadrao(38), discPadrao(38), discPadrao(38), discPadrao(38)]).pct;
  assert.ok(alto > baixo + 20, baixo + ' vs ' + alto);
});

ok('média projetada acompanha o rendimento observado (sem viés grosso)', () => {
  // 10 provas a 90%: a próxima prova de 100 deve sair perto de 90
  const d = { total: 100, known: 0, bonus: 0, obs: { prova: Array(10).fill(0.9), ac: [], bin: [] }, slots: [{ type: 'prova', max: 100 }] };
  const r = M.starsProbability({ discs: [d], need: 0, minFrac: 0, draws: 20000, seed: 9 });
  assert.ok(Math.abs(r.mean - 90) < 2.5, 'média ' + r.mean);
});

ok('bônus acima do teto não vira ponto', () => {
  const cheia = { total: 100, known: 98, bonus: 7, obs: { prova: [1], ac: [], bin: [] }, slots: [] };
  const r = M.starsProbability({ discs: [cheia], need: 0, draws: 1000, seed: 1 });
  assert.strictEqual(r.perDisc[0].mean, 100);
});

ok('disciplina que não alcança 70 zera a chance (AS elimina)', () => {
  const ruim = { total: 100, known: 20, bonus: 0, obs: { prova: [0.5], ac: [], bin: [] }, slots: [{ type: 'prova', max: 40 }] };
  const r = prob([discPadrao(40), discPadrao(40), discPadrao(40), ruim], { need: 300 });
  assert.strictEqual(r.pct, 0);
  assert.strictEqual(r.perDisc[3].pApprov, 0);
});

ok('risco de reprovação entra na conta mesmo com total folgado', () => {
  // 3 disciplinas cheias + uma no fio dos 70: o total passa, a aprovação não é certa
  const cheia = { total: 100, known: 100, bonus: 0, obs: { prova: [1, 1], ac: [], bin: [] }, slots: [] };
  const fio = { total: 100, known: 40, bonus: 0, obs: { prova: [0.75], ac: [], bin: [] }, slots: [{ type: 'prova', max: 40 }] };
  const r = prob([cheia, cheia, cheia, fio], { need: 300 });
  assert.ok(r.pReprova > 5 && r.pct < 95, 'reprova ' + r.pReprova + ' pct ' + r.pct);
  assert.ok(Math.abs(r.pct + r.pReprova - 100) < 1e-9);
});

ok('histórico forte puxa a projeção de quem ainda não tem nota', () => {
  const vazia = { total: 100, known: 0, bonus: 0, obs: { prova: [], ac: [], bin: [] }, slots: [{ type: 'prova', max: 100 }] };
  const hBom = Array(6).fill({ prova: [0.95, 0.95], ac: [], bin: [] });
  const hRuim = Array(6).fill({ prova: [0.6, 0.6], ac: [], bin: [] });
  const bom = M.starsProbability({ discs: [vazia], history: hBom, need: 0, minFrac: 0, draws: 8000, seed: 3 }).mean;
  const ruim = M.starsProbability({ discs: [vazia], history: hRuim, need: 0, minFrac: 0, draws: 8000, seed: 3 }).mean;
  assert.ok(bom > 85 && ruim < 70, 'bom ' + bom + ' ruim ' + ruim);
});

ok('AC por entrega usa a taxa de entrega observada', () => {
  const d = entregas => ({ total: 100, known: 0, bonus: 0, obs: { prova: [], ac: [], bin: entregas }, slots: [{ type: 'bin', max: 100 }] });
  const quemEntrega = M.starsProbability({ discs: [d(Array(10).fill(1))], need: 0, minFrac: 0, draws: 8000, seed: 2 }).mean;
  const quemFura = M.starsProbability({ discs: [d([1, 0, 0, 1, 0, 0, 0, 1, 0, 0])], need: 0, minFrac: 0, draws: 8000, seed: 2 }).mean;
  assert.ok(quemEntrega > 85 && quemFura < 55, quemEntrega + ' vs ' + quemFura);
});

ok('starsProbability orçamento de tempo (6 disciplinas, 20k draws)', () => {
  const ds = Array.from({ length: 6 }, (_, i) => discPadrao(30 + i));
  const hist = Array(10).fill({ prova: [0.8, 0.85], ac: [0.9, 1], bin: [] });
  const t0 = Date.now();
  M.starsProbability({ discs: ds, history: hist, need: 540, draws: 20000, seed: 8 });
  const dt = Date.now() - t0;
  assert.ok(dt < 400, 'demorou ' + dt + 'ms');
});

console.log('\n' + passed + ' testes passaram.');
