# ADR 0020: dado atrasado em toda tela, Pix no crédito na quitação e fatura contada uma vez

Status: aceito e implementado na branch `feat/b50-b14-b12-dado-atrasado-pix-credito`. 19/11/2026. Falta CI no GitHub e validação na homologação.

Cobre três itens do backlog: B50 (E6), B14 e B12 parcial (E2).

## 1. Estado de dado atrasado (B50)

### Contexto

Havia duas regras para "dado do banco atrasado", e elas discordavam:

- Futuro (`FutureService.bankDataStale`): a sincronização mais antiga das contas Open Finance, atrasada depois de 36 horas. Conta que nunca sincronizou não contava como atrasada.
- Radar (`BillingRadarService`): a mesma conta de 36 horas, copiada, mas conta nunca sincronizada contava como atrasada.

Compromissos, Análises e o resumo do Futuro no Início não diziam nada. Nenhuma tela dizia de qual instituição era o dado.

### Decisão

1. Uma regra só, em Java puro: `service/future/BankDataFreshness`. Recebe as fontes (instituição e horário da última sincronização) e devolve `{institution, asOf, stale, staleAfterHours}`, ou `null` quando não há dado do Open Finance.
2. A tela é tão recente quanto o dado mais velho dela. A instituição mostrada é a que segura o dado para trás.
3. Conta nunca sincronizada é atrasada. Ficou a regra do Radar: sem dado nenhum, não há o que confiar.
4. O limite continua 36 horas (o job roda às 7h30; 36 horas sem sincronizar quer dizer que pelo menos uma rodada falhou). Vai na resposta (`staleAfterHours`) para a tela não repetir o número.
5. Cada resposta leva o campo `bankData`: `Sources` do Futuro (que também alimenta o Início), Radar, Compromissos e Análises. Compromissos usa a data dos cartões e empréstimos, que é o que a tela mostra; as outras usam as contas.
6. Os campos antigos `bankDataAsOf` e `bankDataStale` saíram do Futuro e do Radar. O único cliente é o frontend deste repositório, trocado no mesmo commit.
7. Na tela, um componente só (`components/bank-data`): legenda discreta quando o dado está em dia, alerta antes dos números quando passou do limite, com instituição, horário e o botão para atualizar.
8. Em Análises, o `bankData` é lido fora do `FinancialSnapshot`, porque o snapshot pode ir ao provedor de IA e o nome da instituição não deve ir (ADR de segurança e IA).

## 2. Pix no crédito na ordem de quitação (B14)

### Contexto

O "Pix no crédito" (Pix pago com o limite do cartão) tem CET perto de 8% ao mês (Agência Brasil, dez/2025) e ficava fora do planejador de quitação (ADR 0013). O sandbox do Open Finance não tem esse produto, e a API de empréstimos não o descreve de forma que dê para identificar com segurança.

### Decisão

1. Entrada manual, com tabela própria (`manual_debt`, V34): tipo (`PIX_CREDIT`, único aceito pelo banco e pela API), nome, saldo devedor, parcela e CET ao mês, como aparece no app do banco.
2. O CET é obrigatório. Sem ele, 422 antes do serviço. A Wall.ia não supõe taxa (regra "perguntar antes de supor").
3. Origem `MANUAL` e certeza `ESTIMATED` em toda resposta. Estimado porque ninguém conferiu o valor com a instituição, e o saldo muda com os juros depois de digitado.
4. Entra na ordem de quitação ao lado dos empréstimos. O CET ao mês vira taxa anual equivalente (`LoanCost.annualFromMonthly`, `(1 + m)^12 - 1`) e o motor volta para a taxa mensal; 8% a.m. sobre R$ 1.000,00 dá R$ 80,00 de juros no primeiro mês, com teste.
5. Cada linha da ordem leva `origin`, e a tela marca "informado por você".
6. Não entra na projeção do saldo. As parcelas do Pix no crédito costumam vir na fatura do cartão, que o Futuro já projeta; somar de novo seria contar duas vezes.
7. Até 10 dívidas por pessoa (422 `MANUAL_DEBT_LIMIT`); apagar dívida de outra pessoa dá 404 `MANUAL_DEBT_NOT_FOUND`, porque a consulta já filtra pelo dono.
8. A tabela entra na exportação dos dados (LGPD, B20) e na exclusão da conta (ADR 0012).

Contrato:

- `POST /api/v1/future/manual-debts` com `{kind, label, outstandingBalance, installmentAmount, monthlyCet}`. 201 com a dívida; 401 sem token; 422 para corpo inválido (CET fora de 0,01 a 30, mais de 4 casas, valores fora de 0,01 a 1.000.000) ou limite.
- `DELETE /api/v1/future/manual-debts/{id}`. 204; 404 quando o id não é de quem pede.
- `GET /api/v1/future/commitments` passa a trazer `manualDebts`.

### Limitação

A Wall.ia não detecta Pix no crédito sozinha. Quando o Open Finance real trouxer o produto identificável, a entrada manual continua como alternativa e a importada entra com origem `OPEN_FINANCE`.

## 3. Pagamento de fatura contado uma vez (B12, parcial)

### Contexto

O Futuro projeta a fatura do cartão no vencimento, a partir das compras. O pagamento da fatura sai da conta corrente. Só a descrição separava uma coisa da outra (`fatura`, `pagamento de cartao`). Um pagamento descrito como "NU PAGAMENTOS SA" ou "PAGTO CARTAO 4821" entrava na média dos gastos do dia a dia, e as mesmas compras eram contadas de novo, como fatura.

Análises não tem o problema: soma só movimentações da conta, e as compras do cartão (`card_charge`) não são movimentações (ADR 0011).

### Decisão

1. Um lugar só sabe o que é pagamento de fatura: `service/future/CardBillPayment`.
2. Duas regras: a descrição (agora com `pagto`, `pgto` e `pag` antes de `cartao`), ou uma saída de valor exatamente igual ao total de uma fatura de um cartão da pessoa, até 10 dias antes ou depois do vencimento dela.
3. O Futuro tira esses pagamentos das movimentações antes de detectar recorrências e calcular a média do dia a dia. O detector de recorrências usa a mesma regra de descrição.
4. Teste de regressão: 40 dias de R$ 10,00 na padaria mais um pagamento de R$ 600,00 igual à fatura. Antes, a média era R$ 25,00 por dia (a fatura entrava duas vezes); depois, R$ 10,00.

### O que fica de fora

- Pagamento parcial (só o mínimo) com descrição neutra não bate com nenhuma das regras. Resolver exige o histórico de pagamentos das faturas, que o Open Finance tem e a importação ainda não guarda.
- Estados pendente, estornado e reembolsado (o resto do B12) não foram tratados aqui.
- O Radar de cobranças continua lendo as movimentações sem esse filtro. Um pagamento de fatura com descrição neutra pode aparecer lá como cobrança recorrente; não é soma dupla, mas é um sinal ruim.

## Consequências

- Futuro, Início, Radar, Compromissos e Análises dizem a mesma coisa sobre dado atrasado.
- Conta Open Finance que nunca sincronizou passa a gerar aviso no Futuro. Antes, só no Radar.
- Migração V34 aditiva: tabela nova, nenhuma coluna alterada.
- A média do dia a dia de quem paga a fatura com descrição neutra cai, porque deixa de contar a fatura duas vezes. O limite diário dessa pessoa sobe na mesma medida.
