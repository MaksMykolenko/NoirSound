import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AtSign,
  Check,
  Edit,
  Globe2,
  MoreHorizontal,
  Music2,
  Pause,
  Play,
  Send,
  Radio,
} from 'lucide-react';
import PageMeta from '../components/meta/PageMeta';
import { followArtist, unfollowArtist, getArtistById, getTracksByArtist } from '../api';
import { useUserStore } from '../store/userStore';
import { useToastStore } from '../store/toastStore';
import { usePlayerStore } from '../store/playerStore';
import { useArtistContextMenu } from '../hooks/useEntityContextMenu';
import TrackListItem from '../components/tracks/TrackListItem';
import ArtistReleaseCard from '../components/artists/ArtistReleaseCard';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import FallbackAvatar from '../components/ui/FallbackAvatar';
import { sortTracksNewest } from '../utils/presentation';
import { formatNumber } from '../utils/formatLocale';
import { getLocalizedGenre } from '../i18n/genreLabels';

const POPULAR_TRACK_LIMIT = 5;

const SOCIAL_PLATFORMS = [
  { key: 'website', label: 'Website', Icon: Globe2 },
  { key: 'instagram', label: 'Instagram', Icon: AtSign, base: 'https://instagram.com/' },
  { key: 'youtube', label: 'YouTube', Icon: Play, base: 'https://youtube.com/@' },
  { key: 'tiktok', label: 'TikTok', Icon: Music2, base: 'https://tiktok.com/@' },
  { key: 'telegram', label: 'Telegram', Icon: Send, base: 'https://t.me/' },
  { key: 'soundcloud', label: 'SoundCloud', Icon: Radio, base: 'https://soundcloud.com/' },
  { key: 'twitter', label: 'X / Twitter', Icon: AtSign, base: 'https://x.com/' },
  { key: 'bandcamp', label: 'Bandcamp', Icon: Music2, subdomain: true },
  { key: 'github', label: 'GitHub', Icon: Globe2, base: 'https://github.com/' },
];

