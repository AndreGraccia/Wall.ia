# Estratégia de produto

Onde o Wall.ia pode ser melhor que tudo o que existe, sem sair do que ele é. Números de mercado vêm de [pesquisa-mercado.md](pesquisa-mercado.md); números de produto vêm do sandbox local, reproduzíveis pelo [roteiro de teste](open-finance-email-tests.md).

## O que o Wall.ia é, em uma frase

**A carteira que mostra o que vai faltar antes de faltar, explica cada número e deixa testar a decisão antes de gastar.**

Três regras seguram essa frase e decidem o que entra e o que fica fora:

1. **Pergunta em vez de supor.** Nada entra na conta sem o usuário confirmar.
2. **Java calcula, a IA no máximo explica.** Nenhum número vem de modelo de linguagem ([ADR 0001](adr/0001-motor-futuro-deterministico.md)).
3. **Neutro.** O Wall.ia não vende crédito. É o que um banco não consegue prometer.

## Diagnóstico: onde o produto estava fraco

Análise feita em 23/09/2026 sobre o código e o sandbox.

| # | Problema | Evidência | Efeito |
| --- | --- | --- | --- |
| D1 | A projeção ignorava o gasto do dia a dia | Mercado Bairro: R$ 2.561,75 em 90 dias, fora das 8 perguntas | Ponto mais baixo mostrado: -R$ 324,87. Real, com o mercado: -R$ 637,93. Erro de R$ 313 para o lado otimista |
| D2 | A tela não respondia "quanto posso gastar?" | Três números de mesmo peso no topo do Futuro | A pessoa fazia a conta de cabeça |
| D3 | O alerta não tinha preço | "Seu saldo pode ficar negativo entre 03/10 e 04/10" | Sem motivo econômico para agir; rotativo a 436% a.a. e cheque especial a até 8% a.m. ficavam invisíveis |
| D4 | Responder uma dúvida exigia navegar por três telas | Futuro, Modo Futuro, Cartões | O próximo passo do README (assistente) não existia |
| D5 | O banco aceitava saldo negativo em carteira local | V8 removeu a restrição para aceitar Open Finance negativo | Regra de dinheiro só no Java; corrigido pela V13 |
| D6 | Login recusava usuário digitado com maiúscula | Cadastro compara ignorando maiúsculas; login comparava exato | Conta criada que não entra; corrigido |

## Mapa de oportunidades

Critérios: **dor** (quanto resolve de um problema com número por trás), **propósito** (reforça as três regras), **diferencial** (existe em algum concorrente da pesquisa?), **esforço** (P, M, G).

