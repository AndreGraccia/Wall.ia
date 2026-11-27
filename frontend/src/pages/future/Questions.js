import { useState } from 'react';
import PropTypes from 'prop-types';
import { Box, Button, Chip, Collapse, Stack, TextField, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import HttpService from '../../services/HttpService';
import { SectionCard, WalletIcon } from '../../components/wallet-ui';
import { dayLabel, errorKey, money, parseAmount } from '../../utils/wallet';

// Alternative answer offered next to the suggestion ("é outra renda", "é outra conta fixa").
const ALTERNATIVE = {
  SALARY: ['OTHER_INCOME', 'otherIncome'],
  OTHER_INCOME: ['SALARY', 'SALARY'],
  RENT: ['BILL', 'otherBill'],
  SUBSCRIPTION: ['BILL', 'otherBill'],
  BILL: ['OTHER', 'OTHER'],
  OTHER: ['BILL', 'otherBill'],
};

// Open Finance account names usually already carry the institution ("Banco X • 8392").
const origin = ({ institution, accountName }) =>
  accountName && institution && !accountName.includes(institution)
    ? `${institution} · ${accountName}`
    : accountName || institution;

function Question({ item, onAnswered }) {
  const { t, i18n } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = item.status === 'PENDING';
  const suggestion = item.suggestedCategory;
  const [alternative, alternativeLabel] = ALTERNATIVE[suggestion] || ['OTHER', 'OTHER'];
  const first = item.occurrences[0];

  const answer = async (status, category) => {
    setBusy(true);
    try {
      await HttpService.putWithAuth('/future/recurrences/decision', { key: item.key, status, category });
      enqueueSnackbar(t('future.saved'), { variant: 'success' });
      onAnswered();
    } catch (failure) {
      enqueueSnackbar(t(errorKey(failure)), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const evidence = t(item.fixedAmount ? 'future.evidence' : 'future.evidenceVaries', {
    amount: money(item.typicalAmount, i18n.language),
    day: item.typicalDay,
    count: item.occurrences.length,
    since: dayLabel(first.date, i18n.language, { month: 'long' }),
  });

  return (
    <Box sx={{ px: 3, py: 2.5, borderTop: '1px solid', borderColor: 'divider' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between">
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" component="h3">
            {pending ? t(`future.questions.${suggestion}`, { name: item.counterparty }) : item.counterparty}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {evidence}
          </Typography>
          <Stack direction="row" flexWrap="wrap" sx={{ mt: 1, gap: 1 }}>
            <Chip size="small" label={t(`future.confidence.${item.confidence}`)} />
            <Chip size="small" variant="outlined" label={origin(item)} />
            {!pending && (
              <Chip
                size="small"
                color={item.status === 'CONFIRMED' ? 'primary' : 'default'}
                variant={item.status === 'CONFIRMED' ? 'filled' : 'outlined'}
                label={`${t(`future.status.${item.status}`)}${
                  item.status === 'CONFIRMED' ? ` · ${t(`future.categories.${item.category}`)}` : ''
                }`}
              />
            )}
          </Stack>
        </Box>
        <Stack direction="row" flexWrap="wrap" alignItems="flex-start" sx={{ flexShrink: 0, gap: 1 }}>
          {pending ? (
            <>
              <Button variant="contained" disabled={busy} onClick={() => answer('CONFIRMED', suggestion)}>
                {t(`future.answers.${suggestion}`)}
              </Button>
              <Button variant="outlined" disabled={busy} onClick={() => answer('CONFIRMED', alternative)}>
                {t(`future.answers.${alternativeLabel}`)}
              </Button>
              <Button color="inherit" disabled={busy} onClick={() => answer('REJECTED', null)}>
                {t('future.answers.no')}
              </Button>
            </>
          ) : (
            <Button color="inherit" disabled={busy} onClick={() => answer('PENDING', null)}>
              {t('future.answers.undo')}
            </Button>
          )}
        </Stack>
      </Stack>
      <Button
        size="small"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        startIcon={<WalletIcon name="history" sx={{ fontSize: 18 }} />}
        sx={{ mt: 1, px: 0, color: 'text.secondary' }}
      >
        {t(open ? 'future.hideHistory' : 'future.showHistory')}
      </Button>
      <Collapse in={open} unmountOnExit>
        <Box
          component="table"
          sx={{ mt: 1, width: '100%', borderCollapse: 'collapse', '& td': { py: 0.75, fontSize: 14 } }}
        >
          <caption style={{ textAlign: 'left', captionSide: 'top', paddingBottom: 4 }}>
            <Typography variant="caption" color="text.secondary">
              {t('future.historyTitle')}
            </Typography>
          </caption>
          <tbody>
            {item.occurrences.map((occurrence) => (
              <tr key={`${occurrence.transactionId}-${occurrence.date}`}>
                <td>{dayLabel(occurrence.date, i18n.language, { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {item.direction === 'IN' ? '+ ' : '− '}
                  {money(occurrence.amount, i18n.language)}
                </td>
              </tr>
            ))}
          </tbody>
        </Box>
      </Collapse>
    </Box>
  );
}
Question.propTypes = { item: PropTypes.object.isRequired, onAnswered: PropTypes.func.isRequired };

/**
 * Everyday spending asked like a recurrence: the estimate and where the money went, then the
 * user's answer. The user may also type their own daily value.
 */
function DailySpendingQuestion({ data, source = 'ACCOUNT', onAnswered }) {
  const { t, i18n } = useTranslation();
  // The card question reuses the same flow; only its own sentences change.
  const copy = source === 'CARD' ? 'future.cardDaily' : 'future.daily';
  const { enqueueSnackbar } = useSnackbar();
  const lang = i18n.language;
  const [busy, setBusy] = useState(false);
  const hasEstimate = Number(data.suggestedDaily) > 0;
  const [editing, setEditing] = useState(!hasEstimate && data.status === 'PENDING');
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  const cents = parseAmount(value);
  const invalid = value !== '' && (cents === null || cents > 10000000);
  const pending = data.status === 'PENDING';

  const answer = async (status, dailyAmount) => {
    setBusy(true);
    try {
      await HttpService.putWithAuth('/future/daily-spending', { status, source, dailyAmount });
      enqueueSnackbar(t('future.saved'), { variant: 'success' });
      // Undo without history goes back to the only possible answer: typing a value.
      setEditing(status === 'PENDING' && !hasEstimate);
      onAnswered();
    } catch (failure) {
      enqueueSnackbar(t(errorKey(failure)), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  let title = t(`${copy}.question`, { amount: money(data.suggestedDaily, lang) });
  if (!hasEstimate) title = t(`${copy}.noHistory`);
  if (data.status === 'CONFIRMED') title = t(`${copy}.confirmed`, { amount: money(data.appliedDaily, lang) });
  if (data.status === 'REJECTED') title = t(`${copy}.rejected`);

  return (
    <Box sx={{ px: 3, py: 2.5, borderTop: '1px solid', borderColor: 'divider' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between">
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="overline" color="text.secondary" component="p">
            {t(`${copy}.title`)}
          </Typography>
          <Typography variant="subtitle1" component="h3">
            {title}
          </Typography>
          {hasEstimate && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {t(`${copy}.evidence`, {
                total: money(data.total, lang),
                times: data.movements,
                days: data.days,
              })}
            </Typography>
          )}
        </Box>
        <Stack direction="row" flexWrap="wrap" alignItems="flex-start" sx={{ flexShrink: 0, gap: 1 }}>
          {pending && (
            <>
              {/* "Yes" means "use the estimate"; without one the backend refuses it. */}
              {hasEstimate && !editing && (
                <Button variant="contained" disabled={busy} onClick={() => answer('CONFIRMED', null)}>
                  {t('future.daily.yes')}
                </Button>
              )}
              {!editing && (
                <Button variant="outlined" disabled={busy} onClick={() => setEditing(true)}>
                  {t('future.daily.own')}
                </Button>
              )}
              <Button color="inherit" disabled={busy} onClick={() => answer('REJECTED', null)}>
                {t('future.daily.no')}
              </Button>
            </>
          )}
          {!pending && (
            <Button color="inherit" disabled={busy} onClick={() => answer('PENDING', null)}>
              {t('future.answers.undo')}
            </Button>
          )}
        </Stack>
      </Stack>
      {editing && (
        <Stack
          component="form"
          direction="row"
          alignItems="flex-start"
          sx={{ mt: 2, gap: 1 }}
          onSubmit={(event) => {
            event.preventDefault();
            if (cents !== null && !invalid) answer('CONFIRMED', cents / 100);
          }}
        >
          <TextField
            size="small"
            label={t('future.daily.ownLabel')}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            inputProps={{ inputMode: 'decimal', 'aria-invalid': invalid }}
            error={invalid}
            helperText={invalid ? t('app.errors.INVALID_AMOUNT') : ' '}
            sx={{ width: 180 }}
          />
          <Button type="submit" variant="contained" disabled={busy || cents === null || invalid}>
            {t('future.daily.save')}
          </Button>
        </Stack>
      )}
      {data.top.length > 0 && (
        <>
          <Button
            size="small"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            startIcon={<WalletIcon name="history" sx={{ fontSize: 18 }} />}
            sx={{ mt: 1, px: 0, color: 'text.secondary' }}
          >
            {t(open ? 'future.hideHistory' : 'future.daily.where')}
          </Button>
          <Collapse in={open} unmountOnExit>
            <Box component="ul" sx={{ m: 0, mt: 1, pl: 2.5 }}>
              {data.top.map((item) => (
                <Typography component="li" variant="body2" key={item.counterparty} sx={{ py: 0.25 }}>
                  {t('future.daily.whereItem', {
                    name: item.counterparty,
                    amount: money(item.total, lang),
                    times: item.count,
                  })}
                </Typography>
              ))}
            </Box>
          </Collapse>
        </>
      )}
    </Box>
  );
}
DailySpendingQuestion.propTypes = {
  data: PropTypes.object.isRequired,
  source: PropTypes.oneOf(['ACCOUNT', 'CARD']),
  onAnswered: PropTypes.func.isRequired,
};

export default function Questions({ recurrences, dailySpending, cardSpending, onAnswered, collapsible, title }) {
  const { t } = useTranslation();
  const pending = recurrences.filter((item) => item.status === 'PENDING');
  const answered = recurrences.filter((item) => item.status !== 'PENDING');
  const [showAnswered, setShowAnswered] = useState(false);
  return (
    <SectionCard title={title || t('future.questionsTitle')} collapsible={collapsible}>
      <Typography variant="body2" color="text.secondary" sx={{ px: 3, pb: 2 }}>
        {pending.length || dailySpending?.status === 'PENDING' || cardSpending?.status === 'PENDING'
          ? t('future.questionsHelp')
          : t('future.noQuestions')}
      </Typography>
      {dailySpending && <DailySpendingQuestion data={dailySpending} onAnswered={onAnswered} />}
      {cardSpending && <DailySpendingQuestion data={cardSpending} source="CARD" onAnswered={onAnswered} />}
      {pending.map((item) => (
        <Question key={item.key} item={item} onAnswered={onAnswered} />
      ))}
      {answered.length > 0 && (
        <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
          {/* Already answered: kept one tap away so the page stays about what still needs a decision. */}
          <Button
            fullWidth
            color="inherit"
            onClick={() => setShowAnswered(!showAnswered)}
            aria-expanded={showAnswered}
            sx={{ justifyContent: 'space-between', px: 3, py: 1.5, borderRadius: 0 }}
          >
            {t(showAnswered ? 'future.hideAnswered' : 'future.showAnswered', { count: answered.length })}
          </Button>
          <Collapse in={showAnswered} unmountOnExit>
            {answered.map((item) => (
              <Question key={item.key} item={item} onAnswered={onAnswered} />
            ))}
          </Collapse>
        </Box>
      )}
    </SectionCard>
  );
}
Questions.propTypes = {
  collapsible: PropTypes.bool,
  title: PropTypes.string,
  recurrences: PropTypes.array.isRequired,
  dailySpending: PropTypes.object,
  cardSpending: PropTypes.object,
  onAnswered: PropTypes.func.isRequired,
};
