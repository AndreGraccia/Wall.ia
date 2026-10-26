import { act, Simulate } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import Future from './Future';
import ThemeProvider from '../../theme';
import HttpService from '../../services/HttpService';

jest.mock('../../services/HttpService', () => ({ getWithAuth: jest.fn(), putWithAuth: jest.fn(), postWithAuth: jest.fn() }));
jest.mock('../../context/WalletContext', () => ({ useWallets: jest.fn() }));
jest.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: jest.fn(), closeSnackbar: jest.fn() }) }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, options) => (options?.days ? `${key}:${options.days}` : key),
    i18n: { language: 'pt' },
  }),
}));

let root;
let container;
const text = () => container.textContent;
const button = (label) => [...container.querySelectorAll('button')].find((item) => item.textContent === label);

function overview({ balance = 1000, sources = {}, dailySpending = {} } = {}) {
  return {
    balance,
    freeAfterCommitments: balance,
    committed: { total: 0, confirmed: 0, estimated: 0, until: '2026-10-24', groups: [] },
    projection: {
      riskWindows: [],
      days: [],
      events: [],
      minBalance: balance,
      minDate: '2026-09-25',
      endBalance: balance,
    },
    sources: { accounts: 1, cards: 0, loans: 0, confirmedRecurrences: 1, pendingQuestions: 0, ...sources },
    spendingLimit: null,
    dailySpending: { status: 'CONFIRMED', suggestedDaily: 20, appliedDaily: 20, top: [], ...dailySpending },
    cardSpending: null,
    exitPlan: [],
  };
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  HttpService.getWithAuth.mockReset();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function answer(overviewFor) {
  HttpService.getWithAuth.mockImplementation((url) => {
    if (url.startsWith('/future/overview')) return overviewFor(Number(url.split('=')[1]));
    return Promise.resolve([]);
  });
}

async function renderPage() {
  await act(async () =>
    root.render(
      <MemoryRouter>
        <HelmetProvider>
          <ThemeProvider>
            <Future />
          </ThemeProvider>
        </HelmetProvider>
      </MemoryRouter>
    )
  );
}

test('without any data the page says so and points to Open Finance instead of showing R$ 0,00', async () => {
  answer(() => Promise.resolve(overview({ balance: 0, sources: { confirmedRecurrences: 0, pendingQuestions: 0 } })));
  await renderPage();

  expect(text()).toContain('future.noData');
  expect(text()).not.toContain('future.balanceNow');
  expect(container.querySelector('a[href="/open-finance"]')).not.toBeNull();
});

test('a late answer for an older horizon does not replace the one on screen', async () => {
  const slow90 = deferred();
  answer((days) => {
    if (days === 90) return slow90.promise;
    return Promise.resolve(overview({ balance: days === 60 ? 6060 : 3030 }));
  });
  await renderPage();

  await act(async () => Simulate.click(button('future.horizonShort:90')));
  await act(async () => Simulate.click(button('future.horizonShort:60')));
  await act(async () => slow90.resolve(overview({ balance: 9090 })));

  expect(text()).toContain('6.060,00');
  expect(text()).not.toContain('9.090,00');
});

test('everyday spending without history can still be declined, and "yes" is not offered', async () => {
  answer(() =>
    Promise.resolve(
      overview({
        dailySpending: { status: 'PENDING', suggestedDaily: null, appliedDaily: null },
        sources: { pendingQuestions: 1 },
      })
    )
  );
  await renderPage();

  expect(button('future.daily.no')).toBeDefined();
  expect(button('future.daily.yes')).toBeUndefined();
});

test('a failure in /recurrences keeps the projection and shows the error only in the questions section', async () => {
  HttpService.getWithAuth.mockImplementation((url) =>
    url.startsWith('/future/overview')
      ? Promise.resolve(overview({ balance: 4242 }))
      : Promise.reject(Object.assign(new Error('boom'), { response: { status: 500 } }))
  );
  await renderPage();

  expect(text()).toContain('4.242,00');
  expect(text()).toContain('future.questionsError');
  expect(text()).toContain('app.errors.server');

  HttpService.getWithAuth.mockImplementation((url) =>
    Promise.resolve(url.startsWith('/future/overview') ? overview({ balance: 4242 }) : [])
  );
  await act(async () => Simulate.click(button('app.retry')));
  expect(text()).not.toContain('future.questionsError');
});

test('on a phone the tools fold behind one row each and the answer stays open', async () => {
  const original = window.matchMedia;
  window.matchMedia = (query) => ({
    matches: query.includes('max-width'),
    media: query,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  try {
    answer(() => Promise.resolve(overview({ balance: 4242 })));
    await renderPage();

    expect(text()).toContain('4.242,00');
    const simulator = button('future.simulatorTitle+');
    expect(simulator.getAttribute('aria-expanded')).toBe('false');
    expect(button('future.goals.title+')).toBeDefined();
    expect(container.querySelector('input')).toBeNull();

    await act(async () => Simulate.click(simulator));
    expect(simulator.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('input')).not.toBeNull();
  } finally {
    window.matchMedia = original;
  }
});

test('bank data older than a daily sync warns before the numbers and points to Open Finance', async () => {
  answer(() => Promise.resolve(overview({ sources: { bankDataAsOf: '2026-09-20T10:30:00Z', bankDataStale: true } })));
  await renderPage();

  expect(text()).toContain('future.bankDataStaleTitle');
  expect(text().indexOf('future.bankDataStaleTitle')).toBeLessThan(text().indexOf('future.balanceNow'));
  expect(container.querySelector('a[href="/open-finance"]')).not.toBeNull();
});

test('fresh bank data only says when it is from', async () => {
  answer(() => Promise.resolve(overview({ sources: { bankDataAsOf: '2026-09-25T10:30:00Z', bankDataStale: false } })));
  await renderPage();

  expect(text()).toContain('future.bankDataAsOf');
  expect(text()).not.toContain('future.bankDataStaleTitle');
});
