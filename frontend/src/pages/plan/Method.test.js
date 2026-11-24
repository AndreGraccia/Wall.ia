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
    preset: [],
  },
  {
    id: 'DEBT_AVALANCHE',
    name: 'Quitação avalanche',
    howItWorks: 'Maior juros primeiro.',
    helpsWhen: 'Duas dívidas.',
    limitations: 'Demora.',
    where: { tool: 'DEBT_PAYOFF', route: '/api/v1/future/debt-payoff' },
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

  await act(async () => Simulate.click(buttons('method.choose')[0]));

  expect(HttpService.putWithAuth).toHaveBeenCalledWith('/profile/method', { method: 'PRIORITIES' });
  expect(text()).toContain('method.chosenNotice');
  expect(text()).toContain('method.chosen');
});
