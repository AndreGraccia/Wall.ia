import { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Skeleton, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { ListRow } from '../../components/detail-ui';
import { CertaintyChip } from '../../components/future-ui';
import HttpService from '../../services/HttpService';
import { dayLabel, errorKey, money, percent } from '../../utils/wallet';
import { HIDDEN_AMOUNT } from '../../utils/hiddenAmounts';
import { reasonText } from '../plan/Method';

/*
 * Início, below the first fold (documento de evolução 4.2, ADR 0021): each block answers one question and links to
 * the screen that explains it. Every block loads on its own, so one failing endpoint never blanks the page.
 */

export function useGet(path) {
  const [state, setState] = useState({ loading: Boolean(path), error: null, data: null });
  const load = useCallback(async () => {
    if (!path) return;
    setState((previous) => ({ ...previous, loading: true, error: null }));
    try {
      setState({ loading: false, error: null, data: await HttpService.getWithAuth(path) });
    } catch (failure) {
      setState({ loading: false, error: errorKey(failure), data: null });
    }
  }, [path]);
  useEffect(() => {
    load();
  }, [load]);
  return { ...state, reload: load };
}

function Block({ id, title, action, children }) {
  return (
    <Box component="section" aria-labelledby={id}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1, gap: 1 }}>
        <Typography id={id} variant="h6" component="h2">
          {title}
        </Typography>
        {action}
      </Stack>
      {children}
    </Box>
  );
}
Block.propTypes = {
  id: PropTypes.string.isRequired,
  title: PropTypes.node.isRequired,
  action: PropTypes.node,
  children: PropTypes.node,
};

function LoadFailed({ error, onRetry }) {
  const { t } = useTranslation();
  return (
    <Stack direction="row" alignItems="center" flexWrap="wrap" sx={{ columnGap: 1, py: 1 }}>
      <Typography variant="body2" color="text.secondary">
        {t('dashboard.blockError')} {t(error)}
      </Typography>
      <Button size="small" onClick={onRetry}>
        {t('app.retry')}
      </Button>
    </Stack>
  );
}
LoadFailed.propTypes = { error: PropTypes.string.isRequired, onRetry: PropTypes.func.isRequired };

const show = (hidden, value, lang) => (hidden ? HIDDEN_AMOUNT : money(value, lang));

/**
 * The first negative window explained: when, how low, and the outflows that cause it with their certainty and
 * origin. The way out (exit plan) is already in the card of the day above; this block says why.
 */
export function RiskAlert({ windows, hidden }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  if (!windows?.length) return null;
  const [first, ...rest] = windows;
  const causes = [...first.causes].sort((a, b) => Number(a.amount) - Number(b.amount)).slice(0, 3);
  return (
    <Block
      id="dashboard-risk"
      title={t('dashboard.risk.title')}
      action={
        <Button component={RouterLink} to="/future" size="small">
          {t('dashboard.risk.open')}
        </Button>
      }
    >
      <Box sx={{ borderLeft: '2px solid', borderColor: 'error.main', pl: 2 }}>
        <Typography variant="body1" component="p" sx={{ m: 0 }}>
          {t('dashboard.risk.sentence', {
            start: dayLabel(first.start, lang),
            end: dayLabel(first.end, lang),
            amount: show(hidden, first.lowestBalance, lang),
          })}
        </Typography>
        {first.relief && (
          <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0, mt: 0.5 }}>
            {t('dashboard.risk.relief', {
              label: first.relief.label,
              date: dayLabel(first.relief.date, lang),
            })}
          </Typography>
        )}
        <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0, mt: 1.5 }}>
          {t('dashboard.risk.causes')}
        </Typography>
        <Box>
          {causes.map((cause) => (
            <ListRow
              key={`${cause.reference}-${cause.date}`}
              title={cause.labelKey ? t(`future.labels.${cause.labelKey}`, { defaultValue: cause.label }) : cause.label}
              meta={`${dayLabel(cause.date, lang)} · ${t('dashboard.risk.origin', { origin: cause.origin })}`}
              value={show(hidden, cause.amount, lang)}
              aside={<CertaintyChip certainty={cause.certainty} />}
            />
          ))}
        </Box>
        {rest.length > 0 && (
          <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0, mt: 1 }}>
            {t('dashboard.risk.more', { count: rest.length })}
          </Typography>
        )}
      </Box>
    </Block>
  );
}
RiskAlert.propTypes = { windows: PropTypes.array, hidden: PropTypes.bool };

/** Lowest and closing balance at 30, 60 and 90 days, from the same projection as Futuro. */
export function horizonSummary(projection, horizons = [30, 60, 90]) {
  const days = projection?.days || [];
  return horizons
    .filter((horizon) => days.length > horizon)
    .map((horizon) => {
      const slice = days.slice(0, horizon + 1);
      const lowest = slice.reduce((min, day) => (Number(day.balance) < Number(min.balance) ? day : min), slice[0]);
      return {
        horizon,
        lowest: Number(lowest.balance),
        lowestDate: lowest.date,
        end: Number(slice[slice.length - 1].balance),
      };
    });
}

