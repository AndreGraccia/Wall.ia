import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import DashboardLayout from './DashboardLayout';
import ThemeProvider from '../../theme';

jest.mock('../../context/WalletContext', () => ({ WalletProvider: ({ children }) => children }));
jest.mock('../../services/AuthService', () => ({
  getCurrentUser: () => ({ firstName: 'Marina', lastName: 'Souza', roles: ['ROLE_USER'] }),
  logout: jest.fn(),
}));
jest.mock('../../services/HttpService', () => ({ postWithAuth: jest.fn() }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key, i18n: { language: 'pt', changeLanguage: jest.fn() } }),
}));

let root;
let container;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function renderAt(path) {
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <ThemeProvider>
          <Routes>
            <Route element={<DashboardLayout />}>
              <Route path="*" element={<p>page</p>} />
            </Route>
          </Routes>
        </ThemeProvider>
      </MemoryRouter>
    )
  );
}

const navLinks = (label) =>
  [...container.querySelectorAll(`nav[aria-label="${label}"] a`)].map((link) => link.getAttribute('href'));

test('the phone bar holds the daily questions, and "Perguntar" is an action on every screen, not a place', async () => {
  await renderAt('/future');

  expect(navLinks('app.navigation')).toEqual(['/', '/future', '/plan', '/commitments']);
  const ask = container.querySelector('header a[href="/ask"]');
  expect(ask.getAttribute('aria-label')).toBe('app.askAction');
  // Nothing in the side menu leads to /ask: it is reachable from the top bar instead.
  const sideMenu = [...container.querySelectorAll('nav[aria-label^="navigation.groups"] a')];
  expect(sideMenu.map((link) => link.getAttribute('href'))).not.toContain('/ask');
});

test('"Compromissos" stays active on the charge radar, which belongs to it', async () => {
  await renderAt('/billing-radar');

  const commitments = container.querySelector('nav[aria-label="app.navigation"] a[href="/commitments"]');
  expect(commitments.getAttribute('aria-current')).toBe('page');
});

test('"ocultar saldo" redraws the page, which reads the preference while rendering', async () => {
  let renders = 0;
  function Page() {
    renders += 1;
    return <p>page</p>;
  }
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={['/cash-flow']}>
        <ThemeProvider>
          <Routes>
            <Route element={<DashboardLayout />}>
              <Route path="*" element={<Page />} />
            </Route>
          </Routes>
        </ThemeProvider>
      </MemoryRouter>
    )
  );
  const before = renders;
  const eye = container.querySelector('button[aria-pressed]');
  await act(async () => eye.click());
  expect(renders).toBeGreaterThan(before);
  await act(async () => eye.click());
});
