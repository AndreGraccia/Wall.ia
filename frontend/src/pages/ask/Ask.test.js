import { act, Simulate } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import Ask from './Ask';
import ThemeProvider from '../../theme';
import HttpService from '../../services/HttpService';

jest.mock('../../services/HttpService', () => ({ postWithAuth: jest.fn() }));
jest.mock('../../context/WalletContext', () => ({ useWallets: jest.fn() }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key) => key, i18n: { language: 'pt' } }) }));

let root;
let container;
const text = () => container.textContent;
const button = (label) => [...container.querySelectorAll('button')].find((item) => item.textContent === label);
const chip = (label) => [...container.querySelectorAll('.MuiChip-root')].find((item) => item.textContent === label);

const purchase = {
  intent: 'PURCHASE',
  amount: 4000,
  installments: 10,
  method: 'CARD',
  verdict: 'RISK',
  balance: 2555.61,
  before: { minBalance90: -564.87, negativeDays: 2 },
  after: { minBalance90: -964.87, negativeDays: 6 },
  newMonthlyCommitment: 400,
  cardName: 'Aurora Card Platinum',
};

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
async function renderPage() {
  await act(async () =>
    root.render(
      <MemoryRouter>
        <HelmetProvider>
          <ThemeProvider>
            <Ask />
          </ThemeProvider>
        </HelmetProvider>
      </MemoryRouter>
    )
  );
}

test('a suggested question is sent as typed and the answer shows the verdict with its numbers and source', async () => {
  HttpService.postWithAuth.mockResolvedValue(purchase);
  await renderPage();

  await act(async () => Simulate.click(chip('ask.s2')));

  expect(HttpService.postWithAuth).toHaveBeenCalledWith('/future/ask', { question: 'ask.s2' });
  expect(text()).toContain('ask.verdict.RISK');
  expect(text()).toContain('ask.purchaseMin');
  expect(text()).toContain('ask.purchaseDays');
  expect(text()).toContain('ask.purchaseMonthly');
  expect(text()).toContain('ask.source');
});

test('an unknown question explains what can be asked and claims no source', async () => {
  HttpService.postWithAuth.mockResolvedValue({ intent: 'UNKNOWN', installments: 1 });
  await renderPage();

  const input = container.querySelector('input');
  await act(async () => Simulate.change(input, { target: { value: 'previsão do tempo?' } }));
  await act(async () => Simulate.submit(container.querySelector('form')));

  expect(HttpService.postWithAuth).toHaveBeenCalledWith('/future/ask', { question: 'previsão do tempo?' });
  expect(text()).toContain('ask.unknown');
  expect(text()).not.toContain('ask.source');
});

test('an empty question is never sent: the button stays enabled and points at the field instead', async () => {
  await renderPage();

  expect(button('ask.send').disabled).toBe(false);
  await act(async () => Simulate.submit(container.querySelector('form')));
  expect(HttpService.postWithAuth).not.toHaveBeenCalled();
  const input = container.querySelector('input');
  expect(document.activeElement).toBe(input);
  expect(input.getAttribute('aria-invalid')).toBe('true');
  expect(text()).toContain('ask.emptyQuestion');

  await act(async () => Simulate.change(input, { target: { value: 'quanto gastei?' } }));
  expect(text()).not.toContain('ask.emptyQuestion');
});

const daily = (spendingLimit) => ({ intent: 'DAILY_LIMIT', installments: 1, spendingLimit });

test('the daily limit is not stated without a confirmed income, as on the Future page', async () => {
  HttpService.postWithAuth.mockResolvedValue(
    daily({ safeDaily: 85, until: '2026-10-24', untilIncome: false, shortfall: 0, reserved: 0 })
  );
  await renderPage();
  await act(async () => Simulate.click(chip('ask.s1')));

  expect(text()).toContain('ask.dailyNotReady');
  expect(text()).not.toContain('ask.dailyOk');
});

test('the shortfall excludes the envelopes, like the Future card', async () => {
  const i18next = jest.requireMock('react-i18next');
  const spy = jest.spyOn(i18next, 'useTranslation').mockReturnValue({
    t: (key, values) => (values?.amount ? `${key}|${values.amount}` : key),
    i18n: { language: 'pt' },
  });
  HttpService.postWithAuth.mockResolvedValue(
    daily({ safeDaily: 0, until: '2026-10-05', untilIncome: true, shortfall: 800, reserved: 500 })
  );
  await renderPage();
  await act(async () => Simulate.click(chip('ask.s1')));

  expect(text()).toMatch(/ask\.dailyShort\|R\$\s?300,00/);
  spy.mockRestore();
});
