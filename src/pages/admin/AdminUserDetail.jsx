import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  banUser,
  ensureArtistProfile,
  getAdminUser,
  grantArtistAccess,
  hideArtist,
  revokeArtistAccess,
  revokeUserSessions,
  setUserRole,
  suspendUser,
  unbanUser,
  unhideArtist,
  unsuspendUser,
} from '../../api/admin';
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
import { formatAdminDate, useAdminData } from '../../components/admin/adminUtils';

// Checkbox options shown inside the confirm modal for a role change, derived
// from the current -> next role transition. Mirrors Phase 9 of the artist
// access brief: moving to ARTIST offers to auto-create a profile (checked by
// default); moving to ADMIN only offers it unchecked (opt-in); moving away
// from ARTIST offers to hide the existing profile (the admin is asked, not
// forced); sessions default to revoked except when promoting to ADMIN.
function roleChangeOptions(t, currentRole, nextRole) {
  if (!nextRole) return [];
  const opts = [];
  if (nextRole === 'ARTIST') {
    opts.push({
      key: 'createArtistProfile',
      label: t('admin.artistAccess.optionCreateProfileIfMissing'),
      defaultChecked: true,
    });
  } else if (nextRole === 'ADMIN') {
    opts.push({
      key: 'createArtistProfile',
      label: t('admin.artistAccess.optionAlsoCreateProfileForAdmin'),
      defaultChecked: false,
    });
  }
  if (currentRole === 'ARTIST' && nextRole !== 'ARTIST') {
    opts.push({
      key: 'hideArtistProfile',
      label: t('admin.artistAccess.optionHideProfileOnDemote'),
      defaultChecked: false,
    });
  }
  opts.push({
    key: 'revokeSessions',
    label: t('admin.artistAccess.optionRevokeSessions'),
    defaultChecked: nextRole !== 'ADMIN',
  });
  return opts;
}

