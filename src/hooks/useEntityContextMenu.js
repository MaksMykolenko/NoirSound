import { useCallback, useContext } from 'react';
import { UNSAFE_NavigationContext } from 'react-router-dom';
import { usePlayerStore } from '../store/playerStore';
import { useToastStore } from '../store/toastStore';
import {
  buildArtistContextActions,
  buildPlaylistContextActions,
  buildTrackContextActions,
} from '../components/context-menu/contextMenuActions';
import { useContextMenuController } from '../components/context-menu/contextMenuController';
import useContextMenu from './useContextMenu';
import { useTranslation } from 'react-i18next';
import { getPlaylistById } from '../api/playlists';

function useSafeNavigate() {
  const navigationContext = useContext(UNSAFE_NavigationContext);
  return useCallback((to, options = {}) => {
    const navigator = navigationContext?.navigator;
    if (navigator) {
      if (options.replace) navigator.replace(to, options.state, options);
      else navigator.push(to, options.state, options);
      return;
    }
    if (typeof window === 'undefined') return;
    const method = options.replace ? 'replaceState' : 'pushState';
    window.history[method](options.state || null, '', to);
    window.dispatchEvent(new PopStateEvent('popstate', { state: options.state || null }));
  }, [navigationContext]);
}

export function useTrackContextMenu(track, options = {}) {
  const navigate = useSafeNavigate();
  const player = usePlayerStore();
  const addToast = useToastStore((state) => state.addToast);
  const { openAddToPlaylist, openReport } = useContextMenuController();
  const { t } = useTranslation();
  return useContextMenu(() => {
    const args={
    track,
    player,
    navigate,
    addToast,
    openAddToPlaylist,
    openReport,
    t,
    ...options,
    };
    const actions=buildTrackContextActions(args);
    if(!track?.previewExternalId || !options.resolveTrack)return actions;
    return actions.map(action=>!action.onSelect||action.id==='track-play'?action:{...action,onSelect:async()=>{
      try {
        const saved=await options.resolveTrack();
        const selected=buildTrackContextActions({...args,track:saved,player:usePlayerStore.getState()}).find(a=>a.id===action.id);
        await selected?.onSelect?.();
      }catch(error){addToast(error.message,'error');}
    }});
  }, [track, player, navigate, addToast, openAddToPlaylist, openReport, t, options.removeFromQueue, options.removeFromPlaylist, options.moveUp, options.moveDown,options.resolveTrack]);
}

export function usePlaylistContextMenu(playlist, options = {}) {
  const navigate = useSafeNavigate();
  const player = usePlayerStore();
  const addToast = useToastStore((state) => state.addToast);
  const { t } = useTranslation();
  const resolvePlaylistTracks = useCallback(async () => {
    if (playlist?.tracks?.length) return playlist.tracks;
    if (!playlist?.id) return [];
    const detail = await getPlaylistById(playlist.id);
    return detail?.tracks || [];
  }, [playlist]);
  return useContextMenu(() => buildPlaylistContextActions({
    playlist,
    player,
    navigate,
    addToast,
    t,
    resolvePlaylistTracks,
    ...options,
  }), [playlist, player, navigate, addToast, t, resolvePlaylistTracks, options.onToggleSaved, options.onEdit, options.onDelete, options.onToggleVisibility]);
}

export function useArtistContextMenu(artist, options = {}) {
  const navigate = useSafeNavigate();
  const addToast = useToastStore((state) => state.addToast);
  const { t } = useTranslation();
  return useContextMenu(() => buildArtistContextActions({
    artist,
    navigate,
    addToast,
    t,
    ...options,
  }), [artist, navigate, addToast, t, options.isFollowing, options.onToggleFollow]);
}
