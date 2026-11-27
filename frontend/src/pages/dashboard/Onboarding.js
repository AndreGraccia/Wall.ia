import PropTypes from 'prop-types';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, ButtonBase, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { enqueueSnackbar } from 'notistack';
import { WalletIcon } from '../../components/wallet-ui';
import { setOnboardingDismissed, useOnboardingDismissed } from '../../utils/onboarding';

/** Each step is read from what Início already loads; nothing is ticked by hand. */
export function onboardingSteps({ sources, plan, profile, goals }) {
  const connected = sources.accounts > 0 || sources.cards > 0 || sources.loans > 0;
  return [
    { id: 'data', done: connected, to: '/open-finance' },
    { id: 'income', done: Boolean(plan.income), to: '/future' },
    // With no data there is nothing to ask yet: zero pending questions is not "answered".
    { id: 'questions', done: connected && sources.pendingQuestions === 0, to: '/future' },
    { id: 'method', done: Boolean(profile.method), to: '/plan/method' },
    { id: 'goal', done: goals.length > 0, to: '/future' },
  ];
}

const row = { width: '100%', minHeight: 56, py: 1, gap: 2, justifyContent: 'flex-start', textAlign: 'left' };

/**
 * First steps on Início. It never shows an error: while a source is missing (loading or failed) it stays out, and
 * the blocks that own that data report it. It leaves once every step is done or the person dismisses it; the account
 * menu brings it back.
 */
export default function Onboarding({ userId, sources, plan, profile, goals }) {
  const { t } = useTranslation();
  const dismissed = useOnboardingDismissed(userId);
  if (dismissed || !sources || !plan.data || !profile.data || !Array.isArray(goals.data)) return null;
  const steps = onboardingSteps({ sources, plan: plan.data, profile: profile.data, goals: goals.data });
  const done = steps.filter((step) => step.done).length;
  if (done === steps.length) return null;

  return (
    <Box component="section" aria-labelledby="dashboard-onboarding">
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ gap: 1, mb: 1 }}>
        <Box>
          <Typography id="dashboard-onboarding" variant="h6" component="h2">
            {t('onboarding.title')}
          </Typography>
          <Typography variant="caption" color="text.secondary" component="p" sx={{ m: 0 }}>
            {t('onboarding.progress', { done, total: steps.length })}
          </Typography>
        </Box>
        <Button
          size="small"
          onClick={() => {
            setOnboardingDismissed(userId, true);
            enqueueSnackbar(t('onboarding.dismissed'));
          }}
        >
          {t('onboarding.dismiss')}
        </Button>
      </Stack>
      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, borderTop: '1px solid', borderColor: 'divider' }}>
        {steps.map((step) => {
          const content = (
            <>
              <WalletIcon
                name={step.done ? 'check' : 'arrow'}
                aria-hidden
                sx={{ fontSize: 20, color: step.done ? 'success.main' : 'text.secondary' }}
              />
              <Box component="span" sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  component="span"
                  variant="subtitle2"
                  sx={{ display: 'block', color: step.done ? 'text.secondary' : 'text.primary' }}
                >
                  {t(`onboarding.steps.${step.id}.title`)}
                </Typography>
                <Typography component="span" variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {step.done ? t('onboarding.done') : t(`onboarding.steps.${step.id}.help`)}
                </Typography>
              </Box>
            </>
          );
          return (
            <Box component="li" key={step.id} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
              {step.done ? (
                <Stack direction="row" alignItems="center" sx={row}>
                  {content}
                </Stack>
              ) : (
                <ButtonBase
                  component={RouterLink}
                  to={step.to}
                  sx={{
                    ...row,
                    borderRadius: '12px',
                    '&:hover': { bgcolor: 'background.neutral' },
                    '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'secondary.main', outlineOffset: -2 },
                  }}
                >
                  {content}
                </ButtonBase>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
Onboarding.propTypes = {
  userId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  sources: PropTypes.object,
  plan: PropTypes.object.isRequired,
  profile: PropTypes.object.isRequired,
  goals: PropTypes.object.isRequired,
};
