import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Typography,
} from '@mui/material';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import HttpService from '../../services/HttpService';
import { PageHeading, PageSkeleton } from '../../components/wallet-ui';
import { dayLabel, errorKey, money } from '../../utils/wallet';
import LifeGoalForm from './LifeGoalForm';

const FULL_DATE = { day: '2-digit', month: '2-digit', year: 'numeric' };

/**
 * "Minha evolução" (ADR 0026): where the person is, where she wants to get and the steps she marks. No score,
 * no percentage, no judgement.
 */
export default function LifeGoals() {
  const { t, i18n } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const lang = i18n.language;
  const [state, setState] = useState({ loading: true, error: null, items: null });
  const [goals, setGoals] = useState([]);
  const [busy, setBusy] = useState(false);
  // null: closed; 'new'; or the id being edited.
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);

  const load = useCallback(async () => {
    setState((previous) => ({ ...previous, loading: true, error: null }));
    // The goals only feed the optional link: without them the page still works.
    HttpService.getWithAuth('/future/goals')
      .then((list) => setGoals(Array.isArray(list) ? list : []))
      .catch(() => setGoals([]));
    try {
      const { items } = await HttpService.getWithAuth('/life-goals');
      setState({ loading: false, error: null, items });
    } catch (failure) {
      setState((previous) => ({ ...previous, loading: false, error: errorKey(failure) }));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Every change answers the whole list.
  const run = async (request, message) => {
    setBusy(true);
    try {
      const { items } = await request();
      setState({ loading: false, error: null, items });
      if (message) enqueueSnackbar(t(message), { variant: 'success' });
      return true;
    } catch (failure) {
      enqueueSnackbar(t(errorKey(failure)), { variant: 'error' });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const save = async (id, body) => {
    const request = id
      ? () => HttpService.putWithAuth(`/life-goals/${id}`, body)
      : () => HttpService.postWithAuth('/life-goals', body);
    if (await run(request, 'lifeGoals.saved')) setEditing(null);
  };
  const remove = async () => {
    const { id } = removing;
    setRemoving(null);
    await run(() => HttpService.deleteWithAuth(`/life-goals/${id}`), 'lifeGoals.removed');
  };

  const { items } = state;
  const date = (value) => dayLabel(value, lang, FULL_DATE);

  return (
    <>
      <Helmet>
        <title>{t('lifeGoals.pageTitle')}</title>
      </Helmet>
      <Container maxWidth="lg">
        <PageHeading
          title={t('lifeGoals.heading')}
          description={t('lifeGoals.description')}
          action={
            items?.length && editing !== 'new' ? (
              <Button variant="outlined" onClick={() => setEditing('new')}>
                {t('lifeGoals.addAnother')}
              </Button>
            ) : undefined
          }
        />

        {state.loading && !items && <PageSkeleton rows={3} />}
        {state.error && (
          <Alert
            severity="error"
            action={
              <Button color="inherit" onClick={load}>
                {t('app.retry')}
              </Button>
            }
          >
            {t(state.error)}
          </Alert>
        )}

        {items && (
          <Stack spacing={4} aria-busy={state.loading || busy}>
            {!items.length && (
              <Typography color="text.secondary" sx={{ maxWidth: 640 }}>
                {t('lifeGoals.empty')}
              </Typography>
            )}
            {(editing === 'new' || !items.length) && (
              <LifeGoalForm
                goals={goals}
                busy={busy}
                onSubmit={(body) => save(null, body)}
                onCancel={items.length ? () => setEditing(null) : undefined}
              />
            )}
            {items.map((item) =>
              editing === item.id ? (
                <LifeGoalForm
                  key={item.id}
                  lifeGoal={item}
                  goals={goals}
                  busy={busy}
                  onSubmit={(body) => save(item.id, body)}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <Box
                  key={item.id}
                  component="section"
                  aria-labelledby={`life-goal-${item.id}`}
                  sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 2 }}
                >
                  <Typography id={`life-goal-${item.id}`} variant="h6" component="h2" sx={{ overflowWrap: 'anywhere' }}>
                    {item.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" component="p">
                    {[
                      item.targetDate && t('lifeGoals.until', { date: date(item.targetDate) }),
                      item.estimatedCost !== null && t('lifeGoals.cost', { amount: money(item.estimatedCost, lang) }),
                      item.goal &&
                        t('lifeGoals.linked', { name: item.goal.name, amount: money(item.goal.monthlyAmount, lang) }),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mt: 2 }}>
                    {[
                      ['lifeGoals.current', item.currentSituation],
                      ['lifeGoals.desired', item.desiredSituation],
                    ].map(([label, content]) => (
                      <Box key={label}>
                        <Typography variant="body2" color="text.secondary" component="h3">
                          {t(label)}
                        </Typography>
                        <Typography sx={{ mt: 0.5, whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>
                          {content}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                  {item.steps.length > 0 && (
                    <Box component="ul" sx={{ m: 0, mt: 2, p: 0, listStyle: 'none' }}>
                      {item.steps.map((step) => (
                        <Box component="li" key={step.id} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                          <FormControlLabel
                            sx={{ minHeight: 56, width: '100%', mr: 0 }}
                            control={
                              <Checkbox
                                checked={step.done}
                                disabled={busy}
                                onChange={(event) => {
                                  const done = event.target.checked;
                                  run(() =>
                                    HttpService.putWithAuth(`/life-goals/${item.id}/steps/${step.id}`, { done })
                                  );
                                }}
                              />
                            }
                            label={
                              <Box>
                                <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                                  {step.description}
                                </Typography>
                                {step.doneOn && (
                                  <Typography variant="caption" color="text.secondary" component="p">
                                    {t('lifeGoals.doneOn', { date: date(step.doneOn) })}
                                  </Typography>
                                )}
                              </Box>
                            }
                          />
                        </Box>
                      ))}
                    </Box>
                  )}
                  <Stack direction="row" spacing={1} sx={{ mt: 1, ml: -1 }}>
                    <Button onClick={() => setEditing(item.id)}>{t('lifeGoals.edit')}</Button>
                    <Button color="error" disabled={busy} onClick={() => setRemoving(item)}>
                      {t('lifeGoals.remove')}
                    </Button>
                  </Stack>
                </Box>
              )
            )}
          </Stack>
        )}

        <Dialog open={Boolean(removing)} onClose={() => setRemoving(null)} aria-labelledby="life-goal-remove">
          <DialogTitle id="life-goal-remove">{t('lifeGoals.removeTitle')}</DialogTitle>
          <DialogContent>
            <Typography>{t('lifeGoals.removeHelp')}</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRemoving(null)}>{t('common.cancel')}</Button>
            <Button color="error" onClick={remove}>
              {t('lifeGoals.remove')}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </>
  );
}
