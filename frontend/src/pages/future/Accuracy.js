import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Button,
  Collapse,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import HttpService from '../../services/HttpService';
import { StatBlock } from '../../components/future-ui';
import { SectionCard } from '../../components/wallet-ui';
import { dayLabel, money } from '../../utils/wallet';

/**
 * "How right was Wall.ia?" Old forecasts graded against the real balance, misses included. No finance
 * app publishes its own error; showing it is what earns trust in the numbers above.
 */
export default function Accuracy({ collapsible }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    // A secondary card: if it fails, the page stays useful without it.
    HttpService.getWithAuth('/future/accuracy')
      .then((result) => active && setData(result))
      .catch(() => active && setData(null));
    return () => {
      active = false;
    };
  }, []);

  if (!data?.since) return null;

  // Nothing graded yet: one line says when it starts, folded like the other tools so it never floats alone.
  if (!data.comparisons) {
    if (!data.firstComparisonOn) return null;
    return (
      <SectionCard title={t('future.accuracy.title')} collapsible={collapsible}>
        <Typography variant="body2" color="text.secondary" component="p" sx={{ px: 3, pb: 3 }}>
          {t('future.accuracy.waiting', {
            since: dayLabel(data.since, lang),
            first: dayLabel(data.firstComparisonOn, lang),
          })}
        </Typography>
      </SectionCard>
    );
  }

  const bias = Number(data.bias);
  let biasText = t('future.accuracy.biasNone');
  if (Math.abs(bias) >= 1)
    biasText = t(bias > 0 ? 'future.accuracy.pessimistic' : 'future.accuracy.optimistic', {
      amount: money(Math.abs(bias), lang),
    });

  return (
    <SectionCard title={t('future.accuracy.title')} collapsible={collapsible}>
      <Box sx={{ px: 3, pb: 2 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={4}>
            <StatBlock
              label={t('future.accuracy.error')}
              value={money(data.meanAbsoluteError, lang)}
              help={t('future.accuracy.errorHelp', { count: data.comparisons })}
            />
          </Grid>
          <Grid item xs={6} sm={4}>
            <StatBlock
              label={t('future.accuracy.avoided')}
              value={String(data.avoided)}
              help={t('future.accuracy.avoidedHelp')}
              emphasis={data.avoided > 0}
            />
          </Grid>
          <Grid item xs={6} sm={4}>
            <StatBlock
              label={t('future.accuracy.missed')}
              value={String(data.missed)}
              help={t('future.accuracy.missedHelp')}
              negative={data.missed > 0}
            />
          </Grid>
        </Grid>
        <Typography variant="body2" sx={{ mt: 2 }}>
          {biasText} {t('future.accuracy.why')}
        </Typography>
        <Button size="small" onClick={() => setOpen(!open)} aria-expanded={open} sx={{ mt: 1, px: 0 }}>
          {t(open ? 'future.accuracy.hide' : 'future.accuracy.show')}
        </Button>
        <Collapse in={open} unmountOnExit>
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('future.accuracy.day')}</TableCell>
                  <TableCell align="right">{t('future.accuracy.projected')}</TableCell>
                  <TableCell align="right">{t('future.accuracy.actual')}</TableCell>
                  <TableCell align="right">{t('future.accuracy.difference')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.recent.map((point) => (
                  <TableRow key={point.date}>
                    <TableCell component="th" scope="row">
                      {dayLabel(point.date, lang)}
                      <Typography variant="caption" color="text.secondary" component="p">
                        {t('future.accuracy.madeOn', { date: dayLabel(point.forecastOn, lang) })}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {money(point.projected, lang)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {money(point.actual, lang)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {money(point.error, lang)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Collapse>
      </Box>
    </SectionCard>
  );
}
Accuracy.propTypes = { collapsible: PropTypes.bool };
