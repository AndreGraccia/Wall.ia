import { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Alert, Box, Button, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import HttpService from '../../services/HttpService';
import { dayLabel, errorKey, money, percent } from '../../utils/wallet';

// Fixed and Leisure are measured, never committed: their money is already in the projection (ADR 0021).
const committable = (slice) => slice.kind !== 'FIXED' && slice.kind !== 'LEISURE';
/** The preset with every slice that can be set aside marked: the hypothesis the screen states before simulating. */
const hypothesis = (preset) => ({
  slices: preset.map((slice) => ({
    kind: slice.kind,
    label: slice.label,
    percent: Number(slice.percent),
    commitment: committable(slice),
  })),
});

/**
 * Two methods side by side before choosing (ADR 0025). Texts come from the catalog; the numbers come from
 * `POST /plan/fit`, which saves nothing.
 */
export default function MethodCompare({ methods, initial, nameOf }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [ids, setIds] = useState(() => {
    const [first = methods[0]?.id, second] = initial;
    return [first, second ?? methods.find((item) => item.id !== first)?.id];
  });
  const [simulation, setSimulation] = useState(null);
  const request = useRef(0);
  const pair = ids.map((id) => methods.find((item) => item.id === id));
  if (pair.some((method) => !method)) return null;
  const sliced = pair.filter((method) => method.preset?.length > 0);

  const pick = (index, id) => {
    // An answer about the previous pair must not stay under the new one.
    request.current += 1;
    setSimulation(null);
    setIds(ids.map((current, position) => (position === index ? id : current)));
  };

  const simulate = async () => {
    request.current += 1;
    const mine = request.current;
    setSimulation({ loading: true });
    try {
      const results = await Promise.all(
        sliced.map(async (method) => [
          method.id,
          await HttpService.postWithAuth('/plan/fit', hypothesis(method.preset)),
        ])
      );
      if (mine === request.current) setSimulation({ results: Object.fromEntries(results) });
    } catch (error) {
      if (mine === request.current) setSimulation({ error: errorKey(error) });
    }
  };

  const text = (method, key, fallback) => t(`method.catalog.${method.id}.${key}`, { defaultValue: fallback });
  const baseline = simulation?.results && Object.values(simulation.results)[0]?.baseline;

  const outcome = (method) => {
    if (!method.preset?.length) return t('method.compare.noSlices');
    const result = simulation?.results?.[method.id];
    if (!result) return t(simulation?.loading ? 'method.compare.simulating' : 'method.compare.notSimulated');
    return (
      <>
        <span>{t('method.compare.negativeDays', { days: result.scenario.negativeDays })}</span>
        <br />
        <span>
          {t('method.compare.lowest', {
            amount: money(result.scenario.minBalance90, lang),
            date: dayLabel(result.scenario.minDate, lang),
          })}
        </span>
        <br />
        <span>{t('method.compare.commitment', { amount: money(result.newMonthlyCommitment, lang) })}</span>
      </>
    );
  };

  const rows = [
    ['method.how', (method) => text(method, 'how', method.howItWorks)],
    ['method.helps', (method) => text(method, 'helps', method.helpsWhen)],
    ['method.limits', (method) => text(method, 'limits', method.limitations)],
    ['method.compare.effort', (method) => t(`method.compare.efforts.${method.effort}`)],
    ['method.compare.result', outcome],
  ];
  const cell = { p: 0, py: 1, pr: 2, verticalAlign: 'top', textAlign: 'left', overflowWrap: 'anywhere' };

  return (
    <Stack spacing={2} sx={{ px: 3, pb: 3 }}>
      <Box sx={{ display: 'flex', gap: 1.5, flexDirection: { xs: 'column', sm: 'row' } }}>
        {ids.map((id, index) => (
          <TextField
            // eslint-disable-next-line react/no-array-index-key
            key={index}
            select
            label={t(index === 0 ? 'method.compare.first' : 'method.compare.second')}
            value={id}
            onChange={(event) => pick(index, event.target.value)}
            sx={{ flex: 1 }}
          >
            {methods.map((method) => (
              // The other side's method is not offered: comparing a method with itself says nothing.
              <MenuItem key={method.id} value={method.id} disabled={method.id === ids[1 - index]}>
                {nameOf(method.id)}
              </MenuItem>
            ))}
          </TextField>
        ))}
      </Box>

      <Box component="table" sx={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {pair.map((method) => (
              <Typography key={method.id} component="th" scope="col" variant="subtitle2" sx={cell}>
                {nameOf(method.id)}
              </Typography>
            ))}
          </tr>
        </thead>
        {rows.map(([label, value]) => (
          <tbody key={label}>
            <Box component="tr" sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
              <Typography
                component="th"
                colSpan={2}
                scope="colgroup"
                variant="caption"
                color="text.secondary"
                sx={{ ...cell, pb: 0 }}
              >
                {t(label)}
              </Typography>
            </Box>
            <Box component="tr" sx={{ height: 56 }}>
              {pair.map((method) => (
                <Typography key={method.id} component="td" variant="body2" sx={cell}>
                  {value(method)}
                </Typography>
              ))}
            </Box>
          </tbody>
        ))}
      </Box>

      {sliced.length > 0 && (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {t('method.compare.assumption')}
          </Typography>
          {sliced.map((method) => (
            <Typography key={method.id} variant="body2" color="text.secondary">
              {nameOf(method.id)}:{' '}
              {method.preset
                .filter(committable)
                .map((slice) => `${slice.label} ${percent(slice.percent, lang)}`)
                .join(', ')}
            </Typography>
          ))}
          <Button variant="outlined" onClick={simulate} disabled={Boolean(simulation?.loading)} sx={{ mt: 1.5 }}>
            {t('method.compare.simulate')}
          </Button>
        </Box>
      )}
      <Box aria-live="polite">
        {simulation?.error && <Alert severity="error">{t(simulation.error)}</Alert>}
        {baseline && (
          <Typography variant="body2">
            {t('method.compare.baseline', {
              days: baseline.negativeDays,
              amount: money(baseline.minBalance90, lang),
            })}
          </Typography>
        )}
      </Box>
    </Stack>
  );
}
MethodCompare.propTypes = {
  methods: PropTypes.array.isRequired,
  initial: PropTypes.array.isRequired,
  nameOf: PropTypes.func.isRequired,
};
