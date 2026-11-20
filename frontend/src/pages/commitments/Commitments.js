import { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Collapse,
  Container,
  Grid,
  LinearProgress,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import HttpService from '../../services/HttpService';
import { StatBlock } from '../../components/future-ui';
import { EmptyState, PageHeading, PageSkeleton, SectionCard } from '../../components/wallet-ui';
import { dayLabel, errorKey, money, monthLabel, percent, subtractMoney } from '../../utils/wallet';
import DebtPayoff from './DebtPayoff';
import BankDataNotice from '../../components/bank-data';

const FULL_DATE = { day: '2-digit', month: 'short', year: 'numeric' };

function Invoice({ invoice }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const lang = i18n.language;
  return (
    <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ px: 3, py: 2 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="subtitle2">
              {/* ponytail: first letter only; CSS capitalize would also give "Outubro De 2026". */}
              {monthLabel(invoice.month, lang).replace(/^./, (c) => c.toUpperCase())}
            </Typography>
            <Tooltip title={t(`commitments.invoiceStatusHelp.${invoice.status}`)}>
              <Chip
                size="small"
                label={t(`commitments.invoiceStatus.${invoice.status}`)}
                color={invoice.status === 'CLOSED' ? 'warning' : 'default'}
                variant={invoice.status === 'FUTURE' ? 'outlined' : 'filled'}
              />
            </Tooltip>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {t('commitments.dueOn', { date: dayLabel(invoice.dueDate, lang) })} ·{' '}
            {t('commitments.closesOn', { date: dayLabel(invoice.closingDate, lang) })}
          </Typography>
        </Box>
        <Typography variant="subtitle1" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {money(invoice.total, lang)}
        </Typography>
      </Stack>
      <Button
        size="small"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        sx={{ mx: 2, mb: 1, color: 'text.secondary' }}
      >
        {t(open ? 'commitments.hideItems' : 'commitments.showItems')}
      </Button>
      <Collapse in={open} unmountOnExit>
        <Box sx={{ px: 3, pb: 2 }}>
          {invoice.lines.map((line, index) => (
            <Stack
              // Two "UBER *TRIP" on the same day are two lines, not one.
              key={`${line.description}-${line.purchaseDate}-${index}`}
              direction="row"
              spacing={2}
              alignItems="center"
              sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" noWrap>
                  {line.description}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('commitments.purchasedOn', { date: dayLabel(line.purchaseDate, lang, FULL_DATE) })}
                </Typography>
              </Box>
              <Chip
                size="small"
                variant="outlined"
                label={
                  line.installments > 1
                    ? t('commitments.installment', { current: line.installment, total: line.installments })
                    : t('commitments.singlePurchase')
                }
              />
              <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums', minWidth: 96, textAlign: 'right' }}>
                {money(line.amount, lang)}
              </Typography>
            </Stack>
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}
Invoice.propTypes = { invoice: PropTypes.object.isRequired };

/** Yearly rate in percent (26.8) to its compound monthly equivalent in percent (1.99). */
export const monthlyFromAnnual = (annual) => ((1 + Number(annual) / 100) ** (1 / 12) - 1) * 100;

function CardSection({ card, revolving }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const used = Number(card.committedLimit);
  const limit = Number(card.creditLimit);
  const next = card.invoices.find((invoice) => invoice.status !== 'CLOSED') || card.invoices[0];
  return (
    <SectionCard
      title={`${card.name}${card.lastDigits ? ` · ${t('commitments.cardFinal', { digits: card.lastDigits })}` : ''}`}
    >
      <Box sx={{ px: 3, pb: 3 }}>
        <Typography variant="caption" color="text.secondary">
          {t('commitments.source', { institution: card.institution })}
        </Typography>
        {next && Number(next.total) > 0 && (
          <Alert severity="info" sx={{ mt: 2 }}>
            {t('commitments.nextInvoiceHighlight', {
              amount: money(next.total, lang),
              month: monthLabel(next.month, lang),
            })}
          </Alert>
        )}
        {card.nextBillMinimum != null && Number(card.nextBillTotal) > 0 && (
          <Alert severity="warning" sx={{ mt: 2 }}>
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
        {/* A zero limit (allowed by V11) would print "250000%"; show only what is used. */}
        {limit > 0 ? (
          <Box sx={{ mt: 2 }}>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2">{t('commitments.limitLabel')}</Typography>
              <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {Math.round((used / limit) * 100)}%
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={Math.min(100, (used / limit) * 100)}
              aria-label={t('commitments.limitLabel')}
              sx={{ mt: 1, height: 8, borderRadius: 4, bgcolor: 'background.neutral' }}
            />
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
              {t('commitments.limitUse', { used: money(used, lang), limit: money(limit, lang) })}
            </Typography>
          </Box>
        ) : (
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 2 }}>
            {t('commitments.limitUnknown', { used: money(used, lang) })}
          </Typography>
        )}
      </Box>
      {card.invoices.map((invoice) => (
        <Invoice key={invoice.month} invoice={invoice} />
      ))}
    </SectionCard>
  );
}
CardSection.propTypes = { card: PropTypes.object.isRequired, revolving: PropTypes.object };

function LoanSection({ loan, market }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const paidShare = (loan.installmentsPaid / (loan.installmentsTotal || 1)) * 100;
  return (
    <Card sx={{ p: 3 }}>
      <Typography variant="h6" component="h3">
        {loan.product}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {t('commitments.source', { institution: loan.institution })}
      </Typography>
      <Grid container spacing={3} sx={{ mt: 0.5 }}>
        <Grid item xs={12} sm={6}>
          <StatBlock
            label={t('commitments.remaining')}
            value={money(loan.outstandingBalance, lang)}
            help={t('commitments.installmentsLeft', {
              remaining: loan.installmentsRemaining,
              total: loan.installmentsTotal,
            })}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <StatBlock
            label={t('commitments.nextPayment')}
            value={money(loan.installmentAmount, lang)}
            help={
              loan.nextDueDate
                ? [
                    dayLabel(loan.nextDueDate, lang, FULL_DATE),
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
        </Grid>
      </Grid>
      <LinearProgress
        variant="determinate"
        value={paidShare}
        aria-label={t('commitments.progressLabel')}
        sx={{ mt: 3, height: 8, borderRadius: 4, bgcolor: 'background.neutral' }}
      />
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={0.5} sx={{ mt: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {t('commitments.progressLabel')}: {loan.installmentsPaid}/{loan.installmentsTotal}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t('commitments.contracted')}: {money(loan.contractedAmount, lang)}
          {loan.annualRate != null &&
            ` · ${t('commitments.rate')}: ${t('commitments.rateValue', {
              rate: Number(loan.annualRate).toLocaleString(lang, { maximumFractionDigits: 2 }),
            })}`}
        </Typography>
      </Stack>
      {loan.cet != null && (
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.5 }}>
          {t('commitments.cet', { rate: Number(loan.cet).toLocaleString(lang, { maximumFractionDigits: 2 }) })}
        </Typography>
      )}
      {market && loan.annualRate != null && (
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.5 }}>
          {t('commitments.marketLoan', {
            rate: percent(monthlyFromAnnual(loan.annualRate), lang),
            median: percent(market.median, lang),
            date: dayLabel(market.periodStart, lang),
          })}
        </Typography>
      )}
      {/* What the money costs: the fee transparency investment apps show, turned toward the one who owes. */}
      {(loan.nextInstallmentInterest != null || Number(loan.interestRemaining) > 0) && (
        <Box sx={{ mt: 2.5, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Typography variant="overline" color="text.secondary" component="p">
            {t('commitments.costTitle')}
          </Typography>
          {loan.nextInstallmentInterest != null && (
            <Typography variant="body2">
              {t('commitments.costNext', {
                interest: money(loan.nextInstallmentInterest, lang),
                principal: money(subtractMoney(loan.installmentAmount, loan.nextInstallmentInterest), lang),
                installment: money(loan.installmentAmount, lang),
              })}
            </Typography>
          )}
          {Number(loan.interestRemaining) > 0 && (
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {t('commitments.costRemaining', {
                interest: money(loan.interestRemaining, lang),
                count: loan.installmentsRemaining,
              })}
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.5 }}>
            {t('commitments.costHelp')}
          </Typography>
        </Box>
      )}
    </Card>
  );
}
LoanSection.propTypes = { loan: PropTypes.object.isRequired, market: PropTypes.object };

export default function Commitments() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
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
  return (
    <>
      <Helmet>
        <title>{t('commitments.pageTitle')}</title>
      </Helmet>
      <Container maxWidth="lg">
        <PageHeading title={t('commitments.heading')} description={t('commitments.description')} />
        {state.loading && !data && <PageSkeleton rows={2} />}
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
          <Card>
            <EmptyState
              icon="bank"
              title={t('commitments.empty')}
              description={t('commitments.emptyHelp')}
              action={
                <Button component={RouterLink} to="/open-finance" variant="contained">
                  {t('openFinance.connectShort')}
                </Button>
              }
            />
          </Card>
        )}
        {data && !empty && (
          <Stack spacing={4}>
            {data.cards.length > 0 && (
              <Box component="section">
                <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
                  {t('commitments.cardsTitle')}
                </Typography>
                <Stack spacing={3}>
                  {data.cards.map((card) => (
                    <CardSection key={card.id} card={card} revolving={rate('CARD_REVOLVING')} />
                  ))}
                </Stack>
              </Box>
            )}
            {data.loans.length > 0 && (
              <Box component="section">
                <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
                  {t('commitments.loansTitle')}
                </Typography>
                <Stack spacing={3}>
                  {data.loans.map((loan) => (
                    <LoanSection key={loan.id} loan={loan} market={rate('PERSONAL_LOAN')} />
                  ))}
                </Stack>
              </Box>
            )}
            {market?.indicators?.length > 0 && (
              <Card component="section" aria-labelledby="bcb-indicators" sx={{ p: 3 }}>
                <Typography id="bcb-indicators" variant="h6" component="h2">
                  {t('commitments.indicatorsTitle')}
                </Typography>
                <Grid container spacing={2} sx={{ mt: 0.5 }}>
                  {market.indicators.map((indicator) => (
                    <Grid item xs={12} sm={4} key={indicator.code}>
                      <StatBlock
                        label={t(`commitments.indicators.${indicator.code}`, { defaultValue: indicator.code })}
                        value={percent(indicator.value, lang)}
                        help={t('commitments.indicatorDate', {
                          date: dayLabel(indicator.referenceDate, lang, FULL_DATE),
                        })}
                      />
                    </Grid>
                  ))}
                </Grid>
              </Card>
            )}
          </Stack>
        )}
        {/* Open Finance does not send "Pix no crédito" (B14): it can be typed even without a bank connected. */}
        {data && (
          <Box sx={{ mt: 4 }}>
            <DebtPayoff manualDebts={data.manualDebts || []} onChange={load} />
          </Box>
        )}
      </Container>
    </>
  );
}
