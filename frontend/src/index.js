import '@fontsource-variable/inter';
import '@fontsource-variable/inter/wght-italic.css';
// Optical-size axis: the display face gets tighter and more characterful as it grows.
import '@fontsource-variable/bricolage-grotesque/opsz.css';
import '@fontsource-variable/jetbrains-mono';
import { SnackbarProvider } from 'notistack';
import ReactDOM from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './i18n';
import ScrollToTop from './components/scroll-to-top';
import ThemeProvider from './theme';

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <HelmetProvider>
    <BrowserRouter>
      <ThemeProvider>
        <ScrollToTop />
        <SnackbarProvider preventDuplicate>
          <App />
        </SnackbarProvider>
      </ThemeProvider>
    </BrowserRouter>
  </HelmetProvider>
);
