import PropTypes from 'prop-types';
import { Box, Stack } from '@mui/material';

// "Farol" mark: a W drawn as a balance line over the waterline (zero). The past is solid; the lamp dot is
// today; from there the line is a dashed estimate that dips below the waterline — the hole between the
// card bill and the paycheck — and comes back up. Same geometry as public/favicon.svg and
// scripts/build-icons.py — change all three together.
export const MARK = {
  waterline: { x1: 3.5, x2: 28.5, y: 19 },
  past: '6,8.5 10.5,16.5 15.5,11',
  ahead: '15.5,11 20.5,24 25.5,12',
  today: { cx: 15.5, cy: 11, r: 2.7 },
};

export function WalliaMark({ size = 32, title }) {
  const { waterline, today } = MARK;
  return (
    <Box
      component="svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      sx={{ display: 'block', flexShrink: 0 }}
    >
      <Box component="rect" width="32" height="32" rx="9" sx={{ fill: (theme) => theme.palette.background.neutral }} />
      <Box
        component="line"
        x1={waterline.x1}
        x2={waterline.x2}
        y1={waterline.y}
        y2={waterline.y}
        strokeWidth="1.2"
        strokeLinecap="round"
        sx={{ stroke: (theme) => theme.palette.brand.waterline }}
      />
      <Box
        component="polyline"
        points={MARK.ahead}
        fill="none"
        strokeWidth="2.3"
        pathLength="100"
        strokeDasharray="12 9"
        strokeDashoffset="17.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        sx={{ stroke: (theme) => theme.palette.brand.fog }}
      />
      <Box
        component="polyline"
        points={MARK.past}
        fill="none"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        sx={{ stroke: (theme) => theme.palette.text.primary }}
      />
      <Box component="circle" {...today} sx={{ fill: (theme) => theme.palette.brand.lamp }} />
    </Box>
  );
}
WalliaMark.propTypes = { size: PropTypes.number, title: PropTypes.string };

export function WalliaLogo({ size = 32, hideWordmark = false }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1.25} sx={{ color: 'text.primary' }}>
      <WalliaMark size={size} title={hideWordmark ? 'Wall.ia' : undefined} />
      {!hideWordmark && (
        <Box
          component="span"
          sx={{
            fontFamily: (theme) => theme.typography.h6.fontFamily,
            fontWeight: 700,
            fontSize: size * 0.64,
            letterSpacing: '-0.02em',
            lineHeight: 1,
          }}
        >
          Wall
          <Box component="span" sx={{ color: 'brand.lamp' }}>
            .
          </Box>
          ia
        </Box>
      )}
    </Stack>
  );
}
WalliaLogo.propTypes = { size: PropTypes.number, hideWordmark: PropTypes.bool };
