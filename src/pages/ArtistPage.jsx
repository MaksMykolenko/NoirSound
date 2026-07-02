import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PageMeta from '../components/meta/PageMeta';
import { useTranslation } from 'react-i18next';
import { Check, Play, Users, Globe, Music, Edit } from 'lucide-react';
import { followArtist, unfollowArtist, getArtistById, getTracksByArtist } from '../api';
import { useUserStore } from '../store/userStore';
import { useToastStore } from '../store/toastStore';
import TrackListItem from '../components/tracks/TrackListItem';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import FallbackAvatar from '../components/ui/FallbackAvatar';
import FallbackCover from '../components/ui/FallbackCover';
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
        title="Artist not found"
        description="This artist profile does not exist."
        actionText="Return to Discover"
        onAction={() => navigate('/discover')}
      />
    );
  }

  if (error) {
    return <div className="py-16"><ErrorState title="Artist profile unavailable" message={error} /></div>;
  }

  if (!artist) {
    return (
      <EmptyState
        iconName="Mic2"
        title="Artist not found"
        description="This creator has left the night studio."
        actionText="Return to Discover"
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
    <div className="ns-page-stack animate-fade-in pb-10">
      <PageMeta
        title={`${artist.name} — NoirSound`}
        description={artist.bio || `${artist.name} is an independent artist on NoirSound. Listen to releases and follow new music.`}
        canonical={`https://noirsound.co/artist/${artist.id}`}
      />

      {/* Hero / Header Box */}
      <section className="relative rounded-[1.75rem] overflow-hidden border border-zinc-800/70 bg-zinc-950 shadow-2xl">
        <div 
          className="h-44 md:h-52 w-full transition-all duration-500"
          style={{ background: artist.bannerUrl || 'linear-gradient(135deg, var(--ns-accent-deep) 0%, var(--ns-bg) 100%)' }}
        />
        
        <div className="p-4 sm:p-6 pt-0 flex flex-col md:flex-row items-center md:items-end gap-4 sm:gap-6 relative -mt-10 md:-mt-12 z-10 text-center md:text-left">
          <div className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-full overflow-hidden border-[4px] border-zinc-950 bg-zinc-900 shadow-xl shrink-0">
            <FallbackAvatar
              src={artist.avatarUrl}
              name={artist.name}
              className="w-full h-full text-[124px]"
              imageClassName="object-cover"
            />
          </div>

          <div className="flex-1 space-y-2 min-w-0">
            <div className="flex items-center justify-center md:justify-start space-x-2">
              <h1 className="text-2xl md:text-3xl font-black text-zinc-100 tracking-tight truncate">
                {artist.name}
              </h1>
              {artist.isVerified && (
                <span className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-[8px] text-white shrink-0" title="Verified Artist" aria-label="Verified artist">
                  <Check size={10} strokeWidth={4} />
                </span>
              )}
            </div>
            
            <div className="flex items-center justify-center md:justify-start gap-2">
              {artist.username && <p className="text-sm text-zinc-400 font-medium">@{artist.username}</p>}
              <span className="text-[10px] uppercase tracking-wider font-bold text-purple-300 border border-purple-400/20 bg-purple-500/10 rounded-full px-2 py-1">
                {t('profile.independentArtist')}
              </span>
            </div>

            <div className="flex items-center justify-center md:justify-start space-x-4 text-xs text-zinc-400 font-semibold pt-1">
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
              className="px-6 min-h-11 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer shrink-0 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700/60 inline-flex items-center justify-center gap-2"
            >
              <Edit size={14} />
              <span>{t('profile.editArtistProfile')}</span>
            </button>
          ) : (
            <button
              onClick={handleFollowClick}
              disabled={followActionPending}
              aria-pressed={isFollowing}
              className={`px-6 min-h-11 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer shrink-0 disabled:opacity-60 disabled:cursor-wait ${
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Columns: Top tracks & singles */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Top tracks list */}
          <section className="space-y-4">
            <h2 className="ns-eyebrow px-1">Top Tracks</h2>
            <div className="ns-card p-2 sm:p-4 space-y-2">
              {artistTracks.length === 0 ? (
                <EmptyState
                  iconName="Music2"
                  title="No releases yet"
                  description="This artist has not published a track on NoirSound yet."
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
            <h2 className="ns-eyebrow px-1">Singles & EPs</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {artistTracks.map((track) => (
                <div
                  key={track.id}
                  onClick={() => navigate(`/track/${track.id}`)}
                  className="p-3 ns-card ns-card-interactive cursor-pointer group text-center"
                >
                  <div className="relative aspect-square rounded-xl overflow-hidden mb-3 bg-zinc-900 shadow-md">
                    <FallbackCover
                      src={track.coverUrl}
                      title={track.title}
                      artistName={track.artistName}
                      genre={track.genre}
                      className="w-full h-full"
                      imageClassName="object-cover"
                    />
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      {(track.isStreamable ?? Boolean(track.audioUrl)) ? (
                        <Play size={16} fill="white" className="text-white translate-x-[1px]" />
                      ) : (
                        <span className="text-[9px] uppercase tracking-wider font-bold text-zinc-300">Audio unavailable</span>
                      )}
                    </div>
                  </div>
                  <h4 className="text-xs font-bold text-zinc-200 truncate group-hover:text-white">{track.title}</h4>
                  <p className="text-xs text-zinc-400 mt-1 font-mono">{track.releaseDate?.split('-')[0] || 'New'} • Single</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right Column: About, Bio & Socials */}
        <div className="space-y-6">
          {/* Bio Box */}
          <section className="p-5 sm:p-6 ns-card space-y-4">
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
                    className="text-[11px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-rose-300"
                  >
                    {getLocalizedGenre(g)}
                  </span>
                ))}
              </div>
            </div>
          </section>

          {/* Social Links Box */}
          <section className="p-5 sm:p-6 ns-card space-y-3">
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
