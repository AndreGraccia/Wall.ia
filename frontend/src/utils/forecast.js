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

/**
 * The limit assumes everyday spending stays at the limit; the projection uses the usual pace. When that pace
 * goes below zero before the limit's end, the hero has to say so, or "no day negative" reads as a promise.
 * Not for `short`: there the hero already says money is missing even without spending.
 *
 * @returns {{pace: number, date: string} | null}
 */
export function paceWarning(limit, risk) {
  if (!limit || !risk || limitSummary(limit).kind === 'short') return null;
  if (limit.pace === null || limit.pace === undefined) return null;
  if (risk.start >= limit.until) return null;
  return { pace: Number(limit.pace), date: risk.start };
}

/**
 * The sum behind the hero, so it can be redone by hand: balance now, plus what comes in, minus what already
 * has a destination (envelopes included), from today to the day before `limit.until`. Same base as the
 * limit (SpendingLimit): every projected event except everyday spending in the account.
 * Null when the limit runs past the projected days (an income 31 to 45 days away on the 30-day view).
 */
// ponytail: folded CARD_SPENDING lands at the horizon end, after `until`; if the API ever spreads it per day, it counts here as is.
export function limitBreakdown(overview) {
  const limit = overview?.spendingLimit;
  const projection = overview?.projection;
  if (!limit || !projection?.days.length) return null;
  const today = projection.days[0].date;
  if (limit.until > projection.days[projection.days.length - 1].date) return null;
  let incoming = 0;
  let outgoing = cents(limit.reserved);
  projection.events
    .filter((event) => event.category !== 'DAILY_SPENDING' && event.date >= today && event.date < limit.until)
    .forEach((event) => {
      const amount = cents(event.amount);
      if (amount > 0) incoming += amount;
      else outgoing -= amount;
    });
  const balance = cents(overview.balance);
  return {
    until: limit.until,
    days: limit.days,
    balance: balance / 100,
    incoming: incoming / 100,
    committed: outgoing / 100,
    left: (balance + incoming - outgoing) / 100,
  };
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
