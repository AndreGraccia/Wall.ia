import { useState } from 'react';
import PropTypes from 'prop-types';
import { Alert, Box, Button, Card, Chip, Stack, TextField, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import HttpService from '../../services/HttpService';
import { CertaintyChip } from '../../components/future-ui';
import { errorKey, money, parseAmount } from '../../utils/wallet';

/** CET in % a month as the bank app shows it ("8,5"): up to 4 decimals, above 0 and at most 30 (same as the API). */
export function parseMonthlyCet(value) {
  const normalized = String(value).trim().replace(',', '.');
  if (!/^\d{1,2}(\.\d{1,4})?$/.test(normalized)) return null;
  const rate = Number(normalized);
  return rate > 0 && rate <= 30 ? rate : null;
}

const NO_PIX = { pixLabel: '', pixBalance: '', pixInstallment: '', pixCet: '' };
const amountInvalid = (raw, cents) => raw !== '' && (cents === null || cents < 1 || cents > 100000000);

// "Pix no crédito" is not sent by Open Finance (B14, ADR 0020): the person types it, and every line says so.
function PixCredit({ manualDebts, onChange, lang, t }) {
  const [form, setForm] = useState(NO_PIX);
  const [state, setState] = useState({ busy: false, error: null });
  const balance = form.pixBalance === '' ? null : parseAmount(form.pixBalance);
  const installment = form.pixInstallment === '' ? null : parseAmount(form.pixInstallment);
  const cet = form.pixCet === '' ? null : parseMonthlyCet(form.pixCet);
  const cetInvalid = form.pixCet !== '' && cet === null;
  const ready =
    form.pixLabel.trim() !== '' &&
    balance !== null &&
    installment !== null &&
    cet !== null &&
    !amountInvalid(form.pixBalance, balance) &&
    !amountInvalid(form.pixInstallment, installment);
  // By field, not event.target.name: the value is all the handler needs from the event.
  const change = (field) => (event) => setForm((previous) => ({ ...previous, [field]: event.target.value }));

  const run = async (request, reset) => {
    setState({ busy: true, error: null });
    try {
      await request();
      if (reset) setForm(NO_PIX);
      setState({ busy: false, error: null });
      onChange();
    } catch (failure) {
      setState({ busy: false, error: errorKey(failure) });
    }
  };

  const add = (event) => {
    event.preventDefault();
    run(
      () =>
        HttpService.postWithAuth('/future/manual-debts', {
          kind: 'PIX_CREDIT',
          label: form.pixLabel.trim(),
          outstandingBalance: balance / 100,
          installmentAmount: installment / 100,
          monthlyCet: cet,
        }),
      true
    );
  };

  return (
    <Box
      component="section"
      aria-labelledby="pix-credit"
      sx={{ mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}
    >
      <Typography id="pix-credit" variant="subtitle1" component="h3">
        {t('commitments.pix.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {t('commitments.pix.help')}
      </Typography>
      {manualDebts.map((debt) => (
        <Stack
          key={debt.id}
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          alignItems={{ sm: 'center' }}
          justifyContent="space-between"
          sx={{ py: 1 }}
        >
          <Box>
            <Typography variant="body2">
              {t('commitments.pix.line', {
                label: debt.label,
                balance: money(debt.outstandingBalance, lang),
                installment: money(debt.installmentAmount, lang),
                cet: Number(debt.monthlyCet).toLocaleString(lang === 'en' ? 'en-US' : 'pt-BR'),
              })}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
              <Chip size="small" variant="outlined" label={t('commitments.pix.typedByYou')} />
              <CertaintyChip certainty={debt.certainty} />
            </Stack>
          </Box>
          <Button
            size="small"
            color="inherit"
            disabled={state.busy}
            onClick={() => run(() => HttpService.deleteWithAuth(`/future/manual-debts/${debt.id}`), false)}
          >
            {t('commitments.pix.remove')}
          </Button>
        </Stack>
      ))}
      <Stack component="form" spacing={1.5} onSubmit={add} sx={{ mt: 1 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField
            size="small"
            name="pixLabel"
            label={t('commitments.pix.label')}
            value={form.pixLabel}
            onChange={change('pixLabel')}
            inputProps={{ maxLength: 60 }}
          />
          <TextField
            size="small"
            name="pixBalance"
            label={t('commitments.pix.balance')}
            value={form.pixBalance}
            onChange={change('pixBalance')}
            inputProps={{ inputMode: 'decimal' }}
            error={amountInvalid(form.pixBalance, balance)}
          />
          <TextField
            size="small"
            name="pixInstallment"
            label={t('commitments.pix.installment')}
            value={form.pixInstallment}
            onChange={change('pixInstallment')}
            inputProps={{ inputMode: 'decimal' }}
            error={amountInvalid(form.pixInstallment, installment)}
          />
          <TextField
            size="small"
            name="pixCet"
            label={t('commitments.pix.cet')}
            value={form.pixCet}
            onChange={change('pixCet')}
            inputProps={{ inputMode: 'decimal' }}
            error={cetInvalid}
            helperText={cetInvalid ? t('commitments.pix.cetInvalid') : t('commitments.pix.cetHelp')}
          />
        </Stack>
        <Box>
          <Button type="submit" variant="outlined" disabled={!ready || state.busy}>
            {t('commitments.pix.add')}
          </Button>
        </Box>
      </Stack>
      {state.error && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {t(state.error)}
        </Alert>
      )}
    </Box>
  );
}

PixCredit.propTypes = {
  manualDebts: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.number.isRequired,
      label: PropTypes.string.isRequired,
      certainty: PropTypes.oneOf(['CONFIRMED', 'ESTIMATED', 'HYPOTHETICAL']).isRequired,
    })
  ).isRequired,
  onChange: PropTypes.func.isRequired,
  lang: PropTypes.string.isRequired,
  t: PropTypes.func.isRequired,
};

// "In what order do I pay my loans off, and what does it save?" (ADR 0013). Reorders money already paid plus the
// extra the person types; nothing here offers credit.
function Row({ title, plan, saves, lang, t }) {
  return (
    <Box sx={{ py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={0.5}>
        <Typography variant="subtitle2">{title}</Typography>
        <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {plan.months == null
            ? t('commitments.payoff.never')
            : t('commitments.payoff.months', { count: plan.months, interest: money(plan.interest, lang) })}
        </Typography>
      </Stack>
      {saves != null && Number(saves) > 0 && (
        <Typography variant="caption" color="success.main" component="p">
          {t('commitments.payoff.saves', { amount: money(saves, lang) })}
        </Typography>
      )}
    </Box>
  );
}

Row.propTypes = {
  title: PropTypes.string.isRequired,
  plan: PropTypes.shape({
    months: PropTypes.number,
    interest: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  }).isRequired,
  saves: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  lang: PropTypes.string.isRequired,
  t: PropTypes.func.isRequired,
};

export default function DebtPayoff({ manualDebts = [], onChange = () => {} }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [extra, setExtra] = useState('');
  const [state, setState] = useState({ loading: false, error: null, answer: null });
  const cents = extra === '' ? 0 : parseAmount(extra);
  const invalid = cents === null || cents > 100000000;

  const calculate = async (event) => {
    event.preventDefault();
    setState({ loading: true, error: null, answer: null });
    try {
      const answer = await HttpService.getWithAuth(`/future/debt-payoff?extra=${cents / 100}`);
      setState({ loading: false, error: null, answer });
    } catch (failure) {
      setState({ loading: false, error: errorKey(failure), answer: null });
    }
  };

  const { answer } = state;
  const plan = answer?.plan;
  return (
    <Card component="section" aria-labelledby="debt-payoff" sx={{ p: 3 }}>
      <Typography id="debt-payoff" variant="h6" component="h2">
        {t('commitments.payoff.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t('commitments.payoff.help')}
      </Typography>
      <Stack component="form" direction={{ xs: 'column', sm: 'row' }} spacing={1.5} onSubmit={calculate}>
        <TextField
          size="small"
          label={t('commitments.payoff.extra')}
          value={extra}
          onChange={(event) => setExtra(event.target.value)}
          inputProps={{ inputMode: 'decimal' }}
          error={invalid}
          helperText={invalid ? t('commitments.payoff.extraInvalid') : undefined}
        />
        <Button type="submit" variant="contained" disabled={invalid || state.loading} sx={{ flexShrink: 0 }}>
          {t('commitments.payoff.calculate')}
        </Button>
      </Stack>

      <Box aria-live="polite" sx={{ mt: 2 }}>
        {state.error && <Alert severity="error">{t(state.error)}</Alert>}
        {plan && plan.avalanche.order.length === 0 && (
          <Typography variant="body2">{t('commitments.payoff.noLoans')}</Typography>
        )}
        {plan && plan.avalanche.order.length > 0 && (
          <>
            <Row title={t('commitments.payoff.baseline')} plan={plan.baseline} lang={lang} t={t} />
            <Row
              title={t('commitments.payoff.avalanche')}
              plan={plan.avalanche}
              saves={plan.avalancheSaves}
              lang={lang}
              t={t}
            />
            <Row
              title={t('commitments.payoff.snowball')}
              plan={plan.snowball}
              saves={plan.snowballSaves}
              lang={lang}
              t={t}
            />
            <Typography variant="subtitle2" sx={{ mt: 2 }}>
              {t('commitments.payoff.orderTitle')}
            </Typography>
            <Box component="ol" sx={{ m: 0, pl: 3 }}>
              {plan.avalanche.order.map((payoff) => (
                <Typography component="li" variant="body2" key={payoff.id}>
                  {payoff.label}
                  {payoff.month != null ? `: ${t('commitments.payoff.endsIn', { count: payoff.month })}` : ''}
                  {payoff.origin === 'MANUAL' && ` (${t('commitments.pix.typedByYou')})`}
                </Typography>
              ))}
            </Box>
          </>
        )}
        {answer?.loansWithoutRate > 0 && (
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
            {t('commitments.payoff.withoutRate', { count: answer.loansWithoutRate })}
          </Typography>
        )}
        {plan && (
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
            {t('commitments.payoff.note')}
          </Typography>
        )}
      </Box>
      <PixCredit manualDebts={manualDebts} onChange={onChange} lang={lang} t={t} />
    </Card>
  );
}

DebtPayoff.propTypes = {
  manualDebts: PropTypes.array,
  onChange: PropTypes.func,
};
