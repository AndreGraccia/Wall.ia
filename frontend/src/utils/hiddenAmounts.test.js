import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { useHiddenAmounts } from './hiddenAmounts';

let latest;
function Probe() {
  latest = useHiddenAmounts();
  return null;
}

function mount() {
  const container = document.createElement('div');
  const root = createRoot(container);
  act(() => root.render(<Probe />));
  return root;
}

beforeEach(() => window.localStorage.clear());

test('starts visible and remembers the choice across mounts', () => {
  const first = mount();
  expect(latest[0]).toBe(false);
  act(() => latest[1]());
  expect(latest[0]).toBe(true);
  act(() => first.unmount());
  mount();
  expect(latest[0]).toBe(true);
});

test('still works when the browser blocks storage', () => {
  const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  mount();
  expect(latest[0]).toBe(false);
  spy.mockRestore();
});
