'use strict';

const KEY = 'cr9-v1';
const MAX_RECENTES = 12;
const MAX_LANCAMENTOS = 500;
// Bumpar junto com CACHE_NAME do sw.js a cada deploy.
const APP_VERSION = 'v20';

// Regras Ibmec/Stars: disciplina vale 100 pts. Estrutura padrão AP1(40) +
// AP2(40) + pool de AC(20), mas cada disciplina pode ter a sua (ex.: AT 60 +
// 2 AC de 20). Aprovação aos 70% do total; Stars = média 9,0 (90% do total)
// com ≥4 disciplinas. Bônus (TP e pontos extras) somam na nota com teto de
// 100. Displays de estado vazio assumem 5 disciplinas (450/500).
const AP_MAX = 40;
const AC_POOL = 20;
const DISC_TOTAL = 100;
const APROV_FRAC = 0.7;
const STARS_FRAC = 0.9;
const STARS_POR_DISC = 90;
const STARS_MIN_DISC = 4;
const EMPTY_STARS_DEN = 5 * STARS_POR_DISC;
const EMPTY_TOTAL_DEN = 5 * DISC_TOTAL;

// Estruturas prontas no modal de disciplina (tudo editável depois).
const PRESETS = {
  padrao: { label: 'padrão · AP1 + AP2 + ACs', provas: [['AP1', 40], ['AP2', 40]], acPool: 20, nAcs: 0, temAS: true },
  livre: { label: 'do zero', provas: [], acPool: 0, nAcs: 0, temAS: false }
};

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

// ───────── PERÍODOS (schema v3) ─────────

function defaultPeriodoNome(ts) {
  const d = ts ? new Date(ts) : new Date();
  return d.getFullYear() + '.' + (d.getMonth() < 6 ? 1 : 2);
}

function novoPeriodo(nome) {
  return {
    id: 'per-' + uid(),
    nome: nome || defaultPeriodoNome(),
    status: 'ativo',
    criadoEm: Date.now(),
    arquivadoEm: null,
    disciplinas: [],
    tp: { value: null, expectativa: false, applyTo: null },
    recentes: [],
    lancamentos: []
  };
}

// Backfill best-effort da série temporal a partir dos recentes v2 (máx 12).
function seedLancamentosFromRecentes(recentes) {
  if (!Array.isArray(recentes)) return [];
  return recentes.slice().reverse()
    .filter(r => r && typeof r.valor === 'number')
    .map(r => ({
      ts: r.ts || Date.now(),
      discId: r.discId || null,
      slot: r.tipo === 'ac' ? 'ac:' + (r.acId || r.label || '') : (r.tipo || 'ap1'),
      valor: r.valor,
      max: typeof r.max === 'number' ? r.max : null,
      kind: r.kind === 'expectativa' ? 'expectativa' : 'oficial',
      seeded: true
    }));
}

function migrateState(s) {
  if (!s || typeof s !== 'object') return s;

  if (!Array.isArray(s.periodos)) {
    // v1/v2 → v3: o estado atual vira o primeiro período, arrays POR REFERÊNCIA
    // (nenhuma disciplina/nota é reconstruída — perda zero).
    const recentes = Array.isArray(s.recentes) ? s.recentes : [];
    const tsAntigo = recentes.length ? recentes[recentes.length - 1].ts : null;
    const p = {
      id: 'per-' + uid(),
      nome: defaultPeriodoNome(tsAntigo),
      status: 'ativo',
      criadoEm: tsAntigo || Date.now(),
      arquivadoEm: null,
      disciplinas: Array.isArray(s.disciplinas) ? s.disciplinas : [],
      tp: (s.tp && typeof s.tp === 'object') ? s.tp : { value: null, expectativa: false, applyTo: null },
      recentes,
      lancamentos: seedLancamentosFromRecentes(recentes)
    };
    s = {
      v: 3,
      gender: s.gender !== undefined ? s.gender : null,
      foco: s.foco !== undefined ? s.foco : null,
      periodoAtivoId: p.id,
      periodos: [p]
    };
  }

  // sombras do shape antigo não coexistem com o v3
  delete s.disciplinas; delete s.tp; delete s.recentes; delete s.lancamentos;

  if (s.gender === undefined) s.gender = null;
  if (s.foco === undefined) s.foco = null;

  s.periodos = s.periodos.filter(p => p && typeof p === 'object');
  s.periodos.forEach(p => {
    if (!p.id) p.id = 'per-' + uid();
    if (typeof p.nome !== 'string' || !p.nome) p.nome = defaultPeriodoNome(p.criadoEm);
    if (!p.criadoEm) p.criadoEm = Date.now();
    if (p.arquivadoEm === undefined) p.arquivadoEm = null;
    if (!Array.isArray(p.disciplinas)) p.disciplinas = [];
    if (!p.tp || typeof p.tp !== 'object') p.tp = { value: null, expectativa: false, applyTo: null };
    if (!Array.isArray(p.recentes)) p.recentes = [];
    if (!Array.isArray(p.lancamentos)) p.lancamentos = [];

    // Saneamento campo a campo por disciplina: import/JSON malformado não pode
    // persistir um estado que crashe o render (era o bug que bricava o app).
    p.disciplinas = p.disciplinas.filter(d => d && typeof d === 'object');
    p.disciplinas.forEach(d => {
      if (!d.id) d.id = uid();
      if (typeof d.nome !== 'string' || !d.nome) d.nome = 'sem nome';
      // v3→v4: AP1/AP2 fixos viram a lista `provas`, com os mesmos ids
      // ('ap1','ap2') pra série de lançamentos continuar casando.
      if (!Array.isArray(d.provas)) {
        d.provas = [['ap1', 'AP1'], ['ap2', 'AP2']].map(([k, nome]) => {
          const src = d[k] && typeof d[k] === 'object' ? d[k] : {};
          return {
            id: k, nome, max: AP_MAX,
            value: typeof src.value === 'number' ? src.value : null,
            expectativa: src.expectativa === true
          };
        });
      }
      delete d.ap1; delete d.ap2;
      d.provas = d.provas.filter(pv => pv && typeof pv === 'object');
      d.provas.forEach(pv => {
        if (!pv.id) pv.id = 'pv-' + uid();
        if (typeof pv.nome !== 'string' || !pv.nome) pv.nome = 'Avaliação';
        if (typeof pv.max !== 'number' || !(pv.max > 0)) pv.max = AP_MAX;
        if (typeof pv.value !== 'number') pv.value = null;
        pv.expectativa = pv.expectativa === true;
      });
      if (typeof d.acPool !== 'number' || !(d.acPool >= 0)) d.acPool = AC_POOL;
      if (!Array.isArray(d.extras)) d.extras = [];
      d.extras = d.extras.filter(ex => ex && typeof ex === 'object');
      d.extras.forEach(ex => {
        if (!ex.id) ex.id = 'ex-' + uid();
        if (typeof ex.nome !== 'string' || !ex.nome) ex.nome = 'extra';
        if (typeof ex.value !== 'number') ex.value = null;
        ex.expectativa = ex.expectativa === true;
      });
      if (!d.as || typeof d.as !== 'object') d.as = { value: null, expectativa: false, taken: false };
      if (d.as.value === undefined || (d.as.value !== null && typeof d.as.value !== 'number')) d.as.value = null;
      if (d.as.taken === undefined) d.as.taken = false;
      if (d.acMode !== 'equal' && d.acMode !== 'custom') d.acMode = 'custom';
      if (!Array.isArray(d.acs)) d.acs = [];
      d.acs = d.acs.filter(ac => ac && typeof ac === 'object');
      d.acs.forEach(ac => { if (!ac.id) ac.id = uid(); });
      if (d.showAS === undefined) d.showAS = false;
      if (typeof d.temAS !== 'boolean') d.temAS = true;
      if (d.asAutoTriggered === undefined) d.asAutoTriggered = false;
    });

    const discIds = new Set(p.disciplinas.map(d => d.id));
    if (p.tp.applyTo && !discIds.has(p.tp.applyTo)) p.tp.applyTo = null;
    p.recentes = p.recentes.filter(r => r && (r.discId == null || discIds.has(r.discId)));
    // lancamentos é log histórico: não filtra por disciplina viva (o leitor filtra).
  });

  if (s.periodos.length === 0) s.periodos.push(novoPeriodo());

  // Invariante: exatamente UM período ativo, coerente com periodoAtivoId.
  const ativo = s.periodos.find(p => p.id === s.periodoAtivoId && p.status === 'ativo')
    || s.periodos.find(p => p.status === 'ativo')
    || s.periodos[s.periodos.length - 1];
  s.periodos.forEach(p => {
    p.status = (p === ativo) ? 'ativo' : 'arquivado';
    if (p.status === 'arquivado' && !p.arquivadoEm) p.arquivadoEm = Date.now();
  });
  if (ativo.status === 'ativo') ativo.arquivadoEm = null;
  s.periodoAtivoId = ativo.id;

  s.v = 4;
  return s;
}

function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        // Seguro de vida one-time: guarda o raw pré-v3 antes da primeira migração.
        if (!Array.isArray(parsed.periodos) && !localStorage.getItem('cr9-v2-backup')) {
          try { localStorage.setItem('cr9-v2-backup', raw); } catch (e) {}
        }
        // Idem pra v3→v4 (AP1/AP2 fixos viram `provas`).
        if (Array.isArray(parsed.periodos) && parsed.v !== 4 && !localStorage.getItem('cr9-v3-backup')) {
          try { localStorage.setItem('cr9-v3-backup', raw); } catch (e) {}
        }
        return migrateState(parsed);
      }
    }
  } catch (e) {}
  return migrateState({ v: 4, gender: null, foco: null, periodoAtivoId: null, periodos: [] });
}

function saveState() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    alert('Falha ao salvar os dados (armazenamento cheio ou indisponível).');
  }
}

// Período ativo — todo o app lê/escreve os dados correntes através daqui.
function per() {
  let p = state.periodos.find(x => x.id === state.periodoAtivoId);
  if (!p) {
    p = state.periodos[state.periodos.length - 1];
    state.periodoAtivoId = p.id;
  }
  return p;
}

// Série temporal append-only do período (fonte de tendência/forma/progressão).
function pushLancamento(entry) {
  const p = per();
  p.lancamentos.push({
    ts: Date.now(),
    discId: entry.discId || null,
    slot: entry.tipo === 'ac' ? 'ac:' + (entry.acId || entry.label || '')
      : entry.tipo === 'extra' ? 'ex:' + entry.exId
      : entry.tipo,
    valor: entry.valor,
    max: typeof entry.max === 'number' ? entry.max : null,
    kind: entry.kind === 'expectativa' ? 'expectativa' : 'oficial'
  });
  if (p.lancamentos.length > MAX_LANCAMENTOS) {
    p.lancamentos.splice(0, p.lancamentos.length - MAX_LANCAMENTOS);
  }
}

function pushRecente(entry) {
  per().recentes.unshift({ ts: Date.now(), ...entry });
  if (per().recentes.length > MAX_RECENTES) per().recentes.length = MAX_RECENTES;
  pushLancamento(entry);
}

let state = loadState();
saveState(); // persiste a migração de schema já no boot (backups em cr9-v2-backup/cr9-v3-backup)
let simState = {};
let currentDiscId = null;

// ───────── CÁLCULOS ─────────

const hasVal = v => v !== null && v !== undefined && !isNaN(v);

function discTotal(d) {
  return d.provas.reduce((s, pv) => s + (pv.max || 0), 0) + (d.acPool || 0);
}

// AS é lançada na escala da maior avaliação (40 no padrão, 60 numa AT de 60).
// 0 = disciplina sem AS (escolha na estrutura): some da tela e do cálculo.
function asMaxDisc(d) {
  if (d.temAS === false) return 0;
  return d.provas.reduce((m, pv) => Math.max(m, pv.max || 0), 0);
}

// Bônus bruto do TP pra disciplina (antes do teto de 100).
function tpRaw(d, tp) {
  return tp && hasVal(tp.value) && tp.applyTo === d.id ? Math.round(tp.value * 10) : 0;
}

// Nota da disciplina. `earned` JÁ inclui TP e pontos extras, com teto no total
// da disciplina: é o número que aparece em toda tela. `earnedBase` é só o que
// veio das avaliações (base do aproveitamento e do modelo estatístico).
// ov = overrides do simulador: { provas: {id: v}, asValue, asTaken, acs, acExtra, tp }.
function calcDisc(d, ov = {}, periodo = per()) {
  const total = discTotal(d);
  const ovp = ov.provas || {};
  const vals = d.provas.map(pv => {
    const v = ovp[pv.id] !== undefined ? ovp[pv.id] : pv.value;
    return hasVal(v) ? v : null;
  });
  const asTaken = ov.asTaken !== undefined ? ov.asTaken : d.as.taken;
  // AS entra no cálculo sempre que existe (previsão ou oficial); só a oficial
  // (`taken`) elimina do Stars.
  const asv = ov.asValue !== undefined ? ov.asValue : d.as.value;

  // AS preenche a primeira avaliação vazia; sem vazia, substitui a de menor
  // fração se for melhor. No padrão (AP 40/40) é exatamente a regra antiga.
  const finais = vals.slice();
  const asM = asMaxDisc(d);
  if (hasVal(asv) && asM > 0 && finais.length) {
    const frac = asv / asM;
    const iVazia = finais.indexOf(null);
    if (iVazia >= 0) {
      finais[iVazia] = frac * d.provas[iVazia].max;
    } else {
      let iMin = 0;
      for (let i = 1; i < finais.length; i++) {
        if (finais[i] / d.provas[i].max < finais[iMin] / d.provas[iMin].max) iMin = i;
      }
      finais[iMin] = Math.max(finais[iMin], frac * d.provas[iMin].max);
    }
  }

  let provaEarned = 0, provaDist = 0;
  finais.forEach((v, i) => {
    if (v === null) return;
    provaEarned += v;
    provaDist += d.provas[i].max;
  });

  const pool = d.acPool || 0;
  const acMode = d.acMode || 'custom';
  let acEarned = 0, acDist = 0;
  if (acMode === 'equal') {
    const share = d.acs.length > 0 ? pool / d.acs.length : 0;
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
      if (hasVal(v)) {
        acEarned += v;
        acDist += ac.valor;
      }
    });
  }

  // Sim-only: "AC restante" hipotética (pontos de AC ainda não criadas).
  if (hasVal(ov.acExtra)) {
    acEarned += ov.acExtra;
    acDist += ov.acExtra;
  }

  const earnedBase = provaEarned + acEarned;
  const dist = provaDist + acDist;

  const tp = ov.tp !== undefined ? ov.tp : periodo.tp;
  const tpB = tpRaw(d, tp);
  const exList = ov.extras || d.extras || [];
  const exB = exList.reduce((s, ex) => s + (hasVal(ex.value) ? ex.value : 0), 0);
  const earned = Math.min(total, earnedBase + tpB + exB);
  const bonus = Math.max(0, earned - earnedBase);
  const tpBonus = Math.min(tpB, bonus);

  return {
    earned,
    earnedBase,
    dist,
    total,
    bonus,
    tpBonus,
    extrasBonus: bonus - tpBonus,
    bonusRaw: tpB + exB,
    // hasAS = AS OFICIAL (taken). Previsão não elimina do Stars.
    hasAS: asM > 0 && asTaken === true && hasVal(asv),
    provasF: finais
  };
}

