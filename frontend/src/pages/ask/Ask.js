import { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, Chip, Container, Skeleton, Stack, TextField, Typography } from '@mui/material';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import HttpService from '../../services/HttpService';
import { EventRow, ExitPlanList } from '../../components/future-ui';
import { Disclosure } from '../../components/detail-ui';
import { PageHeading } from '../../components/wallet-ui';
import { dayLabel, errorKey, money, overdraftCostText } from '../../utils/wallet';
import { forecastReady, limitSummary } from '../../utils/forecast';

const SUGGESTIONS = ['s1', 's2', 's3', 's4', 's5'];
const VERDICT_COLOR = { SAFE: 'success', TIGHT: 'warning', RISK: 'error' };
const sign = (value) => (Number(value) < 0 ? 'error.main' : 'text.primary');

/**
 * Turns the engine's answer into what the screen shows: an optional headline number (label, value, colour),
 * one short sentence and the details behind "De onde veio". Numbers come only from the engine.
 */
function useAnswer(answer) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const line = (text) => (
    <Typography variant="body2" color="text.secondary">
      {text}
    </Typography>
  );

  switch (answer.intent) {
    case 'PURCHASE': {
      if (answer.verdict === 'NEED_AMOUNT') return { sentence: t('ask.needAmount') };
      if (answer.verdict === 'INVALID_INSTALLMENTS') return { sentence: t('ask.invalidInstallments', { max: 24 }) };
      return {
        seal: (
          <Chip
            color={VERDICT_COLOR[answer.verdict]}
            label={t(`ask.verdict.${answer.verdict}`)}
            sx={{ fontWeight: 600 }}
          />
        ),
        label: t('ask.headline.purchase'),
        value: money(answer.after.minBalance90, lang),
        color: sign(answer.after.minBalance90),
        sentence: t('ask.purchaseMin', {
          before: money(answer.before.minBalance90, lang),
          after: money(answer.after.minBalance90, lang),
        }),
        details: (
          <>
            {line(t('ask.purchaseDays', { before: answer.before.negativeDays, after: answer.after.negativeDays }))}
            {answer.installments > 1 &&
              Number(answer.newMonthlyCommitment) > 0 &&
              line(t('ask.purchaseMonthly', { amount: money(answer.newMonthlyCommitment, lang) }))}
            {answer.cardName && line(t('ask.purchaseCard', { card: answer.cardName }))}
          </>
        ),
      };
    }
    case 'DAILY_LIMIT': {
      const limit = answer.spendingLimit;
      if (!forecastReady({ sources: answer.sources, limit })) return { sentence: t('ask.dailyNotReady') };
      const summary = limitSummary(limit);
      const values = { date: dayLabel(limit.until, lang), amount: money(summary.amount, lang) };
      if (summary.kind === 'canSpend')
        return {
          label: t('ask.headline.daily'),
          value: money(summary.amount, lang),
          unit: t('future.hero.perDay'),
          sentence: t('ask.dailyOk', values),
        };
      return {
        label: t('ask.headline.short'),
        value: money(summary.amount, lang),
        color: summary.kind === 'short' ? 'error.main' : 'warning.main',
        sentence: t(summary.kind === 'short' ? 'ask.dailyShort' : 'ask.dailyShortEnvelopes', values),
      };
    }
    case 'WHY_NEGATIVE':
      if (!answer.risk) return { sentence: t('ask.whyNone') };
      return {
        label: t('ask.headline.lowest'),
        value: money(answer.risk.lowestBalance, lang),
        color: sign(answer.risk.lowestBalance),
        sentence: t('ask.why', {
          start: dayLabel(answer.risk.start, lang),
          end: dayLabel(answer.risk.end, lang),
          amount: money(answer.risk.lowestBalance, lang),
        }),
        details: (
          <>
            <Box>
              {answer.risk.causes.map((event) => (
                <EventRow key={`${event.reference}-${event.date}`} event={event} dense />
              ))}
            </Box>
            {Number(answer.risk.overdraftCostCap) > 0 && line(overdraftCostText(t, answer.risk, lang))}
            <ExitPlanList actions={answer.exitPlan} />
          </>
        ),
      };
    case 'COMMITTED':
      return {
        label: t('ask.headline.committed'),
        value: money(answer.committed.total, lang),
        sentence: t('ask.committed', {
          total: money(answer.committed.total, lang),
          date: dayLabel(answer.committed.until, lang),
          confirmed: money(answer.committed.confirmed, lang),
          estimated: money(answer.committed.estimated, lang),
        }),
      };
    case 'NEXT_INCOME':
      if (!answer.nextIncome) return { sentence: t('ask.noIncome') };
      return {
        label: t('ask.headline.income', { date: dayLabel(answer.nextIncome.date, lang) }),
        value: money(answer.nextIncome.amount, lang),
        color: 'success.main',
        sentence: t('ask.nextIncome', {
          label: answer.nextIncome.label,
          date: dayLabel(answer.nextIncome.date, lang),
          amount: money(answer.nextIncome.amount, lang),
        }),
      };
    default:
      return { sentence: t('ask.unknown') };
  }
}

