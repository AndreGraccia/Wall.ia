import { alpha } from '@mui/material/styles';

// Wall.ia "Farol" — primitives. Components never use these directly; they use the semantic palette below
// (or `brand.*` for the few brand-only moments). Every text/background pair is checked by
// `npm run test:contrast` (scripts/check-contrast.cjs); the rationale is in docs/brand/wallia-brand.md.
export const primitives = {
  // The sea at night: every surface carries the same blue-green, never a neutral black.
  void: '#060D10',
  ink: '#0A1519',
  surface1: '#0F1E23',
  surface2: '#15282E',
  surface3: '#1C333A',
  line: '#24414A',
  // 3:1 against surface1-3 (WCAG 1.4.11): field borders must be seen to be used.
  lineStrong: '#5F8792',
  // Foam: text sits on the water like foam, slightly cool.
  text: '#EAF2F0',
  text2: '#A6BCBD',
  muted: '#8AA4A8',
  // Lamp: the lighthouse light. The only colour that means "you can press this".
  lamp: '#FFD25E',
  lampDeep: '#F2BC35',
  // Fog: what the engine expects but has not happened yet.
  fog: '#A3B5FF',
  // Kelp and buoy: above and below the waterline.
  kelp: '#5ED6A2',
  buoy: '#FF8590',
  ember: '#FFA463',
};

const GREY = {
  0: '#FFFFFF',
  100: primitives.text,
  200: '#C8D8D7',
  300: primitives.text2,
  400: primitives.muted,
  500: '#4E6B73',
  600: primitives.lineStrong,
  700: primitives.surface3,
  800: primitives.surface2,
  900: primitives.surface1,
};

const tone = (main, light, dark, darker) => ({
  lighter: alpha(main, 0.14),
  light,
  main,
  dark,
  darker,
  contrastText: primitives.void,
});

const palette = {
  mode: 'dark',
  common: { black: primitives.void, white: '#FFFFFF' },

  // Action: the lamp. The only colour that means "you can press this".
  primary: tone(primitives.lamp, '#FFE08F', primitives.lampDeep, '#8A6400'),
  // Projection / estimate: fog, anything the engine expects but has not happened yet.
  secondary: tone(primitives.fog, '#C7D2FF', '#7D93F0', '#33408A'),
  info: tone(primitives.fog, '#C7D2FF', '#7D93F0', '#33408A'),
  // Above the waterline.
  success: tone(primitives.kelp, '#93E6C2', '#34B07D', '#0F6B45'),
  warning: tone(primitives.ember, '#FFC79E', '#E5813A', '#7A3A0A'),
  // Below the waterline.
  error: tone(primitives.buoy, '#FFB3B9', '#E85A68', '#7A1F28'),
  grey: GREY,

  // Brand-only tokens (logo, illustration, certainty markers). Never used as a button colour.
  brand: {
    lamp: primitives.lamp,
    fog: primitives.fog,
    ink: primitives.ink,
    waterline: primitives.lineStrong,
    surface3: primitives.surface3,
    lineStrong: primitives.lineStrong,
  },
  // Chart marks: darker steps of fog/lamp that keep >= 3:1 on surface1 without glowing
  // (checked by `npm run test:contrast`).
  chart: {
    projection: '#7D93F0',
    scenario: '#D9A92E',
    negative: alpha(primitives.buoy, 0.12),
    grid: primitives.line,
  },
  // Wallet card finishes (the physical-card metaphor). White text passes AA on every finish.
  cardFinishes: [
    'linear-gradient(160deg, #1C333A 0%, #0A1519 100%)',
    `radial-gradient(120% 90% at 100% 0%, ${alpha(
      primitives.lamp,
      0.24
    )} 0%, transparent 55%), linear-gradient(160deg, #1F2A22 0%, #0A1519 100%)`,
    `radial-gradient(120% 90% at 100% 0%, ${alpha(
      primitives.fog,
      0.26
    )} 0%, transparent 55%), linear-gradient(160deg, #18213A 0%, #0A1519 100%)`,
    'linear-gradient(160deg, #123A33 0%, #07120F 100%)',
    'linear-gradient(160deg, #3A2418 0%, #120B07 100%)',
  ],
  // How sure a number is. Each state also has a text label, a line style and (for estimates) italics,
  // never colour alone.
  certainty: {
    confirmed: primitives.text,
    estimated: primitives.fog,
    hypothetical: primitives.lamp,
  },

  divider: primitives.line,

  text: {
    primary: primitives.text,
    secondary: primitives.text2,
    disabled: primitives.muted,
  },

  // Elevation by lightness: the higher the surface, the closer to the surface of the water.
  background: {
    default: primitives.ink,
    paper: primitives.surface1,
    neutral: primitives.surface2,
    raised: primitives.surface3,
  },

  action: {
    active: primitives.text2,
    hover: alpha(primitives.text, 0.06),
    selected: alpha(primitives.lamp, 0.12),
    disabled: alpha(primitives.text2, 0.4),
    disabledBackground: alpha(primitives.text2, 0.12),
    focus: alpha(primitives.lamp, 0.24),
    hoverOpacity: 0.06,
    disabledOpacity: 0.48,
  },
};

export default palette;
