import PropTypes from 'prop-types';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { LoadingButton } from '@mui/lab';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { enqueueSnackbar } from 'notistack';
import { IconTile, PageHeading, PageSkeleton, WalletIcon, visuallyHidden } from '../../components/wallet-ui';
import { useWallets } from '../../context/WalletContext';
import HttpService from '../../services/HttpService';
import { Disclosure, ListRow } from '../../components/detail-ui';
import { dateTime, errorKey, localeFor, money } from '../../utils/wallet';
import ConsentDialog, { PermissionGroups } from './ConsentDialog';
import consentTerms from '../../consentTerms.json';

const DURATIONS = [3, 6, 12];
// Open Finance Brasil: a consent not authorised within 60 minutes is rejected with CONSENT_EXPIRED.
const AUTHORISE_WINDOW_MS = 60 * 60 * 1000;
const STATUS_COLOR = { AUTHORISED: 'success', AWAITING_AUTHORISATION: 'warning' };
const shortDate = (value, language, options) =>
  value ? new Intl.DateTimeFormat(localeFor(language), options).format(new Date(value)) : '—';

/**
 * One step of the consent journey. Where the person is shows three ways, never by colour alone: a check when
 * done, a filled number when it is now, an outlined number when it is still ahead.
 */
function Step({ id, number, title, hint, done, now, last, children }) {
  const { t } = useTranslation();
  let marker = 'ahead';
  if (done) marker = 'done';
  else if (now) marker = 'now';
  return (
    <Box
      component="li"
      aria-current={marker === 'now' ? 'step' : undefined}
      sx={{ display: 'grid', gridTemplateColumns: '32px minmax(0, 1fr)', columnGap: 2 }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Box
          aria-hidden="true"
          sx={{
            width: 28,
            height: 28,
            mt: 0.25,
            borderRadius: 999,
            display: 'grid',
            placeItems: 'center',
            typography: 'caption',
            fontWeight: 600,
            flexShrink: 0,
            border: '1px solid',
            borderColor: marker === 'ahead' ? 'grey.600' : 'transparent',
            bgcolor: { done: 'background.neutral', now: 'text.primary', ahead: 'transparent' }[marker],
            color: { done: 'success.main', now: 'background.default', ahead: 'text.secondary' }[marker],
          }}
        >
          {done ? <WalletIcon name="check" sx={{ fontSize: 16 }} /> : number}
        </Box>
        {!last && <Box sx={{ flex: 1, width: '1px', bgcolor: 'divider', my: 0.5, minHeight: 16 }} />}
      </Box>
      <Box sx={{ pb: last ? 0 : 3, minWidth: 0 }}>
        <Typography
          id={id}
          variant="subtitle1"
          component="h3"
          sx={{ fontWeight: 600, lineHeight: '32px', color: marker === 'ahead' ? 'text.secondary' : 'text.primary' }}
        >
          {title}
          {done && <Box component="span" sx={visuallyHidden}>{` (${t('openFinance.steps.done')})`}</Box>}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {hint}
        </Typography>
        {children && <Box sx={{ mt: 2 }}>{children}</Box>}
      </Box>
    </Box>
  );
}
Step.propTypes = {
  id: PropTypes.string.isRequired,
  number: PropTypes.number.isRequired,
  title: PropTypes.string.isRequired,
  hint: PropTypes.string.isRequired,
  done: PropTypes.bool,
  now: PropTypes.bool,
  last: PropTypes.bool,
  children: PropTypes.node,
};

/**
 * The consent journey of Open Finance Brasil (ADR 0008): choose how long to share, authorise at the
 * institution (the sandbox plays the bank), sync, revoke. Revoking deletes what was imported.
 */
export default function OpenFinance() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { refresh, wallets = [] } = useWallets();
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
  // Where the person is: 0 choose the period, 1 authorise at the bank, 2 connected (sync, and revoke if wanted).
  const current = { AWAITING_AUTHORISATION: 1, AUTHORISED: 2 }[state] ?? 0;

  const steps = [
    {
      key: 'period',
      done: !canConnect,
      body: canConnect ? (
        <>
          <ToggleButtonGroup
            exclusive
            value={months}
            onChange={(_, value) => value && setMonths(value)}
            aria-labelledby="of-step-period"
          >
            {DURATIONS.map((option) => (
              <ToggleButton key={option} value={option} sx={{ px: 2 }}>
                {t('openFinance.duration.months', { count: option })}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Box sx={{ mt: 2 }}>
            <LoadingButton loading={busy} variant="contained" onClick={connect}>
              {t(state === 'REJECTED' ? 'openFinance.connectAgain' : 'openFinance.connect')}
            </LoadingButton>
          </Box>
        </>
      ) : (
        status?.expiresAt && (
          <Typography variant="body2" color="text.secondary">
            {t('openFinance.validUntil', { date: dateTime(status.expiresAt, lang) })}
          </Typography>
        )
      ),
    },
    {
      key: 'authorise',
      done: state === 'AUTHORISED',
      body: state === 'AWAITING_AUTHORISATION' && (
        <>
          <Typography variant="body2">
            {t('openFinance.awaiting.text', {
              institution: status.institutionName,
              time: status.createdAt
                ? dateTime(new Date(new Date(status.createdAt).getTime() + AUTHORISE_WINDOW_MS), lang)
                : '—',
            })}
          </Typography>
          <Stack direction="row" flexWrap="wrap" sx={{ gap: 1.5, mt: 2 }}>
            <Button variant="contained" disabled={busy} onClick={resume}>
              {t('openFinance.awaiting.resume')}
            </Button>
            <Button variant="outlined" disabled={busy} onClick={() => reject(status.consentId)}>
              {t('openFinance.awaiting.reject')}
            </Button>
          </Stack>
        </>
      ),
    },
    {
      key: 'sync',
      done: false,
      body: null,
    },
    {
      key: 'revoke',
      done: false,
      // While connecting, what revoking costs is already on screen; once connected the button lives in that view.
      body: (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ pl: 1.5, borderLeft: '2px solid', borderColor: 'divider' }}
        >
          {t('openFinance.steps.revokeWarning')}
        </Typography>
      ),
    },
  ];

  // What is shared and the credential promise: a side column while connecting, a disclosure once connected.
  const sharedDetails = (
    <>
      <PermissionGroups permissions={status?.permissions || []} />
      <Stack direction="row" spacing={1.5} sx={{ pt: 3, mt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
        <WalletIcon name="shield" aria-hidden sx={{ fontSize: 20, color: 'text.secondary', mt: 0.25 }} />
        <Box>
          <Typography variant="subtitle2" component="p">
            {t('openFinance.credentialTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t('openFinance.credentialHelp')}
          </Typography>
        </Box>
      </Stack>
      <Box sx={{ mt: 2 }}>
        <Button
          href="https://openfinancebrasil.atlassian.net/wiki/spaces/OF/pages/17369300/Dados+do+Cliente+-+DC"
          target="_blank"
          rel="noreferrer"
          color="inherit"
          size="small"
        >
          {t('openFinance.officialDocs')}
        </Button>
      </Box>
    </>
  );
  const permissionsAside = (
    <Box component="aside" aria-labelledby="of-permissions">
      <Typography id="of-permissions" variant="h6" component="h2">
        {t('openFinance.permissionsTitle')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
        {t('openFinance.permissionsHelp')}
      </Typography>
      {sharedDetails}
    </Box>
  );
  const accounts = wallets.filter((wallet) => wallet.source === 'OPEN_FINANCE');

  // Connected: what matters now is the accounts, when they were last brought in and how to bring them again.
  // The consent journey is behind; revoking is still on the page, last and secondary.
  const connectedView = status && state === 'AUTHORISED' && (
    <Stack component="section" aria-labelledby="of-institution" aria-busy={loading} spacing={4} sx={{ maxWidth: 760 }}>
      <Box>
        <Stack direction="row" alignItems="center" flexWrap="wrap" sx={{ columnGap: 2, rowGap: 1 }}>
          <Typography id="of-institution" variant="h5" component="h2" sx={{ overflowWrap: 'anywhere' }}>
            {status.institutionName}
          </Typography>
          <Chip size="small" color="success" label={t('openFinance.status.AUTHORISED')} />
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {t('openFinance.connected.until', {
            date: shortDate(status.expiresAt, lang, { day: '2-digit', month: '2-digit', year: 'numeric' }),
          })}
        </Typography>
      </Box>
      <Box>
        {accounts.length > 0 && (
          <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
            {accounts.map((wallet) => (
              <ListRow
                key={wallet.id}
                title={wallet.name}
                meta={wallet.institutionName}
                value={money(wallet.balance, lang)}
              />
            ))}
          </Box>
        )}
        <Stack
          direction="row"
          alignItems="center"
          flexWrap="wrap"
          sx={{
            gap: 2,
            mt: 2,
            pt: accounts.length ? 2 : 0,
            borderTop: accounts.length ? '1px solid' : 0,
            borderColor: 'divider',
          }}
        >
          <LoadingButton loading={busy} variant="contained" onClick={sync} startIcon={<WalletIcon name="sync" />}>
            {t('openFinance.sync')}
          </LoadingButton>
          <Typography variant="body2" color="text.secondary">
            {t('openFinance.connected.lastSync', {
              date: shortDate(status.lastSyncedAt, lang, {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              }),
            })}
          </Typography>
        </Stack>
      </Box>
      <Disclosure label={t('openFinance.connected.shared')}>
        <Box sx={{ pl: 2, borderLeft: '2px solid', borderColor: 'divider' }}>{sharedDetails}</Box>
      </Disclosure>
      <Box sx={{ pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 560 }}>
          {t('openFinance.steps.revokeWarning')}
        </Typography>
        <Button variant="outlined" color="error" disabled={busy} onClick={() => setRevokeOpen(true)} sx={{ mt: 2 }}>
          {t('openFinance.revoke.open')}
        </Button>
      </Box>
      <Typography variant="caption" color="text.secondary" component="p">
        {t(status.simulated ? 'openFinance.notice.contract' : 'openFinance.notice.participant')}
      </Typography>
    </Stack>
  );

  return (
    <>
      <Helmet>
        <title>{t('openFinance.pageTitle')}</title>
      </Helmet>
      <Container maxWidth="lg">
        <PageHeading title={t('openFinance.heading')} />
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
        {connectedView || (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 7fr) minmax(0, 4fr)' },
              gap: { xs: 5, md: 8 },
              alignItems: 'start',
            }}
          >
            <Box>
              {/* No status yet: nothing is known about the connection, so the page claims nothing. */}
              {!status && loading && <PageSkeleton rows={4} />}
              {status && (
                <Stack component="section" aria-labelledby="of-institution" aria-busy={loading} spacing={3}>
                  <Stack direction="row" alignItems="center" flexWrap="wrap" sx={{ columnGap: 2, rowGap: 1.5 }}>
                    <IconTile name="bank" size={44} />
                    <Box sx={{ flex: '1 1 180px', minWidth: 0 }}>
                      <Typography id="of-institution" variant="h5" component="h2" sx={{ overflowWrap: 'anywhere' }}>
                        {status.institutionName || t('openFinance.bankPlaceholder')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" component="p">
                        {status.simulated ? t('openFinance.contractSandbox') : t('openFinance.participantSandbox')}
                      </Typography>
                    </Box>
                    <Chip
                      color={STATUS_COLOR[state] || 'default'}
                      label={t(`openFinance.status.${state}`)}
                      sx={{ flexShrink: 0 }}
                    />
                  </Stack>

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

                  <Box component="ol" aria-label={t('openFinance.steps.label')} sx={{ m: 0, p: 0, listStyle: 'none' }}>
                    {steps.map((step, index) => (
                      <Step
                        key={step.key}
                        id={`of-step-${step.key}`}
                        number={index + 1}
                        title={t(`openFinance.steps.${step.key}`)}
                        hint={t(`openFinance.steps.${step.key}Hint`)}
                        done={step.done}
                        // Connected, sync and revoke are both available: the two last steps are "now" together.
                        now={index === current || (current === 2 && step.key === 'revoke')}
                        last={index === steps.length - 1}
                      >
                        {step.body || null}
                      </Step>
                    ))}
                  </Box>
                  <Typography variant="caption" color="text.secondary" component="p">
                    {t(status.simulated ? 'openFinance.notice.contract' : 'openFinance.notice.participant')}
                  </Typography>
                </Stack>
              )}
            </Box>

            {permissionsAside}
          </Box>
        )}
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
