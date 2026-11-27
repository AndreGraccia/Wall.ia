import { balanceHistory, forecastReady, limitBreakdown, limitSummary, paceWarning } from './forecast';

test('the bank shortfall excludes the envelopes, in cents', () => {
  expect(limitSummary({ safeDaily: 0, shortfall: '800.10', reserved: '500.00' })).toEqual({
    kind: 'short',
    amount: 300.1,
    withEnvelopes: 800.1,
    reserved: 500,
  });
});

test('a shortfall made only of envelopes says so instead of "missing even without spending"', () => {
  expect(limitSummary({ safeDaily: 0, shortfall: 200, reserved: 500 })).toMatchObject({
    kind: 'shortEnvelopes',
    amount: 200,
  });
});

test('without shortfall the headline is the safe daily amount', () => {
  expect(limitSummary({ safeDaily: '42.5', shortfall: 0, reserved: 0 })).toMatchObject({
    kind: 'canSpend',
    amount: 42.5,
  });
  // float noise must not become a shortfall
  expect(limitSummary({ safeDaily: 10, shortfall: 0.1 + 0.2 - 0.3, reserved: 0 }).kind).toBe('canSpend');
});

test('nothing confirmed means no limit to show, on every screen', () => {
  expect(forecastReady({ sources: { confirmedRecurrences: 0 } })).toBe(false);
  expect(forecastReady({ sources: { confirmedRecurrences: 2 } })).toBe(true);
  expect(forecastReady({ limit: { untilIncome: false } })).toBe(false);
  expect(forecastReady({ limit: { untilIncome: true } })).toBe(true);
  expect(forecastReady()).toBe(false);
});

test('the history walks back from the balance now through the settled statement', () => {
  const wallets = [{ iban: 'A' }];
  const row = (createdAt, amount, to) => ({
    status: 'SUCCESS',
    createdAt,
    amount,
    type: { name: 'Transfer' },
    ...(to ? { toWallet: { iban: 'A' } } : { fromWallet: { iban: 'A' } }),
  });
  const history = balanceHistory({
    wallets,
    today: '2026-11-20',
    balance: 1000,
    days: 3,
    transactions: [row('2026-11-20T10:00:00', 100, true), row('2026-11-19T10:00:00', 50.5, false)],
  });
  // end of 19/11 = 1000 - 100 (today's income); end of 18/11 = 900 + 50,50 (the 19/11 spend undone)
  expect(history).toEqual([
    { date: '2026-11-17', balance: 950.5 },
    { date: '2026-11-18', balance: 950.5 },
    { date: '2026-11-19', balance: 900 },
  ]);
  expect(balanceHistory({ transactions: [], today: '2026-11-20', balance: 1 })).toEqual([]);
});

// The live case of the audit (26/11): R$ 15,37 per day until 04/12, but R$ 27,40 per day goes negative on 02/12.
const limit = { safeDaily: 15.37, until: '2026-12-04', days: 7, pace: 27.4, shortfall: 0, reserved: 0 };
const risk = { start: '2026-12-02', end: '2026-12-03' };

test('the hero warns when the usual pace goes negative before the next income, and only then', () => {
  expect(paceWarning(limit, risk)).toEqual({ pace: 27.4, date: '2026-12-02' });
  expect(paceWarning(limit, null)).toBeNull();
  expect(paceWarning(limit, { start: '2026-12-10' })).toBeNull();
  expect(paceWarning({ ...limit, pace: null }, risk)).toBeNull();
  // Already short even without spending: the hero says it, no second warning.
  expect(paceWarning({ ...limit, safeDaily: 0, shortfall: 50 }, risk)).toBeNull();
});

test('balance plus what comes in minus what has a destination, before the limit ends', () => {
  const overview = {
    balance: 2555.61,
    spendingLimit: { ...limit, reserved: 10 },
    projection: {
      days: [{ date: '2026-11-26' }, { date: '2026-12-26' }],
      events: [
        { date: '2026-11-28', amount: 100.1, category: 'OTHER_INCOME' },
        { date: '2026-12-01', amount: -1500, category: 'RENT' },
        { date: '2026-12-02', amount: -948, category: 'CARD_INVOICE' },
        { date: '2026-12-03', amount: -50, category: 'DAILY_SPENDING' },
        { date: '2026-12-04', amount: 4200, category: 'SALARY' },
      ],
    },
  };
  const sum = limitBreakdown(overview);
  expect(sum).toMatchObject({ balance: 2555.61, incoming: 100.1, committed: 2458, left: 197.71 });
  expect(sum.balance + sum.incoming - sum.committed).toBeCloseTo(sum.left, 2);
  // An income past the projected days: no sum rather than a wrong one.
  expect(limitBreakdown({ ...overview, spendingLimit: { ...limit, until: '2027-01-05' } })).toBeNull();
});
