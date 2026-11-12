#!/usr/bin/env python3
"""v21: simulador novo, troca de período pelo cabeçalho, composição de avaliação.
Rodar: python3 tests/cdp_v21.py [outdir-screenshots]"""
import json
import os
import sys
import time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cdp_harness import Harness  # noqa: E402
from cdp_smoke_fixtures import FIX_V2  # noqa: E402

OUT = sys.argv[1] if len(sys.argv) > 1 else None
fails = []


def check(name, cond, extra=""):
    print(("ok - " if cond else "FAIL - ") + name + ("" if cond else f" {extra}"))
    if not cond:
        fails.append(name)


def shot(h, nome):
    if OUT:
        time.sleep(0.5)
        h.screenshot(f"{OUT}/{nome}.png")


h = Harness().start()
try:
    h.goto()
    h.set_state(FIX_V2)
    h.ev("window.prompt = (m, d) => d; window.confirm = () => true;"
         "window.__alerts = []; window.alert = m => window.__alerts.push(m)")

    # ── composição: AP2 = prova escrita 40 + pontos extras 4 (teto 40) ──
    d_ap2 = h.ev("(() => { const d = per().disciplinas.find(x => !x.provas[1].value && x.provas[1].value !== 0) || per().disciplinas[1];"
                 " return d.id })()")
    h.ev(f"openDetalhe('{d_ap2}')")
    h.ev("document.querySelector('[data-comp-edit]:nth-of-type(1)')")
    pv2 = h.ev(f"per().disciplinas.find(x => x.id === '{d_ap2}').provas[1].id")
    h.ev(f"document.querySelector('[data-comp-edit=\"{pv2}\"]').click()")
    check("modal de composição abre com escrita 40 + extras 4",
          h.ev("Array.from(document.querySelectorAll('.cl-max')).map(i => +i.value).join(',')") == "40,4")
    check("modal separa prova e extras",
          h.ev("document.querySelectorAll('#m-comp-prova .comp-linha').length") == 1
          and h.ev("document.querySelectorAll('#m-comp-ext .comp-linha').length") == 1)
    h.ev("document.querySelector('[data-comp-add=\"extra\"]').click()")
    check("+ ponto extra cai no bloco de extras", h.ev("document.querySelectorAll('#m-comp-ext .comp-linha').length") == 2)
    h.ev("document.querySelectorAll('#m-comp-ext .cl-del')[1].click()")
    shot(h, "v21_modal_composicao")
    h.ev("document.getElementById('modal-save').click()")
    check("composição salva", h.ev(f"per().disciplinas.find(x => x.id === '{d_ap2}').provas[1].comp.length") == 2)
    # lança 37 + 4 = 41 → AP2 = 40 (teto)
    h.ev(f"openModalGrade('{pv2}', false)")
    h.ev("{ const ins = document.querySelectorAll('.m-comp'); ins[0].value = '37'; ins[1].value = '4'; ins[0].dispatchEvent(new Event('input')) }")
    check("modal avisa que o extra transborda", "transborda pra" in (h.ev("document.getElementById('m-comp-tot').textContent") or ""))
    shot(h, "v21_modal_nota_composta")
    h.ev("document.getElementById('modal-save').click()")
    check("AP2 = min(40, 37+4) = 40", h.ev(f"per().disciplinas.find(x => x.id === '{d_ap2}').provas[1].value") == 40)
    D = f"per().disciplinas.find(x => x.id === '{d_ap2}')"
    ap1 = h.ev(f"{D}.provas[0].value")
    check("extra que passou de 40 vai pra AP1", abs(h.ev(f"calcDisc({D}).provasF[0]") - min(40, ap1 + 1)) < 1e-9,
          str(h.ev(f"calcDisc({D}).provasF")))
    check("detalhe mostra AP2 41/40", "41" in h.ev("document.querySelectorAll('#det-provas .grade-display')[1].textContent"))
    check("detalhe avisa aplicado na AP1", "aplicado na AP1" in h.ev("document.getElementById('det-provas').textContent"))
    check("AP1 mostra o que recebeu", "dos extras da AP2" in h.ev("document.getElementById('det-provas').textContent"))
    check("detalhe separa prova e extras", h.ev("document.querySelectorAll('#det-provas .comp-grupo.extra').length") == 1)
    shot(h, "v21_transborda_ap1")
    # AP1 cheia (40): sobra fica pendente, não some nem estoura
    h.ev(f"{D}.provas[0].value = 40; saveState(); renderDetalhe()")
    check("AP1 cheia: nada passa de 40", h.ev(f"calcDisc({D}).provasF[0]") == 40 and h.ev(f"calcDisc({D}).spillPend") == 1)
    h.ev(f"{D}.provas[0].value = {ap1}; saveState(); renderDetalhe()")
    # sem extra não transborda: principal sozinha não passa de 40
    check("sem extra, nada transborda",
          h.ev(f"(() => {{ const d = JSON.parse(JSON.stringify({D})); d.provas[1].comp[1].value = 0; d.provas[1].comp[0].value = 40; d.provas[1].value = 40; return calcDisc(d).spill.length }})()") == 0)
    h.ev(f"openModalGrade('{pv2}', false)")
    h.ev("{ const ins = document.querySelectorAll('.m-comp'); ins[0].value = '33'; ins[1].value = '3.5' }")
    h.ev("document.getElementById('modal-save').click()")
    check("AP2 = 33 + 3,5 = 36,5", h.ev(f"per().disciplinas.find(x => x.id === '{d_ap2}').provas[1].value") == 36.5)
    check("detalhe mostra as partes", "prova escrita" in h.ev("document.getElementById('det-provas').textContent"))
    shot(h, "v21_detalhe_composicao")
    # sobrevive à migração (reload)
    h.goto()
    check("comp persiste no reload",
          h.ev(f"per().disciplinas.find(x => x.id === '{d_ap2}').provas[1].comp.map(c => c.value).join(',')") == "33,3.5")
    h.ev("window.prompt = (m, d) => d; window.confirm = () => true; window.alert = () => {}")

    # limpa a AP2 pra testar o simulador composto
    h.ev(f"var d = per().disciplinas.find(x => x.id === '{d_ap2}'); d.provas[1].value = null; d.provas[1].comp.forEach(c => c.value = null); saveState()")

    # ── simulador ──
    h.ev("goto('s-simulador')")
    time.sleep(0.4)
    check("simulador mostra campos da composição", h.ev("document.querySelectorAll('.sim-comp input').length") == 2)
    check("barra real tem largura", h.ev("parseFloat(document.getElementById('sim-bar-real').style.width)") > 0)
    shot(h, "v21_simulador_vazio")
    h.ev("{ const ins = document.querySelectorAll('.sim-comp input'); ins[0].value = '38'; ins[0].dispatchEvent(new Event('input'));"
         " ins[1].value = '4'; ins[1].dispatchEvent(new Event('input')) }")
    check("sim compõe com teto (AP2 sim = 40)", h.ev(f"simState.disc['{d_ap2}'].provas['{pv2}']") == 40)
    check("sim: extra transborda pra AP1", h.ev(f"calcDisc(per().disciplinas.find(x => x.id === '{d_ap2}'), simState.disc['{d_ap2}']).spill.length") == 1)
    h.ev("document.getElementById('sim-fill-range').value = 85; document.getElementById('sim-fill-range').dispatchEvent(new Event('input'));"
         " document.getElementById('btn-fill-pct-sim').click()")
    total85 = h.ev("calcPeriodo(simState).totalScore")
    real = h.ev("calcPeriodo({}).totalScore")
    check("preencher 85% soma pontos", total85 > real, f"{total85} vs {real}")
    check("delta aparece no resumo", "+" in h.ev("document.getElementById('sim-delta').textContent"))
    shot(h, "v21_simulador_85")
    h.ev("document.getElementById('btn-fill-max-sim').click()")
    check("máximos: hint de Stars", "Stars" in h.ev("document.getElementById('sim-hint').textContent")
          or "abaixo" in h.ev("document.getElementById('sim-hint').textContent"))
    h.ev("document.getElementById('sim-fill-range').value = 60; document.getElementById('btn-fill-pct-sim').click()")
    shot(h, "v21_simulador_60")
    h.call("Emulation.setEmulatedMedia", {"media": "screen", "features": [{"name": "prefers-color-scheme", "value": "dark"}]})
    h.ev("document.getElementById('sim-fill-range').value = 85; document.getElementById('btn-fill-pct-sim').click()")
    shot(h, "v21_simulador_85_dark")
    h.call("Emulation.setEmulatedMedia", {"media": "screen", "features": [{"name": "prefers-color-scheme", "value": "light"}]})

    # ── troca de período ──
    n0 = h.ev("per().disciplinas.length")
    h.ev("document.querySelector('#hdr-meta [data-per-switch]').click()")
    check("modal de períodos abre", h.ev("document.querySelectorAll('.per-pick').length") == 1)
    h.ev("document.getElementById('m-per-novo').click()")
    check("novo período ativo e vazio", h.ev("per().disciplinas.length") == 0 and h.ev("state.periodos.length") == 2)
    check("simulador re-renderizou vazio", "crie disciplinas" in h.ev("document.getElementById('sim-body').textContent"))
    h.ev("document.getElementById('sim-per-chip').click()")
    shot(h, "v21_modal_periodos")
    h.ev("Array.from(document.querySelectorAll('.per-pick')).find(b => !b.classList.contains('on')).click()")
    check("voltou pro período antigo", h.ev("per().disciplinas.length") == n0)
    check("só um ativo", h.ev("state.periodos.filter(p => p.status === 'ativo').length") == 1)
    check("cabeçalho mostra o período", h.ev("per().nome") in h.ev("document.getElementById('hdr-meta').textContent"))
    shot(h, "v21_simulador_voltou")

    check("sem erro de console", not h.console, "; ".join(h.console[:5]))
finally:
    h.stop()

print(f"\n{len(fails)} falhas" if fails else "\ntudo verde")
sys.exit(1 if fails else 0)
