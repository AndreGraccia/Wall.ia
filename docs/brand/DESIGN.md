# Wall.ia · Grafite (identidade 3)

Substitui a "Farol" (19/11/2026), recusada pelo dono depois de ver o app rodando: cores, layout,
hierarquia, tipografia e acabamento. Direção escolhida por ele: **escuro refinado**, quase preto,
contraste alto, gráfico em destaque, menos texto. Referências de nível de acabamento (não de cópia):
Revolut web, Copilot Money.

## O produto em uma linha

Mostra quanto dá para gastar por dia sem ficar negativo e quando o saldo aperta. A tela que
importa é o **futuro do saldo**: um número e uma linha no tempo. Todo o resto é apoio.

## Princípios

1. **Um número, uma linha.** Cada tela principal abre com no máximo uma frase-resposta e, quando
   houver, o gráfico. O gráfico do saldo é o elemento memorável do produto; nada compete com ele.
2. **Cor é significado, não enfeite.** A ação é branca. Cor só aparece para dizer o que um número
   é: projetado/estimado (azul-pervinca), positivo (menta), negativo (coral), atenção (âmbar).
3. **Profundidade por camada, não por sombra.** Superfícies sobem de tom (bg → 1 → 2), com borda
   de 1 px quase invisível. Sem sombra cinza genérica, sem gradiente decorativo.
4. **Menos texto na tela.** Explicação vai para "Por quê?" (disclosure) ou tooltip. Parágrafo de
   ajuda com mais de 2 linhas é defeito.
5. **Certeza visível sem depender de cor.** Confirmado = linha sólida e número normal. Estimado =
   linha tracejada e selo "estimado". Simulado = pontilhado e selo "simulado".
6. **Densidade de app financeiro, não de landing page.** Listas em linhas com divisória, não em
   cartões soltos. Cartão só para grupo interativo (perguntas, formulário, plano).

## Cor

| Token | Hex | Uso |
| --- | --- | --- |
| `bg` | `#08090C` | fundo da aplicação |
| `surface1` | `#0F1116` | painéis, menu lateral |
| `surface2` | `#161920` | campos, linhas em hover, cartões interativos |
| `line` | `#222631` | bordas e divisórias (1 px) |
| `text` | `#F3F5F9` | texto principal, números |
| `text2` | `#A4ABBA` | texto de apoio |
| `muted` | `#7A8294` | rótulos e metadados (≥ 4,5:1 sobre `bg` e `surface1`) |
| `action` | `#F3F5F9` | botão principal (texto `#08090C`) |
| `future` | `#8FA3FF` | projeção, estimado, linha futura do gráfico |
| `positive` | `#4FD1A1` | margem, entrada, ok |
| `negative` | `#FF7B7B` | negativo, buraco, erro |
| `warning` | `#F2B85B` | atenção, dado atrasado |

Tons translúcidos (fundo de selo, área do buraco no gráfico): a cor a 12–16% sobre `surface1`.
Todo par texto/fundo ≥ 4,5:1, componentes e texto grande ≥ 3:1, conferido por
`npm run test:contrast`.

## Tipografia

Uma família: **Geist** (`@fontsource-variable/geist`), algarismos tabulares em todo número
(`font-variant-numeric: tabular-nums`).

| Papel | Tamanho / altura | Peso | Tracking |
| --- | --- | --- | --- |
| Número-herói | 56 px (mobile 40) / 1.05 | 600 | -0.035em |
| Título de página | 28 / 1.2 | 600 | -0.02em |
| Título de seção | 18 / 1.3 | 600 | -0.01em |
| Corpo | 15 / 1.55 | 400 | 0 |
| Apoio | 13 / 1.45 | 400 | 0 |
| Rótulo | 12 / 1.3 | 500 | 0 (sem caixa-alta) |

Proibido: caixa-alta em rótulo, palavra isolada colorida dentro de título, monoespaçada para
número (o tabular da Geist resolve), "→" no fim de botão.

## Espaço, raio, movimento

- Escala 4 px: 4, 8, 12, 16, 24, 32, 48, 64. Conteúdo com largura máxima de 1120 px.
- Raio por hierarquia: painel grande 20, cartão interativo 16, campo e linha 12, botão e selo
  999 (pílula).
- Movimento: só um momento orquestrado, a linha do saldo se desenhando ao abrir o Futuro e o login
  (600 ms, `prefers-reduced-motion` desliga). Fora isso, transição só em resposta a ação
  (abrir, expandir, confirmar), 150 ms.

