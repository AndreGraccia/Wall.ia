import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import StatementList, { foldOwnMoves } from '.';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, options) => (options?.amount ? `${key}:${options.amount}` : key),
    i18n: { language: 'pt' },
  }),
}));

const checking = { id: 1, iban: 'A', name: 'Corrente' };
const savings = { id: 2, iban: 'B', name: 'Poupança' };
const wallets = [checking, savings];
const entry = (id, type, amount, createdAt, extra = {}) => ({
  id,
  amount,
  createdAt,
  status: 'SUCCESS',
  type: { name: type },
  description: `item ${id}`,
  ...extra,
});

// Imported pair between own accounts: a withdrawal from Corrente and a deposit into Poupança, same day and amount.
const out = entry(10, 'Withdrawal', 300, '2026-11-20T15:00:00', { ownAccountMove: true, fromWallet: checking });
const into = entry(11, 'Deposit', 300, '2026-11-20T15:00:05', { ownAccountMove: true, toWallet: savings });
const salary = entry(12, 'Deposit', 5000, '2026-11-05T09:00:00', { toWallet: checking });
const rent = entry(13, 'Withdrawal', 1200, '2026-11-10T09:00:00', { fromWallet: checking });
const october = entry(14, 'Withdrawal', 80, '2026-10-30T09:00:00', { fromWallet: checking });

let root;
let container;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  root = createRoot(container);
});
afterEach(() => act(() => root.unmount()));

test('the two sides of a move between own accounts become one entry; a lone side stays alone', () => {
  expect(foldOwnMoves([into, salary, out]).map(({ item, pair }) => [item.id, pair?.id ?? null])).toEqual([
    [11, 10],
    [12, null],
  ]);
  // Different amount: not the same move.
  expect(foldOwnMoves([into, { ...out, amount: 301 }])).toHaveLength(2);
});

test('groups by month with the net on the heading, and the own-account move is one neutral row', () => {
  act(() =>
    root.render(
      <StatementList transactions={[into, out, rent, salary, october]} wallets={wallets} onSelect={jest.fn()} />
    )
  );
  const sections = container.querySelectorAll('section');
  expect(sections).toHaveLength(2);
  // November: +5000 − 1200, the 300 between accounts counts as neither.
  const novemberNet = sections[0].querySelector('[aria-label^="transactions.monthTotal"]');
  expect(novemberNet.textContent.replace(/\s/g, ' ')).toMatch(/^\+ R\$ 3\.800,00$/);
  expect(sections[1].querySelector('[aria-label^="transactions.monthTotal"]').textContent.replace(/\s/g, ' ')).toBe(
    '−R$ 80,00'
  );

  const rows = sections[0].querySelectorAll('li');
  expect(rows).toHaveLength(3);
  const move = rows[0];
  expect(move.textContent).toContain('transactions.ownMove');
  expect(move.textContent).toContain('Corrente → Poupança');
  expect(move.textContent).not.toMatch(/[+−] R\$/);
  // Meta is the account, not the payment method.
  expect(rows[1].textContent).toContain('Corrente');
});

test('limit pages the rows but the month net still counts everything', () => {
  act(() =>
    root.render(<StatementList transactions={[rent, salary]} limit={1} wallets={wallets} onSelect={jest.fn()} />)
  );
  expect(container.querySelectorAll('li')).toHaveLength(1);
  expect(container.querySelector('[aria-label^="transactions.monthTotal"]').textContent.replace(/\s/g, ' ')).toBe(
    '+ R$ 3.800,00'
  );
});
