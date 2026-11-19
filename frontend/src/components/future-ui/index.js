import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  Stack,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import HttpService from '../../services/HttpService';
import { dayLabel, money, overdraftCostText } from '../../utils/wallet';
import { limitSummary } from '../../utils/forecast';

const LIMIT_KEYS = {
  canSpend: ['future.limit.canSpend', 'future.limit.canSpendHelp'],
  short: ['future.limit.short', 'future.limit.shortHelp'],
  shortEnvelopes: ['future.limit.shortEnvelopes', 'future.limit.shortEnvelopesHelp'],
};

// Interest in real payments, counted without the user; a failure here must never touch the flow.
const countPix = (step) => HttpService.postWithAuth('/future/pix-interest', { step }).catch(() => {});

// Certainty is always shown as text + line style, never colour alone:
// confirmed = solid, estimated = dashed, hypothetical = dotted.
// Anything not yet confirmed is also set in italics: it leans because it can still move.
const BORDER = { CONFIRMED: 'solid', ESTIMATED: 'dashed', HYPOTHETICAL: 'dotted' };
const COLOR = {
  CONFIRMED: 'certainty.confirmed',
  ESTIMATED: 'certainty.estimated',
  HYPOTHETICAL: 'certainty.hypothetical',
};

export function CertaintyChip({ certainty }) {
  const { t } = useTranslation();
  return (
    <Chip
      size="small"
      label={t(`future.certainty.${certainty}`)}
      variant="outlined"
      sx={{
        height: 22,
        fontSize: 11,
        color: COLOR[certainty],
        borderColor: COLOR[certainty],
        borderStyle: BORDER[certainty],
        fontStyle: certainty === 'CONFIRMED' ? 'normal' : 'italic',
        bgcolor: 'transparent',
      }}
    />
  );
}
/** What confirmed, estimated and simulated mean, always visible instead of hidden in tooltips. */
export function CertaintyLegend() {
  const { t } = useTranslation();
  return (
    <Box
      component="dl"
      sx={{ m: 0, mt: 1, display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 1.5, rowGap: 0.5 }}
    >
      {['CONFIRMED', 'ESTIMATED', 'HYPOTHETICAL'].map((certainty) => (
        <Box key={certainty} sx={{ display: 'contents' }}>
          <Box component="dt">
            <CertaintyChip certainty={certainty} />
          </Box>
          <Typography component="dd" variant="caption" color="text.secondary" sx={{ m: 0, alignSelf: 'center' }}>
            {t(`future.certaintyHelp.${certainty}`)}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

CertaintyChip.propTypes = { certainty: PropTypes.oneOf(['CONFIRMED', 'ESTIMATED', 'HYPOTHETICAL']).isRequired };

/** One expected movement with its provenance: when, what, from where, how sure, how much. */
export function EventRow({ event, dense = false }) {
  const { t, i18n } = useTranslation();
  const inflow = Number(event.amount) > 0;
  // Everyday spending arrives folded into one line; its reference carries how many days it covers.
  const days = Number(event.reference?.split(':')[1]) || 1;
  // Texts the engine writes come with a code; names and counterparties are data and stay as sent.
  let label = event.labelKey ? t(`future.labels.${event.labelKey}`, { defaultValue: event.label }) : event.label;
  const origin = event.originKey
    ? t(`future.origins.${event.originKey}`, { days: event.originDays, defaultValue: event.origin })
    : event.origin;
  if (event.category === 'DAILY_SPENDING') label = t('future.dailyEvent', { days });
  if (event.category === 'CARD_SPENDING') label = t('future.cardEvent', { days });
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={2}
      sx={{
        py: dense ? 1 : 1.5,
        borderBottom: '1px solid',
        borderColor: 'divider',
        '&:last-of-type': { borderBottom: 0 },
      }}
    >
      <Box sx={{ width: 52, flexShrink: 0 }}>
        <Typography variant="subtitle2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {dayLabel(event.date, i18n.language)}
        </Typography>
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" noWrap>
          {label}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap component="div">
          {t(`future.categories.${event.category}`, { defaultValue: event.category })}
          {origin ? ` · ${origin}` : ''}
        </Typography>
      </Box>
      <Stack alignItems="flex-end" spacing={0.5} sx={{ flexShrink: 0 }}>
        <Typography
          variant="subtitle2"
          sx={{ fontVariantNumeric: 'tabular-nums', color: inflow ? 'success.main' : 'text.primary' }}
        >
          {inflow ? '+ ' : '− '}
          {money(Math.abs(Number(event.amount)), i18n.language)}
        </Typography>
        <CertaintyChip certainty={event.certainty} />
      </Stack>
    </Stack>
  );
}
EventRow.propTypes = { event: PropTypes.object.isRequired, dense: PropTypes.bool };

export function StatBlock({ label, value, help, emphasis = false, negative = false, compact = false, children }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="overline" color="text.secondary">
        {label}
      </Typography>
      <Typography
        component="p"
        sx={{
          fontFamily: (theme) => theme.typography.h2.fontFamily,
          // compact: supporting numbers that must not compete with the daily limit above them.
          fontSize: compact ? { xs: 20, md: 22 } : { xs: 28, md: 32 },
          letterSpacing: '-0.03em',
          lineHeight: 1.15,
          fontVariantNumeric: 'tabular-nums',
          color: negative ? 'error.main' : 'text.primary',
          fontWeight: emphasis ? 800 : 700,
          overflowWrap: 'anywhere',
        }}
      >
        {value}
      </Typography>
      {help && (
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.5 }}>
          {help}
        </Typography>
      )}
      {children}
    </Box>
  );
}
StatBlock.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.node.isRequired,
  help: PropTypes.node,
  emphasis: PropTypes.bool,
  negative: PropTypes.bool,
  compact: PropTypes.bool,
  children: PropTypes.node,
};

