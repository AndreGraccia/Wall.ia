# ADR 0024: categoria escolhida pela pessoa, fila "Para revisar" e regras

Status: implementado na branch `feat/revisao`. 27/11/2026. Complementa os ADRs [0021](0021-plano-do-mes-entradas-e-saidas-e-meu-metodo.md) e [0023](0023-essenciais-pares-e-objetivo.md).

## Decisão

1. **A escolha fica fora do lançamento.** `category_choice` (por pessoa e transação) e `category_rule` (V38). A classificação é calculada na leitura, então apagar a escolha ou a regra desfaz todo o efeito. O dado do banco nunca muda.
2. **Precedência:** escolha da transação, depois regra, depois o automático (fatura pelos dados do cartão, empréstimo pelo nome, recorrência confirmada, nome do gasto). Cada lançamento traz a origem (`CHOSEN`, `RULE`, `RECURRENCE`, `DATA`, `NAME`, `NONE`). `NAME` aparece como "sugerido"; `NAME` e `NONE` formam a fila.
3. **Sem taxonomia nova.** São as categorias que o fluxo de caixa já mostrava; "não classificado" e "recorrência sem resposta" são estados e não podem ser escolhidos.
4. **Regra nasce de um lançamento.** O cliente não digita a contraparte: o servidor a tira de uma transação da própria pessoa. Casa por lado (entrada ou saída) e nome sem caixa, acento e pontuação. Uma regra por contraparte e lado; salvar de novo substitui. Limite de 100. O padrão é valer a partir de hoje (data do lançamento); alcançar os anteriores é escolha explícita, com prévia.
5. **A contraparte é descrição de transação:** cifrada (ADR 0014), na coluna `description` para entrar na exportação e na rotação de chave. Por isso a unicidade é conferida no serviço, sob o bloqueio do usuário.

## Efeito no plano e no Radar

- Lazer do mês: tudo o que está na categoria Lazer.
- Essenciais do mês: recorrências fixas confirmadas e parcelas, mais as saídas em Essenciais, Aluguel, Contas fixas ou Assinaturas que nenhuma recorrência já contou.
- Recorrência cuja cobrança mais recente foi movida para fora dessas categorias sai das fixas, para não ser medida duas vezes.
- Radar: a categoria decidida vale mais que o nome para separar compra do dia a dia de cobrança.

## Limites

- A projeção, o limite diário, a média do dia a dia e a renda base do plano continuam vindo das respostas de recorrência; categoria não muda o que é previsto.
- Escolher "Empréstimos" ou "Fatura do cartão" não cria dívida nem fatura. Marcar como Essenciais uma parcela que os dados de empréstimo já contam soma as duas.
- "A partir de hoje" usa a data do lançamento: um lançamento de ontem importado amanhã não é alcançado.
- Desfazer a criação de uma regra é removê-la; a regra substituída não volta.
- Dividir uma transação entre categorias ficou fora.
