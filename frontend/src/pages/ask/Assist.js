import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import HttpService from '../../services/HttpService';
import { ListRow } from '../../components/detail-ui';
import { dayLabel, errorKey, money } from '../../utils/wallet';
import { reasonText } from '../plan/Method';

const go = (to, label) => (
  <Box>
    <Button component={RouterLink} to={to} variant="outlined">
      {label}
    </Button>
  </Box>
);

/** The goal the question described. Nothing exists until the person confirms it here. */
function GoalDraft({ draft }) {
  const { t, i18n } = useTranslation();
  const [state, setState] = useState({ status: 'idle', error: null });
  const create = async () => {
    setState({ status: 'saving', error: null });
    try {
      await HttpService.postWithAuth('/future/goals', {
        name: t('ask.assist.goalName', { amount: money(draft.targetAmount, i18n.language) }),
        monthlyAmount: draft.monthlyAmount,
        dayOfMonth: draft.dayOfMonth,
        targetAmount: draft.targetAmount,
        targetDate: draft.targetDate,
      });
      setState({ status: 'saved', error: null });
    } catch (failure) {
      setState({ status: 'idle', error: errorKey(failure) });
    }
  };
  if (state.status === 'saved')
    return (
      <Stack spacing={1.5}>
        <Alert severity="success">{t('ask.assist.goalCreated')}</Alert>
        {go('/future', t('ask.openFuture'))}
      </Stack>
    );
  return (
    <Stack spacing={1.5}>
      <Typography variant="body2" color={draft.fits ? 'text.secondary' : 'warning.main'}>
        {t(draft.fits ? 'ask.assist.goalFits' : 'ask.assist.goalDoesNotFit', { day: draft.dayOfMonth })}
      </Typography>
      {state.error && <Alert severity="error">{t(state.error)}</Alert>}
      <Box>
        <Button variant="contained" onClick={create} disabled={state.status === 'saving'}>
          {t('ask.assist.createGoal')}
        </Button>
      </Box>
      <Typography variant="caption" color="text.secondary">
        {t('ask.assist.confirmHelp')}
      </Typography>
    </Stack>
  );
}
GoalDraft.propTypes = { draft: PropTypes.object.isRequired };

/** What an assistant answer shows (ADR 0027): the same shape as the other answers of the screen. */
export function assistAnswer(answer, t, lang) {
  const assist = answer.assist || {};
  switch (answer.intent) {
    case 'PLAN_STATUS': {
      if (!assist.planSaved)
        return { sentence: t('ask.assist.noPlan'), actions: go('/plan', t('ask.assist.openPlan')) };
      const measured = (assist.slices || []).filter((slice) => slice.used !== null && slice.used !== undefined);
      const over = measured.filter((slice) => Number(slice.used) > Number(slice.amount));
      return {
        sentence: over.length
          ? t('ask.assist.over', { slices: over.map((slice) => slice.label).join(', ') })
          : t('ask.assist.within'),
        actions: (
          <Stack spacing={1.5}>
            <Box>
              {measured.map((slice) => (
                <ListRow
                  key={slice.position}
                  title={slice.label}
                  meta={t('ask.assist.used', {
                    used: money(slice.used, lang),
                    planned: money(slice.amount, lang),
                  })}
                />
              ))}
              {Number(assist.unclassified) > 0 && (
                <ListRow title={t('ask.assist.unclassified')} value={money(assist.unclassified, lang)} />
              )}
            </Box>
            {go('/plan', t('ask.assist.openPlan'))}
          </Stack>
        ),
      };
    }
    case 'METHOD': {
      const methods = assist.methods || [];
      return {
        sentence: t(methods.length ? 'ask.assist.methods' : 'ask.assist.noMethod'),
        actions: (
          <Stack spacing={1.5}>
            <Box>
              {methods.map((item) => (
                <ListRow
                  key={item.method}
                  title={t(`method.catalog.${item.method}.name`, { defaultValue: item.method })}
                  meta={item.reasons.map((reason) => reasonText(reason, t, lang)).join(' ')}
                />
              ))}
            </Box>
            {go('/plan/method', t('ask.assist.openMethod'))}
          </Stack>
        ),
      };
    }
    case 'REVIEW':
      return {
        sentence: assist.pendingReview
          ? t('ask.assist.pending', { count: assist.pendingReview })
          : t('ask.assist.nothingPending'),
        actions: assist.pendingReview ? go('/cash-flow/review', t('ask.assist.openReview')) : null,
      };
    case 'SAVE_GOAL': {
      const draft = assist.goal;
      if (!draft) return { sentence: t('ask.assist.goalNeedsMore') };
      return {
        label: t('ask.assist.monthly'),
        value: money(draft.monthlyAmount, lang),
        sentence: t('ask.assist.goalSentence', {
          amount: money(draft.targetAmount, lang),
          date: dayLabel(draft.targetDate, lang),
        }),
        actions: <GoalDraft draft={draft} />,
      };
    }
    default:
      return null;
  }
}
