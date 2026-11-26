# ADR 0021: Plano do mês, entradas e saídas, projeção mensal e "Meu método" (proposta de André Graccia)

Status: aceito e implementado. Backend em 23/11/2026; telas em 24/11 (Plano do mês, Meu método, Entradas e saídas, totais do Início); Início completo, lançamentos em Entradas e saídas e nome neutro do método em 26/11. CI e E2E verdes no PR #3. Falta a validação com pessoas reais (seção 9 do documento de evolução).

## Crédito

A ideia de origem é de **André Graccia**, integrante do grupo: [`docs/produto/ajustes-wallia-andre-graccia.txt`](../produto/ajustes-wallia-andre-graccia.txt). Ele propôs um Início com ganhos, gastos e "lazer e investimento" do mês; abas de gastos e ganhos com a conta e o método de cada um; a projeção de ganhos, gastos, lazer e investimento no curto e no longo prazo; e a divisão da renda em 35% fixo, 20% lazer, 15% investimento, 7,5% futuro e 10% desenvolvimento pessoal e estudo. A divisão dele virou o preset **Equilibrado 35/20/15** (id `PERCENT_BALANCED`), com 12,5% de reserva de emergência para fechar 100%.

**Onde o crédito aparece (decisão de 26/11/2026):** neste ADR, no CHANGELOG, no PR e no material acadêmico da A3. **Não** na interface: o método se chama pelo que faz, como o 50/30/20, e nenhuma tela cita autor. Entre 23 e 26/11 o preset se chamou `PERCENT_ANDRE` ("Regra do André" na tela); a migração V37 converte as escolhas gravadas com o id antigo.

O catálogo de métodos, a sugestão por regras e o perfil declarado vêm do **documento de evolução do grupo**, validado pelo coordenador antes de entrar.

## Princípio

**O Wall.ia não impõe um método; apresenta alternativas explicáveis.** Não existe "o jeito certo" de dividir a renda. O produto mostra os métodos que sabe executar, diz por que alguns combinam com os dados da pessoa (com os números usados) e registra a escolha dela. Nenhum método vem pré-ativado, e nada entra na projeção sem a pessoa marcar.

As regras do produto continuam valendo em tudo o que está aqui: Java calcula e a IA no máximo explica; todo número tem certeza e origem; perguntar antes de supor; não vender crédito; nunca recomendar investimento.

## A decisão antiga do divisor da renda

Em 25/09 o "divisor da renda na chegada" foi recusado ([`analise-2026-09-25.md`](../analise-2026-09-25.md), [`estrategia-produto.md`](../estrategia-produto.md)) por dois motivos: envelope não tem aporte mensal, e o limite diário já mostra o que está comprometido até a próxima renda. Um divisor que só sugerisse valores na tela seria um segundo número competindo com o limite.

O Plano do mês resolve os dois:

1. **Não é envelope.** Uma fatia marcada como compromisso vira uma saída mensal **confirmada** na projeção (`CashEvent.Kind.PLAN`), no mesmo dia da renda principal: "pague-se primeiro". Envelope continua sendo piso sobre o saldo de hoje.
2. **Não cria segundo número.** Como a fatia vira evento do motor, o limite diário, o comprometido em 30 dias, os dias negativos e o "ver se cabe" já descontam o plano. A pessoa vê um limite só, menor porque ela decidiu guardar.

## Decisões

### 1. Plano do mês

