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

function escapeHTML(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (e) {}
  return {
    v: 1,
    disciplinas: [],
    tp: { value: null, expectativa: false, applyTo: null },
    recentes: []
  };
}

function saveState() {
  localStorage.setItem(KEY, JSON.stringify(state));
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

  let acEarned = 0, acDist = 0;
  d.acs.forEach(ac => {
    const v = ov.acs && ov.acs[ac.id] !== undefined ? ov.acs[ac.id] : ac.value;
    if (v !== null && v !== undefined) {
      acEarned += v;
      acDist += ac.valor;
    }
  });

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
  const starsEligible = !anyAS;
  const starsProgress = starsNeeded > 0
    ? Math.min(totalScore / starsNeeded, 1) * 100
    : 0;

  return {
    n, total, starsNeeded,
    earnedReg, distReg,
    tpBonus, totalScore,
    aprov, anyAS,
    starsEligible, starsProgress
  };
}

function discStatus(d) {
  const r = calcDisc(d);
  if (r.dist === 0) return '';
  const pct = (r.earned / r.dist) * 100;
  if (pct >= 70) return 'ok';
  if (pct >= 60) return 'warn';
  return 'danger';
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
}

// ───────── RENDER: HOME ─────────

function renderHome() {
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
  } else if (!p.starsEligible) {
    hintEl.innerHTML = 'você fez AS — não pode mais pegar o Stars neste período';
  } else if (p.totalScore >= p.starsNeeded) {
    hintEl.innerHTML = 'você garantiu o Stars com ' + Math.round(p.totalScore) + ' pontos';
  } else {
    hintEl.innerHTML = 'faltam <strong>' + fmtNum(p.starsNeeded - p.totalScore, 1) + '</strong> pontos — ainda dá';
  }

  // Pontos distribuídos
  document.getElementById('pts-dist').textContent = fmtNum(p.distReg, 1);
  document.getElementById('pts-total').textContent = p.total || 500;
  const distPct = p.total > 0 ? (p.distReg / p.total) * 100 : 0;
  document.getElementById('bar-dist').style.width = distPct + '%';
  document.getElementById('dist-hint').textContent =
    (p.n === 0 || p.distReg === 0)
      ? 'nada lançado ainda'
      : fmtNum(distPct, 0) + '% do semestre lançado';

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
      const earnedW = Math.max(0, Math.min(100, r.earned));
      const distW = Math.max(0, Math.min(100, r.dist));
      return '<div class="bd-row">'
        + '<div class="bd-head">'
        + '<span class="bd-name">' + escapeHTML(d.nome) + '</span>'
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

// ───────── RENDER: DISCIPLINAS ─────────

