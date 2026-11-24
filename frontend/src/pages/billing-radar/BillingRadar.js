import { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, Chip, Container, Stack, Typography } from '@mui/material';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import HttpService from '../../services/HttpService';
import ChargeRadar from '../future/ChargeRadar';
import BankDataNotice from '../../components/bank-data';
import { StatBlock } from '../../components/future-ui';
import { ListRow } from '../../components/detail-ui';
import { EmptyState, PageHeading, PageSkeleton } from '../../components/wallet-ui';
import { dayLabel, errorKey, money } from '../../utils/wallet';

function percent(value, language) {
  return new Intl.NumberFormat(language === 'pt' ? 'pt-BR' : 'en-US', { maximumFractionDigits: 1 }).format(
    Number(value || 0)
  );
}

/** What returning to the old price does to the 90-day projection: two numbers side by side, then the difference. */
function Impact({ impact, language }) {
  const { t } = useTranslation();
  return (
    <Box role="status" sx={{ mt: 2, pl: 2, borderLeft: '2px solid', borderColor: 'secondary.main' }}>
      <Typography variant="subtitle2" component="p">
        {t('billingRadar.impactHeading')}
      </Typography>
      <Typography variant="caption" color="text.secondary" component="p">
        {t('billingRadar.impactDates', {
          first: dayLabel(impact.firstExpectedDate, language),
          last: dayLabel(impact.lastExpectedDate, language),
          count: impact.projectedCharges,
        })}
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 3,
          mt: 2,
          maxWidth: 560,
        }}
      >
        {[
          ['keepCurrentPrice', impact.keepCurrentPrice],
          ['returnToPreviousPrice', impact.returnToPreviousPrice],
        ].map(([key, scenario]) => (
          <StatBlock
            key={key}
            compact
            label={t(`billingRadar.${key}`)}
            value={money(scenario.minBalance90, language)}
            negative={Number(scenario.minBalance90) < 0}
            help={`${t('billingRadar.impactMinBalanceLabel')} · ${t('billingRadar.impactNegativeDays', {
              count: scenario.negativeDays,
            })}`}
          />
        ))}
      </Box>
      <Typography variant="body2" sx={{ mt: 2, fontWeight: 600 }}>
        {t('billingRadar.impactDifference', {
          amount: money(impact.possibleSavings90Days, language),
          count: impact.projectedCharges,
        })}
      </Typography>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.5, fontStyle: 'italic' }}>
        {t('billingRadar.hypotheticalNote')}
      </Typography>
    </Box>
  );
}
Impact.propTypes = { impact: PropTypes.object.isRequired, language: PropTypes.string.isRequired };

