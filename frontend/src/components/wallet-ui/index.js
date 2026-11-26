import { useId, useState } from 'react';
import { Alert, Box, Button, ButtonBase, Card, Collapse, Skeleton, Stack, SvgIcon, Typography } from '@mui/material';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useWallets } from '../../context/WalletContext';
import { dateTime, directionFor, money } from '../../utils/wallet';

// Read by screen readers, invisible on screen (same rule as MUI's visuallyHidden).
export const visuallyHidden = {
  border: 0,
  clip: 'rect(0 0 0 0)',
  height: '1px',
  margin: '-1px',
  overflow: 'hidden',
  padding: 0,
  position: 'absolute',
  whiteSpace: 'nowrap',
  width: '1px',
};

const paths = {
  wallet: 'M3 7h17v13H3V4h14v3M20 11h-5v5h5M16.5 13.5h.01',
  home: 'm3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9',
  history: 'M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2',
  send: 'm4 4 17 8-17 8 3-8-3-8Zm3 8h14',
  plus: 'M12 5v14M5 12h14',
  down: 'M12 4v16m-6-6 6 6 6-6',
  up: 'M12 20V4m-6 6 6-6 6 6',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  back: 'M19 12H5m5-5-5 5 5 5',
  check: 'm5 12 4 4L19 6',
  user: 'M20 21v-2a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v2M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  logout: 'M9 4H4v16h5m5-13 5 5-5 5M8 12h11',
  eye: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  eyeOff:
    'M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c7 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6C3.7 8.4 2 12 2 12s3 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2',
  info: 'M12 11v6m0-10h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  copy: 'M9 9h12v12H9V9ZM15 9V3H3v12h6',
  swap: 'M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4',
  insights: 'M4 19V9m5 10V5m5 14v-7m5 7V3M3 19h18M17 7l2-2 2 2M19 5v6',
  shield: 'M12 3 5 6v5c0 4.6 2.9 8.8 7 10 4.1-1.2 7-5.4 7-10V6l-7-3Zm-3 9 2 2 4-5',
  book: 'M4 5a3 3 0 0 1 3-2h5v17H7a3 3 0 0 0-3 3V5Zm8-2h5a3 3 0 0 1 3 3v17a3 3 0 0 0-3-3h-5',
  bank: 'M3 9h18L12 3 3 9Zm2 3v7m5-7v7m4-7v7m5-7v7M3 21h18',
  sync: 'M20 7h-6V1m6 6-3-3a8 8 0 0 0-13 3m0 10h6v6m-6-6 3 3a8 8 0 0 0 13-3',
  future: 'M3 17l5-6 4 4 3-4M17.5 9.5h.01M20 6.5h.01M3 21h18',
  card: 'M3 6h18v12H3V6Zm0 4h18M7 15h4',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6m4-6v6',
  envelope: 'M3 6h18v12H3V6Zm0 0 9 7 9-7',
  ask: 'M4 5h16v11H9l-5 4V5Zm6.5 3.5a1.5 1.5 0 1 1 2.2 1.3c-.5.3-.7.7-.7 1.2M12 13.5h.01',
  chevron: 'm6 9 6 6 6-6',
  menu: 'M4 7h16M4 12h16M4 17h16',
  // Month plan: the income as one circle cut into slices.
  plan: 'M12 3v9l6.4 6.4M12 12H3M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  // Money in and out: one arrow down, one up.
  flow: 'M8 4v16m0 0-3-3m3 3 3-3M16 20V4m0 0-3 3m3-3 3 3',
};
export function WalletIcon({ name, ...props }) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      <path
        d={paths[name] || paths.wallet}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </SvgIcon>
  );
}
WalletIcon.propTypes = { name: PropTypes.string };
/** Square icon badge: a quiet glyph on surface2. Icons are never coloured for decoration (DESIGN.md). */
export function IconTile({ name, size = 54, sx }) {
  return (
    <Box
      aria-hidden="true"
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: '12px',
        bgcolor: 'background.neutral',
        color: 'text.secondary',
        display: 'grid',
        placeItems: 'center',
        ...sx,
      }}
    >
      <WalletIcon name={name} sx={{ fontSize: Math.round(size * 0.44) }} />
    </Box>
  );
}
IconTile.propTypes = { name: PropTypes.string.isRequired, size: PropTypes.number, sx: PropTypes.object };
/**
 * The page title row. On desktop it shares the top line with the account button, which the shell pins to the
 * top right (DashboardLayout), so it keeps that corner free.
 */
