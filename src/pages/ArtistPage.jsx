import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PageMeta from '../components/meta/PageMeta';
import { useTranslation } from 'react-i18next';
import { Check, Users, Globe, Music, Edit } from 'lucide-react';
import { followArtist, unfollowArtist, getArtistById, getTracksByArtist } from '../api';
import { useUserStore } from '../store/userStore';
import { useToastStore } from '../store/toastStore';
import TrackListItem from '../components/tracks/TrackListItem';
import TrackCard from '../components/tracks/TrackCard';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import FallbackAvatar from '../components/ui/FallbackAvatar';
import { sortTracksNewest } from '../utils/presentation';
import { formatNumber } from '../utils/formatLocale';
import { getLocalizedGenre } from '../i18n/genreLabels';

export default function ArtistPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const user = useUserStore((state) => state.user);
  const setAuthModalOpen = useUserStore((state) => state.setAuthModalOpen);
  const addToast = useToastStore((state) => state.addToast);

  const [artist, setArtist] = useState(null);
  const [artistTracks, setArtistTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(null);
  // Must be declared before any early return below -- React requires the
  // exact same hooks in the exact same order on every render. Declaring
  // this after the loading/error/not-found guards meant the very first
  // render (while loading) never called it, but the next render (once data
  // loads) did, which crashes with "Rendered more hooks than during the
  // previous render" every time an artist page finishes loading.
  const [followActionPending, setFollowActionPending] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [a, t] = await Promise.all([
          getArtistById(id),
          getTracksByArtist(id)
        ]);
        setArtist(a);
        // Hydrate from the server's per-viewer flag instead of assuming
        // "not following" -- a signed-in user revisiting/refreshing an
        // artist they already follow must see "Following", not "Follow".
        setIsFollowing(Boolean(a.isFollowing));
        setFollowerCount(null);
        setArtistTracks(sortTracksNewest(t));
      } catch (err) {
        console.error('Failed to load artist data:', err);
        setError(err.status === 404 ? 'not-found' : (err.message || 'Failed to load artist profile.'));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="py-20 text-center space-y-4 animate-pulse">
        <div className="w-32 h-32 mx-auto bg-zinc-900 rounded-full"></div>
        <div className="h-8 w-48 bg-zinc-900 rounded-md mx-auto"></div>
        <div className="h-4 w-64 bg-zinc-900 rounded-md mx-auto"></div>
      </div>
    );
  }

  if (error === 'not-found') {
    return (
      <EmptyState
        iconName="Mic2"
        title={t('profile.artistNotFound')}
        description={t('profile.artistNotFoundDesc')}
        actionText={t('profile.returnToDiscover')}
        onAction={() => navigate('/discover')}
      />
    );
  }

  if (error) {
    return <div className="py-16"><ErrorState title={t('profile.artistUnavailable')} message={error} /></div>;
  }

  if (!artist) {
    return (
      <EmptyState
        iconName="Mic2"
        title={t('profile.artistNotFound')}
        description={t('profile.artistGoneDesc')}
        actionText={t('profile.returnToDiscover')}
        onAction={() => navigate('/discover')}
      />
    );
  }

  // Dynamic follower calculation based on active follow button state
  const followerDisplayCount = followerCount ?? artist.followers;

  const handleFollowClick = async () => {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    if (followActionPending) return;
    setFollowActionPending(true);
    try {
      if (isFollowing) {
        const result = await unfollowArtist(id);
        setIsFollowing(false);
        // Trust the backend's post-mutation count over a hand-computed
        // local delta -- it reflects the real row count, not an assumption.
        if (typeof result?.followerCount === 'number') setFollowerCount(result.followerCount);
        addToast(`Unfollowed ${artist.name}.`, 'success');
      } else {
        const result = await followArtist(id);
        setIsFollowing(true);
        if (typeof result?.followerCount === 'number') setFollowerCount(result.followerCount);
        addToast(`Following ${artist.name}.`, 'success');
      }
    } catch (err) {
      addToast(err.message || (isFollowing ? 'Failed to unfollow artist.' : 'Failed to follow artist.'), 'error');
    } finally {
      setFollowActionPending(false);
    }
  };

  const isOwnProfile = user && (user.artistProfileId === artist.id || user.username === artist.username);

  return (
    <div className="ns-page-stack pb-10">
      <PageMeta
        title={`${artist.name} — NoirSound`}
        description={artist.bio || `${artist.name} is an independent artist on NoirSound. Listen to releases and follow new music.`}
        canonical={`https://noirsound.co/artist/${artist.id}`}
      />

      {/* Hero / Header Box */}
      <section className="relative overflow-hidden rounded-lg border border-zinc-800/60 bg-zinc-950">
        <div 
          className="h-40 w-full opacity-70 transition-opacity duration-300 md:h-52"
          style={{ background: artist.bannerUrl || 'linear-gradient(135deg, var(--ns-accent-deep) 0%, var(--ns-bg) 100%)' }}
        />
        
        <div className="relative z-10 -mt-9 flex flex-col items-center gap-4 p-4 pt-0 text-center sm:p-5 sm:pt-0 md:-mt-12 md:flex-row md:items-end md:text-left">
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full border-2 border-zinc-950 bg-zinc-900 md:h-28 md:w-28">
            <FallbackAvatar
              src={artist.avatarUrl}
              name={artist.name}
              className="h-full w-full text-[112px]"
              imageClassName="object-cover"
            />
          </div>

          <div className="flex-1 space-y-2 min-w-0">
            <div className="flex items-center justify-center md:justify-start space-x-2">
              <h1 className="truncate font-display text-2xl font-semibold tracking-tight text-zinc-100 md:text-3xl">
                {artist.name}
              </h1>
              {artist.isVerified && (
                <span className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-[8px] text-white shrink-0" title="Verified Artist" aria-label="Verified artist">
                  <Check size={10} strokeWidth={4} />
                </span>
              )}
            </div>
            
            <div className="flex items-center justify-center md:justify-start gap-2">
              {artist.username && <p className="font-mono text-[11px] text-zinc-400">@{artist.username}</p>}
              <span className="rounded border border-brand-purple/20 bg-brand-purple/5 px-2 py-1 font-mono text-[9px] font-medium uppercase tracking-wider text-purple-300">
                {t('profile.independentArtist')}
              </span>
            </div>

            <div className="flex items-center justify-center space-x-4 pt-1 font-mono text-[9px] text-zinc-500 md:justify-start">
              <span className="flex items-center space-x-1">
                <Users size={14} className="text-zinc-500" />
                <span className="text-zinc-300 font-bold">{formatNumber(followerDisplayCount)}</span>
                <span className="text-zinc-500 font-medium">{t('profile.followers')}</span>
              </span>
              <span className="text-zinc-600 font-bold">•</span>
              <span className="text-zinc-300 font-bold">{formatNumber(artist.monthlyListeners || 0)}</span>
              <span className="text-zinc-500 font-medium">{t('profile.monthlyListeners')}</span>
            </div>
          </div>

          {isOwnProfile ? (
            <button
              onClick={() => navigate('/profile?tab=settings')}
              className="inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md border border-zinc-700/60 bg-zinc-800 px-5 text-[11px] font-semibold uppercase tracking-wider text-zinc-100 transition-colors hover:bg-zinc-700"
            >
              <Edit size={14} />
              <span>{t('profile.editArtistProfile')}</span>
            </button>
          ) : (
            <button
              onClick={handleFollowClick}
              disabled={followActionPending}
              aria-pressed={isFollowing}
              className={`min-h-11 shrink-0 cursor-pointer rounded-md px-5 text-[11px] font-semibold uppercase tracking-wider transition-colors disabled:cursor-wait disabled:opacity-60 ${
                isFollowing
                  ? 'bg-zinc-800 text-zinc-400 hover:text-zinc-100 border border-zinc-700/60'
                  : 'ns-button-primary'
              }`}
            >
              {followActionPending
                ? t('actions.saving', { defaultValue: 'Saving…' })
                : isFollowing ? t('actions.following') : t('actions.follow')}
            </button>
          )}
        </div>
      </section>

      {/* Split Columns: Tracks list vs About section */}
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(17rem,22rem)]">
        {/* Left 2 Columns: Top tracks & singles */}
        <div className="min-w-0 space-y-8">
          
          {/* Top tracks list */}
          <section className="space-y-4">
            <h2 className="ns-eyebrow px-1">{t('profile.topTracks')}</h2>
            <div className="space-y-1 rounded-lg border border-zinc-800/60 bg-zinc-950/35 p-2 sm:p-3">
              {artistTracks.length === 0 ? (
                <EmptyState
                  iconName="Music2"
                  title={t('empty.noReleasesYet')}
                  description={t('profile.artistNoTracksDesc')}
                />
              ) : (
                artistTracks.map((track, idx) => (
                  <TrackListItem
                    key={track.id}
                    track={track}
                    index={idx}
                    tracksContext={artistTracks}
                  />
                ))
              )}
            </div>
          </section>

          {/* Singles derived from this artist's published API tracks. */}
          <section className="space-y-4">
            <h2 className="ns-eyebrow px-1">{t('profile.singlesAndEps')}</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 2xl:grid-cols-4">
              {artistTracks.map((track) => (
                <TrackCard key={track.id} track={track} tracksContext={artistTracks} />
              ))}
            </div>
          </section>
        </div>

        {/* Right Column: About, Bio & Socials */}
        <div className="space-y-6">
          {/* Bio Box */}
          <section className="space-y-4 rounded-lg border border-zinc-800/60 bg-zinc-950/35 p-5">
            <h2 className="ns-eyebrow">{t('profile.about')}</h2>
            <p className="text-sm text-zinc-300 leading-relaxed">
              {artist.bio || t('profile.noBio')}
            </p>
            
            <div className="space-y-2 pt-2 border-t border-zinc-900">
              <span className="block text-[10px] text-zinc-500 uppercase tracking-wider font-bold">{t('profile.focusGenres')}</span>
              <div className="flex flex-wrap gap-1.5">
                {(artist.genres || []).length === 0 ? (
                  <span className="text-xs text-zinc-500">{t('profile.noGenresYet')}</span>
                ) : (artist.genres || []).map((g) => (
                  <span
                    key={g}
                    className="rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1 font-mono text-[9px] font-medium uppercase text-rose-300"
                  >
                    {getLocalizedGenre(g)}
                  </span>
                ))}
              </div>
            </div>
          </section>

          {/* Social Links Box */}
          <section className="space-y-3 rounded-lg border border-zinc-800/60 bg-zinc-950/35 p-5">
            <h2 className="ns-eyebrow">{t('profile.socialLinks')}</h2>
            
            <div className="space-y-1">
              {!artist.socialLinks?.instagram
                && !artist.socialLinks?.twitter
                && !artist.socialLinks?.soundcloud
                && !artist.username && (
                  <p className="text-xs text-zinc-500 py-2">{t('profile.noSocials')}</p>
                )}
              {artist.socialLinks?.instagram && (
                <a
                  href={`https://instagram.com/${artist.socialLinks.instagram}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center space-x-3 text-xs text-zinc-400 hover:text-zinc-200 py-2 transition-colors border-b border-zinc-900/40"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500 shrink-0">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                  </svg>
                  <span>Instagram</span>
                </a>
              )}
              {artist.socialLinks?.twitter && (
                <a
                  href={`https://twitter.com/${artist.socialLinks.twitter}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center space-x-3 text-xs text-zinc-400 hover:text-zinc-200 py-2 transition-colors border-b border-zinc-900/40"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500 shrink-0">
                    <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"></path>
                  </svg>
                  <span>Twitter</span>
                </a>
              )}
              {artist.socialLinks?.soundcloud && (
                <a
                  href={`https://soundcloud.com/${artist.socialLinks.soundcloud}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center space-x-3 text-xs text-zinc-400 hover:text-zinc-200 py-2 transition-colors border-b border-zinc-900/40"
                >
                  <Music size={14} className="text-zinc-500" />
                  <span>SoundCloud</span>
                </a>
              )}
              {artist.username && (
                <div className="flex items-center space-x-3 text-xs text-zinc-400 py-2 border-b border-transparent">
                  <Globe size={14} className="text-zinc-500" />
                  <span>noirsound.com/{artist.username}</span>
                </div>
              )}
            </div>
          </section>
        </div>

      </div>
    </div>
  );
}
