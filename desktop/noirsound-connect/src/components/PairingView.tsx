import { useState } from 'react';
import { Radio, ExternalLink, Copy, Check, RefreshCw } from 'lucide-react';
import { PairingState } from '../types';

interface PairingViewProps {
  pairing: PairingState | null;
  isLoading: boolean;
  onRefresh: () => void;
  onOpenBrowser: (url: string) => void;
}

export default function PairingView({
  pairing,
  isLoading,
  onRefresh,
  onOpenBrowser
}: PairingViewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!pairing?.userCode) return;
    navigator.clipboard.writeText(pairing.userCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading || !pairing) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-rose-500" />
        <span className="text-xs text-zinc-400">Ініціалізація підключення…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1.5">
        <h2 className="text-base font-bold text-zinc-100">Підключення до NoirSound</h2>
        <p className="text-xs text-zinc-400 leading-relaxed">
          Відкрий посилання у браузері та підтвердь підключення цього пристрою до свого акаунту NoirSound.
        </p>
      </div>

      {/* Code Card */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-center space-y-3">
        <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 block">
          Код підтвердження
        </span>
        <div className="flex items-center justify-center space-x-2">
          <span className="font-mono text-2xl font-black tracking-widest text-zinc-100 sm:text-3xl">
            {pairing.userCode}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            title="Скопіювати код"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
          </button>
        </div>
      </div>

      {/* Primary Action Button */}
      <div className="space-y-2.5">
        <button
          type="button"
          onClick={() => onOpenBrowser(pairing.verificationUriComplete)}
          className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 font-semibold text-sm text-white shadow-lg shadow-rose-600/20 transition-all active:scale-[0.99]"
        >
          <span>Відкрити NoirSound для підтвердження</span>
          <ExternalLink size={14} />
        </button>

        <div className="flex items-center justify-between px-1 text-[11px] text-zinc-500">
          <span className="flex items-center gap-1.5">
            <Radio size={12} className="text-rose-500 animate-pulse" />
            Очікуємо підтвердження на сайті…
          </span>
          <button
            type="button"
            onClick={onRefresh}
            className="hover:text-zinc-300 flex items-center gap-1 transition-colors"
          >
            <RefreshCw size={11} />
            <span>Оновити код</span>
          </button>
        </div>
      </div>
    </div>
  );
}
