import { Routes, Route, Navigate } from 'react-router-dom';
import { DomPageTranslator } from './components/shared/DomPageTranslator.jsx';
import { MarketingLayout } from './marketing/layout/MarketingLayout.jsx';
import { HomePage } from './marketing/pages/HomePage.jsx';
import { HorizonPage } from './marketing/pages/HorizonPage.jsx';
import { HowPage } from './marketing/pages/HowPage.jsx';
import { BlogsPage } from './marketing/pages/BlogsPage.jsx';
import { BlogPostPage } from './marketing/pages/BlogPostPage.jsx';
import { WelcomePage } from './marketing/pages/WelcomePage.jsx';
import App from './App.jsx';

export default function AppRouter() {
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

      <Route path="app/*" element={<App />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
