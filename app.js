'use strict';

const KEY = 'cr9-v1';
const MAX_RECENTES = 12;

// ───────── HELPERS ─────────

function uid() {
  return 'id-' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

function fmtNum(n, dec = 1) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: dec });
}

// Precisão adaptativa pra probabilidade: mostra 3 dígitos significativos
// mesmo quando o valor é muito pequeno (ex: 0,000347%).
function fmtPct(p) {
  if (p === null || p === undefined || isNaN(p)) return '—';
  if (p <= 0) return '0';
  if (p >= 10) return fmtNum(p, 1);
  if (p >= 1) return fmtNum(p, 2);
  const exp = Math.floor(Math.log10(p));
  const dec = Math.min(12, Math.max(3, 2 - exp));
  return fmtNum(p, dec);
}

function escapeHTML(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ───────── SAUDAÇÃO ─────────

const GREET_BY_TIME = {
  madrugada: [
    'madrugada e tu aqui',
    'varando a madrugada',
    'insônia produtiva',
    'essa hora, hein',
    'madrugada pensante',
    'de olho nos pontos nessa hora',
    'tá voando na madrugada'
  ],
  manha: [
    'bom dia',
    'bom dia, meu consagrado',
    'manhã boa',
    'manhã produtiva',
    'acordou ligado',
    'começando o dia',
    'dia novo',
    'bora pro dia',
    'manhã no ataque'
  ],
  tarde: [
    'boa tarde',
    'tarde boa',
    'tarde produtiva',
    'meio-dia, meio-caminho',
    'tarde, feroz',
    'bora pra reta da tarde',
    'tarde operando'
  ],
  noite: [
    'boa noite',
    'noite boa',
    'fechando o dia',
    'final de expediente',
    'noite operando',
    'noite de revisão',
    'noite tranquila',
    'encerrando o dia'
  ]
};

const GREET_NEUTRAL = [
  'fala',
  'e aí',
  'salve',
  'opa',
  'alô',
  'chegou'
];

const GREET_VOCATIVOS = [
  'champs',
  'monstro',
  'mestre',
  'chefe',
  'lenda',
  'feroz',
  'patrão',
  'guerreiro',
  'craque',
  'brabo',
  'parceiro',
  'ídolo',
  'fenômeno',
  'rei',
  'maestro'
];

const GREET_VOCATIVOS_F = [
  'champs','monstra','mestra','chefa','lenda','feroz','patroa','guerreira',
  'craque','braba','parceira','ídola','fenômena','rainha','maestrina'
];

const FEM_SUBS = [
  [/\bmeu consagrado\b/g, 'minha consagrada'],
  [/\bacordou ligado\b/g, 'acordou ligada'],
  [/\bbem-vindo\b/g,      'bem-vinda'],
  [/\bo autor\b/g,        'a autora']
];
function feminize(s) {
  let out = s;
  for (const [re, rep] of FEM_SUBS) out = out.replace(re, rep);
  return out;
}

const GREET_FREEFORM = {
  any: [
    'voltou pra operação',
    'bora ver se os números tão jogando a favor hoje',
    'o Stars não se conquista sozinho — mas hoje tem você',
    'hoje o rendimento pede café e coragem',
    'cada ponto conta, e você sabe disso',
    'sem desculpa hoje — só execução',
    'tá na hora de olhar os pontos no olho',
    'a matemática não mente — vamos nela',
    'cada lançamento te aproxima dos 450',
    'foco cirúrgico no período',
    '450 pontos não caem do céu — a gente busca',
    'hoje é dia de transformar estudo em pontos',
    'reta final começa quando você decide',
    'o Stars te espera — e ele não tem pressa, mas você tem',
    'disciplina hoje, orgulho amanhã',
    'a régua tá em 90 — e a gente vai passar por cima',
    'nada de aproveitamento morno por aqui',
    'tá tudo ao seu alcance — literalmente, nessa tela',
    'hoje é outro dia pra bater meta',
    'os pontos não vão se lançar sozinhos',
    'que hoje a estatística jogue a seu favor',
    'bem-vindo de volta ao comando',
    'as notas contam a história — e você é o autor',
    'cada AP é uma batalha, o Stars é a guerra'
  ],
  manha: [
    'o dia começou — e os pontos também',
    'manhã fresca, cabeça afiada',
    'cafezinho e rumo aos 450',
    'bom dia pra quem vai virar Stars',
    'acordou e já tá no controle',
    'primeiro movimento do dia: checar as notas'
  ],
  tarde: [
    'meio do dia, meio dos pontos — vamos fechar bem',
    'a tarde é longa, o Stars é mais',
    'almoço resolvido, agora é estratégia',
    'tarde produtiva = Stars no horizonte',
    'hora de revisar o placar'
  ],
  noite: [
    'o dia tá fechando mas o Stars continua aberto',
    'noite boa pra revisar o que rolou',
    'um último olhar antes de desligar',
    'dia longo, mas os pontos não dormem',
    'fechou o expediente? abre o CR9',
    'a noite é jovem, o Stars também'
  ],
  madrugada: [
    'madrugada varando, disciplina no talo',
    'essa hora só tem você e os números',
    'quem estuda de madrugada vira Stars de manhã',
    'silêncio bom pra pensar nos pontos',
    'o mundo dorme, o CR acorda'
  ]
};

const GREET_TAILS = [
  'brutal hoje?',
  'só força?',
  'tudo em ordem?',
  'bora dominar?',
  'no controle?',
  'firmeza?',
  'tá voando?',
  'tudo certo por aí?',
  'bora pros pontos?',
  'stars no radar?',
  'pé no acelerador?',
  'no ritmo?',
  'focado?',
  'em modo operação?',
  'cabeça no jogo?',
  'tudo afiado?',
  'no clima?',
  'preparado?',
  'tudo sob controle?',
  'bora olhar esses números?',
  'firme e forte?',
  'com tudo?'
];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getSaudacao(gender) {
  const h = new Date().getHours();
  let timeKey;
  if (h < 5) timeKey = 'madrugada';
  else if (h < 12) timeKey = 'manha';
  else if (h < 18) timeKey = 'tarde';
  else timeKey = 'noite';

  const fem = gender === 'f';
  const vocPool = fem ? GREET_VOCATIVOS_F : GREET_VOCATIVOS;

  let raw;
  // 45% classic (opener + vocativo, tail), 55% freeform
  if (Math.random() < 0.45) {
    const bucket = GREET_BY_TIME[timeKey];
    const useNeutral = Math.random() < 0.3;
    const opener = useNeutral ? pickRandom(GREET_NEUTRAL) : pickRandom(bucket);
    const voc = pickRandom(vocPool);
    const tail = pickRandom(GREET_TAILS);
    raw = opener + ' ' + voc + ', ' + tail;
  } else {
    const pool = GREET_FREEFORM.any.concat(GREET_FREEFORM[timeKey] || []);
    raw = pickRandom(pool);
  }

  if (fem) raw = feminize(raw);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function migrateState(s) {
  if (!s || typeof s !== 'object') return s;
  if (!Array.isArray(s.disciplinas)) s.disciplinas = [];
  if (!s.tp || typeof s.tp !== 'object') s.tp = { value: null, expectativa: false, applyTo: null };
  if (!Array.isArray(s.recentes)) s.recentes = [];
  if (s.gender === undefined) s.gender = null;
  if (s.foco === undefined) s.foco = null;
  s.disciplinas.forEach(d => {
    if (d.showAS === undefined) d.showAS = false;
    if (d.asAutoTriggered === undefined) d.asAutoTriggered = false;
    if (!d.acs) d.acs = [];
  });
  const discIds = new Set(s.disciplinas.map(d => d.id));
  if (s.tp.applyTo && !discIds.has(s.tp.applyTo)) s.tp.applyTo = null;
  s.recentes = s.recentes.filter(r => r && (r.discId == null || discIds.has(r.discId)));
  s.v = 2;
  return s;
}

function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return migrateState(parsed);
    }
  } catch (e) {}
  return migrateState({
    v: 2,
    disciplinas: [],
    tp: { value: null, expectativa: false, applyTo: null },
    recentes: [],
    gender: null,
    foco: null
  });
}

function saveState() {
  localStorage.setItem(KEY, JSON.stringify(state));
  pushToFirebase();
}

// ───────── SYNC ─────────

const SYNC_KEY = 'cr9-sync-code';
const SYNC_DEBOUNCE_MS = 2000;
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBlNf6ZwK5bBCycmr6QHEKf4JERuo5eiRA',
  authDomain: 'ocr9-d9d70.firebaseapp.com',
  databaseURL: 'https://ocr9-d9d70-default-rtdb.firebaseio.com',
  projectId: 'ocr9-d9d70',
  storageBucket: 'ocr9-d9d70.firebasestorage.app',
  messagingSenderId: '996971608172',
  appId: '1:996971608172:web:a6dd4e29e0d9a282bf8049'
};

let syncRef = null;
let syncListener = null;
let syncDebounceTimer = null;
let syncIsReceiving = false;

function initFirebase() {
  if (typeof firebase === 'undefined') return false;
  if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
  return true;
}

function generateSyncCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  const arr = crypto.getRandomValues(new Uint8Array(6));
  for (let i = 0; i < 6; i++) code += chars[arr[i] % chars.length];
  return code.slice(0, 3) + '-' + code.slice(3);
}

function connectSync(code) {
  if (!initFirebase()) return;
  disconnectSync(true);
  const clean = code.replace('-', '').toUpperCase();
  const display = clean.slice(0, 3) + '-' + clean.slice(3);
  localStorage.setItem(SYNC_KEY, display);
  syncRef = firebase.database().ref('sync/' + clean);

  // First read remote to avoid overwriting existing data with empty state
  syncRef.once('value').then((snap) => {
    const remote = snap.val();
    const localHasData = state.disciplinas && state.disciplinas.length > 0;
    const remoteHasData = remote && Array.isArray(remote.disciplinas) && remote.disciplinas.length > 0;

    if (remoteHasData && !localHasData) {
      // Remote has data, local is empty — adopt remote
      syncIsReceiving = true;
      const cleaned = Object.assign({}, remote);
      delete cleaned._ts;
      state = migrateState(cleaned);
      localStorage.setItem(KEY, JSON.stringify(state));
      fullRerender();
      syncIsReceiving = false;
    } else if (localHasData) {
      // Local has data — push to remote
      syncRef.set({ ...state, _ts: Date.now() });
    }
    localStorage.setItem('cr9-sync-ts', String(Date.now()));

    // Now attach realtime listener
    syncListener = syncRef.on('value', (snap2) => {
      const r = snap2.val();
      if (!r || typeof r !== 'object') return;
      const localTs = Number(localStorage.getItem('cr9-sync-ts') || 0);
      if (r._ts && r._ts <= localTs) return;
      syncIsReceiving = true;
      const cleaned = Object.assign({}, r);
      delete cleaned._ts;
      state = migrateState(cleaned);
      localStorage.setItem(KEY, JSON.stringify(state));
      localStorage.setItem('cr9-sync-ts', String(r._ts || Date.now()));
      fullRerender();
      syncIsReceiving = false;
    });
  });
  renderSyncUI();
}

