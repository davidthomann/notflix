import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppLayout } from './components/Layout';
import { AccountPage, MePage, NotificationsPage } from './pages/AccountPages';
import { ConnectPage, LoginPage, ProfilesPage } from './pages/AuthPages';
import { BrowsePage } from './pages/BrowsePage';
import { CategoriesPage, GenrePage, LanguagesPage, LatestPage, MyListPage, PersonPage, SearchPage } from './pages/ListPages';
import { SessionProvider, useSession } from './state/session';
import '@fontsource-variable/inter';
import '@fontsource/bebas-neue';
import './styles/app.css';
import './styles/player.css';

// hls.js is sizeable and only needed while watching.
const WatchPage = lazy(() => import('./player/WatchPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: 1 },
  },
});

function RequireSession() {
  const { serverUrl, active } = useSession();
  const location = useLocation();
  if (!serverUrl) return <Navigate to="/connect" replace />;
  if (!active) return <Navigate to="/profiles" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

function App() {
  return (
    <Routes>
      <Route path="/connect" element={<ConnectPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/profiles" element={<ProfilesPage />} />
      <Route element={<RequireSession />}>
        <Route
          path="/watch/:id"
          element={
            <Suspense fallback={<div className="player-loading"><div className="spinner" /></div>}>
              <WatchPage />
            </Suspense>
          }
        />
        <Route path="/browse/categories" element={<CategoriesPage />} />
        <Route element={<AppLayout />}>
          <Route path="/browse" element={<BrowsePage key="home" scope="home" />} />
          <Route path="/browse/series" element={<BrowsePage key="series" scope="series" />} />
          <Route path="/browse/movies" element={<BrowsePage key="movies" scope="movies" />} />
          <Route path="/browse/latest" element={<LatestPage />} />
          <Route path="/browse/my-list" element={<MyListPage />} />
          <Route path="/browse/languages" element={<LanguagesPage />} />
          <Route path="/browse/genre/:id" element={<GenrePage />} />
          <Route path="/browse/person/:id" element={<PersonPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/me" element={<MePage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/browse" replace />} />
    </Routes>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <SessionProvider>
            <App />
          </SessionProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
