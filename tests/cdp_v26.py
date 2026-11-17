#!/usr/bin/env python3
"""v26: previsões editáveis no simulador (override temporário + "gravar").
Rodar: python3 tests/cdp_v26.py [outdir-screenshots]"""
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


h = Harness().start()
try:
    h.goto()
    h.set_state(FIX_V2)
    did = h.ev("(() => { const d = per().disciplinas.find(x => x.provas.length >= 2 && x.provas[0].value != null"
               " && x.provas[1].value == null && !temComp(x.provas[1])); return d ? d.id : null })()")
    check("fixture tem AP2 vazia", did is not None)
    D = f"per().disciplinas.find(x => x.id === '{did}')"
    pv1, pv2 = h.ev(f"{D}.provas[0].id"), h.ev(f"{D}.provas[1].id")
    h.ev(f"{{ const pv = {D}.provas[1]; pv.value = 30; pv.expectativa = true; saveState() }}")
    oficial_ap1 = h.ev(f"{D}.provas[0].expectativa") is False

    h.ev("goto('s-simulador'); simState = { disc: {} }; renderSimulador()")
    card = f"document.querySelector('.sim-disc[data-disc=\"{did}\"]')"
    inp = lambda k: f"{card}.querySelector('input[data-key=\"{k}\"]')"
    gbtn = lambda k: f"{card}.querySelector('.sim-gravar[data-key=\"{k}\"]')"
    put = lambda k, v: h.ev(f"{{ const i = {inp(k)}; i.value = '{v}'; i.dispatchEvent(new Event('input')) }}")

    check("previsão editável", h.ev(f"!{inp('pv_' + pv2)}.readOnly && {inp('pv_' + pv2)}.value") == "30")
    if oficial_ap1:
        check("oficial segue travada", h.ev(f"{inp('pv_' + pv1)}.readOnly"))
    check("gravar escondido sem mudança", h.ev(f"{gbtn('pv_' + pv2)}.hidden"))
    put("pv_" + pv2, 36)
    check("simula 36 por cima da previsão", h.ev(f"calcDisc({D}, simState.disc['{did}']).provasF[1]") == 36)
    check("previsão salva intacta", h.ev(f"{D}.provas[1].value") == 30)
    check("gravar aparece", not h.ev(f"{gbtn('pv_' + pv2)}.hidden"))
    put("pv_" + pv2, "")
    check("limpar volta pra previsão", h.ev(f"calcDisc({D}, simState.disc['{did}']).provasF[1]") == 30)
    check("gravar some de novo", h.ev(f"{gbtn('pv_' + pv2)}.hidden"))
    put("pv_" + pv2, 36)
    if OUT:
        h.ev(f"{card}.scrollIntoView()")
        time.sleep(0.4)
        h.screenshot(f"{OUT}/v26_prev_editavel.png")
    h.ev(f"{gbtn('pv_' + pv2)}.click()")
    check("gravar vira nova previsão", h.ev(f"[{D}.provas[1].value, {D}.provas[1].expectativa]") == [36, True])
    check("override do simulado some", h.ev(f"simState.disc['{did}'].provas['{pv2}']") is None)
    h.goto()
    check("persistiu no reload", h.ev(f"{D}.provas[1].value") == 36)

    # composição em previsão: partes editáveis
    h.ev(f"{{ const pv = {D}.provas[1]; pv.comp = [{{id:'c1',nome:'prova',max:40,extra:false,value:30}},"
         "{id:'c2',nome:'pontos extras',max:4,extra:true,value:4}]; pv.value = 34; pv.expectativa = true; saveState() }")
    h.ev("goto('s-simulador'); simState = { disc: {} }; renderSimulador()")
    kp = f"pc_{pv2}|c1"
    check("parte da prova em previsão editável", h.ev(f"!{inp(kp)}.readOnly && {inp(kp)}.value") == "30")
    put(kp, 25)
    check("25 + extra 4 = 29", h.ev(f"calcDisc({D}, simState.disc['{did}']).provasF[1]") == 29)
    h.ev(f"{gbtn(kp)}.click()")
    check("gravar parte: AP2 prev = 29", h.ev(f"[{D}.provas[1].value, {D}.provas[1].comp[0].value]") == [29, 25])

    # botão de desligar extras da avaliação
    h.ev("simState = { disc: {} }; renderSimulador()")
    tog = f"{card}.querySelector('.sim-ext-tog[data-pv=\"{pv2}\"]')"
    check("bloco com extras tem botão ligado", h.ev(f"!!{tog} && !{tog}.classList.contains('off')"))
    antes = h.ev(f"calcDisc({D}, simState.disc['{did}'] || {{}}).provasF[1]")
    h.ev(f"{tog}.click()")
    r = h.ev(f"calcDisc({D}, simState.disc['{did}']).provasF[1]")
    check(f"desligado: AP2 {antes} -> só a prova 25", r == 25, r)
    check("botão mostra desligado", h.ev(f"{tog}.classList.contains('off')"))
    h.ev(f"{tog}.click()")
    check("religado volta", h.ev(f"calcDisc({D}, simState.disc['{did}']).provasF[1]") == antes)
    check("nota real intacta", h.ev(f"{D}.provas[1].value") == 29)
    # prova aberta só com extra: desligar zera o extra solto
    h.ev(f"{{ const pv = {D}.provas[1]; pv.comp[0].value = null; pv.value = null; saveState() }}")
    h.ev("simState = { disc: {} }; renderSimulador()")
    e1 = h.ev(f"calcDisc({D}, simState.disc['{did}'] || {{}}).earned")
    h.ev(f"{tog}.click()")
    e2 = h.ev(f"calcDisc({D}, simState.disc['{did}']).earned")
    check("extra solto some ao desligar", abs(e1 - e2 - 4) < 1e-9, [e1, e2])
    if OUT:
        h.ev(f"{card}.scrollIntoView()")
        time.sleep(0.4)
        h.screenshot(f"{OUT}/v26_extras_off.png")
finally:
    h.stop()

print(f"\n{len(fails)} falha(s)" if fails else "\ntudo ok")
sys.exit(1 if fails else 0)