function disconnectSync(silent) {
  if (syncRef && syncListener) {
    syncRef.off('value', syncListener);
  }
  syncRef = null;
  syncListener = null;
  clearTimeout(syncDebounceTimer);
  if (!silent) {
    localStorage.removeItem(SYNC_KEY);
    localStorage.removeItem('cr9-sync-ts');
    renderSyncUI();
  }
}

function pushToFirebase() {
  if (!syncRef || syncIsReceiving) return;
  clearTimeout(syncDebounceTimer);
  syncDebounceTimer = setTimeout(() => {
    const ts = Date.now();
    localStorage.setItem('cr9-sync-ts', String(ts));
    syncRef.set({ ...state, _ts: ts });
  }, SYNC_DEBOUNCE_MS);
}

function renderSyncUI() {
  const code = localStorage.getItem(SYNC_KEY);
  const connected = !!code && !!syncRef;
  const dot = document.querySelector('#sync-status .sync-dot');
  const txt = document.querySelector('#sync-status .sync-status-text');
  const codeDisplay = document.getElementById('sync-code-display');
  const codeText = document.getElementById('sync-code-text');
  const actionsOff = document.getElementById('sync-actions');
  const actionsOn = document.getElementById('sync-actions-connected');
  if (!dot) return;
  dot.classList.toggle('on', connected);
  txt.textContent = connected ? 'conectado' : 'desconectado';
  codeDisplay.hidden = !connected;
  if (connected) codeText.textContent = code;
  actionsOff.hidden = connected;
  actionsOn.hidden = !connected;
}

function fullRerender() {
  renderHome();
  renderConfig();
  renderDisciplinas();
  if (currentDiscId) renderDetalhe();
}

function pushRecente(entry) {
  state.recentes.unshift({ ts: Date.now(), ...entry });
  if (state.recentes.length > MAX_RECENTES) state.recentes.length = MAX_RECENTES;
}

let state = loadState();
let simState = {};
let currentDiscId = null;

// ───────── CÁLCULOS ─────────

function calcDisc(d, ov = {}) {
  const ap1v = ov.ap1 !== undefined ? ov.ap1 : d.ap1.value;
  const ap2v = ov.ap2 !== undefined ? ov.ap2 : d.ap2.value;
  const asTaken = ov.asTaken !== undefined ? ov.asTaken : d.as.taken;
  // AS value enters calculation whenever it exists (expectativa or oficial).
  // `asTaken` (oficial) only gates Ibmec Stars elimination.
  const asv = ov.asValue !== undefined ? ov.asValue : d.as.value;

  let ap1F = ap1v, ap2F = ap2v;
  if (asv !== null && asv !== undefined) {
    if (ap1v === null && ap2v === null) {
      ap1F = asv;
      ap2F = null;
    } else if (ap1v === null) {
      ap1F = asv;
      ap2F = ap2v;
    } else if (ap2v === null) {
      ap1F = ap1v;
      ap2F = asv;
    } else if (ap1v <= ap2v) {
      ap1F = Math.max(ap1v, asv);
    } else {
      ap2F = Math.max(ap2v, asv);
    }
  }

  const acMode = d.acMode || 'custom';
  let acEarned = 0, acDist = 0;
  if (acMode === 'equal') {
    const nAcs = d.acs.length;
    const share = nAcs > 0 ? 20 / nAcs : 0;
    d.acs.forEach(ac => {
      const deliv = ov.acs && ov.acs[ac.id] !== undefined ? ov.acs[ac.id] : ac.delivered;
      if (deliv === true || deliv === false) {
        acDist += share;
        if (deliv === true) acEarned += share;
      }
    });
  } else {
    d.acs.forEach(ac => {
      const v = ov.acs && ov.acs[ac.id] !== undefined ? ov.acs[ac.id] : ac.value;
      if (v !== null && v !== undefined) {
        acEarned += v;
        acDist += ac.valor;
      }
    });
  }

  // Sim-only: hypothetical "AC restante" — points for ACs not yet created.
  if (ov.acExtra !== undefined && ov.acExtra !== null && !isNaN(ov.acExtra)) {
    acEarned += ov.acExtra;
    acDist += ov.acExtra;
  }

  const earned = (ap1F !== null && ap1F !== undefined ? ap1F : 0)
               + (ap2F !== null && ap2F !== undefined ? ap2F : 0)
               + acEarned;
  const dist = (ap1F !== null && ap1F !== undefined ? 40 : 0)
             + (ap2F !== null && ap2F !== undefined ? 40 : 0)
             + acDist;

  return {
    earned,
    dist,
    // hasAS = AS is OFICIAL (taken). Expectativa does not eliminate Stars.
    hasAS: asTaken === true && asv !== null && asv !== undefined,
    ap1F,
    ap2F
  };
}

function calcPeriodo(sim = {}) {
  const n = state.disciplinas.length;
  const total = n * 100;
  const starsNeeded = n * 90;
  let earnedReg = 0, distReg = 0, anyAS = false;

  state.disciplinas.forEach(d => {
    const simD = (sim.disc && sim.disc[d.id]) || {};
    const r = calcDisc(d, simD);
    earnedReg += r.earned;
    distReg += r.dist;
    if (r.hasAS) anyAS = true;
  });

  const tp = sim.tp !== undefined ? sim.tp : state.tp;
  let tpBonus = 0;
  if (tp && tp.value !== null && tp.value !== undefined && tp.applyTo) {
    tpBonus = Math.round(tp.value * 10);
  }

  const aprov = distReg > 0 ? (earnedReg / distReg) * 100 : null;
  const totalScore = earnedReg + tpBonus;
  const enrolledOk = n >= 4;
  const starsEligible = !anyAS && enrolledOk;
  const starsProgress = starsNeeded > 0
    ? Math.min(totalScore / starsNeeded, 1) * 100
    : 0;

  return {
    n, total, starsNeeded,
    earnedReg, distReg,
    tpBonus, totalScore,
    aprov, anyAS, enrolledOk,
    starsEligible, starsProgress
  };
}

function normalCdf(z) {
  if (z > 38) return 1;
  if (z < -38) return 0;
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp(-z * z / 2);
  const poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const tail = d * poly;
  return z >= 0 ? 1 - tail : tail;
}

function calcStarsProbability(p) {
  if (p.n === 0) return { state: 'empty' };
  if (p.anyAS) return { state: 'out' };
  if (!p.enrolledOk) return { state: 'insufficient', falta: 4 - p.n };
  if (p.distReg === 0) return { state: 'nodata' };

  const remaining = Math.max(0, p.total - p.distReg);
  const need = p.starsNeeded - p.totalScore;

  if (need <= 0) {
    return { state: 'locked', remaining, need: 0, rate: (p.earnedReg / p.distReg) * 100, projected: p.totalScore };
  }
  if (need > remaining) {
    const maxPossible = p.totalScore + remaining;
    return { state: 'impossible', remaining, need, rate: (p.earnedReg / p.distReg) * 100, projected: maxPossible };
  }

  const rate = p.earnedReg / p.distReg;
  const needRate = need / remaining;

  // Normal approximation with shrinkage: more distributed points → tighter variance.
  // Aleatoric term: remaining * rate * (1-rate) treats each "point slot" as Bernoulli-ish.
  // Epistemic term: rate itself is uncertain — inflate by (1 + remaining/distReg).
  const shrinkage = 1 + remaining / p.distReg;
  const variance = Math.max(remaining * rate * (1 - rate) * shrinkage, 1);
  const sigma = Math.sqrt(variance);
  const mean = remaining * rate;
  const z = (mean - need) / sigma;
  const prob = normalCdf(z);
  const pct = Math.max(0, Math.min(100, prob * 100));

  return {
    state: 'computed',
    pct,
    rate: rate * 100,
    needRate: needRate * 100,
    projected: p.totalScore + mean,
    remaining,
    need
  };
}

function renderSegBar() {
  const el = document.getElementById('seg-dist');
  if (state.disciplinas.length === 0) {
    el.innerHTML = '<div class="seg-bar-empty">crie disciplinas pra ver o progresso</div>';
    return;
  }
  el.innerHTML = state.disciplinas.map(d => {
    const r = calcDisc(d);
    const tpB = tpBonusForDisc(d.id);
    const distW = Math.max(0, Math.min(100, r.dist + tpB));
    const earnedW = Math.max(0, Math.min(100, r.earned + tpB));
    const title = escapeHTML(d.nome) + ' — ' + fmtNum(r.earned + tpB, 1) + '/' + fmtNum(r.dist + tpB, 0) + ' pts';
    return '<div class="seg" title="' + title + '">'
      + '<div class="seg-dist-fill" style="width:' + distW + '%"></div>'
      + '<div class="seg-earned-fill" style="width:' + earnedW + '%"></div>'
      + '</div>';
  }).join('');
}