| Oportunidade | Dor | Propósito | Diferencial no Brasil | Esforço | Decisão |
| --- | --- | --- | --- | --- | --- |
| Gastos do dia a dia como pergunta | D1: projeção otimista | Pergunta em vez de supor | Mobills e Organizze só têm saldo de fim de mês | M | **Feito** |
| Limite diário até a próxima renda | D2 | Número calculado e explicado | Nenhum player pesquisado | P | **Feito** |
| Custo de não agir (cheque especial) | D3; 29,9% das famílias com conta atrasada | Explica com número | Nenhum player pesquisado | P | **Feito** |
| Pergunte à Wall.ia, respondido pelo motor | D4 | IA não calcula | Assistentes de WhatsApp registram gasto, não projetam | M | **Feito** |
| Restrição de saldo local no banco | D5 | Dinheiro protegido em duas camadas | Interno | P | **Feito** (V13) |
| Gasto variável no cartão (fatura futura estimada) | Faturas futuras só conhecem compras passadas | Pergunta em vez de supor | Nenhum | M | **Feito** (ADR 0003) |
| Como evitar o negativo | Alerta ainda não diz o que fazer além de cortar | Explica e sugere, não executa | Nenhum | M | **Feito** (ADR 0003) |
| Alertas proativos por e-mail | A pessoa precisa abrir o app para descobrir | Número calculado chega antes do problema | Nubank avisa cheque especial em outro banco | M | **Feito** (ADR 0003); push fica para depois |
| Metas como compromisso na projeção | README, item 4 | Pergunta em vez de supor | Comum, mas não ligado à projeção diária | M | **Feito** (ADR 0003) |
| Medição e limite do Pergunte | Sem saber o que as pessoas perguntam, não dá para decidir o próximo passo | Mede sem guardar texto | Interno | P | **Feito** (ADR 0003) |
| Classificador de intenção com LLM para o Pergunte | Frases fora do padrão voltam UNKNOWN | IA só escolhe o cálculo | Nenhum | P | Quando a medição pedir |
| Ledger de dupla entrada | Base para dinheiro real | Correção por estorno | Interno | G | Proposto, com gatilho (ADR 0004) |
| Envelopes no lugar de Movimentar | Tela sem uso real | Pergunta em vez de supor | YNAB tem envelopes, sem projeção diária | M | **Feito** (ADR 0005) |
| Placar de precisão da previsão | Estrela-guia sem medição; confiança no número | Explica com número, inclusive o próprio erro | Nenhum player pesquisado | M | **Feito** (ADR 0005) |
| Pix agendado a partir do plano de saída | Ver o futuro sem poder agir | Sugere, o usuário decide | Magie faz Pix, sem projeção | M | **Simulado** (ADR 0005); real depende de credenciamento |
| Trilha de auditoria administrativa | Admin lista dados de todos sem deixar rastro | Transparência | Interno | P | **Feito** (ADR 0004) |
| Marketplace de crédito | Receita | **Viola a regra 3** | Guiabolso fechou com esse modelo | M | **Não fazer** |
| Registro de gasto por WhatsApp | Menos atrito para anotar | Com Open Finance, anotar à mão é o problema errado | Commodity (Magie, ZapGastos, Focca) | M | **Não fazer** |
| Previsão feita por modelo de linguagem | "Parecer inteligente" | **Viola a regra 2** | Nenhum banco confia nisso para dinheiro | P | **Não fazer** |
| Investimentos e patrimônio | Público amplo | Fora do horizonte curto, onde mora o rotativo | Monarch Plus, bancos | G | Não agora |

## O que foi construído nesta rodada

Detalhe técnico no [ADR 0002](adr/0002-limite-diario-e-perguntas.md).

### Gastos do dia a dia

A Wall.ia calcula a média diária dos últimos 90 dias, fora contas fixas, faturas, empréstimos e dinheiro entre contas próprias, e pergunta: "Você gasta em média R$ 28,46 por dia no dia a dia. Considerar na projeção?". Mostra de onde veio (R$ 2.561,75 em 12 compras, a maior parte no Mercado Bairro). A pessoa confirma, informa outro valor ou recusa.

### Limite diário

A primeira coisa na tela Futuro:

- Com folga (exemplo ilustrativo): "Até 05/10, sua próxima entrada: você pode gastar até R$ 40 por dia. Seu ritmo é R$ 28 por dia, sobram R$ 12 por dia."
- Sem folga (sandbox): "Faltam R$ 324,87 mesmo sem gastar nada. O dia mais apertado é 03/10."

### Custo de não agir

Cada janela negativa diz quanto o cheque especial pode cobrar, no teto legal. No sandbox, com o dia a dia confirmado: até R$ 3,20 de juros em dois dias. O valor é pequeno de propósito: mostra que o problema é o hábito recorrente, não um dia.

### Pergunte à Wall.ia

Tela nova (`/ask`) com cinco perguntas sugeridas e campo livre. Exemplos reais do sandbox, com as 8 perguntas confirmadas e o dia a dia informado em R$ 20 por dia:

| Pergunta | Resposta |
| --- | --- |
| Posso comprar um notebook de R$ 4.000 em 10x? | Melhor não agora. Menor saldo em 90 dias de -R$ 544,87 para -R$ 944,87; dias negativos de 2 para 6; parcela de R$ 400 no Aurora Card Platinum |
| Quanto posso gastar por dia? | Até 05/10, faltam R$ 324,87 mesmo sem gastar nada |
| Por que meu saldo fica negativo? | Entre 03/10 e 04/10, com a lista das saídas antes do salário |
| Quando cai minha próxima renda? | Concentrix S.A., em 05/10, R$ 4.200,00 |
| Qual a previsão do tempo? | "Ainda não sei responder isso", com a lista do que dá para perguntar |

