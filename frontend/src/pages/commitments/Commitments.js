import { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, Chip, Container, LinearProgress, Stack, Tooltip, Typography } from '@mui/material';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import HttpService from '../../services/HttpService';
import { StatBlock } from '../../components/future-ui';
import { Disclosure, ListRow } from '../../components/detail-ui';
import { EmptyState, PageHeading, PageSkeleton } from '../../components/wallet-ui';
import { dayLabel, errorKey, money, monthLabel, percent, subtractMoney, toCents } from '../../utils/wallet';
import DebtPayoff from './DebtPayoff';
import BankDataNotice from '../../components/bank-data';

// The bills that matter now; the instalments of later months fold away.
const SHOWN_INVOICES = 3;
const FULL_DATE = { day: '2-digit', month: 'short', year: 'numeric' };
const sum = (values) => values.reduce((total, value) => total + toCents(value), 0) / 100;
// ponytail: first letter only; CSS capitalize would also give "Outubro De 2026".
const capital = (text) => text.replace(/^./, (c) => c.toUpperCase());
// The bill to pay next: the closed one waiting for its due date, else the first one that will close.
const billToPay = (card) => card.invoices.find((invoice) => invoice.status === 'CLOSED') || card.invoices[0];

/**
 * What leaves for debts in the first month that has something due: the bill to pay of each card and the
 * instalment of each loan whose upcoming due date (the backend's, never one already past) falls in that month.
 * One horizon for the hero instead of three numbers that each meant a different period.
 */
