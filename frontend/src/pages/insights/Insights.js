import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Link,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { LoadingButton } from '@mui/lab';
import { Helmet } from 'react-helmet-async';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { EmptyState, PageHeading, PageSkeleton, SectionCard, visuallyHidden } from '../../components/wallet-ui';
import { StatBlock } from '../../components/future-ui';
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

  const generate = async (period = months) => {
    setBusy(true);
    setError(null);
    try {
      const response = await HttpService.postWithAuth('/insights/reports', {
        months: period,
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
  const formatMonth = (value) =>
    monthLabel(value, i18n.language, { month: 'short', year: '2-digit' }).replace(/^./, (letter) => letter.toLocaleUpperCase());

  const lang = i18n.language;
  const generateButton = (variant) => (
    <LoadingButton loading={busy} onClick={() => generate()} variant={variant}>
      {report ? t('insights.refresh') : t('insights.generate')}
    </LoadingButton>
  );

  return (
    <>
      <Helmet>
        <title>{t('insights.pageTitle')}</title>
      </Helmet>
      <Container maxWidth="lg">
        <PageHeading
          title={t('insights.heading')}
          action={
            <ToggleButtonGroup
              exclusive
              value={months}
              onChange={(_, value) => {
                if (!value) return;
                setMonths(value);
                // With a report on screen, a new period is a new report: the pill answers at once.
                if (report) generate(value);
              }}
              aria-label={t('insights.period')}
            >
              {PERIODS.map((period) => (
                <ToggleButton key={period} value={period} aria-label={t('insights.months', { count: period })}>
                  {t('insights.monthsShort', { count: period })}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          }
        />

        {error && (
          <Alert
            severity="error"
            sx={{ mb: 3 }}
            action={
              <Button color="inherit" onClick={() => generate()} disabled={busy}>
                {t('app.retry')}
              </Button>
            }
          >
            {t(error)}
          </Alert>
        )}

        {!report && busy && <PageSkeleton rows={4} />}

        {!report && !busy && !error && (
          <EmptyState
            icon="insights"
            title={t('insights.emptyTitle')}
            description={t('insights.aggregateOnly')}
            action={generateButton('contained')}
          />
        )}

        {report && (
          <Stack spacing={{ xs: 5, md: 6 }} aria-busy={busy} sx={{ opacity: busy ? 0.6 : 1, transition: 'opacity 150ms' }}>
            {/* (1) The answer, then where it came from. */}
            <Box>
              {/* The totals are only as fresh as the bank data under them (B50). */}
              <BankDataNotice bankData={report.bankData} sx={{ mb: 2 }} />
              <Typography variant="h4" component="h2" sx={{ maxWidth: 760 }}>
                {report.headline}
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 1.5, maxWidth: 680 }}>
                {report.summary}
              </Typography>
              <Stack direction="row" alignItems="center" flexWrap="wrap" sx={{ gap: 2, mt: 3 }}>
                {generateButton('outlined')}
                <Typography variant="caption" color="text.secondary">
                  {t(`insights.provider.${report.provider}`)},{' '}
                  {t('insights.generatedAt', { date: dateTime(report.generatedAt, lang) }).toLocaleLowerCase()}
                </Typography>
              </Stack>
            </Box>

            {/* (2) Four numbers in columns, no boxes. */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
                gap: { xs: 3, md: 4 },
                pt: 3,
                borderTop: '1px solid',
                borderColor: 'divider',
              }}
            >
              <StatBlock compact label={t('insights.metrics.inflow')} value={money(report.metrics.inflow, lang)} />
              <StatBlock compact label={t('insights.metrics.outflow')} value={money(report.metrics.outflow, lang)} />
              <StatBlock
                compact
                emphasis
                label={t('insights.metrics.netFlow')}
                value={money(report.metrics.netFlow, lang)}
                negative={Number(report.metrics.netFlow) < 0}
              />
              <StatBlock
                compact
                label={t('insights.metrics.transactionCount')}
                value={String(report.metrics.transactionCount)}
              />
            </Box>

            {/* (3) Month by month: one row each, the bars share one scale, the net on the right. */}
            <Box component="section" aria-labelledby="insights-flow">
              <Stack
                direction="row"
                alignItems="baseline"
                justifyContent="space-between"
                flexWrap="wrap"
                sx={{ gap: 2, mb: 1 }}
              >
                <Typography id="insights-flow" variant="h6" component="h2">
                  {t('insights.cashFlow')}
                </Typography>
                <Stack direction="row" spacing={2} aria-hidden="true">
                  {[
                    ['success.main', 'insights.metrics.inflow'],
                    ['text.secondary', 'insights.metrics.outflow'],
                  ].map(([color, label]) => (
                    <Stack key={label} direction="row" spacing={0.75} alignItems="center">
                      <Box sx={{ width: 12, height: 4, borderRadius: 2, bgcolor: color }} />
                      <Typography variant="caption" color="text.secondary">
                        {t(label)}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Stack>
              <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none', borderTop: '1px solid', borderColor: 'divider' }}>
                {report.monthlyFlow.map((flow) => {
                  const net = Number(flow.inflow) - Number(flow.outflow);
                  return (
                    <Box
                      component="li"
                      key={flow.month}
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '56px minmax(0, 1fr) auto', sm: '88px minmax(0, 1fr) 140px' },
                        alignItems: 'center',
                        columnGap: 2,
                        minHeight: 56,
                        py: 1,
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <Typography variant="body2">
                        {formatMonth(flow.month)}
                      </Typography>
                      {/* The bars repeat what the screen reader hears in the sentence below them. */}
                      <Box>
                        <Stack spacing={0.5} aria-hidden="true">
                          {[
                            [flow.inflow, 'success.main'],
                            [flow.outflow, 'text.secondary'],
                          ].map(([value, color]) => (
                            <Box
                              key={color}
                              sx={{
                                height: 6,
                                minWidth: 2,
                                width: `${(Number(value) / maxFlow) * 100}%`,
                                bgcolor: color,
                                borderRadius: 3,
                              }}
                            />
                          ))}
                        </Stack>
                        <Box sx={visuallyHidden}>
                          {t('insights.flowRow', {
                            inflow: money(flow.inflow, lang),
                            outflow: money(flow.outflow, lang),
                          })}
                        </Box>
                      </Box>
                      <Typography
                        variant="subtitle2"
                        sx={{
                          textAlign: 'right',
                          fontWeight: 600,
                          fontVariantNumeric: 'tabular-nums',
                          color: net < 0 ? 'error.main' : 'text.primary',
                        }}
                      >
                        {net > 0 ? '+ ' : ''}
                        {money(net, lang)}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            </Box>

            {/* (4) What to look at and what to do, side by side on a wide screen. */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' },
                gap: 5,
              }}
            >
              {[
                ['observations', report.observations],
                ['actions', report.recommendedActions],
              ].map(([key, items]) => (
                <Box component="section" key={key} aria-labelledby={`insights-${key}`}>
                  <Typography id={`insights-${key}`} variant="h6" component="h2" sx={{ mb: 1 }}>
                    {t(`insights.${key}`)}
                  </Typography>
                  <Box
                    component="ul"
                    sx={{ m: 0, p: 0, listStyle: 'none', borderTop: '1px solid', borderColor: 'divider' }}
                  >
                    {items.map((item, index) => (
                      <Box
                        component="li"
                        key={`${item.title}-${index}`}
                        sx={{ py: 2, borderBottom: '1px solid', borderColor: 'divider' }}
                      >
                        <Typography variant="subtitle2">{item.title}</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {item.body}
                        </Typography>
                        <CitationLinks ids={item.citationIds} references={report.references} />
                      </Box>
                    ))}
                  </Box>
                </Box>
              ))}
            </Box>

            {/* (5) The simulator is a tool: folded, with its answer as the summary. */}
            <Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
              <SectionCard
                collapsible
                title={t('insights.opportunity.title')}
                summary={money(opportunity.futureValue, lang)}
              >
                <Box
                  sx={{
                    px: { xs: 2.5, sm: 3 },
                    pb: 3,
                    display: 'grid',
                    gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' },
                    gap: 4,
                  }}
                >
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                      {t('insights.opportunity.description')}
                    </Typography>
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))' },
                        gap: 2,
                      }}
                    >
                      <TextField
                        type="number"
                        label={t('insights.opportunity.monthlyAmount')}
                        value={monthlyContribution}
                        onChange={(event) => setMonthlyContribution(event.target.value)}
                        inputProps={{ min: 0, max: 1000000, step: '0.01' }}
                        sx={{ gridColumn: { xs: 'span 2', sm: 'auto' } }}
                      />
                      <TextField
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
                      <TextField
                        type="number"
                        label={t('insights.opportunity.annualRate')}
                        value={annualRate}
                        onChange={(event) => setAnnualRate(event.target.value)}
                        inputProps={{ min: 0, max: 100, step: '0.1' }}
                      />
                    </Box>
                    <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 2 }}>
                      {t('insights.opportunity.suggestion')}
                    </Typography>
                  </Box>
                  <Box>
                    <StatBlock
                      label={t('insights.opportunity.estimatedValue')}
                      value={
                        <Box component="span" sx={{ color: 'secondary.main' }}>
                          {money(opportunity.futureValue, lang)}
                        </Box>
                      }
                    />
                    <Stack direction="row" spacing={4} sx={{ mt: 2 }}>
                      <StatBlock
                        compact
                        label={t('insights.opportunity.contributed')}
                        value={money(opportunity.contributed, lang)}
                      />
                      <StatBlock
                        compact
                        label={t('insights.opportunity.earnings')}
                        value={money(opportunity.earnings, lang)}
                      />
                    </Stack>
                    <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 2 }}>
                      {t('insights.opportunity.disclaimer')}{' '}
                      <Link
                        href="https://www3.bcb.gov.br/CALCIDADAO/publico/exibirMetodologiaAplicacaoDepositosRegulares.do?method=exibirMetodologiaAplicacaoDepositosRegulares"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t('insights.opportunity.methodology')}
                      </Link>
                    </Typography>
                  </Box>
                </Box>
              </SectionCard>
            </Box>

            {/* (6) Sources and the fine print, small and last. */}
            <Box component="section" aria-labelledby="insights-references">
              <Typography id="insights-references" variant="subtitle1" component="h2" sx={{ mb: 1.5 }}>
                {t('insights.references')}
              </Typography>
              <Box component="ol" sx={{ m: 0, pl: 3, display: 'grid', gap: 1.5, maxWidth: 760 }}>
                {report.references.map((reference) => (
                  <Typography component="li" variant="body2" id={`reference-${reference.id}`} key={reference.id}>
                    <Link href={reference.url} target="_blank" rel="noreferrer" underline="hover">
                      {reference.title}
                    </Link>
                    <Typography component="span" variant="body2" color="text.secondary">
                      {' '}
                      {reference.author}
                      {reference.year ? `, ${reference.year}` : ''}. {reference.relevance}
                    </Typography>
                  </Typography>
                ))}
              </Box>
              <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 3, maxWidth: 760 }}>
                {report.disclaimer} {report.privacyNotice}
              </Typography>
            </Box>
          </Stack>
        )}
      </Container>
    </>
  );
}
