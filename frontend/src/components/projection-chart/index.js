import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Box, Stack, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { visuallyHidden } from '../wallet-ui';
import { compactMoney, dayLabel, money } from '../../utils/wallet';
import { HIDDEN_AMOUNT } from '../../utils/hiddenAmounts';

const PAD = { top: 28, right: 12, bottom: 28, left: 56 };
const DASH = { dashed: '6 5', dotted: '1 5' };
// The "today" dot: the same mark as the period of the logo (components/brand).
const TODAY_R = 4.5;
const NONE = [];
// Air above and below the data, as a share of its range: the axis follows the data, not the next round number.
const AIR = 0.15;
// The smallest depth of the area below zero, in px: R$ 84 short on a R$ 4 mil scale must still show.
const MIN_HOLE = 8;

/**
 * The vertical scale: zero always in range (it is the reference), 15% air beyond the data. When the lowest
 * negative day would sit less than MIN_HOLE px under zero, the part below zero gets its own scale (lowest
 * point at MIN_HOLE px, as much air under it) and only the ticks from zero up are labelled.
 */
export function verticalScale(values, top, plotHeight) {
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  const pad = (hi - lo || Math.abs(hi) || 1) * AIR;
  const yMax = hi + pad;
  const yMin = lo < 0 ? lo - pad : 0;
  let below = (-yMin / (yMax - yMin)) * plotHeight;
  let negScale = yMin < 0 ? below / -yMin : 0;
  const stretched = lo < 0 && -lo * negScale < MIN_HOLE;
  if (stretched) {
    negScale = MIN_HOLE / -lo;
    below = MIN_HOLE * 2;
  }
  const zero = top + plotHeight - below;
  const posScale = (zero - top) / yMax;
  const y = (value) => {
    const number = Number(value);
    return number >= 0 ? zero - number * posScale : zero - number * negScale;
  };
  const ticks = niceTicks(yMin, yMax).filter((tick) => tick >= (stretched ? 0 : yMin) && tick <= yMax);
  return { y, ticks };
}

/**
 * The container width, measured before the first paint: a guessed 640 px would overflow a 375 px
 * screen for one frame and then jump. No floor either, so a 320 px screen gets a 256 px chart.
 */
function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return undefined;
    setWidth(ref.current.clientWidth);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

function niceTicks(min, max, count = 3) {
  const span = max - min || Math.abs(max) || 1;
  const raw = span / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((m) => m >= raw);
  const ticks = [];
  for (let value = Math.floor(min / step) * step; value <= max + step / 2; value += step) ticks.push(value);
  return ticks;
}

/**
 * The balance in time, the product's memorable element (docs/brand/DESIGN.md).
 * Solid line up to today (`history`), dashed `future` line after it, the area below zero tinted, and at
 * most 3 labelled marks (today, the tightest day, the next income). Certainty never depends on colour alone:
 * the projection is dashed, a simulated scenario is dotted and gets a legend.
 * The line draws itself once, on mount (600 ms); prefers-reduced-motion turns that off (globalStyles).
 */