- **Base:** a renda mensal **confirmada**: as recorrências de entrada que a pessoa confirmou como `SALARY` ou `OTHER_INCOME`. O detector só encontra padrões mensais (20 a 40 dias), então o valor típico de cada uma já é um mês. Sem renda confirmada, o plano não calcula valor e pede a confirmação (`NEEDS_CONFIRMED_INCOME`); não supõe renda.
- **Renda principal:** o maior salário; sem salário, a maior entrada. Os compromissos saem nas mesmas datas em que ela é projetada (`CashEventPlanner.fromRecurrence`), inclusive a antecipação para o dia útil anterior. No mês em que a renda já entrou, não há compromisso até a próxima entrada: a projeção não sabe se a pessoa já separou o dinheiro.
- **Fatias editáveis:** de 1 a 12, cada uma com tipo, rótulo próprio (até 40 caracteres), percentual de 0 a 100 com duas casas e a marca "virar compromisso". Tipos: `FIXED`, `LEISURE`, `INVESTMENT`, `FUTURE`, `DEVELOPMENT`, `EMERGENCY` (no máximo uma de cada) e `CUSTOM` (quantas couberem).
- **Fixo é termômetro:** soma das saídas fixas confirmadas (recorrências `RENT`, `BILL`, `SUBSCRIPTION`) e das parcelas de empréstimo com parcela restante, contra a meta da fatia, com o % usado. Nunca vira compromisso: essas contas já estão no motor.
- **Lazer é teto:** gasto real do mês corrente contra a fatia. "Gasto" é o dia a dia: a mesma regra da média do dia a dia (`DailySpending.everyday`, extraída para não duplicar), sem contas fixas, sem fatura, sem empréstimo e sem transferência entre contas próprias. Nunca vira compromisso: o limite diário já cuida do dia a dia. Em regime de caixa ([ADR 0011](0011-regime-de-caixa-nas-telas.md)), compra no cartão aparece na fatura, não no Lazer.
- **Compromisso só por marca:** salvar ou ativar o plano não joga fatia nenhuma no motor. Só as fatias que a pessoa marcou entram, e só enquanto o plano está ativo. Certeza `CONFIRMED` (a pessoa decidiu), origem "Plano do mês", rótulo "Plano do mês: <rótulo da fatia>".
- **Rascunho incompleto:** um plano que não soma 100% pode ser salvo e volta com o aviso `INCOMPLETE`. Não pode ser ativado, e um plano ativo não pode ser salvo incompleto (422 `MONTH_PLAN_INCOMPLETE`).
- **Centavos:** valor da fatia = base × percentual, HALF_EVEN em centavos. Com o plano completo, a diferença de centavos do arredondamento vai para a maior fatia (a primeira, no empate), e a soma das fatias é a base exata. Testado com R$ 1.000,01 em três terços e com R$ 0,05 em duas metades.
- **Metas e plano não contam duas vezes:** as metas já saem do saldo no dia delas. Ficam **dentro** da fatia `FUTURE`: uma fatia Futuro marcada compromete só o que as metas não cobrem (`max(0, fatia - metas)`). Sem fatia Futuro marcada, as metas continuam como estão. Foi a regra mais simples que não mexe nas metas existentes.
- **Ver se cabe:** igual às metas. `POST /plan/fit` recebe as fatias (com as marcas), troca o plano ativo, se houver, por elas e devolve os 90 dias antes e depois (dias negativos, menor saldo) no mesmo formato do cenário de metas. Não grava nada.
- **Confirmação:** `PUT /plan/activation` liga o plano. Exige plano salvo, soma de 100% e renda confirmada.

### 2. Entradas e saídas

Totais de um mês (o corrente ou um dos 12 anteriores, o histórico que o Futuro já carrega), separados em ganhos e gastos, agrupados por conta (instituição e conta), por método de pagamento (o tipo do Open Finance gravado desde a V31; `UNKNOWN` para lançamentos locais e importações antigas) e por categoria.

- A categoria nunca é palpite: a que a pessoa confirmou para a recorrência; `CARD_INVOICE` para pagamento de fatura (mesma regra do B12); `LOAN` para parcela de empréstimo; `UNCONFIRMED_RECURRENCE` para recorrência ainda sem resposta; `EVERYDAY` para o dia a dia; `UNCLASSIFIED` para o resto.
- Transferência entre contas próprias não é ganho nem gasto: as locais saem por `FutureService.movements`, os pares importados por `InsightsService.ownAccountPairs`. As duas regras já existiam.
- Os três totais do Início: ganhos do mês, gastos do mês e **lazer + investimento do mês** = lazer gasto (dia a dia do mês) + a fatia `INVESTMENT` marcada do plano ativo. Não há registro de aporte real, então o investimento é a decisão da pessoa, não o movimento; vem com a origem "Plano do mês" e é zero em meses passados e sem plano ativo.

