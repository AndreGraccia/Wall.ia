# Wall.ia: identidade "Farol"

Versão 1, novembro de 2026. Substitui a identidade ink/volt/horizon (preto com verde-limão).
Fonte da verdade dos valores: `frontend/src/theme/palette.js` e `typography.js`. Este documento explica
por que cada valor existe; se os dois discordarem, o código vale e este arquivo está desatualizado.

## Conceito

A Wall.ia não move dinheiro. Ela mostra, com antecedência, onde o saldo vai passar abaixo de zero,
e deixa a decisão com a pessoa. É o trabalho de um farol: não conduz o barco, ilumina a pedra antes.

Três imagens sustentam a marca, e todas vêm do produto:

1. **A linha d'água.** O saldo zero é uma linha horizontal. Acima dela, tudo bem; abaixo, cheque
   especial. Em toda peça da marca a linha d'água aparece como uma régua fina e calma.
2. **O buraco.** Quem termina o mês no positivo ainda pode ficar sem dinheiro entre o vencimento da
   fatura e o salário. Esse vale abaixo da linha d'água é o desenho central da marca, porque é o
   problema que o produto resolve.
3. **Sólido e tracejado.** O passado e o confirmado são linha sólida. O futuro estimado é tracejado.
   O simulado é pontilhado. A luz do farol (o ponto amarelo) marca **hoje**, a fronteira entre os dois.

O fundo é o mar à noite: escuro, mas com cor (azul-esverdeado), nunca um preto neutro. A cor de ação é a
luz do farol, quente e única.

## Símbolo e logotipo

Arquivos: `frontend/public/favicon.svg` (fonte), `frontend/src/components/brand/index.js`
(`WalliaMark`, `WalliaLogo`, constante `MARK` com a geometria), PNG/ICO gerados por
`frontend/scripts/build-icons.py`.

O símbolo é um **W desenhado como a linha do saldo**, em um quadrado de 32 com raio 9:

- primeira metade do W, sólida, em espuma (`text`): o passado confirmado;
- ponto de luz no pico central, em lâmpada (`action`): hoje;
- segunda metade, tracejada, em neblina (`estimated`): a projeção. O vale dela passa abaixo da linha
  d'água (`waterline`), que é o buraco entre fatura e salário, e volta a subir;
- o tracejado usa `pathLength=100` com traço de 12, intervalo de 9 e deslocamento de 17,2, para que o
  vértice de baixo caia no meio de um traço. Sem isso o W se desfaz em pedaços em 32 px.

O logotipo é o símbolo mais "Wall.ia" em Bricolage Grotesque 700, com o ponto em `action`. O ponto do
nome e o ponto do símbolo são a mesma luz.

| Uso | Regra |
| --- | --- |
| Área de respiro | metade da altura do símbolo em volta |
| Tamanho mínimo | 16 px (favicon); abaixo de 24 px usar só o símbolo |
| Fundo | sempre um tom do mar (`bg`, `surface`). Sobre fundo claro, usar a placa escura do próprio símbolo |
| Não fazer | girar, trocar as cores do sólido e do tracejado, deixar todo o W sólido, pôr sombra ou brilho |

## Paleta

Três camadas: primitivos (`primitives` em `palette.js`), semânticos (o tema do MUI) e marca (`brand.*`,
só para logo e ilustração). Componente nunca usa primitivo direto.

### Tokens semânticos

| Token | Tema MUI | Primitivo | Hex | Significado |
| --- | --- | --- | --- | --- |
| `bg` | `background.default` | ink | `#0A1519` | o mar à noite, fundo da página |
| `surface` | `background.paper` | surface1 | `#0F1E23` | cartões, painéis |
| `surface-2` | `background.neutral` | surface2 | `#15282E` | campos, áreas internas |
| `surface-3` | `background.raised` | surface3 | `#1C333A` | diálogo, menu, o que flutua |
| `line` | `divider` | line | `#24414A` | divisória decorativa |
| `waterline` | `brand.waterline` | lineStrong | `#5F8792` | saldo zero no gráfico, borda de campo |
| `text` | `text.primary` | text | `#EAF2F0` | espuma: texto principal, valor confirmado |
| `text-2` | `text.secondary` | text2 | `#A6BCBD` | texto de apoio |
| `muted` | `text.disabled` | muted | `#8AA4A8` | placeholder, desabilitado |
| `action` | `primary.main` | lamp | `#FFD25E` | a luz do farol: só o que se aperta, e o foco |
| `estimated` | `secondary.main`, `certainty.estimated` | fog | `#A3B5FF` | neblina: o que o motor espera e ainda não aconteceu |
| `hypothetical` | `certainty.hypothetical` | lamp | `#FFD25E` | cenário que você acendeu no simulador |
| `positive` | `success.main` | kelp | `#5ED6A2` | acima da linha d'água |
| `negative` | `error.main` | buoy | `#FF8590` | abaixo da linha d'água |
| `warning` | `warning.main` | ember | `#FFA463` | atenção sem urgência |
| gráfico | `chart.projection` / `chart.scenario` | | `#7D93F0` / `#D9A92E` | linhas de projeção e de cenário |

