import PropTypes from 'prop-types';
import { Box, ButtonBase, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { directionFor, localeFor, money } from '../../utils/wallet';

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
 * A statement as a bank app shows it: entries grouped by month, one 56 px row each with the day on the left (the
 * same column as the Future list), description in the middle and the signed amount, tabular, on the right.
 * Status only appears when it is not "done", and in words, not colour. Grouping by day would put a header over
 * almost every row in a real account, where most days have one entry.
 * `dayHeading` keeps the outline right: h2 under the page title, h3 inside a titled section.
 */
export default function StatementList({ transactions, wallets, onSelect, dayHeading = 'h2' }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const months = [];
  transactions.forEach((item) => {
    const day = parts(item.createdAt);
    const key = day ? `${day[0]}-${day[1]}` : '';
    if (months.at(-1)?.key !== key) months.push({ key, day, items: [] });
    months.at(-1).items.push({ item, day });
  });

  return months.map((month) => (
    <Box component="section" key={month.key || 'unknown'} sx={{ '& + &': { mt: 4 } }}>
      <Typography
        component={dayHeading}
        variant="body2"
        color="text.secondary"
        sx={{ fontWeight: 500, pb: 1, borderBottom: '1px solid', borderColor: 'divider' }}
      >
        {monthText(month.day, lang)}
      </Typography>
      <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
        {month.items.map(({ item, day }) => {
          const direction = directionFor(item, wallets);
          const success = item.status === 'SUCCESS';
          const sign = success && direction === 'incoming' ? '+ ' : success && direction === 'outgoing' ? '− ' : '';
          const type = t(`app.types.${item.type?.name}`, { defaultValue: t('app.types.Transfer') });
          // Imported entries carry the counterparty ("Netflix"); that says more than the generic type.
          const named = item.description && item.description !== 'Initial balance';
          return (
            <Box component="li" key={item.id} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
              <ButtonBase
                onClick={() => onSelect(item)}
                sx={{
                  width: '100%',
                  minHeight: 56,
                  py: 1,
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
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="subtitle2" noWrap component="span" sx={{ display: 'block' }}>
                    {named ? item.description : type}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    noWrap
                    component="span"
                    sx={{ display: 'block' }}
                  >
                    {named ? type : ''}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
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
  ));
}
StatementList.propTypes = {
  transactions: PropTypes.array.isRequired,
  wallets: PropTypes.array.isRequired,
  onSelect: PropTypes.func.isRequired,
  dayHeading: PropTypes.oneOf(['h2', 'h3']),
};
