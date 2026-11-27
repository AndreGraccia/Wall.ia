import { alpha } from '@mui/material/styles';

// Wall.ia "Grafite" (docs/brand/DESIGN.md) — primitives. Components never use these directly; they use the
// semantic palette below. Every text/background pair is checked by `npm run test:contrast`
// (scripts/check-contrast.cjs).
export const primitives = {
  // Depth by layer, not by shadow: bg -> surface1 -> surface2 -> surface3 (floating: menus, tooltips).
  bg: '#08090C',
  surface1: '#0F1116',
  surface2: '#161920',
  surface3: '#1D2129',
  line: '#222631',
  // Field and control boundaries: >= 3:1 against bg and surfaces 1-2 (WCAG 1.4.11).
  lineStrong: '#616B7F',
  text: '#F3F5F9',
  text2: '#A4ABBA',
  muted: '#7A8294',
  // The action is white. Colour only says what a number is.
  action: '#F3F5F9',
  future: '#8FA3FF',
  positive: '#4FD1A1',
  negative: '#FF7B7B',
  warning: '#F2B85B',
};

const GREY = {
  0: '#FFFFFF',
  100: primitives.text,
  200: '#D3D7DF',
  300: primitives.text2,
  400: primitives.muted,
  500: '#4A5160',
  600: primitives.lineStrong,
  700: primitives.surface3,
  800: primitives.surface2,
  900: primitives.surface1,
};

const tone = (main, light, dark) => ({
  lighter: alpha(main, 0.14),
  light,
  main,
  dark,
  darker: dark,
  contrastText: primitives.bg,
});

const palette = {
  mode: 'dark',
  common: { black: primitives.bg, white: '#FFFFFF' },

  // Action: white pill, dark text.
  primary: tone(primitives.action, '#FFFFFF', '#D3D7DF'),
  // Projection / estimate: anything the engine expects but has not happened yet.
  secondary: tone(primitives.future, '#B7C4FF', '#7186E6'),
  info: tone(primitives.future, '#B7C4FF', '#7186E6'),
  success: tone(primitives.positive, '#8AE3C2', '#34B386'),
  warning: tone(primitives.warning, '#F7D08F', '#D99B3B'),
  error: tone(primitives.negative, '#FFA8A8', '#E65C5C'),
  grey: GREY,

  // Brand-only tokens (logo, chart marks).
  brand: {
    future: primitives.future,
    line: primitives.line,
    lineStrong: primitives.lineStrong,
    surface3: primitives.surface3,
  },
  chart: {
    history: primitives.text,
    projection: primitives.future,
    scenario: primitives.text,
    negative: alpha(primitives.negative, 0.16),
    grid: primitives.line,
    zero: primitives.lineStrong,
  },
  // Wallet card finishes: flat tints of the surfaces, never a gradient. White text passes AA on all of them.
  cardFinishes: ['#161920', '#141A2C', '#11201B', '#221B12', '#1F1524'],
  // How sure a number is. Each state also has a text label, a line style and (for estimates) italics,
  // never colour alone.
  certainty: {
    confirmed: primitives.text,
    estimated: primitives.future,
    hypothetical: primitives.text2,
  },

  divider: primitives.line,

  text: {
    primary: primitives.text,
    secondary: primitives.text2,
    disabled: primitives.muted,
  },

  background: {
    default: primitives.bg,
    paper: primitives.surface1,
    neutral: primitives.surface2,
    raised: primitives.surface3,
  },

  action: {
    active: primitives.text2,
    hover: alpha(primitives.text, 0.05),
    selected: primitives.surface2,
    disabled: alpha(primitives.text2, 0.45),
    disabledBackground: alpha(primitives.text2, 0.12),
    focus: alpha(primitives.future, 0.24),
    hoverOpacity: 0.05,
    disabledOpacity: 0.48,
  },
};

export default palette;