Simulado usa a cor de ação de propósito: é o único dado que existe porque **você** acendeu. Para não
confundir com botão, o simulado nunca aparece sem o rótulo "Simulado", o pontilhado e o itálico.

### Contraste medido

`npm run test:contrast` lê os hex de `palette.js` e confere 53 pares (WCAG 2.2: 4,5:1 para texto,
3:1 para borda, foco e linha de gráfico). Falha com código 1 se algum par cair. Resultado atual: 53/53.

| Par | Pior caso | Mínimo |
| --- | --- | --- |
| `text` sobre bg / surface / surface-2 / surface-3 | 11,65:1 (surface-3) | 4,5 |
| `text-2` sobre as quatro superfícies | 6,66:1 (surface-3) | 4,5 |
| `muted` sobre as quatro superfícies | 5,02:1 (surface-3) | 4,5 |
| `action` como texto ou foco | 9,24:1 (surface-3) | 4,5 |
| `estimated` como texto | 6,70:1 (surface-3) | 4,5 |
| `positive` como texto | 7,33:1 (surface-3) | 4,5 |
| `negative` como texto | 5,69:1 (surface-3) | 4,5 |
| `warning` como texto | 6,78:1 (surface-3) | 4,5 |
| texto `#060D10` sobre botão `action` | 13,64:1 | 4,5 |
| texto `#060D10` sobre `negative` (pior tom cheio) | 8,40:1 | 4,5 |
| tom sobre o próprio tom a 14% (chip, alerta) | 5,86:1 (negative) | 4,5 |
| `waterline` (borda de campo) | 3,39:1 (surface-3) | 3 |
| linha de projeção do gráfico | 5,94:1 | 3 |

## Tipografia

Tudo via `@fontsource-variable` (auto-hospedado, a CSP do nginx continua `'self'`).

| Família | Papel | Por quê |
| --- | --- | --- |
| **Bricolage Grotesque** (eixo de tamanho óptico) | títulos, números grandes, botões, logotipo | Fica mais apertada e com mais personalidade quanto maior o corpo. Dá voz à marca sem precisar de cor. Substitui a Space Grotesk. |
| **Inter** (com itálico) | leitura, valores, tabelas | Algarismos tabulares (`tabular-nums` no `body`): as colunas de dinheiro alinham. O itálico tem função, veja abaixo. |
| **JetBrains Mono** | só códigos (chave Pix, id de consentimento) | Nunca para rótulo ou número de interface. |

**Regra do itálico:** o que ainda não foi confirmado fica em itálico. Estimado e Simulado se inclinam
porque ainda podem mudar. É a terceira marca de certeza, junto com a cor e o estilo da linha, e é a
única que sobrevive a impressão em preto e branco e a daltonismo. Implementado em `CertaintyChip`.

Escala (de `typography.js`): h1 40→64, h2 34→48, h3 28→34, h4 23→28, h5 20, h6 18, corpo 16/14,
legenda 12. Títulos h1–h4 em peso 600 com espaçamento entre -0,03em e -0,015em. O `overline` deixou de
ser caixa-alta espaçada: rótulo é frase normal, peso 600, 12 px.

## Espaço, raio, sombra

- **Espaço:** base 8 (`theme.spacing(1) = 8px`), escala 4 8 12 16 20 24 32 40 48 64 80 96. Dentro de
  um grupo, menos espaço do que entre grupos.
- **Raio:** 4 (foco de link) · 12 (botão, campo, blocos internos; `shape.borderRadius`, que é o
  `borderRadius: 1` do `sx`) · 20 (cartão, diálogo) · 9/32 do lado no símbolo. Raio cresce com o tamanho
  da superfície; não existe um raio único para tudo.
