import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { ListRow } from '.';

let root;
let container;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

test('the whole line opens the detail, named by its title, and a control in aside stays its own button', () => {
  const choose = jest.fn();
  act(() =>
    root.render(
      <ListRow
        title="Fatura de novembro"
        titleComponent="h3"
        value="R$ 300,00"
        aside={
          <button type="button" onClick={choose}>
            Escolher
          </button>
        }
        detail={<p>itens da fatura</p>}
      />
    )
  );
  const toggle = container.querySelector('[aria-expanded]');
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  // Named by the title, which keeps its heading.
  const title = container.querySelector('h3');
  expect(toggle.getAttribute('aria-labelledby')).toBe(title.id);
  expect(document.getElementById(toggle.getAttribute('aria-controls')).textContent).toBe('itens da fatura');
  // No button inside the toggle.
  expect(toggle.querySelector('button')).toBeNull();

  act(() => toggle.click());
  expect(toggle.getAttribute('aria-expanded')).toBe('true');

  act(() => container.querySelector('button:not([aria-expanded])').click());
  expect(choose).toHaveBeenCalled();
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
});

test('a line without detail is plain text, no button', () => {
  act(() => root.render(<ListRow title="Mercado" value="R$ 10,00" />));
  expect(container.querySelector('button')).toBeNull();
  expect(container.textContent).toContain('Mercado');
});
