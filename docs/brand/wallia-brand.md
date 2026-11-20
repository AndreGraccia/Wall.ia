# Wall.ia: identidade "Grafite"

A fonte de verdade da identidade é o [DESIGN.md](DESIGN.md): cor, tipografia, espaço, layout,
componentes e o que não fazer. Este arquivo só diz onde cada decisão mora no código e como
regerar os arquivos de marca. Se os dois discordarem, vale o DESIGN.md.

A "Farol" (19/11/2026) foi aposentada em 20/11/2026; as peças de LinkedIn dela foram removidas e
serão refeitas na Grafite.

## Onde mora cada decisão

| Decisão | Arquivo |
| --- | --- |
| Cores (primitivos e papéis semânticos) | `frontend/src/theme/palette.js` |
| Tipografia (Geist, escala, sem caixa-alta) | `frontend/src/theme/typography.js` |
| Botões, campos, selos, alertas, tabelas, diálogos | `frontend/src/theme/overrides/` |
| Animação de desenho da linha (600 ms) | `frontend/src/theme/globalStyles.js` (`wallia-reveal`) |
| Logotipo "Wall.ia" com o ponto `future` | `frontend/src/components/brand/index.js` |
| Gráfico do saldo | `frontend/src/components/projection-chart/index.js` |
| Favicon (o ponto sobre a linha) | `frontend/public/favicon.svg` |
| Imagem de compartilhamento | `docs/brand/og.html` + `docs/brand/brand.css` |

## Contraste

`npm run test:contrast` (em `frontend/`) lê os primitivos do `palette.js` e confere todo par
texto/fundo (≥ 4,5:1) e todo componente e marca de gráfico (≥ 3:1). Mudou uma cor, rode de novo.

Uma diferença deliberada em relação ao DESIGN.md: a borda de campo usa `lineStrong` (`#616B7F`),
não `line`, porque `line` sobre `surface2` fica em 1,2:1 e um campo precisa de 3:1 para ser
reconhecido como campo (WCAG 1.4.11).

## Regerar ícones e OG

```
cd frontend && npm ci          # traz a Geist usada pelo og.html
cd .. && python frontend/scripts/build-icons.py
```

Gera `favicon/*.png`, `favicon.ico`, `apple-touch-icon`, `mstile`, `logo.png` e `og.png` a partir
do `favicon.svg` e do `og.html` (Chrome ou Edge headless + Pillow).
