import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Collapse,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Skeleton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import HttpService from '../../services/HttpService';
import { useWallets } from '../../context/WalletContext';
import ProjectionChart from '../../components/projection-chart';
import BankDataNotice from '../../components/bank-data';
import { DailyLimitCard, EventRow, ExitPlanList, StatBlock } from '../../components/future-ui';
import { EmptyState, PageHeading, SectionCard, visuallyHidden } from '../../components/wallet-ui';
import { dayLabel, errorKey, money, overdraftCostText } from '../../utils/wallet';
import { balanceHistory, forecastReady } from '../../utils/forecast';
import Questions from './Questions';
import Simulator from './Simulator';
import Goals from './Goals';
import AlertToggle from './AlertToggle';
import Accuracy from './Accuracy';
import CancelGuide from './CancelGuide';

function WhyDialog({ risk, exitPlan, onClose }) {
  const { t, i18n } = useTranslation();
  return (
    <Dialog open={Boolean(risk)} onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="why-title">
      {risk && (
        <>
          <DialogTitle id="why-title">{t('future.whyTitle')}</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {t('future.whyIntro')}
            </Typography>
            {risk.causes.map((event) => (
              <EventRow key={`${event.reference}-${event.date}`} event={event} dense />
            ))}
            <Alert severity={risk.relief ? 'info' : 'warning'} sx={{ mt: 2 }}>
              {risk.relief
                ? t('future.whyRelief', {
                    label: risk.relief.label,
                    date: dayLabel(risk.relief.date, i18n.language),
                    amount: money(risk.relief.amount, i18n.language),
                  })
                : t('future.whyNoRelief')}
            </Alert>
            {Number(risk.overdraftCostCap) > 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                {overdraftCostText(t, risk, i18n.language)}
              </Typography>
            )}
            <ExitPlanList actions={exitPlan} />
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 2 }}>
              {t('future.whyFooter')}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button variant="outlined" onClick={onClose}>
              {t('common.close')}
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}

WhyDialog.propTypes = { risk: PropTypes.object, exitPlan: PropTypes.array, onClose: PropTypes.func.isRequired };

/** Loading: the shape of the page (sentence, number, chart, three numbers), so nothing jumps. */
function FutureSkeleton() {
  const { t } = useTranslation();
  return (
    <Stack spacing={4} role="status" aria-busy="true" aria-label={t('common.loading')}>
      <Box>
        <Skeleton width={160} height={28} />
        <Skeleton width="min(360px, 80%)" height={64} />
        <Skeleton width="min(420px, 90%)" height={28} />
      </Box>
      <Skeleton variant="rounded" height={260} />
      <Stack direction="row" spacing={4}>
        {[0, 1, 2].map((item) => (
          <Box key={item} sx={{ flex: 1 }}>
            <Skeleton width="50%" />
            <Skeleton width="70%" height={36} />
          </Box>
        ))}
      </Stack>
    </Stack>
  );
}

/** The negative windows, one 56 px row each: when, how low, and why. */
function NegativeWindows({ windows, onWhy }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  return (
    <Box component="section" aria-labelledby="negative-title">
      <Typography id="negative-title" variant="h6" component="h2" sx={{ mb: 1 }}>
        {t('future.negativeTitle')}
      </Typography>
      {windows.map((risk) => (
        <Stack
          key={risk.start}
          direction="row"
          alignItems="center"
          spacing={2}
          sx={{ minHeight: 56, borderTop: '1px solid', borderColor: 'divider' }}
        >
          <Typography variant="subtitle2" sx={{ flex: 1, minWidth: 0 }}>
            {t('future.windowDates', { start: dayLabel(risk.start, lang), end: dayLabel(risk.end, lang) })}
          </Typography>
          <Typography variant="subtitle2" sx={{ color: 'error.main', fontWeight: 600 }}>
            {t('future.windowLowest', { amount: money(risk.lowestBalance, lang) })}
          </Typography>
          <Button
            size="small"
            onClick={() => onWhy(risk)}
            sx={{ flexShrink: 0 }}
            aria-label={t('future.whyLabel', { start: dayLabel(risk.start, lang), end: dayLabel(risk.end, lang) })}
          >
            {t('future.hero.why')}
          </Button>
        </Stack>
      ))}
    </Box>
  );
}