export function HorizonSummary({ projection, hidden }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const rows = horizonSummary(projection);
  if (!rows.length) return null;
  return (
    <Block id="dashboard-horizons" title={t('dashboard.horizons.title')}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))`,
          columnGap: { xs: 2, md: 4 },
          pt: 1.5,
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        {rows.map((row) => (
          <Box key={row.horizon} sx={{ minWidth: 0 }}>
            <Typography variant="body2" color="text.secondary">
              {t('dashboard.horizons.days', { days: row.horizon })}
            </Typography>
            <Typography
              sx={{
                mt: 0.5,
                typography: { xs: 'subtitle1', md: 'h6' },
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
                overflowWrap: 'anywhere',
                color: row.lowest < 0 && !hidden ? 'error.main' : 'text.primary',
              }}
            >
              {show(hidden, row.lowest, lang)}
            </Typography>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ m: 0 }}>
              {t('dashboard.horizons.lowest', { date: dayLabel(row.lowestDate, lang) })}
            </Typography>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ m: 0 }}>
              {t('dashboard.horizons.end', { amount: show(hidden, row.end, lang) })}
            </Typography>
          </Box>
        ))}
      </Box>
    </Block>
  );
}
HorizonSummary.propTypes = { projection: PropTypes.object, hidden: PropTypes.bool };

/**
 * Planned against what happened, per slice. Only Fixo and Lazer have a measured "realizado"; a slice the user
 * committed is money set aside in Futuro; the others are a decision with no movement behind it, and say so,
 * instead of looking like money already spent or invested.
 */
export function sliceStatus(slice) {
  if (slice.used !== null && slice.used !== undefined) {
    const difference = Number(slice.amount) - Number(slice.used);
    return { kind: 'measured', used: Number(slice.used), difference, over: difference < 0 };
  }
  if (slice.commitment) return { kind: 'committed', committed: Number(slice.committed ?? slice.amount) };
  return { kind: 'planned' };
}

export function PlanVsActual({ plan, hidden, highlighted }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { loading, error, data, reload } = plan;
  const action = (
    <Button component={RouterLink} to="/plan" size="small">
      {t('dashboard.plan.open')}
    </Button>
  );
  let body;
  if (loading && !data) body = <Skeleton variant="rounded" height={160} />;
  else if (error) body = <LoadFailed error={error} onRetry={reload} />;
  else if (!data?.saved || !data.slices?.length)
    body = (
      <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
        {t('dashboard.plan.none')}
      </Typography>
    );
  else
    body = (
      <>
        <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0, mb: 1 }}>
          {data.income?.monthly
            ? t('dashboard.plan.base', { amount: show(hidden, data.income.monthly, lang) })
            : t('dashboard.plan.noIncome')}
          {!data.active && ` ${t('dashboard.plan.draft')}`}
        </Typography>
        <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
          {data.slices.map((slice) => {
            const status = sliceStatus(slice);
            let meta;
            let value;
            let color = 'text.primary';
            if (status.kind === 'measured') {
              meta = t('dashboard.plan.measured', {
                used: show(hidden, status.used, lang),
                planned: show(hidden, slice.amount, lang),
              });
              value = hidden
                ? HIDDEN_AMOUNT
                : t(status.over ? 'dashboard.plan.over' : 'dashboard.plan.left', {
                    amount: money(Math.abs(status.difference), lang),
                  });
              if (status.over && !hidden) color = 'error.main';
            } else if (status.kind === 'committed') {
              meta = t('dashboard.plan.committed');
              value = show(hidden, slice.amount, lang);
            } else {
              meta = t('dashboard.plan.plannedOnly');
              value = show(hidden, slice.amount, lang);
              color = 'text.secondary';
            }
            return (
              <ListRow
                key={slice.position}
                title={`${slice.label || t(`plan.kinds.${slice.kind}`)} · ${percent(slice.percent, lang)}`}
                meta={meta}
                value={value}
                valueColor={color}
              />
            );
          })}
        </Box>
        <Typography variant="caption" color="text.secondary" component="p" sx={{ m: 0, mt: 1 }}>
          {t('dashboard.plan.footnote')}
        </Typography>
      </>
    );
  return (
    <Block
      id="dashboard-plan"
      title={highlighted ? t('dashboard.highlighted', { title: t('dashboard.plan.title') }) : t('dashboard.plan.title')}
      action={action}
    >
      {body}
    </Block>
  );
}
PlanVsActual.propTypes = { plan: PropTypes.object.isRequired, hidden: PropTypes.bool, highlighted: PropTypes.bool };

/** Goals in progress, envelopes and the reserve slice: what is being put aside, and for what. */
export function GoalsAndReserves({ goals, envelopes, plan, hidden, highlighted }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const goalList = goals.data || [];
  const envelopeList = envelopes.data?.items || [];
  const reserve = (plan.data?.slices || []).find((slice) => slice.kind === 'EMERGENCY');
  const failed = goals.error || envelopes.error;
  const loading = (goals.loading && !goals.data) || (envelopes.loading && !envelopes.data);
  const empty = !goalList.length && !envelopeList.length && !reserve;
  return (
    <Block
      id="dashboard-goals"
      title={
        highlighted ? t('dashboard.highlighted', { title: t('dashboard.goals.title') }) : t('dashboard.goals.title')
      }
      action={
        <Button component={RouterLink} to="/envelopes" size="small">
          {t('dashboard.goals.open')}
        </Button>
      }
    >
      {loading && <Skeleton variant="rounded" height={96} />}
      {!loading && failed && (
        <LoadFailed
          error={failed}
          onRetry={() => {
            goals.reload();
            envelopes.reload();
          }}
        />
      )}
      {!loading && !failed && empty && (
        <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
          {t('dashboard.goals.none')}
        </Typography>
      )}
      {!loading && !failed && !empty && (
        <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
          {goalList.map((goal) => (
            <ListRow
              key={`goal-${goal.id}`}
              title={goal.name}
              meta={
                goal.nextDate
                  ? t('dashboard.goals.next', { date: dayLabel(goal.nextDate, lang) })
                  : t('dashboard.goals.goal')
              }
              value={t('dashboard.goals.perMonth', { amount: show(hidden, goal.monthlyAmount, lang) })}
            />
          ))}
          {envelopeList.map((envelope) => (
            <ListRow
              key={`envelope-${envelope.id}`}
              title={envelope.name}
              meta={t('dashboard.goals.envelope')}
              value={show(hidden, envelope.amount, lang)}
            />
          ))}
          {reserve && (
            <ListRow
              title={reserve.label || t('plan.kinds.EMERGENCY')}
              meta={t('dashboard.goals.reserve', { percent: percent(reserve.percent, lang) })}
              value={t('dashboard.goals.perMonth', { amount: show(hidden, reserve.amount, lang) })}
              valueColor="text.secondary"
            />
          )}
        </Box>
      )}
    </Block>
  );
}
GoalsAndReserves.propTypes = {
  goals: PropTypes.object.isRequired,
  envelopes: PropTypes.object.isRequired,
  plan: PropTypes.object.isRequired,
  hidden: PropTypes.bool,
  highlighted: PropTypes.bool,
};

// Which Início block each method's tool puts first. Methods are run by a tool (catalog `where.tool`).
export const HIGHLIGHT_BY_TOOL = {
  MONTH_PLAN: 'plan',
  GOALS: 'goals',
  ENVELOPES: 'goals',
  DEBT_PAYOFF: 'upcoming',
  FUTURE: 'horizons',
};

/**
 * The active method and why the page is ordered the way it is. Without a method, the suggestions with their
 * reasons; comparing methods happens in Meu método and never replaces the current plan.
 */
export function MethodNote({ profile, catalog, suggestions }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const methods = catalog.data?.methods || [];
  const chosen = methods.find((method) => method.id === profile.data?.method);
  if ((profile.loading && !profile.data) || profile.error || catalog.error) return null;
  const highlight = chosen && HIGHLIGHT_BY_TOOL[chosen.where?.tool];
  const top = (suggestions.data?.suggestions || []).slice(0, 2);
  return (
    <Box
      component="section"
      aria-labelledby="dashboard-method"
      sx={{ pt: 2, borderTop: '1px solid', borderColor: 'divider' }}
    >
      <Typography id="dashboard-method" variant="subtitle2" component="h2" sx={{ m: 0 }}>
        {chosen ? t('dashboard.method.current', { name: chosen.name }) : t('dashboard.method.none')}
      </Typography>
      <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0, mt: 0.5, maxWidth: 680 }}>
        {chosen && highlight && t('dashboard.method.why', { block: t(`dashboard.method.blocks.${highlight}`) })}
        {!chosen &&
          top.length > 0 &&
          t('dashboard.method.suggested', {
            list: top
              .map((suggestion) => {
                const method = methods.find((item) => item.id === suggestion.method);
                const reason = suggestion.reasons?.[0];
                return `${method?.name || suggestion.method}${reason ? ` (${reasonText(reason, t, lang)})` : ''}`;
              })
              .join('; '),
          })}
      </Typography>
      <Button component={RouterLink} to="/plan/method" size="small" sx={{ mt: 1, ml: -1 }}>
        {t(chosen ? 'dashboard.method.compare' : 'dashboard.method.choose')}
      </Button>
    </Box>
  );
}
MethodNote.propTypes = {
  profile: PropTypes.object.isRequired,
  catalog: PropTypes.object.isRequired,
  suggestions: PropTypes.object.isRequired,
};
