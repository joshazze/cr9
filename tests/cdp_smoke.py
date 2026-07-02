#!/usr/bin/env python3
"""Smoke da migração v2→v3 + telas básicas. Rodar: python3 tests/cdp_smoke.py"""
import json
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cdp_harness import Harness

FIX_V2 = {
    "v": 2, "gender": "m", "foco": "stars",
    "disciplinas": [
        {"id": "d1", "nome": "POO", "ap1": {"value": 32, "expectativa": False},
         "ap2": {"value": 28.5, "expectativa": False},
         "as": {"value": None, "expectativa": False, "taken": False},
         "acs": [{"id": "a1", "nome": "lista 1", "valor": 10, "value": 8, "expectativa": False, "delivered": None},
                  {"id": "a2", "nome": "lista 2", "valor": 10, "value": None, "expectativa": False, "delivered": None}],
         "acMode": "custom", "showAS": False, "asAutoTriggered": False},
        {"id": "d2", "nome": "ED", "ap1": {"value": 25, "expectativa": False},
         "ap2": {"value": None, "expectativa": False},
         "as": {"value": None, "expectativa": False, "taken": False},
         "acs": [], "acMode": "equal", "showAS": False, "asAutoTriggered": False},
        {"id": "d3", "nome": "EST", "ap1": {"value": 30, "expectativa": True},
         "ap2": {"value": None, "expectativa": False},
         "as": {"value": None, "expectativa": False, "taken": False},
         "acs": [], "acMode": "custom", "showAS": False, "asAutoTriggered": False},
        {"id": "d4", "nome": "PPS", "ap1": {"value": 38, "expectativa": False},
         "ap2": {"value": 35, "expectativa": False},
         "as": {"value": None, "expectativa": False, "taken": False},
         "acs": [], "acMode": "custom", "showAS": False, "asAutoTriggered": False},
    ],
    "tp": {"value": 0.7, "expectativa": False, "applyTo": "d1"},
    "recentes": [
        {"ts": 1780900000000, "discId": "d1", "discNome": "POO", "tipo": "ap1",
         "label": "AP1", "valor": 32, "max": 40, "kind": "oficial"},
        {"ts": 1779000000000, "discId": "d2", "discNome": "ED", "tipo": "ap1",
         "label": "AP1", "valor": 25, "max": 40, "kind": "oficial"},
    ],
}

fails = []


def check(name, cond, extra=""):
    if cond:
        print(f"ok - {name}")
    else:
        fails.append(name)
        print(f"FAIL - {name} {extra}")


