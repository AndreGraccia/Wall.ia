import { useState } from 'react';
import PropTypes from 'prop-types';
import { Box, Button, Card, MenuItem, Stack, TextField } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { parseAmount } from '../../utils/wallet';

export const CLASSES = ['SAVINGS', 'FIXED_INCOME', 'FUND', 'STOCK', 'PENSION', 'CRYPTO', 'REAL_ESTATE', 'OTHER'];

const text = (value) => (value === null || value === undefined ? '' : String(value));

/**
 * What the person says about one investment. Creating asks for the value and its date too; editing does not,
 * because the value has its own dated history.
 */
export default function InvestmentForm({ investment, today, busy, onSubmit, onCancel }) {
  const { t } = useTranslation();
  const creating = !investment;
  const [form, setForm] = useState({
    institution: text(investment?.institution),
    name: text(investment?.name),
    assetClass: investment?.assetClass || '',
    value: '',
    valueDate: today,
    investedAmount: text(investment?.investedAmount),
    maturityDate: text(investment?.maturityDate),
    note: text(investment?.note),
  });
  const [tried, setTried] = useState(false);

  const value = parseAmount(form.value);
  const invested = form.investedAmount === '' ? undefined : parseAmount(form.investedAmount);
  const errors = {
    institution: !form.institution.trim() && 'wealth.form.required',
    name: !form.name.trim() && 'wealth.form.required',
    assetClass: !form.assetClass && 'wealth.form.required',
    value: creating && value === null && 'wealth.form.amountInvalid',
    valueDate: creating && (!form.valueDate || form.valueDate > today) && 'wealth.form.dateInvalid',
    investedAmount: invested === null && 'wealth.form.amountInvalid',
  };

  const submit = (event) => {
    event.preventDefault();
    setTried(true);
    if (busy || Object.values(errors).some(Boolean)) return;
    const body = {
      institution: form.institution.trim(),
      name: form.name.trim(),
      assetClass: form.assetClass,
      investedAmount: invested === undefined ? null : invested / 100,
      maturityDate: form.maturityDate || null,
      note: form.note.trim() || null,
    };
    onSubmit(creating ? { ...body, value: value / 100, valueDate: form.valueDate } : body);
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

  return (
    <Card component="form" onSubmit={submit} noValidate aria-label={t('wealth.form.label')} sx={{ p: 2 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
        {field('institution', 'wealth.form.institution', { inputProps: { maxLength: 60 } })}
        {field('name', 'wealth.form.name', { inputProps: { maxLength: 60 } })}
        {field('assetClass', 'wealth.form.assetClass', {
          select: true,
          children: CLASSES.map((item) => (
            <MenuItem key={item} value={item}>
              {t(`wealth.classes.${item}`)}
            </MenuItem>
          )),
        })}
        {creating && field('value', 'wealth.form.value', { inputProps: { inputMode: 'decimal' } })}
        {creating &&
          field('valueDate', 'wealth.form.valueDate', {
            type: 'date',
            InputLabelProps: { shrink: true },
            inputProps: { max: today },
          })}
        {field('investedAmount', 'wealth.form.invested', { inputProps: { inputMode: 'decimal' } })}
        {field('maturityDate', 'wealth.form.maturity', { type: 'date', InputLabelProps: { shrink: true } })}
        <Box sx={{ gridColumn: '1 / -1', display: 'grid' }}>
          {field('note', 'wealth.form.note', {
            multiline: true,
            minRows: 2,
            inputProps: { maxLength: 500 },
            helperText: t('wealth.form.noteHelp'),
          })}
        </Box>
      </Box>
      <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
        <Button type="submit" variant="contained" disabled={busy}>
          {t(creating ? 'wealth.form.add' : 'wealth.form.save')}
        </Button>
        {onCancel && <Button onClick={onCancel}>{t('common.cancel')}</Button>}
      </Stack>
    </Card>
  );
}
InvestmentForm.propTypes = {
  investment: PropTypes.object,
  today: PropTypes.string.isRequired,
  busy: PropTypes.bool,
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func,
};
