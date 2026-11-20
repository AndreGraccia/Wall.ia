import PropTypes from 'prop-types';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, AlertTitle, Button, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { dateTime } from '../../utils/wallet';

/**
 * How old the Open Finance data under a screen is (B50, ADR 0020). The rule lives in the backend
 * (BankDataFreshness); every screen with bank data shows it here, before its numbers.
 * Nothing when there is no bank data; a caption when it is fresh; a warning when it passed the limit.
 */
export default function BankDataNotice({ bankData, sx }) {
  const { t, i18n } = useTranslation();
  if (!bankData) return null;
  const institution = bankData.institution || t('bankData.unknownInstitution');
  const date = dateTime(bankData.asOf, i18n.language);
  if (!bankData.stale) {
    return (
      <Typography variant="caption" color="text.secondary" component="p" sx={sx}>
        {t('bankData.asOf', { institution, date })}
      </Typography>
    );
  }
  return (
    <Alert
      severity="warning"
      sx={sx}
      action={
        <Button component={RouterLink} to="/open-finance" color="inherit" size="small">
          {t('bankData.refresh')}
        </Button>
      }
    >
      <AlertTitle>{t('bankData.staleTitle', { institution })}</AlertTitle>
      {bankData.asOf ? t('bankData.stale', { date, hours: bankData.staleAfterHours }) : t('bankData.neverSynced')}
    </Alert>
  );
}

BankDataNotice.propTypes = {
  bankData: PropTypes.shape({
    institution: PropTypes.string,
    asOf: PropTypes.string,
    stale: PropTypes.bool.isRequired,
    staleAfterHours: PropTypes.number,
  }),
  sx: PropTypes.object,
};
