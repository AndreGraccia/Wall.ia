import { useState } from 'react';
import PropTypes from 'prop-types';
import { Alert, Button, TextField } from '@mui/material';
import { useTranslation } from 'react-i18next';
import HttpService from '../../services/HttpService';
import { errorKey } from '../../utils/wallet';
import { COARSE, TOUCH_TARGET } from '../../theme/touch';
import { categoryLabel } from './labels';
import { RuleDialog } from './rules';

export { categoryLabel };
export { Rules } from './rules';

/** The categories of the cash flow a person may pick, by side (ADR 0024). The server checks the same lists. */
export const CATEGORY_OPTIONS = {
  income: ['SALARY', 'OTHER_INCOME'],
  spending: ['ESSENTIAL', 'LEISURE', 'BILL', 'RENT', 'SUBSCRIPTION', 'LOAN', 'CARD_INVOICE', 'OTHER'],
};

/** Only a word in the name (a suggestion) or nothing at all says what this movement is. */
export const needsReview = (item) => item.origin === 'NAME' || item.origin === 'NONE';

/** A native select: one tap opens it, one tap picks. */
export function CategorySelect({ side, value, label, onChange, disabled }) {
  const { t } = useTranslation();
  const options = CATEGORY_OPTIONS[side];
  return (
    <TextField
      select
      size="small"
      label={label}
      disabled={disabled}
      value={options.includes(value) ? value : ''}
      onChange={(event) => event.target.value && onChange(event.target.value)}
      SelectProps={{ native: true }}
      InputLabelProps={{ shrink: true }}
      sx={{ minWidth: 220, maxWidth: '100%', [COARSE]: { '& .MuiInputBase-root': { minHeight: TOUCH_TARGET } } }}
    >
      <option value="">{t('review.pick')}</option>
      {options.map((key) => (
        <option key={key} value={key}>
          {categoryLabel(key, t)}
        </option>
      ))}
    </TextField>
  );
}
CategorySelect.propTypes = {
  side: PropTypes.oneOf(['income', 'spending']).isRequired,
  value: PropTypes.string,
  label: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

/**
 * Saves a category and remembers the previous state, so the last change can be undone: back to the earlier choice,
 * or to no choice at all (rule or automatic). `reload` brings the numbers again from the server.
 */
export function useCategorize(reload) {
  const [state, setState] = useState({ busy: false, done: null, error: null });

  const run = async (request, done) => {
    setState((previous) => ({ ...previous, busy: true, error: null }));
    try {
      await request();
      setState({ busy: false, done, error: null });
      await reload();
    } catch (failure) {
      setState((previous) => ({ ...previous, busy: false, error: errorKey(failure) }));
    }
  };

  const url = (item) => `/categories/transactions/${item.id}`;
  return {
    ...state,
    ruleSaved: () => {
      setState({ busy: false, done: null, error: null, ruleSaved: true });
      return reload();
    },
    choose: (item, category) => run(() => HttpService.putWithAuth(url(item), { category }), { item, category }),
    clear: (item) => run(() => HttpService.deleteWithAuth(url(item)), null),
    undo: () => {
      const { item } = state.done;
      return run(
        () =>
          item.origin === 'CHOSEN'
            ? HttpService.putWithAuth(url(item), { category: item.category })
            : HttpService.deleteWithAuth(url(item)),
        null
      );
    },
  };
}

/** What just changed, with "Desfazer"; or why it could not be saved. */
export function CategoryNotice({ change }) {
  const { t } = useTranslation();
  const { done, error, busy, undo, ruleSaved } = change;
  const [ruling, setRuling] = useState(false);
  return (
    <>
      {error && <Alert severity="error">{t(error)}</Alert>}
      {ruleSaved && !done && <Alert severity="success">{t('review.rule.saved')}</Alert>}
      {done && (
        <Alert
          severity="success"
          action={
            <Button color="inherit" onClick={undo} disabled={busy}>
              {t('review.undo')}
            </Button>
          }
        >
          {t('review.done', {
            name: done.item.counterparty || t('cashFlow.items.noName'),
            category: categoryLabel(done.category, t),
          })}
          {done.item.counterparty && (
            <Button
              color="inherit"
              onClick={() => setRuling(true)}
              disabled={busy}
              sx={{ display: 'flex', textAlign: 'left', mt: 0.5, px: 0, minHeight: 44 }}
            >
              {t('review.rule.offer', { name: done.item.counterparty })}
            </Button>
          )}
        </Alert>
      )}
      {done && ruling && (
        <RuleDialog
          item={done.item}
          category={done.category}
          onClose={() => setRuling(false)}
          onSaved={() => {
            setRuling(false);
            change.ruleSaved();
          }}
        />
      )}
    </>
  );
}
CategoryNotice.propTypes = { change: PropTypes.object.isRequired };