h = Harness().start()
try:
    # 1. migração v2 → v3
    h.goto()
    h.set_state(FIX_V2)
    st = h.ev("JSON.parse(localStorage.getItem('cr9-v1'))")
    check("v3 após load", st["v"] == 3, f"v={st.get('v')}")
    check("1 período", len(st["periodos"]) == 1)
    check("período ativo", st["periodos"][0]["status"] == "ativo")
    check("periodoAtivoId coerente", st["periodoAtivoId"] == st["periodos"][0]["id"])
    check("disciplinas preservadas byte a byte",
          st["periodos"][0]["disciplinas"] == FIX_V2["disciplinas"],
          json.dumps(st["periodos"][0]["disciplinas"])[:200])
    check("tp preservado", st["periodos"][0]["tp"] == FIX_V2["tp"])
    check("lancamentos seedados", len(st["periodos"][0]["lancamentos"]) == 2)
    check("backup v2 gravado", h.ev("localStorage.getItem('cr9-v2-backup') !== null"))
    check("nome do período derivado dos dados", st["periodos"][0]["nome"] == "2026.1",
          st["periodos"][0].get("nome"))

    # 2. render sem erro + totalScore consistente
    total = h.ev("calcPeriodo().totalScore")
    # earned: POO 32+28.5+8 = 68.5; ED 25; EST 30; PPS 73 → 196.5 + TP 7 = 203.5
    check("totalScore migrado correto", abs(total - 203.5) < 1e-9, f"total={total}")
    hero = h.ev("document.getElementById('stars-num').textContent")
    check("hero renderizado", hero not in (None, "", "0"), f"hero={hero}")

    # 3. navegação pelas 5 telas sem exception
    for tela in ["s-disciplinas", "s-simulador", "s-config", "s-home"]:
        h.ev(f"goto('{tela}')")
    check("versão exibida = APP_VERSION",
          h.ev("document.getElementById('cfg-stat-ver').textContent") == h.ev("APP_VERSION"))

    # 4. idempotência da migração
    h.goto()
    st2 = h.ev("JSON.parse(localStorage.getItem('cr9-v1'))")
    # ids/nome/estrutura estáveis no segundo load
    check("migração idempotente",
          st2["periodos"][0]["id"] == st["periodos"][0]["id"]
          and st2["periodos"][0]["disciplinas"] == st["periodos"][0]["disciplinas"])

    # 5. import malformado NÃO pode bricar: disciplina vazia é saneada
    bad = {"v": 2, "disciplinas": [{"id": "x", "nome": "QUEBRADA"}], "tp": {}}
    h.set_state(bad)
    st3 = h.ev("JSON.parse(localStorage.getItem('cr9-v1'))")
    d0 = st3["periodos"][0]["disciplinas"][0]
    check("disciplina malformada saneada (ap1 default)",
          d0.get("ap1", {}).get("value", "MISSING") is None, json.dumps(d0)[:150])
    check("app renderiza com estado saneado",
          h.ev("document.getElementById('stars-num') !== null && per().disciplinas.length === 1"))

    # 6. estado vazio (primeiro uso)
    h.ev("localStorage.clear()")
    h.goto()
    check("primeiro uso cria período vazio",
          h.ev("state.v === 3 && state.periodos.length === 1 && per().disciplinas.length === 0"))

    # 7. lançar nota registra lancamento
    h.set_state(FIX_V2)
    h.ev("currentDiscId = 'd2'")
    h.ev("per().disciplinas.find(d=>d.id==='d2').ap2.value = 30;"
         "pushRecente({discId:'d2', discNome:'ED', tipo:'ap2', label:'AP2', valor:30, max:40, kind:'oficial'});"
         "saveState()")
    lan = h.ev("per().lancamentos[per().lancamentos.length-1]")
    check("pushRecente alimenta lancamentos",
          lan and lan["slot"] == "ap2" and lan["valor"] == 30 and lan["kind"] == "oficial",
          json.dumps(lan))

    # 8. gestão de períodos — fechar cria novo ativo e arquiva o atual
    h.set_state(FIX_V2)
    h.ev("window.prompt = (m, d) => d; window.confirm = () => true; window.alert = () => {}")
    h.ev("fecharPeriodo()")
    check("fechar: 2 períodos", h.ev("state.periodos.length === 2"))
    check("fechar: novo ativo vazio e nome sugerido",
          h.ev("per().nome === '2026.2' && per().disciplinas.length === 0"))
    check("fechar: antigo arquivado preservado",
          h.ev("state.periodos[0].status === 'arquivado' && state.periodos[0].disciplinas.length === 4"))
    check("header mostra o período novo",
          "2026.2" in (h.ev("document.getElementById('hdr-meta').textContent") or ""))

    # 9. reabrir faz swap mantendo o invariante de 1 ativo
    old_id = h.ev("state.periodos[0].id")
    h.ev(f"handlePeriodoAction('reabrir', '{old_id}')")
    check("reabrir: swap com 1 ativo",
          h.ev(f"per().id === '{old_id}' && state.periodos.filter(p => p.status === 'ativo').length === 1"))
    check("reabrir: dados intactos", h.ev("per().disciplinas.length === 4"))

    # 10. resumo read-only do arquivado
    arq_id = h.ev("state.periodos.find(p => p.status === 'arquivado').id")
    h.ev(f"handlePeriodoAction('ver', '{arq_id}')")
    check("resumo abre", h.ev("!document.getElementById('modal').hidden"))
    check("resumo esconde salvar",
          h.ev("document.getElementById('modal-save').style.display === 'none'"))
    h.ev("document.getElementById('modal').hidden = true")

    # 11. apagar arquivado (nunca o ativo)
    h.ev(f"handlePeriodoAction('apagar', '{arq_id}')")
    check("apagar arquivado",
          h.ev(f"state.periodos.length === 1 && state.periodos.every(p => p.id !== '{arq_id}')"))
    ativo_id = h.ev("per().id")
    h.ev(f"handlePeriodoAction('apagar', '{ativo_id}')")
    check("apagar do ativo é bloqueado", h.ev("state.periodos.length === 1"))

    # 12. openModal normal restaura o botão salvar depois do modal info
    h.ev("openModalAddDisc()")
    check("openModal restaura salvar",
          h.ev("document.getElementById('modal-save').style.display !== 'none'"))
    h.ev("document.getElementById('modal').hidden = true")

    # 13. probabilidade Monte Carlo: computed, estável, invariante de slots
    h.set_state(FIX_V2)
    check("fixture de notas baixas dá impossible (need > restante)",
          h.ev("calcStarsProbability(calcPeriodo()).state") == "impossible")

    disc_mc = []
    for i in range(4):
        disc_mc.append({
            "id": f"m{i}", "nome": f"M{i}",
            "ap1": {"value": 36, "expectativa": False},
            "ap2": {"value": None, "expectativa": False},
            "as": {"value": None, "expectativa": False, "taken": False},
            "acs": [], "acMode": "custom", "showAS": False, "asAutoTriggered": False,
        })
    fix_mc = {"v": 2, "gender": "m", "foco": "stars", "disciplinas": disc_mc,
              "tp": {"value": None, "expectativa": False, "applyTo": None}, "recentes": []}
    h.set_state(fix_mc)
    prob = h.ev("calcStarsProbability(calcPeriodo())")
    check("prob state computed", prob and prob.get("state") == "computed",
          json.dumps(prob)[:120] if prob else "None")
    check("pct plausível para rendimento 90%",
          prob and 20 < prob.get("pct", -1) < 100, str(prob.get("pct") if prob else None))
    p1 = h.ev("renderHome(), document.getElementById('prob-pct').textContent")
    p2 = h.ev("renderHome(), document.getElementById('prob-pct').textContent")
    check("pct estável entre re-renders (seed determinístico)",
          p1 == p2 and p1 not in ("—", ""), f"{p1!r} vs {p2!r}")
    inv = h.ev("(function(){const p = calcPeriodo(); const s = remainingSlots();"
               "return Math.abs(s.reduce((a, x) => a + x.max, 0) - (p.total - p.distReg)) < 1e-9})()")
    check("invariante Σslots = total − distReg", inv)
    check("faixa credível exibida no card",
          "–" in (h.ev("document.getElementById('prob-proj').textContent") or ""))

    # 14. B8: nota de PREVISÃO não trava o "garantido"
    disc_prev = []
    for i in range(4):
        disc_prev.append({
            "id": f"p{i}", "nome": f"D{i}",
            "ap1": {"value": 40, "expectativa": True},
            "ap2": {"value": 40, "expectativa": True},
            "as": {"value": None, "expectativa": False, "taken": False},
            "acs": [{"id": f"pa{i}", "nome": "ac", "valor": 20, "value": 20,
                      "expectativa": True, "delivered": None}],
            "acMode": "custom", "showAS": False, "asAutoTriggered": False,
        })
    fix_prev = {"v": 2, "gender": "m", "foco": "stars", "disciplinas": disc_prev,
                "tp": {"value": None, "expectativa": False, "applyTo": None}, "recentes": []}
    h.set_state(fix_prev)
    check("previsão total 400/360 mas NÃO garante",
          h.ev("document.getElementById('stars-status').textContent") == "Em progresso")
    check("hint pede virar oficial",
          "virar oficial" in (h.ev("document.getElementById('stars-hint').textContent") or ""))
    prob_prev = h.ev("calcStarsProbability(calcPeriodo())")
    check("prob 100% projetada sem lock",
          prob_prev.get("state") == "computed" and prob_prev.get("pct") == 100,
          json.dumps(prob_prev)[:120])

    # 15. AS oficial elimina
    import copy
    fix_as = copy.deepcopy(FIX_V2)
    fix_as["disciplinas"][3]["as"] = {"value": 30, "expectativa": False, "taken": True}
    h.set_state(fix_as)
    check("AS oficial → Fora do Stars",
          h.ev("document.getElementById('stars-status').textContent") == "Fora do Stars")
    check("prob state out",
          h.ev("calcStarsProbability(calcPeriodo()).state") == "out")

    # console limpo no fim
    check("console sem erros", not h.console, "; ".join(h.console[:5]))
finally:
    h.stop()

print()
if fails:
    print(f"{len(fails)} FALHAS: {fails}")
    sys.exit(1)
print("smoke v3 OK")
