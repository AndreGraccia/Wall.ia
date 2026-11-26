import { act, Simulate } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import CashFlow, { lastMonths } from './CashFlow';
import ThemeProvider from '../../theme';
import HttpService from '../../services/HttpService';

jest.mock('../../services/HttpService', () => ({ getWithAuth: jest.fn() }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key, i18n: { language: 'pt' } }),
}));

let root;
let container;
const text = () => container.textContent;

const side = (total, method, category) => ({
  total,
  count: 1,
  byAccount: [{ key: 'Banco Aurora · Conta', total, count: 1 }],
  byMethod: [{ key: method, total, count: 1 }],
  byCategory: [{ key: category, total, count: 1 }],
});
const month0 = lastMonths()[0];
const spending = {
  ...side(1620, 'PIX', 'EVERYDAY'),
  count: 2,
  byMethod: [
    { key: 'PIX', total: 1500, count: 1 },
    { key: 'BOLETO', total: 120, count: 1 },
  ],
  items: [
    {
      id: 2,
      date: `${month0}-03`,
      counterparty: 'Mercado Sol',
      amount: 1500,
      account: 'Banco Aurora · Conta',
      method: 'PIX',
      category: 'EVERYDAY',
    },
    {
      id: 1,
      date: `${month0}-02`,
      counterparty: 'Escola X',
      amount: 120,
      account: 'Banco Aurora · Conta',
      method: 'BOLETO',
      category: 'EVERYDAY',
    },
  ],
};
const overview = {
  projection: {
    days: [{ date: `${month0}-01`, balance: 100 }],
    events: [
      {
        date: `${month0}-28`,
        amount: -900,
        label: 'Aluguel',
        category: 'RENT',
        certainty: 'ESTIMATED',
        reference: 'out:aluguel',
      },
      { date: '2999-01-05', amount: -50, label: 'Outro mes', category: 'BILL', certainty: 'ESTIMATED', reference: 'x' },
    ],
  },
};
const flow = (month) => ({
  month,
  currentMonth: month === lastMonths()[0],
  income: side(5000, 'TED', 'SALARY'),
  spending,
  home: {},
  bankData: null,
});

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  HttpService.getWithAuth.mockReset();
  HttpService.getWithAuth.mockImplementation((url) =>
    Promise.resolve(url.startsWith('/future') ? overview : flow(url.split('month=')[1]))
  );
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function renderPage(entry = '/cash-flow') {
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[entry]}>
        <HelmetProvider>
          <ThemeProvider>
            <CashFlow />
          </ThemeProvider>
        </HelmetProvider>
      </MemoryRouter>
    )
  );
}

test('the spending tab opens first; switching to income shows the income side', async () => {
  await renderPage();
  expect(text()).toContain('1.620,00');
  expect(text()).toContain('paymentMethods.PIX');
  expect(text()).toContain('cashFlow.realized');

  const incomeTab = [...container.querySelectorAll('[role="tab"]')].find(
    (tab) => tab.textContent === 'cashFlow.tabs.income'
  );
  await act(async () => Simulate.click(incomeTab));

  expect(incomeTab.getAttribute('aria-selected')).toBe('true');
  expect(text()).toContain('5.000,00');
  expect(text()).toContain('paymentMethods.TED');
  expect(text()).not.toContain('paymentMethods.PIX');
});

test('picking another month asks for that month', async () => {
  const months = lastMonths();
  await renderPage();
  expect(HttpService.getWithAuth).toHaveBeenCalledWith(`/cash-flow?month=${months[0]}`);

  await act(async () => Simulate.mouseDown(container.querySelector('[aria-haspopup="listbox"]'), { button: 0 }));
  const option = document.body.querySelector(`li[data-value="${months[2]}"]`);
  await act(async () => Simulate.click(option));

  expect(HttpService.getWithAuth).toHaveBeenCalledWith(`/cash-flow?month=${months[2]}`);
});

test('a month from the link opens directly, and only 13 months are offered', async () => {
  const months = lastMonths(new Date(2026, 10, 23));
  expect(months).toHaveLength(13);
  expect(months[0]).toBe('2026-11');
  expect(months[12]).toBe('2025-11');

  await renderPage(`/cash-flow?month=${lastMonths()[1]}&tab=income`);
  expect(HttpService.getWithAuth).toHaveBeenCalledWith(`/cash-flow?month=${lastMonths()[1]}`);
  expect(text()).toContain('5.000,00');
});

test('a failed load says so and offers to try again', async () => {
  HttpService.getWithAuth.mockRejectedValueOnce({ response: { status: 500 } });
  await renderPage();

  expect(text()).toContain('cashFlow.loadError');
  const retry = [...container.querySelectorAll('button')].find((item) => item.textContent === 'app.retry');
  await act(async () => Simulate.click(retry));
  expect(text()).toContain('1.620,00');
});

test('a group row filters the list of movements, and clearing brings all back', async () => {
  await renderPage();
  expect(text()).toContain('Mercado Sol');
  expect(text()).toContain('Escola X');

  const boleto = container.querySelector('[aria-label="cashFlow.filter.by"]:not([aria-pressed="true"])');
  const rows = [...container.querySelectorAll('[aria-pressed]')];
  const pick = rows.find((row) => row.textContent.includes('paymentMethods.BOLETO'));
  expect(boleto).not.toBeNull();
  await act(async () => Simulate.click(pick));

  expect(pick.getAttribute('aria-pressed')).toBe('true');
  expect(text()).toContain('Escola X');
  expect(text()).not.toContain('Mercado Sol');

  await act(async () => Simulate.click(pick));
  expect(text()).toContain('Mercado Sol');
});

test('this month shows what still leaves, apart from the realized total', async () => {
  await renderPage();
  expect(HttpService.getWithAuth).toHaveBeenCalledWith('/future/overview?horizon=31');
  expect(text()).toContain('cashFlow.upcoming.title');
  expect(text()).toContain('Aluguel');
  expect(text()).not.toContain('Outro mes');
  expect(text()).toContain('1.620,00');
});
