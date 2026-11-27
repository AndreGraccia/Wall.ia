import { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import HttpService from '../../services/HttpService';
import { StatBlock } from '../../components/future-ui';
import { ListRow } from '../../components/detail-ui';
import { PageHeading, PageSkeleton } from '../../components/wallet-ui';
import { dayLabel, errorKey, money, parseAmount } from '../../utils/wallet';
import InvestmentForm from './InvestmentForm';

const FULL_DATE = { day: '2-digit', month: '2-digit', year: 'numeric' };

/**
 * Patrimônio (ADR 0026): account balances, the investments the person types and the known debts, each with its
 * origin and date. Informative: no quote, no advice, and nothing here changes the balance or the projection.
 */
export default function Wealth() {
  const { t, i18n } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const lang = i18n.language;
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [busy, setBusy] = useState(false);
  // null: closed; 'new'; or the id being edited.
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);

  const load = useCallback(async () => {
    setState((previous) => ({ ...previous, loading: true, error: null }));
    try {
      setState({ loading: false, error: null, data: await HttpService.getWithAuth('/wealth') });
    } catch (failure) {
      setState((previous) => ({ ...previous, loading: false, error: errorKey(failure) }));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Every change answers the whole view, so there is nothing to reload.
  const run = async (request, message) => {
    setBusy(true);
    try {
      const data = await request();
      setState({ loading: false, error: null, data });
      enqueueSnackbar(t(message), { variant: 'success' });
      return true;
    } catch (failure) {
      enqueueSnackbar(t(errorKey(failure)), { variant: 'error' });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const create = async (body) => {
    if (await run(() => HttpService.postWithAuth('/wealth/investments', body), 'wealth.saved')) setEditing(null);
  };
  const update = async (id, body) => {
    if (await run(() => HttpService.putWithAuth(`/wealth/investments/${id}`, body), 'wealth.saved')) setEditing(null);
  };
  const putValue = (id, body) =>
    run(() => HttpService.putWithAuth(`/wealth/investments/${id}/values`, body), 'wealth.valueSaved');
  const removeValue = (id, date) =>
    run(() => HttpService.deleteWithAuth(`/wealth/investments/${id}/values/${date}`), 'wealth.valueRemoved');
  const remove = async () => {
    const { id } = removing;
    setRemoving(null);
    await run(() => HttpService.deleteWithAuth(`/wealth/investments/${id}`), 'wealth.removed');
  };

  const { data } = state;
  const date = (value) => (value ? dayLabel(value, lang, FULL_DATE) : t('wealth.neverSynced'));

  return (
    <>
      <Helmet>
        <title>{t('wealth.pageTitle')}</title>
      </Helmet>
      <Container maxWidth="lg">
        <PageHeading title={t('wealth.heading')} />

        {state.loading && !data && <PageSkeleton rows={4} />}
        {state.error && (
          <Alert
            severity="error"
            action={
              <Button color="inherit" onClick={load}>
                {t('app.retry')}
              </Button>
            }
          >
            {t(state.error)}
          </Alert>
        )}

        {data && (
          <Stack spacing={{ xs: 4, md: 5 }} aria-busy={state.loading || busy}>
            <Box>
              <StatBlock
                emphasis
                label={t('wealth.netWorth')}
                value={money(data.netWorth, lang)}
                negative={Number(data.netWorth) < 0}
                help={t('wealth.formula', { date: date(data.today) })}
              />
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' },
                  gap: { xs: 3, md: 4 },
                  mt: 3,
                }}
              >
                <StatBlock compact label={t('wealth.accounts')} value={money(data.accountsTotal, lang)} />
                <StatBlock compact label={t('wealth.investments')} value={money(data.investmentsTotal, lang)} />
                <StatBlock compact label={t('wealth.debts')} value={money(data.debtsTotal, lang)} />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2, maxWidth: 640 }}>
                {t('wealth.disclaimer')}
              </Typography>
            </Box>

            <Box component="section" aria-labelledby="wealth-investments">
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1, gap: 2 }}>
                <Typography id="wealth-investments" variant="h6" component="h2">
                  {t('wealth.investmentsTitle')}
                </Typography>
                {data.investments.length > 0 && editing !== 'new' && (
                  <Button onClick={() => setEditing('new')}>{t('wealth.addAnother')}</Button>
                )}
              </Stack>
              {!data.investments.length && (
                <Typography color="text.secondary" sx={{ mb: 2, maxWidth: 640 }}>
                  {t('wealth.empty')}
                </Typography>
              )}
              {data.investments.map((investment) =>
                editing === investment.id ? (
                  <InvestmentForm
                    key={investment.id}
                    investment={investment}
                    today={data.today}
                    busy={busy}
                    onSubmit={(body) => update(investment.id, body)}
                    onCancel={() => setEditing(null)}
                  />
                ) : (
                  <ListRow
                    key={investment.id}
                    title={investment.name}
                    titleComponent="h3"
                    meta={`${investment.institution} · ${t(`wealth.classes.${investment.assetClass}`)} · ${t(
                      'wealth.informedOn',
                      { date: date(investment.valueDate) }
                    )}`}
                    value={money(investment.value, lang)}
                    detail={
                      <InvestmentDetail
                        investment={investment}
                        today={data.today}
                        busy={busy}
                        date={date}
                        onValue={(body) => putValue(investment.id, body)}
                        onRemoveValue={(day) => removeValue(investment.id, day)}
                        onEdit={() => setEditing(investment.id)}
                        onRemove={() => setRemoving(investment)}
                      />
                    }
                  />
                )
              )}
              {(editing === 'new' || !data.investments.length) && (
                <Box sx={{ mt: 2 }}>
                  <InvestmentForm
                    today={data.today}
                    busy={busy}
                    onSubmit={create}
                    onCancel={data.investments.length ? () => setEditing(null) : undefined}
                  />
                </Box>
              )}
              <Button component={RouterLink} to="/plan" sx={{ mt: 1, ml: -1 }}>
                {t('wealth.planLink')}
              </Button>
            </Box>

            {data.evolution.length > 1 && (
              <Box component="section" aria-labelledby="wealth-evolution">
                <Typography id="wealth-evolution" variant="h6" component="h2">
                  {t('wealth.evolutionTitle')}
                </Typography>
                <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 1 }}>
                  {t('wealth.evolutionHelp')}
                </Typography>
                {/* ponytail: the last 12 dates as a list; a chart when people ask to compare long histories. */}
                {data.evolution
                  .slice(-12)
                  .reverse()
                  .map((point) => (
                    <ListRow key={point.date} title={date(point.date)} value={money(point.amount, lang)} />
                  ))}
              </Box>
            )}

            <Box component="section" aria-labelledby="wealth-accounts">
              <Typography id="wealth-accounts" variant="h6" component="h2" sx={{ mb: 1 }}>
                {t('wealth.accountsTitle')}
              </Typography>
              {!data.accounts.length && <Typography color="text.secondary">{t('wealth.noAccounts')}</Typography>}
              {data.accounts.map((account) => (
                <ListRow
                  key={account.id}
                  title={account.name}
                  meta={`${
                    account.origin === 'OPEN_FINANCE'
                      ? `Open Finance · ${account.institution}`
                      : t('wealth.localAccount')
                  } · ${date(account.date)}`}
                  value={money(account.balance, lang)}
                />
              ))}
            </Box>

            <Box component="section" aria-labelledby="wealth-debts">
              <Typography id="wealth-debts" variant="h6" component="h2" sx={{ mb: 1 }}>
                {t('wealth.debtsTitle')}
              </Typography>
              {data.pixMayRepeatCardBill && (
                <Alert severity="warning" sx={{ mb: 1 }}>
                  {t('wealth.pixOverlap')}
                </Alert>
              )}
              {!data.debts.length && <Typography color="text.secondary">{t('wealth.noDebts')}</Typography>}
              {data.debts.map((debt) => (
                <ListRow
                  key={`${debt.kind}-${debt.id}`}
                  title={debt.name}
                  meta={`${t(`wealth.debtKinds.${debt.kind}`)}${
                    debt.institution ? ` · ${debt.institution}` : ''
                  } · ${date(debt.date)}`}
                  value={money(debt.amount, lang)}
                />
              ))}
              <Button component={RouterLink} to="/commitments" sx={{ mt: 1, ml: -1 }}>
                {t('wealth.commitmentsLink')}
              </Button>
            </Box>
          </Stack>
        )}

        <Dialog open={Boolean(removing)} onClose={() => setRemoving(null)} aria-labelledby="wealth-remove">
          <DialogTitle id="wealth-remove">{t('wealth.removeTitle', { name: removing?.name })}</DialogTitle>
          <DialogContent>
            <Typography>{t('wealth.removeHelp')}</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRemoving(null)}>{t('common.cancel')}</Button>
            <Button color="error" onClick={remove}>
              {t('wealth.remove')}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </>
  );
}

