import { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Container,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Skeleton,
  Stack,
  SvgIcon,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import HttpService from '../../services/HttpService';
import { PageHeading, WalletIcon } from '../../components/wallet-ui';
import { Disclosure, ListRow } from '../../components/detail-ui';
import { dayLabel, errorKey, monthLabel, money, percent } from '../../utils/wallet';

// Fixed and Leisure are measured, never committed: their money is already in the engine (ADR 0021).
export const committable = (kind) => kind !== 'FIXED' && kind !== 'LEISURE';
const PRESETS = ['PERCENT_503020', 'PERCENT_BALANCED', 'ZERO_BASED', 'CUSTOM'];
const MAX_SLICES = 12;

const parsePercent = (value) => {
  const number = Number(String(value).replace(',', '.'));
  return value === '' || Number.isNaN(number) ? 0 : number;
};
// Hundredths of a percent, so 7.5 + 12.5 + ... adds up to exactly 10000 and never 99.99999.
const hundredths = (slices) =>
  slices.reduce((total, slice) => total + Math.round(parsePercent(slice.percent) * 100), 0);
const body = (slices) => ({
  slices: slices.map((slice) => ({
    kind: slice.kind,
    label: slice.label.trim(),
    percent: parsePercent(slice.percent),
    commitment: committable(slice.kind) && slice.commitment,
  })),
});

let nextId = 0;
const decimalComma = () => !document.documentElement.lang?.startsWith('en');
const draftSlice = (slice) => {
  nextId += 1;
  return {
    id: nextId,
    kind: slice.kind,
    label: slice.label,
    percent: decimalComma() ? String(Number(slice.percent)).replace('.', ',') : String(Number(slice.percent)),
    commitment: Boolean(slice.commitment),
  };
};

/** Which preset the slices are, so the toggle shows it after a reload. Zero-based has no fixed shape. */
function presetOf(slices, methods) {
  if (!slices.length) return null;
  const match = methods.find(
    (method) =>
      method.preset?.length === slices.length &&
      method.preset.every(
        (item, index) => item.kind === slices[index].kind && Number(item.percent) === Number(slices[index].percent)
      )
  );
  return match ? match.id : 'CUSTOM';
}

/** Colour says where the money goes (DESIGN.md): into the projection (`future`) or only measured (grey). */
function sliceColor(slice) {
  if (!committable(slice.kind)) return 'text.secondary';
  return slice.commitment ? 'secondary.main' : 'grey.600';
}

/**
 * The income as one line cut into slices: the plan at a glance. Each segment names itself ("Fixo 35%"); the coloured
 * dots on the rows below are the visual legend. Unassigned stays an empty dashed segment.
 */
function SplitBar({ slices }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const total = hundredths(slices);
  const free = Math.max(0, 10000 - total);
  const scale = Math.max(total, 10000);
  return (
    <Box
      role="group"
      aria-label={t('plan.slices.barLabel')}
      sx={{ display: 'flex', gap: '2px', height: 12, borderRadius: 999, overflow: 'hidden' }}
    >
      {slices.map((slice) => {
        const width = (Math.round(parsePercent(slice.percent) * 100) / scale) * 100;
        return width > 0 ? (
          <Box
            key={slice.id}
            role="img"
            aria-label={`${slice.label || t(`plan.kinds.${slice.kind}`)} ${percent(parsePercent(slice.percent), lang)}`}
            sx={{ width: `${width}%`, bgcolor: sliceColor(slice) }}
          />
        ) : null;
      })}
      {free > 0 && (
        <Box
          role="img"
          aria-label={`${t('plan.slices.free')} ${percent(free / 100, lang)}`}
          sx={{
            flex: 1,
            border: '1px dashed',
            borderColor: 'grey.600',
            borderRadius: '0 999px 999px 0',
          }}
        />
      )}
    </Box>
  );
}
SplitBar.propTypes = { slices: PropTypes.array.isRequired };

/** Fixed (thermometer) and Leisure (ceiling): how much of the slice is already used, and by how much it went over. */
function Meter({ used, goal, labelKey, overKey }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const ratio = goal > 0 ? used / goal : used > 0 ? Infinity : 0;
  const over = ratio > 1;
  return (
    <Box sx={{ maxWidth: 420 }}>
      <Box aria-hidden sx={{ height: 4, borderRadius: 999, bgcolor: 'divider', overflow: 'hidden' }}>
        <Box
          sx={{
            height: '100%',
            width: `${Math.min(ratio, 1) * 100}%`,
            bgcolor: over ? 'error.main' : 'text.secondary',
          }}
        />
      </Box>
      <Typography variant="caption" component="p" sx={{ mt: 0.75, color: over ? 'error.main' : 'text.secondary' }}>
        {over
          ? t(overKey, { amount: money(used - goal, lang) })
          : `${t(labelKey, { used: money(used, lang), goal: money(goal, lang) })}, ${t('plan.roles.used', {
              percent: percent(Math.round(ratio * 100), lang),
            })}`}
      </Typography>
    </Box>
  );
}
Meter.propTypes = {
  used: PropTypes.number.isRequired,
  goal: PropTypes.number.isRequired,
  labelKey: PropTypes.string.isRequired,
  overKey: PropTypes.string.isRequired,
};

function SliceRow({ slice, position, amount, used, onChange, onRemove }) {
  const { t, i18n } = useTranslation();
  const name = slice.label || t(`plan.kinds.${slice.kind}`);
  let role = null;
  if (amount !== null && used !== null && slice.kind === 'FIXED')
    role = <Meter used={used} goal={amount} labelKey="plan.roles.fixed" overKey="plan.roles.fixedOver" />;
  if (amount !== null && used !== null && slice.kind === 'LEISURE')
    role = <Meter used={used} goal={amount} labelKey="plan.roles.leisure" overKey="plan.roles.leisureOver" />;
  return (
    <Box component="li" sx={{ py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
      <Box
        sx={{
          display: 'grid',
          alignItems: 'center',
          columnGap: 1.5,
          rowGap: 1,
          gridTemplateColumns: { xs: '12px minmax(0, 1fr) 96px 40px', md: '12px minmax(0, 1fr) 104px 128px 40px' },
          gridTemplateAreas: {
            xs: '"dot label label remove" ". amount percent ."',
            md: '"dot label percent amount remove"',
          },
        }}
      >
        <Box aria-hidden sx={{ gridArea: 'dot', width: 8, height: 8, borderRadius: 999, bgcolor: sliceColor(slice) }} />
        <TextField
          size="small"
          value={slice.label}
          onChange={(event) => onChange({ label: event.target.value })}
          inputProps={{ maxLength: 40, 'aria-label': t('plan.slices.label', { position: position + 1 }) }}
          sx={{ gridArea: 'label' }}
        />
        <TextField
          size="small"
          value={slice.percent}
          onChange={(event) => onChange({ percent: event.target.value.replace(/[^\d.,]/g, '') })}
          inputProps={{ inputMode: 'decimal', 'aria-label': t('plan.slices.percent', { label: name }) }}
          InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
          sx={{ gridArea: 'percent', '& input': { textAlign: 'right', fontVariantNumeric: 'tabular-nums' } }}
        />
        <Typography
          variant="subtitle2"
          component="p"
          sx={{
            gridArea: 'amount',
            m: 0,
            textAlign: { xs: 'left', md: 'right' },
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
            color: amount === null ? 'text.disabled' : 'text.primary',
          }}
        >
          {amount === null ? '—' : money(amount, i18n.language)}
        </Typography>
        <IconButton
          onClick={onRemove}
          aria-label={t('plan.slices.remove', { label: name })}
          sx={{ gridArea: 'remove', width: 40, height: 40, color: 'text.secondary' }}
        >
          <WalletIcon name="trash" sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>
      {(role || committable(slice.kind)) && (
        <Box sx={{ pl: { xs: 3, md: 3 }, pt: 1 }}>
          {role}
          {committable(slice.kind) && (
            <FormControlLabel
              sx={{ ml: -1, mr: 0 }}
              control={
                <Switch
                  size="small"
                  checked={slice.commitment}
                  onChange={(event) => onChange({ commitment: event.target.checked })}
                />
              }
              label={
                <Typography variant="body2" color="text.secondary">
                  {t('plan.slices.commitment')}
                </Typography>
              }
            />
          )}
        </Box>
      )}
    </Box>
  );
}
SliceRow.propTypes = {
  slice: PropTypes.object.isRequired,
  position: PropTypes.number.isRequired,
  amount: PropTypes.number,
  used: PropTypes.number,
  onChange: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
};

/** Reading mode: one 56 px line per saved slice. Fixed and Leisure show how much is used; the rest say what happens. */
function SliceLine({ slice, amount, used }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const measured = amount !== null && used !== null;
  let meta = t(committable(slice.kind) && slice.commitment ? 'plan.roles.committed' : 'plan.roles.reserved');
  if (measured && slice.kind === 'FIXED')
    meta = <Meter used={used} goal={amount} labelKey="plan.roles.fixed" overKey="plan.roles.fixedOver" />;
  if (measured && slice.kind === 'LEISURE')
    meta = <Meter used={used} goal={amount} labelKey="plan.roles.leisure" overKey="plan.roles.leisureOver" />;
  return (
    <ListRow
      title={
        <>
          <Box
            component="span"
            aria-hidden
            sx={{
              display: 'inline-block',
              width: 8,
              height: 8,
              mr: 1.5,
              borderRadius: 999,
              verticalAlign: 'middle',
              bgcolor: sliceColor(slice),
            }}
          />
          {slice.label || t(`plan.kinds.${slice.kind}`)}
        </>
      }
      meta={meta}
      value={amount === null ? '—' : money(amount, lang)}
      aside={
        <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {percent(parsePercent(slice.percent), lang)}
        </Typography>
      }
    />
  );
}
SliceLine.propTypes = { slice: PropTypes.object.isRequired, amount: PropTypes.number, used: PropTypes.number };

/** Three dots for the "more actions" button; drawn here because the icon set has no filled glyphs. */
const MoreIcon = (props) => (
  <SvgIcon viewBox="0 0 24 24" {...props}>
    <circle cx="5" cy="12" r="1.75" />
    <circle cx="12" cy="12" r="1.75" />
    <circle cx="19" cy="12" r="1.75" />
  </SvgIcon>
);

/** "Ver se cabe": the 90 days without and with the slices, from the engine. Nothing is saved. */
function FitResult({ result }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const before = result.baseline;
  const after = result.scenario;
  const worse = after.negativeDays > before.negativeDays;
  const rows = [
    ['plan.fit.negativeDays', before.negativeDays, after.negativeDays, after.negativeDays > before.negativeDays],
    [
      'plan.fit.lowest',
      money(before.minBalance90, lang),
      money(after.minBalance90, lang),
      Number(after.minBalance90) < 0,
    ],
  ];
  return (
    <Box sx={{ pl: 2, borderLeft: '2px solid', borderColor: worse ? 'warning.main' : 'success.main' }}>
      <Typography variant="body2" sx={{ maxWidth: 640 }}>
        {worse
          ? t('plan.fit.no', {
              count: after.negativeDays - before.negativeDays,
              date: dayLabel(after.firstNegativeDate, lang),
              amount: money(after.minBalance90, lang),
            })
          : t(before.negativeDays > 0 ? 'plan.fit.sameHole' : 'plan.fit.yes', {
              amount: money(after.minBalance90, lang),
              date: dayLabel(after.minDate, lang),
            })}
      </Typography>
      <Box
        component="dl"
        sx={{
          m: 0,
          mt: 2,
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto auto',
          columnGap: 3,
          rowGap: 1,
          maxWidth: 480,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <span />
        <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'right' }}>
          {t('plan.fit.before')}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'right' }}>
          {t('plan.fit.after')}
        </Typography>
        {rows.map(([label, a, b, bad]) => (
          <Box key={label} sx={{ display: 'contents' }}>
            <Typography component="dt" variant="body2" color="text.secondary">
              {t(label)}
            </Typography>
            <Typography component="dd" variant="subtitle2" sx={{ m: 0, textAlign: 'right' }}>
              {a}
            </Typography>
            <Typography
              component="dd"
              variant="subtitle2"
              sx={{ m: 0, textAlign: 'right', fontWeight: 600, color: bad ? 'error.main' : 'text.primary' }}
            >
              {b}
            </Typography>
          </Box>
        ))}
      </Box>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1.5 }}>
        {t('plan.fit.commitment', { amount: money(result.newMonthlyCommitment, lang) })} {t('plan.fit.nothingSaved')}
      </Typography>
    </Box>
  );
}
FitResult.propTypes = { result: PropTypes.object.isRequired };

