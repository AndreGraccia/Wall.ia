import { act, Simulate } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import DebtPayoff from './DebtPayoff';
import ThemeProvider from '../../theme';
import HttpService from '../../services/HttpService';

jest.mock('../../services/HttpService', () => ({
  getWithAuth: jest.fn(),
  postWithAuth: jest.fn(),
  deleteWithAuth: jest.fn(),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, options) => (options ? `${key}:${JSON.stringify(options)}` : key),
    i18n: { language: 'pt' },
  }),
}));

let root;
let container;

beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  root = createRoot(container);
  HttpService.getWithAuth.mockReset();
  HttpService.postWithAuth.mockReset();
  HttpService.deleteWithAuth.mockReset();
  await act(async () =>
    root.render(
      <ThemeProvider>
        <DebtPayoff />
      </ThemeProvider>
    )
  );
});
afterEach(() => act(() => root.unmount()));

const input = () => container.querySelector('input');
const field = (name) => container.querySelector(`input[name="${name}"]`);
const submit = () => container.querySelector('button[type="submit"]');
// The Pix form is folded into one row until the person opens it.
const openPixForm = async () => {
  expect(field('pixLabel')).toBeNull();
  const row = [...container.querySelectorAll('button')].find((b) => b.textContent === 'commitments.pix.addTitle');
  await act(async () => Simulate.click(row));
};

test('it compares the two orders with paying only the instalments and lists the cheapest order', async () => {
  HttpService.getWithAuth.mockResolvedValue({
    loansWithoutRate: 1,
    plan: {
      baseline: { months: 24, interest: 900, order: [] },
      avalanche: {
        months: 15,
        interest: 520,
        order: [
          { id: '2', label: 'Cartão parcelado - Banco Aurora', month: 9 },
          { id: '1', label: 'Crédito pessoal - Banco Aurora', month: 15 },
        ],
      },
      snowball: { months: 15, interest: 560, order: [] },
      avalancheSaves: 380,
      snowballSaves: 340,
    },
  });

  await act(async () => Simulate.change(input(), { target: { value: '200,50' } }));
  await act(async () => Simulate.submit(submit().closest('form')));

  expect(HttpService.getWithAuth).toHaveBeenCalledWith('/future/debt-payoff?extra=200.5');
  const text = container.textContent;
  expect(text).toContain('commitments.payoff.baseline');
  expect(text).toContain('"count":24');
  expect(text).toContain('commitments.payoff.saves');
  expect(text).toContain('Cartão parcelado - Banco Aurora');
  expect(text).toContain('commitments.payoff.withoutRate');
  expect(text).toContain('commitments.payoff.note');
});

test('an amount it cannot read is refused before any request', async () => {
  await act(async () => Simulate.change(input(), { target: { value: 'dez reais' } }));

  expect(submit().disabled).toBe(true);
  expect(container.textContent).toContain('commitments.payoff.extraInvalid');
  expect(HttpService.getWithAuth).not.toHaveBeenCalled();
});

test('a Pix on credit is registered with its monthly CET and the page reloads (B14)', async () => {
  const onChange = jest.fn();
  HttpService.postWithAuth.mockResolvedValue({ id: 9 });
  await act(async () =>
    root.render(
      <ThemeProvider>
        <DebtPayoff manualDebts={[]} onChange={onChange} />
      </ThemeProvider>
    )
  );

  await openPixForm();
  await act(async () => Simulate.change(field('pixLabel'), { target: { value: 'Banco Aurora' } }));
  await act(async () => Simulate.change(field('pixBalance'), { target: { value: '1000,00' } }));
  await act(async () => Simulate.change(field('pixInstallment'), { target: { value: '100' } }));
  await act(async () => Simulate.change(field('pixCet'), { target: { value: '8,5' } }));
  await act(async () => Simulate.submit(field('pixLabel').closest('form')));

  expect(HttpService.postWithAuth).toHaveBeenCalledWith('/future/manual-debts', {
    kind: 'PIX_CREDIT',
    label: 'Banco Aurora',
    outstandingBalance: 1000,
    installmentAmount: 100,
    monthlyCet: 8.5,
  });
  expect(onChange).toHaveBeenCalled();
});

test('a Pix on credit without a CET is refused before any request: the plan never guesses a rate', async () => {
  await openPixForm();
  await act(async () => Simulate.change(field('pixLabel'), { target: { value: 'Banco Aurora' } }));
  await act(async () => Simulate.change(field('pixBalance'), { target: { value: '1000' } }));
  await act(async () => Simulate.change(field('pixInstallment'), { target: { value: '100' } }));
  await act(async () => Simulate.change(field('pixCet'), { target: { value: '45' } }));

  const add = field('pixLabel').closest('form').querySelector('button[type="submit"]');
  expect(add.disabled).toBe(true);
  expect(container.textContent).toContain('commitments.pix.cetInvalid');
  expect(HttpService.postWithAuth).not.toHaveBeenCalled();
});

test('a typed Pix on credit shows that it was typed and is estimated, and can be removed', async () => {
  const onChange = jest.fn();
  HttpService.deleteWithAuth.mockResolvedValue(undefined);
  const debt = {
    id: 5,
    kind: 'PIX_CREDIT',
    label: 'Banco Aurora',
    outstandingBalance: 1000,
    installmentAmount: 100,
    monthlyCet: 8,
    annualCet: 151.817,
    origin: 'MANUAL',
    certainty: 'ESTIMATED',
  };
  await act(async () =>
    root.render(
      <ThemeProvider>
        <DebtPayoff manualDebts={[debt]} onChange={onChange} />
      </ThemeProvider>
    )
  );

  expect(container.textContent).toContain('commitments.pix.typedByYou');
  expect(container.textContent).toContain('future.certainty.ESTIMATED');
  const remove = [...container.querySelectorAll('button')].find((b) => b.textContent === 'commitments.pix.remove');
  await act(async () => Simulate.click(remove));
  expect(HttpService.deleteWithAuth).toHaveBeenCalledWith('/future/manual-debts/5');
  expect(onChange).toHaveBeenCalled();
});

test('in the payoff order a typed debt is marked as typed by the person', async () => {
  HttpService.getWithAuth.mockResolvedValue({
    loansWithoutRate: 0,
    plan: {
      baseline: { months: 12, interest: 400, order: [] },
      avalanche: {
        months: 8,
        interest: 200,
        order: [
          { id: 'pix-5', label: 'Pix no crédito - Banco Aurora', month: 4, origin: 'MANUAL' },
          { id: '1', label: 'Crédito pessoal - Banco Aurora', month: 8, origin: 'OPEN_FINANCE' },
        ],
      },
      snowball: { months: 8, interest: 210, order: [] },
      avalancheSaves: 200,
      snowballSaves: 190,
    },
  });
  await act(async () => Simulate.submit(submit().closest('form')));

  const items = [...container.querySelectorAll('li')].map((li) => li.textContent);
  expect(items[0]).toContain('commitments.pix.typedByYou');
  expect(items[1]).not.toContain('commitments.pix.typedByYou');
});
