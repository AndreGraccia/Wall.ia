import { amountsHidden, HIDDEN_AMOUNT } from './hiddenAmounts';

export const localeFor = (language) => (language?.startsWith('en') ? 'en-US' : 'pt-BR');
// U+2212 instead of the hyphen: the typographic minus, and no line break between it and "R$" on a phone.
const minus = (text) => text.replace(/^-/, '−');
// "Ocultar saldo" is one choice for the whole app, so every amount on every screen goes through here.
export const money = (value, language) =>
  amountsHidden()
    ? HIDDEN_AMOUNT
    : minus(
        new Intl.NumberFormat(localeFor(language), { style: 'currency', currency: 'BRL' }).format(Number(value) || 0)
      );
/** Axis labels: "-R$ 12 mil" fits where "-R$ 12.345" loses its minus sign off the edge. */
export const compactMoney = (value, language) =>
  amountsHidden()
    ? HIDDEN_AMOUNT
    : new Intl.NumberFormat(localeFor(language), {
        style: 'currency',
        currency: 'BRL',
        notation: 'compact',
        maximumFractionDigits: 1,
      })
        .format(Number(value) || 0)
        .replace(/^-/, '−');
export const dateTime = (value, language) => {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat(localeFor(language), { dateStyle: 'medium', timeStyle: 'short' }).format(date)
    : '—';
};
/** API amounts ("12.30", 12.3) as integer cents, so a difference never leaves -0.000001 behind. */
export const toCents = (value) => Math.round((Number(value) || 0) * 100);
/** a - b computed in cents, back in reais. */
export const subtractMoney = (a, b) => (toCents(a) - toCents(b)) / 100;
export function parseAmount(value) {
  const normalized = String(value).trim().replace(',', '.');
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ''] = normalized.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}
export function projectRegularDeposits(monthlyAmount, years, annualRatePercent) {
  const contribution = Number(String(monthlyAmount).replace(',', '.'));
  const duration = Number(years);
  const rate = Number(String(annualRatePercent).replace(',', '.')) / 100;
  const months = duration * 12;
  if (
    !Number.isFinite(contribution) ||
    contribution < 0 ||
    !Number.isInteger(months) ||
    months <= 0 ||
    !Number.isFinite(rate) ||
    rate < 0 ||
    rate > 1
  )
    return { contributed: 0, earnings: 0, futureValue: 0 };
  const monthlyRate = (1 + rate) ** (1 / 12) - 1;
  const futureValue =
    monthlyRate === 0
      ? contribution * months
      : contribution * (1 + monthlyRate) * (((1 + monthlyRate) ** months - 1) / monthlyRate);
  const contributed = contribution * months;
  return { contributed, earnings: futureValue - contributed, futureValue };
}
export function directionFor(transaction, wallets) {
  const owned = new Set(wallets.map((wallet) => wallet.iban));
  const from = owned.has(transaction.fromWallet?.iban);
  const to = owned.has(transaction.toWallet?.iban);
  // Open Finance imports each side of a move between own accounts as its own deposit/withdrawal; the API pairs them.
  if (transaction.ownAccountMove) return 'internal';
  if (transaction.type?.name === 'Deposit' || transaction.type?.name === 'Initial balance')
    return to ? 'incoming' : 'adjustment';
  if (transaction.type?.name === 'Withdrawal') return from ? 'outgoing' : 'adjustment';
  if (from && to) return 'internal';
  if (from) return 'outgoing';
  if (to) return 'incoming';
  return 'adjustment';
}
export function totalsFor(transactions, wallets) {
  return transactions
    .filter((item) => item.status === 'SUCCESS')
    .reduce(
      (totals, item) => {
        const direction = directionFor(item, wallets);
        if (direction === 'incoming' || direction === 'outgoing')
          totals[direction] += Math.round(Number(item.amount) * 100);
        return totals;
      },
      { incoming: 0, outgoing: 0 }
    );
}
export function normalizeTransactions(response) {
  const rows = Array.isArray(response) ? response : response?.content || [];
  return [...new Map(rows.map((row) => [row.id, row])).values()].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt) || b.id - a.id
  );
}
export function errorKey(error) {
  // Server codes come in the body; INVALID_TOKEN is raised by the client itself (AuthService.login).
  const code = error.response?.data?.code ?? error.code;
  if (code === 'AUTH_RATE_LIMIT') return 'app.errors.authRateLimit';
  if (code === 'INSIGHT_RATE_LIMIT') return 'app.errors.insightRateLimit';
  if (code === 'ASK_RATE_LIMIT') return 'app.errors.askRateLimit';
  if (code === 'OPEN_FINANCE_UNAVAILABLE') return 'app.errors.openFinance';
  if (
    [
      'INVALID_AMOUNT',
      'SAME_WALLET',
      'INVALID_WALLET',
      'IMMUTABLE_WALLET',
      'IDEMPOTENCY_CONFLICT',
      'OPEN_FINANCE_READ_ONLY',
      'OPEN_FINANCE_ALREADY_CONNECTED',
      'OPEN_FINANCE_CONSENT_REQUIRED',
      'OPEN_FINANCE_CONSENT_NOT_FOUND',
      'OPEN_FINANCE_CONSENT_EXPIRED',
      'OPEN_FINANCE_INVALID_DURATION',
      'RECURRENCE_NOT_FOUND',
      'RECURRENCE_CATEGORY_MISMATCH',
      'SCENARIO_NO_CONFIRMED_INCOME',
      'DAILY_SPENDING_NO_HISTORY',
      'CARD_SPENDING_NO_CARD',
      'GOAL_LIMIT',
      'GOAL_NOT_FOUND',
      'ALERT_EMAIL_NOT_VERIFIED',
      'ENVELOPE_LIMIT',
      'ENVELOPE_NOT_FOUND',
      'MANUAL_DEBT_LIMIT',
      'MANUAL_DEBT_NOT_FOUND',
      'PUSH_UNAVAILABLE',
      'PUSH_INVALID_SUBSCRIPTION',
      'PUSH_LIMIT',
      'INVALID_HORIZON',
      'INVALID_PERIOD',
      'INITIAL_BALANCE_NOT_ALLOWED',
      'INVALID_TOKEN',
      'EMAIL_CODE_INVALID',
      'EMAIL_CODE_EXPIRED',
      'EMAIL_CODE_RESEND_WAIT',
      'EMAIL_CODE_DAILY_LIMIT',
      'EMAIL_CODE_ATTEMPTS_EXCEEDED',
      'EMAIL_NOT_VERIFIED',
      'EMAIL_ALREADY_VERIFIED',
      'EMAIL_UNAVAILABLE',
      'EMAIL_VERIFICATION_REQUIRED',
      'USERNAME_TAKEN',
      'INVALID_PASSWORD',
      'MONTH_PLAN_EMPTY',
      'MONTH_PLAN_TOO_MANY_SLICES',
      'MONTH_PLAN_INVALID_PERCENT',
      'MONTH_PLAN_INVALID_LABEL',
      'MONTH_PLAN_SLICE_NOT_COMMITTABLE',
      'MONTH_PLAN_DUPLICATE_SLICE',
      'MONTH_PLAN_INCOMPLETE',
      'MONTH_PLAN_NEEDS_INCOME',
      'METHOD_CHOICE_LIMIT',
      'INVALID_MONTH',
    ].includes(code)
  )
    return `app.errors.${code}`;
  const status = error.response?.status;
  if (status === 401) return 'app.errors.session';
  if (status === 403) return 'app.errors.forbidden';
  if (status === 404) return 'app.errors.notFound';
  if (status === 409) return 'app.errors.conflict';
  if (status === 412) return 'app.errors.balance';
  if (status === 429) return 'app.errors.rateLimit';
  if (status === 400 || status === 422) return 'app.errors.validation';
  return error.response ? 'app.errors.server' : 'app.errors.network';
}