function renderProbCard(p) {
  const prob = calcStarsProbability(p);
  const cardEl = document.getElementById('prob-card');
  const pctEl = document.getElementById('prob-pct');
  const barEl = document.getElementById('prob-bar');
  const statusEl = document.getElementById('prob-status');
  const projEl = document.getElementById('prob-proj');
  const needEl = document.getElementById('prob-need');
  const rateEl = document.getElementById('prob-rate');
  const hintEl = document.getElementById('prob-hint');

  cardEl.className = 'prob-card';

  // Auto-shrink pct display pra não sobrepor o label "Chances do Stars"
  // quando o texto fica longo (ex.: "0,000347").
  const bigEl = pctEl.closest('.prob-big');
  const symEl = document.getElementById('prob-pct-sym');
  const setPct = (txt, opts) => {
    pctEl.textContent = txt;
    const showSym = !(opts && opts.noSym);
    if (symEl) symEl.style.display = showSym ? '' : 'none';
    if (!bigEl) return;
    const effLen = String(txt).length + (showSym ? 1 : 0);
    const size = effLen <= 3 ? 46
      : effLen === 4 ? 42
      : effLen === 5 ? 36
      : effLen === 6 ? 30
      : effLen === 7 ? 26
      : effLen === 8 ? 22
      : 18;
    bigEl.style.fontSize = size + 'px';
  };

  const reset = () => {
    setPct('—');
    barEl.style.width = '0%';
    barEl.className = 'bar-fill';
    statusEl.className = 'stars-status';
    projEl.textContent = '—';
    needEl.textContent = '—';
    rateEl.textContent = '—';
  };

  if (prob.state === 'empty') {
    reset();
    statusEl.textContent = 'sem disciplinas';
    hintEl.textContent = 'crie disciplinas pra estimar';
    return;
  }
  if (prob.state === 'insufficient') {
    reset();
    cardEl.classList.add('danger');
    statusEl.textContent = 'matrícula insuficiente';
    statusEl.className = 'stars-status out';
    needEl.textContent = 4 - p.n + ' disc. a mais';
    hintEl.textContent = 'o Stars exige matrícula em 4+ disciplinas — você tem ' + p.n;
    return;
  }
  if (prob.state === 'nodata') {
    reset();
    statusEl.textContent = 'sem dados';
    needEl.textContent = fmtNum(p.starsNeeded, 0) + ' pts';
    hintEl.textContent = 'lance alguma nota pra começar o cálculo';
    return;
  }
  if (prob.state === 'out') {
    reset();
    cardEl.classList.add('danger');
    setPct('0');
    barEl.style.width = '100%';
    barEl.className = 'bar-fill danger';
    statusEl.textContent = 'fora';
    statusEl.className = 'stars-status out';
    projEl.textContent = fmtNum(p.totalScore, 0) + ' pts';
    rateEl.textContent = p.aprov !== null ? fmtNum(p.aprov, 1) + '%' : '—';
    hintEl.textContent = 'AS oficial elimina você do Stars — sem chance estatística';
    return;
  }
  if (prob.state === 'locked') {
    cardEl.classList.add('success');
    setPct('100');
    barEl.style.width = '100%';
    barEl.className = 'bar-fill success';
    statusEl.textContent = 'garantido';
    statusEl.className = 'stars-status in';
    projEl.textContent = fmtNum(prob.projected, 0) + ' pts';
    needEl.textContent = '0 pts';
    rateEl.textContent = fmtNum(prob.rate, 1) + '%';
    hintEl.textContent = 'já passou de ' + p.starsNeeded + ' pontos — Stars travado';
    return;
  }
  if (prob.state === 'impossible') {
    cardEl.classList.add('danger');
    setPct('0');
    barEl.style.width = '100%';
    barEl.className = 'bar-fill danger';
    statusEl.textContent = 'impossível';
    statusEl.className = 'stars-status out';
    projEl.textContent = 'máx ' + fmtNum(prob.projected, 0) + ' pts';
    needEl.textContent = fmtNum(prob.need, 0) + ' pts';
    rateEl.textContent = fmtNum(prob.rate, 1) + '%';
    hintEl.textContent = 'faltam mais pontos do que ainda dá pra distribuir';
    return;
  }

  // computed
  if (prob.pct < 0.00001) {
    setPct('ínfima', { noSym: true });
  } else {
    setPct(fmtPct(prob.pct));
  }
  barEl.style.width = Math.max(2, Math.min(100, prob.pct)) + '%';

  let band, label, cls;
  if (prob.pct >= 85) { band = 'success'; label = 'tranquilo'; cls = 'in'; }
  else if (prob.pct >= 60) { band = 'success'; label = 'provável'; cls = 'in'; }
  else if (prob.pct >= 35) { band = 'warning'; label = 'apertado'; cls = ''; }
  else if (prob.pct >= 10) { band = 'warning'; label = 'difícil'; cls = 'out'; }
  else { band = 'danger'; label = 'improvável'; cls = 'out'; }

  barEl.className = 'bar-fill ' + band;
  cardEl.classList.add(band);
  statusEl.textContent = label;
  statusEl.className = 'stars-status' + (cls ? ' ' + cls : '');

  projEl.textContent = fmtNum(prob.projected, 0) + ' pts';
  const needRateTxt = fmtNum(prob.needRate, 0) + '%';
  needEl.textContent = needRateTxt + ' de ' + fmtNum(prob.remaining, 0);
  rateEl.textContent = fmtNum(prob.rate, 1) + '%';

  if (prob.pct < 0.00001) {
    const gap = Math.max(0, prob.needRate - prob.rate);
    hintEl.textContent = 'chance ínfima — precisa subir ' + fmtNum(gap, 0) + ' pts% no rendimento pros ' + fmtNum(prob.remaining, 0) + ' restantes';
  } else if (prob.needRate <= prob.rate) {
    hintEl.textContent = 'mantendo seu rendimento, você chega lá — ' + fmtPct(prob.pct) + '% de chance';
  } else {
    const gap = prob.needRate - prob.rate;
    hintEl.textContent = 'precisa subir ' + fmtNum(gap, 0) + ' pts% no rendimento pros ' + fmtNum(prob.remaining, 0) + ' restantes';
  }
}

function discStatus(d) {
  const r = calcDisc(d);
  const tpB = tpBonusForDisc(d.id);
  const earnedTotal = r.earned + tpB;
  const distTotal = r.dist + tpB;
  if (distTotal === 0) return '';
  const pct = (earnedTotal / distTotal) * 100;
  if (pct >= 70) return 'ok';
  if (pct >= 60) return 'warn';
  return 'danger';
}

function tpBonusForDisc(discId) {
  if (!state.tp || state.tp.value == null || state.tp.applyTo !== discId) return 0;
  return Math.round(state.tp.value * 10);
}

function calcDiscOficialOnly(d) {
  const ap1Slot = d.ap1 && !d.ap1.expectativa ? d.ap1 : { value: null, expectativa: false };
  const ap2Slot = d.ap2 && !d.ap2.expectativa ? d.ap2 : { value: null, expectativa: false };
  const asSlot = d.as && !d.as.expectativa ? d.as : { value: null, expectativa: false, taken: d.as ? d.as.taken : false };
  const oficialAcs = (d.acs || []).map(ac => {
    if (d.acMode === 'equal') {
      return { ...ac };
    }
    if (ac.expectativa) return { ...ac, value: null };
    return { ...ac };
  });
  const dummy = { ...d, ap1: ap1Slot, ap2: ap2Slot, as: asSlot, acs: oficialAcs };
  return calcDisc(dummy);
}

// ───────── NAVEGAÇÃO ─────────

function goto(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(id);
  if (target) target.classList.add('active');
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('active', t.dataset.goto === id);
  });
  window.scrollTo(0, 0);
  if (id === 's-home') renderHome();
  if (id === 's-disciplinas') renderDisciplinas();
  if (id === 's-detalhe') renderDetalhe();
  if (id === 's-simulador') renderSimulador();
  if (id === 's-config') renderConfig();
}

// ───────── RENDER: HOME ─────────

function renderHome() {
  const tagEl = document.getElementById('hdr-tagline');
  if (tagEl) tagEl.textContent = getSaudacao(state.gender);

  const gateNeeded = state.gender == null || state.foco == null;
  const views = {
    gate: document.getElementById('home-setup-gate'),
    stars: document.getElementById('home-stars'),
    tracking: document.getElementById('home-tracking'),
    registro: document.getElementById('home-registro')
  };
  Object.values(views).forEach(v => { if (v) v.hidden = true; });

  if (gateNeeded) {
    if (views.gate) views.gate.hidden = false;
    return;
  }

  const foco = state.foco;
  if (foco === 'tracking') {
    if (views.tracking) views.tracking.hidden = false;
    renderHomeTracking();
  } else if (foco === 'registro') {
    if (views.registro) views.registro.hidden = false;
    renderHomeRegistro();
  } else {
    if (views.stars) views.stars.hidden = false;
    renderHomeStars();
  }
}

function renderHomeStars() {
  const p = calcPeriodo();

  // Stars hero
  const hero = document.getElementById('stars-hero');
  const ring = document.getElementById('stars-ring');
  const ringFill = document.getElementById('ring-fill');
  const numEl = document.getElementById('stars-num');
  const denEl = document.getElementById('stars-den');
  const statusEl = document.getElementById('stars-status');
  const hintEl = document.getElementById('stars-hint');

  numEl.textContent = p.n === 0 ? '0' : String(Math.round(p.totalScore));
  denEl.textContent = '/ ' + (p.n === 0 ? 450 : p.starsNeeded);

  // SVG ring animation via pathLength
  const offset = 100 - p.starsProgress;
  ringFill.setAttribute('stroke-dashoffset', String(offset));

  // hero/ring class modifiers
  let heroMod = '';
  if (!p.starsEligible) heroMod = 'out';
  else if (p.n > 0 && p.totalScore >= p.starsNeeded) heroMod = 'in';
  hero.className = 'stars-hero' + (heroMod ? ' ' + heroMod : '');
  ring.className = 'stars-ring' + (heroMod ? ' ' + heroMod : '');

  // Status pill
  if (!p.starsEligible) {
    statusEl.textContent = 'Fora do Stars';
    statusEl.className = 'stars-status out';
  } else if (p.n > 0 && p.totalScore >= p.starsNeeded) {
    statusEl.textContent = 'No Stars';
    statusEl.className = 'stars-status in';
  } else {
    statusEl.textContent = 'Em progresso';
    statusEl.className = 'stars-status';
  }

  // Hint line
  if (p.n === 0) {
    hintEl.innerHTML = 'crie suas disciplinas pra começar';
  } else if (p.anyAS) {
    hintEl.innerHTML = 'você fez AS — não pode mais pegar o Stars neste período';
  } else if (!p.enrolledOk) {
    const falta = 4 - p.n;
    hintEl.innerHTML = 'precisa estar matriculado em ao menos <strong>4 disciplinas</strong> (falta ' + falta + ')';
  } else if (p.totalScore >= p.starsNeeded) {
    hintEl.innerHTML = 'você garantiu o Stars com ' + Math.round(p.totalScore) + ' pontos';
  } else {
    hintEl.innerHTML = 'faltam <strong>' + fmtNum(p.starsNeeded - p.totalScore, 1) + '</strong> pontos — ainda dá';
  }

  // Probabilidade estatística do Stars
  renderProbCard(p);

  // Pontos distribuídos
  document.getElementById('pts-dist').textContent = fmtNum(p.distReg, 1);
  document.getElementById('pts-total').textContent = p.total || 500;
  const distPct = p.total > 0 ? (p.distReg / p.total) * 100 : 0;
  document.getElementById('dist-pct').innerHTML =
    fmtNum(distPct, 0) + '<span class="dist-pct-sym">%</span>';
  renderSegBar();
  document.getElementById('dist-hint').textContent =
    (p.n === 0 || p.distReg === 0)
      ? 'nada lançado ainda'
      : fmtNum(p.earnedReg, 0) + ' pts ganhos de ' + fmtNum(p.distReg, 0) + ' já lançados';

  // Aproveitamento
  const aprovEl = document.getElementById('aprov-pct');
  const aprovBar = document.getElementById('bar-aprov');
  const aprovHint = document.getElementById('aprov-hint');

  aprovEl.textContent = p.aprov !== null ? fmtNum(p.aprov, 1) + '%' : '—';
  aprovBar.style.width = (p.aprov !== null ? p.aprov : 0) + '%';
  if (p.aprov === null) {
    aprovBar.className = 'bar-fill';
    aprovHint.textContent = 'nada para calcular';
  } else if (p.aprov >= 70) {
    aprovBar.className = 'bar-fill success';
    aprovHint.textContent = 'dentro da média';
  } else if (p.aprov >= 60) {
    aprovBar.className = 'bar-fill warning';
    aprovHint.textContent = 'abaixo da média';
  } else {
    aprovBar.className = 'bar-fill danger';
    aprovHint.textContent = 'muito abaixo da média';
  }

  // TP card
  const tpBonusEl = document.getElementById('tp-bonus');
  const tpHintEl = document.getElementById('tp-hint');
  if (state.tp.value !== null && state.tp.value !== undefined) {
    const bonus = Math.round(state.tp.value * 10);
    const expBadge = state.tp.expectativa ? ' <span class="badge-exp">prev</span>' : '';
    tpBonusEl.innerHTML = bonus + ' pts' + expBadge;
    const disc = state.disciplinas.find(d => d.id === state.tp.applyTo);
    tpHintEl.innerHTML = disc
      ? 'nota ' + fmtNum(state.tp.value, 3) + ' → aplicado em <strong>' + escapeHTML(disc.nome) + '</strong>'
      : 'nota ' + fmtNum(state.tp.value, 3) + ' — <strong>sem disciplina selecionada</strong>';
  } else {
    tpBonusEl.textContent = '— pts';
    tpHintEl.textContent = 'sem nota lançada';
  }

  // Breakdown por disciplina
  const bdBody = document.getElementById('bd-body');
  if (state.disciplinas.length === 0) {
    bdBody.innerHTML = '<p class="hint">crie disciplinas pra ver o detalhamento</p>';
  } else {
    bdBody.innerHTML = state.disciplinas.map(d => {
      const r = calcDisc(d);
      const tpB = tpBonusForDisc(d.id);
      const earnedW = Math.max(0, Math.min(100, r.earned + tpB));
      const distW = Math.max(0, Math.min(100, r.dist + tpB));
      const tpBadge = tpB > 0 ? ' <span class="tp-badge">+' + tpB + ' TP</span>' : '';
      return '<div class="bd-row">'
        + '<div class="bd-head">'
        + '<span class="bd-name">' + escapeHTML(d.nome) + tpBadge + '</span>'
        + '<span class="bd-val">' + fmtNum(r.earned, 1) + '/100</span>'
        + '</div>'
        + '<div class="bd-bar">'
        + '<div class="bd-dist" style="width:' + distW + '%"></div>'
        + '<div class="bd-earned" style="width:' + earnedW + '%"></div>'
        + '</div>'
        + '</div>';
    }).join('');
  }

  // Recentes
  const lista = document.getElementById('lista-recentes');
  if (!state.recentes || state.recentes.length === 0) {
    lista.innerHTML = '<li class="empty">nenhum lançamento ainda</li>';
  } else {
    lista.innerHTML = state.recentes.map(r => {
      const exp = r.kind === 'expectativa';
      const badge = exp ? '<span class="badge-exp">prev</span>' : '';
      const maxStr = r.max ? '<span class="rec-val-max"> / ' + fmtNum(r.max, 1) + '</span>' : '';
      return '<li class="rec-item' + (exp ? ' exp' : '') + '">'
        + '<div class="rec-body">'
        + '<div class="rec-disc">' + escapeHTML(r.discNome || '—') + ' ' + badge + '</div>'
        + '<div class="rec-tipo">' + escapeHTML(r.label || '') + '</div>'
        + '</div>'
        + '<div class="rec-val">' + fmtNum(r.valor, 2) + maxStr + '</div>'
        + '</li>';
    }).join('');
  }
}

