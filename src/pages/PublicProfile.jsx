import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getPublicProfile } from '../api/user';
import { useUserStore } from '../store/userStore';
import UserProfileHeader from '../components/profile/UserProfileHeader';
import LoadingState from '../components/ui/LoadingState';
import PageMeta from '../components/meta/PageMeta';

export default function PublicProfile() {
  const { username = '' } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const viewer = useUserStore((state) => state.user);
  const profileQuery = useQuery({
    queryKey: ['user-profile', username],
    queryFn: () => getPublicProfile(username),
    enabled: Boolean(username),
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const profileId = profileQuery.data?.id;
  const refetchProfile = profileQuery.refetch;

  useEffect(() => {
    const handleProfileChanged = (event) => {
      const changed = event.detail;
      if (changed?.username === username || changed?.id === profileId) {
        refetchProfile();
      }
    };
    window.addEventListener('noirsound:user-profile-changed', handleProfileChanged);
    return () => window.removeEventListener('noirsound:user-profile-changed', handleProfileChanged);
  }, [profileId, refetchProfile, username]);

  const profile = profileQuery.data;
  const canonicalUsername = profile?.username || username;
  const canonicalUrl = `https://noirsound.co/profile/${encodeURIComponent(canonicalUsername)}`;
  const titleName = profile?.displayName || profile?.username || t('nav.profile');

  if (profileQuery.isPending) {
    return (
      <div className="pb-10" role="status" aria-label={t('profile.loadingPublicProfile')}>
        <PageMeta title={`${t('nav.profile')} · NoirSound`} canonical={canonicalUrl} />
        <span className="sr-only">{t('profile.loadingPublicProfile')}</span>
        <LoadingState type="list" count={2} />
      </div>
    );
  }

  if (profileQuery.isError) {
    const notFound = profileQuery.error?.status === 404;
    return (
      <div className="ns-state-panel ns-state-error mx-auto max-w-xl !p-6 text-center" role="alert">
        <PageMeta
          title={`${notFound ? t('profile.publicProfileNotFound') : t('profile.publicProfileUnavailable')} · NoirSound`}
          canonical={canonicalUrl}
        />
        <h1 className="text-xl font-semibold tracking-tight text-zinc-100">
          {notFound ? t('profile.publicProfileNotFound') : t('profile.publicProfileUnavailable')}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          {notFound ? t('profile.publicProfileNotFoundDesc') : t('profile.publicProfileUnavailableDesc')}
        </p>
        {!notFound && (
          <button
            type="button"
            onClick={() => profileQuery.refetch()}
            className="ns-button-secondary mt-5 px-5 text-sm"
          >
            {t('profile.tryAgain')}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="pb-10">
      <PageMeta
        title={`${titleName} · NoirSound`}
        description={profile.bio || t('profile.noBio')}
        canonical={canonicalUrl}
      />
      <UserProfileHeader
        user={profile}
        viewerUserId={viewer?.id}
        shareUrl={canonicalUrl}
        onEditClick={() => navigate('/profile?tab=settings')}
      />
    </div>
  );
}