// API dates without time ("2026-10-03") are calendar days. `new Date("2026-10-03")` would be UTC
// midnight, which is the previous day in Brazil, so they are built as local dates.
export function localDate(isoDay) {
  const [year, month, day] = String(isoDay).split('-').map(Number);
  return new Date(year, month - 1, day || 1);
}
export const dayLabel = (isoDay, language, options = { day: '2-digit', month: '2-digit' }) =>
  isoDay ? new Intl.DateTimeFormat(localeFor(language), options).format(localDate(isoDay)) : '—';
/** Monthly rate given in percent (2.94) as "2,94%". */
export const percent = (value, language) =>
  new Intl.NumberFormat(localeFor(language), { style: 'percent', maximumFractionDigits: 2 }).format(
    Number(value) / 100
  );

/**
 * A goal kept for 12 months: what was put aside, what it becomes at 100% of the CDI (same deposit rule as the
 * Insights simulator, before income tax) and what that is worth in today's money after 12-month IPCA.
 */
export function savingsInAYear(monthly, cdiAnnualPercent, ipcaPercent) {
  const year = projectRegularDeposits(monthly, 1, cdiAnnualPercent);
  const cents = (value) => Math.round(value * 100) / 100;
  return {
    saved: cents(year.contributed),
    withCdi: cents(year.futureValue),
    inTodaysMoney: cents(year.futureValue / (1 + Number(ipcaPercent) / 100)),
  };
}

/**
 * What a negative window costs on the overdraft (ADR 0010): the estimate at the bank's or the market rate with
 * IOF, saying where the rate came from, or only the legal-cap ceiling when Banco Central had no rate.
 */
export function overdraftCostText(t, risk, language) {
  if (!risk || !(Number(risk.overdraftCostCap) > 0)) return '';
  const estimate = risk.overdraftEstimate;
  if (!estimate) return t('future.limit.cost', { amount: money(risk.overdraftCostCap, language) });
  // Banco Central's averages can sit above the cap (they are at it in 2026): interest stops at the cap.
  if (estimate.source === 'LEGAL_CAP') {
    return t('future.limit.costCapIof', {
      amount: money(risk.overdraftCostCap, language),
      iof: money(estimate.iof, language),
    });
  }
  return t('future.limit.costEstimate', {
    amount: money(estimate.total, language),
    rate: percent(estimate.monthlyRate, language),
    source: t(`future.limit.rateSource.${estimate.source}`, { institution: estimate.institution }),
    date: dayLabel(estimate.referenceDate, language),
    cap: money(risk.overdraftCostCap, language),
  });
}
export const monthLabel = (isoMonth, language, options = { month: 'long', year: 'numeric' }) =>
  new Intl.DateTimeFormat(localeFor(language), options).format(localDate(`${isoMonth}-01`));
