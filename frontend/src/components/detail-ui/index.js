import { useId, useState } from 'react';
import PropTypes from 'prop-types';
import { Box, ButtonBase, Collapse, IconButton, Stack, Typography } from '@mui/material';
import { WalletIcon } from '../wallet-ui';

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
 * `detail` hangs there too, folded behind a chevron at the end of the line (`detailLabel` names that button);
 * it stays mounted while folded, like Disclosure.
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
  return (
    <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ minHeight: 56, py: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" component={titleComponent} sx={{ m: 0, overflowWrap: 'anywhere' }}>
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
            {aside}
          </Stack>
        )}
        {detail && (
          <IconButton
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls={id}
            aria-label={detailLabel}
            sx={{ flexShrink: 0, width: 40, height: 40, mr: -1, color: 'text.secondary' }}
          >
            <WalletIcon
              name="chevron"
              sx={{
                fontSize: 20,
                transition: 'transform 150ms',
                transform: open ? 'rotate(180deg)' : 'none',
                '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
              }}
            />
          </IconButton>
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