// ───────── RENDER: HOME TRACKING ─────────

function renderHomeTracking() {
  const p = calcPeriodo();

  // KPI strip
  const kpis = document.getElementById('track-kpis');
  if (kpis) {
    const aprovTxt = p.aprov !== null ? fmtNum(p.aprov, 1) + '%' : '—';
    const projTxt = fmtNum(p.totalScore, 0) + ' / ' + (p.starsNeeded || 450);
    kpis.innerHTML = ''
      + '<div class="track-kpi"><div class="track-kpi-label">aproveitamento</div><div class="track-kpi-value">' + aprovTxt + '</div></div>'
      + '<div class="track-kpi"><div class="track-kpi-label">ganhos / lançados</div><div class="track-kpi-value">' + fmtNum(p.earnedReg, 0) + ' / ' + fmtNum(p.distReg, 0) + '</div></div>'
      + '<div class="track-kpi"><div class="track-kpi-label">projeção stars</div><div class="track-kpi-value">' + projTxt + '</div></div>';
  }

  // Expectativa vs Oficial
  const evo = document.getElementById('track-exp-vs-of');
  if (evo) {
    if (state.disciplinas.length === 0) {
      evo.innerHTML = '<p class="hint">crie disciplinas pra ver</p>';
    } else {
      evo.innerHTML = state.disciplinas.map(d => {
        const all = calcDisc(d);
        const of = calcDiscOficialOnly(d);
        const expExtra = Math.max(0, all.earned - of.earned);
        const ofW = Math.max(0, Math.min(100, of.earned));
        const expW = Math.max(0, Math.min(100 - ofW, expExtra));
        return '<div class="track-bar-row">'
          + '<div class="track-bar-head"><span>' + escapeHTML(d.nome) + '</span><span>' + fmtNum(of.earned, 0) + ' + ' + fmtNum(expExtra, 0) + '</span></div>'
          + '<div class="track-bar"><div class="track-bar-of" style="width:' + ofW + '%"></div><div class="track-bar-exp" style="left:' + ofW + '%;width:' + expW + '%"></div></div>'
          + '</div>';
      }).join('');
    }
  }

  // Timeline SVG sparkline
  const tl = document.getElementById('track-timeline');
  if (tl) {
    const recs = (state.recentes || []).slice().reverse();
    if (recs.length === 0) {
      tl.innerHTML = '<p class="hint">sem lançamentos pra plotar</p>';
    } else {
      const w = 320, h = 80, pad = 6;
      const cum = [];
      let acc = 0;
      recs.forEach(r => { acc += (typeof r.valor === 'number' ? r.valor : 0); cum.push(acc); });
      const maxV = Math.max.apply(null, cum) || 1;
      const stepX = (w - pad * 2) / Math.max(1, cum.length - 1);
      const pts = cum.map((v, i) => {
        const x = pad + i * stepX;
        const y = h - pad - (v / maxV) * (h - pad * 2);
        return x.toFixed(1) + ',' + y.toFixed(1);
      });
      const dots = cum.map((v, i) => {
        const x = pad + i * stepX;
        const y = h - pad - (v / maxV) * (h - pad * 2);
        return '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="2.5"/>';
      }).join('');
      tl.innerHTML = '<svg class="track-svg" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none">'
        + '<polyline points="' + pts.join(' ') + '" fill="none" stroke="currentColor" stroke-width="1.5"/>'
        + dots
        + '</svg>';
    }
  }

  // Aproveitamento per disciplina
  const apr = document.getElementById('track-aprov-list');
  if (apr) {
    if (state.disciplinas.length === 0) {
      apr.innerHTML = '<p class="hint">crie disciplinas pra ver</p>';
    } else {
      const items = state.disciplinas.map(d => {
        const r = calcDisc(d);
        const tpB = tpBonusForDisc(d.id);
        const e = r.earned + tpB;
        const dist = r.dist + tpB;
        const pct = dist > 0 ? (e / dist) * 100 : 0;
        return { d, pct };
      }).sort((a, b) => b.pct - a.pct);
      apr.innerHTML = items.map(it =>
        '<div class="track-bar-row">'
        + '<div class="track-bar-head"><span>' + escapeHTML(it.d.nome) + '</span><span>' + fmtNum(it.pct, 0) + '%</span></div>'
        + '<div class="track-bar"><div class="track-bar-of" style="width:' + Math.max(0, Math.min(100, it.pct)) + '%"></div></div>'
        + '</div>'
      ).join('');
    }
  }

  // Progressão SVG
  const pr = document.getElementById('track-progress');
  if (pr) {
    const recs = (state.recentes || []).slice().reverse();
    if (recs.length === 0) {
      pr.innerHTML = '<p class="hint">sem dados de progressão</p>';
    } else {
      const w = 320, h = 100, pad = 8;
      const cum = [];
      let acc = 0;
      recs.forEach(r => { acc += (typeof r.valor === 'number' ? r.valor : 0); cum.push(acc); });
      const need = p.starsNeeded || 450;
      const maxV = Math.max(need, cum[cum.length - 1] || 1);
      const stepX = (w - pad * 2) / Math.max(1, cum.length - 1);
      const pts = cum.map((v, i) => {
        const x = pad + i * stepX;
        const y = h - pad - (v / maxV) * (h - pad * 2);
        return x.toFixed(1) + ',' + y.toFixed(1);
      });
      const areaPts = [pad + ',' + (h - pad)].concat(pts).concat([(pad + (cum.length - 1) * stepX).toFixed(1) + ',' + (h - pad)]);
      const needY = (h - pad - (need / maxV) * (h - pad * 2)).toFixed(1);
      pr.innerHTML = '<svg class="track-svg" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none">'
        + '<polygon points="' + areaPts.join(' ') + '" fill="currentColor" fill-opacity="0.18"/>'
        + '<polyline points="' + pts.join(' ') + '" fill="none" stroke="currentColor" stroke-width="1.5"/>'
        + '<line x1="' + pad + '" y1="' + needY + '" x2="' + (w - pad) + '" y2="' + needY + '" stroke="currentColor" stroke-dasharray="3 3" stroke-opacity="0.6"/>'
        + '<text x="' + (w - pad) + '" y="' + (parseFloat(needY) - 2) + '" text-anchor="end" font-size="9" fill="currentColor" fill-opacity="0.7">stars ' + need + '</text>'
        + '</svg>';
    }
  }

  // TP contribution
  const tpEl = document.getElementById('track-tp');
  if (tpEl) {
    if (!state.tp || state.tp.value == null) {
      tpEl.innerHTML = '<p class="hint">sem nota TP lançada</p>';
    } else {
      const bonus = Math.round(state.tp.value * 10);
      const disc = state.disciplinas.find(x => x.id === state.tp.applyTo);
      tpEl.innerHTML = '<div class="track-tp-line"><strong>+' + bonus + ' pts</strong> em ' + (disc ? escapeHTML(disc.nome) : '<em>sem disciplina</em>') + '</div>'
        + '<div class="track-tp-line muted">nota bruta ' + fmtNum(state.tp.value, 3) + '</div>';
    }
  }

  // ── Fun charts ──

  const aprov = p.aprov || 0;

  // Você vs Aluno Médio
  const vsm = document.getElementById('track-vs-medio');
  if (vsm) {
    const medio = 68;
    const you = Math.min(100, Math.round(aprov));
    vsm.innerHTML = '<div class="track-vs">'
      + '<div class="track-vs-row"><span class="track-vs-label">você</span><div class="track-bar"><div class="track-bar-of" style="width:' + you + '%"></div></div><span class="track-vs-val">' + you + '%</span></div>'
      + '<div class="track-vs-row"><span class="track-vs-label">aluno médio</span><div class="track-bar"><div class="track-bar-avg" style="width:' + medio + '%"></div></div><span class="track-vs-val">' + medio + '%</span></div>'
      + '</div>'
      + '<p class="track-fun-hint">' + (you > medio ? 'acima da média. orgulho.' : you === medio ? 'na média certinha. estável.' : 'abaixo da média... bora reagir.') + '</p>';
  }

  // Seus professores gostam de você?
  const profs = document.getElementById('track-profs');
  if (profs) {
    if (state.disciplinas.length === 0) {
      profs.innerHTML = '<p class="hint">crie disciplinas pra descobrir</p>';
    } else {
      profs.innerHTML = state.disciplinas.map(d => {
        const r = calcDisc(d);
        const tpB = tpBonusForDisc(d.id);
        const score = r.dist > 0 ? (r.earned + tpB) / (r.dist + tpB) * 100 : 0;
        let emoji, msg;
        if (score >= 90) { emoji = '😍'; msg = 'te ama'; }
        else if (score >= 80) { emoji = '😊'; msg = 'te curte'; }
        else if (score >= 70) { emoji = '😐'; msg = 'neutro'; }
        else if (score >= 50) { emoji = '😒'; msg = 'desconfiado'; }
        else { emoji = '💀'; msg = 'te odeia'; }
        return '<div class="track-prof-row"><span class="track-prof-name">' + escapeHTML(d.nome) + '</span><span class="track-prof-verdict">' + emoji + ' ' + msg + '</span></div>';
      }).join('');
    }
  }

  // Você vs Einstein
  const vse = document.getElementById('track-vs-einstein');
  if (vse) {
    const you = Math.min(100, Math.round(aprov));
    const ein = 97;
    const diff = ein - you;
    vse.innerHTML = '<div class="track-vs">'
      + '<div class="track-vs-row"><span class="track-vs-label">você</span><div class="track-bar"><div class="track-bar-of" style="width:' + you + '%"></div></div><span class="track-vs-val">' + you + '%</span></div>'
      + '<div class="track-vs-row"><span class="track-vs-label">einstein</span><div class="track-bar"><div class="track-bar-genius" style="width:' + ein + '%"></div></div><span class="track-vs-val">' + ein + '%</span></div>'
      + '</div>'
      + '<p class="track-fun-hint">' + (diff <= 0 ? 'calma aí, gênio. superou o Einstein.' : diff <= 10 ? 'quase lá. falta pouco pro Nobel.' : diff <= 25 ? 'respeitável, mas Einstein ainda ganha.' : 'Einstein tá rindo de você.') + '</p>';
  }

  // Nível de desespero
  const desp = document.getElementById('track-desespero');
  if (desp) {
    const missing = p.maxReg > 0 ? (1 - p.earnedReg / p.maxReg) * 100 : 0;
    const pctDone = p.maxReg > 0 ? p.distReg / p.maxReg * 100 : 0;
    let level, bar, emoji;
    if (pctDone < 20) { level = 'relaxado demais'; bar = 15; emoji = '😴'; }
    else if (aprov >= 85) { level = 'zen'; bar = 10; emoji = '🧘'; }
    else if (aprov >= 70) { level = 'tranquilo'; bar = 30; emoji = '😌'; }
    else if (aprov >= 55) { level = 'suando'; bar = 55; emoji = '😰'; }
    else if (aprov >= 40) { level = 'desespero moderado'; bar = 75; emoji = '😱'; }
    else { level = 'pânico total'; bar = 95; emoji = '🔥'; }
    desp.innerHTML = '<div class="track-desp">'
      + '<div class="track-desp-emoji">' + emoji + '</div>'
      + '<div class="track-desp-level">' + level + '</div>'
      + '<div class="track-bar"><div class="track-bar-desp" style="width:' + bar + '%"></div></div>'
      + '</div>';
  }

  // Chance de sobreviver ao período
  const sob = document.getElementById('track-sobreviver');
  if (sob) {
    let chance;
    if (p.n === 0) chance = 50;
    else if (aprov >= 85) chance = 98;
    else if (aprov >= 70) chance = 85;
    else if (aprov >= 55) chance = 60;
    else if (aprov >= 40) chance = 35;
    else chance = 12;
    const jitter = Math.floor(Math.random() * 5) - 2;
    chance = Math.max(1, Math.min(99, chance + jitter));
    let msg;
    if (chance >= 90) msg = 'praticamente garantido. relaxa.';
    else if (chance >= 70) msg = 'tá no caminho. mantém o ritmo.';
    else if (chance >= 50) msg = 'zona de risco. cuidado.';
    else if (chance >= 30) msg = 'situação crítica. acorda.';
    else msg = 'modo sobrevivência ativado.';
    sob.innerHTML = '<div class="track-sobrev">'
      + '<div class="track-sobrev-num">' + chance + '<span class="track-sobrev-pct">%</span></div>'
      + '<div class="track-bar"><div class="track-bar-of" style="width:' + chance + '%"></div></div>'
      + '<p class="track-fun-hint">' + msg + '</p>'
      + '</div>';
  }
}

