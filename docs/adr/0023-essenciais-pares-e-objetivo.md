# ADR 0023: essenciais do dia a dia, pareamento ambíguo e objetivo declarado

Status: aceito e implementado na branch `p0/backend`. 26/11/2026. Complementa o [ADR 0021](0021-plano-do-mes-entradas-e-saidas-e-meu-metodo.md).

## Essenciais não são lazer

Todo gasto do dia a dia media a fatia Lazer, mercado e farmácia inclusos.

1. `SpendingNames` é o único lugar com a lista de nomes: lazer, essencial ou não classificado. O Radar usa a mesma lista.
2. A fatia `FIXED` passa a se chamar Essenciais e mede contas fixas e parcelas (por mês) mais os essenciais que já saíram no mês. Nenhum tipo novo de fatia e nenhum percentual mudou; no 50/30/20, os 50% de necessidades passam a medir as duas coisas.
3. O que o nome não identifica aparece como não classificado, no extrato do mês e no plano, e não entra em fatia nenhuma. Em Entradas e saídas, a categoria `EVERYDAY` deixou de existir.
4. Planos já salvos mantêm o rótulo que a pessoa gravou ("Fixo"); sem migração de dados.
5. Limites: é heurística por nome; vale o regime de caixa, então compra no cartão (iFood, posto) conta na fatura, não em lazer nem em essenciais. Evolução: categoria ou MCC do Open Finance e correção pela pessoa.

## Pareamento de transferências

Um par só é escondido com a mesma descrição dos dois lados em quantidades iguais ou, no que sobrar, com um único candidato de cada lado. Tipos de pagamento diferentes e estados diferentes não pareiam. Na dúvida, os dois lançamentos aparecem.

## Objetivo principal nas sugestões

As regras do objetivo vêm antes das demais (`MethodAdvisor`), cada uma com motivo exibido e sem nota. Sair das dívidas sem dívida com taxa registrada não supõe dívida. Catálogo na versão `2026-11-26.2`.
