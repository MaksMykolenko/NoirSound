import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, Heart, MoreHorizontal, Pause, Play } from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { useTrackContextMenu } from '../../hooks/useEntityContextMenu';
import FallbackCover from '../ui/FallbackCover';
import { formatDuration } from '../../utils/formatTime';
import { formatDate } from '../../utils/formatLocale';

// Desktop columns are "# | Title | Artist | Album / Release | Date added |
// Duration | Actions" -- sorting is exposed as one shared pill row
// (used identically on mobile, which has no table) rather than making the
// <th> cells independently clickable, so there is exactly one place that
// owns sort state instead of two interaction patterns for the same thing.
const SORT_OPTIONS = [
  { key: 'title', labelKey: 'playlists.sortByTitle' },
  { key: 'artist', labelKey: 'playlists.sortByArtist' },
  { key: 'album', labelKey: 'playlists.sortByAlbum' },
  { key: 'addedAt', labelKey: 'playlists.sortByDateAdded' },
  { key: 'duration', labelKey: 'playlists.sortByDuration' },
];

/**
 * Album/release fallback chain for display: real album (never linked --
 * there is no album page in this app) -> the release playlist a batch
 * upload generated (linked, since playlist pages are real) -> "Single".
 */
function albumCellInfo(track, t) {
  if (track.albumTitle) return { text: track.albumTitle, href: null };
  if (track.albumId) return { text: t('playlists.unknownAlbum'), href: null };
  if (track.releaseTitle) {
    return {
      text: track.releaseTitle,
      href: track.releasePlaylistId ? `/playlist/${track.releasePlaylistId}` : null,
    };
  }
  return { text: t('playlists.single'), href: null };
}

function sortTracks(tracks, sortKey, sortDir) {
  if (!sortKey) return tracks;
  const factor = sortDir === 'desc' ? -1 : 1;
  return tracks
    .map((track, index) => ({ track, index }))
    .sort((a, b) => {
      let result = 0;
      if (sortKey === 'title') {
        result = String(a.track.title || '').localeCompare(String(b.track.title || ''));
      } else if (sortKey === 'artist') {
        result = String(a.track.artistName || '').localeCompare(String(b.track.artistName || ''));
      } else if (sortKey === 'album') {
        const aText = a.track.albumTitle || a.track.releaseTitle || '';
        const bText = b.track.albumTitle || b.track.releaseTitle || '';
        result = aText.localeCompare(bText);
      } else if (sortKey === 'addedAt') {
        result = new Date(a.track.addedAt || 0).getTime() - new Date(b.track.addedAt || 0).getTime();
      } else if (sortKey === 'duration') {
        result = Number(a.track.durationSeconds ?? a.track.duration ?? 0)
          - Number(b.track.durationSeconds ?? b.track.duration ?? 0);
      }
      if (result === 0) return a.index - b.index;
      return result * factor;
    })
    .map((item) => item.track);
}

function useRowContext(track) {
  const player = usePlayerStore();
  const isCurrent = player.currentTrack?.id === track.id;
  const isAvailable = track.isAvailable !== false;
  const canPlay = isAvailable && (track.isStreamable ?? Boolean(track.audioUrl));
  const isLiked = player.likedTracks.includes(track.id);
  return { player, isCurrent, isPlayingThis: isCurrent && player.isPlaying, isAvailable, canPlay, isLiked };
}

