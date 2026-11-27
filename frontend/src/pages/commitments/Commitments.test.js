import { act, Simulate } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import Commitments, { monthDebts, monthlyFromAnnual, overdue } from './Commitments';
import ThemeProvider from '../../theme';
import HttpService from '../../services/HttpService';

jest.mock('../../services/HttpService', () => ({ getWithAuth: jest.fn() }));
jest.mock('../../context/WalletContext', () => ({ useWallets: jest.fn() }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key) => key, i18n: { language: 'pt' } }) }));

test('"try again" clears the error and shows it is loading right away', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  const root = createRoot(container);
  HttpService.getWithAuth.mockRejectedValue({ response: { status: 500 } });
  await act(async () =>
    root.render(
      <MemoryRouter>
        <HelmetProvider>
          <ThemeProvider>
            <Commitments />
          </ThemeProvider>
        </HelmetProvider>
      </MemoryRouter>
    )
  );
  expect(container.textContent).toContain('app.errors.server');

  HttpService.getWithAuth.mockReturnValue(new Promise(() => {}));
  const retry = [...container.querySelectorAll('button')].find((item) => item.textContent === 'app.retry');
  await act(async () => Simulate.click(retry));
  expect(container.textContent).not.toContain('app.errors.server');
  expect(container.querySelector('.MuiSkeleton-root')).not.toBeNull();
  act(() => root.unmount());
});

test('the minimum payment warns about revolving credit and loans show CET and the market reference', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  const root = createRoot(container);
  const commitments = {
    cards: [
      {
        id: 1,
        name: 'Cartão Aurora',
        institution: 'Banco Aurora',
        lastDigits: '1234',
        creditLimit: '5000',
        committedLimit: '1200',
        closingDay: 25,
        dueDay: 5,
        invoices: [],
        nextBillDueDate: '2026-10-05',
        nextBillTotal: '1200.00',
        nextBillMinimum: '180.00',
      },
    ],
    loans: [
      {
        id: 2,
        product: 'Crédito pessoal',
        institution: 'Banco Aurora',
        contractedAmount: '10000',
        outstandingBalance: '6000',
        installmentAmount: '500',
        installmentsTotal: 24,
        installmentsPaid: 12,
        installmentsRemaining: 12,
        annualRate: '26.82',
        cet: '31.5',
      },
    ],
  };
  const market = {
    rates: [
      { modality: 'CARD_REVOLVING', periodStart: '2026-09-04', median: '3.3', bankRate: null },
      { modality: 'PERSONAL_LOAN', periodStart: '2026-09-04', median: '1.8', bankRate: null },
    ],
    indicators: [{ code: 'CDI', referenceDate: '2026-09-23', value: '13.65' }],
  };
  HttpService.getWithAuth
    .mockReset()
    .mockImplementation((url) => Promise.resolve(url === '/market/overview' ? market : commitments));
  await act(async () =>
    root.render(
      <MemoryRouter>
        <HelmetProvider>
          <ThemeProvider>
            <Commitments />
          </ThemeProvider>
        </HelmetProvider>
      </MemoryRouter>
    )
  );

  expect(container.textContent).toContain('commitments.minimum');
  expect(container.textContent).toContain('commitments.revolvingRate');
  expect(container.textContent).toContain('commitments.cet');
  expect(container.textContent).toContain('commitments.marketLoan');
  // Selic/IPCA/CDI are a line inside the rate disclosure, not a section of their own.
  expect(container.textContent).toContain('commitments.indicatorsLine');
  expect(container.textContent).not.toContain('commitments.indicatorsTitle');
  act(() => root.unmount());
});

test('26,82% a year is 2% a month', () => {
  expect(monthlyFromAnnual('26.82')).toBeCloseTo(2, 2);
});

// 26/11: the bank still reports the 25/11 instalment; the December total is the bill on 02/12 plus the 25/12 instalment.
const card = { invoices: [{ status: 'CLOSED', dueDate: '2026-12-02', total: '948.00' }] };
const loan = {
  installmentAmount: '612.48',
  installmentsRemaining: 15,
  nextDueDate: '2026-11-25',
  upcomingDueDate: '2026-12-25',
};

test('the hero adds what is due in the first month with something due, never a date already past', () => {
  const debts = monthDebts([card], [loan]);
  expect(debts.month).toBe('2026-12');
  expect(debts.total).toBe(1560.48);
  expect(debts.parts.map((part) => [part.kind, part.date])).toEqual([
    ['bill', '2026-12-02'],
    ['loan', '2026-12-25'],
  ]);
  // A bill in January does not join an instalment due in December.
  expect(monthDebts([{ invoices: [{ status: 'OPEN', dueDate: '2027-01-02', total: '10' }] }], [loan]).total).toBe(
    612.48
  );
  expect(monthDebts([], [])).toBeNull();
});

test('an instalment date behind the upcoming one is overdue; a paid-off loan is not', () => {
  expect(overdue(loan)).toBe(true);
  expect(overdue({ ...loan, nextDueDate: '2026-12-25' })).toBe(false);
  expect(overdue({ ...loan, installmentsRemaining: 0, upcomingDueDate: null })).toBe(false);
});
