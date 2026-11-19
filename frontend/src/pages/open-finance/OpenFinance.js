import { alpha } from '@mui/material/styles';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Grid,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { LoadingButton } from '@mui/lab';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { enqueueSnackbar } from 'notistack';
import { PageHeading, PageSkeleton, WalletIcon, IconTile } from '../../components/wallet-ui';
import { useWallets } from '../../context/WalletContext';
import HttpService from '../../services/HttpService';
import { dateTime, errorKey } from '../../utils/wallet';
import ConsentDialog, { PermissionGroups } from './ConsentDialog';
import consentTerms from '../../consentTerms.json';

const DURATIONS = [3, 6, 12];
// Open Finance Brasil: a consent not authorised within 60 minutes is rejected with CONSENT_EXPIRED.
const AUTHORISE_WINDOW_MS = 60 * 60 * 1000;
const STATUS_COLOR = { AUTHORISED: 'success', AWAITING_AUTHORISATION: 'warning' };

/**
 * The consent journey of Open Finance Brasil (ADR 0008): choose how long to share, authorise at the
 * institution (the sandbox plays the bank), sync, revoke. Revoking deletes what was imported.
 */
export default function OpenFinance() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { refresh } = useWallets();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState(null);
  const [months, setMonths] = useState(12);
  // The consent being authorised on the "bank" screen, and that screen's own error.
  const [consent, setConsent] = useState(null);
  const [consentError, setConsentError] = useState(null);
  const [revokeOpen, setRevokeOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStatus(await HttpService.getWithAuth('/open-finance/status'));
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** One request at a time: a double click must not create two consents or authorise twice. */
  const run = async (action, onError = setError) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (failure) {
      // Reload first: the status may have changed (expired, already connected), then say what failed.
      await load();
      onError(errorKey(failure));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const connect = () =>
    run(async () => {
      const created = await HttpService.postWithAuth('/open-finance/connection', { months });
      setConsentError(null);
      setConsent(created);
      await load();
    });

  const resume = () => {
    setConsentError(null);
    setConsent({
      consentId: status.consentId,
      institutionName: status.institutionName,
      permissions: status.permissions,
      expiresAt: status.expiresAt,
      authoriseBefore: status.createdAt
        ? new Date(new Date(status.createdAt).getTime() + AUTHORISE_WINDOW_MS).toISOString()
        : null,
    });
  };

  const authorise = () =>
    run(
      async () => {
        // The backend records which text the person read when saying yes (B42).
        const result = await HttpService.postWithAuth('/open-finance/connection/authorise', {
          consentId: consent.consentId,
          termsVersion: consentTerms.version,
          language: i18n.resolvedLanguage,
        });
        setConsent(null);
        await Promise.all([load(), refresh()]);
        enqueueSnackbar(
          t('openFinance.syncSuccess', { accounts: result.accountsSynced, transactions: result.newTransactions }),
          { variant: 'success' }
        );
      },
      (key) => {
        // Past the 60 minutes the consent is gone: the page shows why (REJECTED, CONSENT_EXPIRED).
        if (key === 'app.errors.OPEN_FINANCE_CONSENT_EXPIRED' || key === 'app.errors.OPEN_FINANCE_CONSENT_NOT_FOUND') {
          setConsent(null);
          setError(key);
        } else setConsentError(key);
      }
    );

  const reject = (consentId) =>
    run(
      async () => {
        await HttpService.postWithAuth('/open-finance/connection/reject', { consentId });
        setConsent(null);
        await load();
        enqueueSnackbar(t('openFinance.consent.rejected'), { variant: 'info' });
      },
      (key) => (consent ? setConsentError(key) : setError(key))
    );

  const sync = () =>
    run(async () => {
      const result = await HttpService.postWithAuth('/open-finance/sync', {});
      await Promise.all([load(), refresh()]);
      enqueueSnackbar(
        t('openFinance.syncSuccess', { accounts: result.accountsSynced, transactions: result.newTransactions }),
        { variant: 'success' }
      );
    });

  const revoke = () =>
    run(async () => {
      await HttpService.deleteWithAuth('/open-finance/connection');
      setRevokeOpen(false);
      // The imported accounts and statement are gone: the wallets on every screen must follow.
      await Promise.all([load(), refresh()]);
      enqueueSnackbar(t('openFinance.revoke.done'), { variant: 'success' });
    });

  const state = status?.status || 'DISCONNECTED';
  const canConnect = state === 'DISCONNECTED' || state === 'REJECTED';

  return (
    <>
      <Helmet>
        <title>{t('openFinance.pageTitle')}</title>
      </Helmet>
      <Container maxWidth="lg">
        <PageHeading title={t('openFinance.heading')} description={t('openFinance.description')} />
        {error && (
          <Alert
            severity="error"
            sx={{ mb: 3 }}
            action={
              // Without a status there is nothing else on screen to act on: offer the retry here.
              status ? undefined : (
                <Button color="inherit" onClick={load} disabled={loading}>
                  {t('app.retry')}
                </Button>
              )
            }
          >
            {t(error)}
          </Alert>
        )}
        <Grid container spacing={3}>
          <Grid item xs={12} md={7}>
            {/* No status yet: nothing is known about the connection, so the card claims nothing. */}
            {!status && loading && <PageSkeleton rows={0} />}
            {status && (
              <Card
                component="section"
                aria-labelledby="of-institution"
                sx={{ p: { xs: 3, sm: 4 }, overflow: 'hidden', position: 'relative' }}
              >
                <Box
                  aria-hidden="true"
                  sx={{
                    position: 'absolute',
                    width: 220,
                    height: 220,
                    borderRadius: '50%',
                    background: (theme) =>
                      `radial-gradient(circle, ${alpha(theme.palette.brand.fog, 0.16)}, transparent 68%)`,
                    right: -70,
                    top: -90,
                  }}
                />
                <Stack spacing={3} sx={{ position: 'relative' }} aria-busy={loading}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                    <IconTile name="bank" />
                    <Chip color={STATUS_COLOR[state] || 'default'} label={t(`openFinance.status.${state}`)} />
                  </Stack>
                  <Box>
                    <Typography variant="overline" color="text.secondary">
                      {status.simulated ? t('openFinance.contractSandbox') : t('openFinance.participantSandbox')}
                    </Typography>
                    <Typography id="of-institution" variant="h4" component="h2" sx={{ mt: 0.5 }}>
                      {status.institutionName || t('openFinance.bankPlaceholder')}
                    </Typography>
                    <Typography color="text.secondary" sx={{ mt: 1.5, maxWidth: 580 }}>
                      {t(status.simulated ? 'openFinance.notice.contract' : 'openFinance.notice.participant')}
                    </Typography>
                  </Box>

                  {state === 'AUTHORISED' && (
                    <>
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={3}
                        divider={<Divider orientation="vertical" flexItem />}
                      >
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            {t('openFinance.accounts')}
                          </Typography>
                          <Typography variant="h5">{status.accountCount}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            {t('openFinance.lastSync')}
                          </Typography>
                          <Typography variant="subtitle1">{dateTime(status.lastSyncedAt, lang)}</Typography>
                        </Box>
                      </Stack>
                      {status.expiresAt && (
                        <Typography variant="body2" color="text.secondary">
                          {t('openFinance.validUntil', { date: dateTime(status.expiresAt, lang) })}
                        </Typography>
                      )}
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                        <LoadingButton
                          loading={busy}
                          variant="contained"
                          onClick={sync}
                          startIcon={<WalletIcon name="sync" />}
                        >
                          {t('openFinance.sync')}
                        </LoadingButton>
                        <Button color="inherit" disabled={busy} onClick={() => setRevokeOpen(true)}>
                          {t('openFinance.revoke.open')}
                        </Button>
                      </Stack>
                    </>
                  )}

                  {state === 'AWAITING_AUTHORISATION' && (
                    <>
                      <Alert severity="warning">
                        {t('openFinance.awaiting.text', {
                          institution: status.institutionName,
                          time: status.createdAt
                            ? dateTime(new Date(new Date(status.createdAt).getTime() + AUTHORISE_WINDOW_MS), lang)
                            : '—',
                        })}
                      </Alert>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                        <Button variant="contained" disabled={busy} onClick={resume}>
                          {t('openFinance.awaiting.resume')}
                        </Button>
                        <Button color="inherit" disabled={busy} onClick={() => reject(status.consentId)}>
                          {t('openFinance.awaiting.reject')}
                        </Button>
                      </Stack>
                    </>
                  )}

                  {state === 'REJECTED' && (
                    <Alert severity="info">
                      {t(
                        {
                          CUSTOMER_MANUALLY_REVOKED: 'openFinance.rejected.CUSTOMER_MANUALLY_REVOKED',
                          CUSTOMER_MANUALLY_REJECTED: 'openFinance.rejected.CUSTOMER_MANUALLY_REJECTED',
                          CONSENT_EXPIRED: 'openFinance.rejected.CONSENT_EXPIRED',
                          CONSENT_MAX_DATE_REACHED: 'openFinance.rejected.CONSENT_MAX_DATE_REACHED',
                        }[status.rejectionReason] || 'openFinance.rejected.unknown'
                      )}
                    </Alert>
                  )}

                  {canConnect && (
                    <Box>
                      <Typography id="of-duration" variant="subtitle2" component="p">
                        {t('openFinance.duration.label')}
                      </Typography>
                      <ToggleButtonGroup
                        exclusive
                        value={months}
                        onChange={(_, value) => value && setMonths(value)}
                        aria-labelledby="of-duration"
                        sx={{ mt: 1 }}
                      >
                        {DURATIONS.map((option) => (
                          <ToggleButton key={option} value={option} sx={{ px: 2 }}>
                            {t('openFinance.duration.months', { count: option })}
                          </ToggleButton>
                        ))}
                      </ToggleButtonGroup>
                      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1, mb: 2 }}>
                        {t('openFinance.duration.help')}
                      </Typography>
                      <LoadingButton
                        loading={busy}
                        variant="contained"
                        onClick={connect}
                        startIcon={<WalletIcon name="shield" />}
                      >
                        {t(state === 'REJECTED' ? 'openFinance.connectAgain' : 'openFinance.connect')}
                      </LoadingButton>
                    </Box>
                  )}
                </Stack>
              </Card>
            )}
          </Grid>
          <Grid item xs={12} md={5}>
            <Stack spacing={3}>
              <Card sx={{ p: 3 }}>
                <Typography variant="h6" component="h2">
                  {t('openFinance.permissionsTitle')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2.5 }}>
                  {t('openFinance.permissionsHelp')}
                </Typography>
                <PermissionGroups permissions={status?.permissions || []} />
              </Card>
              <Alert severity="info" icon={<WalletIcon name="shield" />}>
                <Typography variant="subtitle2">{t('openFinance.credentialTitle')}</Typography>
                <Typography variant="body2">{t('openFinance.credentialHelp')}</Typography>
              </Alert>
              <Button
                href="https://openfinancebrasil.atlassian.net/wiki/spaces/OF/pages/17369300/Dados+do+Cliente+-+DC"
                target="_blank"
                rel="noreferrer"
                endIcon={<WalletIcon name="arrow" />}
              >
                {t('openFinance.officialDocs')}
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </Container>

      <ConsentDialog
        consent={consent}
        busy={busy}
        error={consentError}
        onAuthorise={authorise}
        onReject={() => reject(consent.consentId)}
        onClose={() => setConsent(null)}
      />

      <Dialog
        open={revokeOpen}
        onClose={busy ? undefined : () => setRevokeOpen(false)}
        aria-labelledby="revoke-title"
        aria-describedby="revoke-deleted"
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle id="revoke-title">{t('openFinance.revoke.title')}</DialogTitle>
        <DialogContent>
          <Alert severity="warning" id="revoke-deleted">
            {t('openFinance.revoke.deleted')}
          </Alert>
          <DialogContentText sx={{ mt: 2 }}>{t('openFinance.revoke.kept')}</DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button color="inherit" disabled={busy} onClick={() => setRevokeOpen(false)}>
            {t('openFinance.revoke.cancel')}
          </Button>
          <LoadingButton color="error" variant="contained" loading={busy} onClick={revoke}>
            {t('openFinance.revoke.confirm')}
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </>
  );
}
