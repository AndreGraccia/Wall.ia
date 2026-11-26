import PropTypes from 'prop-types';
import { Link as RouterLink } from 'react-router-dom';
import { useId, useState } from 'react';
import { Box, Collapse, Link, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { dateTime, localeFor } from '../../utils/wallet';

/**
 * How old the Open Finance data under a screen is (B50, ADR 0020). The rule lives in the backend
 * (BankDataFreshness); every screen with bank data shows it here, before its numbers.
 * Nothing when there is no bank data; a caption when it is fresh; a one-line warning when it passed the limit.
 */
export default function BankDataNotice({ bankData, sx }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const id = useId();
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
  // One line (auditoria 26/11: three sentences pushed the hero number below the fold on a phone): when, and how to
  // fix it. The reason goes behind "Por quê?".
  const short = bankData.asOf
    ? t('bankData.staleShort', {
        date: new Intl.DateTimeFormat(localeFor(i18n.language), {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }).format(new Date(bankData.asOf)),
      })
    : t('bankData.neverSyncedShort');
  return (
    <Box role="alert" sx={{ pl: 1.5, borderLeft: '2px solid', borderColor: 'warning.main', ...sx }}>
      <Stack direction="row" alignItems="center" flexWrap="wrap" sx={{ columnGap: 1, typography: 'body2' }}>
        <Typography variant="body2" component="span" sx={{ color: 'warning.main', fontWeight: 500 }}>
          {short}
        </Typography>
        <span aria-hidden>·</span>
        <Link component={RouterLink} to="/open-finance" sx={{ color: 'text.primary' }}>
          {t('bankData.refresh')}
        </Link>
        <span aria-hidden>·</span>
        <Link component="button" type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={id}>
          {t('bankData.why')}
        </Link>
      </Stack>
      <Collapse in={open} timeout={150}>
        <Typography id={id} variant="body2" color="text.secondary" component="p" sx={{ m: 0, pt: 0.5, maxWidth: 640 }}>
          {t('bankData.staleTitle', { institution })}.{' '}
          {bankData.asOf ? t('bankData.stale', { date, hours: bankData.staleAfterHours }) : t('bankData.neverSynced')}
        </Typography>
      </Collapse>
    </Box>
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
