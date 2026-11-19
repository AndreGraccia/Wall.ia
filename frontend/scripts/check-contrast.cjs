// Checks every text/background pair the UI uses against WCAG 2.2 (1.4.3 text, 1.4.11 non-text).
// Reads the hex values straight from src/theme/palette.js, so changing a colour there re-runs the gate.
// Usage: npm run test:contrast   (exits 1 if any pair fails)
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'theme', 'palette.js'), 'utf8');

function block(name) {
  const match = source.match(new RegExp(`${name}\\s*[:=]\\s*\\{([\\s\\S]*?)\\n\\s*\\}`));
  if (!match) throw new Error(`palette.js: block "${name}" not found`);
  return Object.fromEntries([...match[1].matchAll(/(\w+):\s*'(#[0-9A-Fa-f]{6})'/g)].map((m) => [m[1], m[2]]));
}

const c = { ...block('primitives'), ...prefix(block('chart'), 'chart.') };
function prefix(obj, p) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [p + k, v]));
}

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
// Colour with alpha laid over an opaque background (how MUI's `alpha()` tints render).
const over = (fg, a, bg) => {
  const [f, b] = [rgb(fg), rgb(bg)];
  return `#${f
    .map((v, i) =>
      Math.round(v * a + b[i] * (1 - a))
        .toString(16)
        .padStart(2, '0')
    )
    .join('')}`;
};
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
const LARGE = 3; // text >= 24px or >= 18.66px bold, and UI components / graphics
const surfaces = ['ink', 'surface1', 'surface2', 'surface3'];
const pairs = [];
const add = (fg, bg, min, use) => pairs.push({ fg, bg, min, use });

for (const s of surfaces) {
  add('text', s, TEXT, 'texto principal');
  add('text2', s, TEXT, 'texto secundário');
  add('muted', s, TEXT, 'placeholder / desabilitado');
  for (const tone of ['lamp', 'fog', 'kelp', 'buoy', 'ember']) add(tone, s, TEXT, `texto/ícone ${tone}`);
  add('lineStrong', s, LARGE, 'borda de campo (1.4.11)');
}
// Text on filled tones (contained buttons, filled chips, snackbars): contrastText = void.
for (const tone of ['lamp', 'lampDeep', 'fog', 'kelp', 'buoy', 'ember']) add('void', tone, TEXT, `texto sobre ${tone}`);
// Tinted chips and alerts: tone text over a 14% tint of itself on the paper surface.
for (const tone of ['lamp', 'fog', 'kelp', 'buoy', 'ember']) {
  add(tone, { hex: over(c[tone], 0.14, c.surface1), name: `${tone}@14% sobre surface1` }, TEXT, 'chip/alerta tonal');
}
// Focus ring (lamp) must be seen against every surface.
for (const s of surfaces) add('lamp', s, LARGE, 'anel de foco');
// Chart lines on the chart surface.
for (const mark of ['chart.projection', 'chart.scenario']) add(mark, 'surface1', LARGE, 'linha do gráfico');

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
