// Buttons are pills (DESIGN.md). Primary: white with dark text. Secondary (outlined): a line border.
// Tertiary (text): quiet text, underlined on hover. One visible focus ring for everything clickable.
export default function Button(theme) {
  const { palette } = theme;
  const focus = { outline: `2px solid ${palette.secondary.main}`, outlineOffset: 2 };
  const quick = theme.transitions.create(['background-color', 'border-color', 'color'], { duration: 150 });
  return {
    MuiButtonBase: {
      defaultProps: { disableRipple: true },
      styleOverrides: { root: { '&.Mui-focusVisible': focus } },
    },
    MuiLink: {
      defaultProps: { color: 'inherit', underline: 'always' },
      styleOverrides: {
        root: {
          textDecorationColor: palette.grey[500],
          textUnderlineOffset: 3,
          '&:hover': { textDecorationColor: 'currentColor' },
          '&:focus-visible': { ...focus, borderRadius: 4 },
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        root: { '& .MuiSwitch-switchBase.Mui-focusVisible + .MuiSwitch-track': focus },
        track: { backgroundColor: palette.grey[500], opacity: 1 },
        switchBase: {
          '&.Mui-checked + .MuiSwitch-track': { opacity: 1, backgroundColor: palette.secondary.main },
          '&.Mui-checked .MuiSwitch-thumb': { backgroundColor: palette.common.white },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          minWidth: 40,
          minHeight: 40,
          color: palette.text.secondary,
          transition: quick,
          '&:hover': { backgroundColor: palette.background.neutral, color: palette.text.primary },
        },
      },
    },
    // Segmented pills (30d / 60d / 90d).
    MuiToggleButtonGroup: {
      styleOverrides: {
        root: { gap: 4, padding: 4, borderRadius: 999, backgroundColor: palette.background.paper },
        grouped: { border: 0, borderRadius: '999px !important', margin: 0 },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          minHeight: 32,
          minWidth: 44,
          padding: '4px 12px',
          border: 0,
          color: palette.text.secondary,
          ...theme.typography.button,
          transition: quick,
          '&:hover': { backgroundColor: palette.action.hover, color: palette.text.primary },
          '&.Mui-selected, &.Mui-selected:hover': {
            backgroundColor: palette.background.neutral,
            color: palette.text.primary,
          },
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 999,
          minHeight: 40,
          padding: '8px 18px',
          boxShadow: 'none',
          transition: quick,
          '&:hover': { boxShadow: 'none' },
        },
        sizeSmall: { minHeight: 32, padding: '4px 12px', fontSize: theme.typography.pxToRem(13) },
        sizeLarge: { minHeight: 48, padding: '12px 24px', fontSize: theme.typography.pxToRem(15) },
        containedPrimary: {
          '&:hover': { backgroundColor: palette.primary.light },
          '&.Mui-disabled': { backgroundColor: palette.action.disabledBackground, color: palette.action.disabled },
        },
        containedInherit: {
          color: palette.text.primary,
          backgroundColor: palette.background.neutral,
          '&:hover': { backgroundColor: palette.background.raised },
        },
        outlined: {
          borderColor: palette.divider,
          color: palette.text.primary,
          '&:hover': { borderColor: palette.grey[500], backgroundColor: palette.background.neutral },
        },
        outlinedError: { color: palette.error.main, '&:hover': { borderColor: palette.error.main } },
        text: {
          color: palette.text.secondary,
          '&:hover': {
            backgroundColor: 'transparent',
            color: palette.text.primary,
            textDecoration: 'underline',
            textUnderlineOffset: 4,
          },
        },
        textError: { color: palette.error.main },
        textInherit: { color: palette.text.primary },
      },
    },
  };
}
