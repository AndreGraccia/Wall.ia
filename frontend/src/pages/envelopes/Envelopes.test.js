import { act, Simulate } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import Envelopes from './Envelopes';
import Accuracy from '../future/Accuracy';
import Goals from '../future/Goals';
import { DailyLimitCard, ExitPlanList } from '../../components/future-ui';
import ThemeProvider from '../../theme';
import HttpService from '../../services/HttpService';

jest.mock('../../services/HttpService', () => ({
  getWithAuth: jest.fn(),
  postWithAuth: jest.fn(),
  deleteWithAuth: jest.fn(),
}));
jest.mock('../../context/WalletContext', () => ({ useWallets: jest.fn() }));
jest.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: jest.fn(), closeSnackbar: jest.fn() }) }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, options) => (options?.amount ? `${key}:${options.amount}` : key),
    i18n: { language: 'pt' },
  }),
}));

let root;
let container;
const text = () => container.textContent;
const button = (label) => [...container.querySelectorAll('button')].find((item) => item.textContent === label);

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  jest.clearAllMocks();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function render(element) {
  await act(async () =>
    root.render(
      <MemoryRouter>
        <HelmetProvider>
          <ThemeProvider>{element}</ThemeProvider>
        </HelmetProvider>
      </MemoryRouter>
    )
  );
}

function type(input, value) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, value);
  Simulate.change(input);
}

test('envelopes show what is left without a destination and warn when they exceed the balance', async () => {
  HttpService.getWithAuth.mockResolvedValue({
    items: [{ id: 1, name: 'IPVA', amount: 900 }],
    balance: 700,
    reserved: 900,
    unbacked: 200,
  });
  await render(<Envelopes />);

  expect(text()).toContain('IPVA');
  expect(text()).toMatch(/-R\$\s200,00/);
  expect(text()).toMatch(/envelopes\.unbacked:R\$\s200,00/);
});

test('a new envelope is sent in reais and an amount above the API ceiling is blocked on screen', async () => {
  HttpService.getWithAuth.mockResolvedValue({ items: [], balance: 1000, reserved: 0, unbacked: 0 });
  HttpService.postWithAuth.mockResolvedValue({});
  await render(<Envelopes />);
  const [name, amount] = container.querySelectorAll('input');

  await act(async () => type(name, 'Viagem'));
  await act(async () => type(amount, '2000000'));
  await act(async () => Simulate.submit(container.querySelector('form')));
  // The button stays enabled; the field says why nothing was sent.
  expect(HttpService.postWithAuth).not.toHaveBeenCalled();
  expect(text()).toContain('future.goals.amountInvalid');

  await act(async () => type(amount, '350,50'));
  await act(async () => Simulate.submit(container.querySelector('form')));
  expect(HttpService.postWithAuth).toHaveBeenCalledWith('/future/envelopes', { name: 'Viagem', amount: 350.5 });
});

test('the accuracy card waits honestly, then shows misses next to avoided days', async () => {
  HttpService.getWithAuth.mockResolvedValueOnce({
    since: '2026-09-20',
    firstComparisonOn: '2026-09-27',
    comparisons: 0,
    recent: [],
  });
  await render(<Accuracy />);
  expect(text()).toContain('future.accuracy.waiting');

  act(() => root.unmount());
  root = createRoot(container);
  HttpService.getWithAuth.mockResolvedValueOnce({
    since: '2026-08-01',
    firstComparisonOn: '2026-08-08',
    comparisons: 12,
    meanAbsoluteError: 42.1,
    bias: -30,
    avoided: 2,
    missed: 1,
    recent: [],
  });
  await render(<Accuracy />);
  expect(text()).toMatch(/R\$\s42,10/);
  expect(text()).toMatch(/future\.accuracy\.optimistic:R\$\s30,00/);
  expect(text()).toContain('future.accuracy.missed');
});