/** What a month leaves: "Sobra R$ X" or, below zero, "Falta R$ X" in `negative` (never "Sobra −R$ X"). */
export function monthResult(net) {
  const value = Number(net);
  return { short: value < 0, amount: Math.abs(value) };
}

/** Month by month: what comes in and goes out, confirmed and estimated apart, the plan and what is left. */
function MonthlyProjection({ months, onMonths, state, onRetry }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { data } = state;
  const signed = (value) => `${Number(value) < 0 ? '−' : ''}${money(Math.abs(Number(value)), lang)}`;
  return (
    <Box component="section" aria-labelledby="plan-projection">
      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" sx={{ gap: 2, mb: 1 }}>
        <Typography id="plan-projection" variant="h6" component="h2">
          {t('plan.projection.title')}
        </Typography>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={months}
          onChange={(_, value) => value && onMonths(value)}
          aria-label={t('plan.projection.label')}
        >
          {[3, 6, 12].map((count) => (
            <ToggleButton key={count} value={count}>
              {t('plan.projection.months', { count })}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>
      {state.error && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" onClick={onRetry}>
              {t('app.retry')}
            </Button>
          }
        >
          {t('plan.projection.loadError')} {t(state.error)}
        </Alert>
      )}
      {state.loading && !data && (
        <Box role="status" aria-label={t('common.loading')}>
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} height={56} />
          ))}
        </Box>
      )}
      {data && (
        <Box
          aria-busy={state.loading}
          sx={{ borderTop: '1px solid', borderColor: 'divider', opacity: state.loading ? 0.6 : 1 }}
        >
          {data.items.map((item) => {
            const name = monthLabel(item.month, lang).replace(/^./, (letter) => letter.toLocaleUpperCase());
            const inflow = Number(item.inflowConfirmed) + Number(item.inflowEstimated);
            const outflow = Number(item.outflowConfirmed) + Number(item.outflowEstimated);
            const result = monthResult(item.net);
            const details = [
              [`${t('plan.projection.in')}, ${t('plan.projection.confirmed').toLowerCase()}`, item.inflowConfirmed],
              [`${t('plan.projection.in')}, ${t('plan.projection.estimated').toLowerCase()}`, item.inflowEstimated],
              [`${t('plan.projection.out')}, ${t('plan.projection.confirmed').toLowerCase()}`, item.outflowConfirmed],
              [`${t('plan.projection.out')}, ${t('plan.projection.estimated').toLowerCase()}`, item.outflowEstimated],
              [t('plan.projection.plan'), item.plan],
              [t('plan.projection.endBalance'), item.endBalance],
            ];
            return (
              <ListRow
                key={item.month}
                title={
                  <>
                    {name}
                    {item.partial && (
                      <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                        {t('plan.projection.partial')}
                      </Typography>
                    )}
                  </>
                }
                meta={`${t('plan.projection.meta', {
                  inflow: money(inflow, lang),
                  outflow: money(outflow, lang),
                })}${
                  Number(item.plan) > 0 ? `, ${t('plan.projection.plan').toLowerCase()} ${money(item.plan, lang)}` : ''
                }`}
                value={money(result.amount, lang)}
                valueColor={result.short ? 'error.main' : 'text.primary'}
                aside={
                  <Typography variant="caption" sx={{ color: result.short ? 'error.main' : 'text.secondary' }}>
                    {t(result.short ? 'plan.projection.short' : 'plan.projection.net')}
                  </Typography>
                }
                detailLabel={t('plan.projection.detail', { month: name })}
                detail={
                  <Box
                    component="dl"
                    sx={{
                      m: 0,
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 1fr) auto',
                      columnGap: 3,
                      rowGap: 0.5,
                      maxWidth: 420,
                    }}
                  >
                    {details.map(([label, value]) => (
                      <Box key={label} sx={{ display: 'contents' }}>
                        <Typography component="dt" variant="body2" color="text.secondary">
                          {label}
                        </Typography>
                        <Typography
                          component="dd"
                          variant="body2"
                          sx={{ m: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                        >
                          {signed(value)}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                }
              />
            );
          })}
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1.5 }}>
            {t('plan.projection.note')}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
MonthlyProjection.propTypes = {
  months: PropTypes.number.isRequired,
  onMonths: PropTypes.func.isRequired,
  state: PropTypes.object.isRequired,
  onRetry: PropTypes.func.isRequired,
};

/** The answer first: this month's result, the same number as the first line of "Próximos meses". */
function Hero({ item, loading }) {
  const { t, i18n } = useTranslation();
  if (!item) return loading ? <Skeleton width="min(360px, 80%)" height={64} /> : null;
  const result = monthResult(item.net);
  return (
    <Typography id="plan-hero" component="h2" sx={{ m: 0 }}>
      <Typography component="span" variant="body1" color="text.secondary" sx={{ display: 'block' }}>
        {t('plan.hero.lead')}
      </Typography>{' '}
      <Typography
        component="span"
        variant="h2"
        sx={{ display: 'block', my: 0.5, color: result.short ? 'error.main' : 'text.primary' }}
      >
        {t(result.short ? 'plan.hero.short' : 'plan.hero.left', { amount: money(result.amount, i18n.language) })}
      </Typography>
    </Typography>
  );
}
Hero.propTypes = { item: PropTypes.object, loading: PropTypes.bool };

/**
 * Plano do mês (ADR 0021): the confirmed income split into slices. Saving or turning the plan on commits nothing;
 * only slices marked "tirar do saldo no dia da renda" leave the balance, on income day. A saved plan opens for
 * reading; "Editar fatias" opens the editor.
 */
export default function Plan() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [searchParams, setSearchParams] = useSearchParams();
  const [state, setState] = useState({ loading: true, error: null, plan: null, methods: [], profile: null });
  const [draft, setDraft] = useState([]);
  const [preset, setPreset] = useState(null);
  const [editing, setEditing] = useState(false);
  const [fit, setFit] = useState(null);
  const [busy, setBusy] = useState(null);
  const [notice, setNotice] = useState(null);
  const [failure, setFailure] = useState(null);
  const [projectionKey, setProjectionKey] = useState(0);
  const [months, setMonths] = useState(3);
  const [projection, setProjection] = useState({ loading: true, error: null, data: null });
  const [menu, setMenu] = useState(null);
  const latest = useRef(0);
  const slicesRef = useRef(null);
  const moveFocus = useRef(false);

  const loadProjection = useCallback(async () => {
    latest.current += 1;
    const mine = latest.current;
    setProjection((previous) => ({ ...previous, loading: true, error: null }));
    try {
      const data = await HttpService.getWithAuth(`/plan/projection?months=${months}`);
      if (mine === latest.current) setProjection({ loading: false, error: null, data });
    } catch (error) {
      if (mine === latest.current)
        setProjection((previous) => ({ ...previous, loading: false, error: errorKey(error) }));
    }
  }, [months]);
  useEffect(() => {
    loadProjection();
  }, [loadProjection, projectionKey]);

  // Switching between reading and editing replaces the focused button: hand the focus to the new mode.
  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    slicesRef.current?.querySelector(editing ? 'input, [aria-pressed]' : 'button[data-edit]')?.focus();
  }, [editing]);

  const applyPreset = useCallback(
    (id, plan, methods) => {
      setFit(null);
      setPreset(id);
      if (id === 'CUSTOM') {
        setDraft((previous) =>
          previous.length ? previous : [draftSlice({ kind: 'CUSTOM', label: t('plan.kinds.CUSTOM'), percent: 0 })]
        );
        return;
      }
      if (id === 'ZERO_BASED') {
        // Every real gets a job: start from what the fixed bills already take, the rest is for the person to assign.
        const income = Number(plan?.income?.monthly) || 0;
        const fixed = Number(plan?.fixed?.recurring || 0) + Number(plan?.fixed?.loans || 0);
        const share = income > 0 ? Math.min(100, Math.round((fixed / income) * 10000) / 100) : 0;
        setDraft(
          ['FIXED', 'LEISURE', 'FUTURE', 'EMERGENCY'].map((kind) =>
            draftSlice({ kind, label: t(`plan.kinds.${kind}`), percent: kind === 'FIXED' ? share : 0 })
          )
        );
        return;
      }
      const method = methods.find((item) => item.id === id);
      if (!method?.preset?.length) return;
      setDraft(
        method.preset.map((item) =>
          draftSlice({ ...item, label: t(`plan.presetLabels.${id}.${item.kind}`, { defaultValue: item.label }) })
        )
      );
    },
    [t]
  );

  const load = useCallback(async () => {
    setState((previous) => ({ ...previous, loading: true, error: null }));
    // The catalog (presets) and the profile (method name) are extras: the plan stands without them.
    const [plan, catalog, profile] = await Promise.allSettled([
      HttpService.getWithAuth('/plan'),
      HttpService.getWithAuth('/methods'),
      HttpService.getWithAuth('/profile'),
    ]);
    if (plan.status === 'rejected') {
      setState((previous) => ({ ...previous, loading: false, error: errorKey(plan.reason) }));
      return;
    }
    const methods = catalog.status === 'fulfilled' ? catalog.value.methods : [];
    const slices = (plan.value.slices || []).map(draftSlice);
    setState({
      loading: false,
      error: null,
      plan: plan.value,
      methods,
      profile: profile.status === 'fulfilled' ? profile.value : null,
    });
    setDraft(slices);
    setPreset(presetOf(slices, methods));
    let edit = !plan.value.saved || slices.length === 0;
    // "Usar no plano" from Meu método arrives as ?preset=: it fills the draft in the editor, nothing is saved.
    const asked = searchParams.get('preset');
    if (asked && PRESETS.includes(asked) && !plan.value.active) {
      applyPreset(asked, plan.value, methods);
      edit = true;
    }
    if (asked) setSearchParams({}, { replace: true });
    setEditing(edit);
    // Runs once per visit; the preset in the URL is read only then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const { plan, methods, profile } = state;
  const income = plan?.income?.monthly != null ? Number(plan.income.monthly) : null;
  const total = hundredths(draft);
  const complete = total === 10000;
  const savedSlices = (plan?.slices || []).map(draftSlice);
  const dirty = JSON.stringify(body(draft)) !== JSON.stringify(body(savedSlices));
  const fixedUsed = plan?.fixed ? Number(plan.fixed.recurring || 0) + Number(plan.fixed.loans || 0) : null;
  const leisureSaved = plan?.slices?.find((slice) => slice.kind === 'LEISURE');
  const leisureUsed = leisureSaved?.used != null ? Number(leisureSaved.used) : null;
  const usedFor = (slice) => (slice.kind === 'FIXED' ? fixedUsed : slice.kind === 'LEISURE' ? leisureUsed : null);
  const methodName = profile?.method
    ? t(`method.catalog.${profile.method}.name`, {
        defaultValue: methods.find((item) => item.id === profile.method)?.name || profile.method,
      })
    : null;

  // The engine's amount when the slice is the saved one; a cents preview of base x percent while editing.
  const amountFor = (slice, index) => {
    if (income === null) return null;
    const saved = plan.slices?.[index];
    if (
      saved &&
      saved.kind === slice.kind &&
      Number(saved.percent) === parsePercent(slice.percent) &&
      saved.amount != null
    )
      return Number(saved.amount);
    return Math.round(income * parsePercent(slice.percent)) / 100;
  };

  const change = (id, patch) => {
    setFit(null);
    setNotice(null);
    setDraft((previous) => previous.map((slice) => (slice.id === id ? { ...slice, ...patch } : slice)));
  };
  const remove = (id) => {
    setFit(null);
    setDraft((previous) => previous.filter((slice) => slice.id !== id));
  };
  const add = () => {
    setFit(null);
    setPreset('CUSTOM');
    setDraft((previous) => [...previous, draftSlice({ kind: 'CUSTOM', label: t('plan.kinds.CUSTOM'), percent: 0 })]);
  };
  const openEditor = () => {
    setNotice(null);
    setFailure(null);
    moveFocus.current = true;
    setEditing(true);
  };
  const closeEditor = () => {
    setFit(null);
    setDraft(savedSlices);
    setPreset(presetOf(savedSlices, methods));
    moveFocus.current = true;
    setEditing(false);
  };

  const run = async (kind, action) => {
    setBusy(kind);
    setFailure(null);
    setNotice(null);
    try {
      await action();
    } catch (error) {
      setFailure(errorKey(error));
    } finally {
      setBusy(null);
    }
  };
  const accept = (next, message) => {
    setState((previous) => ({ ...previous, plan: next }));
    setDraft((next.slices || []).map(draftSlice));
    // The simulation compared the draft with the old "now"; once saved, it no longer describes anything.
    setFit(null);
    setNotice(message);
    setProjectionKey((key) => key + 1);
    // Saved: back to reading what was saved.
    setEditing(!next.saved || !next.slices?.length);
  };
  const save = () =>
    run('save', async () => {
      const next = await HttpService.putWithAuth('/plan', body(draft));
      accept(next, t(plan.active ? 'plan.saved.changes' : 'plan.saved.draft'));
    });
  const activate = (active) =>
    run('activate', async () => {
      if (active && (dirty || !plan.saved)) await HttpService.putWithAuth('/plan', body(draft));
      const next = await HttpService.putWithAuth('/plan/activation', { active });
      accept(next, t(active ? 'plan.saved.active' : 'plan.saved.inactive'));
    });
  const seeIfFits = () =>
    run('fit', async () => {
      setFit(await HttpService.postWithAuth('/plan/fit', body(draft)));
    });

  let blocked = null;
  if (income === null) blocked = t('plan.blocked.income');
  else if (!complete) blocked = t('plan.blocked.incomplete');
  const missing = 10000 - total;
  let sumText = '';
  // Base zero counts in reais: every real of the income needs a job, so what is left is said as money.
  if (missing > 0)
    sumText =
      preset === 'ZERO_BASED' && income
        ? t('plan.sum.missingMoney', {
            amount: money((Number(income) * missing) / 10000, lang),
            percent: percent(missing / 100, lang),
          })
        : t('plan.sum.missing', { percent: percent(missing / 100, lang) });
  const fixedShare =
    Number(plan?.income?.monthly) > 0
      ? ((Number(plan?.fixed?.recurring || 0) + Number(plan?.fixed?.loans || 0)) / Number(plan.income.monthly)) * 100
      : 0;
  if (missing < 0) sumText = t('plan.sum.over', { percent: percent(-missing / 100, lang) });

  let statusLine = t('plan.meta.inactive', { status: t(`plan.status.${plan?.status}`) });
  if (plan?.active)
    statusLine =
      Number(plan.monthlyCommitment) > 0
        ? t('plan.meta.activeCommitment', { amount: money(plan.monthlyCommitment, lang) })
        : t('plan.meta.active');
  if (methodName) statusLine += ` · ${t('plan.method.current', { name: methodName })}`;

  const sum = (
    <Typography
      variant="body2"
      role="status"
      sx={{ mt: 1, fontVariantNumeric: 'tabular-nums', color: complete ? 'text.secondary' : 'warning.main' }}
    >
      {t('plan.sum.total', { percent: percent(total / 100, lang) })}
      {sumText && `, ${sumText}`}
    </Typography>
  );
  const activateButton = (
    <Button variant="contained" onClick={() => activate(true)} disabled={Boolean(blocked) || Boolean(busy)}>
      {busy === 'activate' ? t('plan.actions.saving') : t('plan.actions.activate')}
    </Button>
  );
  const blockedText = !plan?.active && blocked && (
    <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
      {blocked}
    </Typography>
  );

  return (
    <>
      <Helmet>
        <title>{t('plan.pageTitle')}</title>
      </Helmet>
      <Container maxWidth="lg">
        <PageHeading
          title={t('plan.heading')}
          action={
            plan && (
              <>
                <IconButton
                  id="plan-more"
                  aria-label={t('plan.menu.label')}
                  aria-haspopup="menu"
                  aria-controls={menu ? 'plan-menu' : undefined}
                  aria-expanded={Boolean(menu)}
                  onClick={(event) => setMenu(event.currentTarget)}
                  sx={{ width: 44, height: 44, color: 'text.secondary' }}
                >
                  <MoreIcon sx={{ fontSize: 20 }} />
                </IconButton>
                <Menu
                  id="plan-menu"
                  anchorEl={menu}
                  open={Boolean(menu)}
                  onClose={() => setMenu(null)}
                  MenuListProps={{ 'aria-labelledby': 'plan-more' }}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                >
                  <MenuItem component={RouterLink} to="/plan/method">
                    {t('plan.method.change')}
                  </MenuItem>
                  {plan.active && (
                    <MenuItem
                      disabled={Boolean(busy)}
                      onClick={() => {
                        setMenu(null);
                        activate(false);
                      }}
                    >
                      {t('plan.actions.deactivate')}
                    </MenuItem>
                  )}
                </Menu>
              </>
            )
          }
        />

        {state.loading && !plan && (
          <Stack spacing={4} role="status" aria-busy="true" aria-label={t('common.loading')}>
            <Box>
              <Skeleton width={180} />
              <Skeleton width="min(320px, 80%)" height={56} />
            </Box>
            <Skeleton variant="rounded" height={12} />
            {[0, 1, 2].map((row) => (
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
            {t('plan.loadError')} {t(state.error)}
          </Alert>
        )}

        {plan && (
          <Stack spacing={{ xs: 4, md: 5 }}>
            {/* (1) The answer: what this month leaves; the income and the plan's state as metadata. */}
            <Box component="section" aria-labelledby="plan-hero">
              <Hero item={projection.data?.items?.[0]} loading={projection.loading} />
              {income === null ? (
                <Box sx={{ pl: 2, mt: 2, borderLeft: '2px solid', borderColor: 'warning.main' }}>
                  <Typography sx={{ maxWidth: 560 }}>{t('plan.noIncome')}</Typography>
                  <Button component={RouterLink} to="/future" variant="contained" sx={{ mt: 2 }}>
                    {t('plan.noIncomeAction')}
                  </Button>
                </Box>
              ) : (
                <>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {t('plan.meta.income', {
                      amount: money(income, lang),
                      date: dayLabel(plan.income.nextDate, lang),
                    })}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {statusLine}
                  </Typography>
                  <Disclosure label={t('plan.income.why')}>
                    <Typography variant="body2" color="text.secondary">
                      {t('plan.income.whyText')}
                    </Typography>
                    <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
                      {plan.income.sources.map((source) => (
                        <Typography component="li" variant="body2" color="text.secondary" key={source.key}>
                          {t('plan.income.source', { name: source.counterparty, day: source.typicalDay })}:{' '}
                          {money(source.amount, lang)}
                        </Typography>
                      ))}
                    </Box>
                  </Disclosure>
                </>
              )}
            </Box>
            {plan.warnings?.includes('ACTIVE_WITHOUT_INCOME') && (
              <Alert severity="warning">{t('plan.activeWithoutIncome')}</Alert>
            )}

            {/* (2) The months ahead, with the plan. */}
            <MonthlyProjection months={months} onMonths={setMonths} state={projection} onRetry={loadProjection} />

            {/* (3) The split: read it, or edit it. */}
            <Box component="section" aria-labelledby="plan-slices" ref={slicesRef}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ gap: 2 }}>
                <Typography id="plan-slices" variant="h6" component="h2">
                  {t('plan.slices.title')}
                </Typography>
                {!editing && (
                  <Button variant="outlined" data-edit onClick={openEditor}>
                    {t('plan.slices.edit')}
                  </Button>
                )}
              </Stack>

              {!editing && (
                <>
                  <Box sx={{ mt: 2, maxWidth: 880 }}>
                    <SplitBar slices={savedSlices} />
                    {!complete && sum}
                  </Box>
                  <Box sx={{ mt: 2, maxWidth: 880, borderTop: '1px solid', borderColor: 'divider' }}>
                    {savedSlices.map((slice, index) => (
                      <SliceLine key={slice.id} slice={slice} amount={amountFor(slice, index)} used={usedFor(slice)} />
                    ))}
                  </Box>
                  {!plan.active && (
                    <Box sx={{ mt: 2 }}>
                      {activateButton}
                      {blockedText}
                    </Box>
                  )}
                </>
              )}

              {editing && (
                <>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2, mb: 1 }}>
                    {t('plan.presets.label')}
                  </Typography>
                  <ToggleButtonGroup
                    exclusive
                    value={preset}
                    onChange={(_, value) => value && applyPreset(value, plan, methods)}
                    aria-label={t('plan.presets.label')}
                    sx={{ flexWrap: 'wrap', borderRadius: { xs: '20px', sm: 999 } }}
                  >
                    {PRESETS.map((id) => (
                      <ToggleButton
                        key={id}
                        value={id}
                        disabled={
                          ['PERCENT_503020', 'PERCENT_BALANCED'].includes(id) && !methods.some((item) => item.id === id)
                        }
                      >
                        {t(`plan.presets.${id}`)}
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                  {preset && (
                    <Typography variant="body2" color="text.secondary" component="p" sx={{ mt: 1, maxWidth: 680 }}>
                      {t(`plan.presets.help.${preset}`, { fixed: percent(Math.round(fixedShare * 100) / 100, lang) })}
                    </Typography>
                  )}

                  {draft.length === 0 ? (
                    <Typography color="text.secondary" sx={{ mt: 3 }}>
                      {t('plan.empty')}
                    </Typography>
                  ) : (
                    <>
                      <Box sx={{ mt: 3, maxWidth: 880 }}>
                        <SplitBar slices={draft} />
                        {sum}
                      </Box>
                      <Box
                        component="ul"
                        sx={{
                          m: 0,
                          mt: 2,
                          p: 0,
                          maxWidth: 880,
                          listStyle: 'none',
                          borderTop: '1px solid',
                          borderColor: 'divider',
                        }}
                      >
                        {draft.map((slice, index) => (
                          <SliceRow
                            key={slice.id}
                            slice={slice}
                            position={index}
                            amount={amountFor(slice, index)}
                            used={usedFor(slice)}
                            onChange={(patch) => change(slice.id, patch)}
                            onRemove={() => remove(slice.id)}
                          />
                        ))}
                      </Box>
                    </>
                  )}
                  <Stack direction="row" alignItems="center" flexWrap="wrap" sx={{ gap: 1, mt: 1.5 }}>
                    {draft.length < MAX_SLICES && (
                      <Button onClick={add} startIcon={<WalletIcon name="plus" sx={{ fontSize: 18 }} />}>
                        {t('plan.slices.add')}
                      </Button>
                    )}
                    <Disclosure label={t('plan.slices.why')}>
                      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 640 }}>
                        {t('plan.slices.whyText')}
                      </Typography>
                    </Disclosure>
                  </Stack>

                  {/* Decide: see if it fits (saves nothing), then save or turn it on. */}
                  {(draft.length > 0 || plan.saved) && (
                    <Box sx={{ mt: { xs: 4, md: 5 } }}>
                      <Stack direction="row" flexWrap="wrap" sx={{ gap: 1 }}>
                        {plan.active
                          ? dirty && (
                              <Button variant="contained" onClick={save} disabled={!complete || Boolean(busy)}>
                                {busy === 'save' ? t('plan.actions.saving') : t('plan.actions.saveChanges')}
                              </Button>
                            )
                          : draft.length > 0 && activateButton}
                        {draft.length > 0 && (
                          <Button variant="outlined" onClick={seeIfFits} disabled={income === null || Boolean(busy)}>
                            {busy === 'fit' ? t('plan.actions.fitting') : t('plan.actions.fit')}
                          </Button>
                        )}
                        {!plan.active && dirty && (
                          <Button onClick={save} disabled={Boolean(busy)}>
                            {busy === 'save' ? t('plan.actions.saving') : t('plan.actions.save')}
                          </Button>
                        )}
                        {plan.saved && savedSlices.length > 0 && (
                          <Button onClick={closeEditor} disabled={Boolean(busy)} sx={{ color: 'text.secondary' }}>
                            {t('plan.actions.cancel')}
                          </Button>
                        )}
                      </Stack>
                      {blockedText}
                      <Box aria-live="polite" sx={{ mt: fit ? 2 : 0 }}>
                        {fit && (
                          <>
                            <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }}>
                              {t('plan.fit.title')}
                            </Typography>
                            <FitResult result={fit} />
                          </>
                        )}
                      </Box>
                    </Box>
                  )}
                </>
              )}

              <Box aria-live="polite" sx={{ mt: notice || failure ? 2 : 0 }}>
                {failure && <Alert severity="error">{t(failure)}</Alert>}
                {notice && <Alert severity="success">{notice}</Alert>}
              </Box>
            </Box>
          </Stack>
        )}
      </Container>
    </>
  );
}
