import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import Goals from './Goals';
import ThemeProvider from '../../theme';
import HttpService from '../../services/HttpService';

jest.mock('../../services/HttpService', () => ({ getWithAuth: jest.fn(), putWithAuth: jest.fn() }));
jest.mock('../../context/WalletContext', () => ({ useWallets: jest.fn() }));
jest.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: jest.fn(), closeSnackbar: jest.fn() }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key) => key, i18n: { language: 'pt' } }) }));

test('"no goals" is never shown before the list arrives', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  const root = createRoot(container);
  let answer;
  HttpService.getWithAuth.mockReturnValue(
    new Promise((done) => {
      answer = done;
    })
  );
  await act(async () =>
    root.render(
      <ThemeProvider>
        <Goals onChanged={jest.fn()} />
      </ThemeProvider>
    )
  );
  expect(container.textContent).not.toContain('future.goals.empty');
  expect(container.querySelector('.MuiSkeleton-root')).not.toBeNull();

  await act(async () => answer([]));
  expect(container.textContent).toContain('future.goals.empty');
  act(() => root.unmount());
});

test('each goal says what 12 months at the CDI become, after inflation, with the Banco Central date', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  const root = createRoot(container);
  HttpService.getWithAuth.mockImplementation((url) =>
    Promise.resolve(
      url === '/market/overview'
        ? {
            indicators: [
              { code: 'CDI', value: 13.65, referenceDate: '2026-09-24' },
              { code: 'IPCA_12M', value: 4.22, referenceDate: '2026-08-01' },
            ],
          }
        : [{ id: 1, name: 'Reserva', monthlyAmount: '200.00', dayOfMonth: 10, nextDate: '2026-10-10' }]
    )
  );
  await act(async () =>
    root.render(
      <ThemeProvider>
        <Goals onChanged={jest.fn()} />
      </ThemeProvider>
    )
  );
  expect(container.textContent).toContain('future.goals.inAYear');

  act(() => root.unmount());
});

const LATE_GOAL = {
  id: 4,
  name: 'Viagem',
  monthlyAmount: 200,
  dayOfMonth: 10,
  nextDate: '2026-12-10',
  targetAmount: 3000,
  targetDate: '2027-03-10',
  savedAmount: 600,
  savedOrigin: 'USER_VALUE',
  progress: {
    status: 'LATE',
    remaining: 2400,
    savedPercent: 20,
    requiredMonthly: 600,
    contributionsUntilDate: 4,
    projectedDate: '2027-11-10',
    fit: { fits: false, horizonDays: 90, incomeConfirmed: false, scenario: { negativeDays: 12, minBalance90: -150 } },
  },
};

async function renderGoals(goals) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  const root = createRoot(container);
  HttpService.getWithAuth.mockImplementation((url) =>
    Promise.resolve(url === '/market/overview' ? { indicators: [] } : goals)
  );
  await act(async () =>
    root.render(
      <ThemeProvider>
        <Goals onChanged={jest.fn()} />
      </ThemeProvider>
    )
  );
  return { container, root };
}

test('a date that does not fit warns with the required contribution, its fit and the declared origin', async () => {
  const { container, root } = await renderGoals([LATE_GOAL]);

  expect(container.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')).toBe('20');
  expect(container.querySelector('.MuiAlert-standardWarning')).not.toBeNull();
  expect(container.textContent).toContain('future.goals.status.LATE');
  expect(container.textContent).toContain('future.goals.requiredDoesNotFit');
  expect(container.textContent).toContain('future.goals.noIncome');
  expect(container.textContent).toContain('future.goals.savedOrigin');

  act(() => root.unmount());
});

test('editing a goal saves the whole goal over it, target, date and saved amount included', async () => {
  const { container, root } = await renderGoals([LATE_GOAL]);
  HttpService.putWithAuth.mockResolvedValue({});

  await act(async () => container.querySelector('[aria-label="future.goals.editLabel"]').click());
  expect(container.textContent).toContain('future.goals.update');
  expect(container.textContent).not.toContain('future.goals.checkFit');
  await act(async () => {
    container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });

  expect(HttpService.putWithAuth).toHaveBeenCalledWith('/future/goals/4', {
    name: 'Viagem',
    monthlyAmount: 200,
    dayOfMonth: 10,
    targetAmount: 3000,
    targetDate: '2027-03-10',
    savedAmount: 600,
  });

  act(() => root.unmount());
});