NegativeWindows.propTypes = { windows: PropTypes.array.isRequired, onWhy: PropTypes.func.isRequired };

/**
 * Futuro, the reference screen (docs/brand/DESIGN.md). Fixed order: the answer with the hero number, the
 * chart, three numbers, the negative windows, the pending questions in one row, then the tools folded.
 */
export default function Future() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const { hash } = useLocation();
  // Mocked away in some tests; the chart simply has no solid past then.
  const { transactions, wallets } = useWallets() || {};
  const [horizon, setHorizon] = useState(30);
  const [state, setState] = useState({
    loading: true,
    error: null,
    overview: null,
    recurrences: [],
    recurrencesError: null,
  });
  const [why, setWhy] = useState(null);
  const [openGroup, setOpenGroup] = useState(null);
  const [announce, setAnnounce] = useState('');

  // Clicking 30, 90, 60 quickly must not leave the 90-day answer under the 60 button.
  const latest = useRef(0);
  const load = useCallback(async () => {
    latest.current += 1;
    const request = latest.current;
    setState((previous) => ({ ...previous, loading: true, error: null }));
    // The questions are one section: when /recurrences fails, the projection still stands.
    const [overview, recurrences] = await Promise.allSettled([
      HttpService.getWithAuth(`/future/overview?horizon=${horizon}`),
      HttpService.getWithAuth('/future/recurrences'),
    ]);
    if (request !== latest.current) return;
    if (overview.status === 'rejected') {
      setState((previous) => ({ ...previous, loading: false, error: errorKey(overview.reason), overview: null }));
      return;
    }
    setState((previous) => ({
      loading: false,
      error: null,
      overview: overview.value,
      recurrences: recurrences.status === 'fulfilled' ? recurrences.value : previous.recurrences,
      recurrencesError: recurrences.status === 'rejected' ? errorKey(recurrences.reason) : null,
    }));
    setAnnounce(t('future.horizonUpdated', { days: horizon }));
    // t is stable per language; horizon is what changes the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horizon]);

  useEffect(() => {
    load();
  }, [load]);

  const { overview, recurrences } = state;
  const lang = i18n.language;
  const projection = overview?.projection;
  const today = projection?.days[0]?.date;
  const history = useMemo(
    () => balanceHistory({ transactions, wallets, today, balance: overview?.balance }),
    [transactions, wallets, today, overview?.balance]
  );
  const incomes = recurrences.filter((item) => item.direction === 'IN' && item.status === 'CONFIRMED');
  const sources = overview?.sources;
  // Nothing to project from: zeros and a flat line would read as "you have R$ 0", not "we know nothing yet".
  const noData =
    sources &&
    sources.confirmedRecurrences === 0 &&
    sources.pendingQuestions === 0 &&
    sources.cards === 0 &&
    sources.loans === 0;
  const showCard = Boolean(overview?.spendingLimit) && forecastReady({ sources });
  const firstRisk = projection?.riskWindows[0];
  const firstRun = overview?.sources.confirmedRecurrences === 0;
  const pendingCount =
    recurrences.filter((item) => item.status === 'PENDING').length +
    [overview?.dailySpending, overview?.cardSpending].filter((item) => item?.status === 'PENDING').length;
  const nextIncome = projection?.events.find((event) => Number(event.amount) > 0 && event.date > today);
  const bankData = overview?.sources.bankData;

  const questions =
    overview &&
    (state.recurrencesError ? (
      <Alert
        severity="error"
        action={
          <Button color="inherit" onClick={load}>
            {t('app.retry')}
          </Button>
        }
      >
        {t('future.questionsError')} {t(state.recurrencesError)}
      </Alert>
    ) : (
      <Questions
        recurrences={recurrences}
        dailySpending={overview.dailySpending}
        cardSpending={overview.cardSpending}
        onAnswered={load}
        // Before the first answer the questions are the page; after it, they fold into one row.
        collapsible={!firstRun}
        title={pendingCount > 0 ? t('future.questionsPending', { count: pendingCount }) : t('future.questionsTitle')}
      />
    ));

  return (
    <>
      <Helmet>
        <title>{t('future.pageTitle')}</title>
      </Helmet>
      <Container maxWidth="lg">
        <PageHeading
          title={t('future.heading')}
          action={
            <ToggleButtonGroup
              exclusive
              value={horizon}
              onChange={(_, value) => value && setHorizon(value)}
              aria-label={t('future.horizonLabel')}
            >
              {[30, 60, 90].map((days) => (
                <ToggleButton key={days} value={days} aria-label={t('future.horizonOption', { days })}>
                  {t('future.horizonShort', { days })}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          }
        />

        <Box role="status" aria-live="polite" sx={visuallyHidden}>
          {announce}
        </Box>
        {state.loading && !overview && <FutureSkeleton />}
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
          <Stack
            spacing={{ xs: 4, md: 5 }}
            aria-busy={state.loading}
            sx={{ opacity: state.loading ? 0.6 : 1, transition: 'opacity 150ms' }}
          >
            {/* Old bank data changes every number below: say so before them (B50). */}
            {bankData?.stale && <BankDataNotice bankData={bankData} />}

            {/* (1) The answer. */}
            {showCard && (
              <DailyLimitCard
                limit={overview.spendingLimit}
                risk={firstRisk}
                exitPlan={overview.exitPlan}
                onWhy={setWhy}
              />
            )}
            {firstRun && (
              <Stack spacing={2}>
                {overview.sources.pendingQuestions > 0 && (
                  <Alert severity="info">
                    <AlertTitle>{t('future.needsAnswers')}</AlertTitle>
                    {t('future.needsAnswersHelp')}
                  </Alert>
                )}
                {questions}
              </Stack>
            )}
            {!showCard && !firstRun && !projection.riskWindows.length && (
              <Alert severity="success">
                <AlertTitle>{t('future.allClear', { days: horizon })}</AlertTitle>
                {t('future.allClearHelp', {
                  amount: money(projection.minBalance, lang),
                  date: dayLabel(projection.minDate, lang),
                })}
              </Alert>
            )}

            {/* (2) The line in time: full width, no card around it. */}
            <Box>
              <ProjectionChart
                ariaLabel={
                  firstRisk
                    ? t('future.chartLabelNegative', {
                        days: horizon,
                        start: dayLabel(firstRisk.start, lang),
                        end: dayLabel(firstRisk.end, lang),
                        amount: money(projection.minBalance, lang),
                        date: dayLabel(projection.minDate, lang),
                        endBalance: money(projection.endBalance, lang),
                      })
                    : t('future.chartLabelClear', {
                        days: horizon,
                        amount: money(projection.minBalance, lang),
                        date: dayLabel(projection.minDate, lang),
                      })
                }
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
                markers={nextIncome ? [{ date: nextIncome.date, label: t('future.chartIncome'), kind: 'income' }] : []}
              />
              {bankData && !bankData.stale && <BankDataNotice bankData={bankData} sx={{ mt: 1.5 }} />}
            </Box>

            {/* (3) Three numbers in columns, no boxes. */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' },
                gap: { xs: 3, md: 4 },
                pt: 3,
                borderTop: '1px solid',
                borderColor: 'divider',
              }}
            >
              <StatBlock
                compact
                label={t('future.balanceNow')}
                value={money(overview.balance, lang)}
                tooltip={t('future.balanceNowHelp')}
              />
              <StatBlock
                compact
                label={t('future.committed')}
                value={money(overview.committed.total, lang)}
                tooltip={`${t('future.committedHelp', { date: dayLabel(overview.committed.until, lang) })} ${t(
                  'future.committedSplit',
                  {
                    confirmed: money(overview.committed.confirmed, lang),
                    estimated: money(overview.committed.estimated, lang),
                  }
                )}`}
              />
              {/* The conclusion of the three; on a phone it takes the whole second row. */}
              <Box sx={{ gridColumn: { xs: 'span 2', md: 'auto' } }}>
                <StatBlock
                  compact
                  label={t('future.free')}
                  value={money(overview.freeAfterCommitments, lang)}
                  emphasis
                  negative={Number(overview.freeAfterCommitments) < 0}
                  tooltip={t(Number(overview.freeAfterCommitments) < 0 ? 'future.freeNegativeHelp' : 'future.freeHelp')}
                />
              </Box>
            </Box>

            {/* (4) The negative windows. */}
            {projection.riskWindows.length > 0 && <NegativeWindows windows={projection.riskWindows} onWhy={setWhy} />}

            {/* (5) and (6): pending questions in one row, then every tool folded. */}
            <Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
              {!firstRun && questions}
              <SectionCard
                collapsible
                title={t('future.whereItGoes')}
                summary={money(overview.committed.total, lang)}
                action={
                  <Button component={RouterLink} to="/commitments" size="small" sx={{ ml: -1.5 }}>
                    {t('navigation.commitments')}
                  </Button>
                }
              >
                {overview.committed.groups.length ? (
                  <Box sx={{ pb: 1 }}>
                    {overview.committed.groups.map((group) => (
                      <Box key={group.category} sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
                        <Button
                          fullWidth
                          color="inherit"
                          onClick={() => setOpenGroup(openGroup === group.category ? null : group.category)}
                          aria-expanded={openGroup === group.category}
                          sx={{ justifyContent: 'space-between', px: 3, minHeight: 52, borderRadius: 0 }}
                        >
                          <span>{t(`future.categories.${group.category}`, { defaultValue: group.category })}</span>
                          <Typography component="span" variant="subtitle2" sx={{ fontWeight: 600 }}>
                            {money(group.total, lang)}
                          </Typography>
                        </Button>
                        <Collapse in={openGroup === group.category} unmountOnExit timeout={150}>
                          <Box sx={{ px: 3, pb: 1 }}>
                            {group.items.map((event) => (
                              <Box key={`${event.reference}-${event.date}`}>
                                <EventRow event={event} dense />
                                {group.category === 'SUBSCRIPTION' && <CancelGuide label={event.label} />}
                              </Box>
                            ))}
                          </Box>
                        </Collapse>
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <EmptyState
                    icon="bank"
                    title={t('future.noCommitments')}
                    description={t('future.noCommitmentsHelp')}
                    action={
                      <Button component={RouterLink} to="/open-finance" variant="outlined">
                        {t('openFinance.connectShort')}
                      </Button>
                    }
                  />
                )}
              </SectionCard>
              {projection.events.length > 0 && (
                <SectionCard collapsible title={t('future.eventsTitle')} summary={String(projection.events.length)}>
                  <Box sx={{ px: 3, pb: 1 }}>
                    {projection.events.map((event) => (
                      <EventRow key={`${event.reference}-${event.date}`} event={event} dense />
                    ))}
                  </Box>
                </SectionCard>
              )}
              <Simulator
                collapsible
                defaultOpen={hash === '#simulator'}
                incomes={incomes}
                hasCard={overview.sources.cards > 0}
              />
              <Goals collapsible onChanged={load} />
              <Accuracy collapsible />
              <SectionCard collapsible title={t('future.alertsTitle')}>
                <Box sx={{ px: 3, pb: 3 }}>
                  <AlertToggle />
                </Box>
              </SectionCard>
            </Box>
          </Stack>
        )}
      </Container>
      <WhyDialog
        risk={why}
        // The plan is calculated for the first window only.
        exitPlan={why && why.start === projection?.riskWindows[0]?.start ? overview?.exitPlan : null}
        onClose={() => setWhy(null)}
      />
    </>
  );
}
