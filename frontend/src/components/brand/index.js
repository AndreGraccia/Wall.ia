import PropTypes from 'prop-types';
import { Box } from '@mui/material';

/**
 * "Wall.ia" in Geist 600 (docs/brand/DESIGN.md). The period is a `future` circle, the same mark as the
 * "today" dot of the balance chart. No separate symbol inside the app; the favicon (public/favicon.svg) is
 * the dot over the line.
 */
export function WalliaLogo({ size = 22 }) {
  return (
    <Box
      component="span"
      role="img"
      aria-label="Wall.ia"
      sx={{
        display: 'inline-flex',
        alignItems: 'baseline',
        color: 'text.primary',
        fontWeight: 600,
        fontSize: size,
        letterSpacing: '-0.03em',
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      <span aria-hidden="true">Wall</span>
      <Box
        component="span"
        aria-hidden="true"
        sx={{
          width: '0.34em',
          height: '0.34em',
          mx: '0.06em',
          borderRadius: '50%',
          bgcolor: 'brand.future',
          flexShrink: 0,
        }}
      />
      <span aria-hidden="true">ia</span>
    </Box>
  );
}
WalliaLogo.propTypes = { size: PropTypes.number };
