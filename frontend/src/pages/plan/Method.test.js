import { act, Simulate } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import Method from './Method';
import ThemeProvider from '../../theme';
import HttpService from '../../services/HttpService';

jest.mock('../../services/HttpService', () => ({
  getWithAuth: jest.fn(),
  putWithAuth: jest.fn(),
  postWithAuth: jest.fn(),
}));
// The params show up in the text, so the test sees the numbers the sentence carries.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, options = {}) => {
      const params = { ...options };
      delete params.defaultValue;
      return Object.keys(params).length ? `${key}${JSON.stringify(params)}` : key;
    },
    i18n: { language: 'pt' },
  }),
}));

let root;
let container;
const text = () => container.textContent;
const buttons = (label) => [...container.querySelectorAll('button')].filter((item) => item.textContent === label);

const suggestions = {
  catalogVersion: '2026-11-23',
  needsConfirmedIncome: false,
  preference: 'NOT_SAID',
  suggestions: [
    {
      method: 'PRIORITIES',
      reasons: [
        {
          code: 'FIXED_ABOVE_HALF_OF_INCOME',
          params: { fixedSharePercent: 60.0, fixedMonthly: 2400, monthlyIncome: 4000 },
        },
      ],
    },
    { method: 'DEBT_AVALANCHE', reasons: [{ code: 'DEBTS_WITH_RATE', params: { debts: 2 } }] },
  ],
  data: { confirmedIncome: 4000, variableIncome: false, fixedMonthly: 2400, fixedSharePercent: 60.0, debtsWithRate: 2 },
};
const methods = [
  {
    id: 'PRIORITIES',
    name: 'Orçamento por prioridades',
    howItWorks: 'Uma lista ordenada.',
    helpsWhen: 'Quando aperta.',
    limitations: 'Não diz quanto guardar.',
    where: { tool: 'MONTH_PLAN', route: '/api/v1/plan' },
    effort: 'MEDIUM',
    preset: [],
  },
  {
    id: 'DEBT_AVALANCHE',
    name: 'Quitação avalanche',
    howItWorks: 'Maior juros primeiro.',
    helpsWhen: 'Duas dívidas.',
    limitations: 'Demora.',
    where: { tool: 'DEBT_PAYOFF', route: '/api/v1/future/debt-payoff' },
    effort: 'MEDIUM',
    preset: [],
  },
];
const profile = { preference: 'NOT_SAID', mainGoal: 'NOT_SAID', method: null, methodHistory: [] };

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  Object.values(HttpService).forEach((mock) => mock.mockReset());
  HttpService.getWithAuth.mockImplementation((url) =>
    Promise.resolve({ '/methods/suggestions': suggestions, '/methods': { methods }, '/profile': profile }[url])
  );
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function renderPage() {
  await act(async () =>
    root.render(
      <MemoryRouter>
        <HelmetProvider>
          <ThemeProvider>
            <Method />
          </ThemeProvider>
        </HelmetProvider>
      </MemoryRouter>
    )
  );
}

test('each suggestion shows its reason with the numbers behind it', async () => {
  await renderPage();

  // Money as money, the share as a percent, the count as a number.
  expect(text()).toContain('method.reasons.FIXED_ABOVE_HALF_OF_INCOME');
  expect(text()).toContain('"fixedSharePercent":"60%"');
  expect(text()).toMatch(/"fixedMonthly":"R\$\s2\.400,00"/);
  expect(text()).toMatch(/"monthlyIncome":"R\$\s4\.000,00"/);
  expect(text()).toContain('method.reasons.DEBTS_WITH_RATE{"debts":2}');
  expect(text()).toContain('method.dataUsed');
});

test('choosing a method records it and marks it as yours', async () => {
  HttpService.putWithAuth.mockResolvedValue({
    ...profile,
    method: 'PRIORITIES',
    methodHistory: [{ method: 'PRIORITIES', catalogVersion: '2026-11-23', chosenAt: '2026-11-23T10:00:00Z' }],
  });
  await renderPage();

  // One radio per suggested line, one "use" button under the list (no repeated button per line).
  const radios = container.querySelectorAll('input[type="radio"]');
  expect(radios).toHaveLength(2);
  expect(buttons('method.use')).toHaveLength(1);
  await act(async () => Simulate.click(radios[1]));
  await act(async () => Simulate.change(radios[1], { target: { checked: true, value: 'DEBT_AVALANCHE' } }));
  expect(radios[1].checked).toBe(true);
  await act(async () => Simulate.change(radios[0], { target: { checked: true, value: 'PRIORITIES' } }));

  await act(async () => Simulate.click(buttons('method.use')[0]));

  expect(HttpService.putWithAuth).toHaveBeenCalledWith('/profile/method', { method: 'PRIORITIES' });
  expect(text()).toContain('method.isCurrent');
  expect(text()).toContain('method.chosenNotice');
  expect(text()).toContain('method.chosen');
});

