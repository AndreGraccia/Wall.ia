import { act, Simulate } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import Wealth from './Wealth';
import ThemeProvider from '../../theme';
import HttpService from '../../services/HttpService';

jest.mock('../../services/HttpService', () => ({
  getWithAuth: jest.fn(),
  postWithAuth: jest.fn(),
  putWithAuth: jest.fn(),
  deleteWithAuth: jest.fn(),
}));
jest.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: jest.fn() }) }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key, i18n: { language: 'pt' } }),
}));

const EMPTY = {
  today: '2026-11-27',
  netWorth: 0,
  accountsTotal: 0,
  investmentsTotal: 0,
  debtsTotal: 0,
  accounts: [],
  investments: [],
  debts: [],
  evolution: [],
  pixMayRepeatCardBill: false,
};
const FULL = {
  ...EMPTY,
  netWorth: 3600,
  accountsTotal: 1100,
  investmentsTotal: 5000,
  debtsTotal: 2500,
  accounts: [{ id: 1, name: 'Dinheiro', origin: 'LOCAL', balance: 1100, date: '2026-11-27' }],
  investments: [
    {
      id: 5,
      institution: 'Corretora X',
      name: 'Reserva',
      assetClass: 'FUND',
      value: 5000,
      valueDate: '2026-11-20',
      investedAmount: null,
      maturityDate: null,
      note: 'Aporte todo mês',
      history: [
        { date: '2026-10-01', amount: 4000 },
        { date: '2026-11-20', amount: 5000 },
      ],
    },
  ],
  debts: [{ kind: 'CARD', id: 3, name: 'Gold', institution: 'Banco Aurora', amount: 2500, date: '2026-11-25' }],
  evolution: [
    { date: '2026-10-01', amount: 4000 },
    { date: '2026-11-20', amount: 5000 },
  ],
};

let root;
let container;
const text = () => container.textContent;
const button = (label, scope = document) =>
  [...scope.querySelectorAll('button')].find((item) => item.textContent === label);
const input = (name) => container.querySelector(`[name="${name}"]`);

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

async function render() {
  await act(async () =>
    root.render(
      <MemoryRouter>
        <HelmetProvider>
          <ThemeProvider>
            <Wealth />
          </ThemeProvider>
        </HelmetProvider>
      </MemoryRouter>
    )
  );
}

function type(element, value) {
  const prototype = element.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement : window.HTMLInputElement;
  Object.getOwnPropertyDescriptor(prototype.prototype, 'value').set.call(element, value);
  Simulate.change(element);
}

test('shows each part with origin and date, and says it is not advice', async () => {
  HttpService.getWithAuth.mockResolvedValue(FULL);
  await render();

  expect(HttpService.getWithAuth).toHaveBeenCalledWith('/wealth');
  expect(text()).toMatch(/R\$\s3\.600,00/);
  expect(text()).toContain('wealth.disclaimer');
  expect(text()).toContain('Corretora X · wealth.classes.FUND');
  expect(text()).toContain('wealth.localAccount · 27/11/2026');
  expect(text()).toContain('wealth.debtKinds.CARD · Banco Aurora · 25/11/2026');
  expect(text()).toContain('wealth.evolutionTitle');
});

test('with nothing informed the form is open, refuses a bad value and sends a good one', async () => {
  HttpService.getWithAuth.mockResolvedValue(EMPTY);
  HttpService.postWithAuth.mockResolvedValue(FULL);
  await render();
  expect(text()).toContain('wealth.empty');
  const form = () => container.querySelector('form[aria-label="wealth.form.label"]');

  await act(async () => type(input('institution'), 'Corretora X'));
  await act(async () => type(input('name'), 'Reserva'));
  await act(async () => Simulate.submit(form()));
  expect(HttpService.postWithAuth).not.toHaveBeenCalled();
  expect(text()).toContain('wealth.form.amountInvalid');

  await act(async () =>
    Simulate.change(container.querySelector('input[name="assetClass"]'), { target: { value: 'FUND' } })
  );
  await act(async () => type(input('value'), '5000,50'));
  await act(async () => Simulate.submit(form()));

  expect(HttpService.postWithAuth).toHaveBeenCalledWith('/wealth/investments', {
    institution: 'Corretora X',
    name: 'Reserva',
    assetClass: 'FUND',
    investedAmount: null,
    maturityDate: null,
    note: null,
    value: 5000.5,
    valueDate: '2026-11-27',
  });
  expect(text()).toContain('Corretora X');
});

test('a new value is dated, a wrong one can be removed and deleting asks first', async () => {
  HttpService.getWithAuth.mockResolvedValue(FULL);
  HttpService.putWithAuth.mockResolvedValue(FULL);
  HttpService.deleteWithAuth.mockResolvedValue(FULL);
  await render();

  await act(async () => type(input('newValue'), '5100'));
  await act(async () => Simulate.submit(container.querySelector('form[aria-label="wealth.updateValue"]')));
  expect(HttpService.putWithAuth).toHaveBeenCalledWith('/wealth/investments/5/values', {
    value: 5100,
    valueDate: '2026-11-27',
  });

  await act(async () => Simulate.click(button('wealth.removeValue')));
  expect(HttpService.deleteWithAuth).toHaveBeenCalledWith('/wealth/investments/5/values/2026-11-20');

  HttpService.deleteWithAuth.mockClear();
  await act(async () => Simulate.click(button('wealth.remove', container)));
  expect(HttpService.deleteWithAuth).not.toHaveBeenCalled();
  const dialog = document.querySelector('[role="dialog"]');
  await act(async () => Simulate.click(button('wealth.remove', dialog)));
  expect(HttpService.deleteWithAuth).toHaveBeenCalledWith('/wealth/investments/5');
});

test('a failed load offers to try again', async () => {
  HttpService.getWithAuth.mockRejectedValueOnce({ response: { status: 500 } }).mockResolvedValue(EMPTY);
  await render();
  expect(text()).toContain('app.errors.server');

  await act(async () => Simulate.click(button('app.retry')));
  expect(text()).toContain('wealth.empty');
});
