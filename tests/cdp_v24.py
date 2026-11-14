#!/usr/bin/env python3
"""v24: simulador separa pontos extras da prova padrão (sem composição).
Rodar: python3 tests/cdp_v24.py [outdir-screenshots]"""
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
    # disciplina com AP1 lançada e AP2 vazia, sem composição
    did = h.ev("(() => { const d = per().disciplinas.find(x => x.provas.length >= 2 && x.provas[0].value != null"
               " && x.provas[1].value == null && !temComp(x.provas[1])); return d ? d.id : null })()")
    check("fixture tem AP1 lançada e AP2 vazia", did is not None)
    D = f"per().disciplinas.find(x => x.id === '{did}')"
    ap1 = h.ev(f"{D}.provas[0].value")
    ap1max = h.ev(f"{D}.provas[0].max")
    pv2 = h.ev(f"{D}.provas[1].id")
    h.ev("goto('s-simulador'); simState = { disc: {} }; renderSimulador()")
    card = f"document.querySelector('.sim-disc[data-disc=\"{did}\"]')"
    check("AP2 vazia vira bloco com prova + pontos extras",
          h.ev(f"!!{card}.querySelector('[data-key=\"pv_{pv2}\"]') && !!{card}.querySelector('[data-key=\"px_{pv2}\"]')"))
    check("AP1 lançada não ganha campo de extras",
          h.ev(f"!{card}.querySelector('[data-key^=\"px_' + {D}.provas[0].id + '\"]')"))

    def put(key, v):
        h.ev(f"{{ const i = {card}.querySelector('[data-key=\"{key}\"]'); i.value = '{v}'; i.dispatchEvent(new Event('input')) }}")

    put(f"pv_{pv2}", 37)
    base = h.ev(f"calcDisc({D}, simState.disc['{did}']).provasF[1]")
    check("prova 37 sem extra = 37", base == 37, base)
    put(f"px_{pv2}", 2)
    r = h.ev(f"(() => {{ const r = calcDisc({D}, simState.disc['{did}']); return [r.provasF[0], r.provasF[1], r.spill.length] }})()")
    check("37 + 2 extras = 39, nada transborda", r[1] == 39 and r[2] == 0, r)
    put(f"px_{pv2}", 6)
    r = h.ev(f"(() => {{ const r = calcDisc({D}, simState.disc['{did}']); return [r.provasF[0], r.provasF[1], r.spillPend] }})()")
    esperado_ap1 = min(ap1max, ap1 + 3)
    check(f"37 + 6: AP2 = 40 e 3 vão pra AP1 ({ap1} -> {esperado_ap1})",
          r[1] == 40 and abs(r[0] - esperado_ap1) < 1e-9, r)
    put(f"pv_{pv2}", "")
    r = h.ev(f"calcDisc({D}, simState.disc['{did}']).provasF[1]")
    check("extra sem nota de prova não conta", r is None, r)
    put(f"pv_{pv2}", 40)
    put(f"px_{pv2}", 0)
    r = h.ev(f"calcDisc({D}, simState.disc['{did}']).spill.length")
    check("extra 0 não transborda", r == 0, r)
    real = h.ev(f"calcDisc({D}, {{}}).provasF[1]")
    check("nota real intacta", real is None, real)
    if OUT:
        put(f"pv_{pv2}", 37)
        put(f"px_{pv2}", 6)
        h.ev(f"{card}.scrollIntoView()")
        time.sleep(0.5)
        h.screenshot(f"{OUT}/v24_sim_extras.png")
finally:
    h.stop()

print(f"\n{len(fails)} falha(s)" if fails else "\ntudo ok")
sys.exit(1 if fails else 0)
