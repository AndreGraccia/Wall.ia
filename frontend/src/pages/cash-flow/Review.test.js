import { act, Simulate } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import Review from './Review';
import { lastMonths } from './CashFlow';
import ThemeProvider from '../../theme';
import HttpService from '../../services/HttpService';

jest.mock('../../services/HttpService', () => ({
  getWithAuth: jest.fn(),
  postWithAuth: jest.fn(),
  putWithAuth: jest.fn(),
  deleteWithAuth: jest.fn(),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key, i18n: { language: 'pt' } }),
}));

let root;
let container;
let decided;
const month = lastMonths()[0];
const text = () => container.textContent;
const entry = (id, counterparty, category, origin) => ({
  id,
  date: `${month}-0${id}`,
  counterparty,
  amount: 10 * id,
  account: 'Conta',
  method: 'PIX',
  category,
  origin,
});
const flow = () => ({
  month,
  income: { items: [] },
  spending: {
    items: [
      entry(1, 'Mercado Sol', 'ESSENTIAL', 'NAME'),
      entry(2, 'Loja Aurora', 'UNCLASSIFIED', 'NONE'),
      entry(3, 'Imobiliaria', 'RENT', 'RECURRENCE'),
    ].filter((item) => !decided.has(item.id)),
  },
});

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  decided = new Set();
  jest.clearAllMocks();
  HttpService.getWithAuth.mockImplementation((url) => Promise.resolve(url === '/categories/rules' ? [] : flow()));
  HttpService.putWithAuth.mockImplementation((url) => {
    decided.add(Number(url.split('/').pop()));
    return Promise.resolve();
  });
  HttpService.deleteWithAuth.mockImplementation((url) => {
    decided.delete(Number(url.split('/').pop()));
    return Promise.resolve();
  });
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function renderPage() {
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={['/cash-flow/review']}>
        <HelmetProvider>
          <ThemeProvider>
            <Review />
          </ThemeProvider>
        </HelmetProvider>
      </MemoryRouter>
    )
  );
}
const byText = (label) => [...document.querySelectorAll('button')].find((item) => item.textContent === label);

test('only suggestions and unclassified entries are queued; confirming takes one tap and can be undone', async () => {
  await renderPage();
  expect(text()).toContain('Mercado Sol');
  expect(text()).toContain('Loja Aurora');
  expect(text()).not.toContain('Imobiliaria');
  // Only the suggestion has something to confirm.
  expect([...container.querySelectorAll('button')].filter((b) => b.textContent === 'review.confirm')).toHaveLength(1);

  await act(async () => Simulate.click(byText('review.confirm')));
  expect(HttpService.putWithAuth).toHaveBeenCalledWith('/categories/transactions/1', { category: 'ESSENTIAL' });
  expect(container.querySelector('#review-queue').parentElement.textContent).not.toContain('Mercado Sol');

  await act(async () => Simulate.click(byText('review.undo')));
  expect(HttpService.deleteWithAuth).toHaveBeenCalledWith('/categories/transactions/1');
  expect(container.querySelector('#review-queue').parentElement.textContent).toContain('Mercado Sol');
});

test('picking a category empties the queue and says so', async () => {
  decided.add(1);
  await renderPage();
  await act(async () => Simulate.change(container.querySelector('select'), { target: { value: 'LEISURE' } }));

  expect(HttpService.putWithAuth).toHaveBeenCalledWith('/categories/transactions/2', { category: 'LEISURE' });
  expect(text()).toContain('review.empty');
});

test('a failed save says why and keeps the entry in the queue', async () => {
  HttpService.putWithAuth.mockRejectedValueOnce({ response: { data: { code: 'TRANSACTION_NOT_FOUND' } } });
  await renderPage();
  await act(async () => Simulate.click(byText('review.confirm')));

  expect(text()).toContain('app.errors.TRANSACTION_NOT_FOUND');
  expect(text()).toContain('Mercado Sol');
});