/** One question and its answer: the question small, the number big, one sentence, then where it came from. */
function Turn({ turn, latest }) {
  const { t } = useTranslation();
  const { seal, label, value, unit, color = 'text.primary', sentence, details } = useAnswer(turn.answer);
  const known = turn.answer.intent !== 'UNKNOWN';
  return (
    <Box
      component="article"
      aria-labelledby={`q-${turn.id}`}
      sx={{ py: { xs: 3, md: 4 }, borderBottom: '1px solid', borderColor: 'divider' }}
    >
      <Typography id={`q-${turn.id}`} variant="body1" component="h2" color="text.secondary" sx={{ m: 0 }}>
        {turn.question}
      </Typography>
      <Stack spacing={1.5} sx={{ mt: 2 }}>
        {seal && <Box>{seal}</Box>}
        {value && (
          <Box>
            <Typography variant="body2" color="text.secondary" component="p">
              {label}
            </Typography>
            <Typography
              component="p"
              variant={latest ? 'h2' : 'h3'}
              sx={{ color, mt: 0.5, fontVariantNumeric: 'tabular-nums' }}
            >
              {value}
              {unit && (
                <Typography component="span" variant="h5" color="text.secondary" sx={{ ml: 1, fontWeight: 500 }}>
                  {unit}
                </Typography>
              )}
            </Typography>
          </Box>
        )}
        <Typography variant={value ? 'body1' : 'h6'} sx={{ maxWidth: 640, fontWeight: value ? 400 : 500 }}>
          {sentence}
        </Typography>
      </Stack>
      {known && (
        <Disclosure label={t('ask.whereFrom')} sx={{ mt: 1.5 }}>
          <Stack spacing={1} sx={{ pl: 2, maxWidth: 680, borderLeft: '2px solid', borderColor: 'divider' }}>
            {details}
            <Typography variant="caption" color="text.secondary" component="p">
              {t('ask.source')}
            </Typography>
            <Box>
              <Button component={RouterLink} to="/future" size="small" color="inherit" sx={{ ml: -1 }}>
                {t('ask.openFuture')}
              </Button>
            </Box>
          </Stack>
        </Disclosure>
      )}
    </Box>
  );
}
Turn.propTypes = { turn: PropTypes.object.isRequired, latest: PropTypes.bool };

/** The shape of an answer while the engine calculates: question, number, sentence. */
function AnswerSkeleton({ question }) {
  const { t } = useTranslation();
  return (
    <Box
      role="status"
      aria-label={t('ask.thinking')}
      sx={{ py: { xs: 3, md: 4 }, borderBottom: '1px solid', borderColor: 'divider' }}
    >
      <Typography color="text.secondary">{question}</Typography>
      <Skeleton width={140} sx={{ mt: 2 }} />
      <Skeleton width="min(280px, 70%)" height={56} />
      <Skeleton width="min(480px, 90%)" />
    </Box>
  );
}
AnswerSkeleton.propTypes = { question: PropTypes.string };

