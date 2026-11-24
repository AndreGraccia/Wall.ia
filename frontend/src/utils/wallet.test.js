import {
  dayLabel,
  errorKey,
  subtractMoney,
  localDate,
  monthLabel,
  money,
  overdraftCostText,
  projectRegularDeposits,
  savingsInAYear,
} from './wallet';

test('projects zero-rate monthly deposits without inventing earnings', () => {
  expect(projectRegularDeposits('100', 1, '0')).toEqual({
    contributed: 1200,
    earnings: 0,
    futureValue: 1200,
  });
});

test('uses the regular deposit formula with deposits at the beginning of each month', () => {
  const annualRateEquivalentToOnePercentMonthly = ((1.01 ** 12 - 1) * 100).toString();
  const result = projectRegularDeposits(100, 1, annualRateEquivalentToOnePercentMonthly);

  expect(result.contributed).toBe(1200);
  expect(result.futureValue).toBeCloseTo(1280.93, 2);
  expect(result.earnings).toBeCloseTo(80.93, 2);
});

test('calendar days from the API keep their day in any timezone', () => {
  // new Date('2026-10-03') is UTC midnight: the 2nd of October in Brazil. localDate must not shift it.
  expect(localDate('2026-10-03').getDate()).toBe(3);
  expect(dayLabel('2026-10-03', 'pt-BR')).toBe('03/10');
  expect(dayLabel('2026-10-03', 'en')).toBe('10/03');
  expect(monthLabel('2026-10', 'pt-BR')).toBe('outubro de 2026');
  expect(dayLabel(null, 'pt-BR')).toBe('—');
});

test('server and client error codes reach their own message', () => {
  expect(errorKey({ response: { status: 400, data: { code: 'INVALID_PERIOD' } } })).toBe('app.errors.INVALID_PERIOD');
  expect(errorKey({ response: { status: 422, data: { code: 'INITIAL_BALANCE_NOT_ALLOWED' } } })).toBe(
    'app.errors.INITIAL_BALANCE_NOT_ALLOWED'
  );
  // A login answer without a token is a contract problem, not "check your network".
  expect(errorKey({ code: 'INVALID_TOKEN' })).toBe('app.errors.INVALID_TOKEN');
  // axios' own codes are not ours: they keep the status/network fallback.
  expect(errorKey({ code: 'ERR_NETWORK' })).toBe('app.errors.network');
  expect(errorKey({ code: 'ERR_BAD_RESPONSE', response: { status: 500 } })).toBe('app.errors.server');
});

test('money differences are exact in cents (no red "-R$ 0,00")', () => {
  expect(0.3 - 0.1 - 0.2).not.toBe(0);
  expect(subtractMoney('0.3', 0.1 + 0.2)).toBe(0);
  expect(subtractMoney('1000.10', '999.99')).toBe(0.11);
});

describe('overdraftCostText', () => {
  const t = (key, values) => `${key} ${JSON.stringify(values || {})}`;
  const risk = { overdraftCostCap: '25.69', overdraftEstimate: null };

  it('says nothing without a cost and only the ceiling without a Banco Central rate', () => {
    expect(overdraftCostText(t, { overdraftCostCap: 0 }, 'pt')).toBe('');
    expect(overdraftCostText(t, risk, 'pt')).toContain('future.limit.cost ');
    const capped = { ...risk, overdraftEstimate: { source: 'LEGAL_CAP', iof: '2.04', total: '27.73' } };
    expect(overdraftCostText(t, capped, 'pt')).toContain('future.limit.costCapIof');
  });

  it("uses the bank's rate with IOF and names where it came from", () => {
    const text = overdraftCostText(
      t,
      {
        ...risk,
        overdraftEstimate: {
          total: '14.28',
          monthlyRate: '2.94',
          source: 'BANK',
          institution: 'BANCO ORIGINAL',
          referenceDate: '2026-09-03',
        },
      },
      'pt'
    );
    expect(text).toContain('future.limit.costEstimate');
    expect(text).toContain('2,94%');
    expect(text).toContain('future.limit.rateSource.BANK');
    expect(text).toContain('03/09');
  });
});

describe('savingsInAYear', () => {
  it('compounds monthly deposits at the CDI and deflates by the IPCA', () => {
    expect(savingsInAYear('200.00', '13.65', '4.22')).toEqual({
      saved: 2400,
      withCdi: 2573.98,
      inTodaysMoney: 2469.76,
    });
  });

  it('with a zero rate the money only adds up', () => {
    expect(savingsInAYear(100, 0, 0)).toEqual({ saved: 1200, withCdi: 1200, inTodaysMoney: 1200 });
  });
});

test('negative amounts use the typographic minus, which cannot break away from "R$"', () => {
  expect(money(-707.72, 'pt-BR').startsWith('\u2212R$')).toBe(true);
  expect(money(707.72, 'pt-BR').startsWith('R$')).toBe(true);
});
