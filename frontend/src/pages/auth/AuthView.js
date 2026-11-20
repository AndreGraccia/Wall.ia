import { useRef, useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { Alert, Box, IconButton, InputAdornment, Link, Stack, TextField, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { LoadingButton } from '@mui/lab';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { enqueueSnackbar } from 'notistack';
import PropTypes from 'prop-types';
import LanguageSelector from '../../components/language-selector';
import { WalliaLogo } from '../../components/brand';
import { WalletIcon } from '../../components/wallet-ui';
import AuthService from '../../services/AuthService';
import { safeReturnPath } from '../../services/HttpService';
import { errorKey } from '../../utils/wallet';
import EmailCode from './EmailCode';

/**
 * The balance line drawing itself (the one orchestrated moment, 600 ms, off with prefers-reduced-motion):
 * solid until today, dashed after it, dipping below zero between the card bill and the paycheck.
 */
function BalanceLine() {
  const theme = useTheme();
  const { palette } = theme;
  return (
    <Box component="svg" viewBox="0 0 480 200" aria-hidden="true" sx={{ width: '100%', display: 'block' }}>
      <line x1="0" x2="480" y1="130" y2="130" stroke={palette.chart.zero} strokeWidth="1" />
      <text x="480" y="122" textAnchor="end" fontSize="12" fill={palette.text.secondary}>
        R$ 0
      </text>
      <g>
        <path d="M268 130 L292 172 L352 182 L364 130 Z" fill={palette.chart.negative} />
        <path
          d="M0 74 L48 92 L96 58 L146 80 L196 50"
          fill="none"
          stroke={palette.chart.history}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M196 50 L244 88 L292 172 L352 182 L380 64 L430 82 L480 70"
          fill="none"
          stroke={palette.chart.projection}
          strokeWidth="2.5"
          strokeDasharray="7 6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx="196"
          cy="50"
          r="6"
          fill={palette.brand.future}
          stroke={palette.background.default}
          strokeWidth="3"
        />
      </g>
      <rect
        width="480"
        height="200"
        fill={palette.background.default}
        style={{
          transformBox: 'fill-box',
          transformOrigin: 'right',
          animation: 'wallia-reveal 600ms cubic-bezier(0.2, 0.7, 0.2, 1) both',
        }}
      />
    </Box>
  );
}

export default function AuthView({ signup = false }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const group = signup ? 'signup' : 'login';
  const [values, setValues] = useState({ username: '', password: '', firstName: '', lastName: '', email: '' });
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // Waiting for the e-mail code. Holds the password typed a moment ago, in memory only (never storage),
  // to sign in right after the code is confirmed.
  const [pending, setPending] = useState(null);
  const sending = useRef(false);
  const enter = async (username, password) => {
    await AuthService.login({ username, password });
    // `state.from` comes from PrivateRoute, `?from=` from an expired session (HttpService).
    const from = location.state?.from ?? new URLSearchParams(location.search).get('from');
    navigate(safeReturnPath(from), { replace: true });
  };
  const afterVerified = async () => {
    try {
      await enter(pending.login, pending.password);
    } catch {
      // Confirmed, but the automatic sign-in failed (password changed, rate limit): the login form says why.
      setPending(null);
      setValues((previous) => ({ ...previous, password: '' }));
      enqueueSnackbar(t('auth.verify.verified'), { variant: 'success' });
      if (signup) navigate('/login', { replace: true });
    }
  };
  const submit = async (event) => {
    event.preventDefault();
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    try {
      if (signup) {
        const username = values.username.trim();
        const answer = await AuthService.signup({
          ...values,
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          username,
          email: values.email.trim(),
        });
        setPending({ login: username, password: values.password, ...answer });
      } else {
        await enter(values.username.trim(), values.password);
      }
    } catch (failure) {
      const key = errorKey(failure);
      if (!signup && key === 'app.errors.EMAIL_NOT_VERIFIED') {
        // Right password, e-mail never confirmed: same code screen as after sign-up, with a resend.
        setPending({ login: values.username.trim(), password: values.password, maskedEmail: null });
        setError(null);
        return;
      }
      setError(!signup && failure.response?.status === 401 ? 'app.errors.credentials' : key);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };
  const fields = signup ? ['firstName', 'lastName', 'username', 'email', 'password'] : ['username', 'password'];
  return (
    <>
      <Helmet>
        <title>{t(pending ? 'auth.verify.pageTitle' : `auth.${group}.pageTitle`)}</title>
      </Helmet>
      <Box sx={{ minHeight: '100vh', display: 'flex', bgcolor: { xs: 'background.paper', md: 'background.default' } }}>
        <Box
          sx={{
            display: { xs: 'none', md: 'flex' },
            flex: 1,
            minWidth: 0,
            p: { md: 6, lg: 8 },
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <WalliaLogo size={24} />
          <Box sx={{ maxWidth: 560 }}>
            <BalanceLine />
            <Typography variant="h2" component="p" sx={{ mt: 5, maxWidth: 480 }}>
              {t('app.authHeadline')}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
            {t('app.demoNotice')}
          </Typography>
        </Box>
        <Box
          sx={{
            width: { xs: '100%', md: 480, lg: 520 },
            flexShrink: 0,
            bgcolor: 'background.paper',
            borderLeft: { md: '1px solid' },
            borderColor: { md: 'divider' },
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ px: { xs: 2, sm: 4 }, py: 3 }}
          >
            <Box sx={{ visibility: { md: 'hidden' } }}>
              <WalliaLogo size={20} />
            </Box>
            <LanguageSelector />
          </Stack>
          <Box sx={{ px: { xs: 2, sm: 6 }, py: { xs: 3, md: 0 }, my: { md: 'auto' }, pb: { md: 12 } }}>
            <Typography variant="h3" component="h1" sx={{ mb: pending ? 3 : 1 }}>
              {pending ? t('auth.verify.title') : t(`auth.${group}.title`)}
            </Typography>
            {pending && (
              <EmailCode
                login={pending.login}
                maskedEmail={pending.maskedEmail}
                resendAvailableAt={pending.resendAvailableAt}
                onVerified={afterVerified}
                onBack={() => setPending(null)}
              />
            )}
            {!pending && (
              <>
                <Typography color="text.secondary" sx={{ mb: 4 }}>
                  {t(signup ? 'auth.signup.hasAccount' : 'auth.login.noAccount')}{' '}
                  <Link component={RouterLink} to={signup ? '/login' : '/signup'} sx={{ color: 'text.primary' }}>
                    {t(signup ? 'auth.signup.login' : 'auth.login.createAccount')}
                  </Link>
                </Typography>
                <Box component="form" onSubmit={submit}>
                  <Stack spacing={2.5}>
                    {error && <Alert severity="error">{t(error)}</Alert>}
                    {fields.map((field) => (
                      <TextField
                        key={field}
                        label={t(`auth.${group}.${field}`)}
                        name={field}
                        required
                        fullWidth
                        value={values[field]}
                        onChange={(event) => setValues({ ...values, [field]: event.target.value })}
                        autoComplete={
                          {
                            firstName: 'given-name',
                            lastName: 'family-name',
                            username: 'username',
                            password: signup ? 'new-password' : 'current-password',
                            email: 'email',
                          }[field]
                        }
                        type={
                          field === 'password' ? (visible ? 'text' : 'password') : field === 'email' ? 'email' : 'text'
                        }
                        inputProps={{
                          minLength: signup ? (field === 'password' ? 10 : field === 'email' ? 6 : 3) : 1,
                          maxLength: field === 'password' ? 100 : field === 'username' && signup ? 20 : 50,
                          // Phones capitalize the first letter by default; "Gui_oliveira" used to fail the login.
                          ...(field === 'username' || field === 'email'
                            ? { autoCapitalize: 'none', spellCheck: false }
                            : {}),
                        }}
                        helperText={signup && field === 'password' ? t('app.passwordHelp') : undefined}
                        InputProps={
                          field === 'password'
                            ? {
                                endAdornment: (
                                  <InputAdornment position="end">
                                    <IconButton
                                      aria-label={t(visible ? 'common.hidePassword' : 'common.showPassword')}
                                      onClick={() => setVisible(!visible)}
                                    >
                                      <WalletIcon name="eye" />
                                    </IconButton>
                                  </InputAdornment>
                                ),
                              }
                            : undefined
                        }
                      />
                    ))}
                    <LoadingButton type="submit" variant="contained" size="large" loading={busy}>
                      {t(`auth.${group}.submit`)}
                    </LoadingButton>
                    <Typography variant="caption" color="text.secondary" sx={{ display: { md: 'none' } }}>
                      {t('app.demoNotice')}
                    </Typography>
                  </Stack>
                </Box>
              </>
            )}
          </Box>
        </Box>
      </Box>
    </>
  );
}
AuthView.propTypes = { signup: PropTypes.bool };
