import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserStore } from '../../store/userStore';
import { useToastStore } from '../../store/toastStore';
import { Bell, Check, Save, Shield } from 'lucide-react';
import LanguageSwitcher from '../ui/LanguageSwitcher';
import ThemeSelector from '../settings/ThemeSelector';
import { getApiErrorMessage } from '../../utils/apiErrorMessage';

export default function UserSettingsForm() {
  const { t } = useTranslation();
  const { user, updateUser, addActivity } = useUserStore();
  const { addToast } = useToastStore();

  // Local Form state initialized from Zustand
  const [displayName, setDisplayName] = useState(user.displayName);
  const [username, setUsername] = useState(user.username);
  const [bio, setBio] = useState(user.bio);
  const [location, setLocation] = useState(user.location);
  const [isPrivate, setIsPrivate] = useState(false);
  const [emailNotify, setEmailNotify] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const updateField = (setter) => (event) => {
    setter(event.target.value);
    setIsSaved(false);
  };

  const updateToggle = (setter) => (event) => {
    setter(event.target.checked);
    setIsSaved(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSaved(false);

    if (!displayName.trim()) {
      setErrorMsg(t('profile.displayNameRequired'));
      return;
    }
    if (!username.trim()) {
      setErrorMsg(t('profile.usernameRequired'));
      return;
    }

    setIsSubmitting(true);
    try {
      await updateUser({
        displayName: displayName.trim(),
        username: username.trim(),
        bio: bio ? bio.trim() : '',
        location: location ? location.trim() : '',
      });

      addActivity('settings', 'Updated profile configuration settings');
      addToast(t('profile.savedSuccess'), 'success');
      setIsSaved(true);
    } catch (err) {
      // Show a friendly, localized message (e.g. for CSRF_VALIDATION_FAILED)
      // instead of the raw backend error code.
      setErrorMsg(getApiErrorMessage(err, t));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {errorMsg && (
        <div className="flex items-center space-x-2.5 rounded-md border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-400">
          <span className="font-semibold">{errorMsg}</span>
        </div>
      )}

      <ThemeSelector className="border-b border-zinc-800/70 pb-5" />

      {/* Inputs grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-1.5">
          <label htmlFor="settings-display-name" className="font-sans tabular-nums text-ns-meta font-medium uppercase tracking-ns-label text-zinc-500">{t('profile.displayName')}</label>
          <input
            id="settings-display-name"
            type="text"
            value={displayName}
            onChange={updateField(setDisplayName)}
            className="ns-field px-4 text-base sm:text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="settings-username" className="font-sans tabular-nums text-ns-meta font-medium uppercase tracking-ns-label text-zinc-500">{t('profile.username')}</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">@</span>
            <input
              id="settings-username"
              type="text"
              value={username}
              onChange={updateField(setUsername)}
              className="ns-field pl-8 pr-4 text-base sm:text-sm"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="settings-location" className="font-sans tabular-nums text-ns-meta font-medium uppercase tracking-ns-label text-zinc-500">{t('profile.location')}</label>
          <input
            id="settings-location"
            type="text"
            value={location}
            onChange={updateField(setLocation)}
            className="ns-field px-4 text-base sm:text-sm"
          />
        </div>

      </div>

      {/* Bio text area */}
      <div className="space-y-1.5">
        <label htmlFor="settings-bio" className="font-sans tabular-nums text-ns-meta font-medium uppercase tracking-ns-label text-zinc-500">{t('profile.biography')}</label>
        <textarea
          id="settings-bio"
          rows={3}
          value={bio}
          onChange={updateField(setBio)}
          className="ns-field w-full px-4 py-3 text-base resize-none sm:text-sm"
        />
      </div>

      {/* Settings Options Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-zinc-900">
        
        {/* Profile Visibility */}
        <div className="flex items-start space-x-3.5 rounded-md border border-zinc-800/60 bg-zinc-950/40 p-3.5">
          <Shield size={18} className="text-brand-red shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <span className="block text-sm font-bold text-zinc-200">{t('profile.privateProfile')}</span>
            <span className="block text-ns-meta text-zinc-500 leading-normal">
              {t('profile.privateProfileDesc')}
            </span>
          </div>
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={updateToggle(setIsPrivate)}
            className="accent-brand-red w-4 h-4 rounded mt-0.5 cursor-pointer"
            aria-label={t('profile.privateProfileAria')}
          />
        </div>

        {/* Email Alerts */}
        <div className="flex items-start space-x-3.5 rounded-md border border-zinc-800/60 bg-zinc-950/40 p-3.5">
          <Bell size={18} className="text-brand-red shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <span className="block text-sm font-bold text-zinc-200">{t('profile.emailNotifications')}</span>
            <span className="block text-ns-meta text-zinc-500 leading-normal">
              {t('profile.emailNotificationsDesc')}
            </span>
          </div>
          <input
            type="checkbox"
            checked={emailNotify}
            onChange={updateToggle(setEmailNotify)}
            className="accent-brand-red w-4 h-4 rounded mt-0.5 cursor-pointer"
            aria-label={t('profile.emailNotificationsAria')}
          />
        </div>

      </div>

      {/* Language Preferences */}
      <div className="border-y border-zinc-800/60 py-4">
        <LanguageSwitcher />
      </div>

      {/* Compact footer action stays clear of the fixed player and mobile navigation. */}
      <div className="flex justify-end border-t border-zinc-800/60 pt-4">
        <button
          type="submit"
          disabled={isSubmitting || isSaved}
          aria-busy={isSubmitting}
          className="ns-button-primary flex w-full min-w-44 cursor-pointer items-center justify-center space-x-2.5 rounded-md px-5 py-3 text-sm font-semibold disabled:opacity-50 sm:w-auto"
        >
          {isSaved ? <Check size={14} aria-hidden="true" /> : <Save size={14} aria-hidden="true" />}
          <span aria-live="polite">
            {isSubmitting
              ? t('profile.saving')
              : isSaved
                ? t('profile.saved')
                : t('actions.saveChanges')}
          </span>
        </button>
      </div>
    </form>
  );
}
