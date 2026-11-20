import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import BankDataNotice from '.';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, options) => (options ? `${key}:${JSON.stringify(options)}` : key),
    i18n: { language: 'pt' },
  }),
}));

let root;
let container;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  root = createRoot(container);
});
afterEach(() => act(() => root.unmount()));

const render = (bankData) =>
  act(() =>
    root.render(
      <MemoryRouter>
        <BankDataNotice bankData={bankData} />
      </MemoryRouter>
    )
  );

test('without bank data there is nothing to say', () => {
  render(null);
  expect(container.textContent).toBe('');
});

test('fresh data names the institution and the sync time, without a warning', () => {
  render({ institution: 'Banco Aurora', asOf: '2026-11-19T10:30:00Z', stale: false, staleAfterHours: 36 });
  expect(container.textContent).toContain('bankData.asOf');
  expect(container.textContent).toContain('Banco Aurora');
  expect(container.querySelector('[role="alert"]')).toBeNull();
});

test('late data warns with the institution, the last sync and the limit, and links to refresh', () => {
  render({ institution: 'Banco Boreal', asOf: '2026-11-17T10:30:00Z', stale: true, staleAfterHours: 36 });
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
  expect(container.textContent).toContain('bankData.staleTitle');
  expect(container.textContent).toContain('Banco Boreal');
  expect(container.textContent).toContain('"hours":36');
  expect(container.querySelector('a[href="/open-finance"]')).not.toBeNull();
});

test('an account that never synced says so instead of showing a date', () => {
  render({ institution: 'Banco Boreal', asOf: null, stale: true, staleAfterHours: 36 });
  expect(container.textContent).toContain('bankData.neverSynced');
});
