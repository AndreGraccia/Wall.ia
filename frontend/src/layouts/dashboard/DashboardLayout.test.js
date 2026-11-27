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

test('on the phone, what a bar item covers is not repeated in the "Mais" sheet', async () => {
  await renderAt('/billing-radar');
  const more = container.querySelector('nav[aria-label="app.navigation"] button[aria-haspopup="dialog"]');
  await act(async () => more.click());

  const sheet = document.querySelector('.MuiDrawer-paper');
  const links = [...sheet.querySelectorAll('a')].map((link) => link.getAttribute('href'));
  expect(links).toContain('/wallets');
  expect(links).toContain('/wealth');
  expect(links).toContain('/life-goals');
  expect(links).not.toContain('/billing-radar');
  expect(links).not.toContain('/commitments');
  // The side menu of the desktop still lists it.
  expect(container.querySelector('aside a[href="/billing-radar"]')).not.toBeNull();
});

test('menu entries are at least 44 px tall under a finger', async () => {
  await renderAt('/');
  const link = container.querySelector('aside nav a');
  const css = [...document.querySelectorAll('style')].map((style) => style.textContent).join('');
  const coarse = css.match(/@media \(pointer: coarse\)\{[^{}]*\{[^{}]*\}/g) || [];

  expect(
    [...link.classList].some((name) =>
      coarse.some((rule) => rule.includes(`.${name}{`) && rule.includes('min-height:44px'))
    )
  ).toBe(true);
});

test('dismissed first steps can be resumed from the account menu', async () => {
  window.localStorage.setItem('wallia.onboarding.dismissed.undefined', '1');
  await renderAt('/future');
  await act(async () => container.querySelector('button[aria-haspopup="menu"]').click());

  const resume = [...document.querySelectorAll('[role="menuitem"]')].find(
    (item) => item.textContent === 'onboarding.resume'
  );
  await act(async () => resume.click());
  expect(window.localStorage.getItem('wallia.onboarding.dismissed.undefined')).toBe('0');
});

test('the page title is told how wide the header actions really are', async () => {
  const width = jest.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(128);
  await renderAt('/future');

  expect(document.documentElement.style.getPropertyValue('--shell-actions-width')).toBe('128px');
  width.mockRestore();
});
