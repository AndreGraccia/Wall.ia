# Plano de ação: o que as auditorias pediram e onde cada item está

Fontes: auditoria estratégica e auditoria visual/UX de 26/11/2026 (feitas fora do repositório, somente leitura), ADRs 0021 a 0023 e `docs/backlog.md`. Atualizado em 27/11/2026.

Estados usados:
- **Feito**: implementado e coberto por teste automatizado.
- **Parcial**: parte implementada; o que falta está escrito.
- **Planejado**: ainda não existe no código.
- **Do dono**: depende de decisão ou de ação fora do código.

Nenhum item está **validado com usuários** nem **pronto para produção**: a validação não aconteceu e o produto não foi publicado.

## P0: integridade financeira

| Item | Estado | Onde / o que falta |
| --- | --- | --- |
| Separar despesa essencial do dia a dia de lazer | Feito | Fatia "Essenciais" (contas fixas, parcelas e essenciais do mês); não classificado aparece à parte. Falta classificar pela categoria do Open Finance em vez do nome |
| Compra no cartão contada em Lazer ou Essenciais | Do dono | Hoje conta na fatura (regime de caixa, ADR 0011). Medir pela compra muda essa decisão |
| B10, centavos em parcelas | Feito (já estava) | `ScenarioSimulator.split`; o resto vai na primeira parcela |
| B11, par de transferência entre contas próprias | Parcial | Ambíguo deixa de ser escondido. Falta guardar o documento da contraparte (dado pessoal, cifrado, migração nova) |
| B12, fatura paga antes do vencimento descontada duas vezes | Feito | Pagamento com nome do cartão ou valor exato de uma única fatura |
| B12, estorno, reembolso e pagamento parcial sem nome | Planejado | O sandbox não envia os dados |
| Objetivo principal influenciar as sugestões | Feito | Regras explícitas, com o motivo na tela |

## P0: interface

| Item | Estado | Onde / o que falta |
| --- | --- | --- |
| Ocultar saldo sem remontar a página | Feito | Teste cobre as 17 rotas do shell |
| Sobreposição no cabeçalho do computador | Feito | O título reserva a largura medida das ações |
| Radar duplicado no celular | Feito | Acesso por Cartões e dívidas |
| Alvo de toque de 44 px no menu | Feito | |
| Capturas em todos os tamanhos e comparação visual no CI | Planejado | Hoje o E2E percorre 375 e 1280 px |
| Verificação automática de acessibilidade (axe) | Planejado | Há contraste por token e navegação por teclado no E2E |

## P1: uso diário

| Item | Estado | Próximo passo |
| --- | --- | --- |
| Primeiros passos no Início | Feito | Medir se leva ao primeiro resultado |
| Fila "Para revisar" e correção de categoria | Planejado | Primeira entrega depois da A3: categoria por transação, com origem e desfazer |
| Regra criada a partir da correção, com prévia | Planejado | Depende da fila |
| Dividir uma transação entre categorias | Planejado | Depende da fila |
| Meta com valor e data (B56) | Planejado | Modelo de meta com alvo, prazo e acumulado |
| Perfil ampliado (ciclo de renda, dependentes, reserva) | Planejado | Só com uso concreto para cada dado (LGPD) |
| Comparar dois métodos lado a lado | Planejado | `POST /plan/fit` já simula sem gravar |
| Fundos para despesas anuais e orçamento flexível | Planejado | |
| Início com modo resumido e ordem escolhida | Planejado | O dono pediu a tela completa; testar com pessoas antes |
| Unificar Extrato, Entradas e saídas, Carteiras e Análise | Planejado | Só depois do teste de tarefas |
| Gráfico com tabela alternativa | Planejado | |

## P2: diferenciação

| Item | Estado | Condição |
| --- | --- | --- |
| Assistente com IA em todas as áreas (B57) | Planejado | Etapa 1: responder sobre plano e método com os dados da pessoa. Etapa 2: preparar a ação e pedir confirmação. O modelo nunca calcula nem grava. Depende de categorias confiáveis |
| Calendário de saldo diário com simulação | Planejado | |
| Cenários salvos | Planejado | |
| Patrimônio e investimentos informativos | Feito | Manual (ADR 0026), sem recomendar ativo; recomendação individual é regulada pela CVM. Falta gráfico da evolução e validar com pessoas |
| Desenvolvimento pessoal (onde estou, onde quero chegar) | Feito | "Minha evolução" (ADR 0026): objetivo, etapas, custo, prazo e meta ligada. Falta validar com pessoas |
| Plano compartilhado | Planejado | |

## P3 e operação

| Item | Estado | Condição |
| --- | --- | --- |
| Open Finance real | Do dono | Contratar agregador; fluxo de consentimento completo, várias instituições, sincronização incremental |
| Produção | Do dono | Os planos gratuitos do `render.yaml` e da Vercel servem para demonstração, não para dado financeiro real |
| Proteção da `main` e revisão obrigatória | Do dono do repositório | Precisa de permissão de administrador |
| Branches antigas | Do dono | Nenhuma guarda arquivo que falte na V2 (conferido em 26/11) |
| Validação com 8 a 12 pessoas | Do dono | Roteiro na seção 9 da auditoria visual |
| Migrar do Create React App (KAN-31) | Planejado | 24 vulnerabilidades de dependências de build |

## Ordem recomendada

1. Integrar a V2 (PR #3) e esta correção.
2. Testar com pessoas.
3. Fila "Para revisar", correção de categoria e regras.
4. Metas completas e comparação de métodos.
5. Assistente, etapa 1.
6. Open Finance real e produção.
7. Patrimônio e desenvolvimento pessoal.
