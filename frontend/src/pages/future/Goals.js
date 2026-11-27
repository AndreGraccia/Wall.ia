import { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Alert, Box, Button, IconButton, Skeleton, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import HttpService from '../../services/HttpService';
import { SectionCard, WalletIcon } from '../../components/wallet-ui';
import { dayLabel, errorKey, money, parseAmount, percent, savingsInAYear } from '../../utils/wallet';

const EMPTY = { name: '', amount: '', day: '' };

/**
 * Monthly goals the user sets. Each one leaves the spendable balance on its day, so the daily limit
 * already answers "how much can I spend without giving up the goal?".
 */
export default function Goals({ onChanged, collapsible }) {
  const { t, i18n } = useTranslation();
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const lang = i18n.language;
  // null until the first answer: an empty list would flash "no goals" before the real ones arrive.
  const [goals, setGoals] = useState(null);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(EMPTY);
  // "Does it fit?": the same SAVINGS scenario as the simulator, run before the goal is created.
  const [fit, setFit] = useState(null);
  const fitRequest = useRef(0);
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
  // Same ceiling as the API (R$ 1.000.000,00), so the user sees why instead of a generic 422.
  const amountInvalid = form.amount !== '' && (cents === null || cents <= 0 || cents > 100000000);
  const valid = form.name.trim() && cents !== null && !amountInvalid && dayValid;

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

  // One tap removes; the snackbar offers the way back instead of a confirmation dialog on every delete.
  const remove = (goal) =>
    run(
      () => HttpService.deleteWithAuth(`/future/goals/${goal.id}`),
      'future.goals.removed',
      (key) => (
        <Button
          color="inherit"
          size="small"
          onClick={(event) => {
            // closeSnackbar only starts the exit animation: a double click would restore it twice.
            if (event.currentTarget.disabled) return;
            event.currentTarget.disabled = true;
            closeSnackbar(key);
            run(
              () =>
                HttpService.postWithAuth('/future/goals', {
                  name: goal.name,
                  monthlyAmount: goal.monthlyAmount,
                  dayOfMonth: goal.dayOfMonth,
                }),
              'future.goals.restored'
            );
          }}
        >
          {t('future.answers.undo')}
        </Button>
      )
    );

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

  const add = (event) => {
    event.preventDefault();
    if (!valid || busy) return;
    run(async () => {
      await HttpService.postWithAuth('/future/goals', {
        name: form.name.trim(),
        monthlyAmount: cents / 100,
        dayOfMonth: day,
      });
      setForm(EMPTY);
    }, 'future.goals.saved');
  };

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
        <Stack
          key={goal.id}
          direction="row"
          alignItems="center"
          spacing={2}
          sx={{ px: 3, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" noWrap>
              {goal.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" component="p">
              {t('future.goals.perMonth', { amount: money(goal.monthlyAmount, lang), day: goal.dayOfMonth })}
              {goal.nextDate ? ` · ${t('future.goals.next', { date: dayLabel(goal.nextDate, lang) })}` : ''}
            </Typography>
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
      ))}
      <Stack
        component="form"
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ sm: 'flex-start' }}
        onSubmit={add}
        sx={{ px: 3, py: 2.5, gap: 1.5, borderTop: '1px solid', borderColor: 'divider' }}
      >
        <TextField
          size="small"
          label={t('future.goals.name')}
          placeholder={t('future.goals.namePlaceholder')}
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          inputProps={{ maxLength: 60 }}
          sx={{ flex: 2 }}
        />
        <TextField
          size="small"
          label={t('future.goals.amount')}
          value={form.amount}
          onChange={(event) => setForm({ ...form, amount: event.target.value })}
          inputProps={{ inputMode: 'decimal' }}
          error={amountInvalid}
          helperText={amountInvalid ? t('future.goals.amountInvalid') : undefined}
          sx={{ flex: 1 }}
        />
        <TextField
          size="small"
          label={t('future.goals.day')}
          value={form.day}
          onChange={(event) => setForm({ ...form, day: event.target.value.replace(/\D/g, '').slice(0, 2) })}
          inputProps={{ inputMode: 'numeric' }}
          error={form.day !== '' && !dayValid}
          sx={{ width: { sm: 110 } }}
        />
        <Button
          variant="outlined"
          onClick={checkFit}
          disabled={cents === null || amountInvalid || !dayValid || fit?.loading}
          sx={{ flexShrink: 0 }}
        >
          {t('future.goals.checkFit')}
        </Button>
        <Button type="submit" variant="contained" disabled={!valid || busy} sx={{ flexShrink: 0 }}>
          {t('future.goals.add')}
        </Button>
      </Stack>
      <Box aria-live="polite" sx={{ px: 3, pb: fit && !fit.loading ? 2.5 : 0 }}>
        {fit?.error && <Alert severity="error">{t(fit.error)}</Alert>}
        {fit?.result && <FitAnswer result={fit.result} />}
      </Box>
    </SectionCard>
  );
}
Goals.propTypes = { onChanged: PropTypes.func.isRequired, collapsible: PropTypes.bool };

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
