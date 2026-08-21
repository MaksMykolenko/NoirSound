import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Radio, Power, RefreshCw, Terminal, AlertCircle } from 'lucide-react';
import PairingView from './components/PairingView';
import ConnectedView from './components/ConnectedView';
import DiagnosticsModal from './components/DiagnosticsModal';
import { ConnectionStatus, TrackMetadata, AppSettings, DiagnosticsData, PairingState } from './types';

export default function App() {
  const [status, setStatus] = useState<ConnectionStatus>('not_paired');
  const [pairing, setPairing] = useState<PairingState | null>(null);
  const [currentTrack, setCurrentTrack] = useState<TrackMetadata | null>(null);
  const [settings, setSettings] = useState<AppSettings>({
    enabled: true,
    showCover: true,
    showTimer: true,
    launchAtLogin: false
  });
  const [diagnostics, setDiagnostics] = useState<DiagnosticsData>({
    appVersion: '0.1.0',
    apiBaseUrl: 'https://noirsound.co',
    maskedDeviceId: 'none',
    serverState: 'Disconnected',
    discordBridgeState: 'Idle',
    lastPresenceUpdate: null
  });
  const [isDiscordAvailable, setIsDiscordAvailable] = useState(true);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [isLoadingPairing, setIsLoadingPairing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize pairing flow
  const startPairingFlow = useCallback(async () => {
    setIsLoadingPairing(true);
    setErrorMessage(null);
    try {
      const res = await invoke<PairingState>('start_pairing', {
        deviceName: 'MacBook Pro',
        platform: 'macOS'
      });
      setPairing(res);
      setStatus('waiting_for_confirmation');
    } catch (err: any) {
      setErrorMessage(err?.toString() || 'Не вдалося створити код сполучення');
    } finally {
      setIsLoadingPairing(false);
    }
  }, []);

  // Sync initial state from Tauri backend
  const syncState = useCallback(async () => {
    try {
      const state = await invoke<{
        status: ConnectionStatus;
        track: TrackMetadata | null;
        settings: AppSettings;
        diagnostics: DiagnosticsData;
        isDiscordAvailable: boolean;
      }>('get_app_state');

      setStatus(state.status);
      setCurrentTrack(state.track);
      setSettings(state.settings);
      setDiagnostics(state.diagnostics);
      setIsDiscordAvailable(state.isDiscordAvailable);

      if (state.status === 'not_paired') {
        startPairingFlow();
      }
    } catch {
      // Running in browser dev mode without Tauri runtime
      startPairingFlow();
    }
  }, [startPairingFlow]);

  useEffect(() => {
    syncState();

    // Listen for backend events
    let unlistenPresence: () => void;
    let unlistenStatus: () => void;

    listen<TrackMetadata | null>('presence_update', (event) => {
      setCurrentTrack(event.payload);
      setDiagnostics((prev) => ({
        ...prev,
        lastPresenceUpdate: new Date().toLocaleTimeString()
      }));
    }).then((fn) => { unlistenPresence = fn; });

    listen<{
      status: ConnectionStatus;
      isDiscordAvailable: boolean;
      track?: TrackMetadata | null;
      diagnostics?: DiagnosticsData;
      settings?: AppSettings;
    }>('connection_status', (event) => {
      setStatus(event.payload.status);
      setIsDiscordAvailable(event.payload.isDiscordAvailable);
      if (event.payload.diagnostics) setDiagnostics(event.payload.diagnostics);
      if (event.payload.settings) setSettings(event.payload.settings);
      if (event.payload.track !== undefined) setCurrentTrack(event.payload.track);
    }).then((fn) => { unlistenStatus = fn; });

    return () => {
      if (unlistenPresence) unlistenPresence();
      if (unlistenStatus) unlistenStatus();
    };
  }, [syncState]);

  // Polling loop while waiting for confirmation
  useEffect(() => {
    if (status !== 'waiting_for_confirmation' || !pairing?.deviceCode) return;

    let isSubscribed = true;
    const interval = setInterval(async () => {
      try {
        const result = await invoke<{ success: boolean; deviceId?: string }>('poll_pairing', {
          deviceCode: pairing.deviceCode
        });
        if (result?.success && isSubscribed) {
          setStatus('connected');
          syncState();
        }
      } catch (err: any) {
        if (err?.includes?.('invalid_grant')) {
          startPairingFlow();
        }
      }
    }, (pairing.pollInterval || 5) * 1000);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [status, pairing, syncState, startPairingFlow]);

  const handleOpenBrowser = async (url: string) => {
    try {
      await invoke('open_browser', { url });
    } catch {
      window.open(url, '_blank');
    }
  };

  const handleTogglePresence = async (enabled: boolean) => {
    setSettings((prev) => ({ ...prev, enabled }));
    try {
      await invoke('toggle_presence_enabled', { enabled });
    } catch {
      // rollback
      setSettings((prev) => ({ ...prev, enabled: !enabled }));
    }
  };

  const handleDisconnect = async () => {
    try {
      await invoke('disconnect_device');
      setStatus('not_paired');
      setCurrentTrack(null);
      startPairingFlow();
    } catch {
      // ignore
    }
  };

  const handleReconnect = async () => {
    try {
      await invoke('reconnect');
      syncState();
    } catch {
      // ignore
    }
  };

  const isConnected = status === 'connected' || (status as string) === 'presence_active';

  return (
    <main className="flex flex-col h-screen w-full bg-zinc-950 text-zinc-100 p-4 justify-between select-none">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
        <div className="flex items-center space-x-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-600/10 border border-rose-600/20 text-rose-500">
            <Radio size={15} />
          </div>
          <div>
            <h1 className="font-bold text-xs tracking-wide text-zinc-100">NoirSound Connect</h1>
            <span className="text-[10px] text-zinc-500 font-mono">v0.1.0</span>
          </div>
        </div>

        {/* Status Pills */}
        <div className="flex items-center space-x-1.5 text-[10px] font-medium">
          {/* Server Pill */}
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 border ${
              isConnected
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isConnected ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            {isConnected ? 'Сервер' : 'З’єднання'}
          </span>

          {/* Discord Pill */}
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 border ${
              isDiscordAvailable
                ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isDiscordAvailable ? 'bg-indigo-400' : 'bg-zinc-500'
              }`}
            />
            Discord
          </span>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 py-4 overflow-y-auto custom-scrollbar">
        {errorMessage && (
          <div className="mb-3 flex items-center space-x-2 rounded-lg border border-rose-500/20 bg-rose-500/10 p-2.5 text-xs text-rose-300">
            <AlertCircle size={14} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {status === 'not_paired' || status === 'waiting_for_confirmation' ? (
          <PairingView
            pairing={pairing}
            isLoading={isLoadingPairing}
            onRefresh={startPairingFlow}
            onOpenBrowser={handleOpenBrowser}
          />
        ) : (
          <ConnectedView
            currentTrack={currentTrack}
            settings={settings}
            isDiscordAvailable={isDiscordAvailable}
            onTogglePresence={handleTogglePresence}
            onOpenBrowser={handleOpenBrowser}
          />
        )}
      </div>

      {/* Footer Actions */}
      <footer className="flex items-center justify-between border-t border-zinc-800/80 pt-3 text-xs text-zinc-400">
        <button
          type="button"
          onClick={() => setIsDiagnosticsOpen(true)}
          className="flex items-center space-x-1 hover:text-zinc-200 transition-colors"
        >
          <Terminal size={13} />
          <span>Діагностика</span>
        </button>

        <div className="flex items-center space-x-2">
          {isConnected && (
            <>
              <button
                type="button"
                onClick={handleReconnect}
                title="Перепідключити"
                className="flex items-center space-x-1 p-1.5 hover:text-zinc-200 rounded-md transition-colors"
              >
                <RefreshCw size={12} />
              </button>
              <button
                type="button"
                onClick={handleDisconnect}
                title="Від’єднати пристрій"
                className="flex items-center space-x-1 text-rose-400 hover:text-rose-300 p-1.5 rounded-md transition-colors"
              >
                <Power size={12} />
              </button>
            </>
          )}
        </div>
      </footer>

      {/* Diagnostics Modal */}
      <DiagnosticsModal
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
        diagnostics={diagnostics}
      />
    </main>
  );
}
