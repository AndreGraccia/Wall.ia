# Evolução de produto: Radar de cobranças

**Data:** 26/10/2026  
**Estado:** implementado em branch, aguardando CI e revisão.

## Dor atendida

Uma assinatura pode aumentar de preço e passar despercebida no extrato. Ao mesmo tempo, dois lançamentos com o mesmo nome, valor e data podem passar sem revisão. Para quem tenta prever o saldo futuro, o problema não é apenas saber quanto gastou: é reconhecer mudanças nos compromissos que já se repetem.

O detector mensal anterior exigia estabilidade de valor. Isso podia ocultar exatamente a cobrança que mais precisava de atenção: uma recorrência com aumento. O Radar de cobranças usa uma lógica separada para manter o padrão visível mesmo quando o valor muda.

## Proposta de valor

**“A Wall.ia mostra quais cobranças mudaram antes que elas virem surpresa no orçamento — e mostra as movimentações que sustentam cada alerta.”**

O radar não declara fraude. Ele identifica padrões verificáveis e entrega evidência suficiente para a pessoa revisar no extrato ou no banco.

## O que a primeira versão oferece

- Recorrências mensais prováveis com valores estáveis ou variáveis.
- Aumento observado quando a última cobrança supera a mediana anterior em pelo menos R$ 2,00 e 10%.
- Possível duplicidade de lançamentos da mesma contraparte, valor e dia.
- Próxima data estimada, explicitamente identificada como estimativa.
- Até seis movimentações para explicar o sinal.
- Resumo de padrões, aumentos, possíveis duplicidades e total mensal provável das recorrências encontradas.
- Aviso de dados bancários desatualizados.
- Alertas de lançamentos suspeitos por repetição em até 48 horas ou valor superior ao padrão histórico.
- Decisão persistente do titular: revisar depois, marcar como normal ou resolver; a transação original permanece intacta.
- Simulação de estorno hipotético com comparação entre menor saldo e dias negativos na projeção de 90 dias, sem integração bancária de contestação.
- Interface PT/EN, estado vazio e layout responsivo.

## O que não faz

Não cancela assinaturas, não abre disputa, não movimenta dinheiro, não acusa uma empresa de fraude e não trata a estimativa como garantia. Uma compra repetida pode ser legítima. A pessoa permanece no controle.

## Validação funcional esperada

| Cenário | Resultado esperado |
| --- | --- |
| Três cobranças mensais de R$ 39,90, R$ 39,90 e R$ 49,90 | Recorrência identificada; aumento de R$ 10,00 (25,1%) evidenciado |
| Três cobranças mensais de R$ 19,90 | Recorrência identificada sem alerta de aumento |
| Duas cobranças de mesmo valor e contraparte no mesmo dia | Sinal de possível duplicidade, sem afirmar fraude |
| Transferências genéricas ou entradas | Não aparecem como cobrança |
| Duas cobranças isoladas fora de cadência mensal | Não aparecem como assinatura mensal |
| Histórico de Open Finance antigo | Aviso de atualização antes da lista de sinais |
| Sem histórico suficiente | Estado vazio explicando que o sistema não inventa cobranças |

## Leitura competitiva preliminar (26/10/2026)

As páginas oficiais consultadas já divulgam partes importantes desta ideia:

- [Organizze](https://meuorganizze.com/recursos.html) lista transações recorrentes, previsão de saldo e alertas de orçamento.
- [Optio](https://www.optio.com.br/) apresenta detecção de assinaturas/recorrências e gastos fora do padrão, além de insights personalizados.
- [Tobbo](https://tobbofin.com/) anuncia alertas de recorrência e projeções financeiras.
- [Coupe](https://usecoupe.com.br/) anuncia alerta quando uma assinatura ou conta fixa muda de preço e sinalização de gasto fora do padrão.
- [MeusSubs](https://www.meussubs.com.br/) e [Finora](https://www.finoraapp.com.br/) posicionam-se diretamente em detecção e organização de assinaturas.

Esses itens são autodescrições públicas dos fornecedores, não uma análise interna de cada app. Foram consultados em 26/10/2026 e podem mudar. O resultado da pesquisa é importante: **detectar recorrências, sozinho, não é um diferencial defensável**.

A hipótese de valor da Wall.ia passa a ser o fluxo de decisão completo: (1) apontar a alteração com as transações que a sustentam; (2) explicitar quanto o aumento pode representar em 12 meses; (3) permitir que o titular registre sua decisão; e (4) em alertas elegíveis, simular como um possível estorno mudaria o menor saldo e os dias negativos da projeção de 90 dias. O motor é determinístico, os sinais são explicáveis e o sistema não disputa nem cancela nada em nome do usuário. A promessa é ajudar a decidir com consequência calculada, não simplesmente emitir outra notificação.

Isso é uma hipótese de posicionamento, não prova de exclusividade. A camada seguinte de produto a testar é oferecer o mesmo comparativo de fluxo de caixa para “manter o preço atual versus uma alternativa de custo menor” diretamente na recorrência que aumentou, sem supor que o cliente vá conseguir cancelar ou renegociar a cobrança.

### Métricas para validar o diferencial

- Percentual dos sinais que o usuário considera úteis após abrir a evidência.
- Taxa de falsos positivos, inclusive alertas marcados como normais.
- Percentual de alertas revisados e tempo até a decisão.
- Quantidade de simulações abertas depois de um alerta e diferença projetada entre menor saldo/dias negativos.
- Retenção e compreensão: a pessoa consegue explicar por que recebeu o alerta e qual opção mudou o cenário?

Nenhuma dessas métricas foi validada com clientes reais ainda. Não apresentar a proposta como diferenciação comprovada até executar entrevistas e um teste de usabilidade.

## Critérios para evoluir para produto

Antes de promover o radar como funcionalidade validada por clientes, precisamos medir a qualidade dos sinais com pessoas reais: sinais considerados úteis, falsos positivos, sinais ignorados e se o usuário conseguiu explicar o motivo de cada aviso. A primeira versão funciona com os dados disponíveis na conta; não depende de credenciamento de iniciação de pagamento ou de uma API comercial de IA.

A alegação de diferenciação no mercado permanece uma hipótese de posicionamento a ser testada, não uma afirmação de exclusividade. O diferencial defensável é ligar o alerta ao motor determinístico de projeção de saldo e às transações de evidência, mantendo a neutralidade do produto.
