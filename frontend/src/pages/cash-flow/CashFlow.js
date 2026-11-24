import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Container,
  MenuItem,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import HttpService from '../../services/HttpService';
import BankDataNotice from '../../components/bank-data';
import { PageHeading } from '../../components/wallet-ui';
import { Disclosure } from '../../components/detail-ui';
import { errorKey, monthLabel, money, percent } from '../../utils/wallet';

const TABS = ['spending', 'income'];
const GROUPS = ['byAccount', 'byMethod', 'byCategory'];

/** This month and the 12 before it, the history the API keeps (ADR 0021). */
export function lastMonths(today = new Date()) {
  return Array.from({ length: 13 }, (_, back) => {
    const date = new Date(today.getFullYear(), today.getMonth() - back, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  });
}

const capital = (text) => text.replace(/^./, (letter) => letter.toLocaleUpperCase());

function groupLabel(group, key, t) {
  if (group === 'byMethod') return t(`paymentMethods.${key}`, { defaultValue: key });
  if (group === 'byCategory')
    return t(`cashFlow.categories.${key}`, { defaultValue: t(`future.categories.${key}`, { defaultValue: key }) });
  return key;
}

/** One grouping as a reading list: name and count on the left, tabular value on the right, a quiet share bar. */
function GroupList({ group, items, total }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const id = `cash-flow-${group}`;
  return (
    <Box component="section" aria-labelledby={id} sx={{ minWidth: 0 }}>
      <Typography id={id} variant="subtitle1" component="h2" sx={{ mb: 1 }}>
        {t(`cashFlow.groups.${group}`)}
      </Typography>
      <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none', borderTop: '1px solid', borderColor: 'divider' }}>
        {items.map((item) => {
          const share = total > 0 ? Number(item.total) / total : 0;
          return (
            <Box component="li" key={item.key} sx={{ py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Stack direction="row" alignItems="baseline" spacing={2}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle2" component="p" sx={{ m: 0, overflowWrap: 'anywhere' }}>
                    {groupLabel(group, item.key, t)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('cashFlow.count', { count: item.count })}
                  </Typography>
                </Box>
                <Typography
                  variant="subtitle2"
                  component="p"
                  sx={{ m: 0, fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
                >
                  {money(item.total, lang)}
                </Typography>
              </Stack>
              <Box
                role="img"
                aria-label={t('cashFlow.share', { percent: percent(share * 100, lang) })}
                sx={{ mt: 1, height: 2, borderRadius: 999, bgcolor: 'divider', overflow: 'hidden' }}
              >
                <Box sx={{ height: '100%', width: `${share * 100}%`, bgcolor: 'text.secondary' }} />
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
GroupList.propTypes = {
  group: PropTypes.string.isRequired,
  items: PropTypes.array.isRequired,
  total: PropTypes.number,
};

/**
 * Entradas e saídas (ADR 0021, proposta de André Graccia): what already happened in a month, spending and income
 * apart, grouped by account, method and category. Only the realized; the forecast lives in Plano and Futuro.
 * Month and tab live in the URL, so a link or a reload opens the same view.
 */
export default function CashFlow() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const months = useMemo(() => lastMonths(), []);
  const [searchParams, setSearchParams] = useSearchParams();
  const month = months.includes(searchParams.get('month')) ? searchParams.get('month') : months[0];
  const tab = TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'spending';
  const [state, setState] = useState({ loading: true, error: null, data: null });

  const latest = useRef(0);
  const load = useCallback(async () => {
    latest.current += 1;
    const mine = latest.current;
    setState((previous) => ({ ...previous, loading: true, error: null }));
    try {
      const data = await HttpService.getWithAuth(`/cash-flow?month=${month}`);
      if (mine === latest.current) setState({ loading: false, error: null, data });
    } catch (failure) {
      if (mine === latest.current) setState((previous) => ({ ...previous, loading: false, error: errorKey(failure) }));
    }
  }, [month]);
  useEffect(() => {
    load();
  }, [load]);

  const update = (patch) => {
    const next = { month, tab, ...patch };
    setSearchParams(
      { ...(next.month !== months[0] && { month: next.month }), ...(next.tab !== 'spending' && { tab: next.tab }) },
      { replace: true }
    );
  };

  const { data } = state;
  const side = data && (tab === 'income' ? data.income : data.spending);
  const name = monthLabel(month, lang, { month: 'long' });
  const total = side ? Number(side.total) : 0;

  return (
    <>
      <Helmet>
        <title>{t('cashFlow.pageTitle')}</title>
      </Helmet>
      <Container maxWidth="lg">
        <PageHeading
          title={t('cashFlow.heading')}
          action={
            <TextField
              select
              size="small"
              label={t('cashFlow.month')}
              value={month}
              onChange={(event) => update({ month: event.target.value })}
              sx={{ minWidth: 200 }}
            >
              {months.map((value) => (
                <MenuItem key={value} value={value}>
                  {capital(monthLabel(value, lang))}
                </MenuItem>
              ))}
            </TextField>
          }
        />

        <Tabs
          value={tab}
          onChange={(_, value) => update({ tab: value })}
          aria-label={t('cashFlow.tabsLabel')}
          sx={{ mb: { xs: 3, md: 4 }, borderBottom: '1px solid', borderColor: 'divider' }}
        >
          {TABS.map((value) => (
            <Tab
              key={value}
              value={value}
              label={t(`cashFlow.tabs.${value}`)}
              id={`cash-flow-tab-${value}`}
              aria-controls="cash-flow-panel"
            />
          ))}
        </Tabs>

        <Box id="cash-flow-panel" role="tabpanel" aria-labelledby={`cash-flow-tab-${tab}`}>
          {state.loading && !data && (
            <Stack spacing={4} role="status" aria-busy="true" aria-label={t('common.loading')}>
              <Box>
                <Skeleton width={180} />
                <Skeleton width="min(280px, 70%)" height={56} />
              </Box>
              <Box
                sx={{
                  display: 'grid',
                  gap: 4,
                  gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(3, minmax(0, 1fr))' },
                }}
              >
                {GROUPS.map((group) => (
                  <Box key={group}>
                    <Skeleton width="40%" />
                    {[0, 1, 2].map((row) => (
                      <Skeleton key={row} height={56} />
                    ))}
                  </Box>
                ))}
              </Box>
            </Stack>
          )}
          {state.error && (
            <Alert
              severity="error"
              action={
                <Button color="inherit" onClick={load}>
                  {t('app.retry')}
                </Button>
              }
            >
              {t('cashFlow.loadError')} {t(state.error)}
            </Alert>
          )}

          {side && (
            <Stack
              spacing={{ xs: 4, md: 5 }}
              aria-busy={state.loading}
              sx={{ opacity: state.loading ? 0.6 : 1, transition: 'opacity 150ms' }}
            >
              {data.bankData?.stale && <BankDataNotice bankData={data.bankData} />}
              <Box component="section" aria-labelledby="cash-flow-total">
                <Typography id="cash-flow-total" component="h2" sx={{ m: 0 }}>
                  <Typography component="span" variant="body1" color="text.secondary" sx={{ display: 'block' }}>
                    {t(`cashFlow.total.${tab}`, { month: name })}
                    {data.currentMonth ? `, ${t('cashFlow.untilToday')}` : ''}
                  </Typography>
                  <Typography
                    component="span"
                    variant="h2"
                    sx={{
                      display: 'block',
                      my: 0.5,
                      color: tab === 'income' && total > 0 ? 'success.main' : 'text.primary',
                    }}
                  >
                    {money(total, lang)}
                  </Typography>
                </Typography>
                <Stack direction="row" alignItems="center" flexWrap="wrap" sx={{ columnGap: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    {t('cashFlow.count', { count: side.count })}. {t('cashFlow.realized')}
                  </Typography>
                  <Button component={RouterLink} to="/plan" size="small">
                    {t('cashFlow.seeForecast')}
                  </Button>
                </Stack>
                <Disclosure label={t('cashFlow.why')}>
                  <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 640 }}>
                    {t('cashFlow.whyText')}
                  </Typography>
                </Disclosure>
              </Box>

              {side.count === 0 ? (
                <Box sx={{ py: 2 }}>
                  <Typography>{t(`cashFlow.empty.${tab}`, { month: name })}</Typography>
                  <Button component={RouterLink} to="/transactions" variant="outlined" sx={{ mt: 2 }}>
                    {t('cashFlow.seeStatement')}
                  </Button>
                </Box>
              ) : (
                <Box
                  sx={{
                    display: 'grid',
                    gap: { xs: 4, md: 5 },
                    alignItems: 'start',
                    gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(3, minmax(0, 1fr))' },
                  }}
                >
                  {GROUPS.map((group) => (
                    <GroupList key={group} group={group} items={side[group] || []} total={total} />
                  ))}
                </Box>
              )}
              {data.bankData && !data.bankData.stale && <BankDataNotice bankData={data.bankData} />}
            </Stack>
          )}
        </Box>
      </Container>
    </>
  );
}
