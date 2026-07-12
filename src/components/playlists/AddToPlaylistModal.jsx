import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { ListMusic, LoaderCircle, Plus, Search, X } from 'lucide-react';
import { addTrackToPlaylist, createPlaylist, getMyPlaylists } from '../../api';
import { useToastStore } from '../../store/toastStore';
import useDialogFocusTrap from '../../hooks/useDialogFocusTrap';

export default function AddToPlaylistModal({ track, onClose }) {
  const { t } = useTranslation();
  const addToast = useToastStore((state) => state.addToast);
  const [playlists, setPlaylists] = useState([]);
  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState(null);
  const [error, setError] = useState('');
  const dialogRef = useDialogFocusTrap(Boolean(track) && !pendingId, onClose);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getMyPlaylists()
      .then((data) => {
        if (active) setPlaylists(data.filter((playlist) => playlist.isOwner || playlist.canEdit));
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || 'Playlists could not be loaded.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const addTrack = async (playlist) => {
    setError('');
    setPendingId(playlist.id);
    try {
      await addTrackToPlaylist(playlist.id, track.id);
      setPlaylists((current) => current.map((item) => (
        item.id === playlist.id
          ? { ...item, trackIds: [...(item.trackIds || []), track.id], trackCount: (item.trackCount || 0) + 1 }
          : item
      )));
      window.dispatchEvent(new CustomEvent('noirsound:playlists-changed'));
      addToast(`Added “${track.title}” to “${playlist.name}”.`, 'success');
    } catch (requestError) {
      if (requestError.code === 'PLAYLIST_TRACK_ALREADY_EXISTS') {
        setError('This track is already in that playlist.');
      } else {
        setError(requestError.message || 'Track could not be added.');
      }
    } finally {
      setPendingId(null);
    }
  };

  const createAndAdd = async (event) => {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setPendingId('new');
    setError('');
    try {
      const playlist = await createPlaylist({ name, description: '', isPublic: false });
      await addTrackToPlaylist(playlist.id, track.id);
      setPlaylists((current) => [{ ...playlist, trackIds: [track.id], trackCount: 1 }, ...current]);
      setNewName('');
      window.dispatchEvent(new CustomEvent('noirsound:playlists-changed'));
      addToast(`Created “${playlist.name}” and added the track.`, 'success');
    } catch (requestError) {
      setError(requestError.message || 'Playlist could not be created.');
    } finally {
      setPendingId(null);
    }
  };

  const query = search.trim().toLowerCase();
  const filtered = playlists.filter((playlist) => playlist.name.toLowerCase().includes(query));

  return createPortal(
    <div className="fixed inset-0 z-[var(--ns-z-dialog)] flex items-center justify-center bg-black/75 p-4" onMouseDown={onClose}>
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-to-playlist-title"
        className="w-full max-w-md overflow-hidden rounded-lg border border-zinc-700/70 bg-zinc-950 shadow-xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <div>
            <h2 id="add-to-playlist-title" className="text-lg font-semibold tracking-tight text-zinc-100">{t('playlists.addToPlaylist')}</h2>
            <p className="max-w-[32ch] truncate font-sans tabular-nums text-ns-meta text-zinc-500">{track.title}</p>
          </div>
          <button type="button" onClick={onClose} className="ns-icon-button !min-h-10 !min-w-10" aria-label="Close">
            <X size={17} />
          </button>
        </header>

        <div className="space-y-4 p-5">
          <label className="relative block">
            <span className="sr-only">{t('playlists.search')}</span>
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('playlists.search')} className="ns-field w-full pl-9 pr-3 text-base sm:text-sm" />
          </label>

          <form onSubmit={createAndAdd} className="flex gap-2">
            <label className="min-w-0 flex-1">
              <span className="sr-only">{t('playlists.new')}</span>
              <input value={newName} maxLength={120} onChange={(event) => setNewName(event.target.value)} placeholder={t('playlists.newPrivate')} className="ns-field w-full px-3 text-base sm:text-sm" />
            </label>
            <button type="submit" disabled={!newName.trim() || Boolean(pendingId)} className="ns-button-primary inline-flex min-h-11 items-center gap-2 px-4 text-sm disabled:opacity-50">
              {pendingId === 'new' ? <LoaderCircle size={14} className="animate-spin" /> : <Plus size={14} />}
              {t('playlists.create')}
            </button>
          </form>

          {error && <p role="alert" className="text-sm font-semibold text-rose-300">{error}</p>}
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {loading ? (
              <div className="flex min-h-24 items-center justify-center text-zinc-500">
                <LoaderCircle size={20} className="animate-spin" aria-label={t('playlists.loading')} />
              </div>
            ) : filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-zinc-500">{t('playlists.noEditable')}</p>
            ) : filtered.map((playlist) => {
              const alreadyAdded = (playlist.trackIds || []).includes(track.id);
              return (
                <button key={playlist.id} type="button" disabled={alreadyAdded || Boolean(pendingId)} onClick={() => addTrack(playlist)} className="flex min-h-12 w-full items-center gap-3 rounded-md border border-transparent px-3 text-left transition-colors hover:border-zinc-800 hover:bg-zinc-900 disabled:opacity-50">
                  <ListMusic size={17} className="text-brand-red shrink-0" />
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm text-zinc-200">{playlist.name}</strong>
                    <small className="block text-ns-meta text-zinc-500">{t('playlists.tracksCount', { count: playlist.trackCount || playlist.trackIds?.length || 0 })}</small>
                  </span>
                  <span className="text-ns-meta text-zinc-500">
                    {pendingId === playlist.id
                      ? t('playlists.adding')
                      : alreadyAdded
                        ? t('playlists.added')
                        : t('playlists.add')}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </div>,
    document.body
  );
}