// Mesma conta só com o que é OFICIAL: previsões de avaliação, AC, extra e TP
// ficam de fora. É o gate do "garantido".
function calcDiscOficialOnly(d, periodo = per()) {
  const limpa = slot => slot.expectativa ? { ...slot, value: null } : slot;
  const dummy = {
    ...d,
    provas: d.provas.map(limpa),
    as: d.as.expectativa ? { value: null, expectativa: false, taken: d.as.taken } : d.as,
    acs: d.acs.map(ac => (d.acMode !== 'equal' && ac.expectativa) ? { ...ac, value: null } : ac),
    extras: (d.extras || []).map(limpa)
  };
  const tp = periodo.tp && !periodo.tp.expectativa ? periodo.tp : null;
  return calcDisc(dummy, { tp }, periodo);
}

function calcPeriodo(sim = {}, periodo = per()) {
  const n = periodo.disciplinas.length;
  let total = 0, earnedReg = 0, earnedBase = 0, distReg = 0;
  let tpBonus = 0, bonusReg = 0, earnedOficial = 0, anyAS = false;

  periodo.disciplinas.forEach(d => {
    const simD = Object.assign({}, (sim.disc && sim.disc[d.id]) || {});
    if (sim.tp !== undefined) simD.tp = sim.tp;
    const r = calcDisc(d, simD, periodo);
    total += r.total;
    earnedReg += r.earned;
    earnedBase += r.earnedBase;
    distReg += r.dist;
    tpBonus += r.tpBonus;
    bonusReg += r.bonus;
    if (r.hasAS) anyAS = true;
    earnedOficial += calcDiscOficialOnly(d, periodo).earned;
  });

  const starsNeeded = Math.round(total * STARS_FRAC * 100) / 100;
  // Aproveitamento = desempenho nas avaliações (sem bônus). Os pontos
  // (earnedReg/totalScore) é que carregam TP e extras.
  const aprov = distReg > 0 ? (earnedBase / distReg) * 100 : null;
  const totalScore = earnedReg;
  const enrolledOk = n >= STARS_MIN_DISC;
  const starsEligible = !anyAS && enrolledOk;
  const starsProgress = starsNeeded > 0 ? Math.min(totalScore / starsNeeded, 1) * 100 : 0;

  return {
    n, total, starsNeeded,
    earnedReg, earnedBase, distReg,
    tpBonus, bonusReg, totalScore, totalOficial: earnedOficial,
    aprov, anyAS, enrolledOk,
    starsEligible, starsProgress
  };
}

// Slots de pontuação ainda não lançados, por disciplina, tipados pro modelo:
// 'prova' (avaliação), 'ac' (AC com nota ou pool ainda não criado), 'bin'
// (AC por entrega, split igual). Invariante: Σ max === total − distReg.
function slotsDisc(d, periodo = per()) {
  const slots = [];
  const r = calcDisc(d, {}, periodo);
  r.provasF.forEach((v, i) => {
    if (v === null) slots.push({ type: 'prova', max: d.provas[i].max });
  });
  const pool = d.acPool || 0;
  if ((d.acMode || 'custom') === 'equal') {
    if (d.acs.length === 0) {
      if (pool > 0.01) slots.push({ type: 'ac', max: pool });
    } else {
      const share = pool / d.acs.length;
      d.acs.forEach(ac => {
        if (ac.delivered !== true && ac.delivered !== false) slots.push({ type: 'bin', max: share });
      });
    }
  } else {
    d.acs.forEach(ac => {
      if (!hasVal(ac.value)) slots.push({ type: 'ac', max: ac.valor });
    });
    const resto = pool - d.acs.reduce((s, ac) => s + (ac.valor || 0), 0);
    if (resto > 0.01) slots.push({ type: 'ac', max: resto });
  }
  return slots;
}

function remainingSlots(periodo = per()) {
  return periodo.disciplinas.reduce((all, d) => all.concat(slotsDisc(d, periodo)), []);
}

// ───────── ANALYTICS (série de lançamentos) ─────────

// Série de RENDIMENTO por lançamento: dedupe por (discId, slot) mantendo o
// último evento (edição substitui), TP fora (escala 0–1 distorce), disciplina
// deletada fora. Retorna [{ts, y}] com y = valor/max em [0,1], ordem cronológica.
function serieRendimento(periodo, opts = {}) {
  const oficialOnly = opts.oficialOnly !== false;
  const vivos = new Set(periodo.disciplinas.map(d => d.id));
  const porSlot = new Map();
  (periodo.lancamentos || []).forEach(l => {
    if (!l || l.slot === 'tp') return;
    if (typeof l.valor !== 'number' || typeof l.max !== 'number' || l.max <= 0) return;
    if (!l.discId || !vivos.has(l.discId)) return;
    if (opts.discId && l.discId !== opts.discId) return;
    if (oficialOnly && l.kind === 'expectativa') return;
    porSlot.set(l.discId + '|' + l.slot, l); // array é cronológico: último vence
  });
  return Array.from(porSlot.values())
    .sort((a, b) => a.ts - b.ts)
    .map(l => ({ ts: l.ts, y: l.valor / l.max }));
}

// Série de PONTOS reais (pra timeline/progressão): mesmo dedupe, mas em pontos
// absolutos; TP entra pelo bônus (round(v×10)), não pela nota bruta 0–1.
function seriePontos(periodo) {
  const vivos = new Set(periodo.disciplinas.map(d => d.id));
  const porSlot = new Map();
  (periodo.lancamentos || []).forEach(l => {
    if (!l || typeof l.valor !== 'number') return;
    if (l.slot === 'tp') { porSlot.set('tp', l); return; } // TP é único no período
    if (!l.discId || !vivos.has(l.discId)) return;
    porSlot.set(l.discId + '|' + l.slot, l);
  });
  return Array.from(porSlot.values())
    .sort((a, b) => a.ts - b.ts)
    .map(l => ({ ts: l.ts, pts: l.slot === 'tp' ? Math.round(l.valor * 10) : l.valor }));
}

// Notas normalizadas dos slots JÁ preenchidos (estático — funciona pra período
// antigo sem série). Base da consistência.
function notasNormalizadasDisc(d) {
  const ys = [];
  d.provas.forEach(pv => { if (hasVal(pv.value)) ys.push(pv.value / pv.max); });
  const mode = d.acMode || 'custom';
  if (mode === 'equal') {
    d.acs.forEach(ac => {
      if (ac.delivered === true) ys.push(1);
      else if (ac.delivered === false) ys.push(0);
    });
  } else {
    d.acs.forEach(ac => {
      if (hasVal(ac.value) && ac.valor > 0) ys.push(ac.value / ac.valor);
    });
  }
  return ys;
}

// Evidência OFICIAL da disciplina pro modelo estatístico, em frações por
// avaliação (prova e AC separadas; AC por entrega é 0/1). Previsão não é
// evidência de desempenho.
function obsDisc(d) {
  const obs = { prova: [], ac: [], bin: [] };
  d.provas.forEach(pv => {
    if (hasVal(pv.value) && !pv.expectativa) obs.prova.push(pv.value / pv.max);
  });
  if ((d.acMode || 'custom') === 'equal') {
    d.acs.forEach(ac => {
      if (ac.delivered === true) obs.bin.push(1);
      else if (ac.delivered === false) obs.bin.push(0);
    });
  } else {
    d.acs.forEach(ac => {
      if (hasVal(ac.value) && !ac.expectativa && ac.valor > 0) obs.ac.push(ac.value / ac.valor);
    });
  }
  return obs;
}

function bandaConsistencia(cv) {
  if (cv <= 0.10) return { label: 'cirúrgico', cls: 'success' };
  if (cv <= 0.25) return { label: 'consistente', cls: 'success' };
  if (cv <= 0.45) return { label: 'oscilando', cls: 'warning' };
  return { label: 'montanha-russa', cls: 'danger' };
}

// CR-equivalente do período (0–10): pontos (com TP/extras) sobre o lançado.
// Com o período fechado é exatamente a média das notas finais.
function crEquivPeriodo(p) {
  const r = calcPeriodo({}, p);
  return r.distReg > 0 ? Math.min(10, (r.earnedReg / r.distReg) * 10) : null;
}

// Leitura da disciplina no detalhe: tendência, forma e consistência locais.
function renderDetInsights(d) {
  const card = document.getElementById('det-insights');
  const grid = document.getElementById('det-insights-grid');
  if (!card || !grid) return;

  const ys = serieRendimento(per(), { discId: d.id }).map(pt => pt.y);
  const reg = CR9Math.linearRegression(ys);
  const cv = CR9Math.coefVar(notasNormalizadasDisc(d));

  let formaHTML = null;
  if (ys.length >= 3) {
    const ew = CR9Math.ewma(ys.slice(-10), 0.4);
    const media = CR9Math.mean(ys);
    const delta = (ew - media) * 100;
    const st = delta >= 3 ? { t: 'em alta', cls: 'success' }
      : delta <= -3 ? { t: 'em baixa', cls: 'danger' }
      : { t: 'estável', cls: '' };
    formaHTML = '<span class="det-ins-val ' + st.cls + '">' + st.t + '</span>'
      + '<span class="det-ins-sub">' + (delta >= 0 ? '+' : '') + fmtNum(delta, 1) + ' pts% vs média</span>';
  }

  let tendHTML = null;
  if (reg) {
    const sp = reg.slope * 100;
    const cls = sp >= 0.5 ? 'success' : sp <= -0.5 ? 'danger' : '';
    const ico = sp >= 0.5 ? '▲' : sp <= -0.5 ? '▼' : '→';
    tendHTML = '<span class="det-ins-val ' + cls + '">' + ico + ' ' + (sp >= 0 ? '+' : '') + fmtNum(sp, 1) + ' pts%</span>'
      + '<span class="det-ins-sub">por lançamento · R² ' + fmtNum(reg.r2, 2) + '</span>';
  }

  let consHTML = null;
  if (cv) {
    const b = bandaConsistencia(cv.cv);
    consHTML = '<span class="det-ins-val ' + b.cls + '">' + b.label + '</span>'
      + '<span class="det-ins-sub">cv ' + fmtNum(cv.cv, 2) + ' em ' + cv.n + ' notas</span>';
  }

  if (!formaHTML && !tendHTML && !consHTML) {
    card.hidden = true;
    return;
  }
  card.hidden = false;
  grid.innerHTML = ''
    + '<div class="det-ins"><span class="det-ins-label">tendência</span>' + (tendHTML || '<span class="det-ins-val dim">—</span><span class="det-ins-sub">3+ lançamentos</span>') + '</div>'
    + '<div class="det-ins"><span class="det-ins-label">forma</span>' + (formaHTML || '<span class="det-ins-val dim">—</span><span class="det-ins-sub">3+ lançamentos</span>') + '</div>'
    + '<div class="det-ins"><span class="det-ins-label">consistência</span>' + (consHTML || '<span class="det-ins-val dim">—</span><span class="det-ins-sub">3+ notas</span>') + '</div>';
}

// Projeção do período pelo modelo hierárquico (CR9Math.starsProbability):
// rendimento por avaliação com pooling entre disciplinas, prova e AC
// separadas, disciplinas dos períodos arquivados como evidência (peso cheio),
// teto de 100 com TP/extras e aprovação ≥70% por disciplina. Seed = hash do
// input ⇒ determinístico entre re-renders. Memo das últimas 4 entradas.
const mcMemo = new Map();
function projecaoPeriodo(periodo = per()) {
  if (!periodo.disciplinas.length) return null;
  const discs = periodo.disciplinas.map(d => {
    const r = calcDisc(d, {}, periodo);
    return {
      total: r.total,
      known: r.earnedBase,
      bonus: r.bonusRaw,
      obs: obsDisc(d),
      slots: slotsDisc(d, periodo)
    };
  });
  const history = state.periodos
    .filter(px => px !== periodo)
    .reduce((all, px) => all.concat(px.disciplinas.map(obsDisc)), [])
    .filter(o => o.prova.length || o.ac.length || o.bin.length);
  const need = periodo.disciplinas.reduce((s, d) => s + discTotal(d), 0) * STARS_FRAC;
  const inp = { discs, history, need, minFrac: APROV_FRAC, draws: 20000 };
  const seed = CR9Math.fnv1a(JSON.stringify(inp));
  if (mcMemo.has(seed)) return mcMemo.get(seed);
  const res = CR9Math.starsProbability(Object.assign({ seed }, inp));
  mcMemo.set(seed, res);
  if (mcMemo.size > 4) mcMemo.delete(mcMemo.keys().next().value);
  return res;
}

// Estados especiais decididos antes da simulação. "Garantido" exige pontos
// OFICIAIS acima da meta E toda disciplina já aprovada no oficial (uma com
// 50/100 e 450 no total ainda pode cair na AS). "Impossível" considera o teto
// de 100 por disciplina e a aprovação.
function calcStarsProbability(p, periodo = per()) {
  if (p.n === 0) return { state: 'empty' };
  if (p.anyAS) return { state: 'out' };
  if (!p.enrolledOk) return { state: 'insufficient', falta: STARS_MIN_DISC - p.n };
  if (p.distReg === 0) return { state: 'nodata' };

  const remaining = Math.max(0, p.total - p.distReg);
  const need = p.starsNeeded - p.totalScore;
  const rate = p.aprov;

  const todasAprovadas = periodo.disciplinas.every(d =>
    calcDiscOficialOnly(d, periodo).earned >= APROV_FRAC * discTotal(d) - 1e-9);
  if (p.starsNeeded - p.totalOficial <= 1e-9 && todasAprovadas) {
    return { state: 'locked', remaining, need: 0, rate, projected: p.totalScore };
  }

  let maxPossible = 0;
  let travada = null;
  periodo.disciplinas.forEach(d => {
    const r = calcDisc(d, {}, periodo);
    const livre = slotsDisc(d, periodo).reduce((s, sl) => s + sl.max, 0);
    const teto = Math.min(r.total, r.earnedBase + livre + r.bonusRaw);
    maxPossible += teto;
    if (teto < APROV_FRAC * r.total - 1e-9 && !travada) travada = d.nome;
  });
  if (travada) {
    return { state: 'impossible', motivo: 'reprova', disc: travada, remaining, need, rate, projected: maxPossible };
  }
  if (maxPossible < p.starsNeeded - 1e-9) {
    return { state: 'impossible', remaining, need, rate, projected: maxPossible };
  }

  const mc = projecaoPeriodo(periodo);
  let iPior = 0;
  mc.perDisc.forEach((pd, i) => { if (pd.pApprov < mc.perDisc[iPior].pApprov) iPior = i; });
  return {
    state: 'computed',
    pct: mc.pct,
    pReprova: mc.pReprova,
    maisExposta: periodo.disciplinas[iPior] ? periodo.disciplinas[iPior].nome : null,
    rate,
    needRate: remaining > 0 ? (need / remaining) * 100 : 0,
    projected: mc.mean,
    projLo: mc.p10,
    projHi: mc.p90,
    remaining,
    need
  };
}

