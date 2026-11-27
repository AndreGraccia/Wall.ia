import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import ThemeProvider from './theme';
import { HIDDEN_AMOUNT } from './utils/hiddenAmounts';

// Every screen of the shell, each replaced by the same stand-in: a draft being typed, a fetch on mount and an
// amount formatted while rendering, from money() and from compactMoney(). What is under test is App's wiring.
const mockFetches = jest.fn();
function mockScreen() {
  const { createElement, useEffect } = jest.requireActual('react');
  const { compactMoney, money } = jest.requireActual('./utils/wallet');
  return {
    __esModule: true,
    default: function Screen() {
      useEffect(() => {
        mockFetches();
      }, []);
      return createElement(
        'div',
        null,
        createElement('input', { 'aria-label': 'draft' }),
        createElement('p', { id: 'amount' }, `${money(1234.5, 'pt')} | ${compactMoney(12000, 'pt')}`)
      );
    },
  };
}
jest.mock('./pages/dashboard/Dashboard', () => mockScreen());
jest.mock('./pages/transaction/Transaction', () => mockScreen());
jest.mock('./pages/envelopes/Envelopes', () => mockScreen());
jest.mock('./pages/About', () => mockScreen());
jest.mock('./pages/privacy/Privacy', () => mockScreen());
jest.mock('./pages/wallet/NewWallet', () => mockScreen());
jest.mock('./pages/wallet/Wallet', () => mockScreen());
jest.mock('./pages/insights/Insights', () => mockScreen());
jest.mock('./pages/open-finance/OpenFinance', () => mockScreen());
jest.mock('./pages/future/Future', () => mockScreen());
jest.mock('./pages/plan/Plan', () => mockScreen());
jest.mock('./pages/plan/Method', () => mockScreen());
jest.mock('./pages/cash-flow/CashFlow', () => mockScreen());
jest.mock('./pages/cash-flow/Review', () => mockScreen());
jest.mock('./pages/ask/Ask', () => mockScreen());
jest.mock('./pages/commitments/Commitments', () => mockScreen());
jest.mock('./pages/billing-radar/BillingRadar', () => mockScreen());
jest.mock('./pages/admin/Metrics', () => mockScreen());
jest.mock('./context/WalletContext', () => ({ WalletProvider: ({ children }) => children }));
jest.mock('./services/AuthService', () => ({
  getCurrentUser: () => ({ id: 1, firstName: 'Marina', roles: ['ROLE_USER', 'ROLE_ADMIN'] }),
  logout: jest.fn(),
}));
jest.mock('./services/HttpService', () => ({ getWithAuth: jest.fn(), postWithAuth: jest.fn() }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key, i18n: { language: 'pt', changeLanguage: jest.fn() } }),
}));

let root;
let container;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  window.localStorage.clear();
  mockFetches.mockClear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

test.each([
  '/',
  '/wallets',
  '/wallets/new',
  '/envelopes',
  '/transactions',
  '/future',
  '/plan',
  '/plan/method',
  '/cash-flow',
  '/cash-flow/review',
  '/ask',
  '/commitments',
  '/billing-radar',
  '/insights',
  '/open-finance',
  '/about',
  '/privacy',
  '/admin/metrics',
])('"ocultar saldo" on %s hides and shows the amounts without losing the draft or fetching again', async (path) => {
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </MemoryRouter>
    )
  );
  const amount = () => container.querySelector('#amount').textContent;
  const draft = container.querySelector('input[aria-label="draft"]');
  draft.value = 'half written';
  expect(amount()).toContain('1.234,50');

  const eye = () => container.querySelector('header button[aria-pressed]');
  await act(async () => eye().click());
  expect(amount()).toBe(`${HIDDEN_AMOUNT} | ${HIDDEN_AMOUNT}`);
  await act(async () => eye().click());
  expect(amount()).toContain('1.234,50');

  expect(container.querySelector('input[aria-label="draft"]')).toBe(draft);
  expect(draft.value).toBe('half written');
  expect(mockFetches).toHaveBeenCalledTimes(1);
});