// ───────── RENDER: HOME REGISTRO ─────────

function renderHomeRegistro() {
  // Summary strip
  const summary = document.getElementById('reg-summary');
  if (summary) {
    const p = calcPeriodo();
    const pct = p.maxReg > 0 ? Math.round(p.earnedReg / p.maxReg * 100) : 0;
    const starsOk = p.totalScore >= (p.starsNeeded || 450) && p.n >= 4;
    summary.innerHTML = ''
      + '<div class="reg-sum-item"><span class="reg-sum-num">' + fmtNum(p.totalScore, 0) + '</span><span class="reg-sum-lbl">pontos</span></div>'
      + '<div class="reg-sum-item"><span class="reg-sum-num">' + pct + '%</span><span class="reg-sum-lbl">aproveitamento</span></div>'
      + '<div class="reg-sum-item"><span class="reg-sum-num ' + (starsOk ? 'on' : '') + '">' + (starsOk ? 'sim' : 'não') + '</span><span class="reg-sum-lbl">stars</span></div>';
  }

  // Chips
  const chips = document.getElementById('reg-chips');
  if (chips) {
    if (state.disciplinas.length === 0) {
      chips.innerHTML = '<p class="hint">crie disciplinas primeiro</p>';
    } else {
      chips.innerHTML = state.disciplinas.map(d =>
        '<button class="reg-chip" data-disc="' + d.id + '">' + escapeHTML(d.nome) + '</button>'
      ).join('');
      chips.querySelectorAll('.reg-chip').forEach(el => {
        el.onclick = () => openDetalhe(el.dataset.disc);
      });
    }
  }

  // Recentes
  const lista = document.getElementById('reg-recentes');
  if (lista) {
    if (!state.recentes || state.recentes.length === 0) {
      lista.innerHTML = '<li class="empty">nenhum lançamento ainda</li>';
    } else {
      lista.innerHTML = state.recentes.map(r => {
        const exp = r.kind === 'expectativa';
        const badge = exp ? '<span class="badge-exp">prev</span>' : '';
        const maxStr = r.max ? '<span class="rec-val-max"> / ' + fmtNum(r.max, 1) + '</span>' : '';
        return '<li class="rec-item' + (exp ? ' exp' : '') + '">'
          + '<div class="rec-body">'
          + '<div class="rec-disc">' + escapeHTML(r.discNome || '—') + ' ' + badge + '</div>'
          + '<div class="rec-tipo">' + escapeHTML(r.label || '') + '</div>'
          + '</div>'
          + '<div class="rec-val">' + fmtNum(r.valor, 2) + maxStr + '</div>'
          + '</li>';
      }).join('');
    }
  }

  // Slim progress per disciplina
  const prog = document.getElementById('reg-progress');
  if (prog) {
    if (state.disciplinas.length === 0) {
      prog.innerHTML = '';
    } else {
      prog.innerHTML = state.disciplinas.map(d => {
        const r = calcDisc(d);
        const tpB = tpBonusForDisc(d.id);
        const e = r.earned + tpB;
        const dist = r.dist + tpB;
        const w = Math.max(0, Math.min(100, e));
        const tpBadge = tpB > 0 ? ' <span class="tp-badge">+' + tpB + '</span>' : '';
        return '<div class="reg-row">'
          + '<div class="reg-row-head"><span>' + escapeHTML(d.nome) + tpBadge + '</span><span>' + fmtNum(e, 0) + '/100</span></div>'
          + '<div class="reg-bar"><div class="reg-bar-fill" style="width:' + w + '%"></div></div>'
          + '</div>';
      }).join('');
    }
  }
}

// ───────── RENDER: CONFIG ─────────

function renderConfig() {
  document.querySelectorAll('#pref-gender .cfg-seg').forEach(btn => {
    const on = state.gender === btn.dataset.value;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-checked', on ? 'true' : 'false');
  });
  document.querySelectorAll('#pref-foco .cfg-opt').forEach(btn => {
    const on = state.foco === btn.dataset.value;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-checked', on ? 'true' : 'false');
  });

  // Sobre stats
  const p = calcPeriodo();
  const discEl = document.getElementById('cfg-stat-disc');
  const ptsEl = document.getElementById('cfg-stat-pts');
  if (discEl) discEl.textContent = String(p.n);
  if (ptsEl) ptsEl.textContent = p.n === 0 ? '0' : String(Math.round(p.totalScore));
  renderSyncUI();
}

// ───────── RENDER: DISCIPLINAS ─────────

function renderDisciplinas() {
  const lista = document.getElementById('lista-disciplinas');
  if (state.disciplinas.length === 0) {
    lista.innerHTML = '<li class="empty">nenhuma disciplina. toca em <strong>+ nova</strong>.</li>';
    return;
  }
  lista.innerHTML = state.disciplinas.map(d => {
    const r = calcDisc(d);
    const tpB = tpBonusForDisc(d.id);
    const status = discStatus(d);
    const pct = r.dist > 0 ? (r.earned / r.dist * 100) : 0;
    const metaDist = fmtNum(r.dist, 0);
    const metaEarned = fmtNum(r.earned, 1);
    const tpBadge = tpB > 0 ? ' <span class="tp-badge">+' + tpB + ' TP</span>' : '';
    return '<li class="disc-item ' + status + '" data-id="' + d.id + '">'
      + '<div class="disc-info">'
      + '<div class="disc-nome">' + escapeHTML(d.nome) + tpBadge + '</div>'
      + '<div class="disc-meta">' + metaEarned + '/' + metaDist + ' lançados · ' + fmtNum(pct, 0) + '%</div>'
      + '</div>'
      + '<div class="disc-pts">' + fmtNum(r.earned, 0) + '<span class="disc-pts-max"> / 100</span></div>'
      + '<div class="disc-chevron">›</div>'
      + '</li>';
  }).join('');
  lista.querySelectorAll('.disc-item').forEach(el => {
    el.addEventListener('click', () => openDetalhe(el.dataset.id));
  });
}

// ───────── RENDER: DETALHE ─────────

function openDetalhe(id) {
  currentDiscId = id;
  goto('s-detalhe');
}

function gradeDisplay(slot, max) {
  if (!slot || slot.value === null || slot.value === undefined) {
    return '<div class="grade-display empty">— <span class="grade-max">/ ' + max + '</span></div>';
  }
  const expClass = slot.expectativa ? 'exp' : '';
  const badge = slot.expectativa ? '<span class="badge-exp">prev</span>' : '';
  return '<div class="grade-display ' + expClass + '">'
    + fmtNum(slot.value, 1)
    + ' <span class="grade-max">/ ' + max + '</span>'
    + badge
    + '</div>';
}

function gradeActions(tipo) {
  return '<div class="grade-actions">'
    + '<button class="btn secondary sm" data-action="set-expectativa" data-tipo="' + tipo + '">previsão</button>'
    + '<button class="btn primary sm" data-action="set-oficial" data-tipo="' + tipo + '">oficial</button>'
    + '</div>';
}

