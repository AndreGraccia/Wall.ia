import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import BillingRadar from './BillingRadar';
import ThemeProvider from '../../theme';
import HttpService from '../../services/HttpService';

jest.mock('../../services/HttpService', () => ({ getWithAuth: jest.fn() }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, options) => (options?.count ? `${key}:${options.count}` : key),
    i18n: { language: 'pt' },
  }),
}));

let root;
let container;
const pageText = () => container.textContent;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  HttpService.getWithAuth.mockReset();
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
            <BillingRadar />
          </ThemeProvider>
        </HelmetProvider>
      </MemoryRouter>
    )
  );
}

test('renders the price-change alert with transaction evidence', async () => {
  HttpService.getWithAuth.mockResolvedValue({
    generatedAt: '2026-10-26T10:00:00Z',
    dataThrough: '2026-10-26',
    bankDataAsOf: '2026-10-26T09:00:00Z',
    bankDataStale: false,
    accounts: 1,
    recurringCount: 1,
    priceIncreaseCount: 1,
    possibleDuplicateCount: 0,
    projectedMonthlyTotal: 49.9,
    items: [
      {
        key: 'out:streaming-plus',
        counterparty: 'Streaming Plus',
        recurring: true,
        priceIncrease: true,
        possibleDuplicate: false,
        confidence: 'HIGH',
        latestAmount: 49.9,
        baselineAmount: 39.9,
        increaseAmount: 10,
        increasePercent: 25.1,
        lastChargeDate: '2026-10-05',
        nextExpectedDate: '2026-11-04',
        occurrences: 3,
        evidence: [{ transactionId: 3, date: '2026-10-05', amount: 49.9, accountName: 'Conta principal', institution: 'Banco' }],
      },
    ],
  });
  await renderPage();

  expect(pageText()).toContain('billingRadar.heading');
  expect(pageText()).toContain('Streaming Plus');
  expect(pageText()).toContain('billingRadar.priceChange');
  expect(pageText()).toContain('billingRadar.evidence');
  expect(pageText()).toContain('Conta principal');
  expect(container.querySelector('a[href="/transactions"]')).not.toBeNull();
});

test('explains that more history is needed and offers Open Finance', async () => {
  HttpService.getWithAuth.mockResolvedValue({
    bankDataStale: false,
    recurringCount: 0,
    priceIncreaseCount: 0,
    possibleDuplicateCount: 0,
    projectedMonthlyTotal: 0,
    items: [],
  });
  await renderPage();

  expect(pageText()).toContain('billingRadar.emptyTitle');
  expect(pageText()).toContain('billingRadar.emptyDescription');
  expect(container.querySelector('a[href="/open-finance"]')).not.toBeNull();
});

test('warns when bank data is stale before the signal list', async () => {
  HttpService.getWithAuth.mockResolvedValue({
    bankDataStale: true,
    recurringCount: 0,
    priceIncreaseCount: 0,
    possibleDuplicateCount: 0,
    projectedMonthlyTotal: 0,
    items: [],
  });
  await renderPage();

  expect(pageText()).toContain('billingRadar.staleTitle');
  expect(pageText().indexOf('billingRadar.staleTitle')).toBeLessThan(pageText().indexOf('billingRadar.emptyTitle'));
});
