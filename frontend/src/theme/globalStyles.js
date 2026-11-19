import { GlobalStyles as MUIGlobalStyles } from '@mui/material';

export default function GlobalStyles() {
  return (
    <MUIGlobalStyles
      styles={(theme) => ({
        '*': {
          boxSizing: 'border-box',
        },

        '*::selection': {
          color: theme.palette.primary.contrastText,
          backgroundColor: theme.palette.primary.main,
        },

        html: {
          margin: 0,
          padding: 0,
          width: '100%',
          minHeight: '100%',
          WebkitOverflowScrolling: 'touch',
        },

        body: {
          margin: 0,
          padding: 0,
          width: '100%',
          minHeight: '100%',
          color: theme.palette.text.primary,
          backgroundColor: theme.palette.background.default,

          fontFamily: theme.typography.fontFamily,
          // Money lines up: every digit has the same width.
          fontVariantNumeric: 'tabular-nums',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
        },

        '#root': {
          width: '100%',
          minHeight: '100vh',
        },

        button: {
          fontFamily: 'inherit',
        },

        input: {
          fontFamily: 'inherit',

          '&[type=number]': {
            MozAppearance: 'textfield',

            '&::-webkit-outer-spin-button': {
              margin: 0,
              WebkitAppearance: 'none',
            },

            '&::-webkit-inner-spin-button': {
              margin: 0,
              WebkitAppearance: 'none',
            },
          },
        },

        img: {
          display: 'block',
          maxWidth: '100%',
        },

        ul: {
          margin: 0,
          padding: 0,
        },

        '::-webkit-scrollbar': {
          width: 10,
          height: 10,
        },

        '::-webkit-scrollbar-track': {
          background: 'transparent',
        },

        '::-webkit-scrollbar-thumb': {
          border: '3px solid transparent',
          borderRadius: 999,
          backgroundClip: 'padding-box',
          backgroundColor: theme.palette.brand.surface3,
        },

        '::-webkit-scrollbar-thumb:hover': {
          backgroundColor: theme.palette.brand.lineStrong,
        },

        '@media (prefers-reduced-motion: reduce)': {
          '*, *::before, *::after': {
            scrollBehavior: 'auto !important',
            animationDuration: '0.01ms !important',
            animationIterationCount: '1 !important',
            transitionDuration: '0.01ms !important',
          },
        },
      })}
    />
  );
}