export default function ProjectionChart({
  series,
  history = NONE,
  lowest,
  markers = NONE,
  ariaLabel,
  height = 260,
  animate = true,
  hideValues = false,
}) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const uid = useId().replace(/:/g, '');
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  // Keyboard moves are announced; pointer moves are not (one announcement per pixel would drown the page).
  const [fromKeyboard, setFromKeyboard] = useState(false);
  const ahead = useMemo(() => series[0]?.days || NONE, [series]);
  const offset = history.length;
  const all = useMemo(() => [...history, ...ahead], [history, ahead]);

  const geometry = useMemo(() => {
    const values = [...history, ...series.flatMap((item) => item.days)].map((day) => Number(day.balance));
    const plotWidth = width - PAD.left - PAD.right;
    const plotHeight = height - PAD.top - PAD.bottom;
    const x = (index) => PAD.left + (all.length <= 1 ? 0 : (index / (all.length - 1)) * plotWidth);
    const { y, ticks } = verticalScale(values, PAD.top, plotHeight);
    return { ticks, x, y, plotWidth, plotHeight };
  }, [series, history, all.length, width, height]);

  if (!ahead.length) return null;
  // Not measured yet (or no layout, as in tests): keep the height so nothing below jumps.
  if (width <= PAD.left + PAD.right) return <Box ref={ref} sx={{ width: '100%', height }} />;
  const { ticks, x, y, plotWidth, plotHeight } = geometry;
  const bottom = PAD.top + plotHeight;
  const path = (items, start) =>
    items
      .map((day, index) => `${index ? 'L' : 'M'}${x(index + start).toFixed(1)},${y(day.balance).toFixed(1)}`)
      .join('');
  const last = all.length - 1;
  const clamp = (index) => Math.min(last, Math.max(0, index));
  const indexOf = (date) => all.findIndex((day) => day.date === date);
  const lowestIndex = lowest ? indexOf(lowest.date) : -1;
  const labelEvery = Math.max(1, Math.round(all.length / (width < 520 ? 3 : 6)));

  // Marks: today first, then the tightest day, then whatever the page adds (next income). At most 3, and a
  // label that would overlap its neighbour keeps only its dot.
  const marks = [
    offset > 0 || markers.length ? { index: offset, kind: 'today', label: t('future.chartToday') } : null,
    lowestIndex >= 0
      ? {
          index: lowestIndex,
          kind: 'lowest',
          label: hideValues ? t('future.chartLowest') : `${t('future.chartLowest')} ${money(lowest.balance, lang)}`,
          negative: Number(lowest.balance) < 0,
        }
      : null,
    ...markers.map((mark) => ({ ...mark, index: indexOf(mark.date), kind: mark.kind || 'income' })),
  ]
    .filter((mark) => mark && mark.index >= 0)
    .filter((mark, i, list) => list.findIndex((other) => other.index === mark.index) === i)
    .slice(0, 3)
    .map((mark) => {
      const value = Number(all[mark.index].balance);
      const below = mark.kind === 'lowest' && y(value) < bottom - 24;
      return { ...mark, cx: x(mark.index), cy: y(value), below };
    });
  const placed = [];
  marks.forEach((mark) => {
    // ~6.5 px per character at 12 px: two labels on the same side need half their widths apart, plus air.
    mark.width = mark.label.length * 6.5;
    mark.showLabel = !placed.some(
      (other) => other.below === mark.below && Math.abs(other.cx - mark.cx) < (other.width + mark.width) / 2 + 12
    );
    if (mark.showLabel) placed.push(mark);
  });
  const anchor = (cx) => {
    if (cx < PAD.left + 48) return 'start';
    if (cx > width - PAD.right - 48) return 'end';
    return 'middle';
  };

  // Mouse and touch: a tap on a day shows it, as hovering does.
  const onPointer = (event) => {
    const box = event.currentTarget.getBoundingClientRect();
    const relative = ((event.clientX - box.left) / box.width) * width;
    setFromKeyboard(false);
    setHover(clamp(Math.round(((relative - PAD.left) / plotWidth) * last)));
  };
  // Keyboard: the chart is one tab stop; arrows walk the days, Home/End jump to the ends, Esc hides.
  const onKeyDown = (event) => {
    const current = hover ?? (lowestIndex >= 0 ? lowestIndex : offset);
    const next = {
      ArrowRight: current + 1,
      ArrowLeft: current - 1,
      ArrowUp: current + 1,
      ArrowDown: current - 1,
      PageUp: current + 7,
      PageDown: current - 7,
      Home: 0,
      End: last,
    }[event.key];
    if (event.key === 'Escape') {
      setHover(null);
      return;
    }
    if (next === undefined) return;
    event.preventDefault();
    setFromKeyboard(true);
    setHover(clamp(next));
  };
  // A day before today belongs to the history only; from today on, every series has it.
  const valuesAt = (index) =>
    index < offset
      ? [{ key: 'history', label: t('future.chartPast'), balance: history[index].balance }]
      : series.map((item) => ({ key: item.key, label: item.label, balance: item.days[index - offset]?.balance }));
  const hoverText =
    hover !== null &&
    [
      dayLabel(all[hover].date, lang, { weekday: 'short', day: '2-digit', month: 'short' }),
      ...valuesAt(hover).map((item) =>
        [series.length > 1 ? item.label : null, hideValues ? HIDDEN_AMOUNT : money(item.balance, lang)]
          .filter(Boolean)
          .join(': ')
      ),
    ].join(', ');
  const primary = series[0];
  const area = `${path(all, 0)}L${x(last).toFixed(1)},${y(0).toFixed(1)}L${x(0).toFixed(1)},${y(0).toFixed(1)}Z`;

  return (
    <Box
      ref={ref}
      sx={{
        position: 'relative',
        width: '100%',
        '& > svg:focus-visible': { outline: '2px solid', outlineColor: 'secondary.main', outlineOffset: 4 },
        '& > svg': { borderRadius: '12px' },
      }}
    >
      {series.length > 1 && (
        <Stack direction="row" spacing={2.5} sx={{ p: 0, m: 0, mb: 1 }} component="ul">
          {series.map((item) => (
            <Stack
              key={item.key}
              component="li"
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ listStyle: 'none' }}
            >
              <Box component="svg" width={24} height={8} aria-hidden>
                <line
                  x1="1"
                  y1="4"
                  x2="23"
                  y2="4"
                  stroke={item.color}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray={DASH[item.dotted ? 'dotted' : item.dashed && 'dashed']}
                />
              </Box>
              <Typography variant="caption" color="text.secondary">
                {item.label}
              </Typography>
            </Stack>
          ))}
        </Stack>
      )}
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`${ariaLabel} ${t('future.chartKeys')}`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onFocus={() => {
          setFromKeyboard(true);
          setHover((previous) => previous ?? (lowestIndex >= 0 ? lowestIndex : offset));
        }}
        onBlur={() => setHover(null)}
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onPointerLeave={(event) => event.pointerType === 'mouse' && setHover(null)}
        style={{ display: 'block', touchAction: 'pan-y' }}
      >
        <defs>
          <clipPath id={`below-${uid}`}>
            <rect x={PAD.left} y={y(0)} width={plotWidth} height={Math.max(0, bottom - y(0))} />
          </clipPath>
        </defs>
        {ticks.map((tick) => (
          <g key={tick}>
            {/* Only zero gets a line: it is the one reference that matters; the labels carry the scale. */}
            {tick === 0 && (
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(0)}
                y2={y(0)}
                stroke={theme.palette.chart.zero}
                strokeWidth={1}
              />
            )}
            <text
              x={PAD.left - 10}
              y={y(tick) + 4}
              textAnchor="end"
              fontSize="11"
              fill={tick === 0 ? theme.palette.text.secondary : theme.palette.text.disabled}
            >
              {tick === 0 ? t('future.chartZero') : !hideValues && compactMoney(tick, lang)}
            </text>
          </g>
        ))}
        {all.map((day, index) =>
          index % labelEvery === 0 ? (
            <text
              key={day.date}
              x={x(index)}
              y={height - 8}
              textAnchor={anchor(x(index))}
              fontSize="11"
              fill={theme.palette.text.disabled}
            >
              {dayLabel(day.date, lang)}
            </text>
          ) : null
        )}
        <g>
          {/* the hole: between the line and zero, only where the balance is below zero */}
          <path d={area} fill={theme.palette.chart.negative} clipPath={`url(#below-${uid})`} />
          {offset > 0 && (
            <path
              d={path([...history, ahead[0]], 0)}
              fill="none"
              stroke={theme.palette.chart.history}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          {series.map((item) => (
            <path
              key={item.key}
              d={path(item.days, offset)}
              fill="none"
              stroke={item.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={DASH[item.dotted ? 'dotted' : item.dashed && 'dashed']}
            />
          ))}
          {series.length > 1 &&
            series.map((item) => (
              <text
                key={`${item.key}-label`}
                x={width - PAD.right - 4}
                y={y(item.days[item.days.length - 1].balance) - 8}
                textAnchor="end"
                fontSize="11"
                fill={theme.palette.text.secondary}
              >
                {item.label}
              </text>
            ))}
          {marks.map((mark) => (
            <g key={`${mark.kind}-${mark.index}`}>
              <circle
                cx={mark.cx}
                cy={mark.cy}
                r={mark.kind === 'today' ? TODAY_R : 3.5}
                fill={
                  // eslint-disable-next-line no-nested-ternary
                  mark.kind === 'today'
                    ? theme.palette.brand.future
                    : mark.negative
                    ? theme.palette.error.main
                    : theme.palette.text.primary
                }
                stroke={theme.palette.background.default}
                strokeWidth={2}
              />
              {mark.showLabel && (
                <text
                  x={mark.cx}
                  y={mark.below ? mark.cy + 20 : mark.cy - 12}
                  textAnchor={anchor(mark.cx)}
                  fontSize="12"
                  fontWeight={500}
                  fill={mark.negative ? theme.palette.error.main : theme.palette.text.secondary}
                >
                  {mark.label}
                </text>
              )}
            </g>
          ))}
        </g>
        {/* The draw-in: a page-coloured cover slides off the plot, left to right, once on mount. A rendered
            element on purpose: Chrome does not run CSS animations inside <clipPath>. */}
        {animate && (
          <rect
            aria-hidden="true"
            x={PAD.left - 8}
            y={0}
            width={width - PAD.left + 8}
            height={bottom + 4}
            fill={theme.palette.background.default}
            style={{
              pointerEvents: 'none',
              transformBox: 'fill-box',
              transformOrigin: 'right',
              animation: 'wallia-reveal 600ms cubic-bezier(0.2, 0.7, 0.2, 1) both',
            }}
          />
        )}
        {hover !== null && (
          <g>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD.top}
              y2={bottom}
              stroke={theme.palette.text.disabled}
              strokeDasharray="2 3"
            />
            {(hover < offset ? [{ key: 'history', color: theme.palette.chart.history }] : series).map((item) => (
              <circle
                key={item.key}
                cx={x(hover)}
                cy={y(hover < offset ? history[hover].balance : item.days[hover - offset].balance)}
                r={4}
                fill={item.color}
                stroke={theme.palette.background.default}
                strokeWidth={2}
              />
            ))}
          </g>
        )}
      </svg>
      <Box role="status" aria-live="polite" sx={visuallyHidden}>
        {fromKeyboard && hoverText}
      </Box>
      {hover !== null && (
        <Box
          aria-hidden="true"
          sx={{
            position: 'absolute',
            top: series.length > 1 ? 32 : 0,
            left: Math.min(Math.max(x(hover) + 12, 0), width - 184),
            pointerEvents: 'none',
            bgcolor: 'background.raised',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: '8px',
            px: 1.5,
            py: 1,
            minWidth: 160,
          }}
        >
          <Typography variant="caption" color="text.secondary" component="p">
            {dayLabel(all[hover].date, lang, { weekday: 'short', day: '2-digit', month: 'short' })}
          </Typography>
          {valuesAt(hover).map((item) => (
            <Stack key={item.key} direction="row" justifyContent="space-between" spacing={2}>
              {series.length > 1 && (
                <Typography variant="caption" color="text.secondary">
                  {item.label}
                </Typography>
              )}
              <Typography
                variant="subtitle2"
                sx={{ color: Number(item.balance) < 0 ? 'error.main' : 'text.primary', fontWeight: 600 }}
              >
                {hideValues ? HIDDEN_AMOUNT : money(item.balance, lang)}
              </Typography>
            </Stack>
          ))}
        </Box>
      )}
      {/* Without a legend for one series, the line style still has a name. */}
      {series.length === 1 && (
        <Stack direction="row" spacing={2.5} sx={{ mt: 1, pl: `${PAD.left}px` }} aria-hidden="true">
          {[
            offset > 0 && [t('future.chartPast'), theme.palette.chart.history, undefined],
            [t('future.chartAhead'), primary.color, DASH.dashed],
          ]
            .filter(Boolean)
            .map(([label, color, dash]) => (
              <Stack key={label} direction="row" spacing={1} alignItems="center">
                <svg width={20} height={8}>
                  <line x1="1" y1="4" x2="19" y2="4" stroke={color} strokeWidth="2" strokeDasharray={dash} />
                </svg>
                <Typography variant="caption" color="text.secondary">
                  {label}
                </Typography>
              </Stack>
            ))}
        </Stack>
      )}
    </Box>
  );
}

const dayShape = PropTypes.shape({ date: PropTypes.string, balance: PropTypes.number });

ProjectionChart.propTypes = {
  series: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string,
      color: PropTypes.string.isRequired,
      dashed: PropTypes.bool,
      dotted: PropTypes.bool,
      days: PropTypes.arrayOf(dayShape).isRequired,
    })
  ).isRequired,
  /** Days before today, drawn solid. The first series starts at today. */
  history: PropTypes.arrayOf(dayShape),
  lowest: dayShape,
  /** Extra labelled marks (e.g. the next income); the chart keeps at most 3 in total. */
  markers: PropTypes.arrayOf(
    PropTypes.shape({ date: PropTypes.string, label: PropTypes.string, kind: PropTypes.string })
  ),
  ariaLabel: PropTypes.string.isRequired,
  height: PropTypes.number,
  /** The one draw-in of the screen; secondary charts (simulator) pass false. Assumes the page background. */
  animate: PropTypes.bool,
  /** "Ocultar saldo": keeps the shape, drops every amount (axis, marks, readout). */
  hideValues: PropTypes.bool,
};
