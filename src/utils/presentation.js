export function dedupeById(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item?.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function dateValue(value) {
  const timestamp = value ? new Date(value).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function sortTracksNewest(items = []) {
  return dedupeById(items).sort((left, right) => {
    const dateDifference = dateValue(right.releaseDate || right.createdAt)
      - dateValue(left.releaseDate || left.createdAt);
    if (dateDifference !== 0) return dateDifference;
    return String(left.title || '').localeCompare(String(right.title || ''));
  });
}

export function selectFeaturedTracks(items = [], limit = 4) {
  return sortTracksNewest(items)
    .filter((track) =>
      (track.status == null || track.status === 'PUBLISHED')
      && (track.isStreamable ?? Boolean(track.audioUrl))
    )
    .sort((left, right) => {
      const dateDifference = dateValue(right.releaseDate || right.createdAt)
        - dateValue(left.releaseDate || left.createdAt);
      if (dateDifference !== 0) return dateDifference;

      const engagementDifference =
        (Number(right.plays || 0) + Number(right.likes || 0))
        - (Number(left.plays || 0) + Number(left.likes || 0));
      if (engagementDifference !== 0) return engagementDifference;
      return String(left.title || '').localeCompare(String(right.title || ''));
    })
    .slice(0, limit);
}

export function rankRecommendedArtists(artists = [], tracks = []) {
  const publishedArtistIds = new Set(
    dedupeById(tracks)
      .filter((track) => track.status == null || track.status === 'PUBLISHED')
      .map((track) => track.artistId)
      .filter(Boolean)
  );

  return dedupeById(artists).sort((left, right) => {
    const publishedDifference =
      Number(publishedArtistIds.has(right.id)) - Number(publishedArtistIds.has(left.id));
    if (publishedDifference !== 0) return publishedDifference;

    const followerDifference =
      Number(right.followers || 0) - Number(left.followers || 0);
    if (followerDifference !== 0) return followerDifference;

    return dateValue(right.createdAt) - dateValue(left.createdAt);
  });
}

export function deterministicVisual(input = '') {
  const normalized = String(input || 'noirsound').trim().toLowerCase();
  let hash = 2166136261;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const unsignedHash = hash >>> 0;

  return {
    key: unsignedHash.toString(36),
    x: 18 + (unsignedHash % 58),
    y: 16 + ((unsignedHash >>> 8) % 62),
  };
}

export function initialsFor(value, fallback = 'NS') {
  const parts = String(value || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}