/**
 * "Act on the future", simulated: the engine already knows who, how much and the new date of a moved bill,
 * so the Pix can be prepared from it. Nothing is sent; Wall.ia has no accreditation to start payments yet
 * (see docs/estrategia-produto.md). The dialog says so before and after the confirmation.
 */
function PixProposalDialog({ action, onClose }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [confirmed, setConfirmed] = useState(false);
  const close = () => {
    setConfirmed(false);
    onClose();
  };
  return (
    <Dialog open={Boolean(action)} onClose={close} fullWidth maxWidth="xs" aria-labelledby="pix-title">
      {action && (
        <>
          <DialogTitle id="pix-title">{t('future.pix.title')}</DialogTitle>
          <DialogContent>
            <Box
              component="dl"
              sx={{ m: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 1 }}
            >
              {[
                ['future.pix.to', action.label],
                ['future.pix.amount', money(action.amount, lang)],
                ['future.pix.date', dayLabel(action.to, lang)],
                ['future.pix.from', t('future.pix.fromValue')],
              ].map(([label, value]) => (
                <Box key={label} sx={{ display: 'contents' }}>
                  <Typography component="dt" variant="body2" color="text.secondary">
                    {t(label)}
                  </Typography>
                  <Typography component="dd" variant="body2" sx={{ m: 0, fontVariantNumeric: 'tabular-nums' }}>
                    {value}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Typography variant="body2" sx={{ mt: 2 }}>
              {t('future.pix.steps', { label: action.label, date: dayLabel(action.to, lang) })}
            </Typography>
            <Alert severity={confirmed ? 'success' : 'info'} sx={{ mt: 2 }} role="status">
              {confirmed ? t('future.pix.done', { date: dayLabel(action.to, lang) }) : t('future.pix.simulated')}
            </Alert>
          </DialogContent>
          <DialogActions>
            <Button onClick={close} autoFocus={confirmed}>
              {t(confirmed ? 'common.close' : 'future.pix.cancel')}
            </Button>
            {!confirmed && (
              <Button
                variant="contained"
                onClick={() => {
                  countPix('CONFIRM');
                  setConfirmed(true);
                }}
              >
                {t('future.pix.confirm')}
              </Button>
            )}
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}
PixProposalDialog.propTypes = { action: PropTypes.object, onClose: PropTypes.func.isRequired };

/** One line per calculated way out: what changes and what it gives. Shared by the card and the dialog. */
export function exitSentence(action, t, lang) {
  const result = action.solves
    ? t('future.exit.solves')
    : t('future.exit.lowest', { amount: money(action.resultingLowest, lang) });
  if (action.type === 'POSTPONE')
    return `${t('future.exit.POSTPONE', {
      label: action.label,
      amount: money(action.amount, lang),
      from: dayLabel(action.from, lang),
      to: dayLabel(action.to, lang),
    })} ${result}`;
  if (action.type === 'CUT_DAILY')
    return `${t('future.exit.CUT_DAILY', {
      amount: money(action.amount, lang),
      daily: money(action.newDaily, lang),
      to: dayLabel(action.to, lang),
    })} ${result}`;
  return t('future.exit.GAP', { amount: money(action.amount, lang), to: dayLabel(action.to, lang) });
}

/**
 * Calculated ways out of the first negative window. Each line says what changes and what it gives;
 * the Wall.ia never acts for the user.
 */
export function ExitPlanList({ actions }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [pix, setPix] = useState(null);
  if (!actions?.length) return null;
  return (
    <Box component="section" aria-labelledby="exit-title" sx={{ mt: 2 }}>
      <Typography id="exit-title" variant="subtitle2" component="h3">
        {t('future.exit.title')}
      </Typography>
      <Box component="ol" sx={{ m: 0, mt: 1, pl: 2.5 }}>
        {actions.map((action) => (
          <Typography component="li" variant="body2" key={`${action.type}-${action.label || ''}`} sx={{ py: 0.5 }}>
            {exitSentence(action, t, lang)}
            {/* Only a moved bill has a payee, an amount and a date to pay on. */}
            {action.type === 'POSTPONE' && (
              <Button
                size="small"
                onClick={() => {
                  countPix('PREPARE');
                  setPix(action);
                }}
                sx={{ ml: 1, py: 0 }}
              >
                {t('future.pix.prepare')}
              </Button>
            )}
          </Typography>
        ))}
      </Box>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
        {t('future.exit.note')}
      </Typography>
      <PixProposalDialog action={pix} onClose={() => setPix(null)} />
    </Box>
  );
}
ExitPlanList.propTypes = { actions: PropTypes.array };

/**
 * The first thing the Future page answers: how much can be spent per day until the next income, or how
 * much is missing. It also carries the first negative window (so the page never shows three different
 * negative numbers for one question), the best way out and the alert switch.
 *
 * Two shortfalls can differ and both are true: the limit keeps the envelopes out, the bank does not.
 * With envelopes, "missing" is split into what the bank balance lacks and what keeping the envelopes costs.
 */
export function DailyLimitCard({ limit, risk, laterRisks = [], exitPlan = [], onWhy, children }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const summary = limitSummary(limit);
  const { reserved, withEnvelopes } = summary;
  const short = summary.kind !== 'canSpend';
  const over = limit.margin !== null && limit.margin !== undefined && Number(limit.margin) < 0;
  const binding = dayLabel(limit.bindingDate, lang);
  const tone = short || over ? 'warning' : 'success';
  const firstWay = (short || over) && exitPlan.length ? exitPlan[0] : null;

  const [headlineKey, helpKey] = LIMIT_KEYS[summary.kind];
  const headline = t(headlineKey, { amount: money(summary.amount, lang) });
  const help = t(helpKey, { binding, reserved: money(reserved, lang) });

  let pace = t('future.limit.paceUnknown');
  if (limit.pace !== null && limit.pace !== undefined) {
    if (short && risk)
      pace = t('future.limit.shortPaceLowest', {
        pace: money(limit.pace, lang),
        amount: money(risk.lowestBalance, lang),
        date: dayLabel(risk.lowestDate, lang),
      });
    else if (short) pace = t('future.limit.shortPace', { pace: money(limit.pace, lang) });
    else if (over)
      pace = t('future.limit.paceOver', {
        pace: money(limit.pace, lang),
        cut: money(Math.abs(Number(limit.margin)), lang),
      });
    else pace = t('future.limit.paceOk', { pace: money(limit.pace, lang), margin: money(limit.margin, lang) });
  }

  return (
    <Card
      component="section"
      aria-labelledby="daily-limit-title"
      sx={{
        p: { xs: 3, md: 4 },
        borderLeft: '4px solid',
        borderColor: `${tone}.main`,
      }}
    >
      <Typography variant="overline" color="text.secondary">
        {limit.untilIncome
          ? t('future.limit.until', { date: dayLabel(limit.until, lang) })
          : t('future.limit.untilNoIncome', { days: limit.days })}
      </Typography>
      <Typography
        id="daily-limit-title"
        component="h2"
        sx={{
          fontFamily: (theme) => theme.typography.h2.fontFamily,
          fontWeight: 700,
          fontSize: { xs: 26, md: 34 },
          letterSpacing: '-0.03em',
          lineHeight: 1.15,
          fontVariantNumeric: 'tabular-nums',
          mt: 0.5,
          color: short ? 'warning.main' : 'text.primary',
        }}
      >
        {headline}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        {help}
      </Typography>
      <Typography variant="body2" sx={{ mt: 1.5 }}>
        {pace}
      </Typography>
      {summary.kind === 'short' && reserved > 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {t('future.limit.keepEnvelopes', { amount: money(withEnvelopes, lang), reserved: money(reserved, lang) })}
        </Typography>
      )}
      {!short && reserved > 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {t('future.limit.reserved', { amount: money(reserved, lang) })}{' '}
          <Link component={RouterLink} to="/envelopes">
            {t('future.limit.reservedLink')}
          </Link>
        </Typography>
      )}
      {risk && Number(risk.overdraftCostCap) > 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {overdraftCostText(t, risk, lang)}
        </Typography>
      )}
      {firstWay && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="overline" color="text.secondary" component="p">
            {t('future.limit.bestWay')}
          </Typography>
          <Typography variant="body1">{exitSentence(firstWay, t, lang)}</Typography>
        </Box>
      )}
      {laterRisks.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {t('future.limit.laterRisks')}
          </Typography>
          <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
            {laterRisks.map((later) => (
              <Typography component="li" variant="body2" key={later.start}>
                {t('future.limit.laterRisk', {
                  start: dayLabel(later.start, lang),
                  end: dayLabel(later.end, lang),
                  amount: money(later.lowestBalance, lang),
                })}
              </Typography>
            ))}
          </Box>
        </Box>
      )}
      <Stack direction="row" flexWrap="wrap" sx={{ mt: 2.5, gap: 1 }}>
        {/* One primary action: the way out comes right after the problem. */}
        {risk && onWhy && (
          <Button
            variant="contained"
            onClick={() => onWhy(risk)}
            aria-label={t('future.whyLabel', { start: dayLabel(risk.start, lang), end: dayLabel(risk.end, lang) })}
          >
            {t('future.limit.seeWayOut')}
          </Button>
        )}
        <Button component={RouterLink} to="/ask" color="inherit">
          {t('future.limit.ask')}
        </Button>
      </Stack>
      {children && <Box sx={{ mt: 2.5, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>{children}</Box>}
    </Card>
  );
}
DailyLimitCard.propTypes = {
  limit: PropTypes.object.isRequired,
  risk: PropTypes.object,
  laterRisks: PropTypes.array,
  exitPlan: PropTypes.array,
  onWhy: PropTypes.func,
  children: PropTypes.node,
};
