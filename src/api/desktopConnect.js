import { apiFetch } from './client';
import { isMockMode } from './mode';

export async function getPairingVerifyInfo(userCode) {
  if (isMockMode()) {
    return {
      userCode,
      deviceName: 'MacBook Pro (Demo)',
      platform: 'macOS',
      appVersion: '0.1.0',
      createdAt: new Date().toISOString()
    };
  }
  return apiFetch(`/desktop-connect/device/verify-info?code=${encodeURIComponent(userCode)}`);
}

export async function authorizePairingDevice(userCode, enableDiscordPresence = true) {
  if (isMockMode()) {
    return { status: 'success', message: 'Device authorized (Demo mode)' };
  }
  return apiFetch('/desktop-connect/device/authorize', {
    method: 'POST',
    body: JSON.stringify({ userCode, enableDiscordPresence })
  });
}

export async function getConnectedDevices() {
  if (isMockMode()) {
    return {
      devices: [
        {
          id: 'demo-device-1',
          deviceName: 'MacBook Pro',
          platform: 'macOS',
          appVersion: '0.1.0',
          lastSeenAt: new Date().toISOString(),
          createdAt: new Date().toISOString()
        }
      ]
    };
  }
  return apiFetch('/desktop-connect/devices');
}

export async function revokeConnectedDevice(deviceId) {
  if (isMockMode()) {
    return { status: 'success', message: 'Device revoked (Demo mode)' };
  }
  return apiFetch(`/desktop-connect/devices/${deviceId}`, {
    method: 'DELETE'
  });
}

export async function getDiscordPresenceSettings() {
  if (isMockMode()) {
    return { enabled: true, showCover: true, showTimer: true };
  }
  return apiFetch('/desktop-connect/settings');
}

export async function updateDiscordPresenceSettings(settings) {
  if (isMockMode()) {
    return settings;
  }
  return apiFetch('/desktop-connect/settings', {
    method: 'PATCH',
    body: JSON.stringify(settings)
  });
}

export async function sendPresenceEvent(payload, { keepalive = false } = {}) {
  if (isMockMode()) {
    return { acknowledged: true, mock: true };
  }
  return apiFetch('/desktop-connect/presence/event', {
    method: 'POST',
    body: JSON.stringify(payload),
    keepalive,
    suppressErrorToast: true
  });
}