## Marca

- Logotipo: "Wall.ia" em Geist 600; o ponto é um círculo `future` do mesmo tamanho do ponto "hoje"
  do gráfico. Sem símbolo separado no app; o favicon é o ponto sobre a linha (SVG).
- Tom de voz: frase curta, verbo no início, "você". Sem exclamação. Números sempre com unidade e
  data ("R$ 38,13 por dia até 04/12").

## Layout

### Shell (desktop ≥ 1024)

```
┌──────────┬───────────────────────────────────────────────┐
│ Wall.ia  │  Futuro                     30d 60d 90d   (M) │
│          │                                               │
│ Visão    │  Você pode gastar R$ 38,13 por dia            │
│  Início  │  até 04/12, sem nenhum dia negativo.          │
│  Futuro  │                                               │
│  Plano   │  ─────────●┄┄┄┄┄╲___╱┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄  R$ 0    │
│ Dinheiro │  hoje            03/12          salário       │
│  Entr/Sa.│                                               │
│  Extrato │  Saldo agora   Já tem destino   Depois disso  │
│  Envelop.│  R$ 2.739      R$ 3.745         -R$ 1.006     │
│ Compromi.│  ───────────────────────────────────────────  │
│  Cartões │  3 perguntas melhoram a projeção          (>) │
│  Radar   │  Metas, envelopes, simulação             (>)  │
│ Mais     │                                               │
│  Análise │                                               │
│  Carteir.│                                               │
│ ──────── │                                               │
│ Sandbox  │                                               │
└──────────┴───────────────────────────────────────────────┘
```

- Menu lateral de 232 px em `surface1`, agrupado pela pergunta do dia (Visão, Dinheiro, Compromissos, Mais; ADR 0022),
  item ativo com fundo `surface2` e texto `text`; ícones de traço fino 18 px.
- Barra superior sem fundo: título da página à esquerda, controles da página, "Perguntar" (ação, não destino), ocultar
  saldo e avatar à direita.
- "Ambiente simulado" aparece uma vez, no rodapé do menu, como selo discreto.
- Mobile (< 1024): menu vira barra inferior com 5 destinos (Início, Futuro, Plano do mês,
  Compromissos, Mais) e "Mais" abre uma folha com o resto.

### Futuro (tela-referência)

Ordem fixa: (1) frase-resposta com o número-herói; (2) gráfico de largura total, sem cartão em
volta, com linha sólida até hoje, tracejada `future` depois, área `negative` translúcida abaixo de
zero e no máximo 3 marcadores rotulados (hoje, dia mais apertado, próxima entrada); (3) três
números em colunas, sem caixas; (4) janelas negativas, se houver, em lista; (5) perguntas
pendentes recolhidas num único item ("3 perguntas melhoram a projeção"); (6) metas, envelopes,
simulador e placar em seções recolhíveis.

### Início

Saudação curta com o número do dia, gráfico compacto de 30 dias, próximos 5 compromissos em lista,
atalhos (Perguntar, Simular compra) como botões secundários.

### Login e cadastro

Duas colunas: à esquerda (só desktop) a linha do saldo se desenhando sobre `bg` com uma frase
("Veja quanto dá para gastar até o próximo salário."); à direita o formulário em `surface1`.
Sem ilustração de personagem.

### Listas (Extrato, Radar, Compromissos, Envelopes, Análise)

Linhas de 56 px com divisória `line`: descrição e metadado à esquerda, valor tabular alinhado à
direita, selo de certeza quando houver. Filtros como pílulas no topo. Estado vazio: uma frase do
que fazer e um botão.

## Componentes

- Botão principal: pílula branca, texto `bg`, 40 px. Secundário: pílula com borda `line` e texto
  `text`. Terciário: texto `text2` sublinhado no hover.
- Selo de certeza: pílula 22 px, fundo da cor a 14%, texto na cor; estimado em itálico.
- Campos: `surface2`, borda `line`, foco com anel `future` de 2 px.
- Alertas: barra lateral de 2 px na cor do estado, fundo `surface1`, sem ícone grande.
- Tabelas do MUI substituídas por listas onde a tela é de leitura.

## Não fazer

Cartão em volta de tudo; mesma sombra em todo bloco; gradiente de fundo; ilustração 3D;
caixa-alta em rótulo; ícone colorido decorativo; texto explicativo longo na tela; mais de uma
animação por tela; cor de destaque em palavra de título.
