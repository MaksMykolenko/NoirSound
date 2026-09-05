import { Music, Radio, Disc, ExternalLink } from 'lucide-react';
import { TrackMetadata, AppSettings } from '../types';

interface ConnectedViewProps {
  currentTrack: TrackMetadata | null;
  settings: AppSettings;
  isDiscordAvailable: boolean;
  onTogglePresence: (enabled: boolean) => void;
  onOpenBrowser: (url: string) => void;
}

function formatTime(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export default function ConnectedView({
  currentTrack,
  settings,
  isDiscordAvailable,
  onTogglePresence,
  onOpenBrowser
}: ConnectedViewProps) {
  const hasTrack = Boolean(currentTrack);
  const progressPercent = currentTrack && currentTrack.durationMs > 0
    ? Math.min(100, Math.max(0, (currentTrack.positionMs / currentTrack.durationMs) * 100))
    : 0;

  return (
    <div className="space-y-4">
      {/* Current Track Card */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3 shadow-inner">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
            <Disc size={12} className={hasTrack ? 'text-rose-500 animate-spin-slow' : 'text-zinc-600'} />
            Зараз грає
          </span>
          {hasTrack && (
            settings.enabled ? (
              isDiscordAvailable ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
                  <Radio size={9} className="animate-pulse text-emerald-400" />
                  Discord прийняв activity
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400 border border-amber-500/20">
                  <Radio size={9} className="text-amber-400" />
                  Discord activity pending
                </span>
              )
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400 border border-zinc-700">
                Активність вимкнено
              </span>
            )
          )}
        </div>

        {hasTrack && currentTrack ? (
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              {/* Cover Image */}
              <div className="h-14 w-14 shrink-0 rounded-lg overflow-hidden bg-zinc-800 border border-zinc-700/60 shadow-md">
                {currentTrack.coverUrl ? (
                  <img
                    src={currentTrack.coverUrl}
                    alt={currentTrack.title}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-zinc-600">
                    <Music size={20} />
                  </div>
                )}
              </div>

              {/* Metadata */}
              <div className="min-w-0 flex-1 space-y-0.5">
                <h3 className="font-semibold text-sm text-zinc-100 truncate">
                  {currentTrack.title}
                </h3>
                <p className="text-xs text-zinc-400 truncate">
                  {currentTrack.artistName}
                  {currentTrack.albumTitle ? ` • ${currentTrack.albumTitle}` : ''}
                </p>
              </div>
            </div>

            {/* Progress Bar & Timestamps */}
            <div className="space-y-1 pt-1">
              <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-500 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-zinc-500">
                <span>{formatTime(currentTrack.positionMs)}</span>
                <span>{formatTime(currentTrack.durationMs)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-6 text-center space-y-1.5">
            <Music size={28} className="mx-auto text-zinc-700" />
            <p className="text-xs text-zinc-400 font-medium">Нічого не відтворюється</p>
            <p className="text-[11px] text-zinc-600">Увімкни будь-який трек у вебплеєрі NoirSound</p>
          </div>
        )}
      </div>

      {/* Integration Toggle */}
      <div className="flex items-center justify-between rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3.5">
        <div className="space-y-0.5">
          <span className="text-xs font-semibold text-zinc-200 block">
            Показувати активність у Discord
          </span>
          <span className="text-[11px] text-zinc-500 block">
            {!isDiscordAvailable
              ? 'Discord Desktop не знайдено'
              : settings.enabled
              ? 'Активно (Listening to NoirSound)'
              : 'Вимкнено користувачем'}
          </span>
        </div>
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={(e) => onTogglePresence(e.target.checked)}
          className="accent-rose-600 h-4 w-4 rounded cursor-pointer"
        />
      </div>

      {/* Quick Action Button */}
      <button
        type="button"
        onClick={() => onOpenBrowser(currentTrack?.shareUrl || 'https://noirsound.co')}
        className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-300 transition-colors"
      >
        <span>Відкрити NoirSound у браузері</span>
        <ExternalLink size={12} />
      </button>
    </div>
  );
}