export function monthDebts(cards, loans) {
  const parts = [
    ...cards
      .map(billToPay)
      .filter((bill) => bill?.dueDate && Number(bill.total) > 0)
      .map((bill) => ({ kind: 'bill', amount: bill.total, date: bill.dueDate })),
    ...loans
      .filter((loan) => loan.upcomingDueDate)
      .map((loan) => ({ kind: 'loan', amount: loan.installmentAmount, date: loan.upcomingDueDate })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  if (!parts.length) return null;
  const month = parts[0].date.slice(0, 7);
  const inMonth = parts.filter((part) => part.date.startsWith(month));
  return { month, total: sum(inMonth.map((part) => part.amount)), parts: inMonth };
}

/** The bank keeps an instalment's date until it sees the payment: a date behind the upcoming one is unpaid to us. */
export const overdue = (loan) =>
  Boolean(loan.installmentsRemaining > 0 && loan.nextDueDate && loan.upcomingDueDate !== loan.nextDueDate);

/** Numbers in columns, no boxes (DESIGN.md), on a divider. */
function Columns({ children, sx }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' },
        gap: { xs: 3, md: 4 },
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}
Columns.propTypes = { children: PropTypes.node, sx: PropTypes.object };

/** A thin bar with its number beside it: how much of a whole is used or paid. */
function Meter({ value, label }) {
  return (
    <LinearProgress
      variant="determinate"
      value={Math.max(0, Math.min(100, value))}
      aria-label={label}
      sx={{ height: 4, borderRadius: 999, bgcolor: 'background.neutral' }}
    />
  );
}
Meter.propTypes = { value: PropTypes.number.isRequired, label: PropTypes.string.isRequired };

function Invoice({ invoice }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  return (
    <ListRow
      title={capital(monthLabel(invoice.month, lang))}
      meta={`${t('commitments.dueOn', { date: dayLabel(invoice.dueDate, lang) })}, ${t('commitments.closesOn', {
        date: dayLabel(invoice.closingDate, lang),
      }).toLowerCase()}`}
      value={money(invoice.total, lang)}
      aside={
        <Tooltip title={t(`commitments.invoiceStatusHelp.${invoice.status}`)}>
          <Chip
            size="small"
            label={t(`commitments.invoiceStatus.${invoice.status}`)}
            color={invoice.status === 'CLOSED' ? 'warning' : 'default'}
            variant={invoice.status === 'FUTURE' ? 'outlined' : 'filled'}
          />
        </Tooltip>
      }
      detailLabel={t('commitments.showItemsOf', { month: monthLabel(invoice.month, lang) })}
      detail={
        invoice.lines.length > 0 && (
          <Box sx={{ pl: 2, borderLeft: '2px solid', borderColor: 'divider' }}>
            {invoice.lines.map((line, index) => (
              <Stack
                // Two "UBER *TRIP" on the same day are two lines, not one.
                key={`${line.description}-${line.purchaseDate}-${index}`}
                direction="row"
                spacing={2}
                alignItems="center"
                sx={{ minHeight: 44, py: 0.5 }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" noWrap>
                    {line.description}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('commitments.purchasedOn', { date: dayLabel(line.purchaseDate, lang, FULL_DATE) })}
                    {' · '}
                    {line.installments > 1
                      ? t('commitments.installment', { current: line.installment, total: line.installments })
                      : t('commitments.singlePurchase')}
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                  {money(line.amount, lang)}
                </Typography>
              </Stack>
            ))}
          </Box>
        )
      }
    />
  );
}
Invoice.propTypes = { invoice: PropTypes.object.isRequired };

/** Yearly rate in percent (26.8) to its compound monthly equivalent in percent (1.99). */
export const monthlyFromAnnual = (annual) => ((1 + Number(annual) / 100) ** (1 / 12) - 1) * 100;

function ItemHeading({ title, source }) {
  return (
    <Box>
      <Typography variant="h6" component="h3">
        {title}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {source}
      </Typography>
    </Box>
  );
}
ItemHeading.propTypes = { title: PropTypes.string.isRequired, source: PropTypes.string.isRequired };

function CardSection({ card, revolving }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const used = Number(card.committedLimit);
  const limit = Number(card.creditLimit);
  return (
    <Stack spacing={2} component="article">
      <ItemHeading
        title={`${card.name}${card.lastDigits ? ` · ${t('commitments.cardFinal', { digits: card.lastDigits })}` : ''}`}
        source={t('commitments.source', { institution: card.institution })}
      />
      {/* A zero limit (allowed by V11) would print "250000%"; show only what is used. */}
      {limit > 0 ? (
        <Box sx={{ maxWidth: 520 }}>
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography variant="body2">{t('commitments.limitLabel')}</Typography>
            <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
              {Math.round((used / limit) * 100)}%
            </Typography>
          </Stack>
          <Meter value={(used / limit) * 100} label={t('commitments.limitLabel')} />
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
            {t('commitments.limitUse', { used: money(used, lang), limit: money(limit, lang) })}
          </Typography>
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary">
          {t('commitments.limitUnknown', { used: money(used, lang) })}
        </Typography>
      )}
      {card.nextBillMinimum != null && Number(card.nextBillTotal) > 0 && (
        <Alert severity="warning">
          {t('commitments.minimum', {
            total: money(card.nextBillTotal, lang),
            date: dayLabel(card.nextBillDueDate, lang, FULL_DATE),
            minimum: money(card.nextBillMinimum, lang),
          })}
          {revolving &&
            ` ${t('commitments.revolvingRate', {
              source: revolving.bankRate
                ? t('commitments.revolvingBank', { institution: revolving.bankName })
                : t('commitments.revolvingMarket'),
              rate: percent(revolving.bankRate ?? revolving.median, lang),
              date: dayLabel(revolving.periodStart, lang),
            })}`}
        </Alert>
      )}
      {card.invoices.length > 0 && (
        <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
          {card.invoices.slice(0, SHOWN_INVOICES).map((invoice) => (
            <Invoice key={invoice.month} invoice={invoice} />
          ))}
          {card.invoices.length > SHOWN_INVOICES && (
            <Disclosure
              label={t('commitments.moreInvoices', { count: card.invoices.length - SHOWN_INVOICES })}
              sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 1 }}
            >
              {card.invoices.slice(SHOWN_INVOICES).map((invoice) => (
                <Invoice key={invoice.month} invoice={invoice} />
              ))}
            </Disclosure>
          )}
        </Box>
      )}
    </Stack>
  );
}
CardSection.propTypes = { card: PropTypes.object.isRequired, revolving: PropTypes.object };

