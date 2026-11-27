# ADR 0026: Patrimônio informado e Minha evolução

Status: aceito. 27/11/2026. Substitui os dois primeiros itens de "O que ficou de fora" do [ADR 0021](0021-plano-do-mes-entradas-e-saidas-e-meu-metodo.md). Falta a validação com pessoas.

## Contexto

A proposta de André Graccia ([ajustes](../produto/ajustes-wallia-andre-graccia.txt)) pedia uma aba de investimento (carteira, método, modelo, planejamento e saldo) e uma de desenvolvimento pessoal (onde estou, onde quero chegar). O ADR 0021 cortou as duas. Em 27/11 o dono do produto pediu que o pendente fosse feito.

## Decisão

Um MVP informativo e manual.

### Patrimônio

- **Líquido = saldos das contas + investimentos informados − dívidas conhecidas.** Cada parcela aparece com origem e data.
- **Dívidas** vêm do mesmo cálculo da tela Cartões e dívidas: faturas ainda não vencidas, com as parcelas já lançadas e sem o que foi pago antes do vencimento; saldo devedor dos empréstimos; dívidas informadas.
- **Investimento** é o que a pessoa digita. O valor atual é o registro de data mais recente. Informar a mesma data corrige; um valor errado pode ser removido, menos o último. Limites: 50 investimentos e 120 valores em cada um.
- **Evolução:** em cada data informada, a soma do último valor de cada investimento até ela. Não é a evolução do patrimônio líquido, porque o produto não guarda saldos e dívidas do passado nessa tela, e não é rentabilidade, porque inclui aporte e retirada.
- **Nunca entra no saldo disponível nem na projeção.** Nenhuma classe que calcula saldo ou projeção lê os investimentos, e um teste confere.
- **Sem recomendação, cotação automática ou promessa de retorno**, e a tela diz isso. O método ou modelo é um texto da pessoa. O planejamento do aporte continua sendo a fatia Investimento do Plano do mês.

### Minha evolução

- Objetivo com onde estou, onde quero chegar, prazo, até 20 etapas marcáveis, custo estimado e ligação opcional a uma meta da própria pessoa. Até 20 objetivos.
- Sem pontuação, percentual, gamificação ou avaliação. Nada entra em cálculo.
- Excluir a meta ligada só desfaz a ligação.

### Dados e LGPD

- V40: `investment`, `investment_value`, `life_goal`, `life_goal_step`.
- Texto livre cifrado com o `FieldCipher` (ADR 0014): instituição, nome e anotação do investimento; título, as duas situações e as etapas. A rotação de chave cobre essas colunas.
- Entram na exportação e na exclusão da conta.

### API

Todas as rotas usam o id do token; recurso de outra pessoa é 404. Toda alteração devolve a visão atualizada.

| Rota | Erros próprios |
| --- | --- |
| `GET /api/v1/wealth` | |
| `POST /api/v1/wealth/investments`, `PUT .../{id}`, `DELETE .../{id}` | 404, 409 `INVESTMENT_LIMIT`, 422 `INVESTMENT_FUTURE_DATE`, 400 `INVALID_DATE` |
| `PUT .../{id}/values`, `DELETE .../{id}/values/{data}` | 404, 409 `INVESTMENT_VALUE_LIMIT`, 422 `INVESTMENT_LAST_VALUE` |
| `GET`, `POST /api/v1/life-goals`; `PUT`, `DELETE .../{id}`; `PUT .../{id}/steps/{etapa}` | 404 (`LIFE_GOAL_`, `LIFE_GOAL_STEP_` e `GOAL_NOT_FOUND`), 409 `LIFE_GOAL_LIMIT`, 400 `INVALID_DATE` |

## Consequências e limites

- A parcela de um Pix no crédito pode estar na fatura e também na dívida informada. A tela avisa quando as duas coexistem; não há como cruzar sozinho.
- Fatura vencida é tratada como paga, como no restante do produto.
- Excluir investimento ou objetivo pede confirmação e não tem desfazer.
- A evolução é uma lista das 12 datas mais recentes, sem gráfico.