function renderSegBar() {
  const el = document.getElementById('seg-dist');
  if (per().disciplinas.length === 0) {
    el.innerHTML = '<div class="seg-bar-empty">crie disciplinas pra ver o progresso</div>';
    return;
  }
  el.innerHTML = per().disciplinas.map(d => {
    const r = calcDisc(d);
    const distW = larg(Math.max(r.dist, r.earned), r.total);
    const earnedW = larg(r.earned, r.total);
    const title = escapeHTML(d.nome) + ' — ' + fmtNum(r.earned, 1) + '/' + fmtNum(r.total, 0) + ' pts';
    return '<div class="seg-col">'
      + '<div class="seg" title="' + title + '">'
      + '<div class="seg-dist-fill" style="width:' + distW + '%"></div>'
      + '<div class="seg-earned-fill" style="width:' + earnedW + '%"></div>'
      + tpPill(r)
      + '</div>'
      + '<div class="seg-name">' + escapeHTML(d.nome) + '</div>'
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
    needEl.textContent = STARS_MIN_DISC - p.n + ' disc. a mais';
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
    hintEl.textContent = prob.motivo === 'reprova'
      ? prob.disc + ' não chega mais a 70 sem AS, e AS elimina do Stars'
      : 'faltam mais pontos do que ainda dá pra distribuir (já contando o teto de 100 por disciplina)';
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

  projEl.innerHTML = fmtNum(prob.projected, 0)
    + ' <span class="prob-proj-range">(' + fmtNum(prob.projLo, 0) + '–' + fmtNum(prob.projHi, 0) + ')</span>';
  const needRateTxt = fmtNum(prob.needRate, 0) + '%';
  needEl.textContent = needRateTxt + ' de ' + fmtNum(prob.remaining, 0);
  rateEl.textContent = fmtNum(prob.rate, 1) + '%';

  if (prob.pct < 0.00001) {
    const gap = Math.max(0, prob.needRate - prob.rate);
    hintEl.textContent = 'chance ínfima — precisa subir ' + fmtNum(gap, 0) + ' pts% no rendimento pros ' + fmtNum(prob.remaining, 0) + ' restantes';
  } else if (prob.pReprova >= 5) {
    hintEl.textContent = fmtNum(prob.pReprova, 0) + '% de chance de alguma disciplina fechar abaixo de 70'
      + (prob.maisExposta ? ' (' + prob.maisExposta + ')' : '');
  } else if (prob.needRate <= prob.rate) {
    hintEl.textContent = 'mantendo seu rendimento, você chega lá — ' + fmtPct(prob.pct) + '% de chance';
  } else {
    const gap = prob.needRate - prob.rate;
    hintEl.textContent = 'precisa subir ' + fmtNum(gap, 0) + ' pts% no rendimento pros ' + fmtNum(prob.remaining, 0) + ' restantes';
  }
}

// Cor pelo aproveitamento nas avaliações (sem bônus: TP não mascara nota baixa).
function discStatus(d) {
  const r = calcDisc(d);
  if (r.dist === 0) return '';
  const pct = (r.earnedBase / r.dist) * 100;
  if (pct >= 70) return 'ok';
  if (pct >= 60) return 'warn';
  return 'danger';
}

// Onde o TP caiu e quanto dele de fato contou (o teto de 100 corta o resto).
function tpHintHTML(bonus) {
  const tp = per().tp;
  const disc = per().disciplinas.find(d => d.id === tp.applyTo);
  if (!disc) return 'nota ' + fmtNum(tp.value, 3) + ' — <strong>sem disciplina selecionada</strong>';
  const r = calcDisc(disc);
  const corte = bonus - r.tpBonus;
  return 'nota ' + fmtNum(tp.value, 3) + ' → <strong>' + escapeHTML(disc.nome) + '</strong> ('
    + fmtNum(r.earned, 1) + '/' + fmtNum(r.total, 0) + ')'
    + (corte > 0.01 ? ' · ' + fmtNum(corte, 1) + ' pts perdidos no teto de ' + fmtNum(r.total, 0) : '');
}

// Largura de barra: v como % do total da disciplina, clampado.
function larg(v, total) {
  return total > 0 ? Math.max(0, Math.min(100, (v / total) * 100)) : 0;
}

// Pílula verde do TP dentro da barra de nota: ocupa o trecho [earned − tp,
// earned] (o fim do preenchimento). `fim` permite ancorar em outro ponto.
function tpPill(r, fim) {
  if (!(r.tpBonus > 0)) return '';
  const end = fim === undefined ? r.earned : fim;
  return '<div class="tp-pill" style="left:' + larg(end - r.tpBonus, r.total) + '%;width:' + larg(r.tpBonus, r.total) + '%"></div>';
}

// Badges dos bônus já dentro da nota (TP e extras efetivos, pós-teto).
function bonusBadges(r, curto) {
  let h = '';
  if (r.tpBonus > 0) h += ' <span class="tp-badge tp">+' + fmtNum(r.tpBonus, 1) + (curto ? '' : ' TP') + '</span>';
  if (r.extrasBonus > 0) h += ' <span class="tp-badge extra">+' + fmtNum(r.extrasBonus, 1) + (curto ? '' : ' extra') + '</span>';
  return h;
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
  denEl.textContent = '/ ' + (p.n === 0 ? EMPTY_STARS_DEN : p.starsNeeded);

  // SVG ring animation via pathLength
  const offset = 100 - p.starsProgress;
  ringFill.setAttribute('stroke-dashoffset', String(offset));

  // hero/ring class modifiers
  const garantido = p.n > 0 && calcStarsProbability(p).state === 'locked';
  let heroMod = '';
  if (!p.starsEligible) heroMod = 'out';
  else if (garantido) heroMod = 'in';
  hero.className = 'stars-hero' + (heroMod ? ' ' + heroMod : '');
  ring.className = 'stars-ring' + (heroMod ? ' ' + heroMod : '');

  // Status pill — "No Stars" só com pontos oficiais (previsão não trava)
  if (!p.starsEligible) {
    statusEl.textContent = 'Fora do Stars';
    statusEl.className = 'stars-status out';
  } else if (garantido) {
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
    const falta = STARS_MIN_DISC - p.n;
    hintEl.innerHTML = 'precisa estar matriculado em ao menos <strong>4 disciplinas</strong> (falta ' + falta + ')';
  } else if (garantido) {
    hintEl.innerHTML = 'você garantiu o Stars com ' + Math.round(p.totalOficial) + ' pontos oficiais';
  } else if (p.totalOficial >= p.starsNeeded) {
    hintEl.innerHTML = 'pontos oficiais acima da meta, mas alguma disciplina ainda não bateu 70';
  } else if (p.totalScore >= p.starsNeeded) {
    hintEl.innerHTML = 'projeção em <strong>' + Math.round(p.totalScore) + '</strong> — acima da meta, falta virar oficial';
  } else if (calcStarsProbability(p).state === 'impossible') {
    hintEl.innerHTML = 'faltam <strong>' + fmtNum(p.starsNeeded - p.totalScore, 1) + '</strong> pontos, mais do que ainda dá pra fazer';
  } else {
    hintEl.innerHTML = 'faltam <strong>' + fmtNum(p.starsNeeded - p.totalScore, 1) + '</strong> pontos — ainda dá';
  }

  // Probabilidade estatística do Stars
  renderProbCard(p);

  // Pontos distribuídos
  document.getElementById('pts-dist').textContent = fmtNum(p.distReg, 1);
  document.getElementById('pts-total').textContent = p.total || EMPTY_TOTAL_DEN;
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
  if (per().tp.value !== null && per().tp.value !== undefined) {
    const bonus = Math.round(per().tp.value * 10);
    const expBadge = per().tp.expectativa ? ' <span class="badge-exp">prev</span>' : '';
    tpBonusEl.innerHTML = bonus + ' pts' + expBadge;
    tpHintEl.innerHTML = tpHintHTML(bonus);
  } else {
    tpBonusEl.textContent = '— pts';
    tpHintEl.textContent = 'sem nota lançada';
  }

  // Breakdown por disciplina
  const bdBody = document.getElementById('bd-body');
  if (per().disciplinas.length === 0) {
    bdBody.innerHTML = '<p class="hint">crie disciplinas pra ver o detalhamento</p>';
  } else {
    bdBody.innerHTML = per().disciplinas.map(d => {
      const r = calcDisc(d);
      const earnedW = larg(r.earned, r.total);
      const distW = larg(Math.max(r.dist, r.earned), r.total);
      return '<div class="bd-row">'
        + '<div class="bd-head">'
        + '<span class="bd-name">' + escapeHTML(d.nome) + bonusBadges(r) + '</span>'
        + '<span class="bd-val">' + fmtNum(r.earned, 1) + '/' + fmtNum(r.total, 0) + '</span>'
        + '</div>'
        + '<div class="bd-bar">'
        + '<div class="bd-dist" style="width:' + distW + '%"></div>'
        + '<div class="bd-earned" style="width:' + earnedW + '%"></div>'
        + tpPill(r)
        + '</div>'
        + '</div>';
    }).join('');
  }

  // Recentes
  renderRecentesList(document.getElementById('lista-recentes'));
}

// Lista de lançamentos recentes — compartilhada entre home stars e registro.
function renderRecentesList(el) {
  if (!el) return;
  if (!per().recentes || per().recentes.length === 0) {
    el.innerHTML = '<li class="empty">nenhum lançamento ainda</li>';
    return;
  }
  el.innerHTML = per().recentes.map(r => {
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

// ───────── RENDER: HOME TRACKING ─────────

// Acumulado da série de eventos ({pts}) — base da timeline e da progressão.
function cumsum(eventos) {
  const cum = [];
  let acc = 0;
  eventos.forEach(ev => { acc += ev.pts; cum.push(acc); });
  return cum;
}

// Série → coordenadas SVG (strings já com .toFixed(1), prontas pra polyline).
function svgCoords(values, w, h, pad, maxV) {
  const stepX = (w - pad * 2) / Math.max(1, values.length - 1);
  return values.map((v, i) => ({
    x: (pad + i * stepX).toFixed(1),
    y: (h - pad - (v / maxV) * (h - pad * 2)).toFixed(1)
  }));
}

function renderHomeTracking() {
  const p = calcPeriodo();
  const aprov = p.aprov || 0;

  renderTrackKpis(p);
  renderTrackTendencia();
  renderTrackForma();
  renderTrackExpVsOficial();
  renderTrackTimeline();
  renderTrackAproveitamento();
  renderTrackConsistencia();
  renderTrackProgressao(p);
  renderTrackHistorico();
  renderTrackTP();
  renderTrackVsMedio(aprov);
  renderTrackProfs();
  renderTrackVsEinstein(aprov);
  renderTrackDesespero(p, aprov);
  renderTrackSobreviver(p, aprov);
}

function renderTrackKpis(p) {
  // KPI strip
  const kpis = document.getElementById('track-kpis');
  if (kpis) {
    const aprovTxt = p.aprov !== null ? fmtNum(p.aprov, 1) + '%' : '—';
    const projTxt = fmtNum(p.totalScore, 0) + ' / ' + (p.starsNeeded || EMPTY_STARS_DEN);
    kpis.innerHTML = ''
      + '<div class="track-kpi"><div class="track-kpi-label">aproveitamento</div><div class="track-kpi-value">' + aprovTxt + '</div></div>'
      + '<div class="track-kpi"><div class="track-kpi-label">ganhos / lançados</div><div class="track-kpi-value">' + fmtNum(p.earnedReg, 0) + ' / ' + fmtNum(p.distReg, 0) + '</div></div>'
      + '<div class="track-kpi"><div class="track-kpi-label">projeção stars</div><div class="track-kpi-value">' + projTxt + '</div></div>';
  }
}

function renderTrackTendencia() {
  // Tendência (regressão linear sobre a série de rendimento oficial)
  const tend = document.getElementById('track-tendencia');
  if (tend) {
    const serie = serieRendimento(per());
    const reg = CR9Math.linearRegression(serie.map(pt => pt.y));
    if (!reg) {
      tend.innerHTML = '<p class="hint">precisa de 3+ lançamentos oficiais pra medir tendência</p>';
    } else {
      const slopePP = reg.slope * 100; // pontos percentuais de rendimento por lançamento
      const dir = slopePP >= 0.5 ? { ico: '▲', cls: 'success', txt: 'subindo' }
        : slopePP <= -0.5 ? { ico: '▼', cls: 'danger', txt: 'caindo' }
        : { ico: '→', cls: '', txt: 'estável' };
      const conf = reg.r2 >= 0.5 ? 'tendência clara' : 'tendência ruidosa';
      const porDisc = per().disciplinas.map(d => {
        const sd = serieRendimento(per(), { discId: d.id });
        const rd = CR9Math.linearRegression(sd.map(pt => pt.y));
        if (!rd) return '';
        const sp = rd.slope * 100;
        const di = sp >= 0.5 ? '▲' : sp <= -0.5 ? '▼' : '→';
        const dc = sp >= 0.5 ? 'success' : sp <= -0.5 ? 'danger' : '';
        return '<div class="track-stat-row"><span>' + escapeHTML(d.nome) + '</span>'
          + '<span class="track-stat-val ' + dc + '">' + di + ' ' + (sp >= 0 ? '+' : '') + fmtNum(sp, 1) + ' pts%</span></div>';
      }).join('');
      tend.innerHTML = '<div class="track-stat-hero ' + dir.cls + '">'
        + '<span class="track-stat-ico">' + dir.ico + '</span>'
        + '<span class="track-stat-big">' + (slopePP >= 0 ? '+' : '') + fmtNum(slopePP, 1) + ' pts%</span>'
        + '<span class="track-stat-sub">por lançamento · ' + dir.txt + '</span>'
        + '</div>'
        + '<p class="track-fun-hint">R² ' + fmtNum(reg.r2, 2) + ' · ' + conf + ' · ' + reg.n + ' lançamentos</p>'
        + porDisc;
    }
  }
}

function renderTrackForma() {
  // Forma atual (EWMA dos últimos lançamentos vs média do período)
  const forma = document.getElementById('track-forma');
  if (forma) {
    const ys = serieRendimento(per()).map(pt => pt.y);
    if (ys.length < 3) {
      forma.innerHTML = '<p class="hint">precisa de 3+ lançamentos oficiais pra medir a forma</p>';
    } else {
      const recentes = ys.slice(-10);
      const ew = CR9Math.ewma(recentes, 0.4);
      const media = CR9Math.mean(ys);
      const delta = (ew - media) * 100;
      const st = delta >= 3 ? { emoji: '🔥', label: 'em alta', cls: 'success' }
        : delta <= -3 ? { emoji: '🧊', label: 'em baixa', cls: 'danger' }
        : { emoji: '➖', label: 'estável', cls: '' };
      const ewW = Math.max(0, Math.min(100, ew * 100));
      const medW = Math.max(0, Math.min(100, media * 100));
      forma.innerHTML = '<div class="track-stat-hero ' + st.cls + '">'
        + '<span class="track-stat-ico">' + st.emoji + '</span>'
        + '<span class="track-stat-big">' + st.label + '</span>'
        + '<span class="track-stat-sub">' + (delta >= 0 ? '+' : '') + fmtNum(delta, 1) + ' pts% vs média</span>'
        + '</div>'
        + '<div class="track-vs">'
        + '<div class="track-vs-row"><span class="track-vs-label">forma</span><div class="track-bar"><div class="track-bar-of" style="width:' + ewW + '%"></div></div><span class="track-vs-val">' + fmtNum(ew * 100, 0) + '%</span></div>'
        + '<div class="track-vs-row"><span class="track-vs-label">média</span><div class="track-bar"><div class="track-bar-avg" style="width:' + medW + '%"></div></div><span class="track-vs-val">' + fmtNum(media * 100, 0) + '%</span></div>'
        + '</div>';
    }
  }
}

function renderTrackExpVsOficial() {
  // Expectativa vs Oficial
  const evo = document.getElementById('track-exp-vs-of');
  if (evo) {
    if (per().disciplinas.length === 0) {
      evo.innerHTML = '<p class="hint">crie disciplinas pra ver</p>';
    } else {
      evo.innerHTML = per().disciplinas.map(d => {
        const all = calcDisc(d);
        const of = calcDiscOficialOnly(d);
        const expExtra = Math.max(0, all.earned - of.earned);
        const ofW = larg(of.earned, all.total);
        const expW = Math.max(0, Math.min(100 - ofW, larg(expExtra, all.total)));
        return '<div class="track-bar-row">'
          + '<div class="track-bar-head"><span>' + escapeHTML(d.nome) + '</span><span>' + fmtNum(of.earned, 0) + ' + ' + fmtNum(expExtra, 0) + '</span></div>'
          + '<div class="track-bar"><div class="track-bar-of" style="width:' + ofW + '%"></div><div class="track-bar-exp" style="left:' + ofW + '%;width:' + expW + '%"></div>'
          + (per().tp.expectativa ? tpPill(all) : tpPill(of)) + '</div>'
          + '</div>';
      }).join('');
    }
  }
}

function renderTrackTimeline() {
  // Timeline SVG sparkline — pontos REAIS acumulados (série deduplicada;
  // edição substitui, TP entra pelo bônus)
  const tl = document.getElementById('track-timeline');
  if (tl) {
    const eventos = seriePontos(per());
    if (eventos.length === 0) {
      tl.innerHTML = '<p class="hint">sem lançamentos pra plotar</p>';
    } else {
      const w = 320, h = 80, pad = 6;
      const cum = cumsum(eventos);
      const maxV = Math.max.apply(null, cum) || 1;
      const coords = svgCoords(cum, w, h, pad, maxV);
      const pts = coords.map(c => c.x + ',' + c.y);
      const dots = coords.map(c => '<circle cx="' + c.x + '" cy="' + c.y + '" r="2.5"/>').join('');
      tl.innerHTML = '<svg class="track-svg" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="xMidYMid meet">'
        + '<polyline points="' + pts.join(' ') + '" fill="none" stroke="currentColor" stroke-width="1.5"/>'
        + dots
        + '</svg>';
    }
  }
}

function renderTrackAproveitamento() {
  // Aproveitamento per disciplina
  const apr = document.getElementById('track-aprov-list');
  if (apr) {
    if (per().disciplinas.length === 0) {
      apr.innerHTML = '<p class="hint">crie disciplinas pra ver</p>';
    } else {
      const items = per().disciplinas.map(d => {
        const r = calcDisc(d);
        const pct = r.dist > 0 ? (r.earnedBase / r.dist) * 100 : 0;
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
}

function renderTrackConsistencia() {
  // Consistência por disciplina (CV das notas normalizadas — estático)
  const cons = document.getElementById('track-consistencia');
  if (cons) {
    if (per().disciplinas.length === 0) {
      cons.innerHTML = '<p class="hint">crie disciplinas pra ver</p>';
    } else {
      const rows = per().disciplinas.map(d => {
        const cv = CR9Math.coefVar(notasNormalizadasDisc(d));
        const badge = cv === null
          ? '<span class="badge-band">poucos dados</span>'
          : (() => { const b = bandaConsistencia(cv.cv);
              return '<span class="badge-band ' + b.cls + '">' + b.label + ' · cv ' + fmtNum(cv.cv, 2) + '</span>'; })();
        return '<div class="track-stat-row"><span>' + escapeHTML(d.nome) + '</span>' + badge + '</div>';
      }).join('');
      cons.innerHTML = rows
        + '<p class="track-fun-hint">cv = desvio ÷ média das notas normalizadas. quanto menor, mais previsível.</p>';
    }
  }
}

function renderTrackProgressao(p) {
  // Progressão SVG — pontos reais acumulados rumo à meta do Stars
  const pr = document.getElementById('track-progress');
  if (pr) {
    const eventos = seriePontos(per());
    if (eventos.length === 0) {
      pr.innerHTML = '<p class="hint">sem dados de progressão</p>';
    } else {
      const w = 320, h = 100, pad = 8;
      const cum = cumsum(eventos);
      const need = p.starsNeeded || EMPTY_STARS_DEN;
      const maxV = Math.max(need, cum[cum.length - 1] || 1);
      const coords = svgCoords(cum, w, h, pad, maxV);
      const pts = coords.map(c => c.x + ',' + c.y);
      const areaPts = [pad + ',' + (h - pad)].concat(pts).concat([coords[coords.length - 1].x + ',' + (h - pad)]);
      const needY = (h - pad - (need / maxV) * (h - pad * 2)).toFixed(1);
      pr.innerHTML = '<svg class="track-svg" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="xMidYMid meet">'
        + '<polygon points="' + areaPts.join(' ') + '" fill="currentColor" fill-opacity="0.18"/>'
        + '<polyline points="' + pts.join(' ') + '" fill="none" stroke="currentColor" stroke-width="1.5"/>'
        + '<line x1="' + pad + '" y1="' + needY + '" x2="' + (w - pad) + '" y2="' + needY + '" stroke="currentColor" stroke-dasharray="3 3" stroke-opacity="0.6"/>'
        + '<text x="' + (w - pad) + '" y="' + (parseFloat(needY) - 2) + '" text-anchor="end" font-size="9" fill="currentColor" fill-opacity="0.7">stars ' + need + '</text>'
        + '</svg>';
    }
  }
}

function renderTrackHistorico() {
  // Evolução entre períodos (aparece só com 2+)
  const hist = document.getElementById('track-historico');
  const histCard = document.getElementById('card-historico');
  if (hist && histCard) {
    if (state.periodos.length < 2) {
      histCard.hidden = true;
    } else {
      const ordenados = state.periodos.slice().sort((a, b) => (a.criadoEm || 0) - (b.criadoEm || 0));
      const entries = ordenados
        .map(px => ({ p: px, cr: crEquivPeriodo(px) }))
        .filter(e => e.cr !== null);
      histCard.hidden = false;
      if (entries.length < 2) {
        hist.innerHTML = '<p class="hint">períodos sem notas suficientes pra comparar</p>';
      } else {
        const w = 320, hh = 100, pad = 14;
        const n = entries.length;
        const stepX = (w - pad * 2) / Math.max(1, n - 1);
        const yOf = v => hh - pad - (Math.max(0, Math.min(10, v)) / 10) * (hh - pad * 2);
        const pts = entries.map((e, i) => (pad + i * stepX).toFixed(1) + ',' + yOf(e.cr).toFixed(1));
        const dots = entries.map((e, i) =>
          '<circle cx="' + (pad + i * stepX).toFixed(1) + '" cy="' + yOf(e.cr).toFixed(1) + '" r="3"/>').join('');
        const labels = entries.map((e, i) =>
          '<text x="' + (pad + i * stepX).toFixed(1) + '" y="' + (hh - 2) + '" text-anchor="middle" font-size="8" fill="currentColor" fill-opacity="0.7">' + escapeHTML(e.p.nome) + '</text>').join('');
        const nineY = yOf(9).toFixed(1);
        const last = entries[n - 1], prev = entries[n - 2];
        const delta = last.cr - prev.cr;

        let melhor = null, pior = null;
        state.periodos.forEach(px => px.disciplinas.forEach(d => {
          const rd = calcDisc(d, {}, px);
          if (rd.dist < 0.4 * rd.total) return; // ignora disciplina com pouca coisa lançada
          const pcd = Math.min(1, rd.earned / rd.dist);
          if (!melhor || pcd > melhor.pct) melhor = { nome: d.nome, pct: pcd };
          if (!pior || pcd < pior.pct) pior = { nome: d.nome, pct: pcd };
        }));

        hist.innerHTML =
          '<div class="track-stat-hero ' + (delta >= 0.05 ? 'success' : delta <= -0.05 ? 'danger' : '') + '">'
          + '<span class="track-stat-big">CR ' + fmtNum(last.cr, 2) + '</span>'
          + '<span class="track-stat-sub">' + escapeHTML(last.p.nome) + ' · ' + (delta >= 0 ? '+' : '') + fmtNum(delta, 2) + ' vs ' + escapeHTML(prev.p.nome) + '</span>'
          + '</div>'
          + '<svg class="track-svg" viewBox="0 0 ' + w + ' ' + hh + '" preserveAspectRatio="xMidYMid meet">'
          + '<line x1="' + pad + '" y1="' + nineY + '" x2="' + (w - pad) + '" y2="' + nineY + '" stroke="currentColor" stroke-dasharray="3 3" stroke-opacity="0.5"/>'
          + '<text x="' + (w - pad) + '" y="' + (parseFloat(nineY) - 3) + '" text-anchor="end" font-size="8" fill="currentColor" fill-opacity="0.6">stars 9,0</text>'
          + '<polyline points="' + pts.join(' ') + '" fill="none" stroke="currentColor" stroke-width="1.5"/>'
          + dots + labels
          + '</svg>'
          + (melhor && pior
            ? '<div class="track-stat-row"><span>melhor histórica</span><span class="track-stat-val success">' + escapeHTML(melhor.nome) + ' · ' + fmtNum(melhor.pct * 100, 0) + '%</span></div>'
              + '<div class="track-stat-row"><span>pior histórica</span><span class="track-stat-val danger">' + escapeHTML(pior.nome) + ' · ' + fmtNum(pior.pct * 100, 0) + '%</span></div>'
            : '');
      }
    }
  }
}

function renderTrackTP() {
  // TP contribution
  const tpEl = document.getElementById('track-tp');
  if (tpEl) {
    if (!per().tp || per().tp.value == null) {
      tpEl.innerHTML = '<p class="hint">sem nota TP lançada</p>';
    } else {
      const bonus = Math.round(per().tp.value * 10);
      const disc = per().disciplinas.find(x => x.id === per().tp.applyTo);
      tpEl.innerHTML = '<div class="track-tp-line"><strong>+' + bonus + ' pts</strong> em ' + (disc ? escapeHTML(disc.nome) : '<em>sem disciplina</em>') + '</div>'
        + '<div class="track-tp-line muted">' + tpHintHTML(bonus) + '</div>';
    }
  }
}

function renderTrackVsMedio(aprov) {
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
}

function renderTrackProfs() {
  // Seus professores gostam de você?
  const profs = document.getElementById('track-profs');
  if (profs) {
    if (per().disciplinas.length === 0) {
      profs.innerHTML = '<p class="hint">crie disciplinas pra descobrir</p>';
    } else {
      profs.innerHTML = per().disciplinas.map(d => {
        const r = calcDisc(d);
        const score = r.dist > 0 ? Math.min(100, (r.earned / r.dist) * 100) : 0;
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
}

function renderTrackVsEinstein(aprov) {
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
}

function renderTrackDesespero(p, aprov) {
  // Nível de desespero
  const desp = document.getElementById('track-desespero');
  if (desp) {
    const missing = p.total > 0 ? (1 - p.earnedReg / p.total) * 100 : 0;
    const pctDone = p.total > 0 ? p.distReg / p.total * 100 : 0;
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
}

function renderTrackSobreviver(p, aprov) {
  // Chance de sobreviver ao período = passar em todas sem AS, pelo modelo.
  // Sem nota lançada cai nas faixas antigas por aproveitamento (sem jitter).
  const sob = document.getElementById('track-sobreviver');
  if (sob) {
    let chance;
    const mc = p.distReg > 0 ? projecaoPeriodo() : null;
    if (mc) chance = Math.round(Math.max(0, Math.min(100, 100 - mc.pReprova)));
    else if (p.n === 0) chance = 50;
    else if (aprov >= 85) chance = 98;
    else if (aprov >= 70) chance = 85;
    else if (aprov >= 55) chance = 60;
    else if (aprov >= 40) chance = 35;
    else chance = 12;
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
    const pct = p.aprov !== null ? Math.round(p.aprov) : 0;
    const starsOk = p.starsEligible && calcStarsProbability(p).state === 'locked';
    summary.innerHTML = ''
      + '<div class="reg-sum-item"><span class="reg-sum-num">' + fmtNum(p.totalScore, 0) + '</span><span class="reg-sum-lbl">pontos</span></div>'
      + '<div class="reg-sum-item"><span class="reg-sum-num">' + pct + '%</span><span class="reg-sum-lbl">aproveitamento</span></div>'
      + '<div class="reg-sum-item"><span class="reg-sum-num ' + (starsOk ? 'on' : '') + '">' + (starsOk ? 'sim' : 'não') + '</span><span class="reg-sum-lbl">stars</span></div>';
  }

  // Chips
  const chips = document.getElementById('reg-chips');
  if (chips) {
    if (per().disciplinas.length === 0) {
      chips.innerHTML = '<p class="hint">crie disciplinas primeiro</p>';
    } else {
      chips.innerHTML = per().disciplinas.map(d =>
        '<button class="reg-chip" data-disc="' + d.id + '">' + escapeHTML(d.nome) + '</button>'
      ).join('');
      chips.querySelectorAll('.reg-chip').forEach(el => {
        el.onclick = () => openDetalhe(el.dataset.disc);
      });
    }
  }

  // Recentes
  renderRecentesList(document.getElementById('reg-recentes'));

  // Slim progress per disciplina
  const prog = document.getElementById('reg-progress');
  if (prog) {
    if (per().disciplinas.length === 0) {
      prog.innerHTML = '';
    } else {
      prog.innerHTML = per().disciplinas.map(d => {
        const r = calcDisc(d);
        const w = larg(r.earned, r.total);
        return '<div class="reg-row">'
          + '<div class="reg-row-head"><span>' + escapeHTML(d.nome) + bonusBadges(r, true) + '</span><span>' + fmtNum(r.earned, 0) + '/' + fmtNum(r.total, 0) + '</span></div>'
          + '<div class="reg-bar"><div class="reg-bar-fill" style="width:' + w + '%"></div>' + tpPill(r) + '</div>'
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
  const verEl = document.getElementById('cfg-stat-ver');
  if (discEl) discEl.textContent = String(p.n);
  if (ptsEl) ptsEl.textContent = p.n === 0 ? '0' : String(Math.round(p.totalScore));
  if (verEl) verEl.textContent = APP_VERSION;

  renderPeriodosList();
}

function renderPeriodosList() {
  const el = document.getElementById('per-list');
  if (!el) return;
  const ordenados = state.periodos.slice().sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));
  el.innerHTML = ordenados.map(p => {
    const ativo = p.status === 'ativo';
    const r = calcPeriodo({}, p);
    const meta = r.n + ' disc · ' + fmtNum(r.totalScore, 0) + ' pts'
      + (r.aprov !== null ? ' · ' + fmtNum(r.aprov, 0) + '%' : '');
    const acoes = ativo
      ? '<button type="button" class="per-btn" data-per-action="renomear" data-per-id="' + p.id + '">renomear</button>'
      : '<button type="button" class="per-btn" data-per-action="ver" data-per-id="' + p.id + '">ver</button>'
        + '<button type="button" class="per-btn" data-per-action="renomear" data-per-id="' + p.id + '">renomear</button>'
        + '<button type="button" class="per-btn" data-per-action="reabrir" data-per-id="' + p.id + '">reabrir</button>'
        + '<button type="button" class="per-btn danger" data-per-action="apagar" data-per-id="' + p.id + '">apagar</button>';
    return '<div class="per-item' + (ativo ? ' on' : '') + '">'
      + '<div class="per-info">'
      + '<div class="per-nome">' + escapeHTML(p.nome)
      + ' <span class="per-pill' + (ativo ? ' on' : '') + '">' + (ativo ? 'ativo' : 'arquivado') + '</span></div>'
      + '<div class="per-meta">' + meta + '</div>'
      + '</div>'
      + '<div class="per-actions">' + acoes + '</div>'
      + '</div>';
  }).join('');
}

function proximoPeriodoNome(nomeAtual) {
  const m = /^(\d{4})\.([12])$/.exec(nomeAtual || '');
  if (!m) return defaultPeriodoNome();
  return m[2] === '1' ? m[1] + '.2' : (Number(m[1]) + 1) + '.1';
}

function fecharPeriodo() {
  const atual = per();
  const sugerido = proximoPeriodoNome(atual.nome);
  const nome = prompt('Fechar "' + atual.nome + '" e abrir um novo período.\nNome do novo período:', sugerido);
  if (nome === null) return;
  const nomeFinal = nome.trim() || sugerido;
  if (!confirm('Arquivar "' + atual.nome + '" (tudo fica preservado) e começar "' + nomeFinal + '"?')) return;
  atual.status = 'arquivado';
  atual.arquivadoEm = Date.now();
  const novo = novoPeriodo(nomeFinal);
  state.periodos.push(novo);
  state.periodoAtivoId = novo.id;
  simState = {};
  currentDiscId = null;
  saveState();
  renderHeader();
  renderConfig();
  renderDisciplinas();
  renderHome();
}

function resumoPeriodoHTML(p) {
  const r = calcPeriodo({}, p);
  if (r.n === 0) return '<p class="hint">período sem disciplinas.</p>';
  const rows = p.disciplinas.map(d => {
    const rd = calcDisc(d, {}, p);
    const pct = rd.dist > 0 ? (rd.earnedBase / rd.dist) * 100 : null;
    return '<tr><td>' + escapeHTML(d.nome) + bonusBadges(rd) + '</td>'
      + '<td>' + fmtNum(rd.earned, 1) + '<span class="per-res-dim">/' + fmtNum(rd.total, 0) + '</span></td>'
      + '<td>' + (pct !== null ? fmtNum(pct, 0) + '%' : '—') + '</td></tr>';
  }).join('');
  const starsOk = r.enrolledOk && !r.anyAS && calcStarsProbability(r, p).state === 'locked';
  const starsTxt = r.anyAS ? 'fora (AS oficial)'
    : !r.enrolledOk ? 'não elegível (menos de 4 disciplinas)'
    : starsOk ? 'conquistado ✦' : fmtNum(r.totalScore, 0) + ' de ' + r.starsNeeded + ' pts';
  return '<div class="per-resumo">'
    + '<table><thead><tr><th>disciplina</th><th>pontos</th><th>aprov.</th></tr></thead>'
    + '<tbody>' + rows + '</tbody></table>'
    + '<div class="per-res-tot">'
    + '<span>total <strong>' + fmtNum(r.totalScore, 0) + '</strong> pts</span>'
    + '<span>aproveitamento <strong>' + (r.aprov !== null ? fmtNum(r.aprov, 1) + '%' : '—') + '</strong></span>'
    + '<span>CR equivalente <strong>' + (crEquivPeriodo(p) !== null ? fmtNum(crEquivPeriodo(p), 2) : '—') + '</strong></span>'
    + '<span>stars: <strong>' + starsTxt + '</strong></span>'
    + '</div>'
    + '</div>';
}

function handlePeriodoAction(action, perId) {
  const p = state.periodos.find(x => x.id === perId);
  if (!p) return;

  if (action === 'ver') {
    openModalInfo(p.nome + ' · resumo', resumoPeriodoHTML(p));
    return;
  }
  if (action === 'renomear') {
    const nome = prompt('Novo nome do período:', p.nome);
    if (nome === null || !nome.trim()) return;
    p.nome = nome.trim();
    saveState();
    renderConfig();
    renderHeader();
    return;
  }
  if (action === 'reabrir') {
    if (p.status === 'ativo') return;
    const atual = per();
    if (!confirm('Reabrir "' + p.nome + '"? O período atual ("' + atual.nome + '") será arquivado no lugar — nada se perde.')) return;
    atual.status = 'arquivado';
    atual.arquivadoEm = Date.now();
    p.status = 'ativo';
    p.arquivadoEm = null;
    state.periodoAtivoId = p.id;
    simState = {};
    currentDiscId = null;
    saveState();
    renderHeader();
    renderConfig();
    renderDisciplinas();
    renderHome();
    return;
  }
  if (action === 'apagar') {
    if (p.status === 'ativo') return;
    if (!confirm('Apagar o período arquivado "' + p.nome + '" com todas as notas dele? (1/2)')) return;
    if (!confirm('Irreversível. Confirmar exclusão de "' + p.nome + '"? (2/2)')) return;
    state.periodos = state.periodos.filter(x => x.id !== perId);
    saveState();
    renderConfig();
    return;
  }
}

// ───────── RENDER: DISCIPLINAS ─────────

// "AP1 40 · AP2 40 · AC 20" — a estrutura da disciplina numa linha.
function resumoEstrutura(d) {
  const partes = d.provas.map(pv => pv.nome + ' ' + fmtNum(pv.max, 1));
  if (d.acPool > 0) partes.push('AC ' + fmtNum(d.acPool, 1));
  return partes.join(' · ');
}

function renderDisciplinas() {
  const lista = document.getElementById('lista-disciplinas');
  if (per().disciplinas.length === 0) {
    lista.innerHTML = '<li class="empty">nenhuma disciplina. toca em <strong>+ nova</strong>.</li>';
    return;
  }
  lista.innerHTML = per().disciplinas.map(d => {
    const r = calcDisc(d);
    const status = discStatus(d);
    const pct = r.dist > 0 ? (r.earnedBase / r.dist * 100) : 0;
    const meta = r.dist > 0
      ? fmtNum(r.dist, 0) + ' de ' + fmtNum(r.total, 0) + ' lançados · ' + fmtNum(pct, 0) + '%'
      : 'nada lançado · ' + escapeHTML(resumoEstrutura(d));
    return '<li class="disc-item ' + status + '" data-id="' + d.id + '">'
      + '<div class="disc-info">'
      + '<div class="disc-nome">' + escapeHTML(d.nome) + bonusBadges(r) + '</div>'
      + '<div class="disc-meta">' + meta + '</div>'
      + '</div>'
      + '<div class="disc-pts">' + fmtNum(r.earned, 1) + '<span class="disc-pts-max"> / ' + fmtNum(r.total, 0) + '</span></div>'
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

function discAtual() {
  return per().disciplinas.find(x => x.id === currentDiscId) || null;
}

function gradeDisplay(slot, max) {
  if (!slot || !hasVal(slot.value)) {
    return '<div class="grade-display empty">— <span class="grade-max">/ ' + fmtNum(max, 1) + '</span></div>';
  }
  const expClass = slot.expectativa ? 'exp' : '';
  const badge = slot.expectativa ? '<span class="badge-exp">prev</span>' : '';
  return '<div class="grade-display ' + expClass + '">'
    + fmtNum(slot.value, 1)
    + ' <span class="grade-max">/ ' + fmtNum(max, 1) + '</span>'
    + badge
    + '</div>';
}

function gradeActions(tipo) {
  return '<div class="grade-actions">'
    + '<button class="btn secondary sm" data-action="set-expectativa" data-tipo="' + tipo + '">previsão</button>'
    + '<button class="btn primary sm" data-action="set-oficial" data-tipo="' + tipo + '">oficial</button>'
    + '</div>';
}

// Auto-trigger da AS: com todas as notas lançadas e nota final (TP e extras
// inclusos) abaixo de 70%, liga showAS uma vez; limpar alguma nota re-arma o
// gatilho. Roda nas mutações via saveDisc — nunca no render.
function syncAsAutoTrigger(d) {
  const acsAssigned = (d.acs || []).every(ac => {
    if ((d.acMode || 'custom') === 'equal') return ac.delivered === true || ac.delivered === false;
    return hasVal(ac.value);
  });
  const allGradesAssigned = d.provas.every(pv => hasVal(pv.value)) && acsAssigned;
  if (d.temAS === false) return;
  if (allGradesAssigned && !d.asAutoTriggered && calcDisc(d).earned < APROV_FRAC * discTotal(d)) {
    d.showAS = true;
    d.asAutoTriggered = true;
  } else if (!allGradesAssigned && d.asAutoTriggered) {
    d.asAutoTriggered = false;
  }
}

function saveDisc(d) {
  syncAsAutoTrigger(d);
  saveState();
}

// Linha "pra chegar em X": quanto do que falta a disciplina precisa render.
function metaLinha(rotulo, alvo, atual, livre) {
  const falta = alvo - atual;
  let val, cls = '';
  if (falta <= 1e-9) { val = 'já garantido'; cls = 'success'; }
  else if (falta > livre + 1e-9) { val = livre > 0 ? 'fora de alcance' : 'não chegou'; cls = 'danger'; }
  else {
    const pct = (falta / livre) * 100;
    val = fmtNum(falta, 1) + ' de ' + fmtNum(livre, 1) + ' (' + fmtNum(pct, 0) + '%)';
    cls = pct > 90 ? 'danger' : pct > 75 ? 'warning' : '';
  }
  return '<div class="det-proj-row"><span>' + rotulo + '</span><span class="det-proj-val ' + cls + '">' + val + '</span></div>';
}

// Projeção da disciplina: quanto precisa no que falta (determinístico) +
// nota final esperada e chances pelo modelo do período.
function renderDetProjecao(d, r) {
  const card = document.getElementById('det-proj');
  const body = document.getElementById('det-proj-body');
  if (!card || !body) return;
  const livre = slotsDisc(d).reduce((s, sl) => s + sl.max, 0);
  const atual = r.earned;
  let html = metaLinha('pra passar (' + fmtNum(APROV_FRAC * r.total, 0) + ')', APROV_FRAC * r.total, atual, livre)
    + metaLinha('pra 9,0 (' + fmtNum(STARS_FRAC * r.total, 0) + ')', STARS_FRAC * r.total, atual, livre);

  if (livre > 0.01) {
    const mc = projecaoPeriodo();
    const idx = per().disciplinas.indexOf(d);
    const pd = mc && idx >= 0 ? mc.perDisc[idx] : null;
    if (pd) {
      html += '<div class="det-proj-grid">'
        + '<div class="det-ins"><span class="det-ins-label">nota final esperada</span>'
        + '<span class="det-ins-val">' + fmtNum(pd.mean, 1) + '</span>'
        + '<span class="det-ins-sub">faixa ' + fmtNum(pd.p10, 0) + '–' + fmtNum(pd.p90, 0) + '</span></div>'
        + '<div class="det-ins"><span class="det-ins-label">passar direto</span>'
        + '<span class="det-ins-val ' + (pd.pApprov >= 90 ? 'success' : pd.pApprov < 60 ? 'danger' : '') + '">' + fmtPct(pd.pApprov) + '%</span>'
        + '<span class="det-ins-sub">sem AS</span></div>'
        + '<div class="det-ins"><span class="det-ins-label">fechar ≥ 9,0</span>'
        + '<span class="det-ins-val ' + (pd.pNove >= 60 ? 'success' : pd.pNove < 20 ? 'danger' : '') + '">' + fmtPct(pd.pNove) + '%</span>'
        + '<span class="det-ins-sub">' + (r.dist > 0 ? 'pelo seu rendimento' : 'sem notas: histórico/prior') + '</span></div>'
        + '</div>';
    }
  } else {
    html += '<p class="det-proj-fim">disciplina fechada em <strong>' + fmtNum(r.earned, 1) + '</strong>'
      + (r.earned >= STARS_FRAC * r.total ? ' · acima de 9,0' : r.earned >= APROV_FRAC * r.total ? ' · aprovada' : ' · abaixo de 70') + '</p>';
  }
  card.hidden = false;
  body.innerHTML = html;
}

function renderDetalhe() {
  const d = discAtual();
  if (!d) { goto('s-disciplinas'); return; }

  const r = calcDisc(d);
  document.getElementById('det-nome').textContent = d.nome;
  document.getElementById('det-bonus').innerHTML = bonusBadges(r);
  document.getElementById('det-earned').textContent = fmtNum(r.earned, 1);
  document.getElementById('det-total').textContent = fmtNum(r.total, 0);
  const pct = r.dist > 0 ? (r.earnedBase / r.dist * 100) : 0;
  const detBar = document.getElementById('det-bar');
  detBar.style.width = larg(r.earned, r.total) + '%';
  document.getElementById('det-bar-tp').outerHTML = tpPill(r).replace('class="tp-pill"', 'class="tp-pill" id="det-bar-tp"') || '<div id="det-bar-tp"></div>';
  if (r.dist === 0) detBar.className = 'bar-fill';
  else if (pct >= 70) detBar.className = 'bar-fill success';
  else if (pct >= 60) detBar.className = 'bar-fill warning';
  else detBar.className = 'bar-fill danger';

  const partes = [];
  if (r.dist === 0) partes.push('sem notas · ' + escapeHTML(resumoEstrutura(d)));
  else {
    partes.push(fmtNum(r.dist, 0) + ' de ' + fmtNum(r.total, 0) + ' lançados');
    partes.push('aproveitamento ' + fmtNum(pct, 1) + '%');
  }
  if (r.bonus > 0) {
    const b = [];
    if (r.tpBonus > 0) b.push(fmtNum(r.tpBonus, 1) + ' do TP');
    if (r.extrasBonus > 0) b.push(fmtNum(r.extrasBonus, 1) + ' extra');
    partes.push('inclui ' + b.join(' + '));
  }
  if (r.bonusRaw - r.bonus > 0.01) partes.push(fmtNum(r.bonusRaw - r.bonus, 1) + ' de bônus perdidos no teto');
  document.getElementById('det-status').textContent = partes.join(' · ');

  renderDetProjecao(d, r);
  renderDetInsights(d);

  const chk = document.getElementById('chk-show-as');
  if (chk) {
    chk.checked = d.showAS === true;
    chk.onchange = () => {
      d.showAS = chk.checked;
      saveState();
      renderDetalhe();
    };
  }

  // Avaliações (dinâmicas: AP1/AP2, AT, o que a estrutura tiver)
  document.getElementById('det-provas').innerHTML = d.provas.map(pv =>
    '<div class="section">'
    + '<div class="section-title">' + escapeHTML(pv.nome) + ' <span class="section-max">máx ' + fmtNum(pv.max, 1) + '</span></div>'
    + '<div class="grade-row">' + gradeDisplay(pv, pv.max) + gradeActions(pv.id) + '</div>'
    + '</div>'
  ).join('');

  // ACs — some se a estrutura não tem pool nem AC nenhuma
  const pool = d.acPool || 0;
  const secAc = document.getElementById('sec-ac');
  secAc.hidden = pool <= 0 && d.acs.length === 0;
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
      ? 'máx ' + fmtNum(pool, 1) + ' total · ' + fmtNum(pool / n, 1) + ' cada'
      : 'máx ' + fmtNum(pool, 1) + ' total · split igual';
  } else {
    acMaxEl.textContent = 'máx ' + fmtNum(pool, 1) + ' total';
  }

  const listaAcs = document.getElementById('lista-acs');
  if (d.acs.length === 0) {
    listaAcs.innerHTML = '<li class="empty">nenhuma atividade complementar</li>';
  } else if (acMode === 'equal') {
    const share = pool / d.acs.length;
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
      const has = hasVal(ac.value);
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
        saveDisc(d);
        renderDetalhe();
      }
    });
  });

  // Pontos extras (bônus somado na nota, teto no total — igual ao TP)
  const listaEx = document.getElementById('lista-extras');
  if (!d.extras.length) {
    listaEx.innerHTML = '<li class="empty">nenhum ponto extra</li>';
  } else {
    listaEx.innerHTML = d.extras.map(ex => {
      const has = hasVal(ex.value);
      const cls = !has ? 'empty' : (ex.expectativa ? 'exp' : '');
      const badge = ex.expectativa ? '<span class="badge-exp">prev</span>' : '';
      return '<li class="ac-item">'
        + '<div class="ac-body">'
        + '<div class="ac-nome">' + escapeHTML(ex.nome) + ' ' + badge + '</div>'
        + '<div class="ac-val">bônus direto na nota</div>'
        + '</div>'
        + '<div class="ac-grade ' + cls + '" data-ex-edit="' + ex.id + '">' + (has ? '+' + fmtNum(ex.value, 1) : '—') + '</div>'
        + '<button class="ac-del" data-ex-del="' + ex.id + '" aria-label="excluir">×</button>'
        + '</li>';
    }).join('');
  }
  listaEx.querySelectorAll('[data-ex-edit]').forEach(el => {
    el.addEventListener('click', () => openModalExtra(el.dataset.exEdit));
  });
  listaEx.querySelectorAll('[data-ex-del]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!confirm('Excluir ponto extra?')) return;
      d.extras = d.extras.filter(x => x.id !== el.dataset.exDel);
      saveDisc(d);
      renderDetalhe();
    });
  });

  // AS: showAS (toggle do usuário ou auto-trigger) ou nota já lançada mostram
  // a seção. Sem avaliação na estrutura não existe AS.
  const asM = asMaxDisc(d);
  document.getElementById('sec-as').hidden = asM <= 0;
  document.getElementById('det-as-toggle').hidden = asM <= 0;
  const rowAS = document.getElementById('row-as');
  const asInfo = document.getElementById('as-info');
  if (d.showAS === true || d.as.taken || d.as.value !== null) {
    rowAS.hidden = false;
    asInfo.style.display = 'none';
    rowAS.innerHTML = gradeDisplay(d.as, asM) + gradeActions('as');
    if (d.as.taken) {
      rowAS.innerHTML += '<div class="hint" style="margin-left:8px">Stars perdido</div>';
    }
  } else {
    rowAS.hidden = true;
    asInfo.style.display = 'block';
  }

  document.querySelectorAll('#s-detalhe [data-action="set-expectativa"], #s-detalhe [data-action="set-oficial"]').forEach(btn => {
    btn.addEventListener('click', () => openModalGrade(btn.dataset.tipo, btn.dataset.action === 'set-expectativa'));
  });
}

// ───────── RENDER: SIMULADOR ─────────

function ensureSim(discId) {
  if (!simState.disc) simState.disc = {};
  if (!simState.disc[discId]) simState.disc[discId] = {};
  const o = simState.disc[discId];
  if (!o.acs) o.acs = {};
  if (!o.provas) o.provas = {};
  return o;
}

// Pool de AC ainda sem atividade criada (vira o campo "AC restante").
function acRestante(d) {
  if ((d.acMode || 'custom') === 'equal') return d.acs.length === 0 ? (d.acPool || 0) : 0;
  return Math.max(0, (d.acPool || 0) - d.acs.reduce((s, ac) => s + (ac.valor || 0), 0));
}

function renderSimulador() {
  const body = document.getElementById('sim-body');
  if (per().disciplinas.length === 0) {
    body.innerHTML = '<p class="hint">crie disciplinas primeiro.</p>';
    updateSimResult();
    return;
  }

  body.innerHTML = per().disciplinas.map(d => renderSimDisc(d)).join('');

  const refreshDiscScore = (discId) => {
    const d = per().disciplinas.find(x => x.id === discId);
    if (!d) return;
    const r = calcDisc(d, simState.disc[discId] || {});
    const scoreEl = document.querySelector('.sim-disc[data-disc="' + discId + '"] .sim-disc-score');
    if (scoreEl) scoreEl.textContent = fmtNum(r.earned, 1) + '/' + fmtNum(r.total, 0);
  };

  body.querySelectorAll('input[type="number"][data-disc]').forEach(inp => {
    if (inp.readOnly) return;
    inp.addEventListener('input', () => {
      const discId = inp.dataset.disc;
      const key = inp.dataset.key;
      const simD = ensureSim(discId);
      let val = inp.value === '' ? undefined : parseFloat(inp.value);
      if (val !== undefined && !isNaN(val)) {
        const mx = parseFloat(inp.max);
        const clamped = Math.min(isNaN(mx) ? val : mx, Math.max(0, val));
        if (clamped !== val) { val = clamped; inp.value = String(val); }
      }
      const v = val === undefined || isNaN(val) ? undefined : val;
      if (key.startsWith('ac_')) simD.acs[key.slice(3)] = v;
      else if (key.startsWith('pv_')) simD.provas[key.slice(3)] = v;
      else if (key === 'acExtra') simD.acExtra = v;
      refreshDiscScore(discId);
      updateSimResult();
    });
  });

  body.querySelectorAll('.sim-toggle[data-disc]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.classList.contains('locked')) return;
      const simD = ensureSim(btn.dataset.disc);
      const acId = btn.dataset.ac;
      const cur = simD.acs[acId];
      const next = cur === undefined ? true : cur === true ? false : undefined;
      simD.acs[acId] = next;
      btn.className = 'sim-toggle' + (next === true ? ' on' : next === false ? ' off' : '');
      btn.textContent = next === true ? 'entregue' : next === false ? 'não entregue' : '—';
      refreshDiscScore(btn.dataset.disc);
      updateSimResult();
    });
  });

  updateSimResult();
}

function renderSimDisc(d) {
  const simD = (simState.disc && simState.disc[d.id]) || {};
  const r = calcDisc(d, simD);
  const mode = d.acMode || 'custom';

  const field = (key, label, max, realSlot, simVal) => {
    const realVal = realSlot && hasVal(realSlot.value) ? realSlot.value : null;
    const displayVal = realVal !== null ? fmtNum(realVal, 1) : (hasVal(simVal) ? simVal : '');
    const readonly = realVal !== null ? 'readonly' : '';
    const placeholder = realVal !== null ? fmtNum(realVal, 1) : '—';
    return '<div class="sim-field">'
      + '<label>' + label + '</label>'
      + '<input type="number" step="0.1" min="0" max="' + max + '"'
      + ' data-disc="' + d.id + '" data-key="' + key + '"'
      + ' value="' + displayVal + '"'
      + ' placeholder="' + placeholder + '"'
      + ' ' + readonly + '>'
      + '<span class="sim-max">/ ' + fmtNum(max, 1) + '</span>'
      + '</div>';
  };

  const provaFields = d.provas.map(pv =>
    field('pv_' + pv.id, escapeHTML(pv.nome), pv.max, pv, simD.provas && simD.provas[pv.id])
  ).join('');

  let acFields = '';
  if (mode === 'equal') {
    const share = d.acs.length > 0 ? (d.acPool || 0) / d.acs.length : 0;
    acFields = d.acs.map(ac => {
      const real = ac.delivered;
      const locked = real === true || real === false;
      const sim = simD.acs && simD.acs[ac.id];
      let st, label;
      if (locked) {
        st = real === true ? 'on' : 'off';
        label = real === true ? 'entregue' : 'não entregue';
      } else if (sim === true) { st = 'on'; label = 'entregue'; }
      else if (sim === false) { st = 'off'; label = 'não entregue'; }
      else { st = ''; label = '—'; }
      return '<div class="sim-field sim-field-toggle">'
        + '<label>' + escapeHTML(ac.nome) + '</label>'
        + '<button type="button" class="sim-toggle ' + st + (locked ? ' locked' : '') + '"'
        + ' data-disc="' + d.id + '" data-ac="' + ac.id + '">' + label + '</button>'
        + '<span class="sim-max">' + fmtNum(share, 1) + ' pts</span>'
        + '</div>';
    }).join('');
  } else {
    acFields = d.acs.map(ac => field('ac_' + ac.id, escapeHTML(ac.nome), ac.valor, ac, simD.acs && simD.acs[ac.id])).join('');
  }

  const restante = acRestante(d);
  let restanteSection = '';
  if (restante > 0.01) {
    restanteSection = '<div class="sim-field sim-field-extra">'
      + '<label>AC restante</label>'
      + '<input type="number" step="0.5" min="0" max="' + restante.toFixed(2) + '"'
      + ' data-disc="' + d.id + '" data-key="acExtra"'
      + ' value="' + (hasVal(simD.acExtra) ? simD.acExtra : '') + '" placeholder="0">'
      + '<span class="sim-max">/ ' + fmtNum(restante, 1) + '</span>'
      + '</div>'
      + '<p class="sim-extra-hint">pontos de AC ainda por criar ou lançar</p>';
  }

  const bonusTxt = r.bonus > 0 ? '<p class="sim-extra-hint">inclui ' + fmtNum(r.bonus, 1) + ' de bônus (TP/extras)</p>' : '';

  return '<div class="sim-disc" data-disc="' + d.id + '">'
    + '<div class="sim-disc-head">'
    + '<div class="sim-disc-nome">' + escapeHTML(d.nome) + '</div>'
    + '<div class="sim-disc-score">' + fmtNum(r.earned, 1) + '/' + fmtNum(r.total, 0) + '</div>'
    + '</div>'
    + provaFields
    + acFields
    + restanteSection
    + bonusTxt
    + '</div>';
}

function updateSimResult() {
  const p = calcPeriodo(simState);
  document.getElementById('sim-total').textContent = fmtNum(p.totalScore, 0);
  document.getElementById('sim-max').textContent = p.total || EMPTY_TOTAL_DEN;
  const pct = p.total > 0 ? Math.max(0, Math.min(100, (p.totalScore / p.total) * 100)) : 0;
  const bar = document.getElementById('sim-bar');
  bar.style.width = pct + '%';
  const hint = document.getElementById('sim-hint');

  if (p.n === 0) {
    bar.className = 'bar-fill';
    hint.textContent = 'sem disciplinas';
    return;
  }
  // Disciplina completa no cenário e abaixo de 70 = AS = fora do Stars.
  const abaixo = per().disciplinas.filter(d => {
    const r = calcDisc(d, (simState.disc && simState.disc[d.id]) || {});
    return r.dist >= r.total - 0.01 && r.earned < APROV_FRAC * r.total - 1e-9;
  }).map(d => d.nome);

  if (!p.starsEligible) {
    bar.className = 'bar-fill danger';
    hint.innerHTML = p.anyAS ? 'AS feita — inelegível pro Stars' : 'menos de ' + STARS_MIN_DISC + ' disciplinas — inelegível pro Stars';
  } else if (abaixo.length) {
    bar.className = 'bar-fill danger';
    hint.innerHTML = '<strong>' + escapeHTML(abaixo.join(', ')) + '</strong> fecha abaixo de 70 nesse cenário — AS elimina do Stars';
  } else if (p.totalScore >= p.starsNeeded) {
    bar.className = 'bar-fill success';
    hint.innerHTML = 'Stars garantido com <strong>' + fmtNum(p.totalScore, 0) + '</strong> pts';
  } else {
    bar.className = 'bar-fill accent';
    hint.innerHTML = 'faltam <strong>' + fmtNum(p.starsNeeded - p.totalScore, 1) + '</strong> pts pro Stars';
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
  newSave.style.display = '';
  newSave.addEventListener('click', () => {
    if (onSave()) modal.hidden = true;
  });
}

// Variante somente-leitura do modal (sem botão salvar) — resumos e consultas.
function openModalInfo(title, bodyHTML) {
  const modal = document.getElementById('modal');
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHTML;
  document.getElementById('modal-save').style.display = 'none';
  modal.hidden = false;
}

// Radio-group visual: marca .selected no label clicado (os modais re-injetam o HTML).
function wireRadioLabels(selector) {
  document.querySelectorAll(selector).forEach(lbl => {
    lbl.addEventListener('click', () => {
      document.querySelectorAll(selector).forEach(l => l.classList.remove('selected'));
      lbl.classList.add('selected');
    });
  });
}

// Botão "limpar" dos modais: onClear muta e persiste; depois fecha e re-renderiza.
function wireModalClear(onClear, rerender) {
  const el = document.getElementById('m-clear');
  if (el) el.addEventListener('click', () => {
    onClear();
    document.getElementById('modal').hidden = true;
    (rerender || renderDetalhe)();
  });
}

function kindRadios(expectativa) {
  return '<div class="radio-group" id="m-kind">'
    + '<label class="' + (!expectativa ? 'selected' : '') + '"><input type="radio" name="kind" value="oficial" ' + (!expectativa ? 'checked' : '') + '>oficial</label>'
    + '<label class="' + (expectativa ? 'selected' : '') + '"><input type="radio" name="kind" value="expectativa" ' + (expectativa ? 'checked' : '') + '>previsão</label>'
    + '</div>';
}

function kindEscolhido() {
  const checked = document.querySelector('input[name="kind"]:checked');
  return checked ? checked.value : 'oficial';
}

// Fechar modal: bind único (elementos estáticos; rebind por abertura vazava listeners)
document.querySelectorAll('#modal [data-close]').forEach(el => {
  el.addEventListener('click', () => { document.getElementById('modal').hidden = true; });
});

// Modal de estrutura: cria disciplina (com presets) ou edita a de uma
// existente. Avaliações + pool de AC têm que somar o total da disciplina.
function openModalEstrutura(d) {
  const novo = !d;
  let linhas = novo
    ? PRESETS.padrao.provas.map(([nome, max]) => ({ id: null, nome, max }))
    : d.provas.map(pv => ({ id: pv.id, nome: pv.nome, max: pv.max }));

  const presets = novo
    ? '<div class="est-presets" id="m-presets">'
      + Object.entries(PRESETS).map(([k, pr]) =>
        '<button type="button" class="est-preset' + (k === 'padrao' ? ' on' : '') + '" data-preset="' + k + '">' + escapeHTML(pr.label) + '</button>').join('')
      + '</div>'
    : '';

  openModal(
    novo ? 'nova disciplina' : 'estrutura · ' + d.nome,
    '<label>nome'
    + '<input type="text" id="m-nome" placeholder="ex: POO" value="' + (novo ? '' : escapeHTML(d.nome)) + '">'
    + '</label>'
    + presets
    + '<div class="est-bloco">'
    + '<div class="est-head"><span>avaliações</span><span>pontos</span></div>'
    + '<div id="m-provas" class="est-list"></div>'
    + '<button type="button" class="btn secondary sm" id="m-add-prova">+ avaliação</button>'
    + '</div>'
    + '<label>pool de ACs (pontos)'
    + '<input type="number" id="m-acpool" step="0.5" min="0" max="' + DISC_TOTAL + '" value="' + (novo ? PRESETS.padrao.acPool : d.acPool) + '">'
    + '</label>'
    + (novo
      ? '<label>criar ACs de valor igual agora'
        + '<input type="number" id="m-nacs" step="1" min="0" max="20" value="' + PRESETS.padrao.nAcs + '" placeholder="0">'
        + '</label>'
      : '')
    + '<label class="est-check"><input type="checkbox" id="m-temas"' + ((novo ? PRESETS.padrao.temAS : d.temAS !== false) ? ' checked' : '') + '>'
    + '<span>tem AS <em>substitui a avaliação de pior fração</em></span></label>'
    + '<p class="est-soma" id="m-soma"></p>'
    + '<p class="form-hint">avaliações + pool de AC somam ' + DISC_TOTAL + '. a AS é lançada na escala da maior avaliação; sem AS, fechar abaixo de 70 é reprovação direta.</p>',
    () => salvarEstrutura(d, lerLinhas())
  );

  const listEl = document.getElementById('m-provas');
  function desenhar() {
    listEl.innerHTML = linhas.length ? '' : '<p class="est-vazio">nenhuma avaliação. toque em + avaliação ou use só ACs.</p>';
    listEl.innerHTML += linhas.map((l, i) =>
      '<div class="est-row" data-i="' + i + '">'
      + '<input type="text" class="est-nome" value="' + escapeHTML(l.nome) + '" aria-label="nome da avaliação">'
      + '<input type="number" class="est-max" step="0.5" min="0.5" max="' + DISC_TOTAL + '" value="' + l.max + '" aria-label="pontos">'
      + '<button type="button" class="est-del" aria-label="remover">×</button>'
      + '</div>').join('');
    atualizarSoma();
  }
  function lerLinhas() {
    return Array.from(listEl.querySelectorAll('.est-row')).map(row => {
      const i = Number(row.dataset.i);
      return {
        id: linhas[i].id,
        nome: row.querySelector('.est-nome').value.trim(),
        max: parseFloat(row.querySelector('.est-max').value)
      };
    });
  }
  function atualizarSoma() {
    const soma = lerLinhas().reduce((s, l) => s + (isNaN(l.max) ? 0 : l.max), 0)
      + (parseFloat(document.getElementById('m-acpool').value) || 0);
    const el = document.getElementById('m-soma');
    const ok = Math.abs(soma - DISC_TOTAL) < 0.01;
    el.className = 'est-soma ' + (ok ? 'ok' : 'bad');
    el.textContent = 'soma: ' + fmtNum(soma, 1) + ' / ' + DISC_TOTAL
      + (ok ? ' ✓' : soma < DISC_TOTAL ? ' · faltam ' + fmtNum(DISC_TOTAL - soma, 1) : ' · sobram ' + fmtNum(soma - DISC_TOTAL, 1));
  }

  listEl.addEventListener('input', atualizarSoma);
  document.getElementById('m-acpool').addEventListener('input', atualizarSoma);
  listEl.addEventListener('click', e => {
    const del = e.target.closest('.est-del');
    if (!del) return;
    linhas = lerLinhas();
    linhas.splice(Number(del.parentNode.dataset.i), 1);
    desenhar();
  });
  document.getElementById('m-add-prova').addEventListener('click', () => {
    linhas = lerLinhas();
    linhas.push({ id: null, nome: 'Avaliação ' + (linhas.length + 1), max: 0 });
    desenhar();
  });
  const presetsEl = document.getElementById('m-presets');
  if (presetsEl) presetsEl.addEventListener('click', e => {
    const b = e.target.closest('[data-preset]');
    if (!b) return;
    const pr = PRESETS[b.dataset.preset];
    linhas = pr.provas.map(([nome, max]) => ({ id: null, nome, max }));
    document.getElementById('m-acpool').value = pr.acPool;
    document.getElementById('m-nacs').value = pr.nAcs;
    document.getElementById('m-temas').checked = pr.temAS;
    presetsEl.querySelectorAll('.est-preset').forEach(x => x.classList.toggle('on', x === b));
    desenhar();
  });
  desenhar();
  if (novo) document.getElementById('m-nome').focus();
}

function salvarEstrutura(d, linhas) {
  const nome = document.getElementById('m-nome').value.trim();
  const pool = parseFloat(document.getElementById('m-acpool').value) || 0;
  const temAS = document.getElementById('m-temas').checked;
  if (!nome) { alert('Nome obrigatório'); return false; }
  if (linhas.some(l => !l.nome)) { alert('Toda avaliação precisa de nome.'); return false; }
  if (linhas.some(l => isNaN(l.max) || l.max <= 0)) { alert('Toda avaliação precisa valer mais que 0.'); return false; }
  if (pool < 0) { alert('Pool de AC não pode ser negativo.'); return false; }
  if (!linhas.length && pool <= 0) { alert('A disciplina precisa de pelo menos uma avaliação ou pool de AC.'); return false; }
  const soma = linhas.reduce((s, l) => s + l.max, 0) + pool;
  if (Math.abs(soma - DISC_TOTAL) > 0.01) {
    alert('Avaliações + pool de AC somam ' + fmtNum(soma, 1) + '. Precisa fechar em ' + DISC_TOTAL + '.');
    return false;
  }

  if (!d) {
    const nAcs = Math.max(0, Math.min(20, parseInt(document.getElementById('m-nacs').value, 10) || 0));
    if (nAcs > 0 && pool <= 0) { alert('Sem pool de AC não dá pra criar ACs.'); return false; }
    per().disciplinas.push({
      id: uid(),
      nome,
      provas: linhas.map(l => ({ id: 'pv-' + uid(), nome: l.nome, max: l.max, value: null, expectativa: false })),
      acPool: pool,
      as: { value: null, expectativa: false, taken: false },
      acs: Array.from({ length: nAcs }, (_, i) => ({
        id: uid(), nome: 'AC ' + (i + 1), valor: Math.round((pool / nAcs) * 100) / 100,
        value: null, expectativa: false, delivered: null
      })),
      acMode: 'custom',
      extras: [],
      temAS,
      showAS: false,
      asAutoTriggered: false
    });
    saveState();
    renderDisciplinas();
    renderHome();
    return true;
  }

  // Edição: nada lançado pode ficar acima do novo máximo.
  for (const l of linhas) {
    const pv = l.id && d.provas.find(x => x.id === l.id);
    if (pv && hasVal(pv.value) && pv.value > l.max + 1e-9) {
      alert(l.nome + ' já tem nota ' + fmtNum(pv.value, 1) + ', acima do novo máximo de ' + fmtNum(l.max, 1) + '.');
      return false;
    }
  }
  const removidas = d.provas.filter(pv => !linhas.some(l => l.id === pv.id) && hasVal(pv.value));
  if (removidas.length && !confirm('Remover ' + removidas.map(pv => pv.nome).join(', ') + ' apaga a nota lançada. Continuar?')) return false;
  const acAlocado = d.acMode === 'equal' ? 0 : d.acs.reduce((s, ac) => s + (ac.valor || 0), 0);
  if (acAlocado > pool + 1e-9) {
    alert('As ACs já somam ' + fmtNum(acAlocado, 1) + ' pts, acima do novo pool de ' + fmtNum(pool, 1) + '. Ajuste ou exclua ACs antes.');
    return false;
  }
  if (!temAS && hasVal(d.as.value)) {
    alert('Essa disciplina tem AS lançada (' + fmtNum(d.as.value, 1) + '). Limpe a AS antes de tirar a opção.');
    return false;
  }
  const novoAsMax = linhas.reduce((m, l) => Math.max(m, l.max), 0);
  if (hasVal(d.as.value) && d.as.value > novoAsMax + 1e-9) {
    alert('A AS lançada (' + fmtNum(d.as.value, 1) + ') passa da nova escala da AS (' + fmtNum(novoAsMax, 1) + '). Limpe a AS antes.');
    return false;
  }

  d.nome = nome;
  d.provas = linhas.map(l => {
    const pv = l.id && d.provas.find(x => x.id === l.id);
    return pv
      ? Object.assign(pv, { nome: l.nome, max: l.max })
      : { id: 'pv-' + uid(), nome: l.nome, max: l.max, value: null, expectativa: false };
  });
  d.acPool = pool;
  d.temAS = temAS;
  if (!temAS) { d.showAS = false; d.asAutoTriggered = false; }
  if (simState.disc) delete simState.disc[d.id];
  saveDisc(d);
  renderDetalhe();
  return true;
}

function openModalAddDisc() {
  openModalEstrutura(null);
}

// tipo = id da avaliação ou 'as'
function openModalGrade(tipo, isExpectativa) {
  const d = discAtual();
  if (!d) return;
  const isAS = tipo === 'as';
  const pv = isAS ? null : d.provas.find(x => x.id === tipo);
  if (!isAS && !pv) return;
  const slot = isAS ? d.as : pv;
  const max = isAS ? asMaxDisc(d) : pv.max;
  const label = isAS ? 'AS' : pv.nome;
  const kindLabel = isExpectativa ? 'previsão' : 'oficial';

  const warnMsg = (isAS && !isExpectativa)
    ? '<p class="form-hint">Atenção: marcar AS oficial elimina sua elegibilidade ao Stars.</p>'
    : '';
  const clearBtn = hasVal(slot.value)
    ? '<button type="button" class="btn sm danger" id="m-clear">limpar nota</button>'
    : '';

  openModal(
    kindLabel + ' · ' + label + ' · ' + d.nome,
    '<label>nota (0 a ' + fmtNum(max, 1) + ')'
    + '<input type="number" id="m-grade" step="0.1" min="0" max="' + max + '" value="' + (hasVal(slot.value) ? slot.value : '') + '" autofocus>'
    + '</label>'
    + warnMsg
    + clearBtn,
    () => {
      const v = parseFloat(document.getElementById('m-grade').value);
      if (isNaN(v) || v < 0 || v > max) {
        alert('Nota inválida. Entre 0 e ' + fmtNum(max, 1));
        return false;
      }
      slot.value = v;
      slot.expectativa = isExpectativa;
      if (isAS) slot.taken = !isExpectativa;
      pushRecente({
        discId: d.id,
        discNome: d.nome,
        tipo,
        label,
        valor: v,
        max,
        kind: isExpectativa ? 'expectativa' : 'oficial'
      });
      saveDisc(d);
      renderDetalhe();
      return true;
    }
  );

  wireModalClear(() => {
    slot.value = null;
    slot.expectativa = false;
    if (isAS) slot.taken = false;
    saveDisc(d);
  });
}

function setAcMode(mode) {
  const d = discAtual();
  if (!d) return;
  const current = d.acMode || 'custom';
  if (current === mode) return;

  if (mode === 'equal') {
    d.acs.forEach(ac => {
      if (ac.delivered === undefined) ac.delivered = null;
    });
  } else {
    const n = d.acs.length;
    const share = n > 0 ? (d.acPool || 0) / n : 0;
    d.acs.forEach(ac => {
      if (!ac.valor || ac.valor <= 0) ac.valor = share;
    });
  }
  d.acMode = mode;
  saveDisc(d);
  renderDetalhe();
}

function openModalAcGrade(acId) {
  const d = discAtual();
  if (!d) return;
  const ac = d.acs.find(a => a.id === acId);
  if (!ac) return;

  const mode = d.acMode || 'custom';
  if (mode === 'equal') {
    const share = d.acs.length > 0 ? (d.acPool || 0) / d.acs.length : 0;
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
          acId: ac.id,
          label: 'AC · ' + ac.nome,
          valor: ac.delivered ? share : 0,
          max: share,
          kind: 'oficial'
        });
        saveDisc(d);
        renderDetalhe();
        return true;
      }
    );
    wireRadioLabels('#m-deliv label');
    wireModalClear(() => {
      ac.delivered = null;
      saveDisc(d);
    });
    return;
  }

  const clearBtn = hasVal(ac.value)
    ? '<button type="button" class="btn sm danger" id="m-clear">limpar nota</button>'
    : '';

  openModal(
    'lançar · ' + ac.nome,
    '<label>nota (0 a ' + fmtNum(ac.valor, 1) + ')'
    + '<input type="number" id="m-grade" step="0.1" min="0" max="' + ac.valor + '" value="' + (hasVal(ac.value) ? ac.value : '') + '" autofocus>'
    + '</label>'
    + kindRadios(ac.expectativa)
    + clearBtn,
    () => {
      const v = parseFloat(document.getElementById('m-grade').value);
      if (isNaN(v) || v < 0 || v > ac.valor) {
        alert('Nota inválida.');
        return false;
      }
      const kind = kindEscolhido();
      ac.value = v;
      ac.expectativa = kind === 'expectativa';
      pushRecente({
        discId: d.id,
        discNome: d.nome,
        tipo: 'ac',
        acId: ac.id,
        label: 'AC · ' + ac.nome,
        valor: v,
        max: ac.valor,
        kind
      });
      saveDisc(d);
      renderDetalhe();
      return true;
    }
  );

  wireRadioLabels('#m-kind label');
  wireModalClear(() => {
    ac.value = null;
    ac.expectativa = false;
    saveDisc(d);
  });
}

function openModalAddAc() {
  const d = discAtual();
  if (!d) return;
  const mode = d.acMode || 'custom';
  const pool = d.acPool || 0;

  if (mode === 'equal') {
    const nAfter = d.acs.length + 1;
    openModal(
      'nova atividade (AC)',
      '<label>nome'
      + '<input type="text" id="m-nome" placeholder="ex: lista 1" autofocus>'
      + '</label>'
      + '<p class="form-hint">split igual: depois de adicionar, cada uma vale ' + fmtNum(pool / nAfter, 1) + ' pts (' + nAfter + ' atividades).</p>',
      () => {
        const nome = document.getElementById('m-nome').value.trim();
        if (!nome) { alert('Nome obrigatório'); return false; }
        d.acs.push({ id: uid(), nome, valor: 0, value: null, expectativa: false, delivered: null });
        saveDisc(d);
        renderDetalhe();
        return true;
      }
    );
    return;
  }

  const restante = acRestante(d);

  openModal(
    'nova atividade (AC)',
    '<label>nome'
    + '<input type="text" id="m-nome" placeholder="ex: lista 1" autofocus>'
    + '</label>'
    + '<label>valor máximo (pontos)'
    + '<input type="number" id="m-valor" step="0.5" min="0" max="' + pool + '" placeholder="' + (restante || '—') + '">'
    + '</label>'
    + '<p class="form-hint">restam ' + fmtNum(restante, 1) + ' pts do pool de ' + fmtNum(pool, 1) + ' de AC.</p>',
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
      saveDisc(d);
      renderDetalhe();
      return true;
    }
  );
}

// Ponto extra: bônus fora da distribuição (participação, ponto do professor,
// trabalho extra). Soma direto na nota, com teto no total — igual ao TP.
function openModalExtra(exId) {
  const d = discAtual();
  if (!d) return;
  const ex = exId ? d.extras.find(x => x.id === exId) : null;
  if (exId && !ex) return;
  const total = discTotal(d);
  const clearBtn = ex && hasVal(ex.value)
    ? '<button type="button" class="btn sm danger" id="m-clear">limpar pontos</button>'
    : '';

  openModal(
    ex ? 'extra · ' + ex.nome : 'novo ponto extra',
    '<label>descrição'
    + '<input type="text" id="m-nome" placeholder="ex: participação" value="' + (ex ? escapeHTML(ex.nome) : '') + '">'
    + '</label>'
    + '<label>pontos'
    + '<input type="number" id="m-grade" step="0.1" min="0" max="' + total + '" value="' + (ex && hasVal(ex.value) ? ex.value : '') + '" placeholder="ex: 5">'
    + '</label>'
    + kindRadios(ex ? ex.expectativa : false)
    + '<p class="form-hint">soma direto na nota da disciplina, fora da distribuição, com teto de ' + fmtNum(total, 0) + '. vazio = extra combinado mas ainda sem valor.</p>'
    + clearBtn,
    () => {
      const nome = document.getElementById('m-nome').value.trim();
      const raw = document.getElementById('m-grade').value;
      if (!nome) { alert('Descrição obrigatória'); return false; }
      const v = raw === '' ? null : parseFloat(raw);
      if (v !== null && (isNaN(v) || v < 0 || v > total)) { alert('Pontos entre 0 e ' + fmtNum(total, 0)); return false; }
      const kind = kindEscolhido();
      const alvo = ex || { id: 'ex-' + uid() };
      alvo.nome = nome;
      alvo.value = v;
      alvo.expectativa = kind === 'expectativa';
      if (!ex) d.extras.push(alvo);
      if (v !== null) {
        pushRecente({
          discId: d.id, discNome: d.nome, tipo: 'extra', exId: alvo.id,
          label: 'Extra · ' + nome, valor: v, max: null, kind
        });
      }
      saveDisc(d);
      renderDetalhe();
      return true;
    }
  );
  wireRadioLabels('#m-kind label');
  wireModalClear(() => {
    ex.value = null;
    ex.expectativa = false;
    saveDisc(d);
  });
}

// Sugestão de alvo do TP: a disciplina onde o bônus vira mais ponto de
// verdade (menos corte no teto pela projeção) e, no empate, a com menor
// chance de passar direto.
function sugestaoTP(bonus) {
  const mc = projecaoPeriodo();
  if (!mc || !bonus) return null;
  let best = null;
  per().disciplinas.forEach((d, i) => {
    const pd = mc.perDisc[i];
    const r = calcDisc(d, { tp: null });
    const folga = Math.max(0, r.total - (pd.mean - (per().tp.applyTo === d.id ? calcDisc(d).tpBonus : 0)));
    const util = Math.min(bonus, folga);
    if (!best || util > best.util + 0.05 || (Math.abs(util - best.util) <= 0.05 && pd.pApprov < best.pApprov)) {
      best = { d, util, pApprov: pd.pApprov };
    }
  });
  return best;
}

function openModalTP() {
  const tp = per().tp;
  const bonusAtual = hasVal(tp.value) ? Math.round(tp.value * 10) : 7;
  const sug = sugestaoTP(bonusAtual);
  openModal(
    'teste de progresso',
    '<label>nota bruta (0 a 1)'
    + '<input type="number" id="m-grade" step="0.001" min="0" max="1" value="' + (hasVal(tp.value) ? tp.value : '') + '" placeholder="ex: 0.698" autofocus>'
    + '</label>'
    + '<p class="form-hint">bônus = round(nota × 10) pontos, somado na nota da disciplina alvo (teto de 100).</p>'
    + '<label>disciplina alvo'
    + '<select id="m-disc">'
    + '<option value="">— nenhuma —</option>'
    + per().disciplinas.map(d => {
        const r = calcDisc(d, { tp: null });
        return '<option value="' + d.id + '" ' + (tp.applyTo === d.id ? 'selected' : '') + '>'
          + escapeHTML(d.nome) + ' · ' + fmtNum(r.earned, 1) + '/' + fmtNum(r.total, 0) + '</option>';
      }).join('')
    + '</select>'
    + '</label>'
    + (sug ? '<p class="form-hint">sugestão: <strong>' + escapeHTML(sug.d.nome) + '</strong>, onde a projeção aproveita '
      + fmtNum(sug.util, 0) + ' dos ' + bonusAtual + ' pts sem bater no teto</p>' : '')
    + kindRadios(tp.expectativa)
    + (hasVal(tp.value) ? '<button type="button" class="btn sm danger" id="m-clear">limpar TP</button>' : ''),
    () => {
      const raw = document.getElementById('m-grade').value;
      if (raw === '') { alert('Nota obrigatória'); return false; }
      const v = parseFloat(raw);
      if (isNaN(v) || v < 0 || v > 1) { alert('Nota deve ser entre 0 e 1'); return false; }
      const applyTo = document.getElementById('m-disc').value || null;
      const kind = kindEscolhido();
      const antes = per().tp.applyTo;
      per().tp.value = v;
      per().tp.applyTo = applyTo;
      per().tp.expectativa = kind === 'expectativa';
      const disc = per().disciplinas.find(d => d.id === applyTo);
      pushRecente({
        discId: applyTo,
        discNome: disc ? disc.nome : '—',
        tipo: 'tp',
        label: 'TP (+' + Math.round(v * 10) + ' pts)',
        valor: v,
        max: 1,
        kind
      });
      // TP mexe na nota final: re-avalia o gatilho da AS nas duas pontas.
      per().disciplinas.forEach(d => { if (d.id === applyTo || d.id === antes) syncAsAutoTrigger(d); });
      saveState();
      renderHome();
      return true;
    }
  );

  wireRadioLabels('#m-kind label');

  wireModalClear(() => {
    const antes = per().tp.applyTo;
    per().tp = { value: null, expectativa: false, applyTo: null };
    per().disciplinas.forEach(d => { if (d.id === antes) syncAsAutoTrigger(d); });
    saveState();
  }, renderHome);
}

// ───────── BINDINGS ─────────

document.querySelectorAll('[data-goto]').forEach(el => {
  el.addEventListener('click', () => goto(el.dataset.goto));
});

document.getElementById('btn-add-disc').addEventListener('click', openModalAddDisc);

document.getElementById('btn-reset-periodo').addEventListener('click', () => {
  if (!confirm('Apagar os dados do período atual (' + per().nome + ')? Disciplinas, notas, TP e histórico DESTE período somem. Períodos arquivados não são afetados. (1/3)')) return;
  if (!confirm('Tem certeza? Esta ação é irreversível — nada pode ser recuperado. (2/3)')) return;
  if (!confirm('Última chance. Confirmar apagar tudo deste período? (3/3)')) return;
  const p = per();
  p.disciplinas = [];
  p.tp = { value: null, expectativa: false, applyTo: null };
  p.recentes = [];
  p.lancamentos = [];
  saveState();
  simState = {};
  currentDiscId = null;
  renderDisciplinas();
  renderHome();
  renderConfig();
});
document.getElementById('btn-edit-tp').addEventListener('click', openModalTP);
document.getElementById('btn-add-ac').addEventListener('click', openModalAddAc);
document.getElementById('btn-add-extra').addEventListener('click', () => openModalExtra(null));
document.getElementById('btn-edit-estrutura').addEventListener('click', () => {
  const d = discAtual();
  if (d) openModalEstrutura(d);
});

document.getElementById('btn-del-disc').addEventListener('click', () => {
  const d = per().disciplinas.find(x => x.id === currentDiscId);
  if (!d) return;
  if (confirm('Excluir "' + d.nome + '" e todas as suas notas?')) {
    per().disciplinas = per().disciplinas.filter(x => x.id !== currentDiscId);
    if (per().tp.applyTo === currentDiscId) per().tp.applyTo = null;
    per().recentes = per().recentes.filter(r => r.discId !== currentDiscId);
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
  per().disciplinas.forEach(d => {
    const o = ensureSim(d.id);
    d.provas.forEach(pv => { if (!hasVal(pv.value)) o.provas[pv.id] = pv.max; });
    if ((d.acMode || 'custom') === 'equal') {
      d.acs.forEach(ac => {
        if (ac.delivered !== true && ac.delivered !== false) o.acs[ac.id] = true;
      });
    } else {
      d.acs.forEach(ac => { if (!hasVal(ac.value)) o.acs[ac.id] = ac.valor; });
    }
    const restante = acRestante(d);
    if (restante > 0.01) o.acExtra = restante;
  });
  renderSimulador();
});

// Header: saudação + período ativo + data
function renderHeader() {
  const tagEl = document.getElementById('hdr-tagline');
  if (tagEl) tagEl.textContent = getSaudacao(state.gender);
  const metaEl = document.getElementById('hdr-meta');
  if (metaEl) {
    const dataStr = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
    metaEl.textContent = per().nome + ' · ' + dataStr;
  }
}
renderHeader();

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
  const perBtn = e.target.closest('[data-per-action]');
  if (perBtn) {
    handlePeriodoAction(perBtn.dataset.perAction, perBtn.dataset.perId);
    return;
  }
  if (e.target.closest('#btn-per-fechar')) {
    fecharPeriodo();
    return;
  }
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
        const looksV3 = parsed && Array.isArray(parsed.periodos);
        const looksV2 = parsed && Array.isArray(parsed.disciplinas)
          && parsed.tp && typeof parsed.tp === 'object';
        if (!parsed || typeof parsed !== 'object' || (!looksV3 && !looksV2)) {
          alert('Arquivo inválido: não parece um backup do CR9.');
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

// Limpeza de keys órfãs da antiga feature de sync (removida)
localStorage.removeItem('cr9-sync-code');
localStorage.removeItem('cr9-sync-ts');

renderHome();
