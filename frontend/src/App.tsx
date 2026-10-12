import { QueryClientProvider } from '@tanstack/react-query';
import { Suspense, lazy, useState } from 'react';
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router';

import { createQueryClient } from './api/queries';
import ErrorBoundary from './components/ErrorBoundary';
import { Logo } from './components/Icon';
import SearchBar from './components/SearchBar';
import SiteFooter from './components/SiteFooter';
import Spinner from './components/Spinner';
import ThemeSwitch from './components/ThemeSwitch';
import { usePageViews } from './lib/analytics';

const HomePage = lazy(() => import('./pages/HomePage'));
const CityPage = lazy(() => import('./pages/CityPage'));
const ComparePage = lazy(() => import('./pages/ComparePage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

function AppRoutes() {
  usePageViews();
  return (
    <Suspense fallback={<Spinner label="Loading…" />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/city/:cityId" element={<CityPage />} />
        <Route path="/compare" element={<ComparePage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}

function Header() {
  // The home page has its own large search box, so the header one only shows elsewhere.
  const onHome = useLocation().pathname === '/';
  return (
    <header className="app-header">
      <div className="header-content">
        <Link to="/" className="logo">
          <Logo />
          Remote Radar
        </Link>
        {!onHome && (
          <div className="header-search">
            <SearchBar variant="compact" />
          </div>
        )}
        <ThemeSwitch />
      </div>
    </header>
  );
}

export default function App() {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="app">
          <Header />

          <main className="app-content">
            <ErrorBoundary>
              <AppRoutes />
            </ErrorBoundary>
          </main>

          <SiteFooter />
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
