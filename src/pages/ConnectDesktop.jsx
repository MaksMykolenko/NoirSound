import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Laptop, Check, AlertCircle, Radio, ShieldCheck, ArrowRight, Music2 } from 'lucide-react';
import { useUserStore } from '../store/userStore';
import { getPairingVerifyInfo, authorizePairingDevice } from '../api/desktopConnect';
import PageMeta from '../components/meta/PageMeta';
import { useToastStore } from '../store/toastStore';

export default function ConnectDesktop() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, authHydrated, setAuthModalOpen } = useUserStore();
  const addToast = useToastStore((state) => state.addToast);

  const initialCode = (searchParams.get('code') || '').trim().toUpperCase();
  const [code, setCode] = useState(initialCode);
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(Boolean(initialCode));
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [error, setError] = useState(null);
  const [enableDiscordPresence, setEnableDiscordPresence] = useState(true);

  // Fetch device details when code is present
  useEffect(() => {
    if (!initialCode || !user) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    getPairingVerifyInfo(initialCode)
      .then((data) => {
        if (isMounted) {
          setDeviceInfo(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || t('connect.invalidOrExpiredCode', 'Pairing code is invalid or has expired.'));
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [initialCode, user, t]);

  const handleLookup = async (e) => {
    e?.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return;

    setIsLoading(true);
    setError(null);
    try {
      const data = await getPairingVerifyInfo(cleanCode);
      setDeviceInfo(data);
    } catch (err) {
      setError(err.message || t('connect.invalidOrExpiredCode', 'Pairing code is invalid or has expired.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthorize = async () => {
    if (!code.trim() && !deviceInfo?.userCode) return;
    const targetCode = (deviceInfo?.userCode || code).trim().toUpperCase();

    setIsAuthorizing(true);
    setError(null);

    try {
      await authorizePairingDevice(targetCode, enableDiscordPresence);
      setIsAuthorized(true);
      addToast(t('connect.connectedSuccess', 'NoirSound Connect successfully paired!'), 'success');
    } catch (err) {
      setError(err.message || t('connect.authorizationFailed', 'Failed to authorize device.'));
    } finally {
      setIsAuthorizing(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:py-16">
      <PageMeta
        title={`${t('connect.pageTitle', 'Connect NoirSound Desktop')} · NoirSound`}
        description="Pair your desktop NoirSound Connect app for Discord Rich Presence."
        canonical="https://noirsound.co/connect/desktop"
      />

      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center space-x-3 border-b border-zinc-800/60 pb-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-red/10 border border-brand-red/20 text-brand-red">
            <Radio className="h-6 w-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-100 sm:text-2xl">
              NoirSound Connect
            </h1>
            <p className="text-xs text-zinc-400 sm:text-sm">
              {t('connect.subtitle', 'Discord Rich Presence companion app')}
            </p>
          </div>
        </div>

        {/* Not Logged In State */}
        {authHydrated && !user && (
          <div className="mt-6 space-y-5 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400">
              <Laptop className="h-7 w-7" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-semibold text-zinc-200">
                {t('connect.signInRequired', 'Sign in to connect device')}
              </h2>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                {t('connect.signInDesc', 'You need to be signed in to your NoirSound account to link your desktop app.')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="ns-button-primary inline-flex items-center space-x-2 px-6 py-3 text-sm font-semibold rounded-lg"
            >
              <span>{t('header.signIn', 'Sign In')}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Authorized Success State */}
        {user && isAuthorized && (
          <div className="mt-6 space-y-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Check className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-zinc-100">
                {t('connect.deviceConnected', 'Device Connected!')}
              </h2>
              <p className="text-sm text-zinc-400 max-w-md mx-auto">
                {t('connect.deviceConnectedDesc', 'NoirSound Connect is now linked to your account. Your currently playing tracks will appear as Discord listening activity.')}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate('/profile?tab=settings')}
                className="ns-button-primary w-full sm:w-auto px-5 py-2.5 text-sm font-semibold rounded-lg"
              >
                {t('connect.viewSettings', 'Manage Connections')}
              </button>
              <Link
                to="/discover"
                className="ns-button-secondary w-full sm:w-auto px-5 py-2.5 text-sm font-medium rounded-lg text-center"
              >
                {t('actions.discoverMusic', 'Start Listening')}
              </Link>
            </div>
          </div>
        )}

        {/* Authorization Form */}
        {user && !isAuthorized && (
          <div className="mt-6 space-y-6">
            {error && (
              <div role="alert" className="flex items-center space-x-3 rounded-lg border border-rose-500/20 bg-rose-500/10 p-3.5 text-sm text-rose-300">
                <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {!deviceInfo && !isLoading && (
              <form onSubmit={handleLookup} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="user-code-input" className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    {t('connect.enterCode', 'Enter Pairing Code from NoirSound Connect')}
                  </label>
                  <input
                    id="user-code-input"
                    type="text"
                    placeholder="e.g. K7F4-M2QP"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    maxLength={10}
                    className="ns-field w-full px-4 py-3 text-center text-lg font-mono tracking-widest uppercase sm:text-xl"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!code.trim() || isLoading}
                  className="ns-button-primary w-full py-3 text-sm font-semibold rounded-lg"
                >
                  {t('connect.lookupDevice', 'Find Device')}
                </button>
              </form>
            )}

            {isLoading && (
              <div className="flex flex-col items-center justify-center py-8 space-y-3">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-zinc-700 border-t-brand-red" />
                <span className="text-xs text-zinc-400">{t('connect.loadingDetails', 'Checking pairing code...')}</span>
              </div>
            )}

            {deviceInfo && !isLoading && (
              <div className="space-y-5">
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5 space-y-3">
                  <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
                    <div className="flex items-center space-x-2.5">
                      <Laptop className="h-5 w-5 text-brand-red" />
                      <span className="font-semibold text-zinc-200">
                        {deviceInfo.deviceName || 'MacBook Pro'}
                      </span>
                    </div>
                    <span className="rounded-md bg-zinc-800/80 px-2.5 py-1 font-mono text-xs text-zinc-300">
                      {deviceInfo.platform || 'macOS'}
                    </span>
                  </div>

                  <div className="space-y-2 pt-1 text-xs sm:text-sm text-zinc-400">
                    <div className="flex items-center space-x-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                      <span>{t('connect.scopePresence', 'Feature: Broadcast current playing track to Discord')}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Music2 className="h-4 w-4 text-brand-red shrink-0" />
                      <span>{t('connect.scopeNoAudio', 'Privacy: No audio files, passwords, or personal files are transmitted')}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-start space-x-3 rounded-lg border border-zinc-800/60 bg-zinc-950/40 p-3.5">
                  <input
                    id="enable-discord-presence"
                    type="checkbox"
                    checked={enableDiscordPresence}
                    onChange={(e) => setEnableDiscordPresence(e.target.checked)}
                    className="accent-brand-red h-4 w-4 rounded mt-0.5 cursor-pointer"
                  />
                  <label htmlFor="enable-discord-presence" className="text-xs sm:text-sm text-zinc-300 cursor-pointer">
                    <span className="font-medium block">{t('connect.enablePresenceToggle', 'Show current track in Discord')}</span>
                    <span className="text-zinc-500 text-xs">{t('connect.enablePresenceToggleDesc', 'You can change or revoke this anytime in your profile settings.')}</span>
                  </label>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDeviceInfo(null);
                      setCode('');
                    }}
                    className="ns-button-secondary flex-1 py-3 text-sm font-medium rounded-lg"
                  >
                    {t('actions.cancel', 'Cancel')}
                  </button>
                  <button
                    type="button"
                    disabled={isAuthorizing}
                    onClick={handleAuthorize}
                    className="ns-button-primary flex-1 py-3 text-sm font-semibold rounded-lg flex items-center justify-center space-x-2"
                  >
                    {isAuthorizing ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        <span>{t('connect.authorizeButton', 'Connect')}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