## Segunda rodada (ADR 0003)

- **Compras do dia a dia no cartão.** No sandbox: R$ 8,30 por dia (Posto Shell, iFood, Spotify em 76 dias), perguntadas como o dia a dia da conta e lançadas na fatura em que cada dia cai.
- **Plano de saída.** No sandbox: "Combinar o pagamento de Imobiliária Lar Seguro (R$ 1.500) de 01/10 para 05/10, depois da entrada. Nenhum dia fica abaixo de zero." Fatura e empréstimo nunca são sugeridos para adiar.
- **Metas.** Até 10, cada uma como compromisso mensal que o limite diário já desconta.
- **Alertas por e-mail.** Opcionais; um por janela negativa nova, às 8h. Verificado ponta a ponta com o Mailpit.
- **Pergunte medido e limitado.** 30 perguntas a cada 10 minutos por pessoa; contagem diária por intenção, sem texto.

## Terceira rodada (ADR 0004 e atualização da plataforma)

- **Trilha de auditoria administrativa:** toda chamada a endpoint de admin, inclusive as negadas, fica registrada com quem, o quê e o resultado, sem corpo nem parâmetros.
- **Spring Boot 3.0.4 para 3.5.16:** a versão antiga estava sem suporte e com CVEs conhecidos. O upgrade encontrou um uso de API do Java 19 que quebraria no JRE 17 de produção.
- **Ledger de dupla entrada, proposto:** hoje nenhum real se move dentro do Wall.ia (carteira local nasce com zero, não há depósito, Open Finance é só leitura). O desenho está pronto no ADR 0004, para quando houver dinheiro em movimento.

## Quarta rodada (ADR 0005 e revisão de segurança)

Análise feita em 24/09/2026. Duas revisões independentes (frontend das telas novas e segurança do que entrou depois da última auditoria) e uma leitura das migrações herdadas.

**O que estava errado e foi corrigido**

| Achado | Gravidade | Correção |
| --- | --- | --- |
| V2/V4 do template criavam `johndoe` e `lindacalvin` como ADMIN, com hash público, em todo ambiente | Alta | V19 desativa as contas demo e tira o papel de admin |
| Alerta por e-mail podia ser apontado para o e-mail de outra pessoa (cadastro não confirma e-mail) com texto livre no nome | Média | Alerta exige e-mail verificado pelo código do Open Finance; o nome no corpo vira uma palavra só de letras |
| Atrás do nginx, o limite de cadastro por IP virava limite global | Média | `forward-headers-strategy: native`, nginx sobrescreve `X-Forwarded-For`, backend só em 127.0.0.1 |
| Usuário com formato de e-mail sombreava o login por e-mail de outra pessoa | Baixa | Usuário sem `@`; login com `@` procura o e-mail primeiro |
| Busca ignora maiúsculas, índice único não | Baixa | V19 cria índices em `lower(username)` e `lower(email)` |
| A sugestão em inglês do próprio Pergunte ("R$ 4,000 in 10x") voltava "quanto?" | Defeito | Interpretador entende agrupamento com vírgula |
| Futuro: trocar 30/60/90 rápido deixava a projeção errada na tela; usuário sem dados via R$ 0,00 e um gráfico reto | Defeito | Resposta atrasada é descartada; estado "ainda não há o que projetar" |
| Mais 10 defeitos de tela (tabela sem rolagem em 390 px, R$ 0,00 exibido como traço, alerta que parecia desligado quando falhava, limite de cartão zero virando 250000%) | Defeito | Corrigidos; 7 testes de tela novos travam os principais |

**O que foi construído**

- **Envelopes**, no lugar de Movimentar. Dinheiro separado vira piso do limite diário; a projeção continua no saldo real.
- **Quanto a Wall.ia acertou.** Cada sync guarda o saldo real e a projeção; 7 a 30 dias depois, a previsão é comparada com o real. É a métrica estrela-guia medida por usuário.
- **Pix agendado, simulado.** O plano de saída monta a proposta com o que o motor calculou e diz que nada é enviado.

## Onde o Wall.ia se diferencia, com o que existe hoje

