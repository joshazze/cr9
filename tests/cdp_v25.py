#!/usr/bin/env python3
"""v25: extra lançado com a prova em branco não fecha a avaliação.
AP2 = prova 40 + extras 4, só o extra (4) lançado: a AP2 segue vazia, os 4
somam na nota e o simulador libera o campo da prova com o extra travado.
Rodar: python3 tests/cdp_v25.py [outdir-screenshots]"""
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
    h.ev("window.prompt = (m, d) => d; window.confirm = () => true;"
         "window.__alerts = []; window.alert = m => window.__alerts.push(m)")
    did = h.ev("(() => { const d = per().disciplinas.find(x => x.provas.length >= 2 && x.provas[0].value != null"
               " && x.provas[1].value == null); return d ? d.id : null })()")
    check("fixture tem AP1 lançada e AP2 vazia", did is not None)
    D = f"per().disciplinas.find(x => x.id === '{did}')"
    pv2 = h.ev(f"{D}.provas[1].id")
    antes = h.ev(f"calcDisc({D}).earned")
    dist_antes = h.ev(f"calcDisc({D}).dist")

    # composição prova 40 + extras 4 e lança SÓ o extra, como previsão
    h.ev(f"openDetalhe('{did}')")
    h.ev(f"document.querySelector('[data-comp-edit=\"{pv2}\"]').click()")
    h.ev("document.getElementById('modal-save').click()")
    h.ev(f"openModalGrade('{pv2}', true)")
    h.ev("{ const ins = document.querySelectorAll('.m-comp'); ins[0].value = ''; ins[1].value = '4' }")
    h.ev("document.getElementById('modal-save').click()")
    check("só extra: AP2 segue vazia", h.ev(f"{D}.provas[1].value") is None, h.ev(f"{D}.provas[1].value"))
    check("extra guardado na parte", h.ev(f"{D}.provas[1].comp.find(c => c.extra).value") == 4)
    r = h.ev(f"(() => {{ const r = calcDisc({D}); return [r.earned, r.dist, r.provasF[1]] }})()")
    check("os 4 somam na nota sem distribuir a AP2", abs(r[0] - (antes + 4)) < 1e-9 and r[1] == dist_antes and r[2] is None, r)
    check("AP2 conta como espaço livre", any(s["type"] == "prova" and s["max"] == 40 for s in h.ev(f"slotsDisc({D})")))
    check("detalhe mostra o extra", "+4" in h.ev("document.getElementById('det-provas').textContent").replace(" ", ""))

    # simulador: prova editável, extra travado
    h.ev("goto('s-simulador'); simState = { disc: {} }; renderSimulador()")
    card = f"document.querySelector('.sim-disc[data-disc=\"{did}\"]')"
    ids = h.ev(f"{D}.provas[1].comp.map(c => c.id)")
    kp, kx = f"pc_{pv2}|{ids[0]}", f"pc_{pv2}|{ids[1]}"
    sel = lambda k: f"{card}.querySelector('input[data-key=\"{k}\"]')"
    check("campo da prova editável", h.ev(f"!!{sel(kp)} && !{sel(kp)}.readOnly"))
    check("extra previsto aparece com 4", h.ev(f"{sel(kx)}.value") == "4")
    h.ev(f"{{ const i = {sel(kp)}; i.value = '30'; i.dispatchEvent(new Event('input')) }}")
    r = h.ev(f"(() => {{ const r = calcDisc({D}, simState.disc['{did}']); return [r.provasF[1], r.earned] }})()")
    check("prova 30 + extra 4 = AP2 34", r[0] == 34 and abs(r[1] - (antes + 34)) < 1e-9, r)
    h.ev(f"{{ const i = {sel(kp)}; i.value = '38'; i.dispatchEvent(new Event('input')) }}")
    r = h.ev(f"calcDisc({D}, simState.disc['{did}']).provasF[1]")
    check("38 + 4: AP2 trava em 40", r == 40, r)
    h.ev(f"{{ const i = {sel(kp)}; i.value = ''; i.dispatchEvent(new Event('input')) }}")
    r = h.ev(f"(() => {{ const r = calcDisc({D}, simState.disc['{did}']); return [r.provasF[1], r.earned] }})()")
    check("apagou a prova: volta pros 4 soltos", r[0] is None and abs(r[1] - (antes + 4)) < 1e-9, r)
    h.ev("fillSim(0.75)")
    r = h.ev(f"calcDisc({D}, simState.disc['{did}']).provasF[1]")
    check("slider 75%: prova 30 + extra 4 = 34", r == 34, r)
    check("oficial ignora extra previsto", abs(h.ev(f"calcDiscOficialOnly({D}).earned") - h.ev(f"calcDiscOficialOnly({D}).earnedBase")) < 1e-9
          and h.ev(f"calcDiscOficialOnly({D}).earned") <= antes + 1e-9)
    if OUT:
        h.ev("simState = { disc: {} }; renderSimulador()")
        h.ev(f"{card}.scrollIntoView()")
        time.sleep(0.5)
        h.screenshot(f"{OUT}/v25_sim_extra_solto.png")

    # migração: dado antigo (pv.value = 4 só com extra) volta a ficar vazio
    h.ev(f"{{ const pv = {D}.provas[1]; pv.value = 4; saveState() }}")
    h.goto()
    check("migração esvazia AP2 com só extra", h.ev(f"{D}.provas[1].value") is None, h.ev(f"{D}.provas[1].value"))
finally:
    h.stop()

print(f"\n{len(fails)} falha(s)" if fails else "\ntudo ok")
sys.exit(1 if fails else 0)
