// apps/bingo-frontend/src/App.tsx
import { Router, Route } from '@solidjs/router';
import { AuthProvider } from './context/auth';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Deposits from './pages/Deposits';
import Withdrawals from './pages/Withdrawals';
import Broadcast from './pages/Broadcast';
import ToastContainer from './components/Toast';
import NetworkPopup from './components/NetworkPopup';
import DuplicateSessionPopup from './components/DuplicateSessionPopup';
import SessionExpiredPopup from './components/SessionExpiredPopup';
import Settings from './pages/Settings';
import ConvertLocked from './pages/ConvertLocked';
import AuditLogs from './pages/AuditLogs';
import Documentation from './pages/Documentation';
import AdminReports from './pages/AdminReports';
import UnclaimedReceipts from './pages/UnclaimedReceipts';
import RoundWinners from './pages/RoundWinners';
import Ledger from './pages/Ledger';
import AdminUpgrade from './pages/AdminUpgrade';
import PhoneAbuse from './pages/PhoneAbuse';
import AgentManagement from './pages/AgentManagement';
import Shamo from './pages/Shamo';
import BonusCleanup from './pages/BonusCleanup';

export default function App() {
  return (
    <AuthProvider>
      <ToastContainer />
      <NetworkPopup />
      <DuplicateSessionPopup />
      <SessionExpiredPopup />
      <Router>
        <Route path="/login" component={Login} />
        <Route
          path="/"
          component={() => (
            <ProtectedRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          )}
        />
        <Route
          path="/users"
          component={() => (
            <ProtectedRoute>
              <Layout>
                <Users />
              </Layout>
            </ProtectedRoute>
          )}
        />
        <Route
          path="/deposits"
          component={() => (
            <ProtectedRoute>
              <Layout>
                <Deposits />
              </Layout>
            </ProtectedRoute>
          )}
        />
        <Route
          path="/withdrawals"
          component={() => (
            <ProtectedRoute>
              <Layout>
                <Withdrawals />
              </Layout>
            </ProtectedRoute>
          )}
        />
        <Route
          path="/broadcast"
          component={() => (
            <ProtectedRoute>
              <Layout>
                <Broadcast />
              </Layout>
            </ProtectedRoute>
          )}
        />

        <Route
          path="/settings"
          component={() => (
            <ProtectedRoute>
              <Layout>
                <Settings />
              </Layout>
            </ProtectedRoute>
          )}
        />
        <Route
          path="/audit-logs"
          component={() => (
            <ProtectedRoute>
              <Layout>
                <AuditLogs />
              </Layout>
            </ProtectedRoute>
          )}
        />
        <Route
          path="/docs"
          component={() => (
            <ProtectedRoute>
              <Layout>
                <Documentation />
              </Layout>
            </ProtectedRoute>
          )}
        />

        <Route
          path="/unclaimed"
          component={() => (
            <ProtectedRoute>
              <Layout>
                <UnclaimedReceipts />
              </Layout>
            </ProtectedRoute>
          )}
        />
        <Route
          path="/admin-reports"
          component={() => (
            <ProtectedRoute>
              <Layout>
                <AdminReports />
              </Layout>
            </ProtectedRoute>
          )}
        />

        <Route
          path="/round-winners"
          component={() => (
            <ProtectedRoute>
              <Layout>
                <RoundWinners />
              </Layout>
            </ProtectedRoute>
          )}
        />

         <Route
          path="/ledger"
          component={() => (
            <ProtectedRoute>
              <Layout>
                <Ledger />
              </Layout>
            </ProtectedRoute>
          )}
        />

        <Route
          path="/admin-upgrade"
          component={() => (
            <ProtectedRoute>
              <Layout>
                <AdminUpgrade />
              </Layout>
            </ProtectedRoute>
          )}
        />
        <Route
  path="/phone-abuse"
  component={() => (
    <ProtectedRoute>
      <Layout>
        <PhoneAbuse />
      </Layout>
    </ProtectedRoute>
  )}
/>
<Route
  path="/agents"
  component={() => (
    <ProtectedRoute>
      <Layout>
        <AgentManagement />
      </Layout>
    </ProtectedRoute>
  )}
/>
<Route
  path="/shamo"
  component={() => (
    <ProtectedRoute>
      <Layout>
        <Shamo />
      </Layout>
    </ProtectedRoute>
  )}
/>

<Route
  path="/bonus-cleanup"
  component={() => (
    <ProtectedRoute>
      <Layout>
        <BonusCleanup />
      </Layout>
    </ProtectedRoute>
  )}
/>
        <Route path="/convert-locked" 
        component={ConvertLocked} />
      </Router>
    </AuthProvider>
  );
}