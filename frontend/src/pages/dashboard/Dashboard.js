import { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, ButtonBase, Container, Skeleton, Stack, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { useWallets } from '../../context/WalletContext';
import { EmptyState, PageHeading } from '../../components/wallet-ui';
import { DailyLimitCard, EventRow } from '../../components/future-ui';
import ProjectionChart from '../../components/projection-chart';
import BankDataNotice from '../../components/bank-data';
import AuthService from '../../services/AuthService';
import HttpService from '../../services/HttpService';
import { dayLabel, errorKey, monthLabel, money } from '../../utils/wallet';
import { balanceHistory, forecastReady } from '../../utils/forecast';
import { HIDDEN_AMOUNT, useHiddenAmounts } from '../../utils/hiddenAmounts';
import {
  GoalsAndReserves,
  HIGHLIGHT_BY_TOOL,
  HorizonSummary,
  MethodNote,
  PlanVsActual,
  RiskAlert,
  useGet,
} from './sections';
import Onboarding from './Onboarding';

/**
 * Where the money is now and the month so far, under the number of the day (proposta de André Graccia, ADR 0021;
 * documento de evolução 4.2): consolidated balance, income, spending and leisure plus investment, in columns without
 * boxes. Each one opens the screen that explains it.
 */
export function MonthTotals({ hidden, balance }) {
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
    ...(balance !== undefined && balance !== null ? [['balance', 'balance', '/wallets']] : []),
    ['monthIncome', 'income', '/cash-flow?tab=income'],
    ['monthSpending', 'spending', '/cash-flow'],
    ['monthLeisure', 'leisureAndInvestment', '/plan'],
  ];
  const home = state.flow?.home && { ...state.flow.home, balance };
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
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: `repeat(${columns.length}, minmax(0, 1fr))` },
          columnGap: { xs: 2, md: 4 },
          rowGap: 2,
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
                  color:
                    hidden || Number(home[field]) === 0
                      ? 'text.primary'
                      : field === 'income'
                      ? 'success.main'
                      : field === 'balance' && Number(home.balance) < 0
                      ? 'error.main'
                      : 'text.primary',
                }}
              >
                {hidden ? HIDDEN_AMOUNT : money(home[field], lang)}
              </Typography>
            ) : (
              <Skeleton width="80%" height={32} />
            )}
            {/* The investment is the plan's decision, not a movement: say so, never sum it in silence. */}
            {home && field === 'leisureAndInvestment' && Number(home.investment) > 0 && (
              <Typography variant="caption" color="text.secondary" component="span" sx={{ display: 'block' }}>
                {t('dashboard.monthLeisureSplit', {
                  leisure: money(home.leisure, lang),
                  investment: money(home.investment, lang),
                })}
              </Typography>
            )}
          </ButtonBase>
        ))}
      </Box>
    </Box>
  );
}
MonthTotals.propTypes = { hidden: PropTypes.bool, balance: PropTypes.oneOfType([PropTypes.number, PropTypes.string]) };

/**
 * Início (docs/brand/DESIGN.md, documento de evolução 4.2). First fold: the number of the day, where the money is
 * and the month so far, and the first risk explained. Below: 30/60/90 days, the 30-day chart with the next
 * commitments, planned against actual, goals and reserves, and the active method, which decides which block
 * comes first. Each block links to the screen that goes deeper.
 */
export default function Dashboard() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { transactions, wallets } = useWallets() || {};
  const user = AuthService.getCurrentUser();
  const [state, setState] = useState({ loading: true, error: null, overview: null });
  const [hidden] = useHiddenAmounts();

  const load = useCallback(async () => {
    setState((previous) => ({ ...previous, loading: true, error: null }));
    try {
      setState({ loading: false, error: null, overview: await HttpService.getWithAuth('/future/overview?horizon=90') });
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
  // One 90-day projection feeds the 30/60/90 summary; the chart and the list keep to the next 30 days.
  const until30 = projection?.days[Math.min(30, projection.days.length - 1)]?.date;
  const days30 = (projection?.days || []).slice(0, 31);
  const lowest30 = days30.reduce((min, day) => (!min || Number(day.balance) < Number(min.balance) ? day : min), null);
  const upcoming = (projection?.events || [])
    .filter((event) => Number(event.amount) < 0 && (!until30 || event.date <= until30))
    .slice(0, 5);
  const plan = useGet('/plan');
  const goals = useGet('/future/goals');
  const envelopes = useGet('/future/envelopes');
  const profile = useGet('/profile');
  const catalog = useGet('/methods');
  const suggestions = useGet(profile.data && !profile.data.method ? '/methods/suggestions' : null);
  const chosen = (catalog.data?.methods || []).find((method) => method.id === profile.data?.method);
  const highlight = chosen ? HIGHLIGHT_BY_TOOL[chosen.where?.tool] : null;
  const onboarding = <Onboarding userId={user?.id} sources={sources} plan={plan} profile={profile} goals={goals} />;
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
        {/* The eye that hides every amount lives in the shell header, next to the account button. */}
        <PageHeading title={t('app.greeting', { name: user?.firstName || t('app.you') })} />

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
        {noData && onboarding}

        {overview && !noData && (
          <Stack spacing={{ xs: 4, md: 5 }}>
            {sources.bankData?.stale && <BankDataNotice bankData={sources.bankData} />}
            {ready && overview.spendingLimit ? (
              <DailyLimitCard
                compact
                hideAmount={hidden}
                limit={overview.spendingLimit}
                // Only for the pace warning under the hero; without onWhy no button comes with it.
                risk={projection.riskWindows[0]}
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
            <MonthTotals hidden={hidden} balance={overview.balance} />
            {ready && <RiskAlert windows={projection.riskWindows} hidden={hidden} />}
            {onboarding}
            {ready && <HorizonSummary projection={projection} hidden={hidden} />}

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
                      amount: hidden ? HIDDEN_AMOUNT : money(lowest30?.balance, lang),
                      date: dayLabel(lowest30?.date, lang),
                    })}
                    history={history}
                    series={[
                      {
                        key: 'projection',
                        color: theme.palette.chart.projection,
                        dashed: true,
                        days: days30.map((day) => ({ date: day.date, balance: Number(day.balance) })),
                      },
                    ]}
                    lowest={lowest30 && { date: lowest30.date, balance: Number(lowest30.balance) }}
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
            {(highlight === 'goals' ? ['goals', 'plan'] : ['plan', 'goals']).map((block) =>
              block === 'plan' ? (
                <PlanVsActual key="plan" plan={plan} hidden={hidden} highlighted={highlight === 'plan'} />
              ) : (
                <GoalsAndReserves
                  key="goals"
                  goals={goals}
                  envelopes={envelopes}
                  plan={plan}
                  hidden={hidden}
                  highlighted={highlight === 'goals'}
                />
              )
            )}
            <MethodNote profile={profile} catalog={catalog} suggestions={suggestions} />
          </Stack>
        )}
      </Container>
    </>
  );
}
