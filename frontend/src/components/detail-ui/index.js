import { useId, useState } from 'react';
import PropTypes from 'prop-types';
import { Box, ButtonBase, Collapse, Stack, Typography } from '@mui/material';
import { WalletIcon } from '../wallet-ui';
import { COARSE, TOUCH_TARGET } from '../../theme/touch';

/**
 * "Where did this come from?" behind one tertiary button (DESIGN.md: explanation goes to a disclosure).
 * The content stays mounted while closed: the evidence is in the document for screen readers that browse
 * by search, and Collapse hides it from everyone else.
 */
export function Disclosure({ label, defaultOpen = false, children, sx }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <Box sx={sx}>
      <ButtonBase
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={id}
        sx={{
          minHeight: 40,
          [COARSE]: { minHeight: TOUCH_TARGET },
          gap: 0.5,
          px: 0.5,
          ml: -0.5,
          borderRadius: '8px',
          font: 'inherit',
          typography: 'body2',
          fontWeight: 500,
          color: 'text.secondary',
          '&:hover': { color: 'text.primary', textDecoration: 'underline' },
          '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'secondary.main' },
        }}
      >
        {label}
        <WalletIcon
          name="chevron"
          aria-hidden
          sx={{
            fontSize: 18,
            transition: 'transform 150ms',
            transform: open ? 'rotate(180deg)' : 'none',
            '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
          }}
        />
      </ButtonBase>
      <Collapse in={open} timeout={150}>
        <Box id={id} sx={{ pt: 1 }}>
          {children}
        </Box>
      </Collapse>
    </Box>
  );
}
Disclosure.propTypes = {
  label: PropTypes.node.isRequired,
  defaultOpen: PropTypes.bool,
  children: PropTypes.node,
  sx: PropTypes.object,
};

/**
 * One line of a reading list (DESIGN.md "Listas"): 56 px, divider below, what and when on the left, the tabular
 * value on the right with an optional seal under it. `children` hang under the line, full width, always shown.
 * `detail` hangs there too, folded: then the whole line opens it. The button is a layer under the text, named by the
 * title, so the title keeps its heading, and a control in `aside` (Method's "Escolher") stays its own button instead
 * of a button inside a button. The chevron only shows the state. The detail stays mounted while folded, like
 * Disclosure. `detailLabel`, when given, names the button ("Ver evidências de Netflix"); otherwise the title does.
 */
export function ListRow({
  title,
  meta,
  value,
  valueColor = 'text.primary',
  aside,
  children,
  detail,
  detailLabel,
  titleComponent = 'p',
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const titleId = `${id}-title`;
  return (
    <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
      <Stack
        direction="row"
        alignItems="center"
        sx={{
          gap: 2,
          minHeight: 56,
          py: 1,
          position: 'relative',
          // Text lets the click through to the button below; a control in `aside` keeps its own.
          ...(detail && { '& > :not(.list-row-toggle)': { position: 'relative', pointerEvents: 'none' } }),
        }}
      >
        {detail && (
          <ButtonBase
            className="list-row-toggle"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls={id}
            aria-label={detailLabel}
            aria-labelledby={detailLabel ? undefined : titleId}
            sx={{
              position: 'absolute',
              inset: 0,
              mx: -1,
              borderRadius: '12px',
              '&:hover': { bgcolor: 'background.neutral' },
              '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'secondary.main', outlineOffset: -2 },
            }}
          />
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            id={titleId}
            variant="subtitle2"
            component={titleComponent}
            sx={{ m: 0, overflowWrap: 'anywhere' }}
          >
            {title}
          </Typography>
          {meta && (
            <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.25 }}>
              {meta}
            </Typography>
          )}
        </Box>
        {(value !== undefined || aside) && (
          <Stack alignItems="flex-end" spacing={0.5} sx={{ flexShrink: 0, maxWidth: '60%', textAlign: 'right' }}>
            {value !== undefined && (
              <Typography
                variant="subtitle2"
                component="p"
                sx={{ m: 0, fontWeight: 600, color: valueColor, fontVariantNumeric: 'tabular-nums' }}
              >
                {value}
              </Typography>
            )}
            {aside && <Box sx={{ pointerEvents: 'auto' }}>{aside}</Box>}
          </Stack>
        )}
        {detail && (
          <WalletIcon
            name="chevron"
            aria-hidden
            sx={{
              flexShrink: 0,
              fontSize: 20,
              color: 'text.secondary',
              transition: 'transform 150ms',
              transform: open ? 'rotate(180deg)' : 'none',
              '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
            }}
          />
        )}
      </Stack>
      {children && <Box sx={{ pb: 2 }}>{children}</Box>}
      {detail && (
        <Collapse in={open} timeout={150}>
          <Box id={id} sx={{ pb: 2 }}>
            {detail}
          </Box>
        </Collapse>
      )}
    </Box>
  );
}
ListRow.propTypes = {
  title: PropTypes.node.isRequired,
  meta: PropTypes.node,
  value: PropTypes.node,
  valueColor: PropTypes.string,
  aside: PropTypes.node,
  children: PropTypes.node,
  detail: PropTypes.node,
  detailLabel: PropTypes.string,
  titleComponent: PropTypes.string,
};