Comparação com os players da [pesquisa](pesquisa-mercado.md), seção 3. "Não" quer dizer que a funcionalidade não aparece no material público consultado.

| Capacidade | Mobills / Organizze | Assistentes de WhatsApp (Magie, Financinha) | PFM dos bancos | Wall.ia |
| --- | --- | --- | --- | --- |
| Saldo projetado dia a dia, não só no fim do mês | Fim do mês | "Antecipa riscos" (Financinha), sem detalhe público | Não | Sim, 30/60/90 dias |
| Cada número com origem e grau de certeza | Não | Não | Não | Confirmado, estimado ou hipotético em toda linha |
| Pergunta antes de supor recorrência ou gasto diário | Não | Registra o que a pessoa manda | Não | Sim, com a evidência |
| Limite diário até a próxima entrada | Não | Não | Não | Sim, com o dia que o define |
| Plano de saída testado pelo motor | Não | Não | Não | Até 3 ações, nunca adiar fatura ou empréstimo |
| Mostra o próprio erro de previsão | Não | Não | Não | Sim, com os negativos que não previu |
| Vende crédito | Mobills é do Santander | Magie migra para B2B | Sim | Não, e isso é regra |

O que um concorrente não copia rápido não é uma tela, é o conjunto: um banco não publica o erro da própria previsão nem promete não vender crédito, e um assistente de WhatsApp que registra gasto não tem o motor para projetar. O placar de precisão transforma "confie em nós" em número verificável, e é também o instrumento para saber se o produto funciona.

## Sexta rodada: revisões independentes e o que o mercado ensina

**Revisões.** Três revisões independentes (código, segurança, UX e acessibilidade) sobre tudo o que entrou desde o ADR 0004. Nenhum achado crítico. Os que mudavam número ou segurança foram corrigidos com teste:

- O placar comparava a previsão do fim do dia com o saldo lido às 7h30, antes das contas do dia. Num vencimento de aluguel, isso contaria um "negativo evitado" que não foi evitado.
- O cartão do limite mostrava três números negativos diferentes para a mesma pergunta. Agora separa o que falta no banco, o que custa manter os envelopes e o menor saldo no ritmo de gasto da pessoa.
- Um navegador compartilhado passava os alertas de uma conta para a próxima que entrasse.
- As migrações nunca eram testadas. Agora o CI aplica todas num Postgres vazio a cada push.

**Pesquisa de mercado.** Warren, bancos e PFMs brasileiros, YNAB, Monzo, Rocket Money, Emma, Simplifi e outros. Monzo, Emma e Simplifi têm um "saldo livre", mas nenhum projeta dia a dia com plano de saída do negativo nem publica o próprio erro. O que entrou nesta rodada:

| Ideia | De onde veio | Como ficou no Wall.ia |
| --- | --- | --- |
| Transparência de custo | Warren mostra quanto o cliente paga a ela | **Quanto este dinheiro custa:** juros da próxima parcela e juros até o fim de cada empréstimo, calculados com o saldo devedor, a parcela e a taxa do banco |
| Meta com plano | Simulador de objetivos da Warren, Targets do YNAB | **Ver se cabe:** antes de criar a meta, o motor diz se ela cria dias negativos em 90 dias |
| Cancelar assinatura | Rocket Money, que cobra 35% a 60% da economia | **Como cancelar:** passos, mensagem pronta e consumidor.gov.br, sem comissão e sem agir pela pessoa |

Próximas da lista, por nota (dor x diferencial / esforço):

1. **Painel de dívidas** com o relatório SCR do Registrato (fonte oficial e gratuita). Começar com entrada manual.
2. **Tarifas e IOF no mês**, lidos do extrato com a lista das linhas encontradas. Depende de dado real, porque o sandbox não tem tarifa.
3. **Planejador de quitação** (avalanche ou bola de neve), sem oferecer empréstimo para quitar. Feito para os empréstimos em 25/09 ([ADR 0013](adr/0013-planejador-de-quitacao.md)); o cartão entra quando a pessoa confirmar que está no rotativo.
4. **Divisor da renda na chegada**: quando o salário cai, sugerir a divisão entre envelopes, sempre com confirmação.

