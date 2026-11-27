import { Box, ButtonBase, Card, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { Link as RouterLink } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { WalletIcon } from '../wallet-ui';
import { money } from '../../utils/wallet';

const FINISH_COUNT = 5; // theme.palette.cardFinishes.length

export default function WalletCard({ wallet, index = 0, selected = false, onClick, href, hideBalance = false }) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const THEMES = theme.palette.cardFinishes;
  const storageKey = `wallet-card-theme-${wallet.id}`;
  const [color, setColor] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      const value = Number(saved);
      if (saved !== null && Number.isInteger(value) && value >= 0 && value < FINISH_COUNT) return value;
    } catch {
      /* optional preference */
    }
    return index % FINISH_COUNT;
  });
  const changeColor = () => {
    const next = (color + 1) % THEMES.length;
    setColor(next);
    try {
      localStorage.setItem(storageKey, String(next));
    } catch {
      /* optional preference */
    }
  };
  return (
    <Card
      sx={{
        height: 202,
        borderRadius: '16px',
        bgcolor: THEMES[color],
        color: 'text.primary',
        border: '1px solid',
        borderColor: (th) => alpha(th.palette.common.white, 0.08),
        overflow: 'visible',
        position: 'relative',
        '&:focus-within': { outline: '2px solid', outlineColor: 'secondary.main', outlineOffset: 3 },
      }}
    >
      <ButtonBase
        component={href ? RouterLink : 'button'}
        to={href}
        onClick={href ? undefined : onClick}
        aria-pressed={href ? undefined : selected}
        aria-label={`${wallet.name}, ${t('wallet.card.clickToOpen')}`}
        sx={{ p: 3, width: '100%', height: '100%', display: 'block', borderRadius: 'inherit', textAlign: 'left' }}
      >
        <Stack sx={{ height: '100%' }} justifyContent="space-between">
          <Stack direction="row" spacing={1} alignItems="center" sx={{ pr: selected ? 5 : 0 }}>
            <Typography variant="subtitle1" noWrap sx={{ flex: 1 }}>
              {wallet.name}
            </Typography>
            {!selected && <WalletIcon name="wallet" sx={{ color: 'text.secondary' }} />}
          </Stack>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {t('wallet.availableBalance')}
            </Typography>
            <Typography
              sx={{
                fontSize: 28,
                fontWeight: 600,
                letterSpacing: '-0.035em',
                fontVariantNumeric: 'tabular-nums',
                overflowWrap: 'anywhere',
              }}
            >
              {hideBalance ? '••••••' : money(wallet.balance, i18n.language)}
            </Typography>
          </Box>
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {wallet.source === 'OPEN_FINANCE' ? wallet.institutionName : t('app.demo')}
            </Typography>
            <Typography variant="caption" sx={{ letterSpacing: '0.12em' }}>
              •••• {wallet.iban?.slice(-4)}
            </Typography>
          </Stack>
        </Stack>
      </ButtonBase>
      {selected && (
        <Tooltip title={t('wallet.changeColor')}>
          <IconButton
            aria-label={t('wallet.changeColor')}
            onClick={changeColor}
            sx={{
              position: 'absolute',
              right: 14,
              top: 14,
              width: 44,
              height: 44,
              color: 'common.white',
              bgcolor: (th) => alpha(th.palette.common.white, 0.1),
              '&:hover': { bgcolor: (th) => alpha(th.palette.common.white, 0.18) },
            }}
          >
            <Box
              sx={{
                width: 17,
                height: 17,
                borderRadius: '50%',
                border: '2px solid currentColor',
                // The next finish, so the button shows what it does.
                bgcolor: THEMES[(color + 1) % THEMES.length],
              }}
            />
          </IconButton>
        </Tooltip>
      )}
    </Card>
  );
}
WalletCard.propTypes = {
  wallet: PropTypes.object.isRequired,
  index: PropTypes.number,
  selected: PropTypes.bool,
  onClick: PropTypes.func,
  href: PropTypes.string,
  hideBalance: PropTypes.bool,
};