function LoanSection({ loan, market, indicators }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const paidShare = (loan.installmentsPaid / (loan.installmentsTotal || 1)) * 100;
  const interestLeft = Number(loan.interestRemaining) > 0;
  return (
    <Stack spacing={2.5} component="article">
      <ItemHeading title={loan.product} source={t('commitments.source', { institution: loan.institution })} />
      <Columns>
        <StatBlock
          compact
          label={t('commitments.remaining')}
          value={money(loan.outstandingBalance, lang)}
          help={t('commitments.installmentsLeft', {
            remaining: loan.installmentsRemaining,
            total: loan.installmentsTotal,
          })}
        />
        <StatBlock
          compact
          label={t('commitments.nextPayment')}
          value={money(loan.installmentAmount, lang)}
          help={
            loan.upcomingDueDate
              ? [
                  dayLabel(loan.upcomingDueDate, lang, FULL_DATE),
                  loan.lastDueDate &&
                    t('commitments.endsOn', {
                      date: dayLabel(loan.lastDueDate, lang, { month: 'short', year: 'numeric' }),
                    }),
                ]
                  .filter(Boolean)
                  .join(' · ')
              : null
          }
        />
        {interestLeft && (
          <StatBlock
            compact
            label={t('commitments.interestLeft')}
            value={money(loan.interestRemaining, lang)}
            help={t('commitments.interestLeftHelp', { count: loan.installmentsRemaining })}
          />
        )}
      </Columns>
      {overdue(loan) && (
        <Typography variant="body2" sx={{ color: 'warning.main' }}>
          {t('commitments.overdue', { date: dayLabel(loan.nextDueDate, lang) })}
        </Typography>
      )}
      <Box sx={{ maxWidth: 520 }}>
        <Meter value={paidShare} label={t('commitments.progressLabel')} />
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
          {t('commitments.progressLabel')}: {loan.installmentsPaid}/{loan.installmentsTotal}
        </Typography>
      </Box>
      {/* What the money costs: the fee transparency investment apps show, turned toward the one who owes. */}
      <Disclosure label={t('commitments.loanDetails')}>
        <Stack spacing={1} sx={{ pl: 2, maxWidth: 680, borderLeft: '2px solid', borderColor: 'divider' }}>
          <Typography variant="body2" color="text.secondary">
            {t('commitments.contracted')}: {money(loan.contractedAmount, lang)}
            {loan.annualRate != null &&
              ` · ${t('commitments.rate')}: ${t('commitments.rateValue', {
                rate: Number(loan.annualRate).toLocaleString(lang, { maximumFractionDigits: 2 }),
              })}`}
          </Typography>
          {loan.cet != null && (
            <Typography variant="body2" color="text.secondary">
              {t('commitments.cet', { rate: Number(loan.cet).toLocaleString(lang, { maximumFractionDigits: 2 }) })}
            </Typography>
          )}
          {market && loan.annualRate != null && (
            <Typography variant="body2" color="text.secondary">
              {t('commitments.marketLoan', {
                rate: percent(monthlyFromAnnual(loan.annualRate), lang),
                median: percent(market.median, lang),
                date: dayLabel(market.periodStart, lang),
              })}
            </Typography>
          )}
          {loan.nextInstallmentInterest != null && (
            <Typography variant="body2" color="text.secondary">
              {t('commitments.costNext', {
                interest: money(loan.nextInstallmentInterest, lang),
                principal: money(subtractMoney(loan.installmentAmount, loan.nextInstallmentInterest), lang),
                installment: money(loan.installmentAmount, lang),
              })}
            </Typography>
          )}
          {interestLeft && (
            <Typography variant="body2" color="text.secondary">
              {t('commitments.costHelp')}
            </Typography>
          )}
          {/* Selic, IPCA and CDI are context for this rate, not numbers of their own at the end of the page. */}
          {indicators.length > 0 && (
            <Typography variant="body2" color="text.secondary">
              {t('commitments.indicatorsLine', {
                items: indicators
                  .map(
                    (indicator) =>
                      `${t(`commitments.indicators.${indicator.code}`, { defaultValue: indicator.code })} ${percent(
                        indicator.value,
                        lang
                      )}`
                  )
                  .join(' · '),
                date: dayLabel(indicators[0].referenceDate, lang),
              })}
            </Typography>
          )}
        </Stack>
      </Disclosure>
    </Stack>
  );
}
LoanSection.propTypes = {
  loan: PropTypes.object.isRequired,
  market: PropTypes.object,
  indicators: PropTypes.array.isRequired,
};

