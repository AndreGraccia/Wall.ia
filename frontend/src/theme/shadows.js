// Depth comes from surface layers (palette.background). The only shadow is for things that float over the
// page (menus, popovers, dialogs); MUI's elevation scale maps to it so no component invents its own.
export const FLOATING = '0 16px 40px -12px rgba(0, 0, 0, 0.72)';

export default function shadows() {
  return ['none', ...Array(24).fill(FLOATING)];
}
