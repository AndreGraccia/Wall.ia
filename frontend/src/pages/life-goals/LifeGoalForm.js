import { useState } from 'react';
import PropTypes from 'prop-types';
import { Box, Button, Card, IconButton, MenuItem, Stack, TextField } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { WalletIcon } from '../../components/wallet-ui';
import { parseAmount } from '../../utils/wallet';

const MAX_STEPS = 20;

/** The whole life goal in the person's words; what is left out here is erased on save. */
export default function LifeGoalForm({ lifeGoal, goals, busy, onSubmit, onCancel }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    title: lifeGoal?.title || '',
    currentSituation: lifeGoal?.currentSituation || '',
    desiredSituation: lifeGoal?.desiredSituation || '',
    targetDate: lifeGoal?.targetDate || '',
    estimatedCost: lifeGoal?.estimatedCost ?? '',
    goalId: lifeGoal?.goal?.id || '',
  });
  // `key` only identifies the field on screen; `id` is the server's.
  const [steps, setSteps] = useState(() => (lifeGoal?.steps || []).map((step) => ({ ...step, key: step.id })));
  const [nextKey, setNextKey] = useState(-1);
  const [tried, setTried] = useState(false);

  const cost = form.estimatedCost === '' ? undefined : parseAmount(form.estimatedCost);
  const errors = {
    title: !form.title.trim() && 'lifeGoals.form.required',
    currentSituation: !form.currentSituation.trim() && 'lifeGoals.form.required',
    desiredSituation: !form.desiredSituation.trim() && 'lifeGoals.form.required',
    estimatedCost: cost === null && 'lifeGoals.form.amountInvalid',
  };
  // The linked goal stays choosable even if the list of goals did not load.
  const options =
    lifeGoal?.goal && !goals.some((goal) => goal.id === lifeGoal.goal.id) ? [lifeGoal.goal, ...goals] : goals;

  const submit = (event) => {
    event.preventDefault();
    setTried(true);
    if (busy || Object.values(errors).some(Boolean)) return;
    onSubmit({
      title: form.title.trim(),
      currentSituation: form.currentSituation.trim(),
      desiredSituation: form.desiredSituation.trim(),
      targetDate: form.targetDate || null,
      estimatedCost: cost === undefined ? null : cost / 100,
      goalId: form.goalId || null,
      // An empty line is a step not written, not an error.
      steps: steps
        .filter((step) => step.description.trim())
        .map((step) => ({ id: step.id ?? null, description: step.description.trim(), done: Boolean(step.done) })),
    });
  };

  const field = (key, label, extra = {}) => {
    const error = tried && errors[key];
    return (
      <TextField
        size="small"
        name={key}
        label={t(label)}
        value={form[key]}
        onChange={(event) => setForm({ ...form, [key]: event.target.value })}
        error={Boolean(error)}
        {...extra}
        helperText={error ? t(error) : extra.helperText}
      />
    );
  };
  const long = { multiline: true, minRows: 3, inputProps: { maxLength: 1000 } };

  return (
    <Card component="form" onSubmit={submit} noValidate aria-label={t('lifeGoals.form.label')} sx={{ p: 2 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }}>
        <Box sx={{ gridColumn: '1 / -1', display: 'grid' }}>
          {field('title', 'lifeGoals.form.title', { inputProps: { maxLength: 80 } })}
        </Box>
        {field('currentSituation', 'lifeGoals.current', long)}
        {field('desiredSituation', 'lifeGoals.desired', long)}
        {field('targetDate', 'lifeGoals.form.targetDate', { type: 'date', InputLabelProps: { shrink: true } })}
        {field('estimatedCost', 'lifeGoals.form.cost', { inputProps: { inputMode: 'decimal' } })}
        <Box sx={{ gridColumn: '1 / -1', display: 'grid' }}>
          {field('goalId', 'lifeGoals.form.goal', {
            select: true,
            helperText: t('lifeGoals.form.goalHelp'),
            children: [
              <MenuItem key="none" value="">
                {t('lifeGoals.form.noGoal')}
              </MenuItem>,
              ...options.map((goal) => (
                <MenuItem key={goal.id} value={goal.id}>
                  {goal.name}
                </MenuItem>
              )),
            ],
          })}
        </Box>
      </Box>
      <Stack spacing={1} sx={{ mt: 2 }} alignItems="flex-start">
        {steps.map((step, index) => (
          <Stack key={step.key} direction="row" spacing={1} alignItems="center" sx={{ alignSelf: 'stretch' }}>
            <TextField
              size="small"
              fullWidth
              name="step"
              label={t('lifeGoals.form.step', { number: index + 1 })}
              value={step.description}
              onChange={(event) =>
                setSteps(
                  steps.map((item) => (item.key === step.key ? { ...item, description: event.target.value } : item))
                )
              }
              inputProps={{ maxLength: 140 }}
            />
            <IconButton
              aria-label={t('lifeGoals.form.removeStep', { number: index + 1 })}
              onClick={() => setSteps(steps.filter((item) => item.key !== step.key))}
              sx={{ color: 'text.secondary' }}
            >
              <WalletIcon name="trash" sx={{ fontSize: 20 }} />
            </IconButton>
          </Stack>
        ))}
        {steps.length < MAX_STEPS && (
          <Button
            onClick={() => {
              setSteps([...steps, { key: nextKey, description: '', done: false }]);
              setNextKey(nextKey - 1);
            }}
          >
            {t('lifeGoals.form.addStep')}
          </Button>
        )}
      </Stack>
      <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
        <Button type="submit" variant="contained" disabled={busy}>
          {t(lifeGoal ? 'lifeGoals.form.save' : 'lifeGoals.form.add')}
        </Button>
        {onCancel && <Button onClick={onCancel}>{t('common.cancel')}</Button>}
      </Stack>
    </Card>
  );
}
LifeGoalForm.propTypes = {
  lifeGoal: PropTypes.object,
  goals: PropTypes.array.isRequired,
  busy: PropTypes.bool,
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func,
};
