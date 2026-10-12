import { QueryClientProvider } from '@tanstack/react-query';
import { Suspense, lazy, useState } from 'react';
import { BrowserRouter, Link, Route, Routes } from 'react-router';

import { createQueryClient } from './api/queries';
import ErrorBoundary from './components/ErrorBoundary';
import Spinner from './components/Spinner';
import { usePageViews } from './lib/analytics';

const HomePage = lazy(() => import('./pages/HomePage'));
const CityPage = lazy(() => import('./pages/CityPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

function AppRoutes() {
  usePageViews();
  return (
    <Suspense fallback={<Spinner label="Loading…" />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/city/:cityId" element={<CityPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="app">
          <header className="app-header">
            <div className="header-content">
              <Link to="/" className="logo">
                Remote Radar
              </Link>
            </div>
          </header>

          <main className="app-content">
            <ErrorBoundary>
              <AppRoutes />
            </ErrorBoundary>
          </main>

          <footer className="app-footer">
            <div className="footer-content">
              <p>Remote Radar - Find your perfect remote work destination</p>
            </div>
          </footer>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
