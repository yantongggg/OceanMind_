import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router';
import type { ReactNode } from 'react';
import { NowClockProvider } from '../lib/useNowClock';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { CommandCenterPage } from './pages/CommandCenterPage';
import { IntelligenceGlobePage } from './pages/IntelligenceGlobePage';
import { OrchestrationPage } from './pages/OrchestrationPage';
import { DecisionsPage } from './pages/DecisionsPage';
import { DecisionDetailPage } from './pages/DecisionDetailPage';
import { VoyagesPage } from './pages/VoyagesPage';
import { VoyageDetailPage } from './pages/VoyageDetailPage';
import { EsgPage } from './pages/EsgPage';
import { SuppliersPage } from './pages/SuppliersPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';

/** Simple demo auth guard — LoginPage sets localStorage 'om.auth'. */
function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const authed = !!localStorage.getItem('om.auth');
  if (!authed) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <NowClockProvider>
        <Routes>
          {/* Login lives OUTSIDE the app shell */}
          <Route path="/login" element={<LoginPage />} />

          <Route
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            <Route path="/" element={<CommandCenterPage />} />
            <Route path="/globe" element={<IntelligenceGlobePage />} />
            <Route path="/orchestration" element={<OrchestrationPage />} />
            <Route path="/decisions" element={<DecisionsPage />} />
            <Route path="/decisions/:id" element={<DecisionDetailPage />} />
            <Route path="/voyages" element={<VoyagesPage />} />
            <Route path="/voyages/:id" element={<VoyageDetailPage />} />
            <Route path="/esg" element={<EsgPage />} />
            <Route path="/suppliers" element={<SuppliersPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </NowClockProvider>
    </BrowserRouter>
  );
}
