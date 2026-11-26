import PropTypes from 'prop-types';
import { Box, ButtonBase, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { directionFor, localeFor, money, totalsFor } from '../../utils/wallet';

// Local calendar day and month of a timestamp, so a 23:30 entry in Brazil does not land on the next UTC day.
const parts = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : [date.getFullYear(), date.getMonth(), date.getDate()];
};
const same = (a, b) => a && b && a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

function dayText(day, language, t) {
  if (!day) return '—';
  const now = new Date();
  if (same(day, parts(now))) return t('transactions.today');
  if (same(day, parts(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))))
    return t('transactions.yesterday');
  return new Intl.DateTimeFormat(localeFor(language), { day: '2-digit', month: '2-digit' }).format(
    new Date(day[0], day[1], day[2])
  );
}

function monthText(day, language) {
  if (!day) return '—';
  const thisYear = day[0] === new Date().getFullYear();
  return new Intl.DateTimeFormat(localeFor(language), { month: 'long', ...(!thisYear && { year: 'numeric' }) })
    .format(new Date(day[0], day[1], 1))
    .replace(/^./, (letter) => letter.toLocaleUpperCase());
}

/**
 * Joins the two imported sides of a move between the person's own accounts (the API flags both with `ownAccountMove`)
 * into one entry: same local day, same amount, one withdrawal and one deposit. A side whose partner is not in the
 * list (filtered by account, or not synced yet) stays alone, and neutral too. Returns `{ item, pair }` in order.
 */
export function foldOwnMoves(transactions) {
  const used = new Set();
  const out = [];
  transactions.forEach((item, index) => {
    if (used.has(item.id)) return;
    let pair = null;
    if (item.ownAccountMove) {
      const day = parts(item.createdAt);
      pair =
        transactions.find(
          (other, at) =>
            at > index &&
            other.ownAccountMove &&
            !used.has(other.id) &&
            other.type?.name !== item.type?.name &&
            Number(other.amount) === Number(item.amount) &&
            same(parts(other.createdAt), day)
        ) || null;
      if (pair) used.add(pair.id);
    }
    out.push({ item, pair });
  });
  return out;
}

/** Net of a month in reais: in minus out, by the same rule as every total (own-account moves count as neither). */
export function monthNet(items, wallets) {
  const { incoming, outgoing } = totalsFor(items, wallets);
  return (incoming - outgoing) / 100;
}

const names = (from, to) => `${from?.name || '—'} → ${to?.name || '—'}`;

/**
 * The line under the description: category · account (auditoria 26/11). The statement API has no category yet, so it
 * is the account the money touched; a move between the person's own accounts names both. The payment method (Pix,
 * boleto...) lives in the detail.
 */
function accountLine(item, pair, direction, t) {
  if (pair) {
    const out = item.type?.name === 'Withdrawal' ? item : pair;
    return names(out.fromWallet, (out === item ? pair : item).toWallet);
  }
  if (direction === 'internal' && !item.ownAccountMove) return names(item.fromWallet, item.toWallet);
  const account = direction === 'incoming' ? item.toWallet?.name : item.fromWallet?.name || item.toWallet?.name;
  return [direction === 'internal' && t('transactions.betweenAccounts'), item.category, account]
    .filter(Boolean)
    .join(' · ');
}

const signed = (value, language) => (value > 0 ? `+ ${money(value, language)}` : money(value, language));

/**
 * A statement as a bank app shows it: entries grouped by month (the month's net at the right of its heading), one
 * 56 px row each with the day on the left (the same column as the Future list), description in the middle and the
 * signed amount, tabular, on the right. A move between own accounts is one neutral row: no sign, no green.
 * Status only appears when it is not "done", and in words, not colour. Grouping by day would put a header over
 * almost every row in a real account, where most days have one entry.
 * `limit` caps the rows shown; the month net still counts the whole list, so a paged month does not lie.
 * `dayHeading` keeps the outline right: h2 under the page title, h3 inside a titled section.
 */
