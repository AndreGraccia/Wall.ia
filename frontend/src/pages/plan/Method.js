import { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Container,
  FormControlLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import HttpService from '../../services/HttpService';
import { PageHeading, PageSkeleton, SectionCard, WalletIcon } from '../../components/wallet-ui';
import { Disclosure, ListRow } from '../../components/detail-ui';
import { dayLabel, errorKey, money, percent } from '../../utils/wallet';

// Where each method runs in the app (the catalog carries the API route; the screen needs the page).
const TOOL_ROUTES = {
  MONTH_PLAN: '/plan',
  GOALS: '/future',
  FUTURE: '/future',
  ENVELOPES: '/envelopes',
  DEBT_PAYOFF: '/commitments',
};
const PREFERENCES = ['SIMPLE', 'DETAILED', 'NOT_SAID'];
const GOALS = ['STABILITY', 'LEAVE_DEBT', 'ORGANIZE_MONTH', 'BUILD_RESERVE', 'OTHER', 'NOT_SAID'];

/** Reason params come raw from the rules: money stays money, a share is a percent, a count is a count. */
export function reasonText(reason, t, lang) {
  const params = {};
  Object.entries(reason.params || {}).forEach(([key, value]) => {
    if (key.endsWith('Percent')) params[key] = percent(value, lang);
    else if (key === 'debts') params[key] = Number(value);
    else params[key] = money(value, lang);
  });
  return t(`method.reasons.${reason.code}`, params);
}

const nameOf = (id, methods, t) =>
  t(`method.catalog.${id}.name`, { defaultValue: methods.find((item) => item.id === id)?.name || id });

/** "Dados usados": the numbers the rules read, so the person can check the why. */
function DataUsed({ data }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const none = t('method.data.none');
  const rows = [
    ['confirmedIncome', data.confirmedIncome != null ? money(data.confirmedIncome, lang) : none],
    ['variableIncome', t(data.variableIncome ? 'method.data.yes' : 'method.data.no')],
    ['fixedMonthly', money(data.fixedMonthly, lang)],
    ['fixedSharePercent', data.fixedSharePercent != null ? percent(data.fixedSharePercent, lang) : none],
    ['debtsWithRate', String(data.debtsWithRate)],
  ];
  return (
    <Box
      component="dl"
      sx={{
        m: 0,
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        columnGap: 3,
        rowGap: 0.5,
        maxWidth: 420,
      }}
    >
      {rows.map(([key, value]) => (
        <Box key={key} sx={{ display: 'contents' }}>
          <Typography component="dt" variant="body2" color="text.secondary">
            {t(`method.data.${key}`)}
          </Typography>
          <Typography
            component="dd"
            variant="body2"
            sx={{ m: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
          >
            {value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
DataUsed.propTypes = { data: PropTypes.object.isRequired };

/**
 * Meu método (ADR 0021): the Wall.ia does not impose a method. It shows the ones that match the person's data, with
 * the reason and the numbers behind it, the whole catalog, and records the choice. Descriptive text only: a method
 * organises the person's own money and never names a product.
 */
export default function Method() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [state, setState] = useState({ loading: true, error: null, suggestions: null, methods: [], profile: null });
  const [busy, setBusy] = useState(null);
  const [notice, setNotice] = useState(null);
  const [failure, setFailure] = useState(null);
  const [picked, setPicked] = useState(null);

  const load = useCallback(async () => {
    setState((previous) => ({ ...previous, loading: true, error: null }));
    try {
      const [suggestions, catalog, profile] = await Promise.all([
        HttpService.getWithAuth('/methods/suggestions'),
        HttpService.getWithAuth('/methods'),
        HttpService.getWithAuth('/profile'),
      ]);
      setState({ loading: false, error: null, suggestions, methods: catalog.methods, profile });
    } catch (error) {
      setState((previous) => ({ ...previous, loading: false, error: errorKey(error) }));
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const { suggestions, methods, profile } = state;
  const current = profile?.method;
  const presetOf = (id) => methods.find((item) => item.id === id)?.preset?.length > 0;
  const listed = suggestions?.suggestions.map((item) => item.method) || [];
  // The radio starts on the current method when it is listed, otherwise on the first suggestion.
  const selected = picked ?? (listed.includes(current) ? current : listed[0]) ?? null;

  const choose = async (id) => {
    setBusy(id);
    setFailure(null);
    setNotice(null);
    try {
      const next = await HttpService.putWithAuth('/profile/method', { method: id });
      setState((previous) => ({ ...previous, profile: next }));
      setNotice(id);
    } catch (error) {
      setFailure(errorKey(error));
    } finally {
      setBusy(null);
    }
  };

  // Optimistic: the control moves at once and goes back if the server refuses.
  const savePreferences = async (patch) => {
    const before = profile;
    const next = { preference: profile.preference || 'NOT_SAID', mainGoal: profile.mainGoal || 'NOT_SAID', ...patch };
    setState((previous) => ({ ...previous, profile: { ...previous.profile, ...patch } }));
    setFailure(null);
    try {
      const saved = await HttpService.putWithAuth('/profile', next);
      setState((previous) => ({ ...previous, profile: saved }));
      // The rules read the preference and the main goal: the suggestions follow them.
      if (patch.preference || patch.mainGoal) {
        const fresh = await HttpService.getWithAuth('/methods/suggestions');
        setState((previous) => ({ ...previous, suggestions: fresh }));
      }
    } catch (error) {
      setState((previous) => ({ ...previous, profile: before }));
      setFailure(errorKey(error));
    }
  };

  const chooseButton = (id) =>
    current === id ? (
      <Typography variant="caption" color="text.secondary">
        {t('method.chosen')}
      </Typography>
    ) : (
      <Button size="small" variant="outlined" onClick={() => choose(id)} disabled={Boolean(busy)}>
        {busy === id ? t('method.choosing') : t('method.choose')}
      </Button>
    );

  return (
    <>
      <Helmet>
        <title>{t('method.pageTitle')}</title>
      </Helmet>
      <Container maxWidth="lg">
        <PageHeading
          title={t('method.heading')}
          action={
            <Button
              component={RouterLink}
              to="/plan"
              startIcon={<WalletIcon name="back" sx={{ fontSize: 18 }} />}
              sx={{ color: 'text.secondary' }}
            >
              {t('method.back')}
            </Button>
          }
        />

        {state.loading && !suggestions && <PageSkeleton rows={3} />}
        {state.error && (
          <Alert
            severity="error"
            action={
              <Button color="inherit" onClick={load}>
                {t('app.retry')}
              </Button>
            }
          >
            {t('method.loadError')} {t(state.error)}
          </Alert>
        )}

        {suggestions && (
          <Stack spacing={{ xs: 4, md: 5 }}>
            <Typography color="text.secondary" sx={{ maxWidth: 640, mt: { md: -2 } }}>
              {current
                ? t('method.current', {
                    name: nameOf(current, methods, t),
                    date: dayLabel(profile.methodHistory?.[0]?.chosenAt?.slice(0, 10), lang),
                  })
                : t('method.none')}
            </Typography>

            <Box aria-live="polite">
              {failure && <Alert severity="error">{t(failure)}</Alert>}
              {notice && (
                <Alert
                  severity="success"
                  onClose={() => setNotice(null)}
                  action={
                    presetOf(notice) ? (
                      <Button color="inherit" component={RouterLink} to={`/plan?preset=${notice}`}>
                        {t('method.usePreset')}
                      </Button>
                    ) : undefined
                  }
                >
                  {t('method.chosenNotice', { name: nameOf(notice, methods, t) })}
                </Alert>
              )}
            </Box>

            <Box component="section" aria-labelledby="method-suggestions">
              <Typography id="method-suggestions" variant="h6" component="h2" sx={{ mb: 1 }}>
                {t('method.suggestionsTitle')}
              </Typography>
              {suggestions.needsConfirmedIncome && (
                <Box sx={{ pl: 2, mb: 2, borderLeft: '2px solid', borderColor: 'warning.main' }}>
                  <Typography variant="body2">{t('method.needsIncome')}</Typography>
                  <Button component={RouterLink} to="/future" size="small" sx={{ mt: 1, ml: -1 }}>
                    {t('plan.noIncomeAction')}
                  </Button>
                </Box>
              )}
              {/* One choice: the whole line is the radio; one "use" button under the list. */}
              <RadioGroup
                aria-labelledby="method-suggestions"
                value={selected ?? ''}
                onChange={(event) => setPicked(event.target.value)}
                sx={{ borderTop: '1px solid', borderColor: 'divider' }}
              >
                {suggestions.suggestions.map((suggestion) => (
                  <FormControlLabel
                    key={suggestion.method}
                    value={suggestion.method}
                    control={<Radio sx={{ mt: -0.75 }} />}
                    disableTypography
                    sx={{
                      m: 0,
                      minHeight: 56,
                      py: 1.5,
                      gap: 1,
                      alignItems: 'flex-start',
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                    label={
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle2" component="span" sx={{ display: 'block' }}>
                          {nameOf(suggestion.method, methods, t)}
                          {current === suggestion.method && (
                            <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                              {t('method.chosen')}
                            </Typography>
                          )}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" component="span" sx={{ display: 'block' }}>
                          {suggestion.reasons.map((reason) => reasonText(reason, t, lang)).join(' ')}
                        </Typography>
                      </Box>
                    }
                  />
                ))}
              </RadioGroup>
              {selected && (
                <Stack direction="row" alignItems="center" flexWrap="wrap" sx={{ gap: 2, mt: 2 }}>
                  <Button
                    variant="contained"
                    onClick={() => choose(selected)}
                    disabled={selected === current || Boolean(busy)}
                  >
                    {busy === selected ? t('method.choosing') : t('method.use')}
                  </Button>
                  {selected === current && (
                    <Typography variant="body2" color="text.secondary">
                      {t('method.isCurrent')}
                    </Typography>
                  )}
                </Stack>
              )}
              <Disclosure label={t('method.dataUsed')} sx={{ mt: 1 }}>
                <DataUsed data={suggestions.data} />
              </Disclosure>
            </Box>

            <Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
              <SectionCard collapsible title={t('method.catalogTitle')} summary={String(methods.length)}>
                <Box sx={{ px: 3, pb: 1 }}>
                  {methods.map((method) => {
                    const name = nameOf(method.id, methods, t);
                    const text = (field, fallback) =>
                      t(`method.catalog.${method.id}.${field}`, { defaultValue: fallback });
                    const route = TOOL_ROUTES[method.where?.tool];
                    return (
                      <ListRow
                        key={method.id}
                        titleComponent="h3"
                        title={name}
                        meta={text('how', method.howItWorks)}
                        aside={chooseButton(method.id)}
                        detailLabel={t('method.detail', { name })}
                        detail={
                          <Stack spacing={1.5} sx={{ maxWidth: 640 }}>
                            {[
                              ['method.helps', text('helps', method.helpsWhen)],
                              ['method.limits', text('limits', method.limitations)],
                            ].map(([label, value]) => (
                              <Box key={label}>
                                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                  {t(label)}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {value}
                                </Typography>
                              </Box>
                            ))}
                            {route && (
                              <Box>
                                <Button component={RouterLink} to={route} size="small" variant="outlined">
                                  {t('method.open', { tool: t(`method.tools.${method.where.tool}`) })}
                                </Button>
                              </Box>
                            )}
                          </Stack>
                        }
                      />
                    );
                  })}
                </Box>
              </SectionCard>
              <SectionCard collapsible title={t('method.profile.title')}>
                <Stack spacing={3} sx={{ px: 3, pb: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    {t('method.profile.help')}
                  </Typography>
                  <Box>
                    <Typography id="method-style" variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                      {t('method.profile.style')}
                    </Typography>
                    <ToggleButtonGroup
                      exclusive
                      value={profile.preference || 'NOT_SAID'}
                      onChange={(_, value) => value && savePreferences({ preference: value })}
                      aria-labelledby="method-style"
                      sx={{ flexWrap: 'wrap', borderRadius: { xs: '20px', sm: 999 } }}
                    >
                      {PREFERENCES.map((value) => (
                        <ToggleButton key={value} value={value}>
                          {t(`method.profile.${value}`)}
                        </ToggleButton>
                      ))}
                    </ToggleButtonGroup>
                  </Box>
                  <TextField
                    select
                    label={t('method.profile.goal')}
                    value={profile.mainGoal || 'NOT_SAID'}
                    onChange={(event) => savePreferences({ mainGoal: event.target.value })}
                    sx={{ maxWidth: 320 }}
                  >
                    {GOALS.map((value) => (
                      <MenuItem key={value} value={value}>
                        {t(`method.profile.goals.${value}`)}
                      </MenuItem>
                    ))}
                  </TextField>
                </Stack>
              </SectionCard>
            </Box>
          </Stack>
        )}
      </Container>
    </>
  );
}
