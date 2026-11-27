// Fields: surface2, a border that keeps 3:1 (WCAG 1.4.11) and a 2 px `future` ring on focus.
export default function Input(theme) {
  const { palette } = theme;
  return {
    MuiInputBase: {
      styleOverrides: {
        root: { '&.Mui-disabled svg': { color: palette.text.disabled } },
        input: {
          // Placeholders are read, so they keep 4.5:1 (text2, not muted).
          '&::placeholder': { opacity: 1, color: palette.text.secondary },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: { color: palette.text.secondary, '&.Mui-focused': { color: palette.text.primary } },
      },
    },
    MuiFormHelperText: {
      styleOverrides: { root: { marginLeft: 2, color: palette.text.secondary } },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          backgroundColor: palette.background.neutral,
          '& .MuiOutlinedInput-notchedOutline': { borderColor: palette.brand.lineStrong },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: palette.text.secondary },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: palette.secondary.main, borderWidth: 2 },
          '&.Mui-error .MuiOutlinedInput-notchedOutline': { borderColor: palette.error.main },
          '&.Mui-disabled .MuiOutlinedInput-notchedOutline': { borderColor: palette.divider },
        },
      },
    },
    MuiFilledInput: {
      styleOverrides: {
        root: {
          backgroundColor: palette.background.neutral,
          '&:hover': { backgroundColor: palette.background.raised },
          '&.Mui-focused': { backgroundColor: palette.background.neutral },
        },
      },
    },
    MuiAutocomplete: {
      styleOverrides: { paper: { boxShadow: theme.customShadows.dropdown } },
    },
  };
}
