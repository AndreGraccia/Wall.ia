import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Container,
  Grid,
  Link,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { LoadingButton } from '@mui/lab';
import { alpha } from '@mui/material/styles';
import { Helmet } from 'react-helmet-async';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { PageHeading, WalletIcon } from '../../components/wallet-ui';
import HttpService from '../../services/HttpService';
import BankDataNotice from '../../components/bank-data';
import { dateTime, errorKey, monthLabel, money, projectRegularDeposits } from '../../utils/wallet';

const PERIODS = [1, 3, 6, 12];

function CitationLinks({ ids, references }) {
  if (!ids?.length) return null;
  return (
    <Stack direction="row" spacing={0.75} sx={{ mt: 1.5, flexWrap: 'wrap', gap: 0.75 }}>
      {ids.map((id) => {
        const index = references.findIndex((reference) => reference.id === id);
        const reference = references[index];
        if (!reference) return null;
        return (
          <Chip
            key={id}
            component="a"
            href={`#reference-${id}`}
            clickable
            size="small"
            label={`[${index + 1}] ${reference.author}`}
            sx={{ fontSize: '0.72rem' }}
          />
        );
      })}
    </Stack>
  );
}

CitationLinks.propTypes = {
  ids: PropTypes.arrayOf(PropTypes.string),
  references: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default function Insights() {
  const { t, i18n } = useTranslation();
  const [months, setMonths] = useState(3);
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [monthlyContribution, setMonthlyContribution] = useState('');
  const [years, setYears] = useState(5);
  const [annualRate, setAnnualRate] = useState('8');

  const maxFlow = useMemo(() => {
    if (!report) return 1;
    return Math.max(1, ...report.monthlyFlow.flatMap((item) => [Number(item.inflow), Number(item.outflow)]));
  }, [report]);

  const opportunity = useMemo(
    () => projectRegularDeposits(monthlyContribution, years, annualRate),
    [annualRate, monthlyContribution, years]
  );

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await HttpService.postWithAuth('/insights/reports', {
        months,
        language: i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'pt-BR',
      });
      setReport(response);
      const monthlyAverage = Number(response.metrics.outflow) / Math.max(response.periodMonths, 1);
      setMonthlyContribution((monthlyAverage * 0.1).toFixed(2));
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };

  // "2026-09" is a calendar month: built as a local date so UTC-3 does not turn it into August.
  const formatMonth = (value) => monthLabel(value, i18n.language, { month: 'short', year: '2-digit' });

  return (
    <>
      <Helmet>
        <title>{t('insights.pageTitle')}</title>
      </Helmet>
      <Container maxWidth="lg">
        <PageHeading title={t('insights.heading')} description={t('insights.description')} />

        <Card sx={{ p: { xs: 2.5, sm: 3 }, mb: 3 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
            <TextField
              select
              label={t('insights.period')}
              value={months}
              onChange={(event) => setMonths(Number(event.target.value))}
              sx={{ minWidth: 190 }}
            >
              {PERIODS.map((period) => (
                <MenuItem key={period} value={period}>
                  {t('insights.months', { count: period })}
                </MenuItem>
              ))}
            </TextField>
            <LoadingButton
              loading={busy}
              onClick={generate}
              variant="contained"
              startIcon={<WalletIcon name="insights" />}
            >
              {report ? t('insights.refresh') : t('insights.generate')}
            </LoadingButton>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ ml: { sm: 'auto !important' } }}>
              <WalletIcon name="shield" sx={{ color: 'success.main', fontSize: 20 }} />
              <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 330 }}>
                {t('insights.aggregateOnly')}
              </Typography>
            </Stack>
          </Stack>
        </Card>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} action={<Button onClick={generate}>{t('app.retry')}</Button>}>
            {t(error)}
          </Alert>
        )}

        {!report && !error && (
          <Card sx={{ p: { xs: 4, sm: 7 }, textAlign: 'center' }}>
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '20px',
                display: 'grid',
                placeItems: 'center',
                mx: 'auto',
                mb: 2.5,
                color: 'primary.main',
                bgcolor: 'background.raised',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <WalletIcon name="insights" sx={{ fontSize: 30 }} />
            </Box>
            <Typography variant="h5">{t('insights.emptyTitle')}</Typography>
            <Typography color="text.secondary" sx={{ mt: 1, mx: 'auto', maxWidth: 560 }}>
              {t('insights.emptyDescription')}
            </Typography>
          </Card>
        )}

        {report && (
          <Stack spacing={3}>
            {/* The totals are only as fresh as the bank data under them (B50). */}
            <BankDataNotice bankData={report.bankData} />
            <Card
              sx={{
                p: { xs: 3, md: 4 },
                background: (theme) =>
                  `radial-gradient(120% 120% at 100% 0%, ${alpha(
                    theme.palette.brand.horizon,
                    0.14
                  )} 0%, transparent 50%), ${theme.palette.background.paper}`,
              }}
            >
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2}>
                <Box>
                  <Chip
                    size="small"
                    label={t(`insights.provider.${report.provider}`)}
                    sx={{ mb: 2, bgcolor: 'background.raised' }}
                  />
                  <Typography variant="h4">{report.headline}</Typography>
                  <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 700 }}>
                    {report.summary}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                  {t('insights.generatedAt', {
                    date: dateTime(report.generatedAt, i18n.language),
                  })}
                </Typography>
              </Stack>
            </Card>

            <Grid container spacing={2}>
              {[
                ['inflow', report.metrics.inflow, 'success.main'],
                ['outflow', report.metrics.outflow, 'text.primary'],
                [
                  'netFlow',
                  report.metrics.netFlow,
                  Number(report.metrics.netFlow) >= 0 ? 'success.main' : 'error.main',
                ],
                ['transactionCount', report.metrics.transactionCount, 'text.primary'],
              ].map(([key, value, color]) => (
                <Grid item xs={6} md={3} key={key}>
                  <Card sx={{ p: 2.5, height: '100%' }}>
                    <Typography variant="caption" color="text.secondary">
                      {t(`insights.metrics.${key}`)}
                    </Typography>
                    <Typography variant="h5" sx={{ mt: 1, color, overflowWrap: 'anywhere' }}>
                      {key === 'transactionCount' ? value : money(value, i18n.language)}
                    </Typography>
                  </Card>
                </Grid>
              ))}
            </Grid>

            <Grid container spacing={3}>
              <Grid item xs={12} md={7}>
                <Card sx={{ p: 3, height: '100%' }}>
                  <Typography variant="h6">{t('insights.cashFlow')}</Typography>
                  <Stack spacing={2.5} sx={{ mt: 3 }}>
                    {report.monthlyFlow.map((flow) => (
                      <Box key={flow.month}>
                        <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.75 }}>
                          <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                            {formatMonth(flow.month)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {money(flow.inflow, i18n.language)} / {money(flow.outflow, i18n.language)}
                          </Typography>
                        </Stack>
                        <Stack spacing={0.5}>
                          <Box
                            sx={{
                              height: 7,
                              width: `${(Number(flow.inflow) / maxFlow) * 100}%`,
                              bgcolor: 'success.main',
                              borderRadius: 4,
                            }}
                          />
                          <Box
                            sx={{
                              height: 7,
                              width: `${(Number(flow.outflow) / maxFlow) * 100}%`,
                              bgcolor: 'warning.main',
                              borderRadius: 4,
                            }}
                          />
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                  <Stack direction="row" spacing={2} sx={{ mt: 2.5 }}>
                    {[
                      ['success.main', 'insights.metrics.inflow'],
                      ['warning.main', 'insights.metrics.outflow'],
                    ].map(([color, label]) => (
                      <Stack key={label} direction="row" spacing={0.75} alignItems="center">
                        {/* Same colour as the bars above: the swatch is the legend. */}
                        <Box aria-hidden="true" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color }} />
                        <Typography variant="caption" color="text.secondary">
                          {t(label)}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Card>
              </Grid>
              <Grid item xs={12} md={5}>
                <Card sx={{ p: 3, height: '100%' }}>
                  <Typography variant="h6">{t('insights.observations')}</Typography>
                  <Stack spacing={2.5} sx={{ mt: 2.5 }}>
                    {report.observations.map((item, index) => (
                      <Box key={`${item.title}-${index}`}>
                        <Typography variant="subtitle2">{item.title}</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {item.body}
                        </Typography>
                        <CitationLinks ids={item.citationIds} references={report.references} />
                      </Box>
                    ))}
                  </Stack>
                </Card>
              </Grid>
            </Grid>

            <Card sx={{ p: 3 }}>
              <Typography variant="h6">{t('insights.actions')}</Typography>
              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                {report.recommendedActions.map((item, index) => (
                  <Grid item xs={12} md={6} key={`${item.title}-${index}`}>
                    <Box sx={{ p: 2.5, height: '100%', borderRadius: '18px', bgcolor: 'background.neutral' }}>
                      <Typography variant="subtitle2">{item.title}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                        {item.body}
                      </Typography>
                      <CitationLinks ids={item.citationIds} references={report.references} />
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Card>

            <Card sx={{ p: { xs: 3, md: 4 } }}>
              <Grid container spacing={4} alignItems="center">
                <Grid item xs={12} md={6}>
                  <Typography variant="overline" color="primary.main">
                    {t('insights.opportunity.eyebrow')}
                  </Typography>
                  <Typography variant="h4" sx={{ mt: 0.5 }}>
                    {t('insights.opportunity.title')}
                  </Typography>
                  <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
                    {t('insights.opportunity.description')}
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        fullWidth
                        type="number"
                        label={t('insights.opportunity.monthlyAmount')}
                        value={monthlyContribution}
                        onChange={(event) => setMonthlyContribution(event.target.value)}
                        inputProps={{ min: 0, max: 1000000, step: '0.01' }}
                      />
                    </Grid>
                    <Grid item xs={6} sm={4}>
                      <TextField
                        fullWidth
                        select
                        label={t('insights.opportunity.term')}
                        value={years}
                        onChange={(event) => setYears(Number(event.target.value))}
                      >
                        {[1, 3, 5, 10, 20].map((value) => (
                          <MenuItem value={value} key={value}>
                            {t('insights.opportunity.years', { count: value })}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    <Grid item xs={6} sm={4}>
                      <TextField
                        fullWidth
                        type="number"
                        label={t('insights.opportunity.annualRate')}
                        value={annualRate}
                        onChange={(event) => setAnnualRate(event.target.value)}
                        inputProps={{ min: 0, max: 100, step: '0.1' }}
                      />
                    </Grid>
                  </Grid>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
                    {t('insights.opportunity.suggestion')}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Box sx={{ p: { xs: 3, sm: 4 }, borderRadius: '20px', bgcolor: 'background.neutral' }}>
                    <Typography variant="body2" color="text.secondary">
                      {t('insights.opportunity.estimatedValue')}
                    </Typography>
                    <Typography variant="h3" sx={{ mt: 1, color: 'secondary.main', overflowWrap: 'anywhere' }}>
                      {money(opportunity.futureValue, i18n.language)}
                    </Typography>
                    <Stack direction="row" spacing={3} sx={{ mt: 3 }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          {t('insights.opportunity.contributed')}
                        </Typography>
                        <Typography variant="subtitle2">{money(opportunity.contributed, i18n.language)}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          {t('insights.opportunity.earnings')}
                        </Typography>
                        <Typography variant="subtitle2">{money(opportunity.earnings, i18n.language)}</Typography>
                      </Box>
                    </Stack>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 3 }}>
                      {t('insights.opportunity.disclaimer')}
                    </Typography>
                    <Link
                      href="https://www3.bcb.gov.br/CALCIDADAO/publico/exibirMetodologiaAplicacaoDepositosRegulares.do?method=exibirMetodologiaAplicacaoDepositosRegulares"
                      target="_blank"
                      rel="noreferrer"
                      variant="caption"
                      sx={{ display: 'inline-block', mt: 1 }}
                    >
                      {t('insights.opportunity.methodology')}
                    </Link>
                  </Box>
                </Grid>
              </Grid>
            </Card>

            <Card sx={{ p: 3 }}>
              <Stack direction="row" spacing={1.25} alignItems="center">
                <WalletIcon name="book" />
                <Typography variant="h6">{t('insights.references')}</Typography>
              </Stack>
              <Stack spacing={2} sx={{ mt: 2.5 }}>
                {report.references.map((reference, index) => (
                  <Box id={`reference-${reference.id}`} key={reference.id}>
                    <Link href={reference.url} target="_blank" rel="noreferrer" underline="hover" fontWeight={600}>
                      [{index + 1}] {reference.title}
                    </Link>
                    <Typography variant="body2" color="text.secondary">
                      {reference.author}
                      {reference.year ? `, ${reference.year}` : ''}. {reference.relevance}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Card>

            <Alert severity="info">
              <Typography variant="body2">{report.disclaimer}</Typography>
              <Typography variant="caption" color="text.secondary">
                {report.privacyNotice}
              </Typography>
            </Alert>
          </Stack>
        )}
      </Container>
    </>
  );
}
