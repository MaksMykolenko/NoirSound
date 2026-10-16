import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import FallbackAvatar from '../ui/FallbackAvatar';
import { validateProfileBannerFile } from './profileBannerValidation';

export default function ProfileAvatarEditor({ user, pendingFile, onSelectFile, disabled }) {
  const { t } = useTranslation();
  const input = useRef(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!pendingFile) { setPreview(null); return undefined; }
    const url = URL.createObjectURL(pendingFile);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  return (
    <section className="flex flex-wrap items-center gap-4 border-b border-zinc-800/60 pb-5" aria-labelledby="profile-avatar-heading">
      <FallbackAvatar src={preview || user?.avatarUrl} name={t('profile.avatarPreview')} className="h-20 w-20 shrink-0 rounded-full object-cover" />
      <div className="flex-1 space-y-2">
        <h3 id="profile-avatar-heading" className="text-sm font-semibold">{t('profile.avatar')}</h3>
        <p id="profile-avatar-help" className="text-ns-meta text-zinc-500">{t('profile.avatarHelp')}</p>
        <input
          ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only"
          id="profile-avatar-file" aria-label={t('profile.chooseAvatar')} disabled={disabled}
          aria-describedby="profile-avatar-help" aria-invalid={Boolean(error)}
          aria-errormessage={error ? 'profile-avatar-error' : undefined}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            const validation = validateProfileBannerFile(file);
            setError(validation);
            if (!validation) onSelectFile(file);
          }}
        />
        <button type="button" className="ns-button-secondary min-h-11 px-4 text-sm" disabled={disabled} onClick={() => input.current?.click()}>
          {t(preview || user?.avatarUrl ? 'profile.replaceAvatar' : 'profile.uploadAvatar')}
        </button>
        {error && <p id="profile-avatar-error" role="alert" className="text-sm text-red-400">{t(error === 'type' ? 'profile.avatarInvalidType' : 'profile.avatarInvalidSize')}</p>}
      </div>
    </section>
  );
}
