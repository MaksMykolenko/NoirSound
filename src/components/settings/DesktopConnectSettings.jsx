import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Laptop, Radio, Trash2, Plus, ShieldCheck, Image, Clock, ExternalLink } from 'lucide-react';
import {
  getConnectedDevices,
  revokeConnectedDevice,
  getDiscordPresenceSettings,
  updateDiscordPresenceSettings
} from '../../api/desktopConnect';
import { useToastStore } from '../../store/toastStore';

export default function DesktopConnectSettings({ className = '' }) {
  const { t } = useTranslation();
  const addToast = useToastStore((state) => state.addToast);

  const [devices, setDevices] = useState([]);
  const [settings, setSettings] = useState({
    enabled: false,
    showCover: true,
    showTimer: true
  });
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([getConnectedDevices(), getDiscordPresenceSettings()])
      .then(([devicesData, settingsData]) => {
        if (mounted) {
          setDevices(devicesData?.devices || []);
          setSettings({
            enabled: Boolean(settingsData?.enabled),
            showCover: settingsData?.showCover !== false,
            showTimer: settingsData?.showTimer !== false
          });
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleToggleSetting = async (key, value) => {
    const nextSettings = { ...settings, [key]: value };
    setSettings(nextSettings);
    try {
      await updateDiscordPresenceSettings({ [key]: value });
      addToast(t('settings.presenceUpdated', 'Discord Rich Presence settings updated.'), 'success');
    } catch {
      // Rollback on failure
      setSettings(settings);
      addToast(t('errors.generic', 'Failed to update settings.'), 'error');
    }
  };

  const handleRevoke = async (deviceId) => {
    setRevokingId(deviceId);
    try {
      await revokeConnectedDevice(deviceId);
      setDevices((prev) => prev.filter((d) => d.id !== deviceId));
      addToast(t('connect.deviceRevokedSuccess', 'Device access revoked.'), 'success');
    } catch {
      addToast(t('errors.generic', 'Failed to revoke device.'), 'error');
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-red/10 border border-brand-red/20 text-brand-red">
            <Radio size={16} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-200">
              {t('settings.desktopConnectTitle', 'NoirSound Connect & Discord Rich Presence')}
            </h3>
            <p className="text-ns-meta text-zinc-500">
              {t('settings.desktopConnectDesc', 'Broadcast current playing tracks to Discord via NoirSound Connect companion app.')}
            </p>
          </div>
        </div>

        <a
          href="/connect/desktop"
          className="ns-button-secondary inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-md shrink-0"
        >
          <Plus size={13} />
          <span>{t('connect.pairNewDevice', 'Pair Device')}</span>
        </a>
      </div>

      {/* Main Settings Toggles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Main Discord Toggle */}
        <div className="flex items-start space-x-3 rounded-lg border border-zinc-800/60 bg-zinc-950/40 p-3.5">
          <ShieldCheck size={16} className="text-brand-red shrink-0 mt-0.5" />
          <div className="flex-1 space-y-0.5">
            <span className="block text-xs font-bold text-zinc-200">
              {t('settings.showPresenceInDiscord', 'Show in Discord')}
            </span>
            <span className="block text-ns-meta text-zinc-500 leading-normal">
              {t('settings.showPresenceInDiscordDesc', 'Listening status')}
            </span>
          </div>
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => handleToggleSetting('enabled', e.target.checked)}
            className="accent-brand-red h-4 w-4 rounded mt-0.5 cursor-pointer"
            aria-label={t('settings.showPresenceInDiscord', 'Show in Discord')}
          />
        </div>

        {/* Show Cover Toggle */}
        <div className="flex items-start space-x-3 rounded-lg border border-zinc-800/60 bg-zinc-950/40 p-3.5">
          <Image size={16} className="text-brand-red shrink-0 mt-0.5" />
          <div className="flex-1 space-y-0.5">
            <span className="block text-xs font-bold text-zinc-200">
              {t('settings.showCoverInDiscord', 'Show Cover Art')}
            </span>
            <span className="block text-ns-meta text-zinc-500 leading-normal">
              {t('settings.showCoverInDiscordDesc', 'Album artwork in Discord')}
            </span>
          </div>
          <input
            type="checkbox"
            checked={settings.showCover}
            onChange={(e) => handleToggleSetting('showCover', e.target.checked)}
            className="accent-brand-red h-4 w-4 rounded mt-0.5 cursor-pointer"
            aria-label={t('settings.showCoverInDiscord', 'Show Cover Art')}
          />
        </div>

        {/* Show Timer / Progress Toggle */}
        <div className="flex items-start space-x-3 rounded-lg border border-zinc-800/60 bg-zinc-950/40 p-3.5">
          <Clock size={16} className="text-brand-red shrink-0 mt-0.5" />
          <div className="flex-1 space-y-0.5">
            <span className="block text-xs font-bold text-zinc-200">
              {t('settings.showTimerInDiscord', 'Show Timestamps')}
            </span>
            <span className="block text-ns-meta text-zinc-500 leading-normal">
              {t('settings.showTimerInDiscordDesc', 'Remaining / elapsed timer')}
            </span>
          </div>
          <input
            type="checkbox"
            checked={settings.showTimer}
            onChange={(e) => handleToggleSetting('showTimer', e.target.checked)}
            className="accent-brand-red h-4 w-4 rounded mt-0.5 cursor-pointer"
            aria-label={t('settings.showTimerInDiscord', 'Show Timestamps')}
          />
        </div>
      </div>

      {/* Connected Devices List */}
      <div className="space-y-2 pt-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          {t('settings.connectedDevicesList', 'Connected Devices')}
        </h4>

        {loading ? (
          <div className="h-12 w-full animate-pulse rounded-lg bg-zinc-900/60 border border-zinc-800/40" />
        ) : devices.length === 0 ? (
          <div className="flex items-center justify-between rounded-lg border border-zinc-800/60 bg-zinc-950/30 p-3.5 text-xs text-zinc-400">
            <span>{t('settings.noConnectedDevices', 'No desktop devices paired yet.')}</span>
            <a href="/connect/desktop" className="text-brand-red hover:underline flex items-center gap-1">
              <span>{t('connect.pairNow', 'Pair NoirSound Connect')}</span>
              <ExternalLink size={12} />
            </a>
          </div>
        ) : (
          <div className="space-y-2">
            {devices.map((device) => (
              <div
                key={device.id}
                className="flex items-center justify-between rounded-lg border border-zinc-800/60 bg-zinc-950/50 p-3"
              >
                <div className="flex items-center space-x-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300">
                    <Laptop size={15} />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-semibold text-zinc-200">
                        {device.deviceName || 'MacBook Pro'}
                      </span>
                      <span className="rounded bg-zinc-800/80 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400">
                        {device.platform || 'macOS'}
                      </span>
                    </div>
                    <span className="text-[11px] text-zinc-500 block">
                      {t('settings.lastSeen', 'Last active')}: {device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleDateString() : t('settings.justNow', 'Just now')}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={revokingId === device.id}
                  onClick={() => handleRevoke(device.id)}
                  className="flex items-center space-x-1 text-xs text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 px-2.5 py-1.5 rounded-md transition-colors disabled:opacity-50"
                  aria-label={t('settings.revokeDevice', 'Revoke Device')}
                >
                  <Trash2 size={12} />
                  <span>{t('settings.revokeAccess', 'Revoke')}</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