function renderDetalhe() {
  const d = state.disciplinas.find(x => x.id === currentDiscId);
  if (!d) { goto('s-disciplinas'); return; }

  const tpB = tpBonusForDisc(d.id);
  document.getElementById('det-nome').innerHTML =
    escapeHTML(d.nome) + (tpB > 0 ? ' <span class="tp-badge">+' + tpB + ' TP</span>' : '');

  const r = calcDisc(d);
  document.getElementById('det-earned').textContent = fmtNum(r.earned, 1);
  document.getElementById('det-dist').textContent = fmtNum(r.dist, 0);
  const pct = r.dist > 0 ? (r.earned / r.dist * 100) : 0;
  const detBar = document.getElementById('det-bar');
  detBar.style.width = Math.max(0, Math.min(100, r.earned + tpB)) + '%';
  if (r.dist === 0) detBar.className = 'bar-fill';
  else if (pct >= 70) detBar.className = 'bar-fill success';
  else if (pct >= 60) detBar.className = 'bar-fill warning';
  else detBar.className = 'bar-fill danger';

  document.getElementById('det-status').textContent =
    r.dist === 0 ? 'sem notas'
    : pct >= 70 ? 'aproveitamento ' + fmtNum(pct, 1) + '% · dentro da média'
    : pct >= 60 ? 'aproveitamento ' + fmtNum(pct, 1) + '% · abaixo da média'
    : 'aproveitamento ' + fmtNum(pct, 1) + '% · muito abaixo';

  const acsAssigned = (d.acs || []).every(ac => {
    if ((d.acMode || 'custom') === 'equal') return ac.delivered === true || ac.delivered === false;
    return ac.value !== null && ac.value !== undefined;
  });
  const allGradesAssigned = d.ap1.value !== null && d.ap1.value !== undefined
    && d.ap2.value !== null && d.ap2.value !== undefined
    && acsAssigned;
  if (allGradesAssigned && !d.asAutoTriggered) {
    d.showAS = true;
    d.asAutoTriggered = true;
    saveState();
  } else if (!allGradesAssigned && d.asAutoTriggered) {
    d.asAutoTriggered = false;
    saveState();
  }

  const chk = document.getElementById('chk-show-as');
  if (chk) {
    chk.checked = d.showAS === true;
    chk.onchange = () => {
      d.showAS = chk.checked;
      saveState();
      renderDetalhe();
    };
  }

  document.getElementById('row-ap1').innerHTML = gradeDisplay(d.ap1, 40) + gradeActions('ap1');
  document.getElementById('row-ap2').innerHTML = gradeDisplay(d.ap2, 40) + gradeActions('ap2');

  // ACs — mode toggle
  const acMode = d.acMode || 'custom';
  const toggleEl = document.getElementById('ac-mode-toggle');
  toggleEl.querySelectorAll('.ac-mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === acMode);
    btn.onclick = () => setAcMode(btn.dataset.mode);
  });

  const acMaxEl = document.getElementById('ac-section-max');
  if (acMode === 'equal') {
    const n = d.acs.length;
    acMaxEl.textContent = n > 0
      ? 'máx 20 total · ' + fmtNum(20 / n, 1) + ' cada'
      : 'máx 20 total · split igual';
  } else {
    acMaxEl.textContent = 'máx 20 total';
  }

  // ACs — list
  const listaAcs = document.getElementById('lista-acs');
  if (d.acs.length === 0) {
    listaAcs.innerHTML = '<li class="empty">nenhuma atividade complementar</li>';
  } else if (acMode === 'equal') {
    const share = 20 / d.acs.length;
    listaAcs.innerHTML = d.acs.map(ac => {
      let cls, label;
      if (ac.delivered === true) { cls = 'delivered'; label = 'entregue'; }
      else if (ac.delivered === false) { cls = 'missed'; label = 'não entregue'; }
      else { cls = 'empty'; label = '—'; }
      return '<li class="ac-item equal">'
        + '<div class="ac-body">'
        + '<div class="ac-nome">' + escapeHTML(ac.nome) + '</div>'
        + '<div class="ac-val">vale ' + fmtNum(share, 1) + ' pts</div>'
        + '</div>'
        + '<div class="ac-grade ' + cls + '" data-ac-edit="' + ac.id + '">' + label + '</div>'
        + '<button class="ac-del" data-ac-del="' + ac.id + '" aria-label="excluir">×</button>'
        + '</li>';
    }).join('');
  } else {
    listaAcs.innerHTML = d.acs.map(ac => {
      const has = ac.value !== null && ac.value !== undefined;
      const cls = !has ? 'empty' : (ac.expectativa ? 'exp' : '');
      const badge = ac.expectativa ? '<span class="badge-exp">prev</span>' : '';
      const display = has ? fmtNum(ac.value, 1) : '—';
      return '<li class="ac-item">'
        + '<div class="ac-body">'
        + '<div class="ac-nome">' + escapeHTML(ac.nome) + ' ' + badge + '</div>'
        + '<div class="ac-val">máx ' + fmtNum(ac.valor, 1) + ' pts</div>'
        + '</div>'
        + '<div class="ac-grade ' + cls + '" data-ac-edit="' + ac.id + '">' + display + '</div>'
        + '<button class="ac-del" data-ac-del="' + ac.id + '" aria-label="excluir">×</button>'
        + '</li>';
    }).join('');
  }

  if (d.acs.length > 0) {
    listaAcs.querySelectorAll('[data-ac-edit]').forEach(el => {
      el.addEventListener('click', () => openModalAcGrade(el.dataset.acEdit));
    });
    listaAcs.querySelectorAll('[data-ac-del]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Excluir atividade?')) {
          const acDelId = el.dataset.acDel;
          d.acs = d.acs.filter(a => a.id !== acDelId);
          if (simState.disc && simState.disc[d.id] && simState.disc[d.id].acs) {
            delete simState.disc[d.id].acs[acDelId];
          }
          saveState();
          renderDetalhe();
        }
      });
    });
  }

  // AS visibility — user toggle (showAS) é a fonte de verdade pra "pré-completude".
  // asAutoTriggered já liga showAS uma vez quando todas as notas caem abaixo de 70.
  // Se AS foi lançada (oficial ou previsão), mostra sempre.
  const rowAS = document.getElementById('row-as');
  const asInfo = document.getElementById('as-info');
  const forceShow = d.showAS === true;
  if (forceShow || d.as.taken || d.as.value !== null) {
    rowAS.hidden = false;
    asInfo.style.display = 'none';
    rowAS.innerHTML = gradeDisplay(d.as, 40) + gradeActions('as');
    if (d.as.taken) {
      rowAS.innerHTML += '<div class="hint" style="margin-left:8px">Stars perdido</div>';
    }
  } else {
    rowAS.hidden = true;
    asInfo.style.display = 'block';
  }

  // Bind grade action buttons
  document.querySelectorAll('#s-detalhe [data-action="set-expectativa"], #s-detalhe [data-action="set-oficial"]').forEach(btn => {
    btn.addEventListener('click', () => openModalGrade(btn.dataset.tipo, btn.dataset.action === 'set-expectativa'));
  });
}

// ───────── RENDER: SIMULADOR ─────────

function renderSimulador() {
  const body = document.getElementById('sim-body');
  if (state.disciplinas.length === 0) {
    body.innerHTML = '<p class="hint">crie disciplinas primeiro.</p>';
    updateSimResult();
    return;
  }

  body.innerHTML = state.disciplinas.map(d => renderSimDisc(d)).join('');

  const ensureSim = (discId) => {
    if (!simState.disc) simState.disc = {};
    if (!simState.disc[discId]) simState.disc[discId] = { acs: {} };
    if (!simState.disc[discId].acs) simState.disc[discId].acs = {};
    return simState.disc[discId];
  };

  const refreshDiscScore = (discId) => {
    const d = state.disciplinas.find(x => x.id === discId);
    if (!d) return;
    const simD = simState.disc[discId] || {};
    const r = calcDisc(d, simD);
    const scoreEl = document.querySelector('.sim-disc[data-disc="' + discId + '"] .sim-disc-score');
    if (scoreEl) scoreEl.textContent = fmtNum(r.earned, 1) + '/100';
  };

  body.querySelectorAll('input[type="number"][data-disc]').forEach(inp => {
    if (inp.readOnly) return;
    inp.addEventListener('input', () => {
      const discId = inp.dataset.disc;
      const key = inp.dataset.key;
      const simD = ensureSim(discId);
      const raw = inp.value;
      const val = raw === '' ? undefined : parseFloat(raw);
      if (key.startsWith('ac_')) {
        simD.acs[key.slice(3)] = isNaN(val) ? undefined : val;
      } else if (key === 'acExtra') {
        simD.acExtra = isNaN(val) ? undefined : val;
      } else {
        simD[key] = isNaN(val) ? undefined : val;
      }
      refreshDiscScore(discId);
      updateSimResult();
    });
  });

  body.querySelectorAll('.sim-toggle[data-disc]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.classList.contains('locked')) return;
      const discId = btn.dataset.disc;
      const acId = btn.dataset.ac;
      const simD = ensureSim(discId);
      const cur = simD.acs[acId];
      let next;
      if (cur === undefined) next = true;
      else if (cur === true) next = false;
      else next = undefined;
      simD.acs[acId] = next;
      btn.className = 'sim-toggle' + (next === true ? ' on' : next === false ? ' off' : '');
      btn.textContent = next === true ? 'entregue' : next === false ? 'não entregue' : '—';
      refreshDiscScore(discId);
      updateSimResult();
    });
  });

  updateSimResult();
}

function renderSimDisc(d) {
  const simD = (simState.disc && simState.disc[d.id]) || {};
  const r = calcDisc(d, simD);
  const mode = d.acMode || 'custom';

  const field = (key, label, max, realSlot) => {
    const realVal = realSlot && realSlot.value !== null && realSlot.value !== undefined ? realSlot.value : null;
    const simVal = key.startsWith('ac_')
      ? (simD.acs && simD.acs[key.slice(3)])
      : simD[key];
    const displayVal = realVal !== null
      ? fmtNum(realVal, 1)
      : (simVal !== undefined && simVal !== null && !isNaN(simVal) ? simVal : '');
    const readonly = realVal !== null ? 'readonly' : '';
    const placeholder = realVal !== null ? fmtNum(realVal, 1) : '—';
    return '<div class="sim-field">'
      + '<label>' + label + '</label>'
      + '<input type="number" step="0.1" min="0" max="' + max + '"'
      + ' data-disc="' + d.id + '" data-key="' + key + '"'
      + ' value="' + displayVal + '"'
      + ' placeholder="' + placeholder + '"'
      + ' ' + readonly + '>'
      + '<span class="sim-max">/ ' + max + '</span>'
      + '</div>';
  };

  let acFields = '';
  let realAcDist = 0;
  if (mode === 'equal') {
    const n = d.acs.length;
    const share = n > 0 ? 20 / n : 0;
    acFields = d.acs.map(ac => {
      const real = ac.delivered;
      const locked = real === true || real === false;
      const sim = simD.acs && simD.acs[ac.id];
      let state, label;
      if (locked) {
        state = real === true ? 'on' : 'off';
        label = real === true ? 'entregue' : 'não entregue';
      } else if (sim === true) { state = 'on'; label = 'entregue'; }
      else if (sim === false) { state = 'off'; label = 'não entregue'; }
      else { state = ''; label = '—'; }
      return '<div class="sim-field sim-field-toggle">'
        + '<label>' + escapeHTML(ac.nome) + '</label>'
        + '<button type="button" class="sim-toggle ' + state + (locked ? ' locked' : '') + '"'
        + ' data-disc="' + d.id + '" data-ac="' + ac.id + '">' + label + '</button>'
        + '<span class="sim-max">' + fmtNum(share, 1) + ' pts</span>'
        + '</div>';
    }).join('');
  } else {
    acFields = d.acs.map(ac => field('ac_' + ac.id, escapeHTML(ac.nome), ac.valor, ac)).join('');
  }

  // AC restante: pts for ACs not yet created.
  // Custom: 20 - sum(valor de ACs existentes). Equal: 20 só quando não há AC nenhuma
  // (com >=1 AC no modo igual, os toggles já cobrem todo o pool).
  let restante;
  if (mode === 'equal') {
    restante = d.acs.length === 0 ? 20 : 0;
  } else {
    const acValorSum = d.acs.reduce((s, ac) => s + (ac.valor || 0), 0);
    restante = Math.max(0, 20 - acValorSum);
  }
  let restanteSection = '';
  if (restante > 0.01) {
    const simExtra = simD.acExtra !== undefined && simD.acExtra !== null && !isNaN(simD.acExtra)
      ? simD.acExtra : '';
    restanteSection = '<div class="sim-field sim-field-extra">'
      + '<label>AC restante</label>'
      + '<input type="number" step="0.5" min="0" max="' + restante.toFixed(2) + '"'
      + ' data-disc="' + d.id + '" data-key="acExtra"'
      + ' value="' + simExtra + '" placeholder="0">'
      + '<span class="sim-max">/ ' + fmtNum(restante, 1) + '</span>'
      + '</div>'
      + '<p class="sim-extra-hint">pontos de AC ainda por criar ou lançar</p>';
  }

  return '<div class="sim-disc" data-disc="' + d.id + '">'
    + '<div class="sim-disc-head">'
    + '<div class="sim-disc-nome">' + escapeHTML(d.nome) + '</div>'
    + '<div class="sim-disc-score">' + fmtNum(r.earned, 1) + '/100</div>'
    + '</div>'
    + field('ap1', 'AP1', 40, d.ap1)
    + field('ap2', 'AP2', 40, d.ap2)
    + acFields
    + restanteSection
    + '</div>';
}

