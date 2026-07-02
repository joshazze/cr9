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

console.log('\n' + passed + ' testes passaram.');