function renderDisciplinas() {
  const lista = document.getElementById('lista-disciplinas');
  if (state.disciplinas.length === 0) {
    lista.innerHTML = '<li class="empty">nenhuma disciplina. toca em <strong>+ nova</strong>.</li>';
    return;
  }
  lista.innerHTML = state.disciplinas.map(d => {
    const r = calcDisc(d);
    const status = discStatus(d);
    const pct = r.dist > 0 ? (r.earned / r.dist * 100) : 0;
    const metaDist = fmtNum(r.dist, 0);
    const metaEarned = fmtNum(r.earned, 1);
    return '<li class="disc-item ' + status + '" data-id="' + d.id + '">'
      + '<div class="disc-info">'
      + '<div class="disc-nome">' + escapeHTML(d.nome) + '</div>'
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

  document.getElementById('det-nome').textContent = d.nome;

  const r = calcDisc(d);
  document.getElementById('det-earned').textContent = fmtNum(r.earned, 1);
  document.getElementById('det-dist').textContent = fmtNum(r.dist, 0);
  const pct = r.dist > 0 ? (r.earned / r.dist * 100) : 0;
  const detBar = document.getElementById('det-bar');
  detBar.style.width = Math.max(0, Math.min(100, r.earned)) + '%';
  if (r.dist === 0) detBar.className = 'bar-fill';
  else if (pct >= 70) detBar.className = 'bar-fill success';
  else if (pct >= 60) detBar.className = 'bar-fill warning';
  else detBar.className = 'bar-fill danger';

  document.getElementById('det-status').textContent =
    r.dist === 0 ? 'sem notas'
    : pct >= 70 ? 'aproveitamento ' + fmtNum(pct, 1) + '% · dentro da média'
    : pct >= 60 ? 'aproveitamento ' + fmtNum(pct, 1) + '% · abaixo da média'
    : 'aproveitamento ' + fmtNum(pct, 1) + '% · muito abaixo';

  document.getElementById('row-ap1').innerHTML = gradeDisplay(d.ap1, 40) + gradeActions('ap1');
  document.getElementById('row-ap2').innerHTML = gradeDisplay(d.ap2, 40) + gradeActions('ap2');

  // ACs
  const listaAcs = document.getElementById('lista-acs');
  if (d.acs.length === 0) {
    listaAcs.innerHTML = '<li class="empty">nenhuma atividade complementar</li>';
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
    listaAcs.querySelectorAll('[data-ac-edit]').forEach(el => {
      el.addEventListener('click', () => openModalAcGrade(el.dataset.acEdit));
    });
    listaAcs.querySelectorAll('[data-ac-del]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Excluir atividade?')) {
          d.acs = d.acs.filter(a => a.id !== el.dataset.acDel);
          saveState();
          renderDetalhe();
        }
      });
    });
  }

  // AS visibility
  const rowAS = document.getElementById('row-as');
  const asInfo = document.getElementById('as-info');
  const belowCutoff = r.earned < 70;
  if (belowCutoff || d.as.taken || d.as.value !== null) {
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

  body.querySelectorAll('input[data-disc]').forEach(inp => {
    if (inp.readOnly) return;
    inp.addEventListener('input', () => {
      const discId = inp.dataset.disc;
      const key = inp.dataset.key;
      if (!simState.disc) simState.disc = {};
      if (!simState.disc[discId]) simState.disc[discId] = { acs: {} };
      if (!simState.disc[discId].acs) simState.disc[discId].acs = {};
      const raw = inp.value;
      const val = raw === '' ? undefined : parseFloat(raw);
      if (key.startsWith('ac_')) {
        const acId = key.slice(3);
        simState.disc[discId].acs[acId] = isNaN(val) ? undefined : val;
      } else {
        simState.disc[discId][key] = isNaN(val) ? undefined : val;
      }
      // update the score for this disc
      const d = state.disciplinas.find(x => x.id === discId);
      if (d) {
        const simD = simState.disc[discId] || {};
        const r = calcDisc(d, simD);
        const scoreEl = document.querySelector('.sim-disc[data-disc="' + discId + '"] .sim-disc-score');
        if (scoreEl) scoreEl.textContent = fmtNum(r.earned, 1) + '/100';
      }
      updateSimResult();
    });
  });

  updateSimResult();
}

function renderSimDisc(d) {
  const simD = (simState.disc && simState.disc[d.id]) || {};
  const r = calcDisc(d, simD);

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

  const acFields = d.acs.map(ac => field('ac_' + ac.id, escapeHTML(ac.nome), ac.valor, ac)).join('');

  return '<div class="sim-disc" data-disc="' + d.id + '">'
    + '<div class="sim-disc-head">'
    + '<div class="sim-disc-nome">' + escapeHTML(d.nome) + '</div>'
    + '<div class="sim-disc-score">' + fmtNum(r.earned, 1) + '/100</div>'
    + '</div>'
    + field('ap1', 'AP1', 40, d.ap1)
    + field('ap2', 'AP2', 40, d.ap2)
    + acFields
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
        acs: []
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

function openModalAcGrade(acId) {
  const d = state.disciplinas.find(x => x.id === currentDiscId);
  if (!d) return;
  const ac = d.acs.find(a => a.id === acId);
  if (!ac) return;

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
      d.acs.push({ id: uid(), nome, valor, value: null, expectativa: false });
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
document.getElementById('btn-edit-tp').addEventListener('click', openModalTP);
document.getElementById('btn-add-ac').addEventListener('click', openModalAddAc);

document.getElementById('btn-del-disc').addEventListener('click', () => {
  const d = state.disciplinas.find(x => x.id === currentDiscId);
  if (!d) return;
  if (confirm('Excluir "' + d.nome + '" e todas as suas notas?')) {
    state.disciplinas = state.disciplinas.filter(x => x.id !== currentDiscId);
    if (state.tp.applyTo === currentDiscId) state.tp.applyTo = null;
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
    d.acs.forEach(ac => {
      if (ac.value === null || ac.value === undefined) o.acs[ac.id] = ac.valor;
    });
    simState.disc[d.id] = o;
  });
  renderSimulador();
});

// Header meta date
document.getElementById('hdr-meta').textContent =
  new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

// ───────── SERVICE WORKER ─────────

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

// ───────── INIT ─────────

renderHome();
