import { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Container,
  IconButton,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { useWallets } from '../../context/WalletContext';
import { EmptyState, PageHeading, WalletIcon } from '../../components/wallet-ui';
import { DailyLimitCard, EventRow } from '../../components/future-ui';
import ProjectionChart from '../../components/projection-chart';
import BankDataNotice from '../../components/bank-data';
import AuthService from '../../services/AuthService';
import HttpService from '../../services/HttpService';
import { dayLabel, errorKey, monthLabel, money } from '../../utils/wallet';
import { balanceHistory, forecastReady } from '../../utils/forecast';
import { HIDDEN_AMOUNT, useHiddenAmounts } from '../../utils/hiddenAmounts';

/**
 * The month so far, under the number of the day (proposta de André Graccia, ADR 0021): income, spending and leisure
 * plus investment, in columns without boxes. Each one opens the screen that explains it.
 */
export function MonthTotals({ hidden }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [state, setState] = useState({ loading: true, error: null, flow: null });
  const load = useCallback(async () => {
    setState((previous) => ({ ...previous, loading: true, error: null }));
    try {
      setState({ loading: false, error: null, flow: await HttpService.getWithAuth('/cash-flow') });
    } catch (failure) {
      setState({ loading: false, error: errorKey(failure), flow: null });
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  if (state.error)
    return (
      <Stack direction="row" alignItems="center" flexWrap="wrap" sx={{ columnGap: 1 }}>
        <Typography variant="body2" color="text.secondary">
          {t('dashboard.monthError')}
        </Typography>
        <Button size="small" onClick={load}>
          {t('app.retry')}
        </Button>
      </Stack>
    );
  const columns = [
    ['monthIncome', 'income', '/cash-flow?tab=income'],
    ['monthSpending', 'spending', '/cash-flow'],
    ['monthLeisure', 'leisureAndInvestment', '/plan'],
  ];
  const home = state.flow?.home;
  return (
    <Box component="section" aria-labelledby="dashboard-month">
      <Typography id="dashboard-month" variant="body2" color="text.secondary" component="h2" sx={{ m: 0, mb: 1 }}>
        {t('dashboard.monthTotals', {
          month: state.flow ? monthLabel(state.flow.month, lang, { month: 'long' }) : '…',
        })}
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          columnGap: { xs: 2, md: 4 },
          pt: 1.5,
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        {columns.map(([label, field, to]) => (
          <ButtonBase
            key={field}
            component={RouterLink}
            to={to}
            sx={{
              display: 'block',
              textAlign: 'left',
              minWidth: 0,
              py: 0.5,
              borderRadius: '12px',
              '&:hover .month-label': { color: 'text.primary', textDecoration: 'underline' },
              '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'secondary.main', outlineOffset: 2 },
            }}
          >
            <Typography
              className="month-label"
              variant="body2"
              color="text.secondary"
              component="span"
              sx={{ display: 'block' }}
            >
              {t(`dashboard.${label}`)}
            </Typography>
            {home ? (
              <Typography
                component="span"
                sx={{
                  display: 'block',
                  mt: 0.5,
                  typography: { xs: 'subtitle1', md: 'h5' },
                  fontWeight: { xs: 600, md: 600 },
                  fontVariantNumeric: 'tabular-nums',
                  overflowWrap: 'anywhere',
                  color: field === 'income' && Number(home.income) > 0 && !hidden ? 'success.main' : 'text.primary',
                }}
              >
                {hidden ? HIDDEN_AMOUNT : money(home[field], lang)}
              </Typography>
            ) : (
              <Skeleton width="80%" height={32} />
            )}
          </ButtonBase>
        ))}
      </Box>
    </Box>
  );
}
MonthTotals.propTypes = { hidden: PropTypes.bool };

/**
 * Início (docs/brand/DESIGN.md): a short greeting with the number of the day, a compact 30-day chart, the
 * next 5 commitments and two shortcuts. Everything else has its own screen.
 */
export default function Dashboard() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { transactions, wallets } = useWallets() || {};
  const user = AuthService.getCurrentUser();
  const [state, setState] = useState({ loading: true, error: null, overview: null });
  const [hidden, toggleHidden] = useHiddenAmounts();

  const load = useCallback(async () => {
    setState((previous) => ({ ...previous, loading: true, error: null }));
    try {
      setState({ loading: false, error: null, overview: await HttpService.getWithAuth('/future/overview?horizon=30') });
    } catch (failure) {
      setState({ loading: false, error: errorKey(failure), overview: null });
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const { overview } = state;
  const projection = overview?.projection;
  const today = projection?.days[0]?.date;
  const history = useMemo(
    () => balanceHistory({ transactions, wallets, today, balance: overview?.balance, days: 7 }),
    [transactions, wallets, today, overview?.balance]
  );
  const sources = overview?.sources;
  const noData =
    sources && !sources.confirmedRecurrences && !sources.pendingQuestions && !sources.cards && !sources.loans;
  const ready = forecastReady({ sources });
  const upcoming = (projection?.events || []).filter((event) => Number(event.amount) < 0).slice(0, 5);
  const shortcuts = (
    <>
      <Button component={RouterLink} to="/ask" variant="outlined">
        {t('navigation.ask')}
      </Button>
      <Button component={RouterLink} to="/future#simulator" variant="outlined">
        {t('dashboard.simulate')}
      </Button>
    </>
  );

  return (
    <>
      <Helmet>
        <title>{t('dashboard.pageTitle')}</title>
      </Helmet>
      <Container maxWidth="lg">
        <PageHeading
          title={t('app.greeting', { name: user?.firstName || t('app.you') })}
          action={
            <Tooltip title={t(hidden ? 'app.showBalance' : 'app.hideBalance')}>
              <IconButton
                aria-label={t(hidden ? 'app.showBalance' : 'app.hideBalance')}
                aria-pressed={hidden}
                onClick={toggleHidden}
              >
                <WalletIcon name={hidden ? 'eyeOff' : 'eye'} sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
          }
        />

        {state.loading && !overview && (
          <Stack spacing={4} role="status" aria-busy="true" aria-label={t('common.loading')}>
            <Box>
              <Skeleton width={140} height={24} />
              <Skeleton width="min(320px, 80%)" height={56} />
              <Skeleton width="min(380px, 90%)" height={24} />
            </Box>
            <Skeleton variant="rounded" height={180} />
          </Stack>
        )}
        {state.error && (
          <Alert
            severity="error"
            action={
              <Button color="inherit" onClick={load}>
                {t('app.retry')}
              </Button>
            }
          >
            {t('dashboard.loadError')} {t(state.error)}
          </Alert>
        )}
        {noData && (
          <EmptyState
            icon="bank"
            title={t('future.noData')}
            description={t('future.noDataHelp')}
            action={
              <Button component={RouterLink} to="/open-finance" variant="contained">
                {t('openFinance.connectShort')}
              </Button>
            }
          />
        )}

        {overview && !noData && (
          <Stack spacing={{ xs: 4, md: 5 }}>
            {sources.bankData?.stale && <BankDataNotice bankData={sources.bankData} />}
            {ready && overview.spendingLimit ? (
              <DailyLimitCard
                compact
                hideAmount={hidden}
                limit={overview.spendingLimit}
                exitPlan={overview.exitPlan}
                action={shortcuts}
              />
            ) : (
              <Box>
                <Typography variant="h5" component="p" sx={{ maxWidth: 560 }}>
                  {t('dashboard.answerFirst')}
                </Typography>
                <Stack direction="row" flexWrap="wrap" sx={{ mt: 2.5, gap: 1 }}>
                  <Button component={RouterLink} to="/future" variant="contained">
                    {t('dashboard.answer')}
                  </Button>
                  {shortcuts}
                </Stack>
              </Box>
            )}
            <MonthTotals hidden={hidden} />

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 7fr) minmax(0, 5fr)' },
                gap: { xs: 4, md: 5 },
                alignItems: 'start',
              }}
            >
              {ready && (
                <Box component="section" aria-labelledby="dashboard-chart">
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                    <Typography id="dashboard-chart" variant="h6" component="h2">
                      {t('future.horizon', { days: 30 })}
                    </Typography>
                    <Button component={RouterLink} to="/future" size="small">
                      {t('dashboard.openFuture')}
                    </Button>
                  </Stack>
                  <ProjectionChart
                    height={200}
                    ariaLabel={t('future.chartLabelClear', {
                      days: 30,
                      amount: hidden ? HIDDEN_AMOUNT : money(projection.minBalance, lang),
                      date: dayLabel(projection.minDate, lang),
                    })}
                    history={history}
                    series={[
                      {
                        key: 'projection',
                        color: theme.palette.chart.projection,
                        dashed: true,
                        days: projection.days.map((day) => ({ date: day.date, balance: Number(day.balance) })),
                      },
                    ]}
                    lowest={{ date: projection.minDate, balance: Number(projection.minBalance) }}
                    hideValues={hidden}
                  />
                  {sources.bankData && !sources.bankData.stale && (
                    <BankDataNotice bankData={sources.bankData} sx={{ mt: 1.5 }} />
                  )}
                </Box>
              )}
              <Box component="section" aria-labelledby="dashboard-upcoming">
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                  <Typography id="dashboard-upcoming" variant="h6" component="h2">
                    {t('dashboard.upcoming')}
                  </Typography>
                  <Button component={RouterLink} to="/commitments" size="small">
                    {t('app.seeAll')}
                  </Button>
                </Stack>
                {upcoming.length ? (
                  <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
                    {upcoming.map((event) => (
                      <EventRow key={`${event.reference}-${event.date}`} event={event} dense hideAmount={hidden} />
                    ))}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    {t('dashboard.noUpcoming')}
                  </Typography>
                )}
              </Box>
            </Box>
          </Stack>
        )}
      </Container>
    </>
  );
}
