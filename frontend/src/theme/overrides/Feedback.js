import { alpha } from '@mui/material/styles';
import { COARSE, TOUCH_TARGET } from '../touch';

const TONES = ['success', 'info', 'warning', 'error'];
const cap = (word) => word[0].toUpperCase() + word.slice(1);

// Alerts: a 2 px bar in the state colour on surface1, no big icon. Seals (chips): pills tinted at 14%.
// Also the remaining layout primitives (tabs, skeleton, container measure).
export default function Feedback(theme) {
  const { palette } = theme;
  const toneChips = Object.fromEntries(
    ['secondary', ...TONES].map((tone) => [
      `filled${cap(tone)}`,
      { color: palette[tone].main, backgroundColor: alpha(palette[tone].main, 0.14) },
    ])
  );
  return {
    MuiAlert: {
      defaultProps: { icon: false },
      styleOverrides: {
        root: {
          ...theme.typography.body2,
          fontSize: theme.typography.pxToRem(14),
          borderRadius: 12,
          padding: '8px 16px',
          color: palette.text.primary,
          backgroundColor: palette.background.paper,
          border: `1px solid ${palette.divider}`,
          borderLeftWidth: 2,
          alignItems: 'center',
        },
        ...Object.fromEntries(
          TONES.flatMap((tone) => [
            [`standard${cap(tone)}`, { borderLeftColor: palette[tone].main }],
            [`outlined${cap(tone)}`, { borderLeftColor: palette[tone].main }],
          ])
        ),
        icon: { padding: '6px 0', marginRight: 10, fontSize: 18, opacity: 1 },
        message: { padding: '6px 0' },
        action: { paddingTop: 0, marginRight: -8 },
      },
    },
    MuiAlertTitle: {
      styleOverrides: { root: { ...theme.typography.subtitle1, fontWeight: 600, margin: 0, marginBottom: 2 } },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          ...theme.typography.caption,
          fontWeight: 500,
          borderRadius: 999,
          height: 26,
          color: palette.text.secondary,
          backgroundColor: palette.background.neutral,
        },
        sizeSmall: { height: 22 },
        // A chip you can press (a suggestion, a filter) is a control: touch target on a finger. Seals stay small.
        clickable: { [COARSE]: { minHeight: TOUCH_TARGET } },
        label: { paddingLeft: 10, paddingRight: 10 },
        outlined: { borderColor: palette.divider, backgroundColor: 'transparent' },
        filledPrimary: { color: palette.text.primary, backgroundColor: palette.background.neutral },
        ...toneChips,
      },
    },
    MuiSkeleton: {
      defaultProps: { animation: 'wave' },
      styleOverrides: { root: { backgroundColor: palette.background.neutral, borderRadius: 8 } },
    },
    MuiTabs: {
      styleOverrides: {
        root: { minHeight: 44, borderBottom: `1px solid ${palette.divider}` },
        indicator: { height: 2, borderRadius: 2, backgroundColor: palette.text.primary },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          ...theme.typography.button,
          minHeight: 44,
          minWidth: 0,
          padding: '8px 4px',
          marginRight: 20,
          color: palette.text.secondary,
          '&.Mui-selected': { color: palette.text.primary },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: { root: { borderRadius: 999, backgroundColor: palette.background.neutral } },
    },
    MuiContainer: {
      // Content keeps a 1120 px measure (DESIGN.md) with a 16 px gutter on phones.
      styleOverrides: {
        root: {
          paddingLeft: 16,
          paddingRight: 16,
          [theme.breakpoints.up('sm')]: { paddingLeft: 32, paddingRight: 32 },
        },
        maxWidthLg: { [theme.breakpoints.up('lg')]: { maxWidth: 1120 + 64 } },
      },
    },
  };
}