### 3. Projeção mensal

Resumo por mês para 3, 6 ou 12 meses, o corrente incluído (parcial, do dia de hoje em diante). Usa os mesmos eventos da projeção diária: entradas e saídas separadas em confirmadas e estimadas, o plano numa coluna própria, a sobra (entradas - saídas - plano) e o saldo projetado no último dia do mês. Nada novo é estimado; o mês é tão certo quanto os eventos que soma. Cartão só conhece as parcelas já lançadas, então faturas distantes tendem a ficar menores que a realidade.

### 4. Meu método

Catálogo estático em `service/future/MethodCatalog` (versão `2026-11-23`), não tabela: muda com o código e com revisão. Cada método tem id, nome, como funciona, quando ajuda, limitações, dados necessários e onde roda no Wall.ia.

| Id | Onde roda |
| --- | --- |
| `PERCENT_503020` (50/30/20) | Plano do mês, preset de 3 fatias |
| `PERCENT_BALANCED` (35/20/15/7,5/10/12,5) | Plano do mês, preset de 6 fatias |
| `ZERO_BASED` (base zero) | Plano do mês com soma de 100% |
| `PAY_YOURSELF_FIRST` | Metas (`/future/goals`) |
| `PRIORITIES` | Plano do mês, na ordem das fatias |
| `INCOME_CYCLE` | Limite diário do Futuro (`/future/overview`) |
| `ENVELOPES` | Envelopes (`/future/envelopes`) |
| `DEBT_AVALANCHE`, `DEBT_SNOWBALL` | Planejador de quitação (`/future/debt-payoff`) |

Os presets chegam sem nenhuma fatia marcada: escolher um método não compromete dinheiro.

Sugestões por regras explícitas, em `service/future/MethodAdvisor`, com um teste por regra e **nenhum score**. Devolvem de 2 a 3 métodos, cada um com o motivo em código de i18n e os números por trás, e os dados usados:

1. Renda variável (alguma entrada confirmada com valor que muda ou dia irregular, segundo o detector): `INCOME_CYCLE` primeiro (`VARIABLE_INCOME`).
2. Contas fixas confirmadas acima de 50% da renda confirmada: `PRIORITIES` e `INCOME_CYCLE`, antes de qualquer percentual (`FIXED_ABOVE_HALF_OF_INCOME`, com `fixedSharePercent`).
3. Duas ou mais dívidas com taxa (empréstimos com taxa e saldo, mais as dívidas informadas, que sempre têm CET): `DEBT_AVALANCHE` e `DEBT_SNOWBALL` (`DEBTS_WITH_RATE`, com `debts`).
4. Preferência declarada: `SIMPLE` dá os presets percentuais (`PREFERS_SIMPLE`); `DETAILED` dá `ZERO_BASED` e `ENVELOPES` (`PREFERS_DETAIL`).
5. Menos de dois até aqui: com renda, `PAY_YOURSELF_FIRST` (`CONFIRMED_INCOME_KNOWN`) e `INCOME_CYCLE` (`DAILY_LIMIT_UNTIL_NEXT_INCOME`); sem renda, `PRIORITIES` e `ENVELOPES` (`NO_CONFIRMED_INCOME`).

Sem renda confirmada, nenhum método percentual é sugerido e a resposta traz `needsConfirmedIncome: true`.

### 5. Perfil contextual mínimo

