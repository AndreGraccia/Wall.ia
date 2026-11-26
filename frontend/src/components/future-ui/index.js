import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { WalletIcon } from '../wallet-ui';
import HttpService from '../../services/HttpService';
import { dayLabel, money, overdraftCostText } from '../../utils/wallet';
import { limitSummary } from '../../utils/forecast';
import { HIDDEN_AMOUNT } from '../../utils/hiddenAmounts';

// Lead, tail and the "why" sentence of the hero, per kind of answer.
const LIMIT_KEYS = {
  canSpend: ['future.hero.canSpendLead', 'future.hero.canSpendTail', 'future.limit.canSpendHelp'],
  short: ['future.hero.shortLead', 'future.hero.shortTail', 'future.limit.shortHelp'],
  shortEnvelopes: ['future.hero.shortEnvelopesLead', 'future.hero.shortTail', 'future.limit.shortEnvelopesHelp'],
};

// Interest in real payments, counted without the user; a failure here must never touch the flow.
const countPix = (step) => HttpService.postWithAuth('/future/pix-interest', { step }).catch(() => {});

// Certainty is always text + line style, never colour alone (DESIGN.md): confirmed = plain seal,
// estimated = `future` seal in italics, simulated = dotted outline in italics. Anything not yet confirmed
// leans because it can still move.
export function CertaintyChip({ certainty }) {
  const { t } = useTranslation();
  const estimated = certainty === 'ESTIMATED';
  const simulated = certainty === 'HYPOTHETICAL';
  return (
    <Chip
      size="small"
      label={t(`future.certainty.${certainty}`)}
      sx={{
        fontStyle: certainty === 'CONFIRMED' ? 'normal' : 'italic',
        color: estimated ? 'certainty.estimated' : 'text.secondary',
        bgcolor: (theme) => {
          if (estimated) return alpha(theme.palette.certainty.estimated, 0.14);
          return simulated ? 'transparent' : 'background.neutral';
        },
        border: simulated ? '1px dotted' : 0,
        borderColor: 'text.secondary',
      }}
    />
  );
}
CertaintyChip.propTypes = { certainty: PropTypes.oneOf(['CONFIRMED', 'ESTIMATED', 'HYPOTHETICAL']).isRequired };

/** One expected movement with its provenance: when, what, from where, how sure, how much. A 56 px row. */
export function EventRow({ event, dense = false, hideAmount = false }) {
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
        minHeight: dense ? 52 : 56,
        py: 1,
        borderBottom: '1px solid',
        borderColor: 'divider',
        '&:last-of-type': { borderBottom: 0 },
      }}
    >
      <Typography variant="body2" color="text.secondary" sx={{ width: 44, flexShrink: 0 }}>
        {dayLabel(event.date, i18n.language)}
      </Typography>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="subtitle2" noWrap>
          {label}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap component="div">
          {t(`future.categories.${event.category?.startsWith('PLAN_') ? 'PLAN' : event.category}`, {
            defaultValue: event.category,
          })}
          {origin ? `, ${origin}` : ''}
        </Typography>
      </Box>
      <Stack alignItems="flex-end" spacing={0.5} sx={{ flexShrink: 0 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: inflow ? 'success.main' : 'text.primary' }}>
          {inflow ? '+ ' : '− '}
          {hideAmount ? HIDDEN_AMOUNT : money(Math.abs(Number(event.amount)), i18n.language)}
        </Typography>
        <CertaintyChip certainty={event.certainty} />
      </Stack>
    </Stack>
  );
}
EventRow.propTypes = { event: PropTypes.object.isRequired, dense: PropTypes.bool, hideAmount: PropTypes.bool };

/**
 * A labelled number. `help` stays on screen under the number; `tooltip` moves the explanation behind an
 * info button, for screens where the number has to stand alone (DESIGN.md: less text on screen).
 */