/** The hero: one month, one total, and what makes it up as metadata. */
function MonthHero({ debts }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  return (
    <Box>
      <Typography variant="h6" component="p" color="text.secondary" sx={{ fontWeight: 400 }}>
        {t('commitments.hero.lead', { month: monthLabel(debts.month, lang, { month: 'long' }) })}
      </Typography>
      <Typography variant="h2" component="p" sx={{ my: 0.5 }}>
        {money(debts.total, lang)}
        <Typography component="span" variant="h5" color="text.secondary" sx={{ ml: 1, fontWeight: 500 }}>
          {t('commitments.hero.suffix')}
        </Typography>
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {debts.parts
          .map((part) =>
            t(`commitments.hero.${part.kind}`, { amount: money(part.amount, lang), date: dayLabel(part.date, lang) })
          )
          .join(' · ')}
      </Typography>
    </Box>
  );
}
MonthHero.propTypes = { debts: PropTypes.object.isRequired };

/** A titled group of the page: a divider on top, the title, then its items with room between them. */
function Group({ id, title, children }) {
  return (
    <Box component="section" aria-labelledby={id} sx={{ pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
      <Typography id={id} variant="h5" component="h2" sx={{ mb: 3 }}>
        {title}
      </Typography>
      <Stack spacing={5}>{children}</Stack>
    </Box>
  );
}
Group.propTypes = { id: PropTypes.string.isRequired, title: PropTypes.string.isRequired, children: PropTypes.node };

export default function Commitments() {
  const { t } = useTranslation();
  const [state, setState] = useState({ loading: true, error: null, data: null });
  // Banco Central references are extra context: without them the page is still whole.
  const [market, setMarket] = useState(null);

  const load = useCallback(async () => {
    // "Try again" must visibly start over, not look dead until the answer arrives.
    setState((previous) => ({ ...previous, loading: true, error: null }));
    try {
      const data = await HttpService.getWithAuth('/future/commitments');
      setState({ loading: false, error: null, data });
    } catch (failure) {
      setState({ loading: false, error: errorKey(failure), data: null });
    }
  }, []);

  useEffect(() => {
    load();
    HttpService.getWithAuth('/market/overview')
      .then(setMarket)
      .catch(() => setMarket(null));
  }, [load]);

  const { data } = state;
  const rate = (modality) => market?.rates?.find((quote) => quote.modality === modality) || null;
  const empty = data && !data.cards.length && !data.loans.length;
  const debts = data ? monthDebts(data.cards, data.loans) : null;
  return (
    <>
      <Helmet>
        <title>{t('commitments.pageTitle')}</title>
      </Helmet>
      <Container maxWidth="lg">
        <PageHeading title={t('commitments.heading')} />
        {state.loading && !data && <PageSkeleton rows={3} />}
        {data && <BankDataNotice bankData={data.bankData} sx={{ mb: 3 }} />}
        {state.error && (
          <Alert
            severity="error"
            action={
              <Button color="inherit" onClick={load}>
                {t('app.retry')}
              </Button>
            }
          >
            {t(state.error)}
          </Alert>
        )}
        {empty && (
          <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', mb: 4 }}>
            <EmptyState
              icon="card"
              title={t('commitments.empty')}
              description={t('commitments.emptyHelp')}
              action={
                <Button component={RouterLink} to="/open-finance" variant="contained">
                  {t('openFinance.connectShort')}
                </Button>
              }
            />
          </Box>
        )}
        {data && !empty && (
          <Stack spacing={{ xs: 5, md: 6 }} aria-busy={state.loading}>
            {debts && <MonthHero debts={debts} />}
            {data.cards.length > 0 && (
              <Group id="cards-title" title={t('commitments.cardsTitle')}>
                {data.cards.map((card) => (
                  <CardSection key={card.id} card={card} revolving={rate('CARD_REVOLVING')} />
                ))}
              </Group>
            )}
            {data.loans.length > 0 && (
              <Group id="loans-title" title={t('commitments.loansTitle')}>
                {data.loans.map((loan) => (
                  <LoanSection
                    key={loan.id}
                    loan={loan}
                    market={rate('PERSONAL_LOAN')}
                    indicators={market?.indicators || []}
                  />
                ))}
              </Group>
            )}
          </Stack>
        )}
        {/* Open Finance does not send "Pix no crédito" (B14): it can be typed even without a bank connected. */}
        {data && (
          <Box sx={{ mt: { xs: 5, md: 6 } }}>
            <DebtPayoff manualDebts={data.manualDebts || []} onChange={load} />
          </Box>
        )}
      </Container>
    </>
  );
}
