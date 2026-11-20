import { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Alert,
  Box,
  Button,
  MenuItem,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import HttpService from '../../services/HttpService';
import ProjectionChart from '../../components/projection-chart';
import { SectionCard } from '../../components/wallet-ui';
import { dayLabel, errorKey, money, parseAmount } from '../../utils/wallet';

const TYPES = ['PURCHASE', 'SAVINGS', 'INCOME_LOSS'];

/** Plain-language summary built from the engine's numbers. No AI: the same numbers, the same sentence. */
function summaryLines(result, request, t, language) {
  const lines = [];
  const { scenario } = result;
  if (scenario.negativeDays > 0) {
    lines.push(
      t('future.summaryNegative', {
        count: scenario.negativeDays,
        date: dayLabel(scenario.firstNegativeDate, language),
        amount: money(scenario.minBalance90, language),
      })
    );
  } else {
    lines.push(
      t('future.summaryPositive', {
        amount: money(scenario.minBalance90, language),
        date: dayLabel(scenario.minDate, language),
      })
    );
  }
  if (result.installments > 1) {
    const values = {
      amount: money(result.newMonthlyCommitment, language),
      count: result.installments,
      card: result.cardName,
    };
    lines.push(t(result.cardName ? 'future.summaryInstallments' : 'future.summaryInstallmentsNoCard', values));
  }
  if (request.type === 'SAVINGS')
    lines.push(t('future.summarySavings', { amount: money(result.newMonthlyCommitment, language) }));
  return lines;
}

export default function Simulator({ incomes, hasCard, collapsible, defaultOpen }) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const [type, setType] = useState('PURCHASE');
  const [form, setForm] = useState({
    label: '',
    amount: '',
    method: hasCard ? 'CARD' : 'CASH',
    installments: 1,
    dayOfMonth: 6,
    incomeKey: '',
    months: 2,
  });
  const [state, setState] = useState({ loading: false, error: null, result: null, request: null });
  const latest = useRef(0);
  // A result next to a changed form would answer a question nobody asked any more.
  const set = (field) => (event) => {
    latest.current += 1;
    setForm({ ...form, [field]: event.target.value });
    setState((previous) => ({ ...previous, loading: false, result: null }));
  };

  const amountCents = parseAmount(form.amount);
  const needsAmount = type !== 'INCOME_LOSS';
  const blocked = (needsAmount && !amountCents) || (type === 'INCOME_LOSS' && !incomes.length);

  const simulate = async (event) => {
    event.preventDefault();
    if (blocked) return;
    const request = { type };
    if (type === 'PURCHASE') {
      Object.assign(request, {
        amount: amountCents / 100,
        installments: Number(form.installments),
        method: form.method,
        label: form.label.trim() || undefined,
      });
    }
    if (type === 'SAVINGS') Object.assign(request, { amount: amountCents / 100, dayOfMonth: Number(form.dayOfMonth) });
    if (type === 'INCOME_LOSS')
      Object.assign(request, { months: Number(form.months), incomeKey: form.incomeKey || undefined });
    latest.current += 1;
    const mine = latest.current;
    setState({ loading: true, error: null, result: null, request });
    try {
      const result = await HttpService.postWithAuth('/future/scenarios', request);
      // The form changed (or another simulation started) while this one was in flight: drop it.
      if (mine === latest.current) setState({ loading: false, error: null, result, request });
    } catch (failure) {
      if (mine === latest.current) setState({ loading: false, error: errorKey(failure), result: null, request });
    }
  };

  const { result } = state;
  const rows = result && [
    ['min30', result.baseline.minBalance30, result.scenario.minBalance30, true],
    ['min90', result.baseline.minBalance90, result.scenario.minBalance90, true],
    ['negativeDays', result.baseline.negativeDays, result.scenario.negativeDays, false],
    // Only here does zero mean "nothing": R$ 0,00 as a lowest balance is a real number.
    ['monthlyCommitment', null, Number(result.newMonthlyCommitment) || null, true],
  ];
  const cell = (value, isMoney) => {
    if (!isMoney) return value;
    return value == null ? t('future.noneValue') : money(value, i18n.language);
  };

  return (
    <SectionCard title={t('future.simulatorTitle')} collapsible={collapsible} defaultOpen={defaultOpen}>
      <Typography variant="body2" color="text.secondary" sx={{ px: 3 }}>
        {t('future.simulatorHelp')}
      </Typography>
      <Tabs
        value={type}
        onChange={(_, value) => {
          // A purchase answer arriving after the switch must not show up under "save every month".
          latest.current += 1;
          setType(value);
          setState({ loading: false, error: null, result: null, request: null });
        }}
        variant="scrollable"
        sx={{ px: 2, mt: 1, borderBottom: '1px solid', borderColor: 'divider' }}
      >
        {TYPES.map((item) => (
          <Tab key={item} value={item} label={t(`future.scenarioTypes.${item}`)} />
        ))}
      </Tabs>
      <Box component="form" onSubmit={simulate} noValidate sx={{ p: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          {type === 'PURCHASE' && (
            <TextField
              label={t('future.purchaseLabel')}
              placeholder={t('future.purchasePlaceholder')}
              value={form.label}
              onChange={set('label')}
              inputProps={{ maxLength: 60 }}
              fullWidth
            />
          )}
          {needsAmount && (
            <TextField
              label={t(type === 'SAVINGS' ? 'future.monthlyAmount' : 'future.amount')}
              value={form.amount}
              onChange={set('amount')}
              inputProps={{ inputMode: 'decimal' }}
              InputProps={{ startAdornment: <Typography sx={{ mr: 1 }}>R$</Typography> }}
              error={Boolean(form.amount) && !amountCents}
              helperText={form.amount && !amountCents ? t('app.errors.INVALID_AMOUNT') : t('app.amountHelp')}
              required
              fullWidth
            />
          )}
          {type === 'PURCHASE' && (
            <>
              <TextField select label={t('future.method')} value={form.method} onChange={set('method')} fullWidth>
                {['CASH', 'CARD']
                  .filter((item) => item === 'CASH' || hasCard)
                  .map((item) => (
                    <MenuItem key={item} value={item}>
                      {t(`future.methods.${item}`)}
                    </MenuItem>
                  ))}
              </TextField>
              <TextField
                select
                label={t('future.installments')}
                value={form.installments}
                onChange={set('installments')}
                sx={{ minWidth: 140 }}
              >
                {[1, 2, 3, 4, 5, 6, 8, 10, 12, 18, 24].map((count) => (
                  <MenuItem key={count} value={count}>
                    {count === 1 ? t('future.installmentsCash') : t('future.installmentsOption', { count })}
                  </MenuItem>
                ))}
              </TextField>
            </>
          )}
          {type === 'SAVINGS' && (
            <TextField
              select
              label={t('future.dayOfMonth')}
              value={form.dayOfMonth}
              onChange={set('dayOfMonth')}
              sx={{ minWidth: 160 }}
            >
              {Array.from({ length: 28 }, (_, index) => index + 1).map((day) => (
                <MenuItem key={day} value={day}>
                  {day}
                </MenuItem>
              ))}
            </TextField>
          )}
          {type === 'INCOME_LOSS' && (
            <>
              <TextField
                select
                label={t('future.income')}
                value={form.incomeKey}
                onChange={set('incomeKey')}
                fullWidth
                SelectProps={{ displayEmpty: true }}
                InputLabelProps={{ shrink: true }}
              >
                <MenuItem value="">{t('future.allIncomes')}</MenuItem>
                {incomes.map((income) => (
                  <MenuItem key={income.key} value={income.key}>
                    {income.counterparty} · {money(income.typicalAmount, i18n.language)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={t('future.months')}
                value={form.months}
                onChange={set('months')}
                sx={{ minWidth: 180 }}
              >
                {[1, 2, 3, 6, 12].map((count) => (
                  <MenuItem key={count} value={count}>
                    {t('future.monthsOption', { count })}
                  </MenuItem>
                ))}
              </TextField>
            </>
          )}
        </Stack>
        {type === 'INCOME_LOSS' && !incomes.length && (
          <Alert severity="info" sx={{ mt: 2 }}>
            {t('future.noIncomeToLose')}
          </Alert>
        )}
        <Button type="submit" variant="contained" size="large" disabled={blocked || state.loading} sx={{ mt: 2 }}>
          {state.loading ? t('future.simulating') : t('future.simulate')}
        </Button>
      </Box>

      {state.error && (
        <Alert severity="error" sx={{ mx: 3, mb: 3 }}>
          {t(state.error)}
        </Alert>
      )}

      {/* Always mounted, so screen readers announce the first answer too. */}
      <Box aria-live="polite">
        {result && (
          <Box sx={{ px: 3, pb: 3 }}>
            <Typography variant="h6" component="h3">
              {t('future.resultTitle')}
            </Typography>
            <Alert severity={result.scenario.negativeDays > 0 ? 'warning' : 'success'} sx={{ mt: 2 }}>
              {summaryLines(result, state.request, t, i18n.language).map((line) => (
                <Typography key={line} variant="body2" sx={{ '& + &': { mt: 0.5 } }}>
                  {line}
                </Typography>
              ))}
            </Alert>
            <TableContainer sx={{ mt: 2, overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell />
                    <TableCell align="right">{t('future.compareToday')}</TableCell>
                    <TableCell align="right">{t('future.compareScenario')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map(([key, before, after, isMoney]) => (
                    <TableRow key={key}>
                      <TableCell component="th" scope="row">
                        {t(`future.${key}`)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {cell(before, isMoney)}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          fontVariantNumeric: 'tabular-nums',
                          fontWeight: 600,
                          color: isMoney && Number(after) < 0 ? 'error.main' : 'text.primary',
                        }}
                      >
                        {cell(after, isMoney)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <Box sx={{ mt: 3 }}>
              <ProjectionChart
                animate={false}
                ariaLabel={t('future.chartLabel', {
                  amount: money(result.scenario.minBalance90, i18n.language),
                  date: dayLabel(result.scenario.minDate, i18n.language),
                  end: money(result.scenario.endBalance, i18n.language),
                })}
                series={[
                  {
                    key: 'baseline',
                    label: t('future.chartBaseline'),
                    color: theme.palette.chart.projection,
                    dashed: true,
                    days: result.baselineProjection.days.map((day) => ({
                      date: day.date,
                      balance: Number(day.balance),
                    })),
                  },
                  {
                    key: 'scenario',
                    label: t('future.chartScenario'),
                    color: theme.palette.chart.scenario,
                    dotted: true,
                    days: result.scenarioProjection.days.map((day) => ({
                      date: day.date,
                      balance: Number(day.balance),
                    })),
                  },
                ]}
                lowest={{ date: result.scenario.minDate, balance: Number(result.scenario.minBalance90) }}
              />
            </Box>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 2 }}>
              {t('future.disclaimer')}
            </Typography>
          </Box>
        )}
      </Box>
    </SectionCard>
  );
}
Simulator.propTypes = {
  incomes: PropTypes.array.isRequired,
  hasCard: PropTypes.bool,
  collapsible: PropTypes.bool,
  defaultOpen: PropTypes.bool,
};