function DesktopRow({
  track, index, queueTracks, source, owner, isCustomOrder, onRemoveTrack, onMoveTrack, pending, t,
}) {
  const navigate = useNavigate();
  const { player, isCurrent, isPlayingThis, isAvailable, canPlay, isLiked } = useRowContext(track);
  const busy = Boolean(pending);
  const contextMenuOptions = useMemo(() => ({
    removeFromPlaylist: owner && onRemoveTrack ? () => onRemoveTrack(track) : undefined,
    moveUp: owner && isCustomOrder && onMoveTrack
      ? { action: () => onMoveTrack(index, -1), disabled: index === 0 || busy }
      : undefined,
    moveDown: owner && isCustomOrder && onMoveTrack
      ? { action: () => onMoveTrack(index, 1), disabled: index === queueTracks.length - 1 || busy }
      : undefined,
  }), [owner, onRemoveTrack, track, isCustomOrder, onMoveTrack, index, busy, queueTracks.length]);

  const { contextMenuProps, openFromButton } = useTrackContextMenu(track, contextMenuOptions);

  const handlePlay = (event) => {
    event.stopPropagation();
    if (!canPlay) return;
    if (isCurrent) player.togglePlay();
    else player.playTrack(track, queueTracks.filter((item) => item.isAvailable !== false), source);
  };
  const handleOpenTrack = () => {
    if (!isAvailable) return;
    navigate(`/track/${track.id}`);
  };
  const albumInfo = albumCellInfo(track, t);
  const dateLabel = track.addedAt
    ? formatDate(track.addedAt, { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';

  return (
    <tr
      data-track-id={track.id}
      data-playlist-track-id={track.playlistTrackId}
      onContextMenu={contextMenuProps.onContextMenu}
      onKeyDown={contextMenuProps.onKeyDown}
      tabIndex={0}
      aria-current={isCurrent ? 'true' : undefined}
      className={`group border-b border-zinc-900/60 transition-colors focus:outline-none focus:ring-1 focus:ring-inset focus:ring-brand-red/40 ${
        isCurrent ? 'bg-brand-red/5' : 'hover:bg-zinc-900/40'
      } ${!isAvailable ? 'opacity-50' : ''}`}
    >
      <td className="w-10 py-2 text-center align-middle">
        {isAvailable ? (
          <span className="relative flex h-6 items-center justify-center">
            <span className={`font-mono text-[13px] text-zinc-500 ${canPlay ? 'group-hover:opacity-0' : ''}`}>
              {isCurrent && player.isPlaying ? (
                <span aria-hidden="true" className="flex h-3 items-end justify-center gap-[2px]">
                  <span className="h-full w-[2px] animate-bounce bg-brand-red" />
                  <span className="h-[75%] w-[2px] animate-bounce bg-brand-red" style={{ animationDelay: '0.15s' }} />
                  <span className="h-[50%] w-[2px] animate-bounce bg-brand-red" style={{ animationDelay: '0.3s' }} />
                </span>
              ) : index + 1}
            </span>
            {canPlay && (
              <button
                type="button"
                onClick={handlePlay}
                className="absolute inset-0 hidden items-center justify-center text-zinc-100 group-hover:flex"
                aria-label={isPlayingThis
                  ? t('playlists.pauseTrack', { title: track.title })
                  : t(isCurrent ? 'playlists.playTrack' : 'playlists.playFromHere', { title: track.title })}
              >
                {isPlayingThis ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
              </button>
            )}
          </span>
        ) : (
          <span aria-hidden="true" className="text-zinc-700">–</span>
        )}
      </td>
      <td className="min-w-0 py-2 pr-3">
        {isAvailable ? (
          <div
            role="link"
            tabIndex={0}
            aria-label={`Open ${track.title} by ${track.artistName}`}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                handleOpenTrack();
              }
            }}
            className="flex min-w-0 cursor-pointer items-center gap-3"
            onClick={handleOpenTrack}
            onContextMenu={contextMenuProps.onContextMenu}
          >
            <FallbackCover
              src={track.coverUrl}
              title={track.title}
              artistName={track.artistName}
              genre={track.genre}
              className="h-10 w-10 shrink-0 rounded border border-zinc-800/60"
              imageClassName="object-cover"
            />
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className={`truncate text-[13px] font-semibold ${isCurrent ? 'text-brand-red' : 'text-zinc-100'}`}>
                  {track.title}
                </span>
                {track.explicit && (
                  <span className="shrink-0 rounded border border-zinc-700 bg-zinc-800 px-1 text-[9px] font-bold uppercase tracking-wide text-zinc-400">E</span>
                )}
                {isCurrent && <span className="sr-only">{t('playlists.currentlyPlaying')}</span>}
              </div>
              <button
                type="button"
                onClick={(event) => { event.stopPropagation(); navigate(`/artist/${track.artistId}`); }}
                className="block truncate font-mono text-[10px] text-zinc-500 hover:text-zinc-300 hover:underline xl:hidden"
              >
                {track.artistName}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex min-w-0 items-center gap-3">
            <div aria-hidden="true" className="h-10 w-10 shrink-0 rounded-lg border border-zinc-800 bg-zinc-900" />
            <span className="truncate text-[13px] italic text-zinc-600">{t('playlists.trackUnavailable')}</span>
          </div>
        )}
      </td>
      <td className="hidden max-w-[18ch] py-2 pr-4 xl:table-cell">
        {isAvailable && (
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); navigate(`/artist/${track.artistId}`); }}
            className="block max-w-full truncate text-left text-[13px] text-zinc-400 hover:text-zinc-200 hover:underline"
          >
            {track.artistName}
          </button>
        )}
      </td>
      <td className="hidden max-w-[18ch] py-2 pr-4 xl:table-cell">
        {isAvailable && (
          albumInfo.href ? (
            <button
              type="button"
              onClick={(event) => { event.stopPropagation(); navigate(albumInfo.href); }}
              className="block max-w-full truncate text-left text-[13px] text-zinc-400 hover:text-zinc-200 hover:underline"
            >
              {albumInfo.text}
            </button>
          ) : (
            <span className="block max-w-full truncate text-[13px] text-zinc-500">{albumInfo.text}</span>
          )
        )}
      </td>
      <td className="hidden py-2 pr-3 sm:table-cell">
        {isAvailable && (
          <span className="font-mono text-[12.5px] text-zinc-500">{dateLabel}</span>
        )}
      </td>
      <td className="py-2 pr-2 text-right">
        {isAvailable && (
          <span className="font-mono text-[12.5px] text-zinc-500">
            {formatDuration(track.durationSeconds ?? track.duration)}
          </span>
        )}
      </td>
      <td className="py-2 pl-1">
        <div className="flex items-center justify-end gap-1">
          {owner && isCustomOrder && (
            <>
              <button
                type="button"
                disabled={index === 0 || busy}
                onClick={() => onMoveTrack(index, -1)}
                aria-label={t('playlists.moveTrackUp', { title: track.title })}
                className="ns-icon-button !hidden !min-h-8 !min-w-8 text-zinc-500 disabled:opacity-20 lg:!inline-flex"
              >
                <ArrowUp size={13} />
              </button>
              <button
                type="button"
                disabled={index === queueTracks.length - 1 || busy}
                onClick={() => onMoveTrack(index, 1)}
                aria-label={t('playlists.moveTrackDown', { title: track.title })}
                className="ns-icon-button !hidden !min-h-8 !min-w-8 text-zinc-500 disabled:opacity-20 lg:!inline-flex"
              >
                <ArrowDown size={13} />
              </button>
            </>
          )}
          {isAvailable && (
            <button
              type="button"
              onClick={(event) => { event.stopPropagation(); player.toggleLikeTrack(track.id); }}
              aria-pressed={isLiked}
              aria-label={`${isLiked ? t('trackPage.unlike') : t('trackPage.like')} ${track.title}`}
              className={`ns-icon-button !min-h-9 !min-w-9 ${isLiked ? 'text-brand-red' : 'text-zinc-500 hover:text-zinc-200'}`}
            >
              <Heart size={14} fill={isLiked ? 'currentColor' : 'none'} />
            </button>
          )}
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); openFromButton(event); }}
            aria-label={t('playlists.moreActionsFor', { title: track.title })}
            aria-haspopup="menu"
            className="ns-icon-button !min-h-9 !min-w-9 text-zinc-500 hover:text-zinc-200"
          >
            <MoreHorizontal size={15} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function MobileRow({
  track, index, queueTracks, source, owner, isCustomOrder, onRemoveTrack, onMoveTrack, pending, t,
}) {
  const navigate = useNavigate();
  const { player, isCurrent, isPlayingThis, isAvailable, canPlay, isLiked } = useRowContext(track);
  const busy = Boolean(pending);
  const contextMenuOptions = useMemo(() => ({
    removeFromPlaylist: owner && onRemoveTrack ? () => onRemoveTrack(track) : undefined,
    moveUp: owner && isCustomOrder && onMoveTrack
      ? { action: () => onMoveTrack(index, -1), disabled: index === 0 || busy }
      : undefined,
    moveDown: owner && isCustomOrder && onMoveTrack
      ? { action: () => onMoveTrack(index, 1), disabled: index === queueTracks.length - 1 || busy }
      : undefined,
  }), [owner, onRemoveTrack, track, isCustomOrder, onMoveTrack, index, busy, queueTracks.length]);

  const { contextMenuProps, openFromButton } = useTrackContextMenu(track, contextMenuOptions);
  const albumInfo = albumCellInfo(track, t);

  const handleTap = () => {
    if (!isAvailable) return;
    if (canPlay) {
      if (isCurrent) player.togglePlay();
      else player.playTrack(track, queueTracks.filter((item) => item.isAvailable !== false), source);
      return;
    }
    navigate(`/track/${track.id}`);
  };

  return (
    <div
      data-track-id={track.id}
      onContextMenu={contextMenuProps.onContextMenu}
      onKeyDown={(event) => {
        contextMenuProps.onKeyDown(event);
        if (event.defaultPrevented) return;
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); handleTap(); }
      }}
      onClick={handleTap}
      role={isAvailable ? 'button' : undefined}
      tabIndex={0}
      aria-current={isCurrent ? 'true' : undefined}
      className={`flex min-h-14 items-center gap-3 rounded-md border p-2 transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-brand-red/40 ${
        isCurrent ? 'border-brand-red/20 bg-brand-red/5' : 'border-transparent hover:bg-zinc-900/40'
      } ${!isAvailable ? 'opacity-50' : 'cursor-pointer'}`}
    >
      <div className="relative shrink-0">
        <FallbackCover
          src={track.coverUrl}
          title={track.title}
          artistName={track.artistName}
          genre={track.genre}
          className="h-11 w-11 rounded border border-zinc-800/60"
          imageClassName="object-cover"
        />
        {isCurrent && (
          <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50">
            {isPlayingThis ? <Pause size={14} className="text-brand-red" fill="currentColor" /> : <Play size={14} className="text-brand-red" fill="currentColor" />}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        {isAvailable ? (
          <>
            <p className={`truncate text-[13px] font-semibold ${isCurrent ? 'text-brand-red' : 'text-zinc-100'}`}>
              {track.title}
              {track.explicit && <span className="ml-1.5 rounded border border-zinc-700 bg-zinc-800 px-1 align-middle text-[9px] font-bold text-zinc-400">E</span>}
              {isCurrent && <span className="sr-only">{t('playlists.currentlyPlaying')}</span>}
            </p>
            <p className="truncate font-mono text-[10px] text-zinc-500">
              {track.artistName}
              <span className="text-zinc-600"> • </span>
              {albumInfo.text}
            </p>
          </>
        ) : (
          <p className="text-[13px] italic text-zinc-600">{t('playlists.trackUnavailable')}</p>
        )}
      </div>
      {isAvailable && (
        <button
          type="button"
          onClick={(event) => { event.stopPropagation(); player.toggleLikeTrack(track.id); }}
          aria-pressed={isLiked}
          aria-label={`${isLiked ? t('trackPage.unlike') : t('trackPage.like')} ${track.title}`}
          className={`ns-icon-button !min-h-10 !min-w-10 shrink-0 ${isLiked ? 'text-brand-red' : 'text-zinc-500'}`}
        >
          <Heart size={14} fill={isLiked ? 'currentColor' : 'none'} />
        </button>
      )}
      <button
        type="button"
        onClick={(event) => { event.stopPropagation(); openFromButton(event); }}
        aria-label={t('playlists.moreActionsFor', { title: track.title })}
        aria-haspopup="menu"
        className="ns-icon-button !min-h-10 !min-w-10 shrink-0 text-zinc-500"
      >
        <MoreHorizontal size={16} />
      </button>
    </div>
  );
}

