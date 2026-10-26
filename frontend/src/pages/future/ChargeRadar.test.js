import { act, Simulate } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import ChargeRadar from './ChargeRadar';
import ThemeProvider from '../../theme';
import HttpService from '../../services/HttpService';

jest.mock('../../services/HttpService', () => ({
  getWithAuth: jest.fn(),
  putWithAuth: jest.fn(),
  postWithAuth: jest.fn(),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { language: 'pt' },
  }),
}));

let root;
let container;
const text = () => container.textContent;
const button = (label) => [...container.querySelectorAll('button')].find((item) => item.textContent === label);

const duplicateAlert = {
  transactionId: 11,
  kind: 'POSSIBLE_DUPLICATE',
  confidence: 'HIGH',
  description: 'NETFLIX BRASIL',
  walletName: 'Conta principal',
  institutionName: 'Banco sandbox',
  date: '2026-10-25',
  amount: 39.9,
  relatedTransactionId: 10,
  relatedDate: '2026-10-24',
  baselineAmount: null,
  difference: null,
  occurrences: 2,
  decision: null,
};

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  HttpService.getWithAuth.mockReset();
  HttpService.putWithAuth.mockReset();
  HttpService.postWithAuth.mockReset();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function renderPage() {
  await act(async () => {
    root.render(
      <ThemeProvider>
        <ChargeRadar />
      </ThemeProvider>
    );
  });
}

test('loads the alert with evidence and clearly labels it as a signal, not a fraud verdict', async () => {
  HttpService.getWithAuth.mockResolvedValue([duplicateAlert]);
  await renderPage();

  expect(text()).toContain('NETFLIX BRASIL');
  expect(text()).toContain('future.chargeRadar.duplicateBadge');
  expect(text()).toContain('future.chargeRadar.disclaimer');
  expect(text()).toContain('future.chargeRadar.evidence');
});

test('simulates a hypothetical refund with the deterministic cashflow scenario endpoint', async () => {
  HttpService.getWithAuth.mockResolvedValue([duplicateAlert]);
  HttpService.postWithAuth.mockResolvedValue({
    baseline: { minBalance90: -50, negativeDays: 5 },
    scenario: { minBalance90: 20, negativeDays: 0 },
  });
  await renderPage();

  await act(async () => {
    Simulate.click(button('future.chargeRadar.simulateRefund'));
    await Promise.resolve();
  });

  expect(HttpService.postWithAuth).toHaveBeenCalledWith('/future/scenarios', {
    type: 'REFUND',
    amount: 39.9,
    label: 'Estorno hipotético',
  });
  expect(text()).toContain('future.chargeRadar.simulationTitle');
  expect(text()).toContain('future.chargeRadar.simulationDisclaimer');
  expect(text()).toContain('future.chargeRadar.beforeMin');
  expect(text()).toContain('future.chargeRadar.afterHypotheticalRefund');
});

test('stores the user response and refreshes the radar instead of changing the imported transaction', async () => {
  HttpService.getWithAuth.mockResolvedValueOnce([duplicateAlert]).mockResolvedValueOnce([]);
  HttpService.putWithAuth.mockResolvedValue(undefined);
  await renderPage();

  await act(async () => {
    Simulate.click(button('future.chargeRadar.notAnomalous'));
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(HttpService.putWithAuth).toHaveBeenCalledWith('/future/charge-alerts/11/decision', {
    decision: 'NOT_ANOMALOUS',
  });
  expect(text()).toContain('future.chargeRadar.emptyTitle');
  expect(text()).toContain('future.chargeRadar.decisionSaved.NOT_ANOMALOUS');
});

test('shows a retry action when the alert service is temporarily unavailable', async () => {
  HttpService.getWithAuth.mockRejectedValue(new Error('network unavailable'));
  await renderPage();

  expect(text()).toContain('future.chargeRadar.loadError');
  expect(button('app.retry')).toBeDefined();
});
