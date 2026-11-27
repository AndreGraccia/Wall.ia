// Geist, the only family (DESIGN.md). The italic marks an estimate.
import '@fontsource-variable/geist';
import '@fontsource-variable/geist/wght-italic.css';
import { MaterialDesignContent, SnackbarProvider } from 'notistack';
import { styled } from '@mui/material/styles';
import ReactDOM from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './i18n';
import ScrollToTop from './components/scroll-to-top';
import ThemeProvider from './theme';

// Toasts follow the alerts: surface3, a 2 px bar in the state colour, text in the text colour.
const Toast = styled(MaterialDesignContent)(({ theme }) => ({
  ...theme.typography.body2,
  fontSize: theme.typography.pxToRem(14),
  color: theme.palette.text.primary,
  backgroundColor: theme.palette.background.raised,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 12,
  boxShadow: theme.customShadows.dropdown,
  ...Object.fromEntries(
    ['success', 'error', 'warning', 'info'].map((tone) => [
      `&.notistack-MuiContent-${tone}`,
      { backgroundColor: theme.palette.background.raised, borderLeft: `2px solid ${theme.palette[tone].main}` },
    ])
  ),
}));
const toasts = { default: Toast, success: Toast, error: Toast, warning: Toast, info: Toast };

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <HelmetProvider>
    <BrowserRouter>
      <ThemeProvider>
        <ScrollToTop />
        <SnackbarProvider preventDuplicate Components={toasts}>
          <App />
        </SnackbarProvider>
      </ThemeProvider>
    </BrowserRouter>
  </HelmetProvider>
);
