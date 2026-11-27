# ADR 0022: Revisão de usabilidade, navegação por pergunta e "Perguntar" como ação

Status: aceito em 26/11/2026, implementado no PR #3. A validação com pessoas reais continua pendente.

## Contexto

Depois do Início completo (ADR 0021), o dono usou o app e disse: "não gostei muito da usabilidade, de algumas disposições". Nesse ponto foram feitas duas coisas.

- **Auditoria tela a tela.** Foram 17 telas, em 1440 e 390 px, comparadas com a `DESIGN.md`. Os alvos de toque e a ordem de foco foram medidos no Playwright.
- **Pesquisa de mercado.** Cobriu 9 produtos brasileiros e 10 estrangeiros, com fontes, em [`docs/produto/pesquisa-de-mercado-2026-11.md`](../produto/pesquisa-de-mercado-2026-11.md).

O achado mais grave não era de disposição. Era de **confiança**. A frase do número do dia ("R$ 15,37 por dia, sem nenhum dia negativo") aparecia ao lado de uma projeção negativa. As duas estão certas, mas partem de premissas diferentes, e a frase apresentava uma condição como se fosse fato.

## Decisão

### 1. A navegação segue as perguntas do dia, não as telas

| Grupo | Itens | Pergunta |
| --- | --- | --- |
| Visão | Início, Futuro, Plano do mês | Quanto posso gastar e como está o mês |
| Dinheiro | Entradas e saídas, Extrato, Envelopes | O que aconteceu e o que separei |
| Compromissos | Cartões e dívidas, Radar de cobranças | O que vai sair e quando |
| Mais | Análise, Carteiras, Open Finance | Configurar e olhar para trás |

- **"Dívidas" passa a se chamar "Compromissos".** O Radar lista aluguel, luz e streaming, que não são dívida. Com o nome antigo, a categoria contradizia o próprio conteúdo.
- **Carteiras desce para "Mais".** O saldo por conta e o extrato da carteira repetem Entradas e saídas e Extrato.
- **"Perguntar" deixa de ser destino e vira ação.** Fica no topo de todas as telas, ao lado de ocultar saldo. Perguntar é algo que se faz a partir de qualquer tela, não um lugar para onde se vai. Antes, ocupava 1 dos 5 lugares fixos do celular.
- **Celular:** Início, Futuro, Plano do mês, Compromissos e Mais. Antes o Plano do mês ficava escondido em "Mais".

### 2. Toda condição aparece como condição

- O número do dia diz a premissa: gastando até esse valor, nenhum dia fica negativo.
- Quando o ritmo atual leva ao negativo, uma linha de contraste diz quando isso acontece.
- Os três números do Futuro fecham a conta do herói, e a pessoa consegue refazê-la de cabeça.

### 3. O selo "Confirmado" sai

Confirmado é o estado normal (DESIGN.md, princípio 5). O selo fica só para "Estimado" e "Simulado", que se destacam justamente por serem exceção.

### 4. Ler vem antes de editar

- **Plano do mês abre em modo leitura**, com a resposta "faltam" ou "sobram". O editor abre com "Editar fatias".
- **Com conexão ativa, o Open Finance mostra contas e sincronização**, e não mais o passo a passo de cadastro.
- **A Análise gera o relatório ao abrir.**

### 5. Uma linha por aviso e alvo de 44 px no toque

- O aviso de dado atrasado vira uma linha, com "Por quê?". Antes ocupava 180 px no celular, acima do número do dia.
- Toda linha de lista abre o detalhe pela linha inteira, não só pelo chevron.

## O que não entrou, e por quê

- **Juntar Extrato, Entradas e saídas, Carteiras e Análise numa tela "Movimentações".** É a recomendação estrutural da auditoria, mas mexe em rotas, testes e no material da A3 a um dia do CP3. Agrupar no menu resolve a maior parte do problema de achar as coisas. A fusão fica para depois da validação com pessoas.
- **Enxugar o Início para menos de 1.000 px.** A auditoria pediu, mas o dono pediu o contrário em 25/11 ("achei a tela de início bem vazia"). O Início continua completo; a correção foi de hierarquia e de texto.
- **Fila de revisão, regras de categoria, calendário de saldo e alerta de saldo mínimo.** São os melhores padrões da pesquisa, mas cada um é recurso novo, com modelo de dados próprio. Estão priorizados na pesquisa e não cabem numa revisão de usabilidade.

## Consequências

- A seção "Layout" da `DESIGN.md` foi atualizada para os grupos e a barra inferior novos.
- `/billing-radar` continua com rota própria. No celular, ele acende "Compromissos".
- O E2E (`journey.cjs`) não depende do menu e não mudou por causa disso.