export default function PlaylistTrackTable({
  tracks, playlist, owner, onRemoveTrack, onMoveTrack, pending,
}) {
  const { t } = useTranslation();
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const source = useMemo(
    () => ({ type: 'playlist', id: playlist.id, name: playlist.name }),
    [playlist.id, playlist.name]
  );
  const displayedTracks = useMemo(
    () => sortTracks(tracks, sortKey, sortDir),
    [tracks, sortKey, sortDir]
  );
  const isCustomOrder = sortKey === null;

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  if (!tracks || tracks.length === 0) return null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => { setSortKey(null); setSortDir('asc'); }}
            className={`min-h-8 rounded border px-2.5 py-1 font-mono text-[9px] font-medium uppercase tracking-wider transition-colors ${
              isCustomOrder ? 'border-brand-red/30 bg-brand-red/10 text-rose-300' : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {t('playlists.customOrder')}
          </button>
          {SORT_OPTIONS.map(({ key, labelKey }) => (
            <button
              key={key}
              type="button"
              onClick={() => handleSort(key)}
              className={`inline-flex min-h-8 items-center gap-1 rounded border px-2.5 py-1 font-mono text-[9px] font-medium uppercase tracking-wider transition-colors ${
                sortKey === key ? 'border-zinc-700 bg-zinc-800 text-zinc-100' : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {t(labelKey)}
              {sortKey === key && (sortDir === 'desc' ? <ArrowDown size={11} /> : <ArrowUp size={11} />)}
            </button>
          ))}
        </div>
        {!isCustomOrder && owner && (
          <p className="text-[11px] text-zinc-500">{t('playlists.reorderDisabledWhileSorted')}</p>
        )}
      </div>

      <table className="hidden w-full border-collapse md:table" role="table">
        <thead>
          <tr className="border-b border-zinc-800/60 font-mono text-[9px] uppercase tracking-wider text-zinc-500">
            <th scope="col" className="w-10 py-2 text-center font-bold">#</th>
            <th scope="col" className="py-2 text-left font-bold">{t('playlists.columnTitle')}</th>
            <th scope="col" className="hidden py-2 pr-4 text-left font-bold xl:table-cell">{t('playlists.columnArtist')}</th>
            <th scope="col" className="hidden py-2 pr-4 text-left font-bold xl:table-cell">{t('playlists.columnAlbum')}</th>
            <th scope="col" className="hidden py-2 text-left font-bold sm:table-cell">{t('playlists.columnDateAdded')}</th>
            <th scope="col" className="py-2 pr-2 text-right font-bold">{t('playlists.columnDuration')}</th>
            <th scope="col" className="py-2 font-bold">
              <span className="sr-only">{t('playlists.columnActions')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {displayedTracks.map((track, index) => (
            <DesktopRow
              key={track.playlistTrackId || track.id}
              track={track}
              index={index}
              queueTracks={displayedTracks}
              source={source}
              owner={owner}
              isCustomOrder={isCustomOrder}
              onRemoveTrack={onRemoveTrack}
              onMoveTrack={onMoveTrack}
              pending={pending}
              t={t}
            />
          ))}
        </tbody>
      </table>

      <div className="space-y-1 md:hidden">
        {displayedTracks.map((track, index) => (
          <MobileRow
            key={track.playlistTrackId || track.id}
            track={track}
            index={index}
            queueTracks={displayedTracks}
            source={source}
            owner={owner}
            isCustomOrder={isCustomOrder}
            onRemoveTrack={onRemoveTrack}
            onMoveTrack={onMoveTrack}
            pending={pending}
            t={t}
          />
        ))}
      </div>
    </div>
  );
}
