// Tables read like the lists: hairline rows, quiet header, numbers tabular.
export default function Table(theme) {
  const { palette } = theme;
  return {
    MuiTableCell: {
      styleOverrides: {
        root: { borderBottom: `1px solid ${palette.divider}`, padding: '12px 16px' },
        head: { ...theme.typography.overline, color: palette.text.secondary, backgroundColor: 'transparent' },
        sizeSmall: { padding: '10px 12px' },
      },
    },
  };
}
