import { act, Simulate } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import OpenFinance from './OpenFinance';
import ThemeProvider from '../../theme';
import HttpService from '../../services/HttpService';
import { useWallets } from '../../context/WalletContext';

jest.mock('../../services/HttpService', () => ({
  getWithAuth: jest.fn(),
  postWithAuth: jest.fn(),
  deleteWithAuth: jest.fn(),
}));
jest.mock('../../context/WalletContext', () => ({ useWallets: jest.fn() }));
jest.mock('notistack', () => ({ enqueueSnackbar: jest.fn() }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key, i18n: { language: 'pt-BR', resolvedLanguage: 'pt' } }),
}));

const PERMISSIONS = [
  'ACCOUNTS_READ',
  'ACCOUNTS_BALANCES_READ',
  'CREDIT_CARDS_ACCOUNTS_READ',
  'LOANS_READ',
  'RESOURCES_READ',
];
const status = (overrides = {}) => ({
  mode: 'contract-sandbox',
  simulated: true,
  status: 'DISCONNECTED',
  consentId: null,
  institutionName: 'Banco Sandbox',
  createdAt: null,
  expiresAt: null,
  rejectionReason: null,
  accountCount: 0,
  permissions: PERMISSIONS,
  notice: 'CONTRACT_SANDBOX',
  ...overrides,
});
const consent = {
  consentId: 'urn:consent:1',
  status: 'AWAITING_AUTHORISATION',
  institutionName: 'Banco Sandbox',
  permissions: PERMISSIONS,
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
  authoriseBefore: new Date(Date.now() + 3600000).toISOString(),
};

let root;
let container;
let refresh;
const text = () => document.body.textContent;
const button = (key) => [...document.querySelectorAll('button')].find((item) => item.textContent === key);
const click = (key) => act(async () => Simulate.click(button(key)));
// MUI keeps a closing dialog mounted until its exit transition ends.
const dialogClosed = async () => {
  await act(() => new Promise((resolve) => setTimeout(resolve, 400)));
  return document.querySelector('[role="dialog"]');
};

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  refresh = jest.fn().mockResolvedValue(undefined);
  useWallets.mockReturnValue({ refresh });
  Object.values(HttpService).forEach((fn) => fn.mockReset());
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
async function renderPage() {
  await act(async () =>
    root.render(
      <HelmetProvider>
        <ThemeProvider>
          <OpenFinance />
        </ThemeProvider>
      </HelmetProvider>
    )
  );
}

test('connect creates a consent for the chosen period and the bank screen authorises it', async () => {
  HttpService.getWithAuth.mockResolvedValue(status());
  await renderPage();
  await click('openFinance.duration.months');
  const six = [...document.querySelectorAll('button[value="6"]')][0];
  await act(async () => Simulate.click(six));

  HttpService.postWithAuth.mockResolvedValueOnce(consent);
  HttpService.getWithAuth.mockResolvedValue(status({ status: 'AWAITING_AUTHORISATION', consentId: consent.consentId }));
  await click('openFinance.connect');
  expect(HttpService.postWithAuth).toHaveBeenCalledWith('/open-finance/connection', { months: 6 });

  // The "bank" screen: institution, sandbox seal, permissions grouped in plain language.
  const dialog = document.querySelector('[role="dialog"]');
  expect(dialog.textContent).toContain('Banco Sandbox');
  expect(dialog.textContent).toContain('openFinance.consent.sandbox');
  expect(dialog.textContent).toContain('openFinance.permissionGroups.cards');
  expect(dialog.textContent).toContain('openFinance.permissions.LOANS_READ');
  expect(dialog.textContent).toContain('openFinance.consent.purpose');

  HttpService.postWithAuth.mockResolvedValueOnce({ accountsSynced: 2, newTransactions: 15 });
  HttpService.getWithAuth.mockResolvedValue(status({ status: 'AUTHORISED', accountCount: 2 }));
  await click('openFinance.consent.authorise');

  expect(HttpService.postWithAuth).toHaveBeenLastCalledWith('/open-finance/connection/authorise', {
    consentId: consent.consentId,
    termsVersion: '2026-09-26',
    language: 'pt',
  });
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(await dialogClosed()).toBeNull();
  expect(text()).toContain('openFinance.status.AUTHORISED');
});

test('a consent left waiting can be declined from the page', async () => {
  HttpService.getWithAuth.mockResolvedValue(
    status({ status: 'AWAITING_AUTHORISATION', consentId: 'urn:consent:9', createdAt: new Date().toISOString() })
  );
  await renderPage();
  expect(text()).toContain('openFinance.awaiting.text');

  await click('openFinance.awaiting.resume');
  expect(document.querySelector('[role="dialog"]').textContent).toContain('openFinance.consent.authorise');

  HttpService.postWithAuth.mockResolvedValueOnce(undefined);
  HttpService.getWithAuth.mockResolvedValue(
    status({ status: 'REJECTED', rejectionReason: 'CUSTOMER_MANUALLY_REJECTED' })
  );
  await click('openFinance.consent.reject');

  expect(HttpService.postWithAuth).toHaveBeenCalledWith('/open-finance/connection/reject', {
    consentId: 'urn:consent:9',
  });
  expect(text()).toContain('openFinance.rejected.CUSTOMER_MANUALLY_REJECTED');
  expect(refresh).not.toHaveBeenCalled();
});