test('changing the main goal asks for the suggestions again, because the rules read it', async () => {
  HttpService.putWithAuth.mockResolvedValue({ ...profile, mainGoal: 'LEAVE_DEBT' });
  await renderPage();
  HttpService.getWithAuth.mockClear();

  // The preferences card starts closed.
  const card = [...container.querySelectorAll('button, [role="button"]')].find((item) =>
    `${item.textContent} ${item.getAttribute('aria-label')}`.includes('method.profile.title')
  );
  await act(async () => Simulate.click(card));
  const select = container.querySelector('[aria-haspopup="listbox"]');
  await act(async () => Simulate.mouseDown(select, { button: 0 }));
  const option = [...document.querySelectorAll('[role="option"]')].find((item) =>
    item.textContent.includes('method.profile.goals.LEAVE_DEBT')
  );
  await act(async () => Simulate.click(option));

  expect(HttpService.getWithAuth).toHaveBeenCalledWith('/methods/suggestions');
});

const split = {
  id: 'PERCENT_503020',
  name: '50/30/20',
  howItWorks: 'Três partes.',
  helpsWhen: 'Para começar.',
  limitations: 'É referência.',
  effort: 'LOW',
  where: { tool: 'MONTH_PLAN', route: '/api/v1/plan' },
  preset: [
    { kind: 'FIXED', label: 'Necessidades', percent: 50, commitment: false },
    { kind: 'FUTURE', label: 'Poupança e dívidas', percent: 20, commitment: false },
  ],
};

async function openComparison() {
  HttpService.getWithAuth.mockImplementation((url) =>
    Promise.resolve(
      {
        '/methods/suggestions': { ...suggestions, suggestions: [{ method: 'PERCENT_503020', reasons: [] }] },
        '/methods': { methods: [split, ...methods] },
        '/profile': profile,
      }[url]
    )
  );
  await renderPage();
  const card = [...container.querySelectorAll('button, [role="button"]')].find((item) =>
    `${item.textContent} ${item.getAttribute('aria-label')}`.includes('method.compare.title')
  );
  await act(async () => Simulate.click(card));
}

test('two methods side by side, simulating only the one with slices and saving nothing', async () => {
  HttpService.postWithAuth.mockResolvedValue({
    baseline: { negativeDays: 0, minBalance90: 900 },
    scenario: { negativeDays: 3, minBalance90: -120, minDate: '2026-12-20' },
    newMonthlyCommitment: 800,
  });
  await openComparison();

  expect(container.querySelectorAll('th[scope="col"]')).toHaveLength(2);
  expect(text()).toContain('method.catalog.PERCENT_503020.how');
  expect(text()).toContain('method.catalog.PRIORITIES.how');
  expect(text()).toContain('method.compare.efforts.LOW');
  expect(text()).toContain('method.compare.noSlices');
  // The hypothesis is on screen before anything is calculated.
  expect(text()).toContain('method.compare.assumption');
  expect(HttpService.postWithAuth).not.toHaveBeenCalled();

  await act(async () => Simulate.click(buttons('method.compare.simulate')[0]));

  expect(HttpService.postWithAuth).toHaveBeenCalledTimes(1);
  expect(HttpService.postWithAuth).toHaveBeenCalledWith('/plan/fit', {
    slices: [
      { kind: 'FIXED', label: 'Necessidades', percent: 50, commitment: false },
      { kind: 'FUTURE', label: 'Poupança e dívidas', percent: 20, commitment: true },
    ],
  });
  expect(text()).toContain('method.compare.negativeDays{"days":3}');
  expect(text()).toMatch(/method\.compare\.lowest\{"amount":"−R\$\s120,00"/);
  expect(text()).toContain('method.compare.baseline');
  expect(HttpService.putWithAuth).not.toHaveBeenCalled();
});

test('a simulation the server refuses shows why', async () => {
  HttpService.postWithAuth.mockRejectedValue({ response: { data: { code: 'MONTH_PLAN_NEEDS_INCOME' } } });
  await openComparison();

  await act(async () => Simulate.click(buttons('method.compare.simulate')[0]));

  expect(text()).toContain('MONTH_PLAN_NEEDS_INCOME');
  expect(text()).toContain('method.compare.notSimulated');
});
