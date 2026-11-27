import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Chip,
  Container,
  IconButton,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import HttpService from '../../services/HttpService';
import BankDataNotice from '../../components/bank-data';
import { PageHeading, WalletIcon } from '../../components/wallet-ui';
import { Disclosure, ListRow } from '../../components/detail-ui';
import { EventRow } from '../../components/future-ui';
import {
  CategoryNotice,
  CategorySelect,
  categoryLabel,
  needsReview,
  useCategorize,
} from '../../components/category-ui';
import { dayLabel, errorKey, monthLabel, money, percent } from '../../utils/wallet';

const PAGE = 30;

const TABS = ['spending', 'income'];
const GROUPS = ['byCategory', 'byMethod', 'byAccount'];

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
  if (group === 'byCategory') return categoryLabel(key, t);
  return key;
}

/**
 * The grouping picked in the segmented control, as a reading list: name and count on the left, tabular value on the right, a quiet share bar. Each
 * row filters the list of movements below (documento de evolucao 4.3 e 4.4: por conta, metodo e categoria).
 */
function GroupList({ group, items, total, filter, onFilter, onGroup }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  return (
    <Box component="section" aria-labelledby="cash-flow-groups" sx={{ minWidth: 0 }}>
      <Stack direction="row" alignItems="center" flexWrap="wrap" sx={{ gap: 1.5, mb: 1.5 }}>
        <Typography id="cash-flow-groups" variant="subtitle1" component="h2" sx={{ m: 0 }}>
          {t('cashFlow.groupBy')}
        </Typography>
        {/* One grouping at a time (auditoria 26/11: three equal columns fought for attention). */}
        <ToggleButtonGroup
          exclusive
          value={group}
          onChange={(_, value) => value && onGroup(value)}
          aria-labelledby="cash-flow-groups"
          sx={{ flexWrap: 'wrap' }}
        >
          {GROUPS.map((value) => (
            <ToggleButton key={value} value={value}>
              {t(`cashFlow.groupOptions.${value}`)}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>
      <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none', borderTop: '1px solid', borderColor: 'divider' }}>
        {items.map((item) => {
          const share = total > 0 ? Number(item.total) / total : 0;
          return (
            <Box component="li" key={item.key} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
              <ButtonBase
                onClick={() => onFilter(selected(filter, group, item.key) ? null : { group, key: item.key })}
                aria-pressed={selected(filter, group, item.key)}
                aria-label={t('cashFlow.filter.by', { name: groupLabel(group, item.key, t) })}
                sx={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  py: 1.25,
                  px: 1,
                  mx: -1,
                  borderRadius: '8px',
                  bgcolor: selected(filter, group, item.key) ? 'action.selected' : 'transparent',
                  '&:hover': { bgcolor: 'action.hover' },
                  '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'secondary.main' },
                }}
              >
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
              </ButtonBase>
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
  filter: PropTypes.object,
  onFilter: PropTypes.func.isRequired,
  onGroup: PropTypes.func.isRequired,
};

/** "‹ Novembro de 2026 ›": steps through the 13 months the API keeps; the arrows stop at both ends. */
export function MonthStepper({ months, month, onChange }) {
  const { t, i18n } = useTranslation();
  const index = months.indexOf(month);
  const older = months[index + 1];
  const newer = months[index - 1];
  const arrow = (turn) => ({ fontSize: 20, transform: `rotate(${turn}deg)` });
  return (
    <Stack direction="row" alignItems="center" role="group" aria-label={t('cashFlow.month')} sx={{ gap: 0.5 }}>
      <IconButton onClick={() => onChange(older)} disabled={!older} aria-label={t('cashFlow.previousMonth')}>
        <WalletIcon name="chevron" aria-hidden sx={arrow(90)} />
      </IconButton>
      <Typography
        variant="subtitle1"
        component="p"
        aria-live="polite"
        sx={{ m: 0, minWidth: '10em', textAlign: 'center', fontWeight: 500 }}
      >
        {capital(monthLabel(month, i18n.language))}
      </Typography>
      <IconButton onClick={() => onChange(newer)} disabled={!newer} aria-label={t('cashFlow.nextMonth')}>
        <WalletIcon name="chevron" aria-hidden sx={arrow(-90)} />
      </IconButton>
    </Stack>
  );
}
MonthStepper.propTypes = {
  months: PropTypes.array.isRequired,
  month: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
};

const FIELD = { byAccount: 'account', byMethod: 'method', byCategory: 'category' };
const selected = (filter, group, key) => filter?.group === group && filter?.key === key;

/** The movements of the side, filtered by the group row picked above; same keys, so the totals agree. */
export function filterItems(items, filter) {
  return filter ? items.filter((item) => item[FIELD[filter.group]] === filter.key) : items;
}

function Movements({ items, side, change, filter, onClear }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [shown, setShown] = useState(PAGE);
  const list = filterItems(items, filter);
  const sum = list.reduce((total, item) => total + Number(item.amount), 0);
  return (
    <Box component="section" aria-labelledby="cash-flow-items">
      <Stack direction="row" alignItems="center" flexWrap="wrap" sx={{ gap: 1, mb: 1 }}>
        <Typography id="cash-flow-items" variant="h6" component="h2" sx={{ mr: 1 }}>
          {t('cashFlow.items.title')}
        </Typography>
        {filter && (
          <Chip
            label={t('cashFlow.filter.active', { name: groupLabel(filter.group, filter.key, t) })}
            onDelete={onClear}
          />
        )}
      </Stack>
      <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0, mb: 1 }} role="status">
        {t('cashFlow.items.summary', { count: list.length, amount: money(sum, lang) })}
      </Typography>
      <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
        {list.slice(0, shown).map((item) => (
          <ListRow
            key={item.id}
            title={item.counterparty || t('cashFlow.items.noName')}
            meta={[
              // Same as the Extrato (ADR 0022): category and account; the payment method is a grouping above.
              dayLabel(item.date, lang),
              groupLabel('byCategory', item.category, t),
              item.origin === 'NAME' && t('review.suggested'),
              item.account,
            ]
              .filter(Boolean)
              .join(' · ')}
            value={money(item.amount, lang)}
            detailLabel={t('review.edit', { name: item.counterparty || t('cashFlow.items.noName') })}
            detail={
              item.origin && (
                <Stack direction="row" alignItems="center" flexWrap="wrap" sx={{ gap: 1.5, py: 1 }}>
                  <CategorySelect
                    side={side}
                    value={item.category}
                    label={t('review.category')}
                    disabled={change.busy}
                    onChange={(category) => change.choose(item, category)}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {t(`review.origin.${item.origin}`)}
                  </Typography>
                  {item.origin === 'CHOSEN' && (
                    <Button size="small" onClick={() => change.clear(item)} disabled={change.busy}>
                      {t('review.backToAutomatic')}
                    </Button>
                  )}
                </Stack>
              )
            }
          />
        ))}
      </Box>
      {list.length > shown && (
        <Button onClick={() => setShown(shown + PAGE)} sx={{ mt: 1 }}>
          {t('cashFlow.items.more', { count: Math.min(PAGE, list.length - shown) })}
        </Button>
      )}
    </Box>
  );
}
Movements.propTypes = {
  items: PropTypes.array.isRequired,
  side: PropTypes.string.isRequired,
  change: PropTypes.object.isRequired,
  filter: PropTypes.object,
  onClear: PropTypes.func,
};

/**
 * What still leaves this month, from the same projection as Futuro (bills, card invoice, instalments). Apart from
 * the total above, which is only what already happened (documento de evolução 4.4).
 */
function StillToLeave({ month }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [events, setEvents] = useState(null);
  useEffect(() => {
    let alive = true;
    HttpService.getWithAuth('/future/overview?horizon=31')
      .then((overview) => {
        if (!alive) return;
        const today = overview?.projection?.days?.[0]?.date;
        setEvents(
          (overview?.projection?.events || []).filter(
            (event) =>
              Number(event.amount) < 0 &&
              event.date.startsWith(month) &&
              (!today || event.date > today) &&
              event.category !== 'DAILY_SPENDING'
          )
        );
      })
      .catch(() => alive && setEvents([]));
    return () => {
      alive = false;
    };
  }, [month]);
  if (!events?.length) return null;
  const sum = events.reduce((total, event) => total + Number(event.amount), 0);
  return (
    <Box component="section" aria-labelledby="cash-flow-upcoming">
      <Typography id="cash-flow-upcoming" variant="h6" component="h2">
        {t('cashFlow.upcoming.title', { month: monthLabel(month, lang, { month: 'long' }) })}
      </Typography>
      <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0, mt: 0.5, mb: 1 }}>
        {t('cashFlow.upcoming.help', { amount: money(Math.abs(sum), lang) })}
      </Typography>
      <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
        {events.map((event) => (
          <EventRow key={`${event.reference}-${event.date}`} event={event} dense />
        ))}
      </Box>
    </Box>
  );
}
StillToLeave.propTypes = { month: PropTypes.string.isRequired };

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
  const group = GROUPS.includes(searchParams.get('group')) ? searchParams.get('group') : 'byCategory';
  const [filter, setFilter] = useState(null);

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
  const change = useCategorize(load);

  // Month, side and grouping live in the URL; any of them changing drops the row filter, which belonged to the old view.
  const update = (patch) => {
    const next = { month, tab, group, ...patch };
    setFilter(null);
    setSearchParams(
      {
        ...(next.month !== months[0] && { month: next.month }),
        ...(next.tab !== 'spending' && { tab: next.tab }),
        ...(next.group !== 'byCategory' && { group: next.group }),
      },
      { replace: true }
    );
  };

  const { data } = state;
  const side = data && (tab === 'income' ? data.income : data.spending);
  const name = monthLabel(month, lang, { month: 'long' });
  const total = side ? Number(side.total) : 0;
  const pending = [...(data?.income?.items || []), ...(data?.spending?.items || [])].filter(needsReview).length;

  return (
    <>
      <Helmet>
        <title>{t('cashFlow.pageTitle')}</title>
      </Helmet>
      <Container maxWidth="lg">
        <PageHeading
          title={t('cashFlow.heading')}
          action={<MonthStepper months={months} month={month} onChange={(value) => update({ month: value })} />}
        />
        {/* Same place as on every screen: under the heading, before tabs and numbers. */}
        {data?.bankData?.stale && <BankDataNotice bankData={data.bankData} sx={{ mb: 3 }} />}

        {pending > 0 && data.month === month && (
          <Alert
            severity="info"
            sx={{ mb: 3 }}
            action={
              <Button color="inherit" component={RouterLink} to={`/cash-flow/review?month=${month}`}>
                {t('review.open')}
              </Button>
            }
          >
            {t('review.pending', { count: pending })}
          </Alert>
        )}

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
              <Box>
                <Skeleton width="min(360px, 80%)" height={44} />
                {[0, 1, 2, 3].map((row) => (
                  <Skeleton key={row} height={56} />
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
                <GroupList
                  group={group}
                  items={side[group] || []}
                  total={total}
                  filter={filter}
                  onFilter={setFilter}
                  onGroup={(value) => update({ group: value })}
                />
              )}
              {side.count > 0 && side.items && (
                <>
                  <CategoryNotice change={change} />
                  <Movements
                    items={side.items}
                    side={tab}
                    change={change}
                    filter={filter}
                    onClear={() => setFilter(null)}
                  />
                </>
              )}
              {tab === 'spending' && data.currentMonth && <StillToLeave month={month} />}
              {data.bankData && !data.bankData.stale && <BankDataNotice bankData={data.bankData} />}
            </Stack>
          )}
        </Box>
      </Container>
    </>
  );
}
