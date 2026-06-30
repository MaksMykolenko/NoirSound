import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getAdminArtist, hideArtist, unhideArtist } from '../../api/admin';
import { useToastStore } from '../../store/toastStore';
import {
  AdminEmpty,
  AdminError,
  AdminLoading,
  AdminPageHeader,
  AdminPanel,
  ConfirmActionModal,
  StatusBadge,
} from '../../components/admin/AdminUI';
import { useAdminData } from '../../components/admin/adminUtils';

export default function AdminArtistDetail() {
  const { id } = useParams();
  const { t } = useTranslation();
  const addToast = useToastStore((state) => state.addToast);
  const [confirming, setConfirming] = useState(false);
  const { data, loading, error, reload } = useAdminData(() => getAdminArtist(id), [id]);

  if (loading) return <AdminLoading />;
  if (error) return <AdminError error={error} onRetry={reload} />;
  const artist = data?.artist;
  if (!artist) return <AdminEmpty text={t('admin.noArtistsFound')} />;

  async function confirm(reason) {
    try {
      await (artist.isHidden ? unhideArtist(id, reason) : hideArtist(id, reason));
      addToast(t('admin.actionCompleted'), 'success');
      reload();
    } catch (actionError) {
      addToast(t('admin.actionFailed'), 'error');
      throw actionError;
    }
  }

  return (
    <>
      <AdminPageHeader
        title={artist.user?.displayName}
        description={`@${artist.user?.username}`}
        actions={<Link to="/admin/artists" className="ns-button-secondary rounded-xl px-3 py-2 text-xs">{t('admin.backToArtists')}</Link>}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <AdminPanel className="p-4 lg:col-span-2">
          <h2 className="text-sm font-bold">{t('admin.artistProfile')}</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div><dt className="text-[10px] font-bold uppercase text-[var(--ns-text-muted)]">{t('admin.status')}</dt><dd className="mt-1"><StatusBadge status={artist.isHidden ? 'HIDDEN' : artist.user?.status} /></dd></div>
            <div><dt className="text-[10px] font-bold uppercase text-[var(--ns-text-muted)]">{t('admin.email')}</dt><dd className="mt-1 text-sm">{artist.user?.email}</dd></div>
            <div><dt className="text-[10px] font-bold uppercase text-[var(--ns-text-muted)]">{t('admin.followers')}</dt><dd className="mt-1 text-sm">{artist._count?.followers ?? 0}</dd></div>
            <div><dt className="text-[10px] font-bold uppercase text-[var(--ns-text-muted)]">{t('admin.genres')}</dt><dd className="mt-1 text-sm">{artist.genres?.join(', ') || '—'}</dd></div>
          </dl>
        </AdminPanel>
        <AdminPanel className="p-4">
          <h2 className="text-sm font-bold">{t('admin.actions')}</h2>
          <button type="button" onClick={() => setConfirming(true)} className={`mt-4 w-full rounded-lg px-3 py-2 text-xs font-bold ${artist.isHidden ? 'ns-button-secondary' : 'bg-[var(--ns-danger)] text-white'}`}>
            {artist.isHidden ? t('admin.unhide') : t('admin.hide')}
          </button>
          {!artist.isHidden && <Link to={`/artist/${artist.id}`} className="ns-button-secondary mt-2 block rounded-lg px-3 py-2 text-center text-xs">{t('admin.openPublicPage')}</Link>}
          <Link to={`/admin/users/${artist.user?.id}`} className="ns-button-secondary mt-2 block rounded-lg px-3 py-2 text-center text-xs">{t('admin.viewUser')}</Link>
        </AdminPanel>
      </div>
      <AdminPanel className="p-4">
        <h2 className="mb-3 text-sm font-bold">{t('admin.tracks')}</h2>
        {!artist.tracks?.length ? <AdminEmpty text={t('admin.noTracksFound')} /> : artist.tracks.map((track) => (
          <Link key={track.id} to={`/admin/tracks/${track.id}`} className="flex items-center justify-between border-t border-[var(--ns-border-subtle)] py-3 text-sm first:border-0">
            <span>{track.title}</span><StatusBadge status={track.status} />
          </Link>
        ))}
      </AdminPanel>
      <ConfirmActionModal open={confirming} onClose={() => setConfirming(false)} onConfirm={confirm} actionLabel={artist.isHidden ? t('admin.unhide') : t('admin.hide')} />
    </>
  );
}