- **Derivado, calculado na hora e nunca gravado:** renda confirmada, renda variável, contas fixas por mês, peso delas sobre a renda e número de dívidas com taxa.
- **Declarado, gravado e revisável:** preferência (`SIMPLE`, `DETAILED`, `NOT_SAID`), objetivo principal (`STABILITY`, `LEAVE_DEBT`, `ORGANIZE_MONTH`, `BUILD_RESERVE`, `OTHER`, `NOT_SAID`) e o método escolhido com a data. O histórico de métodos é só de acréscimo; o atual é o mais recente; escolher de novo o atual não grava nada; limite de 100 escolhas por pessoa (409 `METHOD_CHOICE_LIMIT`). Cada escolha guarda a versão do catálogo.

### 6. Persistência e LGPD

- **V35:** `month_plan` (uma por pessoa, `active NOT NULL DEFAULT FALSE`) e `month_plan_slice` (fatias na ordem, `ON DELETE CASCADE`). O banco garante faixa do percentual, tipo, posição de 0 a 11 e que Fixo e Lazer nunca são compromisso. A soma de 100% é regra da aplicação, porque cruza linhas e rascunho pode ser incompleto.
- **V36:** `financial_profile` (uma por pessoa) e `method_choice` (histórico), com os valores permitidos em `CHECK`.
- As quatro tabelas entram na exportação (`monthPlan`, `monthPlanSlices`, `financialProfile`, `methodChoices`) e na exclusão da conta. `AccountDataSqlTest` roda **todos** os SQL da exportação e da exclusão no Postgres real, com dado nas tabelas novas, e confere que nada fica.
- Rótulos de fatia são texto da pessoa, como o nome de uma meta, e não são cifrados (ADR 0014 cifra o que nomeia pessoas e empresas no extrato).

## Contrato da API

Todas as rotas exigem token; o id da pessoa vem sempre do token e nenhuma rota recebe id de usuário ou de recurso, então não há como nomear o plano de outra pessoa. Sem token: 401. Corpo fora do formato: 422 com `validationErrors`. Regra quebrada: o status do `GlobalExceptionHandler` com `{"code": "..."}`. Respostas com `Cache-Control: no-store`, exceto o catálogo (`no-cache`). Valores em reais com duas casas, datas ISO.

### `GET /api/v1/plan`

```json
{
  "status": "DRAFT",
  "warnings": [],
  "saved": true, "complete": true, "totalPercent": 100.00,
  "active": false, "activatedAt": null,
  "income": { "monthly": 5000.00, "day": 5, "nextDate": "2026-12-04", "certainty": "ESTIMATED",
              "origin": "Recorrências de entrada confirmadas",
              "sources": [{ "key": "in:empresa-x", "counterparty": "Empresa X", "category": "SALARY",
                            "amount": 5000.00, "typicalDay": 5 }] },
  "slices": [
    { "position": 0, "kind": "FIXED", "label": "Fixo", "percent": 35.00, "commitment": false,
      "role": "THERMOMETER", "amount": 1750.00, "used": 1500.00, "usedPercent": 85.7, "remaining": 250.00,
      "committed": null, "certainty": "ESTIMATED", "origin": "Recorrências confirmadas e parcelas de empréstimo" },
    { "position": 1, "kind": "LEISURE", "label": "Lazer", "percent": 20.00, "commitment": false,
      "role": "CEILING", "amount": 1000.00, "used": 120.00, "usedPercent": 12.0, "remaining": 880.00,
      "committed": null, "certainty": "CONFIRMED", "origin": "Gastos do dia a dia no extrato do mês" },
    { "position": 2, "kind": "INVESTMENT", "label": "Investimento", "percent": 15.00, "commitment": true,
      "role": "COMMITMENT", "amount": 750.00, "used": null, "usedPercent": null, "remaining": null,
      "committed": 750.00, "certainty": "CONFIRMED", "origin": "Plano do mês" }
  ],
  "monthlyCommitment": 0.00,
  "goalsInsideFuture": 0,
  "fixed": { "recurring": 1500.00, "loans": 0 }
}
```

