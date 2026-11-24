import { useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { Box, Button, Container, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { useWallets } from '../../context/WalletContext';
import { DataState, EmptyState, PageHeading } from '../../components/wallet-ui';
import StatementList from '../../components/statement-list';
import TransactionDetail from '../../components/transaction-detail';

const PAGE = 30;

export default function Transaction() {
  const { t } = useTranslation();
  const { wallets, transactions } = useWallets();
  // Filters live in the URL: a filtered statement can be reloaded and shared, and the back button undoes it.
  const [params, setParams] = useSearchParams();
  const requestedWallet = params.get('wallet') || '';
  const selected = wallets.some((wallet) => String(wallet.id) === requestedWallet) ? requestedWallet : '';
  const query = params.get('q') || '';
  const [shown, setShown] = useState(PAGE);
  const [detail, setDetail] = useState(null);

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: key === 'q' });
    setShown(PAGE);
  };

  const visible = transactions.filter(
    (item) =>
      (!selected || String(item.fromWallet?.id) === selected || String(item.toWallet?.id) === selected) &&
      [
        item.description,
        item.fromWallet?.name,
        item.toWallet?.name,
        t(`app.types.${item.type?.name}`, { defaultValue: '' }),
      ]
        .join(' ')
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase())
  );
  const scope = selected ? wallets.filter((wallet) => String(wallet.id) === selected) : wallets;
  const filtered = Boolean(query || selected);

  return (
    <>
      <Helmet>
        <title>{t('transactions.pageTitle')}</title>
      </Helmet>
      <Container maxWidth="lg">
        <PageHeading title={t('transactions.heading')} />
        <DataState>
          {!transactions.length ? (
            <EmptyState
              icon="history"
              title={t('app.noActivity')}
              description={t('transactions.emptyHelp')}
              action={
                <Button component={RouterLink} to="/open-finance" variant="contained">
                  {t('openFinance.connectShort')}
                </Button>
              }
            />
          ) : (
            <>
              <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} sx={{ gap: 2, mb: 3 }}>
                <TextField
                  size="small"
                  type="search"
                  value={query}
                  onChange={(event) => setFilter('q', event.target.value)}
                  placeholder={t('app.searchActivity')}
                  inputProps={{ 'aria-label': t('common.search') }}
                  sx={{ width: { xs: '100%', md: 320 }, flexShrink: 0 }}
                />
                {wallets.length > 1 && (
                  // Many accounts scroll inside their own row; the page never scrolls sideways.
                  <Box sx={{ overflowX: 'auto', minWidth: 0, mx: { xs: -2, sm: 0 }, px: { xs: 2, sm: 0 } }}>
                    <ToggleButtonGroup
                      exclusive
                      value={selected}
                      onChange={(_, value) => value !== null && setFilter('wallet', value)}
                      aria-label={t('transfer.wallet')}
                      sx={{ flexWrap: 'nowrap', '& .MuiToggleButton-root': { whiteSpace: 'nowrap' } }}
                    >
                      <ToggleButton value="">{t('app.allWallets')}</ToggleButton>
                      {wallets.map((wallet) => (
                        <ToggleButton value={String(wallet.id)} key={wallet.id}>
                          {wallet.name}
                        </ToggleButton>
                      ))}
                    </ToggleButtonGroup>
                  </Box>
                )}
              </Stack>

              {visible.length ? (
                <>
                  <StatementList transactions={visible.slice(0, shown)} wallets={scope} onSelect={setDetail} />
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 2, gap: 2 }}>
                    <Typography variant="body2" color="text.secondary" role="status">
                      {t('transactions.showing', { shown: Math.min(shown, visible.length), total: visible.length })}
                    </Typography>
                    {shown < visible.length && (
                      <Button variant="outlined" onClick={() => setShown(shown + PAGE)}>
                        {t('transactions.showMore')}
                      </Button>
                    )}
                  </Stack>
                </>
              ) : (
                <EmptyState
                  icon="history"
                  title={t('transactions.noMatch')}
                  action={
                    filtered && (
                      <Button variant="outlined" onClick={() => setParams({})}>
                        {t('transactions.clearFilters')}
                      </Button>
                    )
                  }
                />
              )}
            </>
          )}
        </DataState>
      </Container>
      <TransactionDetail transaction={detail} onClose={() => setDetail(null)} />
    </>
  );
}