export function PageHeading({ title, description, action }) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      flexWrap="wrap"
      sx={{
        gap: 2,
        minHeight: { md: 72 },
        mb: { xs: 3, md: 4 },
        '@media (min-width:1024px)': { pr: 12 },
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h3" component="h1">
          {title}
        </Typography>
        {description && (
          <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: 640 }}>
            {description}
          </Typography>
        )}
      </Box>
      {action}
    </Stack>
  );
}
PageHeading.propTypes = { title: PropTypes.string, description: PropTypes.string, action: PropTypes.node };
export function EmptyState({ title, description, action, icon = 'wallet' }) {
  return (
    <Stack alignItems="center" spacing={1.5} sx={{ py: 6, px: 3, textAlign: 'center' }}>
      <WalletIcon name={icon} aria-hidden sx={{ fontSize: 28, color: 'text.secondary', mb: 0.5 }} />
      <Typography variant="h6" component="h2">
        {title}
      </Typography>
      {description && (
        <Typography color="text.secondary" variant="body2" sx={{ maxWidth: 360 }}>
          {description}
        </Typography>
      )}
      {action && <Box sx={{ pt: 1 }}>{action}</Box>}
    </Stack>
  );
}
EmptyState.propTypes = {
  title: PropTypes.string,
  description: PropTypes.string,
  action: PropTypes.node,
  icon: PropTypes.string,
};
/**
 * Placeholder with the shape of a page: a summary card and `rows` list lines, so nothing jumps when the
 * data arrives. `rows={0}` leaves only the summary card.
 */
export function PageSkeleton({ rows = 4 }) {
  const { t } = useTranslation();
  return (
    <Stack spacing={4} role="status" aria-busy="true" aria-label={t('common.loading')}>
      <Box>
        <Skeleton width={180} />
        <Skeleton width="min(420px, 80%)" height={56} />
        <Skeleton width="min(520px, 90%)" />
      </Box>
      {rows > 0 && (
        <Box>
          {Array.from({ length: rows }, (_, index) => (
            <Stack
              key={index}
              direction="row"
              spacing={2}
              alignItems="center"
              sx={{ minHeight: 56, borderBottom: '1px solid', borderColor: 'divider' }}
            >
              <Box sx={{ flex: 1 }}>
                <Skeleton width="40%" />
                <Skeleton width="22%" height={16} />
              </Box>
              <Skeleton width={88} />
            </Stack>
          ))}
        </Box>
      )}
    </Stack>
  );
}
PageSkeleton.propTypes = { rows: PropTypes.number };

/**
 * Wallet data states. The skeleton only shows before the first answer: a refresh (after creating a
 * wallet or syncing Open Finance) keeps the page on screen, marked busy, instead of swapping it for a
 * loader.
 */
