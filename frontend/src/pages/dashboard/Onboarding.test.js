import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import Onboarding, { onboardingSteps } from './Onboarding';
import ThemeProvider from '../../theme';

jest.mock('notistack', () => ({ enqueueSnackbar: jest.fn() }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, params) => (params ? `${key} ${JSON.stringify(params)}` : key),
    i18n: { language: 'pt' },
  }),
}));

let root;
let container;
const text = () => container.textContent;
const links = () => [...container.querySelectorAll('li a')].map((link) => link.getAttribute('href'));

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  window.localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const none = { accounts: 0, cards: 0, loans: 0, confirmedRecurrences: 0, pendingQuestions: 0 };
const loaded = (data) => ({ data, loading: false, error: null });
const fresh = { userId: 7, sources: none, plan: loaded({ income: null }), profile: loaded({}), goals: loaded([]) };
const complete = {
  userId: 7,
  sources: { ...none, accounts: 1, confirmedRecurrences: 2 },
  plan: loaded({ income: { monthly: 4200 } }),
  profile: loaded({ method: 'BASE' }),
  goals: loaded([{ id: 1 }]),
};

async function show(props) {
  await act(async () =>
    root.render(
      <MemoryRouter>
        <ThemeProvider>
          <Onboarding {...props} />
        </ThemeProvider>
      </MemoryRouter>
    )
  );
}

test('a new account has the five steps pending, each leading to its screen', async () => {
  await show(fresh);

  expect(text()).toContain('onboarding.progress {"done":0,"total":5}');
  expect(links()).toEqual(['/open-finance', '/future', '/future', '/plan/method', '/future']);
});

test('steps come from the data: done ones are no longer links and the progress follows', async () => {
  await show({ ...complete, sources: { ...complete.sources, pendingQuestions: 3 }, goals: loaded([]) });

  expect(text()).toContain('onboarding.progress {"done":3,"total":5}');
  expect(links()).toEqual(['/future', '/future']);
});

test('no data means the questions are not answered yet, even with none pending', () => {
  const steps = onboardingSteps({ sources: none, plan: {}, profile: {}, goals: [] });
  expect(steps.find((step) => step.id === 'questions').done).toBe(false);
});

test('leaves when everything is done', async () => {
  await show(complete);
  expect(text()).toBe('');
});

test.each(['plan', 'profile', 'goals'])('never shows an error: with %s failed it stays out', async (source) => {
  await show({ ...fresh, [source]: { data: null, loading: false, error: 'app.errors.server' } });
  expect(text()).toBe('');
});

test('dismissing hides it for that person only, and the choice survives a new visit', async () => {
  await show(fresh);
  await act(async () => container.querySelector('button').click());
  expect(text()).toBe('');

  act(() => root.unmount());
  root = createRoot(container);
  await show(fresh);
  expect(text()).toBe('');

  await show({ ...fresh, userId: 8 });
  expect(text()).toContain('onboarding.title');
});