- `status`: `ACTIVE`, `NEEDS_CONFIRMED_INCOME` (valores `null`), `EMPTY` (nada salvo), `INCOMPLETE` (salvo, soma diferente de 100) ou `DRAFT` (completo e desligado).
- `warnings`: `INCOMPLETE`, `NEEDS_CONFIRMED_INCOME`, `ACTIVE_WITHOUT_INCOME` (plano ligado, mas a renda deixou de estar confirmada: nada entra no motor).
- `role`: `THERMOMETER` (Fixo), `CEILING` (Lazer), `COMMITMENT` (marcada) ou `RESERVED` (não marcada, só referência).
- `monthlyCommitment`: o que sai do saldo por mês; zero quando desligado.

### `PUT /api/v1/plan`

Corpo (também o de `/plan/fit`):

```json
{ "slices": [
  { "kind": "FIXED", "label": "Fixo", "percent": 35, "commitment": false },
  { "kind": "INVESTMENT", "label": "Investimento", "percent": 15, "commitment": true },
  { "kind": "CUSTOM", "label": "Viagem de julho", "percent": 5, "commitment": true }
] }
```

Resposta: 200 com o plano (formato acima). Erros 422: `MONTH_PLAN_EMPTY`, `MONTH_PLAN_TOO_MANY_SLICES`, `MONTH_PLAN_INVALID_PERCENT`, `MONTH_PLAN_INVALID_LABEL`, `MONTH_PLAN_SLICE_NOT_COMMITTABLE` (Fixo ou Lazer marcados), `MONTH_PLAN_DUPLICATE_SLICE` (dois do mesmo tipo, exceto `CUSTOM`), `MONTH_PLAN_INCOMPLETE` (plano ativo salvo fora de 100%).

### `POST /api/v1/plan/fit`

"Ver se cabe". Mesmo corpo do `PUT`. Não grava. Resposta 200 no formato do cenário do Futuro (`FutureResponses.ScenarioResult`): `baseline` e `scenario` com `minBalance30`, `minBalance90`, `minDate`, `firstNegativeDate`, `negativeDays`, `endBalance`; `newMonthlyCommitment` (soma das fatias marcadas); `baselineProjection` e `scenarioProjection` dia a dia. Erros 422: os de validação acima e `MONTH_PLAN_NEEDS_INCOME`.

### `PUT /api/v1/plan/activation`

Corpo `{"active": true}` ou `{"active": false}`. Resposta 200 com o plano. Ligar: 422 `MONTH_PLAN_EMPTY`, `MONTH_PLAN_INCOMPLETE` ou `MONTH_PLAN_NEEDS_INCOME`. Desligar sempre funciona.

### `GET /api/v1/plan/projection?months=3|6|12`

```json
{ "months": 3, "from": "2026-11-23", "until": "2027-01-31", "openingBalance": 3000.00, "planActive": true,
  "items": [
    { "month": "2026-12", "partial": false, "inflowConfirmed": 0, "inflowEstimated": 5000.00,
      "outflowConfirmed": 0, "outflowEstimated": 1500.00, "plan": 1375.00, "net": 2125.00, "endBalance": 5125.00 }
  ] }
```

Outro valor de `months`: 400 `INVALID_HORIZON`.

### `GET /api/v1/cash-flow?month=YYYY-MM`

`month` opcional (padrão: o corrente). Aceita o corrente e os 12 anteriores; fora disso ou malformado: 400 `INVALID_MONTH`.