export function StatBlock({
  label,
  value,
  help,
  tooltip,
  emphasis = false,
  negative = false,
  compact = false,
  children,
}) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ minHeight: 24 }}>
        <Typography variant="body2" color="text.secondary" component="p">
          {label}
        </Typography>
        {tooltip && (
          <Tooltip title={tooltip}>
            <IconButton size="small" sx={{ minWidth: 28, minHeight: 28, p: 0.5, color: 'text.disabled' }}>
              <WalletIcon name="info" sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
      <Typography
        component="p"
        variant={compact ? 'h4' : 'h3'}
        sx={{
          mt: 0.5,
          color: negative ? 'error.main' : 'text.primary',
          fontWeight: emphasis ? 600 : 500,
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
  tooltip: PropTypes.node,
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
 * The answer people open the Future page for, as one sentence around the hero number: how much can be
 * spent per day until the next income, or how much is missing. Everything that explains it sits behind
 * "Por quê?" (kept mounted, so it is in the document even while closed).
 *
 * Two shortfalls can differ and both are true: the limit keeps the envelopes out, the bank does not.
 * With envelopes, "missing" is split into what the bank balance lacks and what keeping the envelopes costs.
 */
export function DailyLimitCard({ limit, risk, exitPlan = [], onWhy, compact = false, action, hideAmount = false }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [whyOpen, setWhyOpen] = useState(false);
  const summary = limitSummary(limit);
  const { reserved, withEnvelopes } = summary;
  const short = summary.kind !== 'canSpend';
  const over = limit.margin !== null && limit.margin !== undefined && Number(limit.margin) < 0;
  const binding = dayLabel(limit.bindingDate, lang);
  const firstWay = (short || over) && exitPlan.length ? exitPlan[0] : null;

  const [leadKey, tailKey, helpKey] = LIMIT_KEYS[summary.kind];
  const tail = limit.untilIncome
    ? t(tailKey, { date: dayLabel(limit.until, lang) })
    : t(`${tailKey}Days`, { days: limit.days });
  let tone = 'text.primary';
  if (summary.kind === 'short') tone = 'error.main';
  if (summary.kind === 'shortEnvelopes') tone = 'warning.main';

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
    <Box component="section" aria-labelledby="daily-limit-title">
      <Typography id="daily-limit-title" component="h2" sx={{ m: 0 }}>
        <Typography
          component="span"
          variant={compact ? 'body1' : 'h6'}
          color="text.secondary"
          sx={{ display: 'block', fontWeight: 400 }}
        >
          {t(leadKey)}
        </Typography>
        <Typography
          component="span"
          variant={compact ? 'h2' : 'h1'}
          sx={{ display: 'block', color: tone, my: compact ? 0.5 : 1 }}
        >
          {hideAmount ? HIDDEN_AMOUNT : money(summary.amount, lang)}
          {!short && (
            <Typography
              component="span"
              variant={compact ? 'h5' : 'h4'}
              color="text.secondary"
              sx={{ ml: 1, fontWeight: 500 }}
            >
              {t('future.hero.perDay')}
            </Typography>
          )}
        </Typography>
        <Typography component="span" variant={compact ? 'body1' : 'h6'} sx={{ display: 'block', fontWeight: 400 }}>
          {tail}
        </Typography>
      </Typography>
      {!compact && (
        <Typography color="text.secondary" sx={{ mt: 2, maxWidth: 640 }}>
          {pace}
        </Typography>
      )}
      <Stack direction="row" flexWrap="wrap" alignItems="center" sx={{ mt: compact ? 2 : 3, gap: 1 }}>
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
        {action}
        {!compact && (
          <Button onClick={() => setWhyOpen(!whyOpen)} aria-expanded={whyOpen} aria-controls="daily-limit-why">
            {t('future.hero.why')}
          </Button>
        )}
      </Stack>
      {!compact && (
        <Collapse in={whyOpen} timeout={150}>
          <Stack
            id="daily-limit-why"
            spacing={1}
            sx={{ mt: 2, pl: 2, maxWidth: 640, borderLeft: '2px solid', borderColor: 'divider' }}
          >
            <Typography variant="body2" color="text.secondary">
              {t(helpKey, { binding, reserved: money(reserved, lang) })}
            </Typography>
            {summary.kind === 'short' && reserved > 0 && (
              <Typography variant="body2" color="text.secondary">
                {t('future.limit.keepEnvelopes', {
                  amount: money(withEnvelopes, lang),
                  reserved: money(reserved, lang),
                })}
              </Typography>
            )}
            {!short && reserved > 0 && (
              <Typography variant="body2" color="text.secondary">
                {t('future.limit.reserved', { amount: money(reserved, lang) })}{' '}
                <Link component={RouterLink} to="/envelopes">
                  {t('future.limit.reservedLink')}
                </Link>
              </Typography>
            )}
            {risk && Number(risk.overdraftCostCap) > 0 && (
              <Typography variant="body2" color="text.secondary">
                {overdraftCostText(t, risk, lang)}
              </Typography>
            )}
            {firstWay && (
              <Typography variant="body2" color="text.secondary">
                <Box component="span" sx={{ color: 'text.primary', fontWeight: 500 }}>
                  {t('future.limit.bestWay')}:
                </Box>{' '}
                {exitSentence(firstWay, t, lang)}
              </Typography>
            )}
          </Stack>
        </Collapse>
      )}
    </Box>
  );
}
DailyLimitCard.propTypes = {
  hideAmount: PropTypes.bool,
  limit: PropTypes.object.isRequired,
  risk: PropTypes.object,
  exitPlan: PropTypes.array,
  onWhy: PropTypes.func,
  compact: PropTypes.bool,
  action: PropTypes.node,
};
