import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Clock,
  Edit3,
  Heart,
  ListPlus,
  LoaderCircle,
  Lock,
  MoreHorizontal,
  Pause,
  Play,
  Share2,
  Shuffle,
  Trash2,
} from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  deletePlaylist,
  removeTrackFromPlaylist,
  reorderPlaylistTracks,
  setPlaylistSaved,
  updatePlaylist,
} from '../api';
import { usePlaylist } from '../hooks/queries/usePlaylists';
import { usePlaylistContextMenu } from '../hooks/useEntityContextMenu';
import { usePlayerStore } from '../store/playerStore';
import { useToastStore } from '../store/toastStore';
import PlaylistTrackTable from '../components/playlists/PlaylistTrackTable';
import EditPlaylistModal from '../components/playlists/EditPlaylistModal';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import LoadingState from '../components/ui/LoadingState';
import FallbackCover from '../components/ui/FallbackCover';
import { dedupeById } from '../utils/presentation';
import { formatDurationLong } from '../utils/formatTime';
import PageMeta from '../components/meta/PageMeta';

function formatPlaylistDuration(seconds, t) {
  return formatDurationLong(seconds, t) || t('playlists.durationUnavailable');
}

function PlaylistCoverArt({ playlist, tracks }) {
  const coverTracks = !playlist.coverUrl
    ? tracks.filter((track) => track.coverUrl).slice(0, 4)
    : [];
  if (playlist.coverUrl || coverTracks.length < 2) {
    return (
      <FallbackCover
        src={playlist.coverUrl}
        title={playlist.name}
        artistName={playlist.creator}
        genre="Playlist"
        className="h-full w-full"
        imageClassName="object-cover"
      />
    );
  }
  // Frontend-only collage fallback (no server-side image generation): a
  // simple 2x2 grid built from up to the first four tracks that have a
  // cover, padded with the NoirSound gradient tile when there are fewer
  // than four. Only used once a playlist has at least two real covers to
  // arrange -- otherwise the single gradient FallbackCover above is used.
  const tiles = [0, 1, 2, 3].map((slot) => coverTracks[slot] || null);
  return (
    <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden" aria-hidden="true">
      {tiles.map((track, slot) => (
        track ? (
          <img key={track.id} src={track.coverUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div key={`empty-${slot}`} className="h-full w-full bg-gradient-to-br from-zinc-900 to-black" />
        )
      ))}
    </div>
  );
}

function DeletePlaylistDialog({ playlist, busy, onCancel, onConfirm, t }) {
  if (!playlist) return null;
  return (
    <div className="fixed inset-0 z-[260] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onMouseDown={busy ? undefined : onCancel}>
      <section role="alertdialog" aria-modal="true" aria-labelledby="delete-playlist-title" className="w-full max-w-sm rounded-3xl border border-rose-500/30 bg-zinc-950 p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-rose-500/10 text-rose-300">
          <Trash2 size={19} />
        </div>
        <h2 id="delete-playlist-title" className="text-xl font-bold text-zinc-100">{t('playlists.deleteQuestion', { name: playlist.name })}</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">{t('playlists.deleteWarning')}</p>
        <div className="mt-6 flex gap-3">
          <button type="button" onClick={onCancel} disabled={busy} className="ns-button-secondary min-h-11 flex-1">{t('playlists.cancel')}</button>
          <button type="button" onClick={onConfirm} disabled={busy} className="min-h-11 flex-1 rounded-xl bg-rose-600 px-4 text-sm font-bold text-white hover:bg-rose-500 disabled:opacity-50">
            {busy ? t('playlists.deleting') : t('playlists.delete')}
          </button>
        </div>
      </section>
    </div>
  );
}

function RemoveTrackDialog({ track, busy, onCancel, onConfirm, t }) {
  if (!track) return null;
  return (
    <div className="fixed inset-0 z-[260] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onMouseDown={busy ? undefined : onCancel}>
      <section role="alertdialog" aria-modal="true" aria-labelledby="remove-track-title" className="w-full max-w-sm rounded-3xl border border-rose-500/30 bg-zinc-950 p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-rose-500/10 text-rose-300">
          <Trash2 size={19} />
        </div>
        <h2 id="remove-track-title" className="text-xl font-bold text-zinc-100">{t('playlists.removeTrackConfirm', { title: track.title })}</h2>
        <div className="mt-6 flex gap-3">
          <button type="button" onClick={onCancel} disabled={busy} className="ns-button-secondary min-h-11 flex-1">{t('playlists.cancel')}</button>
          <button type="button" onClick={onConfirm} disabled={busy} className="min-h-11 flex-1 rounded-xl bg-rose-600 px-4 text-sm font-bold text-white hover:bg-rose-500 disabled:opacity-50">
            {t('playlists.removeTrack')}
          </button>
        </div>
      </section>
    </div>
  );
}

export default function PlaylistPage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: fetchedPlaylist, isLoading, error, refetch } = usePlaylist(id);
  const player = usePlayerStore();
  const addToast = useToastStore((state) => state.addToast);
  const [playlist, setPlaylist] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [isEditOpen, setEditOpen] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [removeCandidate, setRemoveCandidate] = useState(null);
  const [pending, setPending] = useState('');

  useEffect(() => {
    if (!fetchedPlaylist) return;
    setPlaylist(fetchedPlaylist);
    setTracks(dedupeById(fetchedPlaylist.tracks || []));
  }, [fetchedPlaylist]);

  useEffect(() => {
    if (!playlist || !location.state) return;
    if (location.state.openPlaylistEdit) setEditOpen(true);
    if (location.state.openPlaylistDelete) setDeleteCandidate(playlist);
    if (location.state.openPlaylistEdit || location.state.openPlaylistDelete) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate, playlist]);

  const owner = Boolean(playlist?.isOwner || playlist?.canEdit || playlist?.createdByCurrentUser);
  const contextOptions = useMemo(() => ({
    onToggleSaved: !owner ? () => handleToggleSaved() : undefined,
    onEdit: owner ? () => setEditOpen(true) : undefined,
    onDelete: owner ? () => setDeleteCandidate(playlist) : undefined,
    onToggleVisibility: owner ? () => handleToggleVisibility() : undefined,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [owner, playlist]);
  const { contextMenuProps, openFromButton } = usePlaylistContextMenu(playlist, contextOptions);

  if (isLoading && !playlist) return <LoadingState type="list" count={5} />;
  if (error && !playlist) {
    if (error.status === 404 || error.code === 'PLAYLIST_PRIVATE') {
      return (
        <EmptyState
          iconName="Lock"
          title={error.code === 'PLAYLIST_PRIVATE' ? t('playlists.private') : t('playlists.notFound')}
          description={error.code === 'PLAYLIST_PRIVATE'
            ? t('playlists.privateAccess')
            : t('playlists.notFoundHelp')}
          actionText={t('playlists.returnHome')}
          onAction={() => navigate('/')}
        />
      );
    }
    return <ErrorState title={t('playlists.unavailable')} message={error.message} />;
  }
  if (!playlist) return null;

  const playableTracks = tracks.filter((track) => track.isStreamable ?? Boolean(track.audioUrl));
  const totalDuration = tracks.reduce((total, track) => total + Number(track.duration || 0), 0);
  const isPlaylistPlaying = Boolean(
    player.isPlaying
    && player.currentTrack
    && tracks.some((track) => track.id === player.currentTrack.id)
    && player.queueSource?.type === 'playlist'
    && player.queueSource?.id === playlist.id
  );
  const source = { type: 'playlist', id: playlist.id, name: playlist.name };

  const handlePlay = () => {
    if (playableTracks.length === 0) return;
    if (isPlaylistPlaying) {
      player.togglePlay();
      return;
    }
    player.playTrack(playableTracks[0], playableTracks, source);
  };

  const handleShuffle = () => {
    if (playableTracks.length === 0) return;
    const shuffled = [...playableTracks].sort(() => Math.random() - 0.5);
    player.playTrack(shuffled[0], shuffled, source);
  };

  async function handleToggleSaved() {
    if (owner || pending === 'save') return;
    const nextSaved = !playlist.isSaved;
    setPending('save');
    try {
      await setPlaylistSaved(playlist.id, nextSaved);
      setPlaylist((current) => ({
        ...current,
        isSaved: nextSaved,
        likedByCurrentUser: nextSaved,
        likes: Math.max(0, Number(current.likes || 0) + (nextSaved ? 1 : -1)),
      }));
      window.dispatchEvent(new CustomEvent('noirsound:playlists-changed'));
      addToast(nextSaved ? 'Playlist saved to your library.' : 'Playlist removed from your library.', 'success');
    } finally {
      setPending('');
    }
  }

  async function handleToggleVisibility() {
    if (!owner || pending === 'visibility') return;
    setPending('visibility');
    try {
      const updated = await updatePlaylist(playlist.id, { isPublic: !playlist.isPublic });
      setPlaylist((current) => ({ ...current, ...updated, tracks: current.tracks }));
      window.dispatchEvent(new CustomEvent('noirsound:playlists-changed'));
      addToast(updated.isPublic ? 'Playlist is now public.' : 'Playlist is now private.', 'success');
    } finally {
      setPending('');
    }
  }

  const handleRemove = async (track) => {
    if (!owner || pending) return;
    const previous = tracks;
    const next = tracks.filter((item) => item.id !== track.id);
    setTracks(next);
    setPending(`remove:${track.id}`);
    try {
      await removeTrackFromPlaylist(playlist.id, track.id);
      setPlaylist((current) => ({ ...current, tracks: next, trackIds: next.map((item) => item.id), trackCount: next.length }));
      window.dispatchEvent(new CustomEvent('noirsound:playlists-changed'));
      addToast(`Removed “${track.title}”.`, 'success');
    } catch {
      setTracks(previous);
    } finally {
      setPending('');
    }
  };

  const requestRemoveTrack = (track) => {
    if (!owner || pending) return;
    setRemoveCandidate(track);
  };

  const confirmRemoveTrack = async () => {
    if (!removeCandidate) return;
    await handleRemove(removeCandidate);
    setRemoveCandidate(null);
  };

  const handleMove = async (index, direction) => {
    const nextIndex = index + direction;
    if (!owner || nextIndex < 0 || nextIndex >= tracks.length || pending) return;
    const previous = tracks;
    const next = [...tracks];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    setTracks(next);
    setPending(`reorder:${next[index].id}`);
    try {
      await reorderPlaylistTracks(playlist.id, next.map((track) => track.id));
      setPlaylist((current) => ({ ...current, tracks: next, trackIds: next.map((track) => track.id) }));
      window.dispatchEvent(new CustomEvent('noirsound:playlists-changed'));
    } catch {
      setTracks(previous);
    } finally {
      setPending('');
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: playlist.name, url });
        return;
      } catch (shareError) {
        if (shareError?.name === 'AbortError') return;
      }
    }
    await navigator.clipboard.writeText(url);
    addToast('Playlist link copied.', 'success');
  };

  const handleDelete = async () => {
    setPending('delete');
    try {
      await deletePlaylist(playlist.id);
      window.dispatchEvent(new CustomEvent('noirsound:playlists-changed'));
      addToast('Playlist deleted.', 'success');
      navigate('/library?tab=playlists', { replace: true });
    } finally {
      setPending('');
      setDeleteCandidate(null);
    }
  };

  return (
    <div className="ns-page-stack animate-fade-in pb-16">
      <PageMeta
        title={`${playlist.name} — Playlist by ${playlist.creator} | NoirSound`}
        description={`${tracks.length === 1 ? '1 track' : `${tracks.length} tracks`}${playlist.description ? ` · ${playlist.description}` : ` · Listen to ${playlist.name}, a playlist by ${playlist.creator} on NoirSound.`}`}
        canonical={`https://noirsound.co/playlist/${playlist.id}`}
      />
      <button onClick={() => navigate(-1)} className="min-h-11 px-2 flex items-center gap-2 text-zinc-400 hover:text-white text-xs font-bold uppercase tracking-wider">
        <ArrowLeft size={14} />
        <span>Back</span>
      </button>

      <section
        data-testid="playlist-hero"
        data-playlist-id={playlist.id}
        onContextMenu={contextMenuProps.onContextMenu}
        onKeyDown={contextMenuProps.onKeyDown}
        tabIndex={0}
        className="relative flex flex-col md:flex-row gap-6 md:gap-8 items-center md:items-end p-5 sm:p-6 md:p-8 ns-card ns-card-hero focus:outline-none focus:ring-1 focus:ring-brand-red/50"
      >
        <button type="button" onClick={openFromButton} className="absolute right-4 top-4 ns-icon-button !min-h-10 !min-w-10 text-zinc-400" aria-label={`More actions for ${playlist.name}`} aria-haspopup="menu">
          <MoreHorizontal size={18} />
        </button>
        <div className="w-48 h-48 md:w-56 md:h-56 rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900 shrink-0">
          <PlaylistCoverArt playlist={playlist} tracks={tracks} />
        </div>

        <div className="flex-1 space-y-4 text-center md:text-left min-w-0">
          <p className="ns-eyebrow">{t('playlists.typeLabel')}</p>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-brand-red/10 border border-brand-red/30 text-rose-300">
            {playlist.isPublic === false && <Lock size={11} />}
            {playlist.isPublic === false ? t('playlists.private') : t('playlists.public')}
          </span>
          <div>
            <h1 className="ns-page-title break-words">{playlist.name}</h1>
            <p className="text-sm text-zinc-400 mt-2">{playlist.description || t('playlists.noDescription')}</p>
          </div>
          <div className="flex flex-wrap justify-center md:justify-start items-center gap-3 text-xs text-zinc-400">
            {playlist.ownerArtistId ? (
              <button type="button" onClick={() => navigate(`/artist/${playlist.ownerArtistId}`)} className="hover:text-zinc-100 hover:underline">
                {t('playlists.by', { creator: playlist.creator })}
              </button>
            ) : <span>{t('playlists.by', { creator: playlist.creator })}</span>}
            <span>{t('playlists.tracksCount', { count: tracks.length })}</span>
            <span className="flex items-center gap-1"><Clock size={12} />{formatPlaylistDuration(totalDuration, t)}</span>
            <span>{t('playlists.saves', { count: Number(playlist.likes || 0) })}</span>
            {playlist.updatedAt && (
              <span>{t('playlists.updated', {
                date: new Date(playlist.updatedAt).toLocaleDateString(i18n.language),
              })}</span>
            )}
          </div>
          <div className="flex flex-wrap justify-center md:justify-start gap-2">
            <button onClick={handlePlay} disabled={playableTracks.length === 0} className="ns-button-primary px-5 inline-flex items-center gap-2 disabled:opacity-40">
              {isPlaylistPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
              {isPlaylistPlaying ? t('contextMenu.pause') : t('contextMenu.play')}
            </button>
            <button onClick={handleShuffle} disabled={playableTracks.length === 0} className="ns-button-secondary px-4 inline-flex items-center gap-2 disabled:opacity-40">
              <Shuffle size={15} /> {t('playlists.shuffle')}
            </button>
            <button onClick={() => player.addTracksToQueue(playableTracks)} disabled={playableTracks.length === 0} className="ns-button-secondary px-4 inline-flex items-center gap-2 disabled:opacity-40">
              <ListPlus size={15} /> {t('playlists.addToQueue')}
            </button>
            {!owner && (
              <button onClick={handleToggleSaved} disabled={pending === 'save'} className="ns-button-secondary px-4 inline-flex items-center gap-2">
                {pending === 'save' ? <LoaderCircle size={15} className="animate-spin" /> : <Heart size={15} fill={playlist.isSaved ? 'currentColor' : 'none'} />}
                {playlist.isSaved ? t('playlists.saved') : t('playlists.save')}
              </button>
            )}
            {owner && (
              <button onClick={() => setEditOpen(true)} className="ns-button-secondary px-4 inline-flex items-center gap-2">
                <Edit3 size={15} /> {t('playlists.edit')}
              </button>
            )}
            <button onClick={handleShare} disabled={playlist.isPublic === false} className="ns-icon-button !min-h-11 !min-w-11 disabled:opacity-30" aria-label={t('playlists.share')}>
              <Share2 size={16} />
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="ns-eyebrow">{t('playlists.tracks')}</h2>
          {owner && tracks.length > 1 && <p className="text-[11px] text-zinc-500">{t('playlists.reorderHelp')}</p>}
        </div>
        {tracks.length === 0 ? (
          <EmptyState iconName="Music2" title={t('playlists.empty')} description={owner ? t('playlists.emptyOwner') : t('playlists.emptyVisitor')} />
        ) : (
          <div className="ns-card p-2 sm:p-4">
            <PlaylistTrackTable
              tracks={tracks}
              playlist={playlist}
              owner={owner}
              onRemoveTrack={requestRemoveTrack}
              onMoveTrack={handleMove}
              pending={pending}
            />
          </div>
        )}
      </section>

      <EditPlaylistModal
        playlist={playlist}
        isOpen={isEditOpen}
        onClose={() => setEditOpen(false)}
        onSaved={(updated) => {
          setPlaylist((current) => ({ ...current, ...updated, tracks: current.tracks }));
          refetch();
          addToast('Playlist updated.', 'success');
        }}
      />
      <DeletePlaylistDialog playlist={deleteCandidate} busy={pending === 'delete'} onCancel={() => setDeleteCandidate(null)} onConfirm={handleDelete} t={t} />
      <RemoveTrackDialog
        track={removeCandidate}
        busy={Boolean(removeCandidate) && pending === `remove:${removeCandidate?.id}`}
        onCancel={() => setRemoveCandidate(null)}
        onConfirm={confirmRemoveTrack}
        t={t}
      />
    </div>
  );
}
