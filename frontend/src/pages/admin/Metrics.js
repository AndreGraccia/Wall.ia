import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import HttpService from '../../services/HttpService';
import { StatBlock } from '../../components/future-ui';
import { ListRow } from '../../components/detail-ui';
import { PageHeading, PageSkeleton } from '../../components/wallet-ui';
import { errorKey, money } from '../../utils/wallet';

const PIX = ['PIX_PREPARE', 'PIX_CONFIRM'];

/**
 * Product numbers for the team: the north star (negative days avoided per active user per month), the
 * misses next to it, what people ask and how many want the Pix for real. Aggregates only.
 */
export default function Metrics() {
  const { t, i18n } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const lang = i18n.language;
  const [days, setDays] = useState(30);
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [busy, setBusy] = useState(false);
  const [confirmSync, setConfirmSync] = useState(false);

  const load = useCallback(async () => {
    setState((previous) => ({ ...previous, loading: true, error: null }));
    try {
      setState({ loading: false, error: null, data: await HttpService.getWithAuth(`/admin/metrics?days=${days}`) });
    } catch (failure) {
      setState({ loading: false, error: errorKey(failure), data: null });
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  const runSync = async () => {
    setConfirmSync(false);
    setBusy(true);
    try {
      const result = await HttpService.postWithAuth('/admin/open-finance/daily-sync');
      enqueueSnackbar(t('metrics.syncDone', { synced: result.synced, skipped: result.skipped }), {
        variant: 'success',
      });
      await load();
    } catch (failure) {
      enqueueSnackbar(t(errorKey(failure)), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const { data } = state;
  const star = data?.northStar;
  const usage = data?.usage || [];
  const questions = usage.filter((row) => !PIX.includes(row.intent));
  const asked = questions.reduce((sum, row) => sum + row.count, 0);
  const unknown = questions.find((row) => row.intent === 'UNKNOWN')?.count || 0;
  const pix = (step) => usage.find((row) => row.intent === step)?.count || 0;

  return (
    <>
      <Helmet>
        <title>{t('metrics.pageTitle')}</title>
      </Helmet>
      <Container maxWidth="lg">
        <PageHeading
          title={t('metrics.heading')}
          action={
            <ToggleButtonGroup
              exclusive
              value={days}
              onChange={(_, value) => value && setDays(value)}
              aria-label={t('metrics.periodLabel')}
            >
              {[7, 30, 90].map((option) => (
                <ToggleButton key={option} value={option} aria-label={t('future.horizonOption', { days: option })}>
                  {t('future.horizonShort', { days: option })}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          }
        />
        {state.loading && !data && <PageSkeleton rows={0} />}
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
        {star && (
          <Stack spacing={{ xs: 5, md: 6 }} aria-busy={state.loading}>
            <Box>
              <StatBlock
                label={t('metrics.northStar')}
                value={
                  star.avoidedPerActiveUserMonth == null
                    ? t('common.noData')
                    : Number(star.avoidedPerActiveUserMonth).toLocaleString(lang)
                }
                tooltip={t('metrics.northStarHelp')}
                emphasis
              />
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(5, minmax(0, 1fr))' },
                  gap: { xs: 3, md: 4 },
                  mt: 4,
                  pt: 3,
                  borderTop: '1px solid',
                  borderColor: 'divider',
                }}
              >
                {[
                  ['activeUsers', star.activeUsers],
                  ['gradedUsers', star.gradedUsers],
                  ['avoided', star.avoided],
                  ['missed', star.missed],
                  [
                    'meanError',
                    star.meanAbsoluteError == null ? t('common.noData') : money(star.meanAbsoluteError, lang),
                  ],
                ].map(([key, value]) => (
                  <StatBlock
                    compact
                    key={key}
                    label={t(`metrics.${key}`)}
                    value={String(value)}
                    negative={key === 'missed' && value > 0}
                  />
                ))}
              </Box>
            </Box>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' },
                gap: { xs: 5, md: 6 },
                alignItems: 'start',
              }}
            >
              <Box component="section" aria-labelledby="metrics-ask">
                <Typography id="metrics-ask" variant="h6" component="h2">
                  {t('metrics.askTitle')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>
                  {asked
                    ? t('metrics.askUnknown', { percent: Math.round((unknown / asked) * 100), total: asked })
                    : t('metrics.askNone')}
                </Typography>
                {questions.length > 0 && (
                  <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
                    {questions.map((row) => (
                      <ListRow
                        key={row.intent}
                        title={t(`metrics.intents.${row.intent}`, { defaultValue: row.intent })}
                        value={row.count.toLocaleString(lang)}
                      />
                    ))}
                  </Box>
                )}
              </Box>
              <Box component="section" aria-labelledby="metrics-pix">
                <Typography id="metrics-pix" variant="h6" component="h2">
                  {t('metrics.pixTitle')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>
                  {t('metrics.pixHelp')}
                </Typography>
                <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
                  <ListRow title={t('metrics.pixPrepare')} value={pix('PIX_PREPARE').toLocaleString(lang)} />
                  <ListRow title={t('metrics.pixConfirm')} value={pix('PIX_CONFIRM').toLocaleString(lang)} />
                </Box>
              </Box>
            </Box>

            <Box sx={{ pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
              {/* Heavy: it syncs every account. A text button and a confirmation keep it off the path of reading. */}
              <Button onClick={() => setConfirmSync(true)} disabled={busy} variant="outlined">
                {t('metrics.runSync')}
              </Button>
              <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
                {t('metrics.runSyncHelp')}
              </Typography>
            </Box>
          </Stack>
        )}
      </Container>
      <Dialog open={confirmSync} onClose={() => setConfirmSync(false)} aria-labelledby="sync-title">
        <DialogTitle id="sync-title">{t('metrics.runSync')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2">{t('metrics.runSyncConfirm')}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmSync(false)}>{t('future.pix.cancel')}</Button>
          <Button variant="contained" onClick={runSync}>
            {t('metrics.runSyncGo')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
