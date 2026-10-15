import { QueryClientProvider } from '@tanstack/react-query';
import { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes, useLocation, useNavigationType } from 'react-router';

import { createQueryClient } from './api/queries';
import ErrorBoundary from './components/ErrorBoundary';
import Header from './components/Header';
import { ToastHost } from './components/overlays';
import { SearchOverlay } from './components/Search';
import SiteFooter from './components/SiteFooter';
import { usePageViews } from './lib/analytics';
import { setLayerElement, setSiteElement, useHeaderAway } from './lib/chrome';

const HomePage = lazy(() => import('./pages/HomePage'));
const CityPage = lazy(() => import('./pages/CityPage'));
const ComparePage = lazy(() => import('./pages/ComparePage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

/** A new page starts at the top. Back and forward keep the browser's position. */
function useScrollToTop(pathname: string) {
  const type = useNavigationType();
  useEffect(() => {
    if (type !== 'POP' && !window.location.hash) window.scrollTo(0, 0);
  }, [pathname, type]);
}

function SiteFrame() {
  const { pathname } = useLocation();
  const away = useHeaderAway();
  usePageViews();
  useScrollToTop(pathname);

  return (
    <>
      <div className={`site${away ? ' hdr-away' : ''}`} ref={setSiteElement}>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Header />
        <main id="main" tabIndex={-1}>
          <ErrorBoundary resetKey={pathname}>
            <Suspense fallback={<div className="page-wait" aria-busy="true" />}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/city/:cityId" element={<CityPage />} />
                <Route path="/compare" element={<ComparePage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </main>
        <SiteFooter />
      </div>
      <div className="layer" ref={setLayerElement}>
        <ToastHost />
      </div>
      <SearchOverlay />
    </>
  );
}

export default function App() {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <SiteFrame />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
