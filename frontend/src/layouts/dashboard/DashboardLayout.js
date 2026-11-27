import { Suspense, useLayoutEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Link as RouterLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Avatar,
  Box,
  ButtonBase,
  Chip,
  Container,
  Divider,
  Drawer,
  IconButton,
  ListSubheader,
  Menu,
  MenuItem,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { enqueueSnackbar } from 'notistack';
import { WalletProvider } from '../../context/WalletContext';
import { PageSkeleton, SHELL_ACTIONS_WIDTH, WalletIcon } from '../../components/wallet-ui';
import { WalliaLogo } from '../../components/brand';
import { forgetThisBrowser } from '../../utils/push';
import AuthService from '../../services/AuthService';
import HttpService from '../../services/HttpService';
import { errorKey } from '../../utils/wallet';
import { useHiddenAmounts } from '../../utils/hiddenAmounts';
import { COARSE, TOUCH_TARGET } from '../../theme/touch';
import { setOnboardingDismissed, useOnboardingDismissed } from '../../utils/onboarding';

// Shell layout (docs/brand/DESIGN.md): side menu from 1024 px, bottom bar below it.
const DESKTOP = '@media (min-width:1024px)';
const SIDEBAR = 232;

function groupsFor(user) {
  return [
    {
      key: 'overview',
      items: [
        { path: '/', label: 'navigation.dashboard', icon: 'home' },
        { path: '/future', label: 'navigation.future', icon: 'future' },
        { path: '/plan', label: 'navigation.plan', icon: 'plan' },
      ],
    },
    {
      key: 'money',
      items: [
        { path: '/cash-flow', label: 'navigation.cashFlow', icon: 'flow' },
        { path: '/transactions', label: 'navigation.transactions', icon: 'history' },
        { path: '/envelopes', label: 'navigation.envelopes', icon: 'envelope' },
      ],
    },
    {
      key: 'debts',
      items: [
        { path: '/commitments', label: 'navigation.commitments', icon: 'card' },
        { path: '/billing-radar', label: 'navigation.billingRadar', icon: 'shield' },
      ],
    },
    {
      key: 'more',
      items: [
        { path: '/insights', label: 'navigation.insights', icon: 'insights' },
        { path: '/wallets', label: 'navigation.wallets', icon: 'wallet' },
        { path: '/open-finance', label: 'navigation.openFinance', icon: 'bank' },
        // Aggregates for the team; the route itself also checks the role.
        ...(user?.roles?.includes('ROLE_ADMIN')
          ? [{ path: '/admin/metrics', label: 'navigation.metrics', icon: 'insights' }]
          : []),
      ],
    },
  ];
}

const isActive = (path, pathname) => (path === '/' ? pathname === '/' : pathname.startsWith(path));
const pathsOf = (item) => [item.path, ...(item.also || [])];

function NavItem({ item, active, onClick }) {
  const { t } = useTranslation();
  return (
    <ButtonBase
      component={RouterLink}
      to={item.path}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      sx={{
        width: '100%',
        minHeight: 40,
        [COARSE]: { minHeight: TOUCH_TARGET },
        px: 1.5,
        gap: 1.5,
        justifyContent: 'flex-start',
        borderRadius: '12px',
        typography: 'subtitle2',
        color: active ? 'text.primary' : 'text.secondary',
        bgcolor: active ? 'background.neutral' : 'transparent',
        transition: 'background-color 150ms, color 150ms',
        '&:hover': { color: 'text.primary', bgcolor: active ? 'background.neutral' : 'action.hover' },
      }}
    >
      <WalletIcon name={item.icon} sx={{ fontSize: 18 }} />
      {t(item.label)}
    </ButtonBase>
  );
}
NavItem.propTypes = { item: PropTypes.object.isRequired, active: PropTypes.bool, onClick: PropTypes.func };

function NavGroups({ groups, pathname, onNavigate }) {
  const { t } = useTranslation();
  return groups.map((group) => (
    <Box key={group.key} component="nav" aria-label={t(`navigation.groups.${group.key}`)} sx={{ mb: 2.5 }}>
      <Typography variant="caption" color="text.disabled" component="p" sx={{ px: 1.5, mb: 0.5, fontWeight: 500 }}>
        {t(`navigation.groups.${group.key}`)}
      </Typography>
      <Stack spacing={0.25}>
        {group.items.map((item) => (
          <NavItem key={item.path} item={item} active={isActive(item.path, pathname)} onClick={onNavigate} />
        ))}
      </Stack>
    </Box>
  ));
}

/** "Ambiente simulado", once, at the foot of the menu; the explanation lives in the tooltip. */
function DemoSeal() {
  const { t } = useTranslation();
  return (
    <Tooltip title={t('app.demoNotice')}>
      <Chip
        size="small"
        variant="outlined"
        label={t('app.demo')}
        tabIndex={0}
        sx={{
          alignSelf: 'flex-start',
          '&:focus-visible': { outline: '2px solid', outlineColor: 'secondary.main', outlineOffset: 2 },
        }}
      />
    </Tooltip>
  );
}

/**
 * On desktop the header actions are pinned over the page title's line. Their measured width goes to a CSS variable
 * that PageHeading leaves free, so one action more or less (or a longer one) never covers a page control.
 */
function usePublishedWidth() {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const node = ref.current;
    const root = document.documentElement.style;
    const publish = () => root.setProperty(SHELL_ACTIONS_WIDTH, `${node.offsetWidth}px`);
    publish();
    const observer = window.ResizeObserver && new window.ResizeObserver(publish);
    observer?.observe(node);
    return () => {
      observer?.disconnect();
      root.removeProperty(SHELL_ACTIONS_WIDTH);
    };
  }, []);
  return ref;
}

