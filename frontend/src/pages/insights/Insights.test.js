import { act, Simulate } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import Insights from './Insights';
import ThemeProvider from '../../theme';
import HttpService from '../../services/HttpService';

jest.mock('../../services/HttpService', () => ({ postWithAuth: jest.fn(), getWithAuth: jest.fn() }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, options) => (options?.count ? `${key}:${options.count}` : key),
    i18n: { language: 'pt', resolvedLanguage: 'pt' },
  }),
}));

const report = (transactionCount) => ({
  headline: 'Você gastou menos do que recebeu',
  summary: 'Resumo',
  provider: 'LOCAL',
  generatedAt: '2026-11-26T10:00:00Z',
  periodMonths: 3,
  bankData: null,
  metrics: { inflow: 4200, outflow: 3000, netFlow: 1200, transactionCount },
  monthlyFlow: [{ month: '2026-11', inflow: 4200, outflow: 3000 }],
  observations: [],
  recommendedActions: [],
  references: [],
  disclaimer: '',
  privacyNotice: '',
});

let root;
let container;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  HttpService.postWithAuth.mockReset();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = () =>
  act(async () =>
    root.render(
      <MemoryRouter>
        <HelmetProvider>
          <ThemeProvider>
            <Insights />
          </ThemeProvider>
        </HelmetProvider>
      </MemoryRouter>
    )
  );

test('the report is generated on arrival, without a click, and again when the period changes', async () => {
  let answer;
  HttpService.postWithAuth.mockReturnValue(
    new Promise((resolve) => {
      answer = resolve;
    })
  );
  await render();

  expect(HttpService.postWithAuth).toHaveBeenCalledWith('/insights/reports', { months: 3, language: 'pt-BR' });
  // While it loads, the skeleton has the report's shape and there is no button to generate it.
  expect(container.querySelector('[role="status"] .MuiSkeleton-root')).not.toBeNull();
  expect(container.textContent).not.toContain('insights.generate');

  await act(async () => answer(report(12)));
  expect(container.textContent).toContain('Você gastou menos do que recebeu');

  HttpService.postWithAuth.mockResolvedValue(report(30));
  const sixMonths = container.querySelector('button[aria-label="insights.months:6"]');
  await act(async () => Simulate.click(sixMonths));
  expect(HttpService.postWithAuth).toHaveBeenLastCalledWith('/insights/reports', { months: 6, language: 'pt-BR' });
});

test('a period with no movement says so in one sentence and offers the bank connection', async () => {
  HttpService.postWithAuth.mockResolvedValue(report(0));
  await render();
  // The 3-month report was cached by the previous test; pick a period not seen yet.
  await act(async () => Simulate.click(container.querySelector('button[aria-label="insights.months:12"]')));

  expect(container.textContent).toContain('insights.emptyNoData');
  expect(container.querySelector('a[href="/open-finance"]')).not.toBeNull();
  expect(container.textContent).not.toContain('insights.cashFlow');
});

test('a failure shows what happened and a retry that asks again', async () => {
  HttpService.postWithAuth.mockRejectedValue({ response: { status: 500 } });
  await render();
  await act(async () => Simulate.click(container.querySelector('button[aria-label="insights.months:1"]')));
  expect(container.textContent).toContain('app.errors.server');

  const calls = HttpService.postWithAuth.mock.calls.length;
  const retry = [...container.querySelectorAll('button')].find((button) => button.textContent === 'app.retry');
  await act(async () => Simulate.click(retry));
  expect(HttpService.postWithAuth.mock.calls.length).toBe(calls + 1);
});
