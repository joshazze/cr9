#!/usr/bin/env python3
"""Screenshots light/dark dos 3 focos, config, disciplinas, detalhe e modal de estrutura.
Uso: python3 tests/cdp_screens.py <outdir>"""
import sys
import os
import time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cdp_smoke_fixtures import FIX_V2  # noqa: E402
from cdp_harness import Harness  # noqa: E402

OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp"

h = Harness().start()
try:
    h.goto()
    h.set_state(FIX_V2)
    # série pra alimentar analytics + segundo período pro histórico
    h.ev("window.prompt = (m, d) => d; window.confirm = () => true; window.alert = () => {}")
    h.ev("per().lancamentos.push("
         "{ts: Date.now() - 3e5, discId: 'd1', slot: 'ap2', valor: 28.5, max: 40, kind: 'oficial'},"
         "{ts: Date.now() - 2e5, discId: 'd4', slot: 'ap1', valor: 38, max: 40, kind: 'oficial'},"
         "{ts: Date.now() - 1e5, discId: 'd4', slot: 'ap2', valor: 35, max: 40, kind: 'oficial'}"
         "); saveState()")
    for scheme in ("light", "dark"):
        h.call("Emulation.setEmulatedMedia",
               {"media": "screen",
                "features": [{"name": "prefers-color-scheme", "value": scheme}]})
        for foco, nome in (("stars", "home-stars"), ("tracking", "tracking"), ("registro", "registro")):
            h.ev(f"state.foco = '{foco}'; saveState(); goto('s-home')")
            time.sleep(0.6)  # espera a transição de tela assentar
            h.screenshot(f"{OUT}/cr9_{nome}_{scheme}.png")
        h.ev("goto('s-config')")
        time.sleep(0.6)
        h.screenshot(f"{OUT}/cr9_config_{scheme}.png")
        h.ev("goto('s-disciplinas')")
        time.sleep(0.6)
        h.screenshot(f"{OUT}/cr9_disciplinas_{scheme}.png")
        # detalhe com TP + extra + projeção
        h.ev("var d = per().disciplinas[0]; if (!d.extras.length) d.extras.push("
             "{id: 'ex1', nome: 'participação', value: 2, expectativa: false}); saveState(); openDetalhe('d1')")
        time.sleep(0.6)
        h.screenshot(f"{OUT}/cr9_detalhe_{scheme}.png")
        # modal de nova disciplina com o preset AT
        h.ev("goto('s-disciplinas'); openModalAddDisc(); document.querySelector('[data-preset=\"livre\"]').click()")
        time.sleep(0.6)
        h.screenshot(f"{OUT}/cr9_modal_estrutura_{scheme}.png")
        h.ev("document.getElementById('modal').hidden = true")
    print("screenshots em", OUT)
finally:
    h.stop()
