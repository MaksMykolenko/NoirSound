import { X, Terminal, Cpu, Wifi, Radio } from 'lucide-react';
import { DiagnosticsData } from '../types';

interface DiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  diagnostics: DiagnosticsData;
}

export default function DiagnosticsModal({
  isOpen,
  onClose,
  diagnostics
}: DiagnosticsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950 p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
          <div className="flex items-center space-x-2 text-zinc-300">
            <Terminal size={16} className="text-rose-500" />
            <h3 className="font-bold text-xs uppercase tracking-wider">Діагностика</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 rounded-lg p-1 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="space-y-2 text-xs font-mono text-zinc-400 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar">
          <div className="flex justify-between border-b border-zinc-900 pb-1.5">
            <span className="text-zinc-500">Версія застосунку:</span>
            <span className="text-zinc-200">{diagnostics.appVersion}</span>
          </div>

          <div className="flex justify-between border-b border-zinc-900 pb-1.5">
            <span className="text-zinc-500">Discord Adapter:</span>
            <span className="text-zinc-200 truncate max-w-[160px]" title={diagnostics.adapterName || 'Discord IPC Protocol'}>
              {diagnostics.adapterName || 'Discord IPC'}
            </span>
          </div>

          <div className="flex justify-between border-b border-zinc-900 pb-1.5">
            <span className="text-zinc-500">Application ID:</span>
            <span className="text-zinc-200">{diagnostics.applicationId || '1540281435296895066'}</span>
          </div>

          <div className="flex justify-between border-b border-zinc-900 pb-1.5">
            <span className="text-zinc-500">API URL:</span>
            <span className="text-zinc-200 truncate max-w-[160px]">{diagnostics.apiBaseUrl}</span>
          </div>

          <div className="flex justify-between border-b border-zinc-900 pb-1.5">
            <span className="text-zinc-500">ID пристрою:</span>
            <span className="text-zinc-200">{diagnostics.maskedDeviceId}</span>
          </div>

          <div className="flex justify-between border-b border-zinc-900 pb-1.5">
            <span className="text-zinc-500 flex items-center gap-1"><Wifi size={11} /> Серверний зв'язок:</span>
            <span className={diagnostics.serverState === 'Connected' ? 'text-emerald-400' : 'text-amber-400'}>
              {diagnostics.serverState}
            </span>
          </div>

          <div className="flex justify-between border-b border-zinc-900 pb-1.5">
            <span className="text-zinc-500 flex items-center gap-1"><Cpu size={11} /> Discord міст:</span>
            <span className="text-zinc-200">{diagnostics.discordBridgeState}</span>
          </div>

          {diagnostics.lastCommand && (
            <div className="flex justify-between border-b border-zinc-900 pb-1.5">
              <span className="text-zinc-500">Last Command:</span>
              <span className="text-zinc-300 truncate max-w-[150px]">{diagnostics.lastCommand}</span>
            </div>
          )}

          {diagnostics.lastResult && (
            <div className="flex justify-between border-b border-zinc-900 pb-1.5">
              <span className="text-zinc-500">Last Result:</span>
              <span className="text-emerald-400">{diagnostics.lastResult}</span>
            </div>
          )}

          <div className="flex justify-between">
            <span className="text-zinc-500 flex items-center gap-1"><Radio size={11} /> Останнє оновлення:</span>
            <span className="text-zinc-300">{diagnostics.lastPresenceUpdate || 'Немає'}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 text-xs font-medium text-zinc-300 rounded-lg transition-colors"
        >
          Закрити
        </button>
      </div>
    </div>
  );
}
