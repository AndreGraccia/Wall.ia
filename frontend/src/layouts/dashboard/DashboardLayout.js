import { Suspense, useEffect, useRef, useState } from 'react';
import { Link as RouterLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Avatar,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Button,
  Chip,
  ClickAwayListener,
  Container,
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { enqueueSnackbar } from 'notistack';
import { WalletProvider } from '../../context/WalletContext';
import LanguageSelector from '../../components/language-selector';
import { PageSkeleton, WalletIcon } from '../../components/wallet-ui';
import { WalliaLogo } from '../../components/brand';
import { forgetThisBrowser } from '../../utils/push';
import AuthService from '../../services/AuthService';
import HttpService from '../../services/HttpService';
import { errorKey } from '../../utils/wallet';

export default function DashboardLayout() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const user = AuthService.getCurrentUser();
  const [accountOpen, setAccountOpen] = useState(false);
  const accountButton = useRef(null);
  // Esc closes the panel from anywhere (focus may be on the avatar, not inside it) and returns focus.
  useEffect(() => {
    if (!accountOpen) return undefined;
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      setAccountOpen(false);
      accountButton.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [accountOpen]);
  // `mobile` items fit the bottom bar (5 max); the rest live in the account panel on small screens.
  const items = [
    { path: '/', label: 'navigation.dashboard', icon: 'home', mobile: true },
    { path: '/future', label: 'navigation.future', icon: 'future', mobile: true },
    { path: '/ask', label: 'navigation.ask', icon: 'ask' },
    { path: '/wallets', label: 'navigation.wallets', icon: 'wallet', mobile: true },
    { path: '/commitments', label: 'navigation.commitments', icon: 'card' },
    { path: '/billing-radar', label: 'navigation.billingRadar', icon: 'insights' },
    { path: '/envelopes', label: 'navigation.envelopes', icon: 'envelope', mobile: true },
    { path: '/transactions', label: 'navigation.transactions', icon: 'history', mobile: true },
    { path: '/insights', label: 'navigation.insights', icon: 'insights' },
    { path: '/open-finance', label: 'navigation.openFinance', icon: 'bank' },
    // Aggregates for the team; the route itself also checks the role.
    ...(user?.roles?.includes('ROLE_ADMIN')
      ? [{ path: '/admin/metrics', label: 'navigation.metrics', icon: 'insights' }]
      : []),
  ];
  const mobileItems = items.filter((item) => item.mobile);
  const current =
    items.find((item) => (item.path === '/' ? pathname === '/' : pathname.startsWith(item.path)))?.path || false;
  const mobileCurrent = mobileItems.some((item) => item.path === current) ? current : false;
  const logout = async () => {
    // Needs the session token, so it runs before the logout; never more than 2s of waiting.
    await Promise.race([forgetThisBrowser(), new Promise((resolve) => setTimeout(resolve, 2000))]);
    AuthService.logout();
    navigate('/login', { replace: true });
  };
  // A JWT cannot be revoked alone: the server stops accepting every token issued so far (V28).
  const logoutEverywhere = async () => {
    try {
      await HttpService.postWithAuth('/auth/logout', {});
    } catch (failure) {
      enqueueSnackbar(t(errorKey(failure)), { variant: 'error' });
      return;
    }
    await logout();
  };
  return (
    <WalletProvider>
      <Box sx={{ minHeight: '100vh', display: 'flex' }}>
        <Box
          component="aside"
          sx={{
            width: 240,
            position: 'fixed',
            inset: '0 auto 0 0',
            bgcolor: 'background.paper',
            borderRight: '1px solid',
            borderColor: 'divider',
            p: 2.5,
            display: { xs: 'none', lg: 'flex' },
            flexDirection: 'column',
          }}
        >
          <Box component={RouterLink} to="/" aria-label="Wall.ia" sx={{ px: 1, py: 2, mb: 4, textDecoration: 'none' }}>
            <WalliaLogo size={34} />
          </Box>
          <Stack component="nav" spacing={0.75} aria-label={t('app.navigation')}>
            {items.map((item) => (
              <Button
                key={item.path}
                component={RouterLink}
                to={item.path}
                aria-current={current === item.path ? 'page' : undefined}
                startIcon={<WalletIcon name={item.icon} />}
                sx={{
                  justifyContent: 'flex-start',
                  px: 2,
                  gap: 1,
                  color: current === item.path ? 'text.primary' : 'text.secondary',
                  bgcolor: current === item.path ? 'background.neutral' : 'transparent',
                  boxShadow: (theme) =>
                    current === item.path ? `inset 3px 0 0 ${theme.palette.primary.main}` : 'none',
                }}
              >
                {t(item.label)}
              </Button>
            ))}
          </Stack>
          <Box sx={{ flexGrow: 1 }} />
          <Chip label={t('app.demo')} size="small" sx={{ alignSelf: 'flex-start', mb: 1.5 }} />
          <Typography variant="caption" color="text.secondary" sx={{ px: 0.5, mb: 2 }}>
            {t('app.demoNotice')}
          </Typography>
          <Button
            component={RouterLink}
            to="/about"
            startIcon={<WalletIcon name="info" />}
            sx={{ justifyContent: 'flex-start', color: 'text.secondary' }}
          >
            {t('app.about')}
          </Button>
        </Box>
        <Box sx={{ flex: 1, minWidth: 0, ml: { lg: '240px' } }}>
          <Box
            component="header"
            sx={{
              position: 'sticky',
              top: 0,
              zIndex: 1100,
              bgcolor: (theme) => alpha(theme.palette.background.default, 0.86),
              backdropFilter: 'blur(20px)',
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Container maxWidth="lg">
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ minHeight: 76 }}>
                {/* At 375 px logo + chip + language + avatar do not fit: the chip gives way (ellipsis). */}
                <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                  <Box sx={{ display: { lg: 'none' }, flexShrink: 0 }}>
                    <WalliaLogo size={28} />
                  </Box>
                  <Chip size="small" label={t('app.demo')} sx={{ bgcolor: 'background.neutral', minWidth: 0 }} />
                </Stack>
                <Stack direction="row" spacing={{ xs: 0.5, sm: 1.5 }} alignItems="center" sx={{ flexShrink: 0 }}>
                  <LanguageSelector />
                  <Tooltip title={t('common.account')}>
                    <IconButton
                      ref={accountButton}
                      onClick={() => setAccountOpen(!accountOpen)}
                      aria-label={t('common.account')}
                      aria-expanded={accountOpen}
                      aria-controls="account-panel"
                    >
                      <Avatar
                        sx={{
                          width: 34,
                          height: 34,
                          bgcolor: 'background.raised',
                          color: 'text.primary',
                          fontSize: 14,
                        }}
                      >
                        {user?.firstName?.[0] || 'U'}
                      </Avatar>
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Stack>
              {accountOpen && (
                <ClickAwayListener
                  onClickAway={(event) => {
                    // The avatar toggles on its own; closing here too would reopen it on the same click.
                    if (!accountButton.current?.contains(event.target)) setAccountOpen(false);
                  }}
                >
                  <Stack
                    id="account-panel"
                    direction={{ xs: 'column', sm: 'row' }}
                    alignItems={{ sm: 'center' }}
                    flexWrap="wrap"
                    sx={{ pb: 2, gap: 1 }}
                  >
                    <Typography variant="body2" sx={{ flex: 1, flexBasis: { sm: '100%', lg: 0 } }}>
                      {user?.firstName} {user?.lastName}
                    </Typography>
                    {items
                      .filter((item) => !item.mobile)
                      .map((item) => (
                        <Button
                          key={item.path}
                          component={RouterLink}
                          to={item.path}
                          onClick={() => setAccountOpen(false)}
                          startIcon={<WalletIcon name={item.icon} />}
                          sx={{ display: { lg: 'none' } }}
                        >
                          {t(item.label)}
                        </Button>
                      ))}
                    <Button component={RouterLink} to="/about" onClick={() => setAccountOpen(false)}>
                      {t('app.about')}
                    </Button>
                    <Button component={RouterLink} to="/privacy" onClick={() => setAccountOpen(false)}>
                      {t('app.privacy')}
                    </Button>
                    <Button onClick={logout} startIcon={<WalletIcon name="logout" />}>
                      {t('actions.logout')}
                    </Button>
                    <Button color="inherit" onClick={logoutEverywhere}>
                      {t('actions.logoutEverywhere')}
                    </Button>
                  </Stack>
                </ClickAwayListener>
              )}
            </Container>
          </Box>
          <Box component="main" sx={{ pt: { xs: 3, md: 5 }, pb: { xs: 14, lg: 6 } }}>
            <Suspense
              fallback={
                <Container maxWidth="lg">
                  <PageSkeleton />
                </Container>
              }
            >
              <Outlet />
            </Suspense>
          </Box>
        </Box>
        <Box
          sx={{
            display: { lg: 'none' },
            position: 'fixed',
            bottom: 0,
            right: 0,
            left: 0,
            zIndex: 1200,
            pb: 'env(safe-area-inset-bottom)',
            bgcolor: (theme) => alpha(theme.palette.background.paper, 0.95),
            backdropFilter: 'blur(20px)',
          }}
        >
          <Divider />
          <BottomNavigation showLabels value={mobileCurrent} sx={{ height: 70, bgcolor: 'transparent' }}>
            {mobileItems.map((item) => (
              <BottomNavigationAction
                key={item.path}
                component={RouterLink}
                to={item.path}
                value={item.path}
                label={t(item.label)}
                icon={<WalletIcon name={item.icon} />}
                sx={{ minWidth: 0, px: 0.5, '& .MuiBottomNavigationAction-label': { fontSize: '0.7rem' } }}
              />
            ))}
          </BottomNavigation>
        </Box>
      </Box>
    </WalletProvider>
  );
}
