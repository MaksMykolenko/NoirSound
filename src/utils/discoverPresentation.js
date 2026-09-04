import { normalizeGenre } from '../constants/musicGenres';
import { isBeatTrack } from './trackContent';
import { dedupeById, sortTracksNewest } from './presentation';

function dateValue(value) {
  const timestamp = value ? new Date(value).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function trackPublicationValue(track) {
  return dateValue(track?.publishedAt || track?.releaseDate || track?.createdAt);
}

export function rankTrendingTracks(items = [], limit = 10) {
  return dedupeById(items)
    .filter((track) => (
      (track.status == null || track.status === 'PUBLISHED')
      && (track.isStreamable ?? Boolean(track.audioUrl))
    ))
    .sort((left, right) => {
      const playDifference = Number(right.plays || 0) - Number(left.plays || 0);
      if (playDifference !== 0) return playDifference;

      const likeDifference = Number(right.likes || 0) - Number(left.likes || 0);
      if (likeDifference !== 0) return likeDifference;

      const publicationDifference = trackPublicationValue(right) - trackPublicationValue(left);
      if (publicationDifference !== 0) return publicationDifference;
      return String(left.title || '').localeCompare(String(right.title || ''));
    })
    .slice(0, limit);
}

export function newestTracks(items = [], limit = 12) {
  return sortTracksNewest(items).slice(0, limit);
}

export function countTrackValues(items = [], valueForTrack) {
  const counts = new Map();
  for (const track of dedupeById(items)) {
    const rawValue = valueForTrack(track);
    const value = String(rawValue || '').trim();
    if (!value) continue;
    const lookup = value.toLocaleLowerCase();
    const current = counts.get(lookup);
    counts.set(lookup, {
      value: current?.value || value,
      count: Number(current?.count || 0) + 1,
    });
  }

  return Array.from(counts.values()).sort((left, right) => (
    right.count - left.count || left.value.localeCompare(right.value)
  ));
}

export function countGenres(items = []) {
  return countTrackValues(items, (track) => normalizeGenre(track.genre) || track.genre);
}

export function rankDiscoverCreators(artists = [], tracks = [], limit = 6) {
  const activityByArtist = new Map();
  for (const track of dedupeById(tracks)) {
    if (!track.artistId || (track.status != null && track.status !== 'PUBLISHED')) continue;
    const activity = activityByArtist.get(track.artistId) || {
      releaseCount: 0,
      plays: 0,
      latestPublication: 0,
    };
    activity.releaseCount += 1;
    activity.plays += Number(track.plays || 0);
    activity.latestPublication = Math.max(
      activity.latestPublication,
      trackPublicationValue(track),
    );
    activityByArtist.set(track.artistId, activity);
  }

  return dedupeById(artists)
    .filter((artist) => activityByArtist.has(artist.id))
    .sort((left, right) => {
      const leftActivity = activityByArtist.get(left.id);
      const rightActivity = activityByArtist.get(right.id);

      const recencyDifference = rightActivity.latestPublication - leftActivity.latestPublication;
      if (recencyDifference !== 0) return recencyDifference;

      const playDifference = rightActivity.plays - leftActivity.plays;
      if (playDifference !== 0) return playDifference;

      const listenerDifference = Number(right.monthlyListeners || 0)
        - Number(left.monthlyListeners || 0);
      if (listenerDifference !== 0) return listenerDifference;

      const followerDifference = Number(right.followers || 0) - Number(left.followers || 0);
      if (followerDifference !== 0) return followerDifference;

      return String(left.name || '').localeCompare(String(right.name || ''));
    })
    .slice(0, limit);
}

export function madeForYouTracks(items = [], {
  likedTrackIds = [],
  likedTracks = [],
  recentlyPlayed = [],
  limit = 6,
} = {}) {
  const tracks = dedupeById(items);
  const likedSignals = dedupeById(likedTracks);
  const likedIds = new Set([
    ...likedTrackIds,
    ...likedSignals.map((track) => track?.id).filter(Boolean),
  ]);
  const recentIds = new Set((recentlyPlayed || []).map((track) => track?.id).filter(Boolean));
  const signalTracks = dedupeById([
    ...likedSignals,
    ...tracks.filter((track) => likedIds.has(track.id)),
    ...(recentlyPlayed || []),
  ]);
  if (signalTracks.length === 0) return [];

  const genreWeights = new Map();
  const artistWeights = new Map();
  for (const track of signalTracks) {
    const genre = normalizeGenre(track?.genre) || String(track?.genre || '').trim().toLowerCase();
    if (genre) genreWeights.set(genre, Number(genreWeights.get(genre) || 0) + 1);
    if (track?.artistId) {
      artistWeights.set(track.artistId, Number(artistWeights.get(track.artistId) || 0) + 1);
    }
  }

  return tracks
    .filter((track) => !likedIds.has(track.id) && !recentIds.has(track.id))
    .map((track) => {
      const genre = normalizeGenre(track.genre) || String(track.genre || '').trim().toLowerCase();
      const score = Number(genreWeights.get(genre) || 0) * 3
        + Number(artistWeights.get(track.artistId) || 0) * 5;
      return { track, score };
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => (
      right.score - left.score
      || Number(right.track.plays || 0) - Number(left.track.plays || 0)
      || trackPublicationValue(right.track) - trackPublicationValue(left.track)
    ))
    .slice(0, limit)
    .map(({ track }) => track);
}

export function contentTracks(items = [], contentType = 'ALL') {
  if (contentType === 'MUSIC') return items.filter((track) => !isBeatTrack(track));
  if (contentType === 'BEAT') return items.filter(isBeatTrack);
  return items;
}
