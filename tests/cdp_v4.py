#!/usr/bin/env python3
"""v4: TP somado na nota, estrutura personalizada, pontos extras, projeção.
Rodar: python3 tests/cdp_v4.py"""
import copy
import json
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cdp_harness import Harness
from cdp_smoke_fixtures import FIX_V2

fails = []


def check(name, cond, extra=""):
    if cond:
        print(f"ok - {name}")
    else:
        fails.append(name)
        print(f"FAIL - {name} {extra}")


def txt(h, sel):
    return h.ev(f"(document.querySelector({json.dumps(sel)}) || {{}}).textContent || ''")


h = Harness().start()
try:
    h.goto()
    h.set_state(FIX_V2)
    h.ev("window.prompt = (m, d) => d; window.confirm = () => true;"
         "window.__alerts = []; window.alert = m => window.__alerts.push(m)")

    # 1. TP soma na nota da disciplina em TODA tela (POO 68,5 + 7 = 75,5)
    check("calcDisc inclui TP", h.ev("calcDisc(per().disciplinas[0]).earned") == 75.5)
    h.ev("goto('s-disciplinas')")
    lista = txt(h, "#lista-disciplinas .disc-item[data-id='d1'] .disc-pts")
    check("lista de disciplinas mostra 75,5", lista.startswith("75,5"), lista)
    h.ev("openDetalhe('d1')")
    check("detalhe mostra 75,5", txt(h, "#det-earned") == "75,5", txt(h, "#det-earned"))
    check("detalhe explica o TP", "7 do TP" in txt(h, "#det-status"), txt(h, "#det-status"))
    h.ev("state.foco = 'stars'; goto('s-home')")
    soma_bd = h.ev("Array.from(document.querySelectorAll('#bd-body .bd-val'))"
                   ".reduce((s, e) => s + parseFloat(e.textContent.split('/')[0].replace(',', '.')), 0)")
    hero = h.ev("Number(document.getElementById('stars-num').textContent)")
    check("soma do detalhamento = total do hero", abs(soma_bd - hero) < 1, f"{soma_bd} vs {hero}")

    # 2. teto de 100: TP numa disciplina de 97 só conta 3
    fix = copy.deepcopy(FIX_V2)
    d4 = fix["disciplinas"][3]
    d4["acs"] = [{"id": "pa", "nome": "ac", "valor": 20, "value": 20, "expectativa": False, "delivered": None}]
    d4["ap2"]["value"] = 39  # 38 + 39 + 20 = 97
    fix["tp"] = {"value": 0.7, "expectativa": False, "applyTo": "d4"}
    h.set_state(fix)
    r = h.ev("calcDisc(per().disciplinas[3])")
    check("teto: 97 + 7 TP fecha em 100", r["earned"] == 100 and r["tpBonus"] == 3, json.dumps(r)[:120])
    h.ev("openDetalhe('d4')")
    check("detalhe avisa bônus perdido no teto", "perdidos no teto" in txt(h, "#det-status"), txt(h, "#det-status"))
    total = h.ev("calcPeriodo().totalScore")
    soma = h.ev("per().disciplinas.reduce((s, d) => s + calcDisc(d).earned, 0)")
    check("total do período respeita o teto", abs(total - soma) < 1e-9, f"{total} vs {soma}")

    # 3. nova disciplina pelo modal com preset AT + 2 ACs
    h.set_state(FIX_V2)
    h.ev("window.prompt = (m, d) => d; window.confirm = () => true;"
         "window.__alerts = []; window.alert = m => window.__alerts.push(m)")
    h.ev("goto('s-disciplinas'); document.getElementById('btn-add-disc').click()")
    h.ev("document.getElementById('m-nome').value = 'CÁLCULO'")
    h.ev("document.querySelector('[data-preset=\"at\"]').click()")
    check("preset AT mostra soma 100", "100 / 100" in txt(h, "#m-soma"), txt(h, "#m-soma"))
    # soma errada é barrada
    h.ev("document.querySelector('.est-row .est-max').value = 50;"
         "document.querySelector('.est-row .est-max').dispatchEvent(new Event('input', {bubbles: true}))")
    check("soma parcial avisa quanto falta", "faltam 10" in txt(h, "#m-soma"), txt(h, "#m-soma"))
    h.ev("document.getElementById('modal-save').click()")
    check("soma ≠ 100 não salva", h.ev("per().disciplinas.length") == 4 and h.ev("window.__alerts.length") == 1)
    h.ev("document.querySelector('.est-row .est-max').value = 60")
    h.ev("document.getElementById('modal-save').click()")
    nova = h.ev("per().disciplinas[4]")
    check("disciplina AT criada",
          nova and nova["nome"] == "CÁLCULO" and len(nova["provas"]) == 1 and nova["provas"][0]["max"] == 60
          and nova["acPool"] == 40 and len(nova["acs"]) == 2 and all(a["valor"] == 20 for a in nova["acs"]),
          json.dumps(nova)[:200])

    # 4. detalhe da AT: 1 avaliação, lançar 54/60 pelo modal
    nid = nova["id"]
    h.ev(f"openDetalhe('{nid}')")
    check("detalhe renderiza 1 avaliação (AT)", h.ev("document.querySelectorAll('#det-provas .section').length") == 1)
    check("total da AT é 100", txt(h, "#det-total") == "100")
    h.ev("document.querySelector('#det-provas [data-action=\"set-oficial\"]').click()")
    h.ev("document.getElementById('m-grade').value = 54; document.getElementById('modal-save').click()")
    r = h.ev(f"calcDisc(per().disciplinas.find(d => d.id === '{nid}'))")
    check("AT 54/60 lançada", r["earned"] == 54 and r["dist"] == 60, json.dumps(r)[:120])
    lan = h.ev("per().lancamentos[per().lancamentos.length - 1]")
    check("lançamento da AT na série com max 60", lan["max"] == 60 and lan["slot"] == nova["provas"][0]["id"])

    # 5. AS na escala da maior avaliação (60) substitui a AT se for melhor
    h.ev(f"var dd = per().disciplinas.find(d => d.id === '{nid}'); dd.as.value = 57; dd.as.expectativa = true; saveDisc(dd)")
    check("AS 57/60 substitui AT 54", h.ev(f"calcDisc(per().disciplinas.find(d => d.id === '{nid}')).earned") == 57)
    h.ev(f"var dd = per().disciplinas.find(d => d.id === '{nid}'); dd.as.value = null; saveDisc(dd)")

    # 6. pontos extras pelo modal: +5 na nota, previsão fica fora do oficial
    h.ev(f"openDetalhe('{nid}'); document.getElementById('btn-add-extra').click()")
    h.ev("document.getElementById('m-nome').value = 'participação';"
         "document.getElementById('m-grade').value = 5;"
         "document.querySelector('#m-kind input[value=\"expectativa\"]').checked = true;"
         "document.getElementById('modal-save').click()")
    r = h.ev(f"calcDisc(per().disciplinas.find(d => d.id === '{nid}'))")
    check("extra soma na nota", r["earned"] == 59 and r["extrasBonus"] == 5, json.dumps(r)[:120])
    of = h.ev(f"calcDiscOficialOnly(per().disciplinas.find(d => d.id === '{nid}')).earned")
    check("extra de previsão fora do oficial", of == 54, str(of))
    check("extra aparece entre ACs e AS",
          h.ev("(function(){const ids = Array.from(document.querySelectorAll('#s-detalhe > .section, #s-detalhe > #det-provas')).map(e => e.id);"
               "return ids.indexOf('sec-ac') < ids.indexOf('sec-extras') && ids.indexOf('sec-extras') < ids.indexOf('sec-as')})()"))
    check("badge de extra no card de pontos", "+5 extra" in txt(h, "#det-bonus"), txt(h, "#det-bonus"))

    # 7. editar estrutura: max abaixo de nota lançada é barrado; mudança válida preserva id e nota
    h.set_state(FIX_V2)
    h.ev("window.confirm = () => true; window.__alerts = []; window.alert = m => window.__alerts.push(m)")
    h.ev("openDetalhe('d1'); document.getElementById('btn-edit-estrutura').click()")
    h.ev("var rows = document.querySelectorAll('.est-row'); rows[0].querySelector('.est-max').value = 30;"
         "rows[1].querySelector('.est-max').value = 50; document.getElementById('modal-save').click()")
    check("max abaixo da nota lançada é barrado",
          h.ev("per().disciplinas[0].provas[0].max") == 40 and h.ev("window.__alerts.length") == 1,
          str(h.ev("window.__alerts")))
    h.ev("var rows = document.querySelectorAll('.est-row'); rows[0].querySelector('.est-max').value = 35;"
         "rows[1].querySelector('.est-max').value = 45; rows[0].querySelector('.est-nome').value = 'P1';"
         "document.getElementById('modal-save').click()")
    pv = h.ev("per().disciplinas[0].provas")
    check("estrutura editada preserva id e nota",
          pv[0]["id"] == "ap1" and pv[0]["nome"] == "P1" and pv[0]["max"] == 35 and pv[0]["value"] == 32
          and pv[1]["max"] == 45, json.dumps(pv)[:160])

    # 8. projeção no detalhe
    h.ev("openDetalhe('d2')")
    check("card de projeção visível", h.ev("!document.getElementById('det-proj').hidden"))
    proj = txt(h, "#det-proj-body")
    check("projeção traz metas e chances", "pra passar" in proj and "pra 9,0" in proj and "passar direto" in proj, proj[:160])

    # 9. garantido exige toda disciplina aprovada
    discs = []
    for i in range(4):
        discs.append({"id": f"g{i}", "nome": f"G{i}", "ap1": {"value": 40, "expectativa": False},
                      "ap2": {"value": 40, "expectativa": False},
                      "as": {"value": None, "expectativa": False, "taken": False},
                      "acs": [{"id": f"ga{i}", "nome": "ac", "valor": 20, "value": 20, "expectativa": False, "delivered": None}],
                      "acMode": "custom", "showAS": False, "asAutoTriggered": False})
    discs.append({"id": "g4", "nome": "FRACA", "ap1": {"value": 38, "expectativa": False},
                  "ap2": {"value": None, "expectativa": False},
                  "as": {"value": None, "expectativa": False, "taken": False},
                  "acs": [{"id": "ga4", "nome": "ac", "valor": 20, "value": 17, "expectativa": False, "delivered": None}],
                  "acMode": "custom", "showAS": False, "asAutoTriggered": False})
    fix_g = {"v": 2, "gender": "m", "foco": "stars", "disciplinas": discs,
             "tp": {"value": None, "expectativa": False, "applyTo": None}, "recentes": []}
    h.set_state(fix_g)
    st = h.ev("calcStarsProbability(calcPeriodo())")
    check("455 oficiais com FRACA em 55 NÃO é garantido", st["state"] == "computed", json.dumps(st)[:120])
    check("hero não diz No Stars", txt(h, "#stars-status") != "No Stars", txt(h, "#stars-status"))

    # 10. impossível por reprova: disciplina que não alcança 70
    fix_r = copy.deepcopy(fix_g)
    fix_r["disciplinas"][4]["ap1"]["value"] = 5
    fix_r["disciplinas"][4]["acs"][0]["value"] = 5
    h.set_state(fix_r)
    st = h.ev("calcStarsProbability(calcPeriodo())")
    check("impossível por reprova", st["state"] == "impossible" and st.get("motivo") == "reprova", json.dumps(st)[:120])
    check("hint nomeia a disciplina", "FRACA" in txt(h, "#prob-hint"), txt(h, "#prob-hint"))

    # 11. simulador com disciplina personalizada: preencher máximos fecha 100 em cada
    h.set_state(FIX_V2)
    h.ev("per().disciplinas.push({id: 'cx', nome: 'AT', provas: [{id: 'at', nome: 'AT', max: 60, value: null, expectativa: false}],"
         "acPool: 40, acs: [], acMode: 'custom', extras: [], as: {value: null, expectativa: false, taken: false},"
         "showAS: false, asAutoTriggered: false}); saveState(); goto('s-simulador')")
    check("simulador mostra campo da AT", h.ev("!!document.querySelector('[data-key=\"pv_at\"]')"))
    h.ev("document.getElementById('btn-fill-max-sim').click()")
    sc = txt(h, ".sim-disc[data-disc='cx'] .sim-disc-score")
    check("preencher máximos fecha a AT em 100", sc == "100/100", sc)

    # 12. modal do TP sugere alvo e mostra a nota de cada disciplina
    h.ev("goto('s-home'); openModalTP()")
    body = txt(h, "#modal-body")
    check("TP sugere disciplina", "sugestão" in body, body[:200])
    check("select do TP mostra nota atual", "/100" in txt(h, "#m-disc"), txt(h, "#m-disc")[:120])
    h.ev("document.getElementById('modal').hidden = true")

    # 13. navega tudo sem exception
    for tela in ["s-disciplinas", "s-simulador", "s-config", "s-home"]:
        h.ev(f"goto('{tela}')")
    h.ev("state.foco = 'tracking'; renderHome(); state.foco = 'registro'; renderHome()")
    check("console sem erros", not h.console, "; ".join(h.console[:5]))
finally:
    h.stop()

print()
if fails:
    print(f"{len(fails)} FALHAS: {fails}")
    sys.exit(1)
print("v4 OK")