export function DataState({ children }) {
  const { t } = useTranslation();
  const { loading, error, refresh, wallets, transactions } = useWallets();
  const hasData = wallets.length > 0 || transactions.length > 0;
  if (loading && !hasData && !error) return <PageSkeleton />;
  const alert = error && (
    <Alert
      severity="error"
      sx={{ mb: hasData ? 3 : 0 }}
      action={
        <Button color="inherit" onClick={refresh} disabled={loading}>
          {t('app.retry')}
        </Button>
      }
    >
      {t(error)}
    </Alert>
  );
  if (!hasData) return alert || children;
  return (
    <>
      {alert}
      <Box aria-busy={loading}>{children}</Box>
    </>
  );
}
DataState.propTypes = { children: PropTypes.node };
export function ActivityList({ transactions, wallets, onSelect }) {
  const { t, i18n } = useTranslation();
  if (!transactions.length)
    return <EmptyState icon="history" title={t('app.noActivity')} description={t('app.noActivityHelp')} />;
  return (
    <Box>
      {transactions.map((item) => {
        const direction = directionFor(item, wallets);
        const success = item.status === 'SUCCESS';
        const color = success && direction === 'incoming' ? 'success.main' : 'text.primary';
        const type = t(`app.types.${item.type?.name}`, { defaultValue: t('app.types.Transfer') });
        // Imported entries carry the counterparty ("Netflix"); that says more than the generic type.
        const named = item.description && item.description !== 'Initial balance';
        const title = named ? item.description : type;
        return (
          <Box
            key={item.id}
            component="button"
            type="button"
            onClick={() => onSelect(item)}
            sx={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: { xs: 1.5, sm: 2 },
              minHeight: 56,
              py: 1.5,
              px: { xs: 2, sm: 3 },
              border: 0,
              borderBottom: '1px solid',
              borderColor: 'divider',
              bgcolor: 'transparent',
              color: 'text.primary',
              textAlign: 'left',
              cursor: 'pointer',
              '&:last-child': { borderBottom: 0 },
              '&:hover': { bgcolor: 'action.hover' },
              '&:focus-visible': { outline: '2px solid', outlineColor: 'secondary.main', outlineOffset: -2 },
            }}
          >
            <Box
              sx={{
                width: 42,
                height: 42,
                flexShrink: 0,
                borderRadius: '12px',
                bgcolor: 'background.neutral',
                display: 'grid',
                placeItems: 'center',
                color,
              }}
            >
              <WalletIcon name={direction === 'incoming' ? 'down' : direction === 'outgoing' ? 'up' : 'swap'} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" noWrap>
                {title}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {named ? `${type} · ` : ''}
                {dateTime(item.createdAt, i18n.language)}
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right', minWidth: 0 }}>
              <Typography
                variant="subtitle2"
                sx={{ color, fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}
              >
                {success && direction === 'outgoing' ? '− ' : success && direction === 'incoming' ? '+ ' : ''}
                {money(item.amount, i18n.language)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t(`transactions.status.${item.status}`, { defaultValue: item.status })}
              </Typography>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
ActivityList.propTypes = {
  transactions: PropTypes.array.isRequired,
  wallets: PropTypes.array.isRequired,
  onSelect: PropTypes.func.isRequired,
};
/**
 * A titled group. Open, it is a panel (surface1). `collapsible`, it is one 56 px row with a divider that opens
 * the panel underneath: secondary tools stay one tap away instead of lengthening the page (DESIGN.md).
 */
export function SectionCard({ title, action, summary, collapsible = false, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  if (collapsible) {
    return (
      <Box component="section" sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
        <Typography variant="subtitle1" component="h2" sx={{ m: 0 }}>
          <ButtonBase
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls={id}
            sx={{
              width: '100%',
              minHeight: 56,
              gap: 2,
              justifyContent: 'space-between',
              textAlign: 'left',
              font: 'inherit',
              fontWeight: 500,
              color: 'text.primary',
              borderRadius: '12px',
              '&:hover .section-chevron': { color: 'text.primary' },
            }}
          >
            <span>{title}</span>
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ color: 'text.secondary', flexShrink: 0 }}>
              {summary && (
                <Typography component="span" variant="body2" color="text.secondary">
                  {summary}
                </Typography>
              )}
              <WalletIcon
                name="chevron"
                className="section-chevron"
                sx={{
                  fontSize: 20,
                  transition: 'transform 150ms, color 150ms',
                  transform: open ? 'rotate(180deg)' : 'none',
                }}
              />
            </Stack>
          </ButtonBase>
        </Typography>
        <Collapse in={open} unmountOnExit timeout={150}>
          <Card id={id} sx={{ mb: 2, borderRadius: '16px', pt: 2.5 }}>
            {action && <Box sx={{ px: 3, pb: 1 }}>{action}</Box>}
            {children}
          </Card>
        </Collapse>
      </Box>
    );
  }
  return (
    <Card>
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{ p: 3, pb: 1.5 }}>
        {/* h2 under the page h1: screen reader users move through long pages by headings. */}
        <Typography variant="h6" component="h2">
          {title}
        </Typography>
        {action && <Box sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}>{action}</Box>}
      </Stack>
      {children}
    </Card>
  );
}
SectionCard.propTypes = {
  title: PropTypes.string,
  action: PropTypes.node,
  summary: PropTypes.node,
  collapsible: PropTypes.bool,
  defaultOpen: PropTypes.bool,
  children: PropTypes.node,
};