export default function StatementList({ transactions, wallets, onSelect, dayHeading = 'h2', limit = Infinity }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const months = [];
  let rows = 0;
  foldOwnMoves(transactions).forEach((entry) => {
    const day = parts(entry.item.createdAt);
    const key = day ? `${day[0]}-${day[1]}` : '';
    if (months.at(-1)?.key !== key) months.push({ key, day, entries: [], all: [] });
    const month = months.at(-1);
    month.all.push(entry.item, ...(entry.pair ? [entry.pair] : []));
    if (rows < limit) {
      month.entries.push({ ...entry, day });
      rows += 1;
    }
  });

  return months
    .filter((month) => month.entries.length)
    .map((month) => {
      const net = signed(monthNet(month.all, wallets), lang);
      return (
        <Box component="section" key={month.key || 'unknown'} sx={{ '& + &': { mt: 4 } }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="baseline"
            sx={{ gap: 2, pb: 1, borderBottom: '1px solid', borderColor: 'divider' }}
          >
            <Typography component={dayHeading} variant="body2" color="text.secondary" sx={{ m: 0, fontWeight: 500 }}>
              {monthText(month.day, lang)}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              aria-label={t('transactions.monthTotal', { amount: net })}
              sx={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}
            >
              {net}
            </Typography>
          </Stack>
          <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
            {month.entries.map(({ item, pair, day }) => {
              const direction = pair ? 'internal' : directionFor(item, wallets);
              const success = item.status === 'SUCCESS';
              const sign = success && direction === 'incoming' ? '+ ' : success && direction === 'outgoing' ? '− ' : '';
              const type = t(`app.types.${item.type?.name}`, { defaultValue: t('app.types.Transfer') });
              // Imported entries carry the counterparty ("Netflix"); that says more than the generic type.
              const named = item.description && item.description !== 'Initial balance';
              const title = pair ? t('transactions.ownMove') : named ? item.description : type;
              return (
                <Box component="li" key={item.id} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                  <ButtonBase
                    onClick={() => onSelect(item)}
                    sx={{
                      width: '100%',
                      // content-box (so the hover can bleed past the column): 44 + 2 × 6 padding = a 56 px row.
                      minHeight: 44,
                      py: 0.75,
                      px: 1.5,
                      mx: -1.5,
                      boxSizing: 'content-box',
                      gap: 2,
                      justifyContent: 'space-between',
                      textAlign: 'left',
                      borderRadius: '12px',
                      '&:hover': { bgcolor: 'background.neutral' },
                      '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'secondary.main', outlineOffset: -2 },
                    }}
                  >
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      component="span"
                      sx={{ width: 48, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}
                    >
                      {dayText(day, lang, t)}
                    </Typography>
                    <Box component="span" sx={{ display: 'block', minWidth: 0, flex: 1 }}>
                      <Typography variant="subtitle2" noWrap component="span" sx={{ display: 'block' }}>
                        {title}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        noWrap
                        component="span"
                        sx={{ display: 'block' }}
                      >
                        {accountLine(item, pair, direction, t)}
                      </Typography>
                    </Box>
                    <Box component="span" sx={{ display: 'block', textAlign: 'right', flexShrink: 0 }}>
                      <Typography
                        variant="subtitle2"
                        component="span"
                        sx={{
                          display: 'block',
                          fontWeight: 600,
                          fontVariantNumeric: 'tabular-nums',
                          color: sign === '+ ' ? 'success.main' : 'text.primary',
                        }}
                      >
                        {sign}
                        {money(item.amount, lang)}
                      </Typography>
                      {!success && (
                        <Typography
                          variant="caption"
                          component="span"
                          sx={{ display: 'block', color: item.status === 'ERROR' ? 'error.main' : 'warning.main' }}
                        >
                          {t(`transactions.status.${item.status}`, { defaultValue: item.status })}
                        </Typography>
                      )}
                    </Box>
                  </ButtonBase>
                </Box>
              );
            })}
          </Box>
        </Box>
      );
    });
}
StatementList.propTypes = {
  transactions: PropTypes.array.isRequired,
  wallets: PropTypes.array.isRequired,
  onSelect: PropTypes.func.isRequired,
  dayHeading: PropTypes.oneOf(['h2', 'h3']),
  limit: PropTypes.number,
};