```json
{ "month": "2026-11", "currentMonth": true,
  "income":   { "total": 5000.00, "count": 1,
                "byAccount": [{ "key": "Banco Aurora · Conta", "total": 5000.00, "count": 1 }],
                "byMethod": [{ "key": "TED", "total": 5000.00, "count": 1 }],
                "byCategory": [{ "key": "SALARY", "total": 5000.00, "count": 1 }],
                "items": [{ "id": 41, "date": "2026-11-05", "counterparty": "Empresa X", "amount": 5000.00,
                            "account": "Banco Aurora · Conta", "method": "TED", "category": "SALARY" }] },
  "spending": { "total": 1620.00, "count": 2, "byAccount": [], "byMethod": [], "byCategory": [], "items": [] },
  "home": { "income": 5000.00, "spending": 1620.00, "leisure": 120.00, "investment": 750.00,
            "investmentOrigin": "Plano do mês", "leisureAndInvestment": 870.00 },
  "bankData": null }
```

`items` (desde 26/11): os lançamentos do lado, do mais novo para o mais antigo, com as mesmas chaves de `byAccount`, `byMethod` e `byCategory`, para a tela filtrar a lista por qualquer grupo sem o total divergir. Categorias: as confirmadas (`SALARY`, `OTHER_INCOME`, `RENT`, `SUBSCRIPTION`, `BILL`, `OTHER`), `CARD_INVOICE`, `LOAN`, `UNCONFIRMED_RECURRENCE`, `EVERYDAY`, `UNCLASSIFIED`. Grupos do maior para o menor. `bankData` segue o [ADR 0020](0020-dado-atrasado-pix-no-credito-e-fatura.md).

### `GET /api/v1/methods`

`{"version": "2026-11-26", "methods": [{"id", "name", "howItWorks", "helpsWhen", "limitations", "dataNeeded": [...], "where": {"tool", "route"}, "preset": [{"kind", "label", "percent", "commitment"}]}]}`. Textos em pt-BR; a tela pode traduzir pelo `id`. `dataNeeded`: `CONFIRMED_INCOME`, `CONFIRMED_FIXED_BILLS`, `BALANCE`, `GOALS`, `LOANS_WITH_RATE`.

### `GET /api/v1/methods/suggestions`

```json
{ "catalogVersion": "2026-11-26", "needsConfirmedIncome": false, "preference": "SIMPLE",
  "suggestions": [
    { "method": "PRIORITIES", "reasons": [{ "code": "FIXED_ABOVE_HALF_OF_INCOME",
        "params": { "fixedSharePercent": 60.0, "fixedMonthly": 2400.00, "monthlyIncome": 4000.00 } }] } ],
  "data": { "confirmedIncome": 4000.00, "variableIncome": false, "fixedMonthly": 2400.00,
            "fixedSharePercent": 60.0, "debtsWithRate": 0 } }
```

### `GET /api/v1/profile`, `PUT /api/v1/profile`, `PUT /api/v1/profile/method`

- `PUT /profile`: `{"preference": "SIMPLE|DETAILED|NOT_SAID", "mainGoal": "STABILITY|LEAVE_DEBT|ORGANIZE_MONTH|BUILD_RESERVE|OTHER|NOT_SAID"}`.
- `PUT /profile/method`: `{"method": "<id do catálogo>"}`. 409 `METHOD_CHOICE_LIMIT` depois de 100 escolhas.
- As três respondem `{"preference", "mainGoal", "updatedAt", "method", "methodHistory": [{"method", "catalogVersion", "chosenAt"}], "derived": {...}}`, histórico do mais novo para o mais antigo, até 20.

## O que ficou de fora, e por quê

