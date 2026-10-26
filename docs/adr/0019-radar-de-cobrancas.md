# ADR 0019: Radar de cobranças

- **Status:** Integrado à `main` via PR #2; CI e E2E aprovados em 26/10/2026
- **Data:** 26/10/2026
- **Contexto:** Wall.ia, produto de projeção de fluxo de caixa pessoal
- **Validação:** [CI: 381 testes backend, 74 frontend e build](https://github.com/AndreGraccia/Wall.ia/actions/runs/40390985911); [E2E Playwright](https://github.com/AndreGraccia/Wall.ia/actions/runs/40390985877); [PR #2](https://github.com/AndreGraccia/Wall.ia/pull/2).

## Problema

Uma recorrência com valor variável pode deixar de ser reconhecida pelo detector atual quando o valor mais recente se afasta dos valores históricos. Isso enfraquece a promessa do produto: mostrar os compromissos que podem apertar o orçamento antes que o saldo fique negativo. Cobranças repetidas também podem ser difíceis de identificar manualmente ao navegar em um extrato de várias contas.

## Decisão

Adicionar o **Radar de cobranças**, uma leitura somente de consulta do histórico do titular. O radar:

1. Agrupa saídas liquidadas por contraparte normalizada, sem tratar transferências entre contas próprias como cobrança.
2. Detecta cadência mensal aproximada em intervalos de 20 a 40 dias, independente da estabilidade do valor.
3. Sinaliza aumento observado quando a última cobrança supera a mediana das cobranças anteriores em pelo menos R$ 2,00 e 10%.
4. Sinaliza possíveis duplicidades quando a mesma contraparte tem mais de um lançamento de mesmo valor no mesmo dia.
5. Exibe o valor mais recente, a referência histórica usada, a diferença, a próxima data estimada e até seis transações de evidência.
6. Exibe aviso quando o histórico conectado pode estar desatualizado.

Endpoint autenticado: GET /api/v1/billing-radar. Tela: /billing-radar.

## Segunda camada: anomalias de cobrança e impacto no caixa

O radar combina a leitura de recorrências com uma segunda camada sobre saídas importadas do Open Finance:

- Uma possível duplicidade é sinalizada quando há uma saída anterior de mesmo valor, descrição normalizada e conta dentro de 48 horas.
- Um valor fora do padrão é sinalizado após pelo menos três observações históricas limpas quando o lançamento atual é pelo menos 1,5 vez a mediana anterior e a diferença absoluta é de no mínimo R$ 20,00.
- O titular pode marcar o sinal como REVIEW, NOT_ANOMALOUS ou RESOLVED. Essas respostas são persistidas por usuário e transação; descartar um sinal não apaga nem altera a transação importada.
- O botão “Simular possível estorno” adiciona somente uma entrada hipotética ao cenário de 90 dias e compara menor saldo e dias abaixo de zero antes/depois. Não envia comando ao banco e não prevê que o dinheiro será devolvido.

Essa segunda camada só classifica transações de saída liquidadas importadas pelo Open Finance. A camada de recorrências pode usar outros movimentos disponíveis na conta. As duas camadas usam regras determinísticas próprias, com limiares documentados e diferentes.

## Regras de segurança e confiança

- O serviço consulta apenas as carteiras e movimentações do usuário autenticado; não recebe um userId do cliente.
- O endpoint envia Cache-Control: no-store.
- Não usa modelo de linguagem para decidir se uma cobrança é recorrente ou para calcular valores.
- A linguagem do produto usa “sinal”, “possível” e “estimado”. Duas compras legítimas iguais podem parecer duplicadas; o sinal não é uma confirmação de fraude.
- O radar não cancela assinatura, não contesta compra e não move dinheiro. A pessoa confere o histórico e decide.
- Datas futuras são estimativas derivadas da última cadência observada, não compromissos garantidos.

## Critérios de aceite

- Recorrência com valor estável aparece sem alerta de aumento.
- Recorrência com aumento superior a ambos os limiares permanece visível e mostra o cálculo e as evidências.
- Lançamentos com mesmo nome, valor e data são sinalizados como possível duplicidade.
- Entradas, transferências genéricas e cobranças isoladas não são apresentadas como assinatura mensal.
- A tela distingue aumento, possível duplicidade e sinal inicial; avisa sobre dados de Open Finance desatualizados.
- Testes automatizados e CI passam no backend e frontend.

## Limitações e métricas

Contrapartes com descrições inconsistentes podem separar uma recorrência em grupos diferentes. Contrapartes genéricas podem esconder a identidade comercial no sandbox. Os limiares são regras determinísticas de primeira versão, não um modelo de fraude. A próxima etapa é medir quantos sinais são confirmados como úteis pelos usuários e quantos são rejeitados, sem recolher o texto completo do extrato para fins analíticos.

A métrica de produto deve ser o percentual de sinais que o usuário confirma como úteis, junto ao número de sinais revisados e ignorados. Nenhuma melhoria deve maximizar alertas por si só: alertas falsos reduzem a confiança.
