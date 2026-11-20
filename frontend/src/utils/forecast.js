import { directionFor, toCents as cents } from './wallet';

/**
 * Same rule as the Future page: with nothing confirmed, a limit or a "free" amount would read as
 * "you have R$ X" when the engine knows nothing yet, so the three screens hide it.
 *
 * `sources` comes with the overview. The Ask answer has no sources, so there the limit itself says
 * whether a confirmed income bounds it (`untilIncome`).
 */
// ponytail: Ask falls back to untilIncome; if the backend adds `sources` to the answer, pass it and the rule is identical.
export function forecastReady({ sources, limit } = {}) {
  if (sources) return Number(sources.confirmedRecurrences) > 0;
  return Boolean(limit?.untilIncome);
}

/**
 * The headline of the daily limit, shared by the Future card and the Ask answer so the same data never
 * yields two different "missing" amounts.
 *
 * `shortfall` is computed on balance minus envelopes; without the envelopes the bank lacks exactly
 * `shortfall - reserved` (see SpendingLimit). When that is zero, only the envelopes are uncovered.
 *
 * @returns {{kind: 'canSpend'|'short'|'shortEnvelopes', amount: number, withEnvelopes: number, reserved: number}}
 */
export function limitSummary(limit) {
  const reserved = cents(limit?.reserved);
  const withEnvelopes = cents(limit?.shortfall);
  const realShort = Math.max(withEnvelopes - reserved, 0);
  const base = { withEnvelopes: withEnvelopes / 100, reserved: reserved / 100 };
  if (withEnvelopes > 0 && realShort > 0) return { ...base, kind: 'short', amount: realShort / 100 };
  if (withEnvelopes > 0) return { ...base, kind: 'shortEnvelopes', amount: withEnvelopes / 100 };
  return { ...base, kind: 'canSpend', amount: Number(limit?.safeDaily) || 0 };
}

const isoDay = (date) =>
  [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');

/**
 * The solid part of the balance chart: end-of-day balances for the `days` days before `today`, walked
 * backwards from the balance now through the settled statement (incoming adds, outgoing subtracts; moves
 * between the user's own wallets cancel out). Empty when there is no statement to walk.
 */
export function balanceHistory({ transactions = [], wallets = [], today, balance, days = 14 }) {
  if (!today || !transactions.length) return [];
  const net = {};
  transactions
    .filter((item) => item.status === 'SUCCESS' && item.createdAt)
    .forEach((item) => {
      const direction = directionFor(item, wallets);
      if (direction !== 'incoming' && direction !== 'outgoing') return;
      const day = isoDay(new Date(item.createdAt));
      net[day] = (net[day] || 0) + (direction === 'incoming' ? 1 : -1) * cents(item.amount);
    });
  const [year, month, dayOfMonth] = today.split('-').map(Number);
  const cursor = new Date(year, month - 1, dayOfMonth);
  // End of yesterday = now minus what already moved today.
  let end = cents(balance) - (net[today] || 0);
  const points = [];
  for (let step = 0; step < days; step += 1) {
    cursor.setDate(cursor.getDate() - 1);
    const day = isoDay(cursor);
    points.unshift({ date: day, balance: end / 100 });
    end -= net[day] || 0;
  }
  return points;
}
