import { useState } from 'react';
import PropTypes from 'prop-types';
import { Alert, Box, Button, Card, Chip, Stack, TextField, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import HttpService from '../../services/HttpService';
import { CertaintyChip } from '../../components/future-ui';
import { Disclosure, ListRow } from '../../components/detail-ui';
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
    <Card component="section" aria-labelledby="pix-credit" sx={{ p: { xs: 2.5, md: 3 } }}>
      <Typography id="pix-credit" variant="h6" component="h2">
        {t('commitments.pix.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        {t('commitments.pix.helpShort')}
      </Typography>
      <Disclosure label={t('commitments.pix.why')} sx={{ mt: 0.5 }}>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 680 }}>
          {t('commitments.pix.help')}
        </Typography>
      </Disclosure>
      {manualDebts.length > 0 && (
        <Box sx={{ mt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
          {manualDebts.map((debt) => (
            <ListRow
              key={debt.id}
              title={debt.label}
              meta={t('commitments.pix.lineMeta', {
                installment: money(debt.installmentAmount, lang),
                cet: Number(debt.monthlyCet).toLocaleString(lang === 'en' ? 'en-US' : 'pt-BR'),
              })}
              value={money(debt.outstandingBalance, lang)}
              aside={
                <Stack direction="row" flexWrap="wrap" justifyContent="flex-end" alignItems="center" sx={{ gap: 0.5 }}>
                  <Chip size="small" variant="outlined" label={t('commitments.pix.typedByYou')} />
                  <CertaintyChip certainty={debt.certainty} />
                  <Button
                    size="small"
                    color="inherit"
                    disabled={state.busy}
                    onClick={() => run(() => HttpService.deleteWithAuth(`/future/manual-debts/${debt.id}`), false)}
                    aria-label={`${t('commitments.pix.remove')} ${debt.label}`}
                  >
                    {t('commitments.pix.remove')}
                  </Button>
                </Stack>
              }
            />
          ))}
        </Box>
      )}
      <Box component="form" onSubmit={add} sx={{ mt: 2 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
            gap: 1.5,
            alignItems: 'start',
          }}
        >
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
        </Box>
        <Button type="submit" variant="outlined" disabled={!ready || state.busy} sx={{ mt: 2 }}>
          {t('commitments.pix.add')}
        </Button>
      </Box>
      {state.error && (
        <Alert severity="error" sx={{ mt: 2 }} role="alert">
          {t(state.error)}
        </Alert>
      )}
    </Card>
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
    <ListRow
      title={title}
      meta={
        plan.months == null
          ? t('commitments.payoff.never')
          : t('commitments.payoff.months', { count: plan.months, interest: money(plan.interest, lang) })
      }
      value={
        saves != null && Number(saves) > 0 ? t('commitments.payoff.saves', { amount: money(saves, lang) }) : undefined
      }
      valueColor="success.main"
    />
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
    <Stack spacing={3}>
      <Card component="section" aria-labelledby="debt-payoff" sx={{ p: { xs: 2.5, md: 3 } }}>
        <Typography id="debt-payoff" variant="h6" component="h2">
          {t('commitments.payoff.title')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2, maxWidth: 640 }}>
          {t('commitments.payoff.help')}
        </Typography>
        <Stack
          component="form"
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ sm: 'flex-start' }}
          spacing={1.5}
          onSubmit={calculate}
        >
          <TextField
            size="small"
            label={t('commitments.payoff.extra')}
            value={extra}
            onChange={(event) => setExtra(event.target.value)}
            inputProps={{ inputMode: 'decimal' }}
            error={invalid}
            helperText={invalid ? t('commitments.payoff.extraInvalid') : undefined}
          />
          <Button
            type="submit"
            variant="contained"
            disabled={invalid || state.loading}
            sx={{ flexShrink: 0, alignSelf: { xs: 'flex-start', sm: 'auto' } }}
          >
            {state.loading ? t('commitments.payoff.calculating') : t('commitments.payoff.calculate')}
          </Button>
        </Stack>

        <Box aria-live="polite" sx={{ mt: plan || state.error ? 2 : 0 }}>
          {state.error && <Alert severity="error">{t(state.error)}</Alert>}
          {plan && plan.avalanche.order.length === 0 && (
            <Typography variant="body2">{t('commitments.payoff.noLoans')}</Typography>
          )}
          {plan && plan.avalanche.order.length > 0 && (
            <>
              <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
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
              </Box>
              <Typography variant="subtitle2" component="h3" sx={{ mt: 3 }}>
                {t('commitments.payoff.orderTitle')}
              </Typography>
              <Box component="ol" sx={{ m: 0, mt: 1, pl: 3 }}>
                {plan.avalanche.order.map((payoff) => (
                  <Typography component="li" variant="body2" key={payoff.id} sx={{ py: 0.5 }}>
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
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1, maxWidth: 680 }}>
              {t('commitments.payoff.note')}
            </Typography>
          )}
        </Box>
      </Card>
      <PixCredit manualDebts={manualDebts} onChange={onChange} lang={lang} t={t} />
    </Stack>
  );
}

DebtPayoff.propTypes = {
  manualDebts: PropTypes.array,
  onChange: PropTypes.func,
};
