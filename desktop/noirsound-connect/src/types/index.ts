export type ConnectionStatus =
  | 'not_paired'
  | 'waiting_for_confirmation'
  | 'connecting'
  | 'connected'
  | 'discord_unavailable'
  | 'revoked'
  | 'error';

export interface TrackMetadata {
  id: string;
  title: string;
  artistName: string;
  albumTitle: string | null;
  durationMs: number;
  positionMs: number;
  coverUrl: string | null;
  shareUrl: string;
}

export interface AppSettings {
  enabled: boolean;
  showCover: boolean;
  showTimer: boolean;
  launchAtLogin: boolean;
}

export interface DiagnosticsData {
  appVersion: string;
  apiBaseUrl: string;
  maskedDeviceId: string;
  serverState: string;
  discordBridgeState: string;
  lastPresenceUpdate: string | null;
}

export interface PairingState {
  deviceCode: string;
  userCode: string;
  verificationUriComplete: string;
  expiresIn: number;
  pollInterval: number;
}
