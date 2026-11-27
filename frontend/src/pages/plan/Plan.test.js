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
const fields = () => container.querySelectorAll('input');
// A saved plan opens for reading; the editor is one click away.
const edit = () => act(async () => Simulate.click(button('plan.slices.edit')));

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

const month = (key, net) => ({
  month: key,
  partial: false,
  inflowConfirmed: 4875,
  inflowEstimated: 0,
  outflowConfirmed: 4000,
  outflowEstimated: 0,
  plan: 731.25,
  net,
  endBalance: 100,
});

function answer(planBody, items = []) {
  HttpService.getWithAuth.mockImplementation((url) => {
    if (url === '/plan') return Promise.resolve(planBody);
    if (url === '/methods') return Promise.resolve({ methods: [] });
    if (url === '/profile') return Promise.resolve({ method: null });
    if (url.startsWith('/plan/projection')) return Promise.resolve({ items });
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

  await edit();
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
  await edit();

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

test('activating the plan clears the "ver se cabe" result, which compared against the old "now"', async () => {
  answer(plan());
  HttpService.postWithAuth.mockResolvedValue({
    baseline: { negativeDays: 0, minBalance90: 900, minDate: '2026-12-01' },
    scenario: { negativeDays: 0, minBalance90: 300, minDate: '2026-12-02' },
    newMonthlyCommitment: 2000,
  });
  HttpService.putWithAuth.mockResolvedValue(plan());
  await renderPage();
  await edit();
  const investment = container.querySelector('input[aria-label="plan.slices.percent"][value="40"]');
  await act(async () => {
    Simulate.change(investment, { target: { value: '45' } });
  });
  await act(async () => Simulate.click(button('plan.actions.fit')));
  expect(text()).toContain('plan.fit.after');

  await act(async () => Simulate.click(button('plan.actions.activate')));

  expect(HttpService.putWithAuth).toHaveBeenCalledWith('/plan/activation', { active: true });
  expect(text()).not.toContain('plan.fit.after');
});

test('only slices that can leave the balance get the "tirar do saldo" switch', async () => {
  answer(plan());
  await renderPage();
  await edit();

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
  // Turning it off lives in the "more" menu, not in the main area.
  expect(button('plan.actions.deactivate')).toBeUndefined();
  await act(async () => Simulate.click(container.querySelector('button[aria-label="plan.menu.label"]')));
  const item = [...document.querySelectorAll('[role="menuitem"]')].find(
    (el) => el.textContent === 'plan.actions.deactivate'
  );
  expect(item).toBeDefined();
});

test('a saved plan opens for reading: no editable field until "Editar fatias"', async () => {
  answer(plan({ status: 'ACTIVE', active: true, complete: true, monthlyCommitment: 2000 }));
  await renderPage();

  expect(fields()).toHaveLength(0);
  expect(text()).toContain('Investimento');
  expect(text()).toContain('plan.roles.committed');
  expect(text()).toContain('plan.roles.leisure');
  // Each segment of the bar names itself.
  expect(container.querySelector('[role="img"][aria-label^="Fixo"]')).not.toBeNull();

  await edit();

  expect(fields().length).toBeGreaterThan(0);
  expect(button('plan.slices.edit')).toBeUndefined();
  await act(async () => Simulate.click(button('plan.actions.cancel')));
  expect(fields()).toHaveLength(0);
});

test('a month below zero says "Falta" with the amount, above zero "Sobra"; the hero answers for this month', async () => {
  answer(plan(), [month('2026-11', -109.6), month('2026-12', 250)]);
  await renderPage();

  const rows = [...container.querySelectorAll('section[aria-labelledby="plan-projection"] [aria-busy] > div')];
  expect(rows[0].textContent).toContain('plan.projection.short');
  expect(rows[0].textContent).not.toContain('plan.projection.net');
  expect(rows[0].textContent).toMatch(/R\$\s109,60/);
  expect(rows[0].textContent).not.toContain('−');
  expect(rows[1].textContent).toContain('plan.projection.net');
  expect(rows[1].textContent).not.toContain('plan.projection.short');
  expect(container.querySelector('#plan-hero').textContent).toContain('plan.hero.short');
});

test('a positive month in the hero says what is left', async () => {
  answer(plan(), [month('2026-11', 320)]);
  await renderPage();

  expect(container.querySelector('#plan-hero').textContent).toContain('plan.hero.left');
});

test('spending no slice measures is shown, not counted as leisure', async () => {
  answer(plan({ status: 'ACTIVE', active: true, complete: true, unclassified: 30 }));
  await renderPage();

  expect(text()).toContain('plan.slices.unclassified');
});
