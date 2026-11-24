import { useRef, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Card, Container, Stack, TextField } from '@mui/material';
import { LoadingButton } from '@mui/lab';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { enqueueSnackbar } from 'notistack';
import { useWallets } from '../../context/WalletContext';
import { PageHeading, WalletIcon } from '../../components/wallet-ui';
import AuthService from '../../services/AuthService';
import HttpService from '../../services/HttpService';
import { errorKey } from '../../utils/wallet';

export default function NewWallet() {
  const { t } = useTranslation();
  const { refresh } = useWallets();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const short = error === 'app.nameHelp';
  const submit = async (event) => {
    event.preventDefault();
    if (sending.current) return;
    if (name.trim().length < 3) {
      setError('app.nameHelp');
      return;
    }
    sending.current = true;
    setBusy(true);
    setError(null);
    try {
      const response = await HttpService.postWithAuth('/wallets', {
        name: name.trim(),
        balance: '0.00',
        userId: AuthService.getCurrentUser()?.id,
      });
      await refresh();
      enqueueSnackbar(t('wallet.create.success'), { variant: 'success' });
      navigate(`/wallets/${response.id}`);
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
      sending.current = false;
    }
  };
  return (
    <>
      <Helmet>
        <title>{t('wallet.create.pageTitle')}</title>
      </Helmet>
      <Container maxWidth="lg">
        {/* Left-aligned like every other page; the form keeps a readable width. */}
        <Box sx={{ maxWidth: 560 }}>
        <Button
          component={RouterLink}
          to="/wallets"
          startIcon={<WalletIcon name="back" />}
          sx={{ ml: -1.5, mb: 1, color: 'text.secondary' }}
        >
          {t('navigation.wallets')}
        </Button>
        <PageHeading title={t('wallet.newWallet')} description={t('app.newWalletHelp')} />
        {/* A form is an interactive group: the one place a panel is allowed (DESIGN.md). */}
        <Card component="form" onSubmit={submit} noValidate sx={{ p: { xs: 3, sm: 4 } }}>
          <Stack spacing={3}>
            {error && !short && <Alert severity="error">{t(error)}</Alert>}
            <TextField
              label={t('wallet.create.name')}
              placeholder={t('wallet.create.namePlaceholder')}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (short) setError(null);
              }}
              required
              autoFocus
              error={short}
              inputProps={{ minLength: 3, maxLength: 50 }}
              helperText={t('app.nameHelp')}
            />
            <Box sx={{ typography: 'body2', color: 'text.secondary' }}>{t('app.zeroBalanceHelp')}</Box>
            <LoadingButton type="submit" variant="contained" loading={busy} sx={{ alignSelf: { sm: 'flex-start' } }}>
              {t('wallet.create.save')}
            </LoadingButton>
          </Stack>
        </Card>
        </Box>
      </Container>
    </>
  );
}
