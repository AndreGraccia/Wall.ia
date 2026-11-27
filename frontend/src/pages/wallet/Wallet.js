import { useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  IconButton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { enqueueSnackbar } from 'notistack';
import { useWallets } from '../../context/WalletContext';
import WalletCard from '../../components/wallet-card';
import StatementList from '../../components/statement-list';
import TransactionDetail from '../../components/transaction-detail';
import { DataState, EmptyState, PageHeading, WalletIcon } from '../../components/wallet-ui';

const RECENT = 8;

export default function Wallet() {
  const { t } = useTranslation();
  const { wallets, transactions } = useWallets();
  const { walletId } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const selected = wallets.find((item) => String(item.id) === walletId) || (!walletId ? wallets[0] : null);
  const activity = selected
    ? transactions.filter((item) => item.fromWallet?.id === selected.id || item.toWallet?.id === selected.id)
    : [];
  const openFinance = selected?.source === 'OPEN_FINANCE';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(selected.iban);
      enqueueSnackbar(t('app.copied'), { variant: 'success' });
    } catch {
      enqueueSnackbar(t('app.copyHelp'), { variant: 'info' });
    }
  };
  return (
    <>
      <Helmet>
        <title>{t('wallet.pageTitle')}</title>
      </Helmet>
      <Container maxWidth="lg">
        <PageHeading
          title={t('wallet.heading')}
          action={
            wallets.length > 0 && (
              <Button
                component={RouterLink}
                to="/wallets/new"
                variant="outlined"
                startIcon={<WalletIcon name="plus" />}
              >
                {t('wallet.newWallet')}
              </Button>
            )
          }
        />
        <DataState>
          {!wallets.length && (
            <EmptyState
              title={t('app.firstWallet')}
              description={t('app.firstWalletHelp')}
              action={
                <Button component={RouterLink} to="/wallets/new" variant="contained">
                  {t('wallet.newWallet')}
                </Button>
              }
            />
          )}
          {wallets.length > 0 && !selected && (
            <EmptyState
              title={t('app.errors.notFound')}
              action={
                <Button component={RouterLink} to="/wallets" variant="outlined">
                  {t('wallet.backToWallets')}
                </Button>
              }
            />
          )}
          {selected && (
            <Stack spacing={{ xs: 4, md: 5 }}>
              {wallets.length > 1 && (
                // Switching wallets is a filter on this page: pills, scrolling in their own row on a phone.
                <Box sx={{ overflowX: 'auto', mx: { xs: -2, sm: 0 }, px: { xs: 2, sm: 0 }, mt: { xs: -1, md: -2 } }}>
                  <ToggleButtonGroup
                    exclusive
                    value={String(selected.id)}
                    onChange={(_, value) => value && navigate(`/wallets/${value}`, { replace: true })}
                    aria-label={t('wallet.choose')}
                    sx={{ flexWrap: 'nowrap', '& .MuiToggleButton-root': { whiteSpace: 'nowrap' } }}
                  >
                    {wallets.map((wallet) => (
                      <ToggleButton value={String(wallet.id)} key={wallet.id}>
                        {wallet.name}
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                </Box>
              )}

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: '360px minmax(0, 1fr)' },
                  gap: { xs: 3, md: 5 },
                  alignItems: 'center',
                }}
              >
                <Box sx={{ maxWidth: 360, width: '100%' }}>
                  <WalletCard
                    wallet={selected}
                    index={wallets.indexOf(selected)}
                    selected
                    href={`/transactions?wallet=${selected.id}`}
                  />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" color="text.secondary">
                    {t('app.walletCode')}
                  </Typography>
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <Typography
                      variant="subtitle1"
                      sx={{ fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere', userSelect: 'all' }}
                    >
                      {selected.iban}
                    </Typography>
                    <Tooltip title={t('app.copy')}>
                      <IconButton onClick={copy} aria-label={t('app.copy')}>
                        <WalletIcon name="copy" sx={{ fontSize: 20 }} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                  <Typography variant="caption" color="text.secondary" component="p">
                    {t(openFinance ? 'openFinance.readOnlyAccount' : 'app.codeHelp')}
                  </Typography>
                  <Stack direction="row" flexWrap="wrap" sx={{ gap: 1, mt: 3 }}>
                    {openFinance ? (
                      <>
                        <Button
                          component={RouterLink}
                          to="/open-finance"
                          variant="outlined"
                          startIcon={<WalletIcon name="sync" />}
                        >
                          {t('openFinance.sync')}
                        </Button>
                        <Button
                          component={RouterLink}
                          to="/insights"
                          variant="outlined"
                          startIcon={<WalletIcon name="insights" />}
                        >
                          {t('navigation.insights')}
                        </Button>
                      </>
                    ) : (
                      <Button
                        component={RouterLink}
                        to="/envelopes"
                        variant="outlined"
                        startIcon={<WalletIcon name="envelope" />}
                      >
                        {t('navigation.envelopes')}
                      </Button>
                    )}
                  </Stack>
                </Box>
              </Box>

              <Box component="section" aria-labelledby="wallet-statement">
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5, gap: 2 }}>
                  <Typography id="wallet-statement" variant="h6" component="h2">
                    {t('wallet.statement.title')}
                  </Typography>
                  {activity.length > RECENT && (
                    <Button component={RouterLink} to={`/transactions?wallet=${selected.id}`}>
                      {t('app.seeAll')}
                    </Button>
                  )}
                </Stack>
                {activity.length ? (
                  <StatementList
                    transactions={activity.slice(0, RECENT)}
                    wallets={[selected]}
                    onSelect={setDetail}
                    dayHeading="h3"
                  />
                ) : (
                  <Typography color="text.secondary" sx={{ py: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                    {t(openFinance ? 'wallet.statement.emptySync' : 'wallet.statement.empty')}
                  </Typography>
                )}
              </Box>
            </Stack>
          )}
        </DataState>
      </Container>
      <TransactionDetail transaction={detail} onClose={() => setDetail(null)} />
    </>
  );
}
