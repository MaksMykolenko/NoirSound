export function mapArtistResponse(backendArtist) {
  if (!backendArtist) return null;
  // Preserve already normalized responses.
  if (backendArtist.name && !backendArtist.user) {
    return {
      ...backendArtist,
      name: backendArtist.name?.trim() || backendArtist.username?.trim() || 'Unknown artist',
      username: backendArtist.username?.trim() || null,
      avatarUrl: backendArtist.avatarUrl || null,
      followers: Number(backendArtist.followers || 0),
      monthlyListeners: Number(backendArtist.monthlyListeners || 0),
    };
  }

  const user = backendArtist.user;
  const name =
    user?.displayName?.trim()
    || user?.username?.trim()
    || (user?.email ? user.email.split('@')[0] : '')
    || 'Unknown artist';
  const username = user?.username?.trim() || null;

  const FORBIDDEN_GENRES = new Set([
    'ADMIN', 'SYSTEM_ADMIN', 'LISTENER', 'ARTIST', 'USER', 'PLAYER',
    'ACTIVE', 'SUSPENDED', 'BANNED', 'DELETED', 'SYSTEM', 'ROLE'
  ]);

  const rawGenres = Array.isArray(backendArtist.genres) ? backendArtist.genres : [];
  const cleanGenres = rawGenres
    .map((g) => String(g || '').trim())
    .filter((g) => Boolean(g) && !FORBIDDEN_GENRES.has(g.toUpperCase()));

  return {
    id: backendArtist.id,
    name,
    username,
    handle: username ? `@${username}` : null,
    avatarUrl: user?.avatarUrl || null,
    bannerUrl: user?.bannerUrl || null,
    followers: backendArtist._count?.followers ?? backendArtist.followers?.length ?? 0,
    monthlyListeners: Number(backendArtist.monthlyListeners || 0),
    bio: user?.bio || '',
    genres: cleanGenres,
    isVerified: Boolean(backendArtist.isVerified),
    socialLinks: backendArtist.socialLinks || {},
    createdAt: backendArtist.createdAt || null,
  };
}
