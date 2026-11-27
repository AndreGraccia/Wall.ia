import { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Alert,
  Box,
  Button,
  IconButton,
  LinearProgress,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import HttpService from '../../services/HttpService';
import { SectionCard, WalletIcon } from '../../components/wallet-ui';
import { dayLabel, errorKey, money, parseAmount, percent, savingsInAYear } from '../../utils/wallet';

const EMPTY = { name: '', amount: '', day: '', target: '', date: '', saved: '' };
// Same ceilings as the API, so the user sees why instead of a generic 422.
const MAX_MONTHLY_CENTS = 100000000;
const MAX_TARGET_CENTS = 10000000000;
const FULL_DATE = { day: '2-digit', month: '2-digit', year: 'numeric' };

/** Optional money field: empty is null, anything else has to be inside the range. */
const optional = (text, min) => {
  if (text.trim() === '') return { value: null, invalid: false };
  const cents = parseAmount(text);
  const invalid = cents === null || cents < min || cents > MAX_TARGET_CENTS;
  return { value: invalid ? null : cents / 100, invalid };
};

/** The request body of a goal as the API returned it, to put it back (undo). */
const bodyOf = (goal) => ({
  name: goal.name,
  monthlyAmount: goal.monthlyAmount,
  dayOfMonth: goal.dayOfMonth,
  targetAmount: goal.targetAmount ?? null,
  targetDate: goal.targetDate ?? null,
  savedAmount: goal.savedAmount ?? null,
});

const formOf = (goal) => ({
  name: goal.name,
  amount: String(goal.monthlyAmount),
  day: String(goal.dayOfMonth),
  target: String(goal.targetAmount ?? ''),
  date: goal.targetDate ?? '',
  saved: String(goal.savedAmount ?? ''),
});

/**
 * Monthly goals the user sets. Each one leaves the spendable balance on its day, so the daily limit
 * already answers "how much can I spend without giving up the goal?". Target, date and saved amount are optional;
 * every number about them comes from the API.
 */
export default function Goals({ onChanged, collapsible }) {
  const { t, i18n } = useTranslation();
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const lang = i18n.language;
  // null until the first answer: an empty list would flash "no goals" before the real ones arrive.
  const [goals, setGoals] = useState(null);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(EMPTY);
  // The goal being edited, as it was: the form saves over it and "undo" puts it back.
  const [editing, setEditing] = useState(null);
  // "Does it fit?": the same SAVINGS scenario as the simulator, run before the goal is created.
  const [fit, setFit] = useState(null);
  const fitRequest = useRef(0);
  const nameField = useRef(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setGoals(await HttpService.getWithAuth('/future/goals'));
      setError(null);
    } catch (failure) {
      setError(errorKey(failure));
    }
  }, []);

  // CDI and IPCA stored daily from Banco Central (ADR 0010). Without them the goals simply show no projection.
  const [indicators, setIndicators] = useState(null);
  useEffect(() => {
    load();
    HttpService.getWithAuth('/market/overview')
      .then((market) => {
        const find = (code) => market?.indicators?.find((item) => item.code === code);
        const cdi = find('CDI');
        const ipca = find('IPCA_12M');
        setIndicators(cdi && ipca ? { cdi, ipca } : null);
      })
      .catch(() => setIndicators(null));
  }, [load]);

  // An answer about R$ 300 must not stay next to R$ 3.000.
  useEffect(() => {
    fitRequest.current += 1;
    setFit(null);
  }, [form.amount, form.day]);

  const cents = parseAmount(form.amount);
  const day = Number(form.day);
  const dayValid = Number.isInteger(day) && day >= 1 && day <= 31;
  const amountInvalid = form.amount !== '' && (cents === null || cents <= 0 || cents > MAX_MONTHLY_CENTS);
  const target = optional(form.target, 1);
  const saved = optional(form.saved, 0);
  const dateNeedsTarget = form.date !== '' && target.value === null;
  const valid =
    form.name.trim() &&
    cents !== null &&
    !amountInvalid &&
    dayValid &&
    !target.invalid &&
    !saved.invalid &&
    !dateNeedsTarget;

  const run = async (action, message, snackbarAction) => {
    setBusy(true);
    try {
      await action();
      enqueueSnackbar(t(message), { variant: 'success', action: snackbarAction });
      await load();
      onChanged();
    } catch (failure) {
      enqueueSnackbar(t(errorKey(failure)), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const undo = (action) => (key) =>
    (
      <Button
        color="inherit"
        size="small"
        onClick={(event) => {
          // closeSnackbar only starts the exit animation: a double click would run it twice.
          if (event.currentTarget.disabled) return;
          event.currentTarget.disabled = true;
          closeSnackbar(key);
          run(action, 'future.goals.restored');
        }}
      >
        {t('future.answers.undo')}
      </Button>
    );

  const stopEditing = () => {
    setEditing(null);
    setForm(EMPTY);
  };

  const edit = (goal) => {
    setEditing(goal);
    setForm(formOf(goal));
    nameField.current?.focus();
  };

  // One tap removes; the snackbar offers the way back instead of a confirmation dialog on every delete.
  const remove = (goal) => {
    if (editing?.id === goal.id) stopEditing();
    run(
      () => HttpService.deleteWithAuth(`/future/goals/${goal.id}`),
      'future.goals.removed',
      undo(() => HttpService.postWithAuth('/future/goals', bodyOf(goal)))
    );
  };

  const checkFit = async () => {
    fitRequest.current += 1;
    const mine = fitRequest.current;
    setFit({ loading: true });
    try {
      const result = await HttpService.postWithAuth('/future/scenarios', {
        type: 'SAVINGS',
        amount: cents / 100,
        dayOfMonth: day,
        label: form.name.trim() || undefined,
      });
      if (mine === fitRequest.current) setFit({ result });
    } catch (failure) {
      if (mine === fitRequest.current) setFit({ error: errorKey(failure) });
    }
  };

  const submit = (event) => {
    event.preventDefault();
    if (!valid || busy) return;
    const body = {
      name: form.name.trim(),
      monthlyAmount: cents / 100,
      dayOfMonth: day,
      targetAmount: target.value,
      targetDate: form.date || null,
      savedAmount: saved.value,
    };
    const previous = editing;
    run(
      async () => {
        if (previous) await HttpService.putWithAuth(`/future/goals/${previous.id}`, body);
        else await HttpService.postWithAuth('/future/goals', body);
        stopEditing();
      },
      previous ? 'future.goals.updated' : 'future.goals.saved',
      previous ? undo(() => HttpService.putWithAuth(`/future/goals/${previous.id}`, bodyOf(previous))) : undefined
    );
  };

  const field = (key, props) => (
    <TextField
      size="small"
      label={t(`future.goals.${key === 'saved' ? 'savedField' : key}`)}
      value={form[key]}
      onChange={(event) => setForm({ ...form, [key]: event.target.value })}
      {...props}
    />
  );
  const line = { gap: 1.5, flexDirection: { xs: 'column', sm: 'row' }, alignItems: { sm: 'flex-start' } };

  return (
    <SectionCard title={t('future.goals.title')} collapsible={collapsible}>
      <Typography variant="body2" color="text.secondary" sx={{ px: 3, pb: 2 }}>
        {t('future.goals.help')}
      </Typography>
      {error && (
        <Alert
          severity="error"
          sx={{ mx: 3, mb: 2 }}
          action={
            <Button color="inherit" onClick={load}>
              {t('app.retry')}
            </Button>
          }
        >
          {t(error)}
        </Alert>
      )}
      {!error && !goals && (
        <Box role="status" aria-label={t('common.loading')} sx={{ px: 3, pb: 2 }}>
          <Skeleton width="60%" />
          <Skeleton width="40%" />
        </Box>
      )}
      {!error && goals?.length === 0 && (
        <Typography variant="body2" sx={{ px: 3, pb: 2 }}>
          {t('future.goals.empty')}
        </Typography>
      )}
      {goals?.map((goal) => (
        <Box key={goal.id} sx={{ px: 3, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ minHeight: 56 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" noWrap>
                {goal.name}
              </Typography>
              <Typography variant="caption" color="text.secondary" component="p">
                {t('future.goals.perMonth', { amount: money(goal.monthlyAmount, lang), day: goal.dayOfMonth })}
                {goal.nextDate ? ` · ${t('future.goals.next', { date: dayLabel(goal.nextDate, lang) })}` : ''}
              </Typography>
              {!goal.progress && goal.savedAmount != null && (
                <Typography variant="caption" color="text.secondary" component="p">
                  {t('future.goals.savedOnly', { amount: money(goal.savedAmount, lang) })}
                </Typography>
              )}
              {indicators && (
                <Typography variant="caption" color="text.secondary" component="p">
                  {(() => {
                    const year = savingsInAYear(goal.monthlyAmount, indicators.cdi.value, indicators.ipca.value);
                    return t('future.goals.inAYear', {
                      saved: money(year.saved, lang),
                      withCdi: money(year.withCdi, lang),
                      real: money(year.inTodaysMoney, lang),
                      cdi: percent(indicators.cdi.value, lang),
                      ipca: percent(indicators.ipca.value, lang),
                      date: dayLabel(indicators.cdi.referenceDate, lang),
                    });
                  })()}
                </Typography>
              )}
            </Box>
            <Tooltip title={t('future.goals.edit')}>
              <span>
                <IconButton
                  aria-label={t('future.goals.editLabel', { name: goal.name })}
                  disabled={busy}
                  onClick={() => edit(goal)}
                >
                  <WalletIcon name="edit" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={t('future.goals.remove')}>
              <span>
                <IconButton
                  aria-label={t('future.goals.removeLabel', { name: goal.name })}
                  disabled={busy}
                  onClick={() => remove(goal)}
                >
                  <WalletIcon name="trash" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
          {goal.progress && <Progress goal={goal} />}
        </Box>
      ))}
      <Stack
        component="form"
        onSubmit={submit}
        sx={{ px: 3, py: 2.5, gap: 1.5, borderTop: '1px solid', borderColor: 'divider' }}
      >
        {editing && <Typography variant="subtitle2">{t('future.goals.editing', { name: editing.name })}</Typography>}
        <Box sx={{ display: 'flex', ...line }}>
          {field('name', {
            placeholder: t('future.goals.namePlaceholder'),
            inputRef: nameField,
            inputProps: { maxLength: 60 },
            sx: { flex: 2 },
          })}
          {field('amount', {
            inputProps: { inputMode: 'decimal' },
            error: amountInvalid,
            helperText: amountInvalid ? t('future.goals.amountInvalid') : undefined,
            sx: { flex: 1 },
          })}
          <TextField
            size="small"
            label={t('future.goals.day')}
            value={form.day}
            onChange={(event) => setForm({ ...form, day: event.target.value.replace(/\D/g, '').slice(0, 2) })}
            inputProps={{ inputMode: 'numeric' }}
            error={form.day !== '' && !dayValid}
            sx={{ width: { sm: 110 } }}
          />
        </Box>
        <Typography variant="caption" color="text.secondary">
          {t('future.goals.optional')}
        </Typography>
        <Box sx={{ display: 'flex', ...line }}>
          {field('target', {
            inputProps: { inputMode: 'decimal' },
            error: target.invalid || dateNeedsTarget,
            helperText:
              (target.invalid && t('future.goals.targetInvalid')) ||
              (dateNeedsTarget && t('future.goals.targetNeeded')) ||
              undefined,
            sx: { flex: 1 },
          })}
          {field('date', { type: 'date', InputLabelProps: { shrink: true }, sx: { flex: 1 } })}
          {field('saved', {
            inputProps: { inputMode: 'decimal' },
            error: saved.invalid,
            helperText: saved.invalid ? t('future.goals.targetInvalid') : t('future.goals.savedHelp'),
            sx: { flex: 1 },
          })}
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', ...line }}>
          {editing ? (
            // The SAVINGS check adds a new goal on top of the saved ones; for an edit it would count this one twice.
            <Button onClick={stopEditing}>{t('future.goals.cancel')}</Button>
          ) : (
            <Button
              variant="outlined"
              onClick={checkFit}
              disabled={cents === null || amountInvalid || !dayValid || fit?.loading}
            >
              {t('future.goals.checkFit')}
            </Button>
          )}
          <Button type="submit" variant="contained" disabled={!valid || busy}>
            {t(editing ? 'future.goals.update' : 'future.goals.add')}
          </Button>
        </Box>
      </Stack>
      <Box aria-live="polite" sx={{ px: 3, pb: fit && !fit.loading ? 2.5 : 0 }}>
        {fit?.error && <Alert severity="error">{t(fit.error)}</Alert>}
        {fit?.result && <FitAnswer result={fit.result} />}
      </Box>
    </SectionCard>
  );
}
Goals.propTypes = { onChanged: PropTypes.func.isRequired, collapsible: PropTypes.bool };

/** Progress toward the target. Every number is the API's; the sentence only reads it. */
function Progress({ goal }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { progress } = goal;
  const { fit, status } = progress;
  const date = (value) => dayLabel(value, lang, FULL_DATE);
  const values = {
    date: date(goal.targetDate),
    projected: date(progress.projectedDate),
    required: money(progress.requiredMonthly, lang),
  };
  const noForecast = !progress.projectedDate && (status === 'NO_DATE' || status === 'LATE');
  const warns = status === 'LATE' || status === 'DATE_TOO_SOON' || fit?.fits === false;
  return (
    <Box sx={{ pb: 0.5 }}>
      <LinearProgress
        variant="determinate"
        value={Number(progress.savedPercent)}
        aria-label={t('future.goals.progressLabel', { name: goal.name })}
        sx={{ mb: 1 }}
      />
      <Typography variant="body2">
        {t('future.goals.progress', {
          saved: money(goal.savedAmount ?? 0, lang),
          target: money(goal.targetAmount, lang),
          percent: percent(progress.savedPercent, lang),
        })}
        {status !== 'REACHED' && ` · ${t('future.goals.remaining', { amount: money(progress.remaining, lang) })}`}
      </Typography>
      <Typography variant="caption" color="text.secondary" component="p">
        {t(goal.savedOrigin ? 'future.goals.savedOrigin' : 'future.goals.savedMissing')}
      </Typography>
      <Alert severity={warns ? 'warning' : status === 'NO_DATE' ? 'info' : 'success'} sx={{ mt: 1 }}>
        <span>{t(`future.goals.status.${noForecast ? `${status}_FAR` : status}`, values)}</span>
        {fit && (status === 'LATE' || !fit.fits) && (
          <Box component="span" sx={{ display: 'block', mt: 0.5 }}>
            {fit.fits
              ? t('future.goals.requiredFits', {
                  ...values,
                  days: fit.horizonDays,
                  amount: money(fit.scenario.minBalance90, lang),
                })
              : t('future.goals.requiredDoesNotFit', {
                  ...values,
                  days: fit.horizonDays,
                  negative: fit.scenario.negativeDays,
                  amount: money(fit.scenario.minBalance90, lang),
                })}
            {!fit.incomeConfirmed && ` ${t('future.goals.noIncome')}`}
          </Box>
        )}
      </Alert>
    </Box>
  );
}
Progress.propTypes = { goal: PropTypes.object.isRequired };

/** Fits = no new negative day in 90 days. The numbers come from the engine, the sentence only reads them. */
function FitAnswer({ result }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const before = result.baseline;
  const after = result.scenario;
  const worse = after.negativeDays > before.negativeDays;
  return (
    <Alert severity={worse ? 'warning' : 'success'}>
      {worse
        ? t('future.goals.fitNo', {
            count: after.negativeDays - before.negativeDays,
            date: dayLabel(after.firstNegativeDate, lang),
            amount: money(after.minBalance90, lang),
          })
        : t(before.negativeDays > 0 ? 'future.goals.fitSameHole' : 'future.goals.fitYes', {
            amount: money(after.minBalance90, lang),
            date: dayLabel(after.minDate, lang),
          })}
    </Alert>
  );
}
FitAnswer.propTypes = { result: PropTypes.object.isRequired };