Não fazer, com motivo: adiantamento de salário e cobertura de negativo (é crédito, regra 3), sugestão de caixinha ou investimento (é venda, regra 3), poupança automática que move dinheiro sozinha (regra 1), assistente que responde com número de modelo de linguagem (regra 2).

## Nova oportunidade priorizada: Radar de cobranças (26/10/2026)

O diagnóstico original já identificava o problema de compromissos que somem ou mudam no extrato. A revisão de implementação encontrou uma lacuna adicional: o detector mensal geral exige estabilidade de valor e pode deixar de reconhecer a recorrência quando um preço aumenta.

O Radar de cobranças cria uma leitura separada para saídas liquidadas e mantém a cobrança visível quando o valor muda. Sinaliza aumento apenas quando a última cobrança supera a mediana anterior em pelo menos R$ 2,00 e 10%, e possíveis duplicidades quando a mesma contraparte apresenta lançamentos de mesmo valor no mesmo dia. Cada sinal inclui as transações de evidência; datas futuras são estimadas.

É uma hipótese de diferenciação, não uma alegação de exclusividade no mercado: a proposta é ligar cobrança alterada, evidência e impacto potencial no caixa futuro, sem vender crédito nem tomar decisões pelo usuário. A primeira implementação está descrita em [ADR 0019](adr/0019-radar-de-cobrancas.md) e [evolução do produto](evolucao-radar-cobrancas.md), pendente dos workflows CI/E2E e revisão.

**Como medir valor:** proporção de sinais que usuários consideram úteis, sinais revisados versus ignorados, falsos positivos relatados e capacidade de explicar por que cada item apareceu. Não otimizar pela quantidade de alertas.

## Próximos passos, em ordem

Feitos na quinta rodada ([ADR 0006](adr/0006-sync-diario-e-push-sem-sdk.md)): sync diário automático, contagem do clique em "Preparar Pix", avisos por push no navegador e painel da métrica principal para o time.

O que resta tem gatilho, e nenhum deles aconteceu ainda:

| Passo | Gatilho | Onde olhar |
| --- | --- | --- |
| Classificador de intenção para o Pergunte | Mais de 20% das perguntas sem resposta | Painel de métricas, "O que perguntam" |
| Estimativa do dia a dia por cartão | Usuários com mais de um cartão ativo | Consulta em `credit_card` |
| Limites em Redis (login, Gemini, Pergunte) | Rodar mais de uma instância da API | Plano de deploy |
| Credenciamento como iniciador de pagamento e ledger | Cliques em "Preparar Pix" mostrando demanda | Painel de métricas, "Interesse no Pix de verdade" |
| Sync em paralelo ou em fila | Job diário levando minutos | Log `Daily Open Finance sync` |

## Métricas

| Métrica | O que mede | Por quê |
| --- | --- | --- |
| **Dias no negativo evitados por usuário ativo por mês** (estrela-guia) | Janelas negativas previstas que não aconteceram, comparando projeção e saldo real | É o valor que o produto promete |
| Ativação | Conectou o Open Finance e respondeu pelo menos 3 perguntas em 7 dias | Sem respostas, a projeção não conhece a pessoa |
| Dia a dia confirmado | Porcentagem de usuários com a estimativa confirmada | Mede se a projeção é realista |
| Perguntas sem resposta | Porcentagem de `UNKNOWN` no Pergunte | Diz quando o interpretador precisa crescer |
| Retenção D30 | Voltou 30 dias depois | Referência da pesquisa: PFM freemium converte cerca de 2,1% até o D35 |

## Riscos

| Risco | Mitigação |
| --- | --- |
| Um banco grande copia a projeção diária | A defesa é neutralidade e explicabilidade, não a funcionalidade. Tudo com origem e certeza visíveis |
| A média do dia a dia erra para quem tem gastos irregulares | O usuário pode informar o próprio valor; a certeza aparece como "estimado" |
| O custo do Open Finance real (Pluggy a partir de R$ 2.500 por mês) | Sandbox para desenvolvimento; B2B2C como canal, como sugere a pesquisa |
| Confundir o limite com uma recomendação financeira | Texto sempre descritivo ("pode gastar sem ficar negativo"), nunca prescritivo sobre investimento ou crédito |
