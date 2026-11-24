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
const flow = (month) => ({
  month,
  currentMonth: month === lastMonths()[0],
  income: side(5000, 'TED', 'SALARY'),
  spending: side(1620, 'PIX', 'EVERYDAY'),
  home: {},
  bankData: null,
});

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  HttpService.getWithAuth.mockReset();
  HttpService.getWithAuth.mockImplementation((url) => Promise.resolve(flow(url.split('month=')[1])));
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
  expect(HttpService.getWithAuth).toHaveBeenLastCalledWith(`/cash-flow?month=${months[0]}`);

  await act(async () => Simulate.mouseDown(container.querySelector('[aria-haspopup="listbox"]'), { button: 0 }));
  const option = document.body.querySelector(`li[data-value="${months[2]}"]`);
  await act(async () => Simulate.click(option));

  expect(HttpService.getWithAuth).toHaveBeenLastCalledWith(`/cash-flow?month=${months[2]}`);
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
