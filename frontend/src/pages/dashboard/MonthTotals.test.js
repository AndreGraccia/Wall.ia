import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { MonthTotals } from './Dashboard';
import ThemeProvider from '../../theme';
import HttpService from '../../services/HttpService';
import { HIDDEN_AMOUNT } from '../../utils/hiddenAmounts';

jest.mock('../../services/HttpService', () => ({ getWithAuth: jest.fn() }));
jest.mock('../../context/WalletContext', () => ({ useWallets: jest.fn() }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key, i18n: { language: 'pt' } }),
}));

let root;
let container;
const text = () => container.textContent;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  HttpService.getWithAuth.mockReset();
  HttpService.getWithAuth.mockResolvedValue({
    month: '2026-11',
    home: { income: 5000, spending: 1620, leisure: 120, investment: 750, leisureAndInvestment: 870 },
  });
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function renderTotals(hidden) {
  await act(async () =>
    root.render(
      <MemoryRouter>
        <ThemeProvider>
          <MonthTotals hidden={hidden} />
        </ThemeProvider>
      </MemoryRouter>
    )
  );
}

test('the three totals of the month each open the screen that explains them', async () => {
  await renderTotals(false);

  expect(HttpService.getWithAuth).toHaveBeenCalledWith('/cash-flow');
  expect(text()).toContain('5.000,00');
  expect(text()).toContain('1.620,00');
  expect(text()).toContain('870,00');
  const links = [...container.querySelectorAll('a')].map((link) => link.getAttribute('href'));
  expect(links).toEqual(['/cash-flow?tab=income', '/cash-flow', '/plan']);
});

test('"ocultar saldo" hides the three totals too', async () => {
  await renderTotals(true);

  expect(text().split(HIDDEN_AMOUNT)).toHaveLength(4);
  expect(text()).not.toContain('5.000,00');
  expect(text()).not.toContain('870,00');
});