export default function AdminUserDetail() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const addToast = useToastStore((state) => state.addToast);
  const { data, loading, error, reload } = useAdminData(() => getAdminUser(id), [id]);
  const [pendingAction, setPendingAction] = useState(null);
  const [role, setRole] = useState('');

  if (loading) return <AdminLoading />;
  if (error) return <AdminError error={error} onRetry={reload} />;
  const user = data?.user;
  if (!user) return <AdminEmpty text={t('admin.noUsersFound')} />;

  const actions = {
    suspend: (reason) => suspendUser(id, reason),
    unsuspend: (reason) => unsuspendUser(id, reason),
    ban: (reason) => banUser(id, reason),
    unban: (reason) => unbanUser(id, reason),
    revoke: (reason) => revokeUserSessions(id, reason),
    role: (reason, options) => setUserRole(id, role, reason, options),
    grantArtist: (reason, options) => grantArtistAccess(id, { reason, ...options }),
    revokeArtist: (reason, options) => revokeArtistAccess(id, { reason, ...options }),
    ensureProfile: (reason, options) => ensureArtistProfile(id, { reason, ...options }),
    hideProfile: (reason) => hideArtist(user.artistProfileId, reason),
    unhideProfile: (reason) => unhideArtist(user.artistProfileId, reason),
  };

  // The pre-existing danger-zone actions (suspend/ban/unsuspend/unban/revoke/
  // role) intentionally keep the modal's generic default title/actionLabel
  // ("Confirm action" / "Confirm") — that is the established contract other
  // tests and users already rely on. Only the new artist-access actions below
  // get specific labels, since several of them (grant/revoke/create/hide/
  // unhide) would otherwise be indistinguishable behind one generic button.
  const modalConfig = {
    suspend: {},
    ban: {},
    unsuspend: { danger: false },
    unban: { danger: false },
    revoke: {},
    role: {
      options: roleChangeOptions(t, user.role, role),
    },
    grantArtist: {
      title: t('admin.artistAccess.grant'),
      description: t('admin.artistAccess.grantDescription'),
      actionLabel: t('admin.artistAccess.grant'),
      danger: false,
      options: [
        { key: 'createProfile', label: t('admin.artistAccess.optionCreateProfile'), defaultChecked: true },
        { key: 'revokeSessions', label: t('admin.artistAccess.optionRevokeSessions'), defaultChecked: true },
      ],
    },
    revokeArtist: {
      title: t('admin.artistAccess.revoke'),
      description: t('admin.artistAccess.revokeDescription'),
      actionLabel: t('admin.artistAccess.revoke'),
      options: [
        { key: 'hideArtistProfile', label: t('admin.artistAccess.optionHideProfile'), defaultChecked: true },
        { key: 'revokeSessions', label: t('admin.artistAccess.optionRevokeSessions'), defaultChecked: true },
      ],
    },
    ensureProfile: {
      title: t('admin.artistAccess.createProfile'),
      actionLabel: t('admin.artistAccess.createProfile'),
      danger: false,
      options: [
        { key: 'revokeSessions', label: t('admin.artistAccess.optionRevokeSessions'), defaultChecked: false },
      ],
    },
    hideProfile: { title: t('admin.artistAccess.hideProfile'), actionLabel: t('admin.artistAccess.hideProfile') },
    unhideProfile: { title: t('admin.artistAccess.unhideProfile'), actionLabel: t('admin.artistAccess.unhideProfile'), danger: false },
  };
  const activeModal = pendingAction ? modalConfig[pendingAction] : null;

  async function confirm(reason, optionValues) {
    try {
      await actions[pendingAction](reason, optionValues);
      addToast(t('admin.actionCompleted'), 'success');
      reload();
    } catch (actionError) {
      addToast(t('admin.actionFailed'), 'error');
      throw actionError;
    }
  }

  const canGrant = !['BANNED', 'DELETED'].includes(user.status);
  const canOfferCreateProfile = ['ADMIN', 'ARTIST'].includes(user.role) && !user.hasArtistProfile;
  const canRevokeArtist = user.role === 'ARTIST' || user.canUploadTracks;

  return (
    <>
      <AdminPageHeader
        title={user.displayName}
        description={`@${user.username}`}
        actions={<Link to="/admin/users" className="ns-button-secondary rounded px-3 py-2 text-xs">{t('admin.backToUsers')}</Link>}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <AdminPanel className="p-4 lg:col-span-2">
          <h2 className="text-sm font-bold">{t('admin.accountInfo')}</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            {[
              [t('admin.email'), user.email],
              [t('admin.role'), <StatusBadge key="role" status={user.role} />],
              [t('admin.status'), <StatusBadge key="status" status={user.status} />],
              [t('admin.joined'), formatAdminDate(user.joinedAt, i18n.language)],
              [t('admin.updated'), formatAdminDate(user.updatedAt, i18n.language)],
              [t('admin.sessions'), user.sessions?.active ?? 0],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="font-mono text-[9px] font-medium uppercase tracking-wider text-[var(--ns-text-muted)]">{label}</dt>
                <dd className="mt-1 text-sm text-[var(--ns-text-secondary)]">{value}</dd>
              </div>
            ))}
          </dl>
        </AdminPanel>
        <AdminPanel className="p-4">
          <h2 className="text-sm font-bold">{t('admin.activitySummary')}</h2>
          <dl className="mt-4 space-y-3">
            {Object.entries(user.counts || {}).map(([key, value]) => (
              <div key={key} className="flex justify-between text-xs">
                <dt className="text-[var(--ns-text-muted)]">{t(`admin.${key}`, { defaultValue: key })}</dt>
                <dd className="font-bold">{value}</dd>
              </div>
            ))}
          </dl>
        </AdminPanel>
      </div>

      <AdminPanel className="p-4" data-testid="artist-access-panel">
        <h2 className="text-sm font-bold">{t('admin.artistAccess.title')}</h2>
        <p className="mt-1 text-xs text-[var(--ns-text-muted)]">{t('admin.artistAccess.description')}</p>
        <dl className="mt-4 grid gap-4 sm:grid-cols-3">
          {[
            [t('admin.artistAccess.hasProfile'), user.hasArtistProfile ? t('admin.yes') : t('admin.no')],
            [t('admin.artistAccess.profileId'), user.artistProfileId || '—'],
            [t('admin.artistAccess.profileHidden'), user.hasArtistProfile ? (user.artistProfileHidden ? t('admin.yes') : t('admin.no')) : '—'],
            [t('admin.artistAccess.canUpload'), (
              <span key="canUpload" className={`font-bold ${user.canUploadTracks ? 'text-emerald-400' : 'text-amber-400'}`}>
                {user.canUploadTracks ? t('admin.yes') : t('admin.no')}
              </span>
            )],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="font-mono text-[9px] font-medium uppercase tracking-wider text-[var(--ns-text-muted)]">{label}</dt>
              <dd className="mt-1 break-all text-sm text-[var(--ns-text-secondary)]">{value}</dd>
            </div>
          ))}
        </dl>
        {!user.canUploadTracks && user.uploadAccessReason && (
          <p className="mt-4 rounded border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            {t(`admin.artistAccess.reasons.${user.uploadAccessReason}`, { defaultValue: user.uploadAccessReason })}
          </p>
        )}
        {user.artistProfileId && (
          <Link
            to={`/admin/artists/${user.artistProfileId}`}
            className="mt-3 inline-block text-xs font-semibold text-[var(--ns-accent-text)] underline underline-offset-2"
          >
            {t('admin.artistAccess.viewFullProfile')}
          </Link>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!canGrant}
            onClick={() => setPendingAction('grantArtist')}
            className="ns-button-primary rounded px-3 py-2 text-xs disabled:opacity-40"
          >
            {t('admin.artistAccess.grant')}
          </button>
          {canOfferCreateProfile && (
            <button type="button" onClick={() => setPendingAction('ensureProfile')} className="ns-button-secondary rounded px-3 py-2 text-xs">
              {t('admin.artistAccess.createProfile')}
            </button>
          )}
          {canRevokeArtist && (
            <button type="button" onClick={() => setPendingAction('revokeArtist')} className="ns-button-secondary rounded px-3 py-2 text-xs">
              {t('admin.artistAccess.revoke')}
            </button>
          )}
          {user.hasArtistProfile && !user.artistProfileHidden && (
            <button type="button" onClick={() => setPendingAction('hideProfile')} className="ns-button-secondary rounded px-3 py-2 text-xs">
              {t('admin.artistAccess.hideProfile')}
            </button>
          )}
          {user.hasArtistProfile && user.artistProfileHidden && (
            <button type="button" onClick={() => setPendingAction('unhideProfile')} className="ns-button-secondary rounded px-3 py-2 text-xs">
              {t('admin.artistAccess.unhideProfile')}
            </button>
          )}
          <button type="button" onClick={() => setPendingAction('revoke')} className="ns-button-secondary rounded px-3 py-2 text-xs">
            {t('admin.revokeSessions')}
          </button>
        </div>
      </AdminPanel>

      <AdminPanel className="p-4">
        <h2 className="mb-3 text-sm font-bold">{t('admin.tracks')}</h2>
        {!user.artistProfile?.tracks?.length ? <AdminEmpty text={t('admin.noTracksFound')} /> : (
          <div className="space-y-2">
            {user.artistProfile.tracks.map((track) => (
              <Link key={track.id} to={`/admin/tracks/${track.id}`} className="flex items-center justify-between rounded border border-[var(--ns-border-subtle)] bg-black/10 p-3 text-sm hover:bg-white/[0.03]">
                <span>{track.title}</span><StatusBadge status={track.status} />
              </Link>
            ))}
          </div>
        )}
      </AdminPanel>
      <AdminPanel className="border-[color-mix(in_srgb,var(--ns-danger)_35%,transparent)] p-4">
        <h2 className="text-sm font-bold text-[var(--ns-danger)]">{t('admin.dangerZone')}</h2>
        <p className="mt-1 text-xs text-[var(--ns-text-muted)]">{t('admin.dangerZoneDescription')}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {user.status === 'ACTIVE' && (
            <>
              <button type="button" onClick={() => setPendingAction('suspend')} className="ns-button-secondary rounded px-3 py-2 text-xs">{t('admin.suspend')}</button>
              <button type="button" onClick={() => setPendingAction('ban')} className="rounded bg-[var(--ns-danger)] px-3 py-2 text-xs font-semibold text-white">{t('admin.ban')}</button>
            </>
          )}
          {user.status === 'SUSPENDED' && <button type="button" onClick={() => setPendingAction('unsuspend')} className="ns-button-secondary rounded px-3 py-2 text-xs">{t('admin.unsuspend')}</button>}
          {user.status === 'BANNED' && <button type="button" onClick={() => setPendingAction('unban')} className="ns-button-secondary rounded px-3 py-2 text-xs">{t('admin.unban')}</button>}
          <button type="button" onClick={() => setPendingAction('revoke')} className="ns-button-secondary rounded px-3 py-2 text-xs">{t('admin.revokeSessions')}</button>
          <select value={role} onChange={(event) => setRole(event.target.value)} className="ns-field rounded px-3 py-2 text-xs">
            <option value="">{t('admin.selectRole')}</option>
            {['LISTENER', 'ARTIST', 'ADMIN'].map((value) => <option key={value} value={value}>{t(`admin.statusValues.${value}`)}</option>)}
          </select>
          <button type="button" disabled={!role || role === user.role} onClick={() => setPendingAction('role')} className="ns-button-secondary rounded px-3 py-2 text-xs disabled:opacity-40">
            {t('admin.setRole')}
          </button>
        </div>
      </AdminPanel>
      <AdminPanel className="p-4">
        <h2 className="mb-3 text-sm font-bold">{t('admin.auditHistory')}</h2>
        {!data.audit?.length ? <AdminEmpty text={t('admin.noAuditEntries')} /> : data.audit.map((entry) => (
          <div key={entry.id} className="flex flex-wrap items-center gap-2 border-t border-[var(--ns-border-subtle)] py-3 text-xs first:border-0">
            <StatusBadge status={entry.action} />
            <span className="text-[var(--ns-text-muted)]">{entry.actor?.username}</span>
            <span className="ml-auto text-[var(--ns-text-muted)]">{formatAdminDate(entry.createdAt, i18n.language)}</span>
          </div>
        ))}
      </AdminPanel>
      <ConfirmActionModal
        open={Boolean(pendingAction)}
        onClose={() => setPendingAction(null)}
        onConfirm={confirm}
        title={activeModal?.title || t('admin.confirmAction')}
        description={activeModal?.description}
        actionLabel={activeModal?.actionLabel || t('admin.confirm')}
        danger={activeModal?.danger !== false}
        options={activeModal?.options || []}
      />
    </>
  );
}
