import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AppLayout from './components/layout/AppLayout';
import ToastContainer from './components/ui/ToastContainer';
import AuthModal from './components/auth/AuthModal';
import { useUserStore } from './store/userStore';
import { useToastStore } from './store/toastStore';
import { useThemeStore } from './store/themeStore';
import { isMockMode } from './api/mode';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes cache
      refetchOnWindowFocus: false,
    },
  },
});

// Lazy load pages for performance
const Home = lazy(() => import('./pages/Home'));
const Discover = lazy(() => import('./pages/Discover'));
const TrackPage = lazy(() => import('./pages/TrackPage'));
const ArtistPage = lazy(() => import('./pages/ArtistPage'));
const Library = lazy(() => import('./pages/Library'));
const Upload = lazy(() => import('./pages/Upload'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Profile = lazy(() => import('./pages/Profile'));
const PlaylistPage = lazy(() => import('./pages/PlaylistPage'));
const NotFound = lazy(() => import('./pages/NotFound'));
const LegalPage = lazy(() => import('./pages/LegalPage'));
const Admin = lazy(() => import('./pages/Admin'));

// Fallback skeleton while loading routes
const RouteSkeleton = () => (
  <div className="w-full h-[50vh] flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-brand-red border-t-transparent rounded-full animate-spin"></div>
  </div>
);

export default function App() {
  const fetchCurrentUser = useUserStore((state) => state.fetchCurrentUser);
  const isAuthModalOpen = useUserStore((state) => state.isAuthModalOpen);
  const setAuthModalOpen = useUserStore((state) => state.setAuthModalOpen);
  const addToast = useToastStore((state) => state.addToast);
  const hydrateTheme = useThemeStore((state) => state.hydrateTheme);
  const listenToSystemTheme = useThemeStore((state) => state.listenToSystemTheme);

  useEffect(() => {
    hydrateTheme();
    return listenToSystemTheme();
  }, [hydrateTheme, listenToSystemTheme]);

  useEffect(() => {
    fetchCurrentUser().catch(() => {
      // The store exposes the real session error; the API error event renders the toast.
    });
  }, [fetchCurrentUser]);

  useEffect(() => {
    const handleApiError = (event) => {
      addToast(event.detail?.message || 'API request failed.', 'error');
    };
    window.addEventListener('noirsound:api-error', handleApiError);
    return () => window.removeEventListener('noirsound:api-error', handleApiError);
  }, [addToast]);

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        {isMockMode() && (
          <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[120] px-3 py-1 rounded-full bg-amber-400 text-black text-[10px] font-black uppercase tracking-widest shadow-lg">
            Demo mode
          </div>
        )}
        <AppLayout>
          <Suspense fallback={<RouteSkeleton />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/discover" element={<Discover />} />
              <Route path="/track/:id" element={<TrackPage />} />
              <Route path="/artist/:id" element={<ArtistPage />} />
              <Route path="/library" element={<Library />} />
              <Route path="/upload" element={<Upload />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/playlist/:id" element={<PlaylistPage />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/terms" element={<LegalPage slug="terms" />} />
              <Route path="/privacy" element={<LegalPage slug="privacy" />} />
              <Route path="/guidelines" element={<LegalPage slug="guidelines" />} />
              <Route path="/copyright" element={<LegalPage slug="copyright" />} />
              <Route path="/dmca" element={<LegalPage slug="dmca" />} />
              <Route path="/abuse" element={<LegalPage slug="abuse" />} />
              <Route path="/creator-rules" element={<LegalPage slug="creator-rules" />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AppLayout>
        <ToastContainer />
        <AuthModal 
          isOpen={isAuthModalOpen} 
          onClose={() => setAuthModalOpen(false)} 
        />
      </Router>
    </QueryClientProvider>
  );
}
