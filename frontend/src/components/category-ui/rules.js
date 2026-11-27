import { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Radio,
  RadioGroup,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import HttpService from '../../services/HttpService';
import { ListRow } from '../detail-ui';
import { categoryLabel } from './labels';
import { dayLabel, errorKey, money } from '../../utils/wallet';

/**
 * "Sempre que for <contraparte>, usar <categoria>" (ADR 0024). The server lists what would change for the chosen scope
 * before anything is saved. Only from today on is the default: reaching the past is a decision.
 */
export function RuleDialog({ item, category, onClose, onSaved }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [includePrevious, setIncludePrevious] = useState(false);
  const [state, setState] = useState({ preview: null, error: null, saving: false });
  const body = { transactionId: item.id, category, includePrevious };

  useEffect(() => {
    let alive = true;
    setState({ preview: null, error: null, saving: false });
    HttpService.postWithAuth('/categories/rules/preview', { transactionId: item.id, category, includePrevious })
      .then((preview) => alive && setState({ preview, error: null, saving: false }))
      .catch((failure) => alive && setState({ preview: null, error: errorKey(failure), saving: false }));
    return () => {
      alive = false;
    };
  }, [item.id, category, includePrevious]);

  const save = async () => {
    setState((previous) => ({ ...previous, saving: true, error: null }));
    try {
      await HttpService.postWithAuth('/categories/rules', body);
      onSaved();
    } catch (failure) {
      setState((previous) => ({ ...previous, saving: false, error: errorKey(failure) }));
    }
  };

  const { preview } = state;
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="category-rule-title">
      <DialogTitle id="category-rule-title">
        {t('review.rule.title', { name: item.counterparty, category: categoryLabel(category, t) })}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <RadioGroup
            aria-label={t('review.rule.scope')}
            value={includePrevious ? 'all' : 'future'}
            onChange={(event) => setIncludePrevious(event.target.value === 'all')}
          >
            {['future', 'all'].map((value) => (
              <FormControlLabel
                key={value}
                value={value}
                control={<Radio />}
                label={t(`review.rule.${value}`)}
                sx={{ minHeight: 44 }}
              />
            ))}
          </RadioGroup>
          {state.error && <Alert severity="error">{t(state.error)}</Alert>}
          {!preview && !state.error && (
            <Box role="status" aria-busy="true" aria-label={t('common.loading')}>
              <Skeleton height={56} />
              <Skeleton height={56} />
            </Box>
          )}
          {preview && (
            <Box>
              <Typography role="status">{t('review.rule.affected', { count: preview.affected })}</Typography>
              {preview.kept > 0 && (
                <Typography variant="body2" color="text.secondary">
                  {t('review.rule.kept', { count: preview.kept })}
                </Typography>
              )}
              {preview.replaces && (
                <Typography variant="body2" color="text.secondary">
                  {t('review.rule.replaces', { category: categoryLabel(preview.replaces, t) })}
                </Typography>
              )}
              {preview.items.map((entry) => (
                <ListRow
                  key={entry.id}
                  title={dayLabel(entry.date, lang, { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  meta={entry.account}
                  value={money(entry.amount, lang)}
                />
              ))}
              {preview.affected > preview.items.length && (
                <Typography variant="caption" color="text.secondary">
                  {t('review.rule.more', { count: preview.affected - preview.items.length })}
                </Typography>
              )}
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('review.rule.cancel')}</Button>
        <Button variant="contained" onClick={save} disabled={!preview || state.saving}>
          {t('review.rule.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
RuleDialog.propTypes = {
  item: PropTypes.object.isRequired,
  category: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
  onSaved: PropTypes.func.isRequired,
};

/** The saved rules; removing one undoes its whole effect. Reads again whenever `version` changes. */
export function Rules({ version, onChange }) {
  const { t, i18n } = useTranslation();
  const [state, setState] = useState({ rules: null, error: null, busy: false });
  const load = useCallback(async () => {
    try {
      const rules = await HttpService.getWithAuth('/categories/rules');
      setState({ rules, error: null, busy: false });
    } catch (failure) {
      setState({ rules: null, error: errorKey(failure), busy: false });
    }
  }, []);
  useEffect(() => {
    load();
  }, [load, version]);

  const remove = async (rule) => {
    setState((previous) => ({ ...previous, busy: true, error: null }));
    try {
      await HttpService.deleteWithAuth(`/categories/rules/${rule.id}`);
      await Promise.all([load(), onChange()]);
    } catch (failure) {
      setState((previous) => ({ ...previous, busy: false, error: errorKey(failure) }));
    }
  };

  return (
    <Box component="section" aria-labelledby="category-rules">
      <Typography id="category-rules" variant="h6" component="h2">
        {t('review.rules.title')}
      </Typography>
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
      {!state.rules && !state.error && <Skeleton height={56} />}
      {state.rules?.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          {t('review.rules.empty')}
        </Typography>
      )}
      {state.rules?.map((rule) => (
        <ListRow
          key={rule.id}
          title={rule.counterparty}
          meta={[
            categoryLabel(rule.category, t),
            rule.appliesFrom
              ? t('review.rules.from', {
                  date: dayLabel(rule.appliesFrom, i18n.language, {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  }),
                })
              : t('review.rules.all'),
          ].join(' · ')}
          aside={
            <Button
              disabled={state.busy}
              onClick={() => remove(rule)}
              aria-label={t('review.rules.removeFor', { name: rule.counterparty })}
              sx={{ minHeight: 44 }}
            >
              {t('review.rules.remove')}
            </Button>
          }
        />
      ))}
    </Box>
  );
}
Rules.propTypes = { version: PropTypes.any, onChange: PropTypes.func.isRequired };
