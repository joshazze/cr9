# CR9

PWA pessoal para acompanhar o **Ibmec Stars** — programa de reconhecimento acadêmico do Ibmec que exige CR ≥ 9,0 em 4+ disciplinas no período.

**Live:** [joshazze.github.io/cr9](https://joshazze.github.io/cr9/)

---

## Sobre

Não achei um app que tratasse a conta do Stars do jeito certo: AP1 + AP2 + ACs variáveis, AS como porta de saída, bônus do TP, e a pergunta real que interessa — *dá ainda pra fechar 9?*

Então fiz o meu. Vanilla stack, zero dependências em runtime, instalável no iOS/Android, funciona offline.

## Stack

- **HTML/CSS/JS puros** — nenhum framework, nenhum bundler, nenhum npm
- **PWA completa** — manifest, service worker com cache estratégico, instalável
- **localStorage** como source of truth, com versionamento de schema e migrations idempotentes
- **Firebase Realtime Database** opcional para sync entre dispositivos — sem login, pareamento por código de 6 caracteres
- **Fraunces + Inter**, paleta cream/copper, suporte a dark mode via `prefers-color-scheme`

~5k LOC entre `app.js`, `style.css` e `index.html`.

## Features

- **Home com 3 focos intercambiáveis** — Stars (projeção + probabilidade), Tracking (gráficos de progressão, aproveitamento, expectativa vs oficial) ou Registro (lançamento rápido de notas)
- **Modelo de disciplinas flexível** — AP1, AP2, N ACs com pesos customizáveis (soma ≤ 20) ou modo igualitário (20/N), seção de AS aparece automaticamente quando a média cai abaixo de 70
- **Simulador** — testa cenários "e se eu tirar X na AP2?" sem sujar os dados reais
- **Teste de Progresso** — bônus do TP aplicado na disciplina alvo, recalcula CR com e sem TP
- **Probabilidade do Stars** — estimativa baseada no rendimento atual vs necessário nos slots restantes
- **Export/import** em JSON pra backup manual

## Decisões de design

- **Sem login por padrão.** O app funciona 100% offline com localStorage. Sync é opt-in e o código pareado (`A7X-3K9`) é a única credencial.
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
├── app.js          # estado, cálculos, renderização, sync
├── style.css       # design system completo
├── sw.js           # service worker
├── manifest.json
└── icons/
```

## Licença

MIT.