export default function Ask() {
  const { t } = useTranslation();
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState([]);
  const [pending, setPending] = useState(null);
  const [error, setError] = useState(null);
  // Sending an empty question is not blocked (a disabled button does not say why): it points at the field instead.
  const [blank, setBlank] = useState(false);
  const input = useRef(null);
  const busy = pending !== null;

  const ask = async (text) => {
    const trimmed = text.trim();
    if (busy) return;
    if (!trimmed) {
      setBlank(true);
      input.current?.focus();
      return;
    }
    setPending(trimmed);
    setError(null);
    try {
      const answer = await HttpService.postWithAuth('/future/ask', { question: trimmed });
      setTurns((previous) => [{ id: Date.now(), question: trimmed, answer }, ...previous]);
      setQuestion('');
    } catch (failure) {
      setError({ key: errorKey(failure), question: trimmed });
    } finally {
      setPending(null);
      input.current?.focus();
    }
  };

  return (
    <>
      <Helmet>
        <title>{t('ask.pageTitle')}</title>
      </Helmet>
      {/* Same container as every page, left-aligned; the reading measure stays at md. */}
      <Container maxWidth="lg">
        <PageHeading title={t('ask.heading')} />
        <Box sx={{ maxWidth: (theme) => theme.breakpoints.values.md }}>
          <Stack
            component="form"
            direction={{ xs: 'column', sm: 'row' }}
            sx={{ gap: 1.5 }}
            onSubmit={(event) => {
              event.preventDefault();
              ask(question);
            }}
          >
            <TextField
              inputRef={input}
              fullWidth
              label={t('ask.label')}
              placeholder={t('ask.placeholder')}
              value={question}
              onChange={(event) => {
                setQuestion(event.target.value);
                setBlank(false);
              }}
              error={blank}
              helperText={blank ? t('ask.emptyQuestion') : undefined}
              inputProps={{ maxLength: 300 }}
              autoComplete="off"
            />
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={busy}
              sx={{ flexShrink: 0, px: 3, alignSelf: 'flex-start', mt: { sm: 0.5 } }}
            >
              {busy ? t('ask.thinking') : t('ask.send')}
            </Button>
          </Stack>
          <Stack direction="row" flexWrap="wrap" aria-label={t('ask.suggestions')} role="group" sx={{ gap: 1, mt: 2 }}>
            {SUGGESTIONS.map((key) => (
              <Chip
                key={key}
                variant="outlined"
                label={t(`ask.${key}`)}
                onClick={() => ask(t(`ask.${key}`))}
                disabled={busy}
                sx={{ height: 40, '&:hover': { bgcolor: 'background.neutral' } }}
              />
            ))}
          </Stack>

          {error && (
            <Alert
              severity="error"
              role="alert"
              sx={{ mt: 3 }}
              action={
                <Button color="inherit" onClick={() => ask(error.question)}>
                  {t('app.retry')}
                </Button>
              }
            >
              {t(error.key)}
            </Alert>
          )}

          <Box aria-live="polite" sx={{ mt: { xs: 2, md: 3 } }}>
            {busy && <AnswerSkeleton question={pending} />}
            {!turns.length && !busy && (
              <Typography color="text.secondary" sx={{ py: 4 }}>
                {t('ask.empty')}
              </Typography>
            )}
            {turns.map((turn, index) => (
              <Turn key={turn.id} turn={turn} latest={index === 0 && !busy} />
            ))}
            {turns.length > 0 && (
              <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 2 }}>
                {t('ask.description')}
              </Typography>
            )}
          </Box>
        </Box>
      </Container>
    </>
  );
}
