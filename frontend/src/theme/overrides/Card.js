// Panels: surface1 and a 1 px line, no shadow. Radius by hierarchy: large panel 20.
export default function Card(theme) {
  return {
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
          borderRadius: 20,
          border: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.background.paper,
          position: 'relative',
          zIndex: 0, // Fix Safari overflow: hidden with border radius
        },
      },
    },
    MuiCardHeader: {
      defaultProps: { titleTypographyProps: { variant: 'h6' }, subheaderTypographyProps: { variant: 'body2' } },
      styleOverrides: { root: { padding: theme.spacing(3, 3, 0) } },
    },
    MuiCardContent: { styleOverrides: { root: { padding: theme.spacing(3) } } },
  };
}
