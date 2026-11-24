import PropTypes from 'prop-types';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Typography } from '@mui/material';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { WalliaLogo } from '../brand';

/**
 * A page outside the app shell (404, 401): the logo, the status code as the one big number, one sentence and
 * one way back. No illustration (DESIGN.md).
 */
export default function StatusPage({ code, pageTitle, title, description }) {
  const { t } = useTranslation();
  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
      </Helmet>
      <Box
        sx={{
          minHeight: '100dvh',
          display: 'grid',
          gridTemplateRows: 'auto 1fr',
          px: { xs: 2, sm: 4, md: 8 },
          py: { xs: 3, md: 4 },
        }}
      >
        <Box component={RouterLink} to="/" aria-label="Wall.ia" sx={{ justifySelf: 'start', color: 'text.primary' }}>
          <WalliaLogo size={22} />
        </Box>
        <Box component="main" sx={{ alignSelf: 'center', maxWidth: 520, py: 8 }}>
          <Typography
            aria-hidden="true"
            sx={{
              fontSize: { xs: 64, md: 96 },
              lineHeight: 1,
              fontWeight: 600,
              letterSpacing: '-0.035em',
              fontVariantNumeric: 'tabular-nums',
              color: 'text.disabled',
            }}
          >
            {code}
          </Typography>
          <Typography variant="h3" component="h1" sx={{ mt: 3 }}>
            {title}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            {description}
          </Typography>
          <Button component={RouterLink} to="/" variant="contained" sx={{ mt: 4 }}>
            {t('actions.goHome')}
          </Button>
        </Box>
      </Box>
    </>
  );
}
StatusPage.propTypes = {
  code: PropTypes.string.isRequired,
  pageTitle: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
};
