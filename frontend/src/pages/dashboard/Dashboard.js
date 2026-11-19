import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, Card, Container, Grid, IconButton, Stack, Typography } from '@mui/material';
import { Helmet } from 'react-helmet-async';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useWallets } from '../../context/WalletContext';
import {
  ActivityList,
  DataState,
  EmptyState,
  IconTile,
  PageHeading,
  SectionCard,
  WalletIcon,
} from '../../components/wallet-ui';
import WalletCard from '../../components/wallet-card';
import TransactionDetail from '../../components/transaction-detail';
import AuthService from '../../services/AuthService';
import HttpService from '../../services/HttpService';
import BankDataNotice from '../../components/bank-data';
import { dayLabel, money, totalsFor } from '../../utils/wallet';
import { forecastReady } from '../../utils/forecast';

/** "Próximos 30 dias": the Futuro page condensed. Quietly absent if the engine is unavailable. */
function FutureSummary({ hidden }) {
  const { t, i18n } = useTranslation();
  const [overview, setOverview] = useState(null);
  useEffect(() => {
    let active = true;
    HttpService.getWithAuth('/future/overview?horizon=30')
      .then((data) => active && setOverview(data))
      .catch(() => active && setOverview(null));
    return () => {
      active = false;
    };
  }, []);
  if (!overview) return null;
  const risk = overview.projection.riskWindows[0];
  // Same rule as Future: with nothing confirmed, "free = balance" would be a number the engine does not know.
  const ready = forecastReady({ sources: overview.sources });
  const mask = (value) => (hidden ? '••••' : money(value, i18n.language));
  return (
    <Card sx={{ p: 3, mb: 3 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
        <Typography variant="overline" color="text.secondary">
          {t('future.horizon', { days: 30 })}
        </Typography>
        <Button component={RouterLink} to="/future" size="small" endIcon={<WalletIcon name="arrow" />}>
          {t('navigation.future')}
        </Button>
      </Stack>
      <BankDataNotice bankData={overview.sources.bankData} sx={{ mt: 1 }} />
      {!ready && (
        <Alert severity="info" sx={{ mt: 1 }}>
          {t('future.needsAnswers')}
        </Alert>
      )}
      {ready && (
        <Stack direction="row" spacing={3} sx={{ mt: 1 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary">
              {t('future.committed')}
            </Typography>
            <Typography
              variant="h5"
              component="p"
              sx={{ fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}
            >
              {mask(overview.committed.total)}
            </Typography>
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary">
              {t('future.free')}
            </Typography>
            <Typography
              variant="h5"
              component="p"
              sx={{ fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere', color: 'primary.main' }}
            >
              {mask(overview.freeAfterCommitments)}
            </Typography>
          </Box>
        </Stack>
      )}
      {risk && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          {t('future.risk', {
            start: dayLabel(risk.start, i18n.language),
            end: dayLabel(risk.end, i18n.language),
            amount: hidden ? '••••' : money(Math.abs(Number(risk.lowestBalance)), i18n.language),
          })}
        </Alert>
      )}
      {ready && !risk && overview.sources.pendingQuestions > 0 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          {t('future.needsAnswers')}
        </Alert>
      )}
    </Card>
  );
}
FutureSummary.propTypes = { hidden: PropTypes.bool };

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const { wallets, transactions } = useWallets();
  const [hidden, setHidden] = useState(false);
  const [detail, setDetail] = useState(null);
  const totals = totalsFor(transactions, wallets);
  const total = wallets.reduce((sum, wallet) => sum + Math.round(Number(wallet.balance) * 100), 0) / 100;
  const user = AuthService.getCurrentUser();
  return (
    <>
      <Helmet>
        <title>{t('dashboard.pageTitle')}</title>
      </Helmet>
      <Container maxWidth="lg">
        <PageHeading
          title={t('app.greeting', { name: user?.firstName || t('app.you') })}
          description={t('app.overviewHelp')}
        />
        <DataState>
          <Grid container spacing={3}>
            <Grid item xs={12} md={5}>
              <Card sx={{ p: { xs: 3, sm: 4 }, mb: 3 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Typography color="text.secondary" variant="body2">
                    {t('wallet.stack.totalBalance')}
                  </Typography>
                  <IconButton
                    aria-label={t(hidden ? 'app.showBalance' : 'app.hideBalance')}
                    aria-pressed={hidden}
                    onClick={() => setHidden(!hidden)}
                  >
                    <WalletIcon name="eye" sx={{ fontSize: 20 }} />
                  </IconButton>
                </Stack>
                <Typography
                  variant="h2"
                  sx={{
                    my: 2,
                    fontSize: { xs: '2.5rem', sm: '3rem' },
                    overflowWrap: 'anywhere',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {hidden ? '••••••' : money(total, i18n.language)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('app.balanceHelp')}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 3 }}>
                  <Button
                    component={RouterLink}
                    to="/envelopes"
                    variant="contained"
                    fullWidth
                    startIcon={<WalletIcon name="envelope" />}
                  >
                    {t('navigation.envelopes')}
                  </Button>
                  <Button
                    component={RouterLink}
                    to="/open-finance"
                    variant="outlined"
                    fullWidth
                    startIcon={<WalletIcon name="bank" />}
                  >
                    {t('openFinance.connectShort')}
                  </Button>
                </Stack>
                <Stack
                  direction="row"
                  spacing={3}
                  sx={{ mt: 4, pt: 3, borderTop: '1px solid', borderColor: 'divider' }}
                >
                  {['incoming', 'outgoing'].map((key) => (
                    <Box key={key} sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="caption" color="text.secondary">
                        {t(`app.${key}`)}
                      </Typography>
                      <Typography variant="subtitle1" sx={{ overflowWrap: 'anywhere' }}>
                        {hidden ? '••••' : money(totals[key] / 100, i18n.language)}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Card>
              <SectionCard
                title={t('navigation.wallets')}
                action={
                  <Button component={RouterLink} to="/wallets">
                    {t('app.seeAll')}
                  </Button>
                }
              >
                {wallets.length ? (
                  <Box sx={{ p: 3, pt: 1 }}>
                    {wallets.slice(0, 3).map((wallet, index) => (
                      <Box
                        key={wallet.id}
                        sx={{
                          mt: index ? '-105px' : 0,
                          position: 'relative',
                          zIndex: index,
                          '&:focus-within': { zIndex: 5 },
                        }}
                      >
                        <WalletCard wallet={wallet} index={index} hideBalance={hidden} href={`/wallets/${wallet.id}`} />
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <EmptyState
                    title={t('app.firstWallet')}
                    description={t('app.firstWalletHelp')}
                    action={
                      <Button component={RouterLink} to="/wallets/new">
                        {t('wallet.newWallet')}
                      </Button>
                    }
                  />
                )}
              </SectionCard>
            </Grid>
            <Grid item xs={12} md={7}>
              <FutureSummary hidden={hidden} />
              <SectionCard
                title={t('wallet.statement.recent')}
                action={
                  <Button component={RouterLink} to="/transactions">
                    {t('app.seeAll')}
                  </Button>
                }
              >
                <ActivityList transactions={transactions.slice(0, 6)} wallets={wallets} onSelect={setDetail} />
              </SectionCard>
              <Card sx={{ mt: 3, p: 3 }}>
                <Stack direction="row" spacing={2}>
                  <IconTile name="insights" size={44} />
                  <Box>
                    <Typography variant="subtitle2">{t('insights.dashboardTitle')}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1 }}>
                      {t('insights.dashboardDescription')}
                    </Typography>
                    <Button component={RouterLink} to="/insights" size="small" sx={{ p: 0, minHeight: 32 }}>
                      {t('insights.dashboardAction')}
                    </Button>
                  </Box>
                </Stack>
              </Card>
            </Grid>
          </Grid>
        </DataState>
      </Container>
      <TransactionDetail transaction={detail} onClose={() => setDetail(null)} />
    </>
  );
}
