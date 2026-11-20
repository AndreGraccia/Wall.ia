// Floating layers (menus, popovers, dialogs) sit on surface3 with a line; they are the only things that cast
// a shadow.
export default function Paper(theme) {
  const { palette } = theme;
  const floating = {
    backgroundColor: palette.background.raised,
    border: `1px solid ${palette.divider}`,
    boxShadow: theme.customShadows.dropdown,
  };
  return {
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: { root: { backgroundImage: 'none' } },
    },
    MuiPopover: { styleOverrides: { paper: { ...floating, borderRadius: 12 } } },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          ...theme.typography.subtitle2,
          minHeight: 40,
          borderRadius: 8,
          margin: '0 4px',
          '&.Mui-selected, &.Mui-selected:hover': { backgroundColor: palette.background.neutral },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { ...floating, backgroundColor: palette.background.paper, borderRadius: 20 },
      },
    },
    MuiDialogTitle: { styleOverrides: { root: { ...theme.typography.h6, padding: theme.spacing(3, 3, 1) } } },
    MuiDialogContent: { styleOverrides: { root: { padding: theme.spacing(1, 3, 2) } } },
    MuiDialogActions: { styleOverrides: { root: { padding: theme.spacing(2, 3, 3), gap: 8 } } },
    MuiDrawer: {
      styleOverrides: { paper: { backgroundColor: palette.background.paper, border: 0, boxShadow: 'none' } },
    },
    MuiBackdrop: {
      styleOverrides: {
        root: { backgroundColor: 'rgba(4, 5, 7, 0.72)' },
        invisible: { background: 'transparent' },
      },
    },
  };
}
