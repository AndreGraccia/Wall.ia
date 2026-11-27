export function pxToRem(value) {
  return `${value / 16}rem`;
}

// One family, Geist (self-hosted via @fontsource, so the nginx CSP can stay 'self'). Every number uses its
// tabular figures (set on body in globalStyles); the italic marks an estimate. Scale: docs/brand/DESIGN.md.
const SYSTEM = ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'];
export const FONT_PRIMARY = ['"Geist Variable"', 'Geist', ...SYSTEM].join(',');

const MOBILE = '@media (max-width:599.95px)';

const typography = {
  fontFamily: FONT_PRIMARY,
  fontWeightRegular: 400,
  fontWeightMedium: 500,
  fontWeightBold: 600,

  // Hero number: one per screen.
  h1: {
    fontWeight: 600,
    fontSize: pxToRem(56),
    lineHeight: 1.05,
    letterSpacing: '-0.035em',
    [MOBILE]: { fontSize: pxToRem(40) },
  },
  h2: { fontWeight: 600, fontSize: pxToRem(36), lineHeight: 1.1, letterSpacing: '-0.03em' },
  // Page title.
  h3: { fontWeight: 600, fontSize: pxToRem(28), lineHeight: 1.2, letterSpacing: '-0.02em' },
  h4: { fontWeight: 600, fontSize: pxToRem(22), lineHeight: 1.25, letterSpacing: '-0.015em' },
  h5: { fontWeight: 600, fontSize: pxToRem(20), lineHeight: 1.3, letterSpacing: '-0.01em' },
  // Section title.
  h6: { fontWeight: 600, fontSize: pxToRem(18), lineHeight: 1.3, letterSpacing: '-0.01em' },
  subtitle1: { fontWeight: 500, fontSize: pxToRem(15), lineHeight: 1.45 },
  subtitle2: { fontWeight: 500, fontSize: pxToRem(14), lineHeight: 1.45 },
  // Body.
  body1: { fontWeight: 400, fontSize: pxToRem(15), lineHeight: 1.55 },
  // Support.
  body2: { fontWeight: 400, fontSize: pxToRem(13), lineHeight: 1.45 },
  caption: { fontWeight: 400, fontSize: pxToRem(12), lineHeight: 1.4 },
  // Label: sentence case, never tracked caps.
  overline: { fontWeight: 500, fontSize: pxToRem(12), lineHeight: 1.3, letterSpacing: 0, textTransform: 'none' },
  button: { fontWeight: 500, fontSize: pxToRem(14), lineHeight: 1.2, letterSpacing: 0, textTransform: 'none' },
};

export default typography;
