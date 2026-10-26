import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import DashboardLayout from './layouts/dashboard/DashboardLayout';
import PrivateRoute from './PrivateRoute';
import ProtectedRoute from './ProtectedRoute';

import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import Unauthorized from './pages/auth/Unauthorized';
import NotFound from './pages/auth/NotFound';

import Dashboard from './pages/dashboard/Dashboard';

// One chunk per screen: the landing dashboard and login stay in the main bundle, the rest loads on
// first visit (DashboardLayout shows a skeleton meanwhile).
const Transaction = lazy(() => import('./pages/transaction/Transaction'));
const Envelopes = lazy(() => import('./pages/envelopes/Envelopes'));
const About = lazy(() => import('./pages/About'));
const Privacy = lazy(() => import('./pages/privacy/Privacy'));
const NewWallet = lazy(() => import('./pages/wallet/NewWallet'));
const Wallet = lazy(() => import('./pages/wallet/Wallet'));
const Insights = lazy(() => import('./pages/insights/Insights'));
const OpenFinance = lazy(() => import('./pages/open-finance/OpenFinance'));
const Future = lazy(() => import('./pages/future/Future'));
const Ask = lazy(() => import('./pages/ask/Ask'));
const Commitments = lazy(() => import('./pages/commitments/Commitments'));
const BillingRadar = lazy(() => import('./pages/billing-radar/BillingRadar'));
const Metrics = lazy(() => import('./pages/admin/Metrics'));

const USER_ROLES = ['ROLE_USER', 'ROLE_ADMIN'];

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      <Route element={<PrivateRoute />}>
        <Route path="/unauthorized" element={<Unauthorized />} />

        <Route element={<ProtectedRoute roles={USER_ROLES} />}>
          <Route element={<DashboardLayout />}>
            <Route index element={<Dashboard />} />

            <Route path="wallets">
              <Route index element={<Wallet />} />
              <Route path="new" element={<NewWallet />} />
              <Route path="addFunds" element={<Navigate to="/open-finance" replace />} />
              <Route path=":walletId" element={<Wallet />} />
            </Route>

            <Route path="envelopes" element={<Envelopes />} />
            {/* Old links and bookmarks from the "Movimentar" screen, replaced by envelopes. */}
            <Route path="transfers" element={<Navigate to="/envelopes" replace />} />
            <Route path="transactions" element={<Transaction />} />
            <Route path="future" element={<Future />} />
            <Route path="ask" element={<Ask />} />
            <Route path="commitments" element={<Commitments />} />
            <Route path="billing-radar" element={<BillingRadar />} />
            <Route path="insights" element={<Insights />} />
            <Route path="open-finance" element={<OpenFinance />} />
            <Route path="about" element={<About />} />
            <Route path="privacy" element={<Privacy />} />
            <Route element={<ProtectedRoute roles={['ROLE_ADMIN']} />}>
              <Route path="admin/metrics" element={<Metrics />} />
            </Route>
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
