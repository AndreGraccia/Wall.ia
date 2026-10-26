import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import HttpService from '../../services/HttpService';
import { dayLabel, errorKey, money } from '../../utils/wallet';

/**
 * Flags possible duplicate and unusual imported charges. It is a review aid, not a fraud verdict.
 * Refund scenarios are hypothetical responses from the existing deterministic forecast engine.
 */
export default function ChargeRadar() {
  const { t, i18n } = useTranslation();
  const [state, setState] = useState({ loading: true, error: null, alerts: [] });
  const [busyId, setBusyId] = useState(null);
  const [operationError, setOperationError] = useState(null);
  const [lastDecision, setLastDecision] = useState(null);
  const [simulations, setSimulations] = useState({});
  const [simulationErrors, setSimulationErrors] = useState({});

  const load = useCallback(async () => {
    setState((previous) => ({ ...previous, loading: true, error: null }));
    try {
      const result = await HttpService.getWithAuth('/future/charge-alerts');
      setState({ loading: false, error: null, alerts: Array.isArray(result) ? result : [] });
    } catch (failure) {
      setState((previous) => ({ ...previous, loading: false, error: errorKey(failure) }));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (alert, decision) => {
    setBusyId(alert.transactionId);
    setOperationError(null);
    setLastDecision(null);
    try {
      await HttpService.putWithAuth(`/future/charge-alerts/${alert.transactionId}/decision`, { decision });
      setLastDecision(decision);
      await load();
    } catch (failure) {
      setOperationError(errorKey(failure));
    } finally {
      setBusyId(null);
    }
  };

  const simulateRefund = async (alert) => {
    setBusyId(alert.transactionId);
    setOperationError(null);
    setSimulationErrors((previous) => ({ ...previous, [alert.transactionId]: null }));
    try {
      const result = await HttpService.postWithAuth('/future/scenarios', {
        type: 'REFUND',
        amount: Number(alert.amount),
        label: 'Estorno hipotético',
      });
      setSimulations((previous) => ({ ...previous, [alert.transactionId]: result }));
    } catch (failure) {
      setSimulationErrors((previous) => ({ ...previous, [alert.transactionId]: errorKey(failure) }));
    } finally {
      setBusyId(null);
    }
  };

  const formatDate = (value) => (value ? dayLabel(value, i18n.language) : t('future.chargeRadar.noDate'));

  return (
    <Card component="section" aria-labelledby="charge-radar-title" sx={{ p: { xs: 2, sm: 3 } }}>
      <Stack spacing={2}>
        <Box>
          <Typography id="charge-radar-title" variant="h5" component="h2">
            {t('future.chargeRadar.title')}
          </Typography>
          <Typography color="text.secondary" variant="body2" sx={{ mt: 0.75 }}>
            {t('future.chargeRadar.description')}
          </Typography>
        </Box>

        <Alert severity="info">{t('future.chargeRadar.disclaimer')}</Alert>

        {operationError && (
          <Alert severity="error" onClose={() => setOperationError(null)}>
            {t(operationError)}
          </Alert>
        )}
        {lastDecision && (
          <Alert severity="success" onClose={() => setLastDecision(null)}>
            {t(`future.chargeRadar.decisionSaved.${lastDecision}`)}
          </Alert>
        )}

        {state.loading && state.alerts.length === 0 && !state.error && (
          <Stack direction="row" spacing={1.5} alignItems="center" role="status">
            <CircularProgress size={20} />
            <Typography variant="body2" color="text.secondary">
              {t('future.chargeRadar.loading')}
            </Typography>
          </Stack>
        )}

        {state.error && (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={load}>
                {t('app.retry')}
              </Button>
            }
          >
            {t('future.chargeRadar.loadError')} {t(state.error)}
          </Alert>
        )}

        {!state.loading && !state.error && state.alerts.length === 0 && (
          <Box sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 2, p: 2.5 }}>
            <Typography variant="subtitle1">{t('future.chargeRadar.emptyTitle')}</Typography>
            <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>
              {t('future.chargeRadar.emptyDescription')}
            </Typography>
          </Box>
        )}

        {state.alerts.map((alert) => {
          const simulation = simulations[alert.transactionId];
          const working = busyId === alert.transactionId;
          const duplicate = alert.kind === 'POSSIBLE_DUPLICATE';
          return (
            <Box
              key={alert.transactionId}
              sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: { xs: 2, sm: 2.5 } }}
            >
              <Stack spacing={1.5}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  justifyContent="space-between"
                  alignItems={{ xs: 'flex-start', sm: 'flex-start' }}
                  spacing={1}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" alignItems="center" spacing={1} useFlexGap flexWrap="wrap">
                      <Typography variant="subtitle1" component="h3" sx={{ overflowWrap: 'anywhere' }}>
                        {alert.description || t('future.chargeRadar.unnamedCharge')}
                      </Typography>
                      <Chip
                        size="small"
                        color={duplicate ? 'warning' : 'default'}
                        label={t(duplicate ? 'future.chargeRadar.duplicateBadge' : 'future.chargeRadar.unusualBadge')}
                      />
                      <Chip
                        size="small"
                        variant="outlined"
                        label={t(`future.chargeRadar.confidence.${alert.confidence}`)}
                      />
                      {alert.decision === 'REVIEW' && (
                        <Chip size="small" color="info" label={t('future.chargeRadar.underReview')} />
                      )}
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {[alert.walletName, alert.institutionName].filter(Boolean).join(' · ')} · {formatDate(alert.date)}
                    </Typography>
                  </Box>
                  <Typography variant="h6" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {money(alert.amount, i18n.language)}
                  </Typography>
                </Stack>

                {duplicate ? (
                  <Typography variant="body2">
                    {t('future.chargeRadar.duplicateReason', {
                      previousDate: formatDate(alert.relatedDate),
                      previousAmount: money(alert.amount, i18n.language),
                    })}
                  </Typography>
                ) : (
                  <Typography variant="body2">
                    {t('future.chargeRadar.unusualReason', {
                      previousAmount: money(alert.baselineAmount, i18n.language),
                      difference: money(alert.difference, i18n.language),
                      occurrences: alert.occurrences,
                    })}
                  </Typography>
                )}

                {alert.relatedDate && (
                  <Typography variant="caption" color="text.secondary">
                    {t('future.chargeRadar.evidence', {
                      reference: alert.relatedTransactionId,
                      date: formatDate(alert.relatedDate),
                    })}
                  </Typography>
                )}

                <Divider />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
                  <Button variant="contained" onClick={() => simulateRefund(alert)} disabled={working}>
                    {working ? t('future.chargeRadar.working') : t('future.chargeRadar.simulateRefund')}
                  </Button>
                  {alert.decision !== 'REVIEW' && (
                    <Button variant="outlined" onClick={() => decide(alert, 'REVIEW')} disabled={working}>
                      {t('future.chargeRadar.review')}
                    </Button>
                  )}
                  <Button variant="text" onClick={() => decide(alert, 'NOT_ANOMALOUS')} disabled={working}>
                    {t('future.chargeRadar.notAnomalous')}
                  </Button>
                  <Button variant="text" onClick={() => decide(alert, 'RESOLVED')} disabled={working}>
                    {t('future.chargeRadar.resolved')}
                  </Button>
                </Stack>

                {simulationErrors[alert.transactionId] && (
                  <Alert severity="error">
                    {t('future.chargeRadar.simulationError')} {t(simulationErrors[alert.transactionId])}
                  </Alert>
                )}
                {simulation && (
                  <Alert severity="info">
                    <AlertTitle>{t('future.chargeRadar.simulationTitle')}</AlertTitle>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      {t('future.chargeRadar.simulationDisclaimer')}
                    </Typography>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          {t('future.chargeRadar.beforeMin')}
                        </Typography>
                        <Typography variant="subtitle1" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                          {money(simulation.baseline.minBalance90, i18n.language)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t('future.chargeRadar.negativeDays', { count: simulation.baseline.negativeDays })}
                        </Typography>
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          {t('future.chargeRadar.afterHypotheticalRefund')}
                        </Typography>
                        <Typography
                          variant="subtitle1"
                          color={Number(simulation.scenario.minBalance90) < 0 ? 'error.main' : 'success.main'}
                          sx={{ fontVariantNumeric: 'tabular-nums' }}
                        >
                          {money(simulation.scenario.minBalance90, i18n.language)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t('future.chargeRadar.negativeDays', { count: simulation.scenario.negativeDays })}
                        </Typography>
                      </Box>
                    </Stack>
                  </Alert>
                )}
              </Stack>
            </Box>
          );
        })}
      </Stack>
    </Card>
  );
}
