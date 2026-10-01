<p align="center">
  <img src="icons/icon-192.png" width="80" alt="CR9 icon">
</p>

<h1 align="center">CR9</h1>

<p align="center">
  PWA pessoal para acompanhar o <strong>Ibmec Stars</strong> — instalável como app no celular.
  <br>
  <a href="https://joshazze.github.io/cr9/"><strong>joshazze.github.io/cr9</strong></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/vanilla-JS-f7df1e" alt="Vanilla JS">
  <img src="https://img.shields.io/badge/PWA-installable-5A0FC8" alt="PWA">
  <img src="https://img.shields.io/badge/storage-localStorage-orange" alt="localStorage">
  <img src="https://img.shields.io/badge/deploy-GitHub%20Pages-181717" alt="GitHub Pages">
</p>

---

## Sobre

O Ibmec Stars exige CR ≥ 9,0 em 4+ disciplinas no período. Não achei um app que tratasse a conta do jeito certo: AP1 + AP2 + ACs variáveis, AS como porta de saída, bônus do TP, e a pergunta real que interessa — *dá ainda pra fechar 9?*

Então fiz o meu. Vanilla stack, zero dependências em runtime, instalável no iOS/Android, funciona offline.

## Stack

- **HTML/CSS/JS puros** — nenhum framework, nenhum bundler, nenhum npm
- **PWA completa** — manifest, service worker com cache estratégico, instalável
- **localStorage** como source of truth, com versionamento de schema e migrations idempotentes
- **Fraunces + Inter**, paleta cream/copper, suporte a dark mode via `prefers-color-scheme`

~5k LOC entre `app.js`, `style.css` e `index.html`.

## Features

- **Home com 3 focos intercambiáveis** — Stars (projeção + probabilidade), Tracking (gráficos de progressão, aproveitamento, expectativa vs oficial) ou Registro (lançamento rápido de notas)
- **Estrutura de disciplina livre** — padrão AP1 40 + AP2 40 + ACs 20, ou qualquer outra distribuição que feche 100 (ex.: AT 60 + 2 ACs de 20), editável depois sem perder nota; AS substitui a avaliação de pior fração
- **Pontos extras** — bônus fora da distribuição (participação, ponto do professor) que somam na nota com teto de 100, oficial ou previsão
- **Simulador** — testa cenários "e se eu tirar X na AP2?" sem sujar os dados reais
- **Teste de Progresso** — o bônus entra na nota da disciplina alvo em todas as telas, com teto de 100 (o app mostra quanto se perde no teto e sugere o alvo que aproveita mais)
- **Probabilidade do Stars** — modelo Beta hierárquico por avaliação (prova e AC separadas, pooling entre disciplinas, histórico dos períodos anteriores) + Monte Carlo com teto de 100 e aprovação ≥ 70 por disciplina. Calibração contra o modelo anterior em `tests/calibracao.js` (Brier 17–27% menor)
- **Projeção por disciplina** — quanto falta pra 70 e pra 9,0, nota final esperada com faixa e chance de passar direto
- **Export/import** em JSON pra backup manual

## Decisões de design

- **Sem login, sem servidor.** O app funciona 100% offline com localStorage; backup e migração entre dispositivos via export/import de JSON.
- **Schema versionado.** `loadState` chama `migrateState` em toda leitura e em todo import — refs órfãs (ex: TP apontando pra disciplina deletada) são limpas automaticamente.
- **Flags one-shot.** `asAutoTriggered` liga a seção de AS uma vez quando faz sentido, mas respeita o toggle do usuário daí em diante. Comportamento automático sem ser invasivo.
- **Mobile-first de verdade.** Todos os toques testados em iOS Safari, que tem quirks próprios de delegação de eventos e áreas clicáveis.

## Rodando local

```bash
git clone https://github.com/joshazze/cr9.git
cd cr9
python3 -m http.server 8080
# abra http://localhost:8080
```

Service worker e PWA precisam de HTTPS em produção, mas funcionam em `localhost` pra dev.

## Estrutura

```
cr9/
├── index.html      # shell com as 4 telas (home, disciplinas, simulador, config)
├── app.js          # estado, cálculos, renderização
├── style.css       # design system completo
├── sw.js           # service worker
├── manifest.json
└── icons/
```

## Licença

MIT.