function socialUrl(platform, value) {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  if (/^https?:\/\//i.test(normalized)) return normalized;
  if (platform.key === 'website') return null;
  const handle = normalized.replace(/^@/, '').replace(/^\/+|\/+$/g, '');
  if (!handle) return null;
  if (platform.subdomain) return `https://${handle}.bandcamp.com`;
  return `${platform.base}${handle}`;
}

function ArtistPageSkeleton() {
  const { t } = useTranslation();
  return (
    <div className="ns-page-stack pb-10" aria-busy="true" aria-label={t('profile.loadingArtist')}>
      <section className="ns-artist-hero ns-artist-skeleton">
        <div className="ns-artist-skeleton__artwork" />
        <div className="min-w-0 space-y-4">
          <div className="h-3 w-36 rounded bg-zinc-900" />
          <div className="h-14 w-3/4 max-w-2xl rounded bg-zinc-900" />
          <div className="h-4 w-64 max-w-full rounded bg-zinc-900" />
          <div className="flex gap-2">
            <div className="h-11 w-32 rounded bg-zinc-900" />
            <div className="h-11 w-32 rounded bg-zinc-900" />
          </div>
        </div>
      </section>
      <section className="space-y-4">
        <div className="h-6 w-36 rounded bg-zinc-900" />
        <div className="space-y-1 border-y border-zinc-800/60 py-1">
          {[0, 1, 2, 3, 4].map((item) => <div key={item} className="h-14 rounded bg-zinc-900/60" />)}
        </div>
      </section>
      <section className="space-y-4">
        <div className="h-6 w-40 rounded bg-zinc-900" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {[0, 1, 2, 3, 4].map((item) => <div key={item} className="aspect-square rounded bg-zinc-900/70" />)}
        </div>
      </section>
    </div>
  );
}

export default function ArtistPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const user = useUserStore((state) => state.user);
  const setAuthModalOpen = useUserStore((state) => state.setAuthModalOpen);
  const addToast = useToastStore((state) => state.addToast);
  const player = usePlayerStore();

  const [artist, setArtist] = useState(null);
  const [artistTracks, setArtistTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(null);
  const [followActionPending, setFollowActionPending] = useState(false);
  const [showAllPopular, setShowAllPopular] = useState(false);
  const [bioExpanded, setBioExpanded] = useState(false);
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [artistResponse, tracksResponse] = await Promise.all([
          getArtistById(id),
          getTracksByArtist(id),
        ]);
        if (!active) return;
        setArtist(artistResponse);
        setIsFollowing(Boolean(artistResponse.isFollowing));
        setFollowerCount(null);
        setArtistTracks(sortTracksNewest(tracksResponse));
        setShowAllPopular(false);
        setBioExpanded(false);
      } catch (err) {
        if (!active) return;
        console.error('Failed to load artist data:', err);
        setError(err.status === 404 ? 'not-found' : (err.message || 'Failed to load artist profile.'));
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchData();
    return () => { active = false; };
  }, [id, requestVersion]);

  const isOwnProfile = Boolean(
    artist && user && (user.artistProfileId === artist.id || user.username === artist.username)
  );

  const handleFollowClick = async () => {
    if (!artist) return;
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

  const { contextMenuProps: artistContextMenuProps, openFromButton: openArtistActions } = useArtistContextMenu(
    artist,
    {
      isFollowing,
      onToggleFollow: artist && !isOwnProfile ? handleFollowClick : undefined,
    }
  );

  if (loading) return <ArtistPageSkeleton />;

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
    return (
      <div className="py-16">
        <ErrorState
          title={t('profile.artistUnavailable')}
          message={error}
          onRetry={() => setRequestVersion((value) => value + 1)}
        />
      </div>
    );
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

  const followerDisplayCount = followerCount ?? artist.followers;
  const popularTracks = [...artistTracks].sort((left, right) => Number(right.plays || 0) - Number(left.plays || 0));
  const playableTracks = popularTracks.filter((track) => track.isStreamable ?? Boolean(track.audioUrl));
  const artistQueueSource = { type: 'artist', id: artist.id, name: artist.name };
  const isArtistQueueCurrent = Boolean(
    player.currentTrack
    && playableTracks.some((track) => track.id === player.currentTrack.id)
    && player.queueSource?.type === 'artist'
    && player.queueSource?.id === artist.id
  );
  const isArtistPlaying = isArtistQueueCurrent && player.isPlaying;
  const visiblePopularTracks = showAllPopular ? popularTracks : popularTracks.slice(0, POPULAR_TRACK_LIMIT);
  const hasImageBanner = /^https?:\/\//i.test(artist.bannerUrl || '');
  const socialItems = SOCIAL_PLATFORMS.flatMap((platform) => {
    const href = socialUrl(platform, artist.socialLinks?.[platform.key]);
    return href ? [{ ...platform, href }] : [];
  });
  const hasLongBio = (artist.bio || '').length > 360;

  const handlePlayArtist = () => {
    if (playableTracks.length === 0) return;
    if (isArtistQueueCurrent) {
      player.togglePlay();
      return;
    }
    player.playTrack(playableTracks[0], playableTracks, artistQueueSource);
  };

  return (
    <div className="ns-page-stack pb-10">
      <PageMeta
        title={`${artist.name} — NoirSound`}
        description={artist.bio || `${artist.name} is an independent artist on NoirSound. Listen to releases and follow new music.`}
        canonical={`https://noirsound.co/artist/${artist.id}`}
      />

      <section
        className="ns-artist-hero"
        data-testid="artist-hero"
        aria-label={artist.name}
        onContextMenu={artistContextMenuProps.onContextMenu}
      >
        {hasImageBanner && (
          <div className="ns-artist-hero__backdrop" aria-hidden="true">
            <div style={{ backgroundImage: `url(${artist.bannerUrl})` }} />
            <span />
          </div>
        )}

        <div className="ns-artist-hero__artwork">
          <FallbackAvatar
            src={artist.avatarUrl}
            name={artist.name}
            className="h-full w-full text-[190px] sm:text-[220px]"
            imageClassName="object-cover"
          />
        </div>

        <div className="ns-artist-hero__content" data-long-title={artist.name.length > 28}>
          <div className="mb-3 flex items-center justify-center gap-2 md:justify-start">
            {artist.isVerified && (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-red text-[var(--ns-on-accent)]" aria-hidden="true">
                <Check size={11} strokeWidth={4} />
              </span>
            )}
            <p className="ns-eyebrow">
              {artist.isVerified ? t('profile.verifiedArtist') : t('profile.independentArtist')}
            </p>
          </div>

          <h1 className="ns-display-title ns-display-title--entity ns-artist-display-title">
            {artist.name}
          </h1>

          {artist.username && (
            <p className="mt-2 break-all font-sans tabular-nums text-ns-label text-zinc-400">
              @{artist.username}
            </p>
          )}

          <dl className="ns-artist-metrics" aria-label={t('profile.artistMetrics')}>
            <div>
              <dt className="sr-only">{t('profile.followers')}</dt>
              <dd><strong>{formatNumber(followerDisplayCount)}</strong> {t('profile.followers')}</dd>
            </div>
            <div>
              <dt className="sr-only">{t('profile.monthlyListeners')}</dt>
              <dd><strong>{formatNumber(artist.monthlyListeners || 0)}</strong> {t('profile.monthlyListeners')}</dd>
            </div>
          </dl>

          <div className="ns-action-row mt-5 justify-center md:justify-start">
            <button
              type="button"
              onClick={handlePlayArtist}
              disabled={playableTracks.length === 0}
              className="ns-button-primary ns-artist-primary-action inline-flex items-center justify-center gap-2 px-4 text-ns-label disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={isArtistPlaying ? t('contextMenu.pause') : t('contextMenu.play')}
            >
              {isArtistPlaying ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
              <span>{isArtistPlaying ? t('contextMenu.pause') : t('contextMenu.play')}</span>
            </button>

            {isOwnProfile ? (
              <button
                type="button"
                onClick={() => navigate('/profile?tab=settings')}
                className="ns-button-secondary inline-flex min-h-11 items-center justify-center gap-2 px-4 text-ns-label"
              >
                <Edit size={15} />
                <span>{t('profile.editArtistProfile')}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFollowClick}
                disabled={followActionPending}
                aria-pressed={isFollowing}
                className="ns-button-secondary ns-artist-follow-action px-3 text-ns-label disabled:cursor-wait disabled:opacity-60"
              >
                {followActionPending
                  ? t('actions.saving')
                  : isFollowing ? t('actions.following') : t('actions.follow')}
              </button>
            )}

            <button
              type="button"
              onClick={openArtistActions}
              onKeyDown={artistContextMenuProps.onKeyDown}
              className="ns-icon-button"
              aria-label={t('profile.moreArtistActions', { name: artist.name })}
              aria-haspopup="menu"
            >
              <MoreHorizontal size={18} />
            </button>
          </div>
        </div>
      </section>

      <section className="ns-page-section" data-testid="artist-popular" aria-labelledby="artist-popular-title">
        <div className="ns-section-header-row">
          <h2 id="artist-popular-title" className="ns-section-title">{t('profile.popular')}</h2>
          {popularTracks.length > POPULAR_TRACK_LIMIT && (
            <button
              type="button"
              onClick={() => setShowAllPopular((value) => !value)}
              className="min-h-10 text-ns-label font-medium text-brand-red hover:underline"
              aria-expanded={showAllPopular}
            >
              {showAllPopular ? t('profile.showPopularOnly') : t('profile.viewAll')}
            </button>
          )}
        </div>

        {popularTracks.length === 0 ? (
          <div className="ns-artist-empty-section">
            <Music2 size={20} aria-hidden="true" />
            <div>
              <h3>{t('empty.noReleasesYet')}</h3>
              <p>{t('profile.artistNoTracksDesc')}</p>
            </div>
          </div>
        ) : (
          <div className="ns-track-list">
            {visiblePopularTracks.map((track, index) => (
              <TrackListItem
                key={track.id}
                track={track}
                index={index}
                tracksContext={playableTracks}
                queueSource={artistQueueSource}
              />
            ))}
          </div>
        )}
      </section>

      <section className="ns-page-section" data-testid="artist-discography" aria-labelledby="artist-discography-title">
        <div className="ns-section-header-row">
          <h2 id="artist-discography-title" className="ns-section-title">{t('profile.discography')}</h2>
        </div>

        {artistTracks.length === 0 ? (
          <p className="text-ns-body-sm text-zinc-500">{t('profile.artistNoReleasesDesc')}</p>
        ) : (
          <div className="ns-artist-discography-grid">
            {artistTracks.map((track) => (
              <ArtistReleaseCard
                key={track.id}
                track={track}
                tracksContext={playableTracks}
                queueSource={artistQueueSource}
              />
            ))}
          </div>
        )}
      </section>

      <div className={`ns-artist-detail-grid ${socialItems.length === 0 ? 'ns-artist-detail-grid--single' : ''}`}>
        <section className="ns-artist-detail-panel" data-testid="artist-about" aria-labelledby="artist-about-title">
          <h2 id="artist-about-title" className="ns-section-title">{t('profile.about')}</h2>
          <div className={`mt-4 grid gap-5 ${artist.avatarUrl ? 'sm:grid-cols-[minmax(10rem,15rem)_minmax(0,1fr)]' : ''}`}>
            {artist.avatarUrl && (
              <div className="aspect-[4/3] overflow-hidden rounded-md bg-zinc-900">
                <FallbackAvatar
                  src={artist.avatarUrl}
                  name={artist.name}
                  className="h-full w-full text-[140px]"
                  imageClassName="object-cover"
                />
              </div>
            )}
            <div className="min-w-0">
              <p className={`text-ns-body leading-[var(--ns-line-body)] text-zinc-300 ${hasLongBio && !bioExpanded ? 'ns-artist-bio--collapsed' : ''}`}>
                {artist.bio || t('profile.noBio')}
              </p>
              {hasLongBio && (
                <button
                  type="button"
                  onClick={() => setBioExpanded((value) => !value)}
                  className="mt-3 min-h-10 text-ns-label font-semibold text-zinc-200 hover:text-brand-red"
                  aria-expanded={bioExpanded}
                >
                  {bioExpanded ? t('profile.readLess') : t('profile.readMore')}
                </button>
              )}
              {!artist.bio && isOwnProfile && (
                <button
                  type="button"
                  onClick={() => navigate('/profile?tab=settings')}
                  className="ns-button-secondary mt-4 px-4 text-ns-label"
                >
                  {t('profile.editBiography')}
                </button>
              )}
            </div>
          </div>

          {(artist.genres || []).length > 0 && (
            <div className="mt-5 border-t border-zinc-800/60 pt-4">
              <p className="ns-eyebrow">{t('profile.focusGenres')}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {artist.genres.map((genre) => (
                  <span key={genre} className="rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-ns-label font-medium text-rose-300">
                    {getLocalizedGenre(genre)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        {socialItems.length > 0 && (
          <section className="ns-artist-detail-panel" data-testid="artist-socials" aria-labelledby="artist-socials-title">
            <h2 id="artist-socials-title" className="ns-section-title">{t('profile.socialLinks')}</h2>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
              {socialItems.map(({ key, label, Icon, href }) => (
                <a
                  key={key}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex min-h-11 items-center gap-2 text-ns-body-sm font-medium text-zinc-400 transition-colors hover:text-brand-red"
                >
                  <Icon size={18} aria-hidden="true" />
                  <span>{label}</span>
                </a>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