- **Registro de investimentos (carteira, tipo, produto, saldo, aporte).** O Wall.ia é um produto de fluxo de caixa: prever o saldo e evitar o negativo. Cadastro de carteira é outro produto (patrimônio), não tem fonte de dados no sandbox e fica perto de recomendação de investimento, que o produto não faz. Da ideia ficou a fatia Investimento do plano: o aporte como compromisso mensal no motor.
- **Diário de desenvolvimento pessoal ("onde estou, onde quero chegar").** Não é dado financeiro e traria texto pessoal livre para guardar e cifrar sem uso no cálculo. Ficou a fatia Desenvolvimento pessoal e estudo: o orçamento de estudo como compromisso mensal.
- **Assistente com modelo de linguagem preparando ações** (montar o plano, sugerir fatias por texto). Fase futura: exige o mesmo cuidado do ADR 0001 (o modelo prepara, Java calcula, a pessoa confirma) e um registro do que foi proposto.
- **Meta com valor-alvo e data-alvo** (contribuição mensal necessária com "ver se cabe"). Próxima fatia natural; não entrou nesta rodada.
- **Gasto do cartão no Lazer.** Em caixa, a compra está na fatura. A visão por competência continua para depois ([ADR 0011](0011-regime-de-caixa-nas-telas.md)).
- **Catálogo: fundos para despesas previsíveis (sinking funds) e orçamento flexível.** O primeiro já é o que as metas fazem (valor mensal separado para um gasto futuro); entrar no catálogo como método à parte duplicaria a meta. O segundo é uma rotina de revisão, não uma divisão da renda; o "ver se cabe" e a revisão do plano cobrem o caso.
- **Comparar dois métodos lado a lado.** O `POST /plan/fit` já simula qualquer divisão sem gravar, e Meu método mostra o motivo de cada sugestão. Uma tela de comparação dupla é útil, mas é trabalho de interface sem regra nova; fica para depois da validação com usuários.
- **Perfil ampliado (ciclo de recebimento declarado, familiaridade financeira).** O ciclo já é derivado das rendas confirmadas (dia típico, renda variável). Familiaridade mudaria só o tom do texto, e pedir esse dado sem uso concreto vai contra a minimização da LGPD.
- **Classificar estorno e corrigir categoria pela tela.** As categorias vêm das recorrências confirmadas e das regras do motor, nunca de palpite. Corrigir uma categoria à mão exige um modelo de categoria por transação que não existe hoje; estorno entra como entrada não classificada (`UNCLASSIFIED`), sem virar renda recorrente.
- **Objetivo de lazer como entidade própria.** É a meta com valor-alvo e data acima: mesma fatia, mesmo motivo.
- **Filtro de período no Início.** O Início mostra o mês corrente e 30/60/90 dias; o mês anterior fica em Entradas e saídas, que já filtra por mês.

## Início e privacidade (26/11/2026)

A seção 4.2 do documento de evolução entrou no Início, sem endpoint novo (lê `/future/overview?horizon=90`, `/cash-flow`, `/plan`, `/future/goals`, `/future/envelopes`, `/profile` e `/methods`). Ordem: o número do dia; saldo consolidado com os totais do mês; a primeira janela negativa com as causas, a certeza e a origem de cada uma; 30/60/90 dias; o gráfico de 30 dias com os próximos compromissos; planejado x realizado por fatia; metas, envelopes e reserva; e o método ativo, que decide se "Plano do mês" ou "Metas e reservas" vem primeiro e diz por quê. Planejado nunca aparece como gasto ou investido: só Fixo e Lazer têm realizado medido; uma fatia marcada aparece como "separado no Futuro"; as outras, como "planejado, nenhum movimento registrado". Cada bloco carrega e falha sozinho.

O "ocultar saldo" deixou de ser só do Início: o olho foi para o topo do layout e `money()` lê a preferência, então todas as telas escondem os valores juntas.

## Consequências

- Com o plano ativo, o limite diário cai pelo valor das fatias marcadas até a próxima renda. É o efeito pedido, e o texto da tela precisa dizer isso.
- O placar de precisão ([ADR 0005](0005-envelopes-placar-e-pix-simulado.md)) compara previsão com saldo real. Como as metas, os compromissos do plano não movem dinheiro no banco: a previsão fica abaixo do real enquanto a pessoa não transferir o valor. Mesmo comportamento das metas, que já existia.
- `FutureService` ganhou o plano no contexto e o `monthPlanFit`; o resto mora em `MonthPlanService`, `ProfileService` e nas classes puras. A divisão do `FutureService` (B54) continua esperando uma mudança que doa.