test('only a moved bill offers a Pix, and confirming it says nothing was sent', async () => {
  HttpService.postWithAuth.mockResolvedValue({});
  await render(
    <ExitPlanList
      actions={[
        {
          type: 'POSTPONE',
          label: 'Imobiliária',
          amount: 1500,
          from: '2026-10-01',
          to: '2026-10-05',
          resultingLowest: 10,
          solves: true,
        },
        { type: 'CUT_DAILY', amount: 5, newDaily: 20, to: '2026-10-05', resultingLowest: 0, solves: true },
      ]}
    />
  );
  expect(
    [...container.querySelectorAll('button')].filter((item) => item.textContent === 'future.pix.prepare')
  ).toHaveLength(1);

  await act(async () => Simulate.click(button('future.pix.prepare')));
  expect(document.body.textContent).toContain('future.pix.simulated');
  const confirm = [...document.querySelectorAll('button')].find((item) => item.textContent === 'future.pix.confirm');
  await act(async () => Simulate.click(confirm));
  expect(document.body.textContent).toContain('future.pix.done');
  // Only the anonymous interest count is sent; no payment call exists.
  expect(HttpService.postWithAuth.mock.calls).toEqual([
    ['/future/pix-interest', { step: 'PREPARE' }],
    ['/future/pix-interest', { step: 'CONFIRM' }],
  ]);
});

test('the daily limit card separates what the bank lacks, what keeping the envelopes costs and the lowest point', async () => {
  await render(
    <DailyLimitCard
      limit={{
        safeDaily: 0,
        until: '2026-10-05',
        untilIncome: true,
        days: 10,
        bindingDate: '2026-10-03',
        pace: 28.78,
        margin: -28.78,
        shortfall: 804.87,
        reserved: 300,
      }}
      risk={{
        start: '2026-10-03',
        end: '2026-10-04',
        lowestBalance: -792.67,
        lowestDate: '2026-10-03',
        causes: [],
        overdraftCostCap: 4,
      }}
      exitPlan={[{ type: 'CUT_DAILY', amount: 5, newDaily: 20, to: '2026-10-05', resultingLowest: 0, solves: true }]}
      onWhy={() => {}}
    />
  );

  // The hero reads "Faltam / R$ 504,87 / até 05/10, mesmo sem gastar nada".
  expect(text()).toContain('future.hero.shortLead');
  expect(text()).toMatch(/future\.hero\.shortLead\s*R\$\s504,87/);
  expect(text()).toMatch(/future\.limit\.keepEnvelopes:R\$\s804,87/);
  expect(text()).toMatch(/future\.limit\.shortPaceLowest:-R\$\s792,67/);
  expect(text()).toContain('future.limit.bestWay');
  expect(button('future.limit.seeWayOut')).toBeDefined();
});

test('a goal is checked against the projection before it is created', async () => {
  HttpService.getWithAuth.mockResolvedValue([]);
  const summary = (negativeDays) => ({
    minBalance90: negativeDays ? -120 : 80,
    minDate: '2026-10-03',
    firstNegativeDate: negativeDays ? '2026-10-03' : null,
    negativeDays,
  });
  HttpService.postWithAuth.mockResolvedValue({ baseline: summary(0), scenario: summary(3) });
  await render(<Goals onChanged={() => {}} />);
  const [, amount, day] = container.querySelectorAll('input');

  await act(async () => type(amount, '800'));
  await act(async () => type(day, '10'));
  await act(async () => Simulate.click(button('future.goals.checkFit')));

  expect(HttpService.postWithAuth).toHaveBeenCalledWith('/future/scenarios', {
    type: 'SAVINGS',
    amount: 800,
    dayOfMonth: 10,
  });
  expect(text()).toContain('future.goals.fitNo');
  // Changing the amount drops the answer: it was about R$ 800.
  await act(async () => type(amount, '80'));
  expect(text()).not.toContain('future.goals.fitNo');
});
