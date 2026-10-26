import { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, AlertTitle, Box, Button, Card, Chip, Container, Grid, Stack, Typography } from '@mui/material';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import HttpService from '../../services/HttpService';
import ChargeRadar from '../future/ChargeRadar';
import { EmptyState, PageHeading, PageSkeleton, WalletIcon } from '../../components/wallet-ui';
import { dayLabel, errorKey, money } from '../../utils/wallet';

function StatCard({ label, value, detail }) {
  return (
    <Card sx={{ p: 2.5, height: '100%' }}>
      <Typography variant="overline" color="text.secondary" component="p">
        {label}
      </Typography>
      <Typography variant="h5" component="p" sx={{ mt: 0.5 }}>
        {value}
      </Typography>
      {detail && (
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.75 }}>
          {detail}
        </Typography>
      )}
    </Card>
  );
}
StatCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  detail: PropTypes.string,
};

function percent(value, language) {
  return new Intl.NumberFormat(language === 'pt' ? 'pt-BR' : 'en-US', { maximumFractionDigits: 1 }).format(
    Number(value || 0)
  );
}

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
  return (
    <Card component="article" sx={{ p: { xs: 2, md: 3 } }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ md: 'flex-start' }}
        justifyContent="space-between"
        spacing={2}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="h6" component="h2" sx={{ overflowWrap: 'anywhere' }}>
            {item.counterparty}
          </Typography>
          <Stack direction="row" flexWrap="wrap" sx={{ mt: 1, gap: 1 }}>
            {item.recurring && <Chip size="small" label={t('billingRadar.recurring')} />}
            {item.priceIncrease && <Chip size="small" color="warning" label={t('billingRadar.increase')} />}
            {item.possibleDuplicate && (
              <Chip size="small" color="warning" variant="outlined" label={t('billingRadar.duplicate')} />
            )}
            <Chip size="small" variant="outlined" label={t(`billingRadar.confidence.${item.confidence}`)} />
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            {t('billingRadar.lastCharge', {
              amount: money(item.latestAmount, language),
              date: dayLabel(item.lastChargeDate, language),
            })}
          </Typography>
          {item.priceIncrease && (
            <Stack spacing={1} sx={{ mt: 2 }}>
              <Alert severity="warning">
                {t('billingRadar.priceChange', {
                  before: money(item.baselineAmount, language),
                  after: money(item.latestAmount, language),
                  delta: money(item.increaseAmount, language),
                  percent: percent(item.increasePercent, language),
                })}
              </Alert>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {t('billingRadar.annualizedImpact', {
                  amount: money(Number(item.increaseAmount || 0) * 12, language),
                })}
              </Typography>
              <Button
                onClick={simulatePriceReversion}
                disabled={impactLoading}
                variant="contained"
                size="small"
                sx={{ alignSelf: 'flex-start' }}
              >
                {impactLoading ? t('billingRadar.impactLoading') : t('billingRadar.simulatePriceReversion')}
              </Button>
              {impactError && (
                <Alert severity="error">
                  {t(impactError)}
                </Alert>
              )}
            </Stack>
          )}
          {item.possibleDuplicate && (
            <Alert severity="info" sx={{ mt: 2 }}>
              {t('billingRadar.duplicateHint', {
                count: item.duplicateCount,
                date: dayLabel(item.duplicateDate, language),
                amount: money(item.duplicateAmount, language),
              })}
            </Alert>
          )}
          {item.recurring && item.nextExpectedDate && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {t('billingRadar.nextCharge', { date: dayLabel(item.nextExpectedDate, language) })}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('billingRadar.nextChargeHelp')}
              </Typography>
            </Box>
          )}
        </Box>
        <Button component={RouterLink} to="/transactions" variant="outlined" startIcon={<WalletIcon name="history" />}>
          {t('billingRadar.openHistory')}
        </Button>
      </Stack>

      {evidence.length > 0 && (
        <Box sx={{ mt: 2.5 }}>
          <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }}>
            {t('billingRadar.evidence')}
          </Typography>
          <Box sx={{ overflowX: 'auto' }}>
            <Box
              component="table"
              sx={{
                width: '100%',
                minWidth: 320,
                borderCollapse: 'collapse',
                '& th': { textAlign: 'left', fontSize: 12, color: 'text.secondary', fontWeight: 500 },
                '& th, & td': { py: 1, px: 1, borderBottom: '1px solid', borderColor: 'divider' },
                '& td': { fontSize: 13 },
                '& td:last-child, & th:last-child': { textAlign: 'right', whiteSpace: 'nowrap' },
              }}
            >
              <thead>
                <tr>
                  <th scope="col">{t('billingRadar.date')}</th>
                  <th scope="col">{t('billingRadar.account')}</th>
                  <th scope="col">{t('billingRadar.amount')}</th>
                </tr>
              </thead>
              <tbody>
                {evidence.map((entry) => (
                  <tr key={`${entry.transactionId}-${entry.date}`}>
                    <td>{dayLabel(entry.date, language)}</td>
                    <td>{[entry.institution, entry.accountName].filter(Boolean).join(' · ') || '—'}</td>
                    <td>{money(entry.amount, language)}</td>
                  </tr>
                ))}
              </tbody>
            </Box>
          </Box>
        </Box>
      )}
      {impact && (
        <Box sx={{ mt: 2.5 }}>
          <Alert severity="info">
            <Typography variant="subtitle1" component="p" sx={{ fontWeight: 700 }}>
              {t('billingRadar.impactHeading')}
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {t('billingRadar.impactDates', {
                first: dayLabel(impact.firstExpectedDate, language),
                last: dayLabel(impact.lastExpectedDate, language),
                count: impact.projectedCharges,
              })}
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {t('billingRadar.hypotheticalNote')}
            </Typography>
          </Alert>
          <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
            <Grid item xs={12} md={6}>
              <Card variant="outlined" sx={{ p: 2, height: '100%' }}>
                <Typography variant="subtitle2">{t('billingRadar.keepCurrentPrice')}</Typography>
                <Typography variant="h6" sx={{ mt: 0.5 }}>
                  {t('billingRadar.impactMinBalance', {
                    amount: money(impact.keepCurrentPrice.minBalance90, language),
                  })}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('billingRadar.impactNegativeDays', { count: impact.keepCurrentPrice.negativeDays })}
                </Typography>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card variant="outlined" sx={{ p: 2, height: '100%' }}>
                <Typography variant="subtitle2">{t('billingRadar.returnToPreviousPrice')}</Typography>
                <Typography variant="h6" sx={{ mt: 0.5 }}>
                  {t('billingRadar.impactMinBalance', {
                    amount: money(impact.returnToPreviousPrice.minBalance90, language),
                  })}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('billingRadar.impactNegativeDays', { count: impact.returnToPreviousPrice.negativeDays })}
                </Typography>
              </Card>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {t('billingRadar.impactDifference', {
                  amount: money(impact.possibleSavings90Days, language),
                  count: impact.projectedCharges,
                })}
              </Typography>
            </Grid>
          </Grid>
        </Box>
      )}
    </Card>
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
  return (
    <>
      <Helmet>
        <title>{t('billingRadar.pageTitle')}</title>
      </Helmet>
      <Container maxWidth="lg">
        <PageHeading title={t('billingRadar.heading')} description={t('billingRadar.description')} />

        {state.loading && !report && <PageSkeleton rows={3} />}
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
          <>
            {report.bankDataStale && (
              <Alert severity="warning" sx={{ mb: 3 }}>
                <AlertTitle>{t('billingRadar.staleTitle')}</AlertTitle>
                {t('billingRadar.staleDescription')}
                <Button component={RouterLink} to="/open-finance" size="small" sx={{ ml: 1 }}>
                  {t('billingRadar.refreshConnection')}
                </Button>
              </Alert>
            )}

            <Box sx={{ mb: 3 }}>
              <ChargeRadar />
            </Box>

            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6} md={3}>
                <StatCard label={t('billingRadar.summary.recurring')} value={report.recurringCount} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <StatCard label={t('billingRadar.summary.increases')} value={report.priceIncreaseCount} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <StatCard label={t('billingRadar.summary.duplicates')} value={report.possibleDuplicateCount} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <StatCard
                  label={t('billingRadar.summary.monthly')}
                  value={money(report.projectedMonthlyTotal, language)}
                  detail={t('billingRadar.summary.monthlyHelp')}
                />
              </Grid>
            </Grid>

            {report.items?.length ? (
              <Stack spacing={2}>
                {report.items.map((item) => (
                  <RadarItem key={item.key} item={item} language={language} />
                ))}
              </Stack>
            ) : (
              <Card sx={{ p: 1 }}>
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
              </Card>
            )}
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 3, maxWidth: 850 }}>
              {t('billingRadar.disclaimer')}
            </Typography>
          </>
        )}
      </Container>
    </>
  );
}