/** One signal: a 56 px line (who, what was seen, last amount) and, under it, the reason and the evidence. */
function RadarItem({ item, language }) {
  const { t } = useTranslation();
  const [impact, setImpact] = useState(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [impactError, setImpactError] = useState(null);
  const evidence = Array.isArray(item.evidence) ? item.evidence : [];

  const simulatePriceReversion = async () => {
    setImpactLoading(true);
    setImpactError(null);
    try {
      const result = await HttpService.postWithAuth(
        `/billing-radar/${encodeURIComponent(item.key)}/simulate-price-reversion`,
        {}
      );
      setImpact(result);
    } catch (failure) {
      setImpactError(errorKey(failure));
    } finally {
      setImpactLoading(false);
    }
  };

  const seals = (
    <Stack direction="row" flexWrap="wrap" justifyContent="flex-end" sx={{ gap: 0.5 }}>
      {item.priceIncrease && <Chip size="small" color="warning" label={t('billingRadar.increase')} />}
      {item.possibleDuplicate && <Chip size="small" color="warning" label={t('billingRadar.duplicate')} />}
    </Stack>
  );

  // "Banco Aurora · Banco Aurora • 8392" says the bank twice: the account name already carries it.
  const account = (entry) =>
    entry.accountName?.startsWith(entry.institution || '\u0000')
      ? entry.accountName
      : [entry.institution, entry.accountName].filter(Boolean).join(' · ') || '—';
  const flagged = item.priceIncrease || item.possibleDuplicate;

  return (
    <ListRow
      titleComponent="h3"
      title={item.counterparty}
      meta={
        item.recurring && item.nextExpectedDate
          ? t('billingRadar.nextChargeShort', { date: dayLabel(item.nextExpectedDate, language) })
          : t('billingRadar.lastChargeOn', { date: dayLabel(item.lastChargeDate, language) })
      }
      value={money(item.latestAmount, language)}
      aside={seals}
      detailLabel={t('billingRadar.evidenceFor', { name: item.counterparty })}
      detail={
        <Box sx={{ pl: 2, maxWidth: 720, borderLeft: '2px solid', borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary" component="p">
            {t('billingRadar.evidence')} · {t(`billingRadar.confidence.${item.confidence}`)}
          </Typography>
          {evidence.length > 0 && (
            <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
              {evidence.map((entry) => (
                <Stack
                  component="li"
                  key={`${entry.transactionId}-${entry.date}`}
                  direction="row"
                  alignItems="center"
                  spacing={2}
                  sx={{ minHeight: 40 }}
                >
                  <Typography variant="body2" color="text.secondary" sx={{ width: 48, flexShrink: 0 }}>
                    {dayLabel(entry.date, language)}
                  </Typography>
                  <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>
                    {account(entry)}
                  </Typography>
                  <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                    {money(entry.amount, language)}
                  </Typography>
                </Stack>
              ))}
            </Box>
          )}
          <Button component={RouterLink} to="/transactions" size="small" color="inherit" sx={{ mt: 0.5, ml: -1 }}>
            {t('billingRadar.openHistory')}
          </Button>
        </Box>
      }
    >
      {flagged && (
        <Stack spacing={1.5} sx={{ maxWidth: 720 }}>
          {item.priceIncrease && (
            <Typography variant="body2">
              {t('billingRadar.priceChange', {
                before: money(item.baselineAmount, language),
                after: money(item.latestAmount, language),
                delta: money(item.increaseAmount, language),
                percent: percent(item.increasePercent, language),
              })}{' '}
              <Box component="span" sx={{ color: 'warning.main', fontWeight: 600 }}>
                {t('billingRadar.annualizedImpact', {
                  amount: money(Number(item.increaseAmount || 0) * 12, language),
                })}
              </Box>
            </Typography>
          )}
          {item.possibleDuplicate && (
            <Typography variant="body2">
              {t('billingRadar.duplicateHint', {
                count: item.duplicateCount,
                date: dayLabel(item.duplicateDate, language),
                amount: money(item.duplicateAmount, language),
              })}
            </Typography>
          )}
          {item.priceIncrease && (
            <Box>
              <Button onClick={simulatePriceReversion} disabled={impactLoading} variant="outlined" size="small">
                {impactLoading ? t('billingRadar.impactLoading') : t('billingRadar.simulatePriceReversion')}
              </Button>
            </Box>
          )}
          {impactError && (
            <Alert severity="error" role="alert">
              {t(impactError)}
            </Alert>
          )}
          {impact && <Impact impact={impact} language={language} />}
        </Stack>
      )}
    </ListRow>
  );
}
RadarItem.propTypes = {
  item: PropTypes.object.isRequired,
  language: PropTypes.string.isRequired,
};

// The radar exposes transaction evidence and estimates; financial decisions remain with the user.
export default function BillingRadar() {
  const { t, i18n } = useTranslation();
  const [state, setState] = useState({ loading: true, error: null, report: null });

  const load = useCallback(async () => {
    setState((previous) => ({ ...previous, loading: true, error: null }));
    try {
      const report = await HttpService.getWithAuth('/billing-radar');
      setState({ loading: false, error: null, report });
    } catch (failure) {
      setState((previous) => ({ ...previous, loading: false, error: errorKey(failure) }));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const { report } = state;
  const { language } = i18n;
  const hasItems = report?.items?.length > 0;
  return (
    <>
      <Helmet>
        <title>{t('billingRadar.pageTitle')}</title>
      </Helmet>
      <Container maxWidth="lg">
        <PageHeading title={t('billingRadar.heading')} />

        {state.loading && !report && <PageSkeleton rows={4} />}
        {state.error && (
          <Alert
            severity="error"
            action={
              <Button color="inherit" onClick={load} disabled={state.loading}>
                {t('app.retry')}
              </Button>
            }
            sx={{ mb: 3 }}
          >
            {t(state.error)}
          </Alert>
        )}

        {report && (
          <Stack spacing={{ xs: 4, md: 5 }} aria-busy={state.loading}>
            {report.bankData && <BankDataNotice bankData={report.bankData} />}

            {hasItems ? (
              <>
                {/* The answer: what the recurring charges add up to, then the three counters in columns. */}
                <Box>
                  <Typography variant="h6" component="p" color="text.secondary" sx={{ fontWeight: 400 }}>
                    {t('billingRadar.hero.lead')}
                  </Typography>
                  <Typography variant="h2" component="p" sx={{ my: 0.5 }}>
                    {money(report.projectedMonthlyTotal, language)}
                    <Typography component="span" variant="h5" color="text.secondary" sx={{ ml: 1, fontWeight: 500 }}>
                      {t('billingRadar.hero.perMonth')}
                    </Typography>
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('billingRadar.summary.monthlyHelp')}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    gap: { xs: 2, md: 4 },
                    pt: 3,
                    borderTop: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <StatBlock compact label={t('billingRadar.summary.recurring')} value={report.recurringCount} />
                  <StatBlock compact label={t('billingRadar.summary.increases')} value={report.priceIncreaseCount} />
                  <StatBlock
                    compact
                    label={t('billingRadar.summary.duplicates')}
                    value={report.possibleDuplicateCount}
                  />
                </Box>
                <Box component="section" aria-labelledby="radar-signals">
                  <Typography id="radar-signals" variant="h6" component="h2" sx={{ mb: 1 }}>
                    {t('billingRadar.signalsTitle')}
                  </Typography>
                  <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
                    {report.items.map((item) => (
                      <RadarItem key={item.key} item={item} language={language} />
                    ))}
                  </Box>
                </Box>
              </>
            ) : (
              <Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                <EmptyState
                  icon="history"
                  title={t('billingRadar.emptyTitle')}
                  description={t('billingRadar.emptyDescription')}
                  action={
                    <Button component={RouterLink} to="/open-finance" variant="contained">
                      {t('billingRadar.connect')}
                    </Button>
                  }
                />
              </Box>
            )}

            <Box sx={{ pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
              <ChargeRadar />
            </Box>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ maxWidth: 720 }}>
              {t('billingRadar.disclaimer')}
            </Typography>
          </Stack>
        )}
      </Container>
    </>
  );
}
