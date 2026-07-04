import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Navigate, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AppLayout from './components/layout/AppLayout';
import ToastContainer from './components/ui/ToastContainer';
import AuthModal from './components/auth/AuthModal';
import { useUserStore } from './store/userStore';
import { useToastStore } from './store/toastStore';
import { useThemeStore } from './store/themeStore';
import { isMockMode } from './api/mode';
import { getApiErrorMessage } from './utils/apiErrorMessage';

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
const BatchUploadPage = lazy(() => import('./pages/upload/BatchUploadPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Profile = lazy(() => import('./pages/Profile'));
const PlaylistPage = lazy(() => import('./pages/PlaylistPage'));
const NotFound = lazy(() => import('./pages/NotFound'));
const LegalPage = lazy(() => import('./pages/LegalPage'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const AdminOverview = lazy(() => import('./pages/admin/AdminOverview'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminUserDetail = lazy(() => import('./pages/admin/AdminUserDetail'));
const AdminTracks = lazy(() => import('./pages/admin/AdminTracks'));
const AdminTrackDetail = lazy(() => import('./pages/admin/AdminTrackDetail'));
const AdminArtists = lazy(() => import('./pages/admin/AdminArtists'));
const AdminArtistDetail = lazy(() => import('./pages/admin/AdminArtistDetail'));
const AdminReports = lazy(() => import('./pages/admin/AdminReports'));
const AdminReportDetail = lazy(() => import('./pages/admin/AdminReportDetail'));
const AdminComments = lazy(() => import('./pages/admin/AdminComments'));
const AdminUploads = lazy(() => import('./pages/admin/AdminUploads'));
const AdminAuditLogs = lazy(() => import('./pages/admin/AdminAuditLogs'));
const AdminSystem = lazy(() => import('./pages/admin/AdminSystem'));
const AdminStats = lazy(() => import('./pages/admin/AdminStats'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));

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
    const url = new URL(window.location.href);
    const authResult = url.searchParams.get('auth');
    const authReason = url.searchParams.get('reason');
    if (authResult) {
      url.searchParams.delete('auth');
      url.searchParams.delete('reason');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }

    fetchCurrentUser()
      .then((user) => {
        if (authResult === 'google_success' && user) {
          addToast('Signed in with Google.', 'success');
        }
      })
      .catch(() => {
        if (authResult === 'google_success') {
          addToast('Google sign-in could not be completed.', 'error');
        }
      });

    if (authResult === 'google_error') {
      const messages = {
        access_denied: 'Google sign-in was cancelled.',
        account_inactive: 'This NoirSound account is not active.',
        not_configured: 'Google sign-in is not configured.',
        invalid_state: 'Google sign-in expired. Please try again.',
      };
      addToast(messages[authReason] || 'Google sign-in failed. Please try again.', 'error');
    }
  }, [addToast, fetchCurrentUser]);

  useEffect(() => {
    const handleApiError = (event) => {
      // Keep the raw code/status in the developer console for triage, but show
      // users a friendly, localized message (never the raw backend code).
      if (event.detail?.code || event.detail?.status) {
        console.debug('[api-error]', event.detail);
      }
      addToast(getApiErrorMessage(event.detail), 'error');
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
              <Route path="/upload/batch" element={<BatchUploadPage />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/playlist/:id" element={<PlaylistPage />} />
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Navigate to="/admin/overview" replace />} />
                <Route path="overview" element={<AdminOverview />} />
                <Route path="reports" element={<AdminReports />} />
                <Route path="reports/:id" element={<AdminReportDetail />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="users/:id" element={<AdminUserDetail />} />
                <Route path="tracks" element={<AdminTracks />} />
                <Route path="tracks/:id" element={<AdminTrackDetail />} />
                <Route path="artists" element={<AdminArtists />} />
                <Route path="artists/:id" element={<AdminArtistDetail />} />
                <Route path="comments" element={<AdminComments />} />
                <Route path="uploads" element={<AdminUploads />} />
                <Route path="moderation" element={<Navigate to="/admin/reports" replace />} />
                <Route path="audit-logs" element={<AdminAuditLogs />} />
                <Route path="system" element={<AdminSystem />} />
                <Route path="system/stats" element={<AdminStats />} />
                <Route path="settings" element={<AdminSettings />} />
              </Route>
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
