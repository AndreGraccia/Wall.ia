import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import DashboardLayout from './layouts/dashboard/DashboardLayout';
import PrivateRoute from './PrivateRoute';
import { redrawsWithAmounts } from './utils/hiddenAmounts';
import ProtectedRoute from './ProtectedRoute';

import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import Unauthorized from './pages/auth/Unauthorized';
import NotFound from './pages/auth/NotFound';

import DashboardScreen from './pages/dashboard/Dashboard';

// One chunk per screen: the landing dashboard and login stay in the main bundle, the rest loads on
// first visit (DashboardLayout shows a skeleton meanwhile).
// Every screen inside the shell redraws, without remounting, when "ocultar saldo" flips.
const screen = (load) => redrawsWithAmounts(lazy(load));
const Dashboard = redrawsWithAmounts(DashboardScreen);
const Transaction = screen(() => import('./pages/transaction/Transaction'));
const Envelopes = screen(() => import('./pages/envelopes/Envelopes'));
const About = screen(() => import('./pages/About'));
const Privacy = screen(() => import('./pages/privacy/Privacy'));
const NewWallet = screen(() => import('./pages/wallet/NewWallet'));
const Wallet = screen(() => import('./pages/wallet/Wallet'));
const Insights = screen(() => import('./pages/insights/Insights'));
const OpenFinance = screen(() => import('./pages/open-finance/OpenFinance'));
const Future = screen(() => import('./pages/future/Future'));
const Plan = screen(() => import('./pages/plan/Plan'));
const Method = screen(() => import('./pages/plan/Method'));
const Wealth = screen(() => import('./pages/wealth/Wealth'));
const LifeGoals = screen(() => import('./pages/life-goals/LifeGoals'));
const CashFlow = screen(() => import('./pages/cash-flow/CashFlow'));
const Review = screen(() => import('./pages/cash-flow/Review'));
const Ask = screen(() => import('./pages/ask/Ask'));
const Commitments = screen(() => import('./pages/commitments/Commitments'));
const BillingRadar = screen(() => import('./pages/billing-radar/BillingRadar'));
const Metrics = screen(() => import('./pages/admin/Metrics'));

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
            <Route path="plan" element={<Plan />} />
            <Route path="plan/method" element={<Method />} />
            <Route path="cash-flow" element={<CashFlow />} />
            <Route path="cash-flow/review" element={<Review />} />
            <Route path="ask" element={<Ask />} />
            <Route path="commitments" element={<Commitments />} />
            <Route path="billing-radar" element={<BillingRadar />} />
            <Route path="wealth" element={<Wealth />} />
            <Route path="life-goals" element={<LifeGoals />} />
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
