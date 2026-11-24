import { act, Simulate } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import Plan from './Plan';
import ThemeProvider from '../../theme';
import HttpService from '../../services/HttpService';

jest.mock('../../services/HttpService', () => ({
  getWithAuth: jest.fn(),
  putWithAuth: jest.fn(),
  postWithAuth: jest.fn(),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key, i18n: { language: 'pt' } }),
}));

let root;
let container;
const text = () => container.textContent;
const button = (label) => [...container.querySelectorAll('button')].find((item) => item.textContent === label);
const switches = () => container.querySelectorAll('input[type="checkbox"]');

const income = {
  monthly: 5000,
  day: 5,
  nextDate: '2026-12-04',
  certainty: 'ESTIMATED',
  origin: 'Recorrências de entrada confirmadas',
  sources: [{ key: 'in:x', counterparty: 'Empresa X', category: 'SALARY', amount: 5000, typicalDay: 5 }],
};
const slice = (kind, label, percent, commitment = false) => ({
  kind,
  label,
  percent,
  commitment,
  amount: (5000 * percent) / 100,
  used: kind === 'LEISURE' ? 120 : null,
});

function plan(overrides = {}) {
  return {
    status: 'INCOMPLETE',
    warnings: ['INCOMPLETE'],
    saved: true,
    complete: false,
    totalPercent: 95,
    active: false,
    income,
    slices: [slice('FIXED', 'Fixo', 35), slice('LEISURE', 'Lazer', 20), slice('INVESTMENT', 'Investimento', 40, true)],
    monthlyCommitment: 0,
    fixed: { recurring: 1500, loans: 0 },
    ...overrides,
  };
}

function answer(planBody) {
  HttpService.getWithAuth.mockImplementation((url) => {
    if (url === '/plan') return Promise.resolve(planBody);
    if (url === '/methods') return Promise.resolve({ methods: [] });
    if (url === '/profile') return Promise.resolve({ method: null });
    if (url.startsWith('/plan/projection')) return Promise.resolve({ items: [] });
    return Promise.reject(new Error(url));
  });
}

async function renderPage() {
  await act(async () =>
    root.render(
      <MemoryRouter>
        <HelmetProvider>
          <ThemeProvider>
            <Plan />
          </ThemeProvider>
        </HelmetProvider>
      </MemoryRouter>
    )
  );
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  Object.values(HttpService).forEach((mock) => mock.mockReset());
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

test('a plan that does not add up to 100% cannot be turned on, and says why', async () => {
  answer(plan());
  await renderPage();

  expect(button('plan.actions.activate').disabled).toBe(true);
  expect(text()).toContain('plan.blocked.incomplete');
  expect(text()).toContain('plan.sum.missing');

  const investment = container.querySelector('input[aria-label="plan.slices.percent"][value="40"]');
  await act(async () => {
    Simulate.change(investment, { target: { value: '45' } });
  });

  expect(button('plan.actions.activate').disabled).toBe(false);
  expect(text()).not.toContain('plan.blocked.incomplete');
});

test('"ver se cabe" asks the engine with the draft and saves nothing', async () => {
  answer(plan());
  HttpService.postWithAuth.mockResolvedValue({
    baseline: { negativeDays: 0, minBalance90: 900, minDate: '2026-12-01' },
    scenario: { negativeDays: 3, minBalance90: -150, minDate: '2026-12-02', firstNegativeDate: '2026-12-02' },
    newMonthlyCommitment: 2000,
  });
  await renderPage();

  await act(async () => Simulate.click(button('plan.actions.fit')));

  expect(HttpService.postWithAuth).toHaveBeenCalledWith('/plan/fit', {
    slices: [
      { kind: 'FIXED', label: 'Fixo', percent: 35, commitment: false },
      { kind: 'LEISURE', label: 'Lazer', percent: 20, commitment: false },
      { kind: 'INVESTMENT', label: 'Investimento', percent: 40, commitment: true },
    ],
  });
  expect(HttpService.putWithAuth).not.toHaveBeenCalled();
  expect(text()).toContain('plan.fit.nothingSaved');
  expect(text()).toContain('plan.fit.after');
});

test('only slices that can leave the balance get the "virar compromisso" switch', async () => {
  answer(plan());
  await renderPage();

  // Fixed and Leisure are measured, never committed; the investment is the only one with the switch.
  expect(switches()).toHaveLength(1);
  expect(switches()[0].checked).toBe(true);
  expect(text()).toContain('plan.roles.fixed');
  expect(text()).toContain('plan.roles.leisure');
});

test('without confirmed income the page asks to confirm it in Future and cannot be turned on', async () => {
  answer(plan({ status: 'NEEDS_CONFIRMED_INCOME', income: null, slices: [] }));
  await renderPage();

  expect(text()).toContain('plan.noIncome');
  expect(container.querySelector('a[href="/future"]')).not.toBeNull();
  expect(text()).toContain('plan.empty');
});

test('turning on a complete, unchanged plan only flips the activation', async () => {
  const slices = [slice('FIXED', 'Fixo', 60), slice('INVESTMENT', 'Investimento', 40, true)];
  answer(plan({ status: 'DRAFT', complete: true, saved: true, slices }));
  HttpService.putWithAuth.mockResolvedValue(plan({ status: 'ACTIVE', active: true, complete: true, slices }));
  await renderPage();

  await act(async () => Simulate.click(button('plan.actions.activate')));

  expect(HttpService.putWithAuth).toHaveBeenCalledTimes(1);
  expect(HttpService.putWithAuth).toHaveBeenCalledWith('/plan/activation', { active: true });
  expect(text()).toContain('plan.saved.active');
  expect(button('plan.actions.deactivate')).toBeDefined();
});
