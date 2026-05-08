import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/authStore";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import AppShell from "./components/layout/AppShell";
import DashboardPage from "./pages/DashboardPage";
import QuotesPage from "./pages/QuotesPage";
import QuoteDetailPage from "./pages/QuoteDetailPage";
import ReportsPage from "./pages/ReportsPage";
import PaperPricingPage from "./pages/PaperPricingPage";
import SettingsPage from "./pages/SettingsPage";
import BulkCostingPage from "./pages/BulkCostingPage";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="quotes" element={<QuotesPage />} />
        <Route path="quotes/:quoteId" element={<QuoteDetailPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="bulk-costing" element={<BulkCostingPage />} />
        <Route path="paper-pricing" element={<PaperPricingPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
