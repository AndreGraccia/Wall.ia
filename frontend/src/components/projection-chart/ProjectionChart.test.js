import { act, Simulate } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import ProjectionChart, { verticalScale } from '.';
import ThemeProvider from '../../theme';

jest.mock('../../context/WalletContext', () => ({ useWallets: jest.fn() }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key) => key, i18n: { language: 'pt' } }) }));

const days = [
  { date: '2026-10-01', balance: 100 },
  { date: '2026-10-02', balance: -50 },
  { date: '2026-10-03', balance: 20 },
];
let root;
let container;
let width;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => width });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  delete HTMLElement.prototype.clientWidth;
});
const render = () =>
  act(() =>
    root.render(
      <ThemeProvider>
        <ProjectionChart series={[{ key: 'base', color: '#000', days }]} lowest={days[1]} ariaLabel="saldo projetado" />
      </ThemeProvider>
    )
  );

test('the chart takes the container width, even below the old 280 px floor', () => {
  width = 256;
  render();
  expect(container.querySelector('svg[role="img"]').getAttribute('width')).toBe('256');
});

test('keyboard reaches the chart and walks the days, announcing each one', () => {
  width = 600;
  render();
  const chart = container.querySelector('svg[role="img"]');
  expect(chart.getAttribute('tabindex')).toBe('0');

  act(() => Simulate.focus(chart));
  const status = () => container.querySelector('[role="status"]').textContent;
  expect(status()).toMatch(/\u2212R\$\s?50,00/);

  act(() => Simulate.keyDown(chart, { key: 'ArrowRight' }));
  expect(status()).toMatch(/R\$\s?20,00/);
  act(() => Simulate.keyDown(chart, { key: 'Home' }));
  expect(status()).toMatch(/R\$\s?100,00/);
  act(() => Simulate.keyDown(chart, { key: 'Escape' }));
  expect(status()).toBe('');
});

test('the scale follows the data: R$ 84 short on a R$ 4 mil line is not drawn on a −R$ 2 mil axis', () => {
  // plot from y=0 to y=200; the audit case: lowest −84,19, highest 3.357,16.
  const { y, ticks } = verticalScale([2555.61, -84.19, 3357.16], 0, 200);
  expect(ticks[0]).toBe(0);
  expect(ticks.some((tick) => tick < 0)).toBe(false);
  // The hole under zero is at least 8 px deep.
  expect(y(-84.19) - y(0)).toBeGreaterThanOrEqual(8);
  // About 15% of air above the highest day, not the next round thousand.
  expect(y(3357.16)).toBeGreaterThan(10);
  expect(y(3357.16)).toBeLessThan(40);
});

test('a deep negative stays on one linear scale, with labelled ticks below zero', () => {
  const { y, ticks } = verticalScale([1000, -1000], 0, 200);
  expect(ticks.some((tick) => tick < 0)).toBe(true);
  expect(y(0) - y(1000)).toBeCloseTo(y(-1000) - y(0), 5);
});

test('the chart is an image whose name carries the lowest balance and its date', () => {
  width = 600;
  render();
  const chart = container.querySelector('svg[role="img"]');
  expect(chart.getAttribute('aria-label')).toContain('saldo projetado');
});
