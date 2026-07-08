"""Fixtures compartilhadas dos testes CDP."""

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
