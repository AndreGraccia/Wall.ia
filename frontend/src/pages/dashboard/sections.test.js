import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { horizonSummary, PlanVsActual, RiskAlert, sliceStatus } from './sections';
import ThemeProvider from '../../theme';
import { HIDDEN_AMOUNT } from '../../utils/hiddenAmounts';

jest.mock('../../services/HttpService', () => ({ getWithAuth: jest.fn() }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, params) => (params ? `${key} ${JSON.stringify(params)}` : key),
    i18n: { language: 'pt' },
  }),
}));

let root;
let container;
const text = () => container.textContent;

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

async function show(node) {
  await act(async () =>
    root.render(
      <MemoryRouter>
        <ThemeProvider>{node}</ThemeProvider>
      </MemoryRouter>
    )
  );
}

const day = (index, balance) => ({ date: `2026-12-${String(index + 1).padStart(2, '0')}`, balance });

test('30/60/90 takes the lowest and the closing balance of each window, from the same projection', () => {
  const days = Array.from({ length: 91 }, (_, index) => day(index % 28, 1000 - index));
  days[10] = { date: '2026-12-11', balance: -50 };
  days[75] = { date: '2027-02-15', balance: -400 };

  const rows = horizonSummary({ days });

  expect(rows.map((row) => row.horizon)).toEqual([30, 60, 90]);
  expect(rows[0]).toMatchObject({ lowest: -50, lowestDate: '2026-12-11', end: 970 });
  expect(rows[1].lowest).toBe(-50);
  expect(rows[2]).toMatchObject({ lowest: -400, lowestDate: '2027-02-15', end: 910 });
  expect(horizonSummary({ days: days.slice(0, 31) }).map((row) => row.horizon)).toEqual([30]);
});

test('only measured slices have an actual; the others never look like money spent or invested', () => {
  expect(sliceStatus({ amount: 1706.25, used: 2977.6 })).toMatchObject({ kind: 'measured', over: true });
  expect(sliceStatus({ amount: 975, used: 637.85 })).toMatchObject({ kind: 'measured', over: false });
  expect(sliceStatus({ amount: 731.25, used: null, commitment: true, committed: 731.25 })).toEqual({
    kind: 'committed',
    committed: 731.25,
  });
  expect(sliceStatus({ amount: 609.38, used: null, commitment: false })).toEqual({ kind: 'planned' });
});

const plan = {
  loading: false,
  error: null,
  reload: jest.fn(),
  data: {
    saved: true,
    active: true,
    income: { monthly: 4875 },
    slices: [
      { position: 0, kind: 'FIXED', label: 'Fixo', percent: 35, amount: 1706.25, used: 2977.6 },
      { position: 1, kind: 'EMERGENCY', label: 'Reserva', percent: 12.5, amount: 609.38, used: null },
    ],
  },
};

test('planned against actual: says how much went over and marks a plain plan as planned only', async () => {
  await show(<PlanVsActual plan={plan} />);

  expect(text()).toContain('dashboard.plan.over {"amount":"R$\u00a01.271,35"}');
  expect(text()).toContain('dashboard.plan.plannedOnly');
  expect(text()).toContain('dashboard.plan.footnote');
});

test('"ocultar saldo" hides the plan values and the risk amounts', async () => {
  await show(
    <>
      <PlanVsActual plan={plan} hidden />
      <RiskAlert
        hidden
        windows={[
          {
            start: '2026-12-02',
            end: '2026-12-03',
            lowestBalance: -732.55,
            relief: { label: 'Salário', date: '2026-12-04', amount: 4200 },
            causes: [
              {
                date: '2026-12-01',
                amount: -1500,
                label: 'Aluguel',
                certainty: 'ESTIMATED',
                origin: 'Banco Aurora',
                reference: 'out:aluguel',
              },
            ],
          },
        ]}
      />
    </>
  );

  expect(text()).toContain(HIDDEN_AMOUNT);
  expect(text()).not.toMatch(/1\.271|1\.706|732|1\.500/);
  expect(text()).toContain('Aluguel');
  expect(text()).toContain('Banco Aurora');
});