test('connected, the page shows the accounts, the last sync and Sync first; the journey and the permissions fold away', async () => {
  useWallets.mockReturnValue({
    refresh,
    wallets: [
      { id: 1, name: 'Conta corrente', institutionName: 'Banco Sandbox', balance: 2739.4, source: 'OPEN_FINANCE' },
      { id: 2, name: 'Carteira manual', balance: 50, source: 'MANUAL' },
    ],
  });
  HttpService.getWithAuth.mockResolvedValue(
    status({
      status: 'AUTHORISED',
      accountCount: 1,
      expiresAt: '2027-02-24T10:00:00Z',
      lastSyncedAt: '2026-11-24T10:30:00Z',
    })
  );
  await renderPage();

  expect(text()).toContain('openFinance.connected.until');
  expect(text()).toContain('Conta corrente');
  expect(text()).not.toContain('Carteira manual');
  expect(text()).toContain('openFinance.connected.lastSync');
  // No step list once connected; the long list of data sits behind "What we share".
  expect(document.querySelector('ol[aria-label="openFinance.steps.label"]')).toBeNull();
  expect(text()).not.toContain('openFinance.permissionsTitle');
  expect(button('openFinance.connected.shared').getAttribute('aria-expanded')).toBe('false');
  // Sync is the main action and comes before revoke, which is the last button on the page.
  const labels = [...document.querySelectorAll('button')].map((item) => item.textContent);
  expect(labels.indexOf('openFinance.sync')).toBeLessThan(labels.indexOf('openFinance.revoke.open'));
});

test('a rejected consent says why and offers to connect again', async () => {
  HttpService.getWithAuth.mockResolvedValue(status({ status: 'REJECTED', rejectionReason: 'CONSENT_EXPIRED' }));
  await renderPage();
  expect(text()).toContain('openFinance.rejected.CONSENT_EXPIRED');
  expect(button('openFinance.connectAgain')).toBeDefined();
});

test('revoking warns that imported data is deleted and what stays, then refreshes the wallets', async () => {
  HttpService.getWithAuth.mockResolvedValue(status({ status: 'AUTHORISED', accountCount: 2 }));
  await renderPage();
  await click('openFinance.revoke.open');

  const dialog = document.querySelector('[role="dialog"]');
  expect(dialog.textContent).toContain('openFinance.revoke.deleted');
  expect(dialog.textContent).toContain('openFinance.revoke.kept');
  expect(HttpService.deleteWithAuth).not.toHaveBeenCalled();

  HttpService.deleteWithAuth.mockResolvedValue(undefined);
  HttpService.getWithAuth.mockResolvedValue(
    status({ status: 'REJECTED', rejectionReason: 'CUSTOMER_MANUALLY_REVOKED' })
  );
  await click('openFinance.revoke.confirm');

  expect(HttpService.deleteWithAuth).toHaveBeenCalledWith('/open-finance/connection');
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(text()).toContain('openFinance.rejected.CUSTOMER_MANUALLY_REVOKED');
});

test('an authorisation past 60 minutes closes the bank screen and shows the expiry', async () => {
  HttpService.getWithAuth.mockResolvedValue(status());
  await renderPage();
  HttpService.postWithAuth.mockResolvedValueOnce(consent);
  await click('openFinance.connect');

  HttpService.postWithAuth.mockRejectedValueOnce({
    response: { status: 409, data: { code: 'OPEN_FINANCE_CONSENT_EXPIRED' } },
  });
  HttpService.getWithAuth.mockResolvedValue(status({ status: 'REJECTED', rejectionReason: 'CONSENT_EXPIRED' }));
  await click('openFinance.consent.authorise');

  expect(await dialogClosed()).toBeNull();
  expect(text()).toContain('app.errors.OPEN_FINANCE_CONSENT_EXPIRED');
  expect(text()).toContain('openFinance.rejected.CONSENT_EXPIRED');
});

test('without a status the card claims nothing while loading, and a failure offers a retry', async () => {
  let fail;
  HttpService.getWithAuth.mockReturnValue(
    new Promise((_, reject) => {
      fail = reject;
    })
  );
  await renderPage();
  expect(container.querySelector('.MuiSkeleton-root')).not.toBeNull();
  expect(text()).not.toContain('openFinance.participantSandbox');
  expect(text()).not.toContain('openFinance.bankPlaceholder');

  await act(async () => fail({ response: { status: 500 } }));
  expect(text()).toContain('app.errors.server');

  HttpService.getWithAuth.mockResolvedValue(status());
  await click('app.retry');
  expect(text()).not.toContain('app.errors.server');
  // The notice is translated from the mode, never the raw text sent by the server.
  expect(text()).toContain('openFinance.notice.contract');
});
