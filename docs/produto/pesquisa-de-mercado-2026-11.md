# Pesquisa de mercado e engenharia reversa de UX (26/11/2026)

Feita com busca na web: páginas oficiais, centrais de ajuda, lojas de app e resenhas. Nenhum app concorrente foi aberto. Quando a fonte não descreve uma tela, ela não é afirmada. As fontes estão no fim. A decisão que saiu daqui está no [ADR 0022](../adr/0022-revisao-de-usabilidade-e-navegacao.md).

## Onde o Wall.ia está

**À frente** (nada equivalente nos concorrentes pesquisados, o que não prova que não exista):
- Projeção diária de 90 dias em que cada lançamento diz se é confirmado, estimado ou simulado, e de onde veio.
- "Quanto posso gastar por dia **até a próxima entrada**". O Simplifi mede até o fim do mês, o que não serve para quem recebe por quinzena, vale + salário ou como autônomo.
- A primeira janela negativa, com as causas.
- Custo do cheque especial pela taxa do Banco Central.
- Dívidas do jeito brasileiro: Pix no crédito, rotativo, CET.
- Catálogo de 9 métodos, escolhidos por regras explícitas.
- LGPD por padrão: exportar e apagar.

**Empatado:**
- Recorrências confirmadas pela pessoa (Monarch, Lunch Money).
- Assinaturas e aumento de preço (Emma, Rocket Money).
- Envelopes, metas e plano.
- Assistente em linguagem natural (Monarch, Copilot, Simplifi).
- Web Push e PWA. Já existem no Wall.ia (`frontend/public/sw.js`, `service/push/`).

**Atrás:**
- Sem app nativo.
- Open Finance ainda em sandbox, enquanto Mobills, Organizze, PicPay e Inter conectam bancos reais.
- Sem fila de revisão nem regras de categorização.
- Sem split de transação.
- Sem colaboração de casal.
- Sem patrimônio. Investimentos ficam fora por decisão.
- Horizonte de 90 dias, contra 12 meses no Simplifi e de 6 meses a 60 anos no PocketSmith.

**Por que não dá para afirmar que é o melhor da categoria:**
- Não há validação com pessoas reais: nem retenção, nem teste de usabilidade.
- A precisão da projeção nunca foi medida contra o saldo real, e essa é a promessa central.
- O Open Finance só roda em sandbox. Os concorrentes sofrem justamente com a sincronização em produção (Reclame Aqui do Mobills, status do Monarch).
- Não existe modelo de receita testado. Olivia (comprada pelo Nubank) e Guiabolso (comprado pelo PicPay) foram fechados.

## Padrões que valem copiar a ideia, não a tela

| Ideia | Origem | Por que serve aqui | Esforço |
| --- | --- | --- | --- |
| Fila "Para revisar" com marcar como revisado | Copilot | A projeção depende de categoria certa, e o Open Finance traz muita transação mal categorizada | M |
| Regra criada a partir da correção, com prévia e desfazer | Copilot (que não desfaz), Lunch Money | Tira atrito do dia a dia | M |
| Calendário de saldo diário, arrastando um evento para simular | PocketSmith | "Dia 5 aperta, dia 20 folga" | M |
| Ritmo ideal contra ritmo real junto do número do dia | Copilot "Free to Spend", Simplifi | Uma leitura visual do número principal | P |
| Alerta de saldo mínimo configurável | PocketSmith | Evita o cheque especial antes de chegar a zero | P |
| Correção ou conciliação de saldo que reancora a projeção | PocketSmith | Ataca a reclamação nº 1 da categoria, o saldo divergente | P/M |
| Resumo semanal por e-mail | Monarch Weekly Recap | Reaproveita o canal que já existe | P |
| Onboarding em checklist retomável | YNAB | Leva ao valor central (quanto posso gastar) em poucos passos | M |
| Despesas não mensais (IPVA, IPTU, material escolar) provisionadas | YNAB, Monarch, Simplifi | O começo do ano no Brasil quebra previsão mensal | M |
| Split e totais do filtro | YNAB, Copilot web | Mercado com farmácia, conta dividida | M |
| Cenários salvos ("e se o 13º atrasar") | PocketSmith, Origin | Estende "Simular compra" | M |
| Plano compartilhado do casal | YNAB, Monarch | Nenhum concorrente brasileiro confirmado tem | G |

Fora de propósito: recomendação de investimento; negociação de contas cobrando percentual da economia (Rocket Money); adiantamento de dinheiro (Cleo, que fez acordo com a FTC).

## O que a categoria erra

1. Sincronização que quebra e saldo que diverge (Mobills, Monarch).
2. Cobrança depois de cancelar (Rocket Money, Cleo).
3. Open Finance atrás de paywall (Organizze, Minhas Economias).
4. Regra de categoria ampla demais e irreversível (Copilot).
5. Falta de paridade entre plataformas (Copilot sem Android e com a web incompleta).
6. App fechado e histórico perdido (Olivia, Guiabolso, Kinvo).
7. App de banco que faz o mínimo: o Itaú tem 6 categorias fixas.

## Fontes

- PocketSmith: pocketsmith.com/tour/cash-flow-forecasts · my.pocketsmith.com/plans · learn.pocketsmith.com/article/1246-using-the-calendar-and-forecast-graph
- Monarch: monarch.com/features/budgeting · monarch.com/pricing · help.monarch.com (AI Features, Customize Your Dashboard) · status.monarch.com
- Copilot: copilot.money · help.copilot.money (Dashboard tab, Copilot Money for web, bank category rules) · intercom.help/copilotmoney (name rules, Copilot Intelligence)
- YNAB: ynab.com/pricing · support.ynab.com (getting started, month rollover, split, search, linked accounts) · ynab.com/whats-new
- Simplifi: quicken.com/products/simplifi/v3 · quicken.com/products/simplifi-ai-assist
- Rocket Money: rocketmoney.com/learn · help.rocketmoney.com · cnbc.com/select/rocket-money-review
- Cleo: thepennyhoarder.com/budgeting/cleo-app-review · finder.com/cash-advance-apps/cleo
- Emma: apps.apple.com/gb/app/id1270062373 · moneytothemasses.com
- Lunch Money: lunchmoney.app/features/recurring-expenses · lunchmoney.app/features/rules
- Mobills: apps.apple.com/BR/app/id921838244 · mobills.com.br/pricing · reclameaqui.com.br (sincronização após Open Finance; divergência de saldo) · repositorio.ufc.br (TCC 2026)
- Organizze: apps.apple.com/BR/app/id677699286 · serasa.com.br/ajuda (parceria Organizze)
- Minhas Economias: apps.apple.com/br/app/minhas-economias/id520869873
- Meu Dinheiro: docs.meudinheiroweb.com.br/movimentacoes-e-caixa/fluxo-de-caixa
- Olivia: finsidersbrasil.com.br (Olivia comprada pelo Nubank vai encerrar app)
- Guiabolso: startups.com.br (Guiabolso comprado pelo PicPay será encerrado) · mercadoeconsumo.com.br
- Kinvo: startups.com.br (BTG compra o Kinvo) · reclameaqui.com.br/kinvo
- Nubank: blog.nubank.com.br (categorizar gastos, Caixinhas)
- Itaú: itau.com.br/controle-de-gastos · tecnoblog.net (Itaú super app, controle de gastos)
- Inter: mobiletime.com.br (Inter crédito, dez/2025) · tiinside.com.br (Inter, Open Finance e IA, jun/2026)