function updateSimResult() {
  const p = calcPeriodo(simState);
  document.getElementById('sim-total').textContent = fmtNum(p.totalScore, 0);
  document.getElementById('sim-max').textContent = p.total || 500;
  const pct = p.total > 0 ? (p.totalScore / p.total) * 100 : 0;
  const bar = document.getElementById('sim-bar');
  bar.style.width = pct + '%';
  const hint = document.getElementById('sim-hint');

  if (p.n === 0) {
    bar.className = 'bar-fill';
    hint.textContent = 'sem disciplinas';
    return;
  }
  if (!p.starsEligible) {
    bar.className = 'bar-fill danger';
    hint.innerHTML = 'AS feita — inelegível pro Stars';
  } else if (p.totalScore >= p.starsNeeded) {
    bar.className = 'bar-fill success';
    hint.innerHTML = 'Stars garantido com <strong>' + fmtNum(p.totalScore, 0) + '</strong> pts';
  } else {
    bar.className = 'bar-fill accent';
    const falta = p.starsNeeded - p.totalScore;
    hint.innerHTML = 'faltam <strong>' + fmtNum(falta, 1) + '</strong> pts pro Stars';
  }
}

// ───────── MODAIS ─────────

function openModal(title, bodyHTML, onSave) {
  const modal = document.getElementById('modal');
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHTML;
  modal.hidden = false;

  // Replace save button to clear old listeners
  const oldSave = document.getElementById('modal-save');
  const newSave = oldSave.cloneNode(true);
  oldSave.parentNode.replaceChild(newSave, oldSave);
  newSave.addEventListener('click', () => {
    if (onSave()) modal.hidden = true;
  });

  modal.querySelectorAll('[data-close]').forEach(el => {
    el.addEventListener('click', () => { modal.hidden = true; });
  });
}

function openModalAddDisc() {
  openModal(
    'nova disciplina',
    '<label>nome'
    + '<input type="text" id="m-nome" placeholder="ex: POO" autofocus>'
    + '</label>',
    () => {
      const nome = document.getElementById('m-nome').value.trim();
      if (!nome) { alert('Nome obrigatório'); return false; }
      state.disciplinas.push({
        id: uid(),
        nome,
        ap1: { value: null, expectativa: false },
        ap2: { value: null, expectativa: false },
        as: { value: null, expectativa: false, taken: false },
        acs: [],
        acMode: 'custom',
        showAS: false
      });
      saveState();
      renderDisciplinas();
      renderHome();
      return true;
    }
  );
}

function openModalGrade(tipo, isExpectativa) {
  const d = state.disciplinas.find(x => x.id === currentDiscId);
  if (!d) return;
  const slot = d[tipo];
  const max = 40;
  const kindLabel = isExpectativa ? 'previsão' : 'oficial';
  const labels = { ap1: 'AP1', ap2: 'AP2', as: 'AS' };

  const warnMsg = (tipo === 'as' && !isExpectativa)
    ? '<p class="form-hint">Atenção: marcar AS oficial elimina sua elegibilidade ao Stars.</p>'
    : '';
  const clearBtn = (slot.value !== null && slot.value !== undefined)
    ? '<button type="button" class="btn sm danger" id="m-clear">limpar nota</button>'
    : '';

  openModal(
    kindLabel + ' · ' + labels[tipo] + ' · ' + d.nome,
    '<label>nota (0 a ' + max + ')'
    + '<input type="number" id="m-grade" step="0.1" min="0" max="' + max + '" value="' + (slot.value !== null && slot.value !== undefined ? slot.value : '') + '" autofocus>'
    + '</label>'
    + warnMsg
    + clearBtn,
    () => {
      const v = parseFloat(document.getElementById('m-grade').value);
      if (isNaN(v) || v < 0 || v > max) {
        alert('Nota inválida. Entre 0 e ' + max);
        return false;
      }
      slot.value = v;
      slot.expectativa = isExpectativa;
      if (tipo === 'as') slot.taken = !isExpectativa;
      pushRecente({
        discId: d.id,
        discNome: d.nome,
        tipo,
        label: labels[tipo],
        valor: v,
        max,
        kind: isExpectativa ? 'expectativa' : 'oficial'
      });
      saveState();
      renderDetalhe();
      return true;
    }
  );

  const clearEl = document.getElementById('m-clear');
  if (clearEl) clearEl.addEventListener('click', () => {
    slot.value = null;
    slot.expectativa = false;
    if (tipo === 'as') slot.taken = false;
    saveState();
    document.getElementById('modal').hidden = true;
    renderDetalhe();
  });
}

function setAcMode(mode) {
  const d = state.disciplinas.find(x => x.id === currentDiscId);
  if (!d) return;
  const current = d.acMode || 'custom';
  if (current === mode) return;

  if (mode === 'equal') {
    d.acs.forEach(ac => {
      if (ac.delivered === undefined) ac.delivered = null;
    });
  } else {
    const n = d.acs.length;
    const share = n > 0 ? 20 / n : 0;
    d.acs.forEach(ac => {
      if (!ac.valor || ac.valor <= 0) ac.valor = share;
    });
  }
  d.acMode = mode;
  saveState();
  renderDetalhe();
}

function openModalAcGrade(acId) {
  const d = state.disciplinas.find(x => x.id === currentDiscId);
  if (!d) return;
  const ac = d.acs.find(a => a.id === acId);
  if (!ac) return;

  const mode = d.acMode || 'custom';
  if (mode === 'equal') {
    const share = d.acs.length > 0 ? 20 / d.acs.length : 0;
    const clearBtn = (ac.delivered === true || ac.delivered === false)
      ? '<button type="button" class="btn sm danger" id="m-clear">limpar status</button>'
      : '';
    openModal(
      'entrega · ' + ac.nome,
      '<p class="form-hint">essa atividade vale ' + fmtNum(share, 1) + ' pts (split igual entre ' + d.acs.length + ').</p>'
      + '<div class="radio-group" id="m-deliv">'
      + '<label class="' + (ac.delivered === true ? 'selected' : '') + '"><input type="radio" name="deliv" value="yes" ' + (ac.delivered === true ? 'checked' : '') + '>entregue</label>'
      + '<label class="' + (ac.delivered === false ? 'selected' : '') + '"><input type="radio" name="deliv" value="no" ' + (ac.delivered === false ? 'checked' : '') + '>não entregue</label>'
      + '</div>'
      + clearBtn,
      () => {
        const checked = document.querySelector('input[name="deliv"]:checked');
        if (!checked) { alert('Escolha entregue ou não entregue'); return false; }
        ac.delivered = checked.value === 'yes';
        ac.value = null;
        ac.expectativa = false;
        pushRecente({
          discId: d.id,
          discNome: d.nome,
          tipo: 'ac',
          label: 'AC · ' + ac.nome,
          valor: ac.delivered ? share : 0,
          max: share,
          kind: 'oficial'
        });
        saveState();
        renderDetalhe();
        return true;
      }
    );
    document.querySelectorAll('#m-deliv label').forEach(lbl => {
      lbl.addEventListener('click', () => {
        document.querySelectorAll('#m-deliv label').forEach(l => l.classList.remove('selected'));
        lbl.classList.add('selected');
      });
    });
    const clearElEq = document.getElementById('m-clear');
    if (clearElEq) clearElEq.addEventListener('click', () => {
      ac.delivered = null;
      saveState();
      document.getElementById('modal').hidden = true;
      renderDetalhe();
    });
    return;
  }

  const clearBtn = (ac.value !== null && ac.value !== undefined)
    ? '<button type="button" class="btn sm danger" id="m-clear">limpar nota</button>'
    : '';

  openModal(
    'lançar · ' + ac.nome,
    '<label>nota (0 a ' + ac.valor + ')'
    + '<input type="number" id="m-grade" step="0.1" min="0" max="' + ac.valor + '" value="' + (ac.value !== null && ac.value !== undefined ? ac.value : '') + '" autofocus>'
    + '</label>'
    + '<div class="radio-group" id="m-kind">'
    + '<label class="' + (!ac.expectativa ? 'selected' : '') + '"><input type="radio" name="kind" value="oficial" ' + (!ac.expectativa ? 'checked' : '') + '>oficial</label>'
    + '<label class="' + (ac.expectativa ? 'selected' : '') + '"><input type="radio" name="kind" value="expectativa" ' + (ac.expectativa ? 'checked' : '') + '>previsão</label>'
    + '</div>'
    + clearBtn,
    () => {
      const v = parseFloat(document.getElementById('m-grade').value);
      if (isNaN(v) || v < 0 || v > ac.valor) {
        alert('Nota inválida.');
        return false;
      }
      const checked = document.querySelector('input[name="kind"]:checked');
      const kind = checked ? checked.value : 'oficial';
      ac.value = v;
      ac.expectativa = kind === 'expectativa';
      pushRecente({
        discId: d.id,
        discNome: d.nome,
        tipo: 'ac',
        label: 'AC · ' + ac.nome,
        valor: v,
        max: ac.valor,
        kind
      });
      saveState();
      renderDetalhe();
      return true;
    }
  );

  document.querySelectorAll('#m-kind label').forEach(lbl => {
    lbl.addEventListener('click', () => {
      document.querySelectorAll('#m-kind label').forEach(l => l.classList.remove('selected'));
      lbl.classList.add('selected');
    });
  });

  const clearEl = document.getElementById('m-clear');
  if (clearEl) clearEl.addEventListener('click', () => {
    ac.value = null;
    ac.expectativa = false;
    saveState();
    document.getElementById('modal').hidden = true;
    renderDetalhe();
  });
}

