'use strict';

// Calibração da probabilidade do Stars: modelo antigo (Beta por ponto) vs
// hierárquico v2. Rodar: node tests/calibracao.js [nAlunos]
//
// Os alunos sintéticos vêm de um gerador que NÃO é o modelo v2 (ruído normal
// truncado e arredondado em meio ponto, efeito de disciplina gaussiano, AC
// correlacionada com prova), pra não premiar o modelo por construção.
// Métricas: Brier (menor = melhor), log-loss, ECE (erro de calibração).

const M = require('../math.js');

const N = Number(process.argv[2]) || 1200;
const THETA = Number(process.argv[3]) || 0.80; // centro da população sintética
const DRAWS = 4000;
const rng = M.mulberry32(20260930);
const gauss = () => M.sampleNormal(rng);
const clip = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const arred = (pts, passo) => Math.round(pts / passo) * passo;

function geraDisc(theta) {
  const delta = gauss() * 0.06;
  const prova = () => arred(40 * clip(theta + delta + gauss() * 0.09, 0, 1), 0.5);
  const ac = () => arred(10 * clip(theta + 0.10 + delta * 0.5 + gauss() * 0.07, 0, 1), 0.5);
  return { ap1: prova(), ap2: prova(), ac1: ac(), ac2: ac() };
}

function geraAluno() {
  const theta = clip(THETA + gauss() * 0.09, 0.4, 0.99);
  const discs = [0, 1, 2, 3, 4].map(() => geraDisc(theta));
  const passado = [0, 1, 2, 3, 4].map(() => geraDisc(clip(theta + gauss() * 0.03, 0.4, 0.99)));
  const tp = rng() < 0.5 ? Math.round((0.4 + rng() * 0.5) * 10) : 0;
  const tpAlvo = Math.floor(rng() * 5);
  const estagio = Math.floor(rng() * 3); // 0: só AP1 · 1: AP1+AC1 · 2: AP1+AP2+AC1
  return { discs, passado, tp, tpAlvo, estagio };
}

function verdade(a) {
  let soma = 0, ok = true;
  a.discs.forEach((d, i) => {
    const fin = Math.min(100, d.ap1 + d.ap2 + d.ac1 + d.ac2 + (i === a.tpAlvo ? a.tp : 0));
    if (fin < 70) ok = false;
    soma += fin;
  });
  return ok && soma >= 450 ? 1 : 0;
}

// Visão parcial do aluno no meio do período.
function observado(a) {
  return a.discs.map(d => {
    const obs = { ap1: d.ap1, ap2: a.estagio >= 2 ? d.ap2 : null, ac1: a.estagio >= 1 ? d.ac1 : null };
    return obs;
  });
}

function modeloAntigo(a, seed) {
  const obs = observado(a);
  let earned = 0, dist = 0;
  const slots = [];
  obs.forEach(o => {
    earned += o.ap1; dist += 40;
    if (o.ap2 !== null) { earned += o.ap2; dist += 40; } else slots.push({ max: 40 });
    if (o.ac1 !== null) { earned += o.ac1; dist += 10; } else slots.push({ max: 10 });
    slots.push({ max: 10 });
  });
  const need = 450 - (earned + a.tp);
  if (need <= 0) return 1;
  const mc = M.starsMonteCarlo({ slots, need, alpha: 7 + earned, beta: 3 + dist - earned, draws: DRAWS, seed, kappa: 12 });
  return mc.pct / 100;
}

function modeloNovo(a, seed, comHistorico) {
  const obs = observado(a);
  const discs = obs.map((o, i) => {
    const slots = [];
    let known = o.ap1;
    const prova = [o.ap1 / 40];
    const ac = [];
    if (o.ap2 !== null) { known += o.ap2; prova.push(o.ap2 / 40); } else slots.push({ type: 'prova', max: 40 });
    if (o.ac1 !== null) { known += o.ac1; ac.push(o.ac1 / 10); } else slots.push({ type: 'ac', max: 10 });
    slots.push({ type: 'ac', max: 10 });
    return { total: 100, known, bonus: i === a.tpAlvo ? a.tp : 0, obs: { prova, ac, bin: [] }, slots };
  });
  const history = comHistorico
    ? a.passado.map(d => ({ prova: [d.ap1 / 40, d.ap2 / 40], ac: [d.ac1 / 10, d.ac2 / 10], bin: [] }))
    : [];
  const r = M.starsProbability({ discs, history, need: 450, minFrac: 0.7, draws: DRAWS, seed });
  return r.pct / 100;
}

function metricas(ps, ys) {
  const eps = 1e-4;
  let brier = 0, ll = 0;
  ps.forEach((p, i) => {
    brier += (p - ys[i]) ** 2;
    const q = clip(p, eps, 1 - eps);
    ll -= ys[i] ? Math.log(q) : Math.log(1 - q);
  });
  const bins = Array.from({ length: 10 }, () => ({ n: 0, p: 0, y: 0 }));
  ps.forEach((p, i) => {
    const b = bins[Math.min(9, Math.floor(p * 10))];
    b.n++; b.p += p; b.y += ys[i];
  });
  let ece = 0;
  bins.forEach(b => { if (b.n) ece += (b.n / ps.length) * Math.abs(b.p / b.n - b.y / b.n); });
  return { brier: brier / ps.length, logloss: ll / ps.length, ece, bins };
}

const alunos = Array.from({ length: N }, geraAluno);
const ys = alunos.map(verdade);
const t0 = Date.now();
const pAnt = alunos.map((a, i) => modeloAntigo(a, i + 1));
const pNovoSem = alunos.map((a, i) => modeloNovo(a, i + 1, false));
const pNovo = alunos.map((a, i) => modeloNovo(a, i + 1, true));
const base = ys.reduce((s, v) => s + v, 0) / N;

console.log('população θ≈' + THETA + ' · alunos: ' + N + ' · taxa real de Stars: ' + (base * 100).toFixed(1) + '% · ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
console.log('brier de referência (chutar a taxa base pra todos): ' + (base * (1 - base)).toFixed(4));
const linhas = [
  ['antigo (Beta por ponto)', metricas(pAnt, ys)],
  ['v2 sem histórico', metricas(pNovoSem, ys)],
  ['v2 com histórico', metricas(pNovo, ys)]
];
linhas.forEach(([nome, m]) => {
  console.log(nome.padEnd(26) + ' brier ' + m.brier.toFixed(4) + ' · logloss ' + m.logloss.toFixed(4) + ' · ECE ' + m.ece.toFixed(4));
});
console.log('\ncalibração por faixa (previsto → real, n):');
linhas.forEach(([nome, m]) => {
  console.log('  ' + nome);
  m.bins.forEach((b, i) => {
    if (b.n) console.log('    ' + (i * 10) + '–' + (i * 10 + 10) + '%: ' + (100 * b.p / b.n).toFixed(1) + '% → ' + (100 * b.y / b.n).toFixed(1) + '% (n=' + b.n + ')');
  });
});

module.exports = { metricas };
