export default function Tooltip(theme) {
  const { palette } = theme;
  return {
    MuiTooltip: {
      defaultProps: { enterTouchDelay: 0 },
      styleOverrides: {
        tooltip: {
          ...theme.typography.body2,
          color: palette.text.primary,
          backgroundColor: palette.background.raised,
          border: `1px solid ${palette.divider}`,
          borderRadius: 8,
          padding: '8px 12px',
          maxWidth: 300,
        },
        arrow: { color: palette.background.raised },
      },
    },
  };
}