- **Sombra:** no escuro, profundidade vem da claridade da superfície (bg → surface → surface-2 →
  surface-3) e da borda `line`. Sombra (`customShadows`) só separa camadas que flutuam: menu, diálogo.
  Cartão não tem sombra.

## Movimento

- Durações de `theme.transitions` (padrão do MUI): 150 ms para resposta a toque (hover, pressionado),
  225–300 ms para abrir e fechar, desaceleração na entrada. Nenhum valor de duração escrito no componente.
- O único movimento de marca permitido é a linha do saldo se desenhando da esquerda para a direita, uma
  vez, ao carregar a projeção: mostra o tempo passando. Ainda não implementado. Nada pisca, nada pulsa,
  nada brilha.
- `prefers-reduced-motion: reduce` zera animações e transições (`globalStyles.js`).

## Voz e tom

Calma, exata, do lado da pessoa. Fala como quem cuida do farol: avisa cedo, explica o porquê, não
assusta e não vende.

| Princípio | Sim | Não |
| --- | --- | --- |
| Data e valor antes de adjetivo | "Entre 03/10 e 04/10 seu saldo pode ficar em -R$ 324,87." | "Atenção! Você vai ficar no vermelho!" |
| Diz de onde veio | "Calculado a partir de um padrão que você confirmou." | "Nossa IA prevê que…" |
| Pergunta antes de supor | "Isso é seu salário?" | "Detectamos seu salário." |
| Admite o limite | "Ainda não sei responder isso." | "Ops! Algo deu errado." |
| Nunca vende crédito | "Combine outra data para esta conta." | "Pegue um empréstimo e fique tranquilo." |
| Verbo que diz o que acontece | "Preparar Pix" (e o aviso: nada é enviado) | "Continuar" |

Microcopy de referência, já no produto (`i18n.js`): "Veja o futuro antes de mexer no dinheiro.",
"Seu saldo pode ficar negativo", "Existe só neste cenário. Nada foi movimentado.",
"Ambiente de demonstração com saldos simulados. Nenhum valor real é movimentado."

## Fazer e não fazer

| Fazer | Não fazer |
| --- | --- |
| Mostrar o buraco abaixo da linha d'água quando ele existe | Pintar o fundo inteiro de vermelho por causa de um dia negativo |
| Separar confirmado (sólido), estimado (tracejado, itálico) e simulado (pontilhado, itálico) | Comunicar certeza só com cor |
| Usar `action` só no que se aperta e no foco | Usar a cor de ação em ícone decorativo, título ou fundo |
| Citar a fonte de todo número em peça de comunicação | Inventar estatística ou depoimento |
| Fundo do mar com cor | Preto puro, gradiente roxo-azul, vidro fosco, brilho neon |

## Aplicações

| Peça | Arquivo | Notas |
| --- | --- | --- |
| App | `frontend/src/theme/*`, `components/brand` | Só tema escuro (o produto não tem tema claro). Tela de login redesenhada com a linha d'água e o buraco. |
| Ícone | `public/favicon.svg`, `public/favicon/*`, `public/logo.png` | PNG/ICO gerados do SVG; iOS e Windows com placa `bg` e 12–20% de margem. |
| Imagem OG | `docs/brand/og.html` → `public/og.png` (1200×630) | Título do produto, linha do saldo com "hoje", "fatura" e "salário". `og:image` precisa de URL absoluta em produção: gerar o build com `PUBLIC_URL`. |
| LinkedIn, post 1 | `docs/brand/comunicacao/banner-1-o-buraco.html` (1200×1200) | "Fechar o mês no positivo não é passar o mês no positivo." O exemplo de -R$ 324,87 é o do README, rotulado como exemplo do sandbox. |
| LinkedIn, post 2 | `docs/brand/comunicacao/banner-2-certeza.html` (1200×1200) | O lema e a legenda de certeza, com o texto do próprio app. |
| LinkedIn, capa | `docs/brand/comunicacao/capa-linkedin.html` (1584×396) | Texto e buraco à direita de x=600: a foto de perfil cobre o canto inferior esquerdo. |

Para gerar os PNG: `cd frontend && npm ci`, depois, da raiz, `python frontend/scripts/build-icons.py`
(precisa de Pillow e de Chrome ou Edge; aceita `CHROME=/caminho`). As peças HTML usam `docs/brand/brand.css`,
que carrega as fontes de `frontend/node_modules`.
