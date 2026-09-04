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

  const toggles = [
    ['enabled', ShieldCheck, 'showPresenceInDiscord', 'showPresenceInDiscordDesc'],
    ['showCover', Image, 'showCoverInDiscord', 'showCoverInDiscordDesc'],
    ['showTimer', Clock, 'showTimerInDiscord', 'showTimerInDiscordDesc'],
  ];

  return (
    <section className={`space-y-4 ${className}`} aria-labelledby="desktop-connect-settings-title">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 basis-64 items-start gap-3">
          <Radio size={18} className="mt-0.5 shrink-0 text-brand-red" aria-hidden="true" />
          <div className="min-w-0">
            <h3 id="desktop-connect-settings-title" className="text-sm font-semibold text-zinc-200">
              {t('settings.desktopConnectTitle', 'NoirSound Connect & Discord Rich Presence')}
            </h3>
            <p className="mt-1 text-ns-label leading-relaxed text-zinc-500">
              {t('settings.desktopConnectDesc', 'Broadcast current playing tracks to Discord via NoirSound Connect companion app.')}
            </p>
          </div>
        </div>
        <a href="/connect/desktop" className="ns-button-secondary inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold">
          <Plus size={15} aria-hidden="true" />
          <span>{t('connect.pairNewDevice', 'Pair Device')}</span>
        </a>
      </div>

      <div className="divide-y divide-zinc-800/60 border-y border-zinc-800/60">
        {toggles.map(([key, Icon, labelKey, descriptionKey]) => (
          <label key={key} className="flex min-h-14 cursor-pointer items-start gap-3 py-3">
            <Icon size={16} className="mt-0.5 shrink-0 text-brand-red" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-zinc-200">{t(`settings.${labelKey}`)}</span>
              <span className="mt-1 block text-ns-label text-zinc-500">{t(`settings.${descriptionKey}`)}</span>
            </span>
            <input
              type="checkbox"
              checked={settings[key]}
              onChange={(event) => handleToggleSetting(key, event.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-brand-red"
              aria-label={t(`settings.${labelKey}`)}
            />
          </label>
        ))}
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-zinc-300">{t('settings.connectedDevicesList', 'Connected Devices')}</h4>
        {loading ? (
          <div className="h-12 w-full animate-pulse rounded bg-zinc-900/60" />
        ) : devices.length === 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-zinc-400">
            <span>{t('settings.noConnectedDevices', 'No desktop devices paired yet.')}</span>
            <a href="/connect/desktop" className="flex min-h-11 items-center gap-2 text-brand-red hover:underline">
              <span>{t('connect.pairNow', 'Pair NoirSound Connect')}</span><ExternalLink size={14} aria-hidden="true" />
            </a>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/60 border-y border-zinc-800/60">
            {devices.map((device) => (
              <div key={device.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3">
                <div className="flex min-w-0 items-start gap-3">
                  <Laptop size={18} className="mt-0.5 shrink-0 text-zinc-400" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="break-words [overflow-wrap:anywhere] text-sm font-semibold text-zinc-200">{device.deviceName || 'MacBook Pro'}</p>
                    <p className="mt-1 break-words text-ns-meta text-zinc-500">
                      {device.platform || 'macOS'} · {t('settings.lastSeen', 'Last active')}: {device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleDateString() : t('settings.justNow', 'Just now')}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={revokingId === device.id}
                  onClick={() => handleRevoke(device.id)}
                  className="ns-icon-button ns-media-action text-[var(--ns-danger)] disabled:opacity-50"
                  aria-label={`${t('settings.revokeDevice', 'Revoke Device')}: ${device.deviceName || device.platform || 'MacBook Pro'}`}
                  title={t('settings.revokeAccess', 'Revoke')}
                ><Trash2 size={16} aria-hidden="true" /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
