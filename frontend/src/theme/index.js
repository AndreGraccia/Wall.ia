import { useTranslation } from 'react-i18next';
import { enUS, ptBR } from '@mui/material/locale';
import PropTypes from 'prop-types';
import { useMemo } from 'react';
import { CssBaseline } from '@mui/material';
import { ThemeProvider as MUIThemeProvider, createTheme, StyledEngineProvider } from '@mui/material/styles';
import palette from './palette';
import shadows from './shadows';
import typography from './typography';
import GlobalStyles from './globalStyles';
import customShadows from './customShadows';
import componentsOverride from './overrides';

ThemeProvider.propTypes = {
  children: PropTypes.node,
};

export default function ThemeProvider({ children }) {
  const { i18n } = useTranslation();
  const themeOptions = useMemo(
    () => ({
      palette,
      // Radius by hierarchy (DESIGN.md): field and row 12, interactive card 16, panel 20, pill 999.
      shape: { borderRadius: 12 },
      typography,
      shadows: shadows(),
      customShadows: customShadows(),
    }),
    []
  );

  const baseTheme = createTheme(themeOptions);
  const theme = createTheme(
    baseTheme,
    {
      components: componentsOverride(baseTheme),
    },
    i18n.resolvedLanguage?.startsWith('en') ? enUS : ptBR
  );

  return (
    <StyledEngineProvider injectFirst>
      <MUIThemeProvider theme={theme}>
        <CssBaseline />
        <GlobalStyles />
        {children}
      </MUIThemeProvider>
    </StyledEngineProvider>
  );
}
