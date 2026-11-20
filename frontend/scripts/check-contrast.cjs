// Checks every text/background pair the UI uses against WCAG 2.2 (1.4.3 text, 1.4.11 non-text).
// Reads the hex values straight from src/theme/palette.js (`primitives`), so changing a colour there re-runs the gate.
// Usage: npm run test:contrast   (exits 1 if any pair fails)
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'theme', 'palette.js'), 'utf8');
const match = source.match(/primitives\s*=\s*\{([\s\S]*?)\n\};/);
if (!match) throw new Error('palette.js: block "primitives" not found');
const c = Object.fromEntries([...match[1].matchAll(/(\w+):\s*'(#[0-9A-Fa-f]{6})'/g)].map((m) => [m[1], m[2]]));

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
// Colour with alpha laid over an opaque background (how MUI's `alpha()` tints render).
const over = (fg, a, bg) =>
  `#${rgb(fg)
    .map((v, i) =>
      Math.round(v * a + rgb(bg)[i] * (1 - a))
        .toString(16)
        .padStart(2, '0')
    )
    .join('')}`;
const lum = (hex) => {
  const [r, g, b] = rgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

const TEXT = 4.5;
const NON_TEXT = 3; // UI components, graphics and text >= 24px
const TONES = ['future', 'positive', 'negative', 'warning'];
const pairs = [];
const add = (fg, bg, min, use) => pairs.push({ fg, bg, min, use });

// Text sits on the page, panels, fields and floating layers (menus, tooltips, dialogs).
for (const s of ['bg', 'surface1', 'surface2', 'surface3']) {
  add('text', s, TEXT, 'texto principal');
  add('text2', s, TEXT, 'texto de apoio / placeholder');
  for (const tone of TONES) add(tone, s, TEXT, `texto/número ${tone}`);
}
// Labels and metadata only on the page and on panels (DESIGN.md: muted >= 4,5:1 on bg and surface1).
for (const s of ['bg', 'surface1']) add('muted', s, TEXT, 'rótulo / metadado');
// Dark text on filled pills: the white action and the filled tones.
for (const tone of ['action', ...TONES]) add('bg', tone, TEXT, `texto sobre ${tone}`);
// Tinted seals and translucent marks: tone text over a 14% tint of itself on surface1.
for (const tone of TONES) {
  add(tone, { hex: over(c[tone], 0.14, c.surface1), name: `${tone}@14% sobre surface1` }, TEXT, 'selo tonal');
}
for (const s of ['bg', 'surface1', 'surface2']) {
  add('lineStrong', s, NON_TEXT, 'borda de campo (1.4.11)');
  add('future', s, NON_TEXT, 'anel de foco');
}
// Chart marks on the page (the Future chart has no card) and on a panel (simulator).
for (const s of ['bg', 'surface1']) {
  add('text', s, NON_TEXT, 'linha do gráfico até hoje');
  add('future', s, NON_TEXT, 'linha projetada');
  add('lineStrong', s, NON_TEXT, 'linha do zero');
}

let failed = 0;
const rows = pairs.map(({ fg, bg, min, use }) => {
  const fgHex = c[fg];
  const bgHex = typeof bg === 'string' ? c[bg] : bg.hex;
  const bgName = typeof bg === 'string' ? bg : bg.name;
  if (!fgHex || !bgHex) throw new Error(`unknown token in pair ${fg} / ${bgName}`);
  const r = ratio(fgHex, bgHex);
  const ok = r >= min;
  if (!ok) failed += 1;
  return `${ok ? 'ok  ' : 'FAIL'} ${r
    .toFixed(2)
    .padStart(5)}:1 (min ${min})  ${fg} ${fgHex} / ${bgName} ${bgHex}  ${use}`;
});
console.log(rows.join('\n'));
console.log(`\n${pairs.length - failed}/${pairs.length} pares passam.`);
if (failed) process.exit(1);
