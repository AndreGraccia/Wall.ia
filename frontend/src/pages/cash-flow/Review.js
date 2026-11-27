import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, Container, Skeleton, Stack, Typography } from '@mui/material';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import HttpService from '../../services/HttpService';
import { PageHeading } from '../../components/wallet-ui';
import { ListRow } from '../../components/detail-ui';
import {
  CategoryNotice,
  CategorySelect,
  categoryLabel,
  needsReview,
  useCategorize,
} from '../../components/category-ui';
import { dayLabel, errorKey, monthLabel, money } from '../../utils/wallet';
import { MonthStepper, lastMonths } from './CashFlow';

/** Both sides of the month that only a name suggests, or nothing identifies; newest first. */
export function reviewQueue(data) {
  return ['spending', 'income']
    .flatMap((side) => (data?.[side]?.items || []).filter(needsReview).map((item) => ({ ...item, side })))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
}

/**
 * "Para revisar" (ADR 0024): one tap confirms a suggestion, one pick sets or changes the category. Nothing about the
 * bank entry changes; the choice is kept apart and can be undone.
 */
export default function Review() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const months = useMemo(() => lastMonths(), []);
  const [searchParams, setSearchParams] = useSearchParams();
  const month = months.includes(searchParams.get('month')) ? searchParams.get('month') : months[0];
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
      if (mine === latest.current) setState({ loading: false, error: errorKey(failure), data: null });
    }
  }, [month]);
  useEffect(() => {
    load();
  }, [load]);
  const change = useCategorize(load);

  const data = state.data?.month && state.data.month !== month ? null : state.data;
  const queue = reviewQueue(data);
  const name = monthLabel(month, lang, { month: 'long' });

  return (
    <>
      <Helmet>
        <title>{t('review.pageTitle')}</title>
      </Helmet>
      <Container maxWidth="md">
        <PageHeading
          title={t('review.heading')}
          action={
            <MonthStepper
              months={months}
              month={month}
              onChange={(value) => setSearchParams(value === months[0] ? {} : { month: value }, { replace: true })}
            />
          }
        />
        <Stack spacing={3}>
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 640 }}>
              {t('review.help')}
            </Typography>
            <Button component={RouterLink} to={`/cash-flow?month=${month}`} size="small" sx={{ mt: 1 }}>
              {t('review.back')}
            </Button>
          </Box>
          <CategoryNotice change={change} />
          {state.loading && !data && (
            <Stack role="status" aria-busy="true" aria-label={t('common.loading')}>
              {[0, 1, 2, 3].map((row) => (
                <Skeleton key={row} height={56} />
              ))}
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
          {data && queue.length === 0 && <Typography>{t('review.empty', { month: name })}</Typography>}
          {data && queue.length > 0 && (
            <Box component="section" aria-labelledby="review-queue">
              <Typography id="review-queue" variant="h6" component="h2" role="status">
                {t('review.pending', { count: queue.length })}
              </Typography>
              <Box sx={{ mt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                {queue.map((item) => {
                  const title = item.counterparty || t('cashFlow.items.noName');
                  const suggested = item.origin === 'NAME';
                  return (
                    <ListRow
                      key={item.id}
                      title={title}
                      meta={[
                        dayLabel(item.date, lang),
                        suggested
                          ? t('review.suggestedAs', { category: categoryLabel(item.category, t) })
                          : categoryLabel(item.category, t),
                        item.account,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                      value={`${item.side === 'income' ? '+' : ''}${money(item.amount, lang)}`}
                    >
                      <Stack direction="row" alignItems="center" flexWrap="wrap" sx={{ gap: 1.5, pb: 2, pt: 0.5 }}>
                        {suggested && (
                          <Button
                            variant="outlined"
                            disabled={change.busy}
                            aria-label={t('review.confirmFor', { name: title })}
                            onClick={() => change.choose(item, item.category)}
                          >
                            {t('review.confirm')}
                          </Button>
                        )}
                        <CategorySelect
                          side={item.side}
                          // Empty on purpose: picking is the action, including picking the suggestion itself.
                          value=""
                          label={t(suggested ? 'review.changeFor' : 'review.pickFor', { name: title })}
                          disabled={change.busy}
                          onChange={(category) => change.choose(item, category)}
                        />
                      </Stack>
                    </ListRow>
                  );
                })}
              </Box>
            </Box>
          )}
        </Stack>
      </Container>
    </>
  );
}