function openModalAddAc() {
  const d = state.disciplinas.find(x => x.id === currentDiscId);
  if (!d) return;
  const mode = d.acMode || 'custom';

  if (mode === 'equal') {
    const nAfter = d.acs.length + 1;
    const shareAfter = 20 / nAfter;
    openModal(
      'nova atividade (AC)',
      '<label>nome'
      + '<input type="text" id="m-nome" placeholder="ex: lista 1" autofocus>'
      + '</label>'
      + '<p class="form-hint">split igual: depois de adicionar, cada uma vale ' + fmtNum(shareAfter, 1) + ' pts (' + nAfter + ' atividades).</p>',
      () => {
        const nome = document.getElementById('m-nome').value.trim();
        if (!nome) { alert('Nome obrigatório'); return false; }
        d.acs.push({ id: uid(), nome, valor: 0, value: null, expectativa: false, delivered: null });
        saveState();
        renderDetalhe();
        return true;
      }
    );
    return;
  }

  const usado = d.acs.reduce((s, a) => s + a.valor, 0);
  const restante = Math.max(0, 20 - usado);

  openModal(
    'nova atividade (AC)',
    '<label>nome'
    + '<input type="text" id="m-nome" placeholder="ex: lista 1" autofocus>'
    + '</label>'
    + '<label>valor máximo (pontos)'
    + '<input type="number" id="m-valor" step="0.5" min="0" max="20" placeholder="' + (restante || '—') + '">'
    + '</label>'
    + '<p class="form-hint">restam ' + fmtNum(restante, 1) + ' pts do pool de 20 de AC.</p>',
    () => {
      const nome = document.getElementById('m-nome').value.trim();
      const valor = parseFloat(document.getElementById('m-valor').value);
      if (!nome) { alert('Nome obrigatório'); return false; }
      if (isNaN(valor) || valor <= 0) { alert('Valor inválido'); return false; }
      if (valor > restante + 0.0001) {
        alert('Valor excede o restante do pool de AC (' + fmtNum(restante, 1) + ' pts).');
        return false;
      }
      d.acs.push({ id: uid(), nome, valor, value: null, expectativa: false, delivered: null });
      saveState();
      renderDetalhe();
      return true;
    }
  );
}

function openModalTP() {
  openModal(
    'teste de progresso',
    '<label>nota bruta (0 a 1)'
    + '<input type="number" id="m-grade" step="0.001" min="0" max="1" value="' + (state.tp.value !== null && state.tp.value !== undefined ? state.tp.value : '') + '" placeholder="ex: 0.698" autofocus>'
    + '</label>'
    + '<p class="form-hint">bônus = round(nota × 10) pontos, aplicado numa disciplina.</p>'
    + '<label>disciplina alvo'
    + '<select id="m-disc">'
    + '<option value="">— nenhuma —</option>'
    + state.disciplinas.map(d =>
        '<option value="' + d.id + '" ' + (state.tp.applyTo === d.id ? 'selected' : '') + '>' + escapeHTML(d.nome) + '</option>'
      ).join('')
    + '</select>'
    + '</label>'
    + '<div class="radio-group" id="m-kind">'
    + '<label class="' + (!state.tp.expectativa ? 'selected' : '') + '"><input type="radio" name="kind" value="oficial" ' + (!state.tp.expectativa ? 'checked' : '') + '>oficial</label>'
    + '<label class="' + (state.tp.expectativa ? 'selected' : '') + '"><input type="radio" name="kind" value="expectativa" ' + (state.tp.expectativa ? 'checked' : '') + '>previsão</label>'
    + '</div>'
    + ((state.tp.value !== null && state.tp.value !== undefined) ? '<button type="button" class="btn sm danger" id="m-clear">limpar TP</button>' : ''),
    () => {
      const raw = document.getElementById('m-grade').value;
      if (raw === '') { alert('Nota obrigatória'); return false; }
      const v = parseFloat(raw);
      if (isNaN(v) || v < 0 || v > 1) { alert('Nota deve ser entre 0 e 1'); return false; }
      const applyTo = document.getElementById('m-disc').value || null;
      const checked = document.querySelector('input[name="kind"]:checked');
      const kind = checked ? checked.value : 'oficial';
      state.tp.value = v;
      state.tp.applyTo = applyTo;
      state.tp.expectativa = kind === 'expectativa';
      const disc = state.disciplinas.find(d => d.id === applyTo);
      pushRecente({
        discId: applyTo,
        discNome: disc ? disc.nome : '—',
        tipo: 'tp',
        label: 'TP (+' + Math.round(v * 10) + ' pts)',
        valor: v,
        max: 1,
        kind
      });
      saveState();
      renderHome();
      return true;
    }
  );

  document.querySelectorAll('#m-kind label').forEach(lbl => {
    lbl.addEventListener('click', () => {
      document.querySelectorAll('#m-kind label').forEach(l => l.classList.remove('selected'));
      lbl.classList.add('selected');
    });
  });

  const clearEl = document.getElementById('m-clear');
  if (clearEl) clearEl.addEventListener('click', () => {
    state.tp = { value: null, expectativa: false, applyTo: null };
    saveState();
    document.getElementById('modal').hidden = true;
    renderHome();
  });
}

// ───────── BINDINGS ─────────

document.querySelectorAll('[data-goto]').forEach(el => {
  el.addEventListener('click', () => goto(el.dataset.goto));
});

document.getElementById('btn-add-disc').addEventListener('click', openModalAddDisc);

document.getElementById('btn-reset-periodo').addEventListener('click', () => {
  if (!confirm('Resetar o período? Isso apaga TODAS as disciplinas, notas, TP e histórico. (1/3)')) return;
  if (!confirm('Tem certeza? Esta ação é irreversível — nada pode ser recuperado. (2/3)')) return;
  if (!confirm('Última chance. Confirmar apagar tudo? (3/3)')) return;
  state = migrateState({
    v: 2,
    disciplinas: [],
    tp: { value: null, expectativa: false, applyTo: null },
    recentes: [],
    gender: state.gender,
    foco: state.foco
  });
  saveState();
  simState = {};
  currentDiscId = null;
  renderDisciplinas();
  renderHome();
  renderConfig();
});
document.getElementById('btn-edit-tp').addEventListener('click', openModalTP);
document.getElementById('btn-add-ac').addEventListener('click', openModalAddAc);

document.getElementById('btn-del-disc').addEventListener('click', () => {
  const d = state.disciplinas.find(x => x.id === currentDiscId);
  if (!d) return;
  if (confirm('Excluir "' + d.nome + '" e todas as suas notas?')) {
    state.disciplinas = state.disciplinas.filter(x => x.id !== currentDiscId);
    if (state.tp.applyTo === currentDiscId) state.tp.applyTo = null;
    state.recentes = state.recentes.filter(r => r.discId !== currentDiscId);
    if (simState.disc) delete simState.disc[currentDiscId];
    currentDiscId = null;
    saveState();
    goto('s-disciplinas');
  }
});

document.getElementById('btn-reset-sim').addEventListener('click', () => {
  simState = {};
  renderSimulador();
});

document.getElementById('btn-fill-max-sim').addEventListener('click', () => {
  simState = { disc: {} };
  state.disciplinas.forEach(d => {
    const o = { acs: {} };
    if (d.ap1.value === null || d.ap1.value === undefined) o.ap1 = 40;
    if (d.ap2.value === null || d.ap2.value === undefined) o.ap2 = 40;
    const mode = d.acMode || 'custom';
    let restante;
    if (mode === 'equal') {
      d.acs.forEach(ac => {
        if (ac.delivered !== true && ac.delivered !== false) o.acs[ac.id] = true;
      });
      restante = d.acs.length === 0 ? 20 : 0;
    } else {
      d.acs.forEach(ac => {
        if (ac.value === null || ac.value === undefined) o.acs[ac.id] = ac.valor;
      });
      const acValorSum = d.acs.reduce((s, ac) => s + (ac.valor || 0), 0);
      restante = Math.max(0, 20 - acValorSum);
    }
    if (restante > 0.01) o.acExtra = restante;
    simState.disc[d.id] = o;
  });
  renderSimulador();
});

// Header saudação + meta date
document.getElementById('hdr-tagline').textContent = getSaudacao(state.gender);
document.getElementById('hdr-meta').textContent =
  new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

// ───────── CONFIG BINDINGS ─────────
// Event delegation on #s-config: more robust than per-button bindings
// (sobrevive a re-render, iOS quirks, e cliques em children).

document.getElementById('s-config').addEventListener('click', (e) => {
  const seg = e.target.closest('#pref-gender .cfg-seg');
  if (seg) {
    state.gender = seg.dataset.value;
    saveState();
    document.getElementById('hdr-tagline').textContent = getSaudacao(state.gender);
    renderConfig();
    return;
  }
  const opt = e.target.closest('#pref-foco .cfg-opt');
  if (opt) {
    state.foco = opt.dataset.value;
    simState = {};
    saveState();
    renderConfig();
    renderHome();
    return;
  }
});

// ───────── SYNC BINDINGS ─────────

document.getElementById('btn-sync-generate').addEventListener('click', () => {
  const code = generateSyncCode();
  if (!confirm('Seu código de sync:\n\n' + code + '\n\nDigite esse código no outro dispositivo pra conectar. Continuar?')) return;
  connectSync(code);
});

document.getElementById('btn-sync-enter').addEventListener('click', () => {
  const raw = prompt('Digite o código de sync (ex: ABC-123):');
  if (!raw) return;
  const clean = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (clean.length !== 6) {
    alert('Código inválido. Use 6 caracteres (ex: ABC-123).');
    return;
  }
  connectSync(clean);
});

document.getElementById('btn-sync-disconnect').addEventListener('click', () => {
  if (!confirm('Desconectar sync? Os dados locais continuam salvos.')) return;
  disconnectSync();
});

// Export / Import
document.getElementById('btn-export').addEventListener('click', () => {
  try {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ymd = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = 'cr9-' + ymd + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e) {
    alert('Falha ao exportar: ' + (e && e.message ? e.message : e));
  }
});

document.getElementById('btn-import').addEventListener('click', () => {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'application/json,.json';
  inp.onchange = () => {
    const file = inp.files && inp.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || typeof parsed !== 'object'
            || !Array.isArray(parsed.disciplinas)
            || !parsed.tp || typeof parsed.tp !== 'object') {
          alert('Arquivo inválido: faltam disciplinas ou tp.');
          return;
        }
        if (!confirm('Substituir o estado atual pelo conteúdo do arquivo? Esta ação não pode ser desfeita.')) return;
        state = migrateState(parsed);
        currentDiscId = null;
        simState = {};
        saveState();
        renderConfig();
        renderDisciplinas();
        renderHome();
        alert('Importado com sucesso.');
      } catch (e) {
        alert('Falha ao importar: ' + (e && e.message ? e.message : e));
      }
    };
    reader.onerror = () => alert('Erro ao ler arquivo.');
    reader.readAsText(file);
  };
  inp.click();
});

// Registro + Tracking: TP buttons reuse TP modal
const btnTpReg = document.getElementById('btn-edit-tp-reg');
if (btnTpReg) btnTpReg.addEventListener('click', openModalTP);
const btnTpTrack = document.getElementById('btn-edit-tp-track');
if (btnTpTrack) btnTpTrack.addEventListener('click', openModalTP);

// ───────── SERVICE WORKER ─────────

if ('serviceWorker' in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => {
      // Check for updates on every load + every 30min while app stays open.
      reg.update().catch(() => {});
      setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
    }).catch(() => {});
  });
}

// ───────── INIT ─────────

initFirebase();
const savedSyncCode = localStorage.getItem(SYNC_KEY);
if (savedSyncCode) connectSync(savedSyncCode);

renderHome();