export default function DashboardLayout() {
  const { t, i18n } = useTranslation();
  const english = i18n.resolvedLanguage?.startsWith('en');
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const user = AuthService.getCurrentUser();
  const [accountAnchor, setAccountAnchor] = useState(null);
  const [hidden, toggleHidden] = useHiddenAmounts();
  const onboardingOff = useOnboardingDismissed(user?.id);
  const [moreOpen, setMoreOpen] = useState(false);
  const actionsRef = usePublishedWidth();
  const groups = groupsFor(user);
  // Phone: five destinations, the daily questions (ADR 0022); "Mais" opens a sheet with everything else.
  // "Perguntar" is an action in the top bar, on every screen, not a place.
  const bottom = [
    { path: '/', label: 'navigation.dashboard', icon: 'home' },
    { path: '/future', label: 'navigation.future', icon: 'future' },
    // Short labels: five columns of 78 px at 390 px cannot fit "Plano do mês" next to "Compromissos".
    { path: '/plan', label: 'navigation.planShort', icon: 'plan' },
    { path: '/commitments', label: 'navigation.debtsShort', icon: 'card', also: ['/billing-radar'] },
  ];
  const bottomActive = (item) => pathsOf(item).some((path) => isActive(path, pathname));
  const inMore = !bottom.some(bottomActive);

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
  const closeAccount = () => setAccountAnchor(null);

  return (
    <WalletProvider>
      <Box sx={{ minHeight: '100vh' }}>
        <Box
          component="aside"
          sx={{
            display: 'none',
            [DESKTOP]: { display: 'flex' },
            width: SIDEBAR,
            position: 'fixed',
            inset: '0 auto 0 0',
            flexDirection: 'column',
            bgcolor: 'background.paper',
            borderRight: '1px solid',
            borderColor: 'divider',
            px: 1.5,
            py: 3,
            overflowY: 'auto',
          }}
        >
          <Box component={RouterLink} to="/" sx={{ px: 1.5, mb: 4, textDecoration: 'none', alignSelf: 'flex-start' }}>
            <WalliaLogo size={22} />
          </Box>
          <NavGroups groups={groups} pathname={pathname} />
          <Box sx={{ flexGrow: 1 }} />
          <Box sx={{ px: 1.5, pt: 2 }}>
            <DemoSeal />
          </Box>
        </Box>

        <Box sx={{ position: 'relative', minWidth: 0, [DESKTOP]: { ml: `${SIDEBAR}px` } }}>
          {/* No bar background: on desktop the account button shares the page title's line. */}
          <Container
            component="header"
            maxWidth="lg"
            sx={{
              height: 64,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              [DESKTOP]: {
                position: 'absolute',
                top: 24,
                left: 0,
                right: 0,
                height: 72,
                justifyContent: 'flex-end',
                pointerEvents: 'none',
                '& > *': { pointerEvents: 'auto' },
              },
            }}
          >
            <Box component={RouterLink} to="/" sx={{ textDecoration: 'none', [DESKTOP]: { display: 'none' } }}>
              <WalliaLogo size={20} />
            </Box>
            <Stack ref={actionsRef} direction="row" alignItems="center" spacing={0.5} sx={{ ml: 'auto' }}>
              {!isActive('/ask', pathname) && (
                <Tooltip title={t('app.askAction')}>
                  <IconButton component={RouterLink} to="/ask" aria-label={t('app.askAction')}>
                    <WalletIcon name="ask" sx={{ fontSize: 20 }} />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title={t(hidden ? 'app.showBalance' : 'app.hideBalance')}>
                <IconButton
                  onClick={toggleHidden}
                  aria-label={t(hidden ? 'app.showBalance' : 'app.hideBalance')}
                  aria-pressed={hidden}
                >
                  <WalletIcon name={hidden ? 'eyeOff' : 'eye'} sx={{ fontSize: 20 }} />
                </IconButton>
              </Tooltip>
              <IconButton
                onClick={(event) => setAccountAnchor(event.currentTarget)}
                aria-label={t('common.account')}
                aria-haspopup="menu"
                aria-expanded={Boolean(accountAnchor)}
                aria-controls={accountAnchor ? 'account-menu' : undefined}
                sx={{ p: 0.5 }}
              >
                <Avatar
                  sx={{ width: 32, height: 32, bgcolor: 'background.neutral', color: 'text.primary', fontSize: 14 }}
                >
                  {user?.firstName?.[0] || 'U'}
                </Avatar>
              </IconButton>
            </Stack>
          </Container>
          <Menu
            id="account-menu"
            anchorEl={accountAnchor}
            open={Boolean(accountAnchor)}
            onClose={closeAccount}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            MenuListProps={{ sx: { minWidth: 240, py: 1 } }}
          >
            <ListSubheader sx={{ bgcolor: 'transparent', lineHeight: 1.4, py: 1, color: 'text.primary' }}>
              {user?.firstName} {user?.lastName}
            </ListSubheader>
            {/* A menu item, not the PT/EN toggle: inside a menu, Tab closes it, so only items are reachable. */}
            <MenuItem
              lang={english ? 'pt-BR' : 'en'}
              onClick={() => {
                i18n.changeLanguage(english ? 'pt' : 'en');
                closeAccount();
              }}
            >
              {english ? 'Português' : 'English'}
            </MenuItem>
            <Divider />
            {onboardingOff && (
              <MenuItem
                component={RouterLink}
                to="/"
                onClick={() => {
                  setOnboardingDismissed(user?.id, false);
                  closeAccount();
                }}
              >
                {t('onboarding.resume')}
              </MenuItem>
            )}
            <MenuItem component={RouterLink} to="/about" onClick={closeAccount}>
              {t('app.about')}
            </MenuItem>
            <MenuItem component={RouterLink} to="/privacy" onClick={closeAccount}>
              {t('app.privacy')}
            </MenuItem>
            <Divider />
            <MenuItem onClick={logout}>{t('actions.logout')}</MenuItem>
            <MenuItem onClick={logoutEverywhere} sx={{ color: 'text.secondary' }}>
              {t('actions.logoutEverywhere')}
            </MenuItem>
          </Menu>

          <Box
            component="main"
            sx={{ pt: 1, pb: 'calc(96px + env(safe-area-inset-bottom))', [DESKTOP]: { pt: 3, pb: 8 } }}
          >
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
          component="nav"
          aria-label={t('app.navigation')}
          sx={{
            [DESKTOP]: { display: 'none' },
            position: 'fixed',
            bottom: 0,
            right: 0,
            left: 0,
            zIndex: 1200,
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            pb: 'env(safe-area-inset-bottom)',
            bgcolor: 'background.paper',
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          {bottom.map((item) => (
            <BottomItem
              key={item.path}
              component={RouterLink}
              to={item.path}
              icon={item.icon}
              label={t(item.label)}
              active={bottomActive(item)}
            />
          ))}
          <BottomItem
            icon="menu"
            label={t('navigation.more')}
            active={inMore}
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
          />
        </Box>
        <Drawer
          anchor="bottom"
          open={moreOpen}
          onClose={() => setMoreOpen(false)}
          PaperProps={{
            sx: {
              borderRadius: '20px 20px 0 0',
              borderTop: '1px solid',
              borderColor: 'divider',
              px: 1.5,
              pt: 1,
              pb: 'calc(16px + env(safe-area-inset-bottom))',
              maxHeight: '85vh',
            },
          }}
        >
          <Box aria-hidden sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: 'divider', mx: 'auto', mb: 2 }} />
          <NavGroups
            groups={groups
              .map((group) => ({
                ...group,
                // What a bar item already covers (its path and the screens under it) is not repeated here.
                items: group.items.filter((item) => !bottom.some((entry) => pathsOf(entry).includes(item.path))),
              }))
              .filter((group) => group.items.length)}
            pathname={pathname}
            onNavigate={() => setMoreOpen(false)}
          />
          <Box sx={{ px: 1.5 }}>
            <DemoSeal />
          </Box>
        </Drawer>
      </Box>
    </WalletProvider>
  );
}

function BottomItem({ icon, label, active, ...props }) {
  return (
    <ButtonBase
      {...props}
      aria-current={active && props.to ? 'page' : undefined}
      sx={{
        minHeight: 60,
        flexDirection: 'column',
        gap: 0.5,
        typography: 'caption',
        fontWeight: 500,
        color: active ? 'text.primary' : 'text.secondary',
        '& svg': { fontSize: 20 },
      }}
    >
      <WalletIcon name={icon} />
      {label}
    </ButtonBase>
  );
}
BottomItem.propTypes = {
  icon: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  active: PropTypes.bool,
  to: PropTypes.string,
};