/** What hangs under one investment: what the person wrote, the new value and the dated history. */
function InvestmentDetail({ investment, today, busy, date, onValue, onRemoveValue, onEdit, onRemove }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [value, setValue] = useState('');
  const [day, setDay] = useState(today);
  const [tried, setTried] = useState(false);
  const cents = parseAmount(value);
  const dayInvalid = !day || day > today;

  const submit = async (event) => {
    event.preventDefault();
    setTried(true);
    if (busy || cents === null || dayInvalid) return;
    if (await onValue({ value: cents / 100, valueDate: day })) {
      setValue('');
      setTried(false);
    }
  };

  const facts = [
    investment.investedAmount !== null && [t('wealth.form.invested'), money(investment.investedAmount, lang)],
    investment.maturityDate && [t('wealth.form.maturity'), date(investment.maturityDate)],
    investment.note && [t('wealth.form.note'), investment.note],
  ].filter(Boolean);

  return (
    <Stack spacing={2}>
      {facts.map(([label, content]) => (
        <Box key={label}>
          <Typography variant="caption" color="text.secondary" component="p">
            {label}
          </Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>
            {content}
          </Typography>
        </Box>
      ))}
      <Stack
        component="form"
        onSubmit={submit}
        noValidate
        aria-label={t('wealth.updateValue')}
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems={{ sm: 'flex-start' }}
      >
        <TextField
          size="small"
          name="newValue"
          label={t('wealth.newValue')}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          inputProps={{ inputMode: 'decimal' }}
          error={tried && cents === null}
          helperText={tried && cents === null ? t('wealth.form.amountInvalid') : undefined}
        />
        <TextField
          size="small"
          name="newValueDate"
          type="date"
          label={t('wealth.form.valueDate')}
          value={day}
          onChange={(event) => setDay(event.target.value)}
          InputLabelProps={{ shrink: true }}
          inputProps={{ max: today }}
          error={tried && dayInvalid}
          helperText={tried && dayInvalid ? t('wealth.form.dateInvalid') : undefined}
        />
        <Button type="submit" variant="outlined" disabled={busy}>
          {t('wealth.updateValue')}
        </Button>
      </Stack>
      <Box>
        <Typography variant="caption" color="text.secondary" component="p">
          {t('wealth.history')}
        </Typography>
        {[...investment.history].reverse().map((point) => (
          <ListRow
            key={point.date}
            title={date(point.date)}
            value={money(point.amount, lang)}
            aside={
              investment.history.length > 1 ? (
                <Button
                  size="small"
                  disabled={busy}
                  onClick={() => onRemoveValue(point.date)}
                  aria-label={t('wealth.removeValueLabel', { date: date(point.date) })}
                >
                  {t('wealth.removeValue')}
                </Button>
              ) : undefined
            }
          />
        ))}
      </Box>
      <Stack direction="row" spacing={1}>
        <Button onClick={onEdit}>{t('wealth.edit')}</Button>
        <Button color="error" onClick={onRemove} disabled={busy}>
          {t('wealth.remove')}
        </Button>
      </Stack>
    </Stack>
  );
}
InvestmentDetail.propTypes = {
  investment: PropTypes.object.isRequired,
  today: PropTypes.string.isRequired,
  busy: PropTypes.bool,
  date: PropTypes.func.isRequired,
  onValue: PropTypes.func.isRequired,
  onRemoveValue: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
};
