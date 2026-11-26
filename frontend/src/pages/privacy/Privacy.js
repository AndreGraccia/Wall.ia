import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
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
import AuthService from '../../services/AuthService';
import HttpService from '../../services/HttpService';
import { PageHeading } from '../../components/wallet-ui';
import { Disclosure } from '../../components/detail-ui';
import { errorKey } from '../../utils/wallet';

// What the account keeps and why (LGPD art. 9), and the way out (art. 18). ADR 0012.
const STORED = ['account', 'wallets', 'openFinance', 'answers', 'alerts'];

/** A titled part of the page: divider on top, then the content. */
function Section({ id, title, children }) {
  return (
    <Box component="section" aria-labelledby={id}>
      <Typography id={id} variant="h6" component="h2" sx={{ mb: 1.5 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}
Section.propTypes = { id: PropTypes.string.isRequired, title: PropTypes.string.isRequired, children: PropTypes.node };

/** One right the person can use now: what it does in a line, the full text behind a disclosure, the button. */
function Action({ title, text, more, detail, button, children }) {
  return (
    <Box sx={{ py: 2, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} spacing={2}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" component="h3">
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {text}
          </Typography>
        </Box>
        <Box sx={{ flexShrink: 0 }}>{button}</Box>
      </Stack>
      <Disclosure label={more} sx={{ mt: 0.5 }}>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 640 }}>
          {detail}
        </Typography>
      </Disclosure>
      {children}
    </Box>
  );
}
Action.propTypes = {
  title: PropTypes.string.isRequired,
  text: PropTypes.string.isRequired,
  more: PropTypes.string.isRequired,
  detail: PropTypes.string.isRequired,
  button: PropTypes.node.isRequired,
  children: PropTypes.node,
};

export default function Privacy() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [state, setState] = useState({ busy: false, error: null });
  const [exporting, setExporting] = useState({ busy: false, error: null });

  // The export arrives as JSON and is saved as a file here, so the token never goes into a link.
  const download = async () => {
    setExporting({ busy: true, error: null });
    try {
      const data = await HttpService.getWithAuth('/account/export');
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `wallia-dados-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setExporting({ busy: false, error: null });
    } catch (failure) {
      setExporting({ busy: false, error: errorKey(failure) });
    }
  };

  const close = () => {
    setOpen(false);
    setPassword('');
    setState({ busy: false, error: null });
  };

  const remove = async (event) => {
    event.preventDefault();
    setState({ busy: true, error: null });
    try {
      await HttpService.postWithAuth('/account/delete', { password });
    } catch (failure) {
      setState({ busy: false, error: errorKey(failure) });
      return;
    }
    AuthService.logout();
    navigate('/login', { replace: true });
  };

  return (
    <>
      <Helmet>
        <title>{t('privacy.pageTitle')}</title>
      </Helmet>
      {/* Same container as every page, left-aligned; the reading measure stays at md. */}
      <Container maxWidth="lg">
        <PageHeading title={t('privacy.heading')} description={t('privacy.description')} />
        <Stack spacing={{ xs: 5, md: 6 }} sx={{ maxWidth: (theme) => theme.breakpoints.values.md }}>
          <Section id="privacy-stored" title={t('privacy.storedTitle')}>
            <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none', borderTop: '1px solid', borderColor: 'divider' }}>
              {STORED.map((item) => (
                <Typography
                  component="li"
                  variant="body2"
                  key={item}
                  sx={{
                    py: 1.75,
                    maxWidth: 720,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    '&:last-of-type': { borderBottom: 0 },
                  }}
                >
                  {t(`privacy.stored.${item}`)}
                </Typography>
              ))}
            </Box>
          </Section>

          <Section id="privacy-ai" title={t('privacy.aiTitle')}>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 640 }}>
              {t('privacy.ai')}
            </Typography>
          </Section>

          <Section id="privacy-of" title={t('privacy.openFinanceTitle')}>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 640 }}>
              {t('privacy.openFinance')}
            </Typography>
            <Button component={RouterLink} to="/open-finance" size="small" color="inherit" sx={{ mt: 1, ml: -1 }}>
              {t('privacy.openFinanceLink')}
            </Button>
          </Section>

          <Section id="privacy-rights" title={t('privacy.rightsTitle')}>
            <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
              <Action
                title={t('privacy.exportTitle')}
                text={t('privacy.exportShort')}
                more={t('privacy.exportMore')}
                detail={t('privacy.exportText')}
                button={
                  <Button variant="outlined" onClick={download} disabled={exporting.busy}>
                    {t('privacy.exportButton')}
                  </Button>
                }
              >
                {exporting.error && (
                  <Alert severity="error" role="alert" sx={{ mt: 1 }}>
                    {t(exporting.error)}
                  </Alert>
                )}
              </Action>
              <Action
                title={t('privacy.deleteTitle')}
                text={t('privacy.deleteShort')}
                more={t('privacy.deleteMore')}
                detail={t('privacy.deleteText')}
                button={
                  <Button color="error" variant="outlined" onClick={() => setOpen(true)}>
                    {t('privacy.deleteButton')}
                  </Button>
                }
              />
            </Box>
          </Section>
        </Stack>
      </Container>

      <Dialog
        open={open}
        onClose={state.busy ? undefined : close}
        fullWidth
        maxWidth="xs"
        aria-labelledby="delete-title"
      >
        <Box component="form" onSubmit={remove}>
          <DialogTitle id="delete-title">{t('privacy.dialogTitle')}</DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ mb: 2 }}>
              {t('privacy.dialogText')}
            </Typography>
            {state.error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {t(state.error)}
              </Alert>
            )}
            <TextField
              autoFocus
              fullWidth
              type="password"
              autoComplete="current-password"
              label={t('privacy.password')}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={close} disabled={state.busy}>
              {t('privacy.cancel')}
            </Button>
            <Button type="submit" color="error" variant="contained" disabled={!password || state.busy}>
              {t('privacy.confirm')}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </>
  );
}
