import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { DomPageTranslator } from './components/shared/DomPageTranslator.jsx';
import { MarkLoading } from './components/shared/MarkLoading.jsx';
import { MarketingLayout } from './marketing/layout/MarketingLayout.jsx';
import { HomePage } from './marketing/pages/HomePage.jsx';
import { HorizonPage } from './marketing/pages/HorizonPage.jsx';
import { HowPage } from './marketing/pages/HowPage.jsx';
import { BlogsPage } from './marketing/pages/BlogsPage.jsx';
import { BlogPostPage } from './marketing/pages/BlogPostPage.jsx';
import { WelcomePage } from './marketing/pages/WelcomePage.jsx';
import { ForgotPasswordPage } from './marketing/pages/ForgotPasswordPage.jsx';
import { ResetPasswordPage } from './marketing/pages/ResetPasswordPage.jsx';
import { TermsPage } from './marketing/pages/TermsPage.jsx';
import { AuthCallbackPage } from './pages/AuthCallbackPage.jsx';
import { AdminPage } from './admin/AdminPage.jsx';
import { PlansPage } from './pages/PlansPage.jsx';
import { useAuthStore } from './stores/authStore.js';
import { usePlanStore } from './stores/planStore.js';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { captureReferralFromLocation } from './lib/referralStorage.js';
import { consumeOAuthDashboardRedirect } from './lib/authRedirect.js';
import { PATHS } from './marketing/lib/paths.js';
import App from './App.jsx';

// Protege rutas que requieren sesión
function ProtectedRoute({ children }) {
  const { user, loading } = useAuthStore();
  if (loading) return (
    <div className="landing">
      <div className="landing-card glass" style={{ maxWidth: 300, textAlign: 'center' }}>
        <MarkLoading />
      </div>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function AppRouter() {
  const init = useAuthStore((s) => s.init);
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    captureReferralFromLocation(location.search);
  }, [location.search]);

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    if (user) usePlanStore.getState().fetchProfile();
  }, [user]);

  // OAuth landed on marketing home (Site URL fallback) — send to dashboard.
  useEffect(() => {
    if (loading || !user) return;
    const onApp = location.pathname === PATHS.app
      || location.pathname.startsWith(`${PATHS.app}/`);
    if (onApp || location.pathname === '/auth/callback') return;
    if (consumeOAuthDashboardRedirect()) {
      navigate(PATHS.app, { replace: true });
    }
  }, [loading, user, location.pathname, navigate]);

  useEffect(() => {
    if (import.meta.env.DEV) {
      window.__resetForecastUsage = async () => {
        await usePlanStore.getState().resetWeatherActions();
        window.location.reload();
      };
    }
  }, []);

  return (
    <>
      <DomPageTranslator />
      <Routes>
        <Route element={<MarketingLayout />}>
          <Route index element={<HomePage />} />
          <Route path="horizon" element={<HorizonPage />} />
          <Route path="how" element={<HowPage />} />
          <Route path="marketplace" element={<Navigate to="/horizon" replace />} />
          <Route path="blogs" element={<BlogsPage />} />
          <Route path="blogs/:slug" element={<BlogPostPage />} />
          <Route path="ensenanzas" element={<Navigate to="/blogs" replace />} />
        </Route>

        <Route path="welcome" element={<WelcomePage />} />
        <Route path="login" element={<WelcomePage />} />
        <Route path="signup" element={<WelcomePage />} />
        <Route path="signup/terms" element={<TermsPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
        <Route path="auth/callback" element={<AuthCallbackPage />} />
        <Route path="panel" element={<AdminPage />} />

        <Route path="app/plans" element={
          <ProtectedRoute>
            <PlansPage />
          </ProtectedRoute>
        } />

        <Route path="app/*" element={
          <ProtectedRoute>
            <App />
          </ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}