import { useEffect, useState } from 'react';
import { getLikedTracks, getTracks } from '../api';
import { isMockMode } from '../api/mode';
import { usePlayerStore } from '../store/playerStore';
import { useUserStore } from '../store/userStore';

// The library and its shortcuts refresh from the same saved collection after
// successful like changes. Older requests cannot restore a removed item.
export default function useLikedCollection(revision = 0) {
  const { user } = useUserStore();
  const { likedTracks } = usePlayerStore();
  const userId = user?.id;
  const demoMode = isMockMode();
  const likedKey = JSON.stringify(likedTracks || []);
  const [state, setState] = useState({ ownerId: null, tracks: [], loading: false, error: null });

  useEffect(() => {
    if (!userId) return;
    let active = true;
    setState((previous) => ({
      ownerId: userId,
      tracks: previous.ownerId === userId ? previous.tracks : [],
      loading: true,
      error: null,
    }));
    Promise.resolve().then(() => demoMode ? getTracks() : getLikedTracks())
      .then((tracks) => {
        if (!active) return;
        const ids = new Set(JSON.parse(likedKey));
        setState({
          ownerId: userId,
          tracks: demoMode ? tracks.filter((track) => ids.has(track.id)) : tracks,
          loading: false,
          error: null,
        });
      })
      .catch((error) => {
        if (active) setState({ ownerId: userId, tracks: [], loading: false, error: error.message });
      });
    return () => { active = false; };
  }, [demoMode, userId, likedKey, revision]);

  return userId && state.ownerId === userId
    ? state
    : { tracks: [], loading: Boolean(userId), error: null };
}
