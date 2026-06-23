import { Routes, Route, Navigate } from 'react-router-dom';
import { DomPageTranslator } from './components/shared/DomPageTranslator.jsx';
import { MarketingLayout } from './marketing/layout/MarketingLayout.jsx';
import { HomePage } from './marketing/pages/HomePage.jsx';
import { HorizonPage } from './marketing/pages/HorizonPage.jsx';
import { HowPage } from './marketing/pages/HowPage.jsx';
import { BlogsPage } from './marketing/pages/BlogsPage.jsx';
import { BlogPostPage } from './marketing/pages/BlogPostPage.jsx';
import { WelcomePage } from './marketing/pages/WelcomePage.jsx';
import { ForgotPasswordPage } from './marketing/pages/ForgotPasswordPage.jsx';
import { ResetPasswordPage } from './marketing/pages/ResetPasswordPage.jsx';
import { AuthCallbackPage } from './pages/AuthCallbackPage.jsx';
import { useAuthStore } from './stores/authStore.js';
import { useEffect } from 'react';
import App from './App.jsx';

// Protege rutas que requieren sesión
function ProtectedRoute({ children }) {
  const { user, loading } = useAuthStore();
  if (loading) return (
    <div className="landing">
      <div className="landing-card glass" style={{ maxWidth: 300, textAlign: 'center' }}>
        <span style={{ fontFamily: 'var(--mono)', color: 'var(--dim)' }}>Loading…</span>
      </div>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function AppRouter() {
  const init = useAuthStore((s) => s.init);

  useEffect(() => {
    init();
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
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
        <Route path="auth/callback" element={<AuthCallbackPage />} />

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