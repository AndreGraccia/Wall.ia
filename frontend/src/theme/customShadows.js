import { FLOATING } from './shadows';

// Panels never cast a shadow (DESIGN.md: depth by layer, not by shadow); floating layers share one.
export default function customShadows() {
  return { card: 'none', dialog: FLOATING, dropdown: FLOATING };
}
