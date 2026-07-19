import React from 'react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import UserSettingsForm from '../../src/components/profile/UserSettingsForm';
import { MAX_PROFILE_BANNER_BYTES } from '../../src/components/profile/profileBannerValidation';
import i18n from '../../src/i18n';
import { useThemeStore } from '../../src/store/themeStore';
import { useToastStore } from '../../src/store/toastStore';
import { useUserStore } from '../../src/store/userStore';
import { DEFAULT_THEME } from '../../src/theme/themes';

const originalUserState = useUserStore.getState();
const originalToastState = useToastStore.getState();

describe('UserSettingsForm', () => {
  let updateUser;
  let addActivity;
  let addToast;
  let uploadBanner;
  let removeBanner;

  beforeEach(async () => {
    await i18n.changeLanguage('en');
    localStorage.clear();
    updateUser = vi.fn();
    addActivity = vi.fn();
    addToast = vi.fn();
    uploadBanner = vi.fn();
    removeBanner = vi.fn();
    Object.defineProperties(URL, {
      createObjectURL: {
        configurable: true,
        writable: true,
        value: vi.fn(() => 'blob:noirsound-profile-banner'),
      },
      revokeObjectURL: {
        configurable: true,
        writable: true,
        value: vi.fn(),
      },
    });
    useUserStore.setState({
      user: {
        id: 'listener-1',
        displayName: 'Night Listener',
        username: 'night_listener',
        bio: 'Original biography',
        location: 'Kyiv',
        bannerUrl: 'https://cdn.example/current-banner.jpg',
      },
      updateUser,
      uploadBanner,
      removeBanner,
      addActivity,
    });
    useToastStore.setState({ addToast });
    useThemeStore.setState({
      selectedTheme: DEFAULT_THEME,
      resolvedTheme: DEFAULT_THEME,
    });
  });

  afterEach(() => {
    cleanup();
    useUserStore.setState(originalUserState, true);
    useToastStore.setState(originalToastState, true);
    delete URL.createObjectURL;
    delete URL.revokeObjectURL;
  });

  it('preserves the profile update payload and exposes saving and saved states', async () => {
    const user = userEvent.setup();
    let resolveUpdate;
    updateUser.mockReturnValue(new Promise((resolve) => {
      resolveUpdate = resolve;
    }));
    render(<UserSettingsForm />);

    await user.clear(screen.getByLabelText(i18n.t('profile.displayName')));
    await user.type(screen.getByLabelText(i18n.t('profile.displayName')), 'New Name');
    await user.clear(screen.getByLabelText(i18n.t('profile.username')));
    await user.type(screen.getByLabelText(i18n.t('profile.username')), 'new_handle');
    await user.clear(screen.getByLabelText(i18n.t('profile.location')));
    await user.type(screen.getByLabelText(i18n.t('profile.location')), 'Warsaw');
    await user.clear(screen.getByLabelText(i18n.t('profile.biography')));
    await user.type(screen.getByLabelText(i18n.t('profile.biography')), 'New biography');

    const submit = screen.getByRole('button', { name: i18n.t('actions.saveChanges') });
    await user.click(submit);

    expect(updateUser).toHaveBeenCalledWith({
      displayName: 'New Name',
      username: 'new_handle',
      bio: 'New biography',
      location: 'Warsaw',
    });
    expect(submit).toBeDisabled();
    expect(submit).toHaveTextContent(i18n.t('profile.saving'));

    resolveUpdate();
    await waitFor(() => expect(submit).toHaveTextContent(i18n.t('profile.saved')));
    expect(submit).toBeDisabled();
    expect(addActivity).toHaveBeenCalledWith('settings', 'Updated profile configuration settings');
    expect(addToast).toHaveBeenCalledWith(i18n.t('profile.savedSuccess'), 'success');

    await user.click(screen.getByLabelText(i18n.t('profile.privateProfileAria')));
    expect(submit).toBeEnabled();
    expect(submit).toHaveTextContent(i18n.t('actions.saveChanges'));

    await user.type(screen.getByLabelText(i18n.t('profile.location')), ' Centre');
    expect(submit).toBeEnabled();
  });

  it('uses localized validation and checkbox accessible names', async () => {
    const user = userEvent.setup();
    await i18n.changeLanguage('uk');
    render(<UserSettingsForm />);

    expect(screen.getByLabelText(i18n.t('profile.privateProfileAria'))).toBeInTheDocument();
    expect(screen.getByLabelText(i18n.t('profile.emailNotificationsAria'))).toBeInTheDocument();

    const displayName = screen.getByLabelText(i18n.t('profile.displayName'));
    await user.clear(displayName);
    await user.click(screen.getByRole('button', { name: i18n.t('actions.saveChanges') }));

    expect(screen.getByText(i18n.t('profile.displayNameRequired'))).toBeInTheDocument();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('stages a valid banner and uploads it only through the existing Save action', async () => {
    const user = userEvent.setup();
    let resolveUpload;
    updateUser.mockResolvedValue(useUserStore.getState().user);
    uploadBanner.mockImplementation((_file, { onProgress }) => {
      onProgress(37);
      return new Promise((resolve) => {
        resolveUpload = resolve;
      });
    });
    render(<UserSettingsForm />);

    const banner = new File(['valid-png'], 'night-banner.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText('Choose a profile banner'), banner);

    expect(uploadBanner).not.toHaveBeenCalled();
    expect(screen.getByAltText('Profile banner preview')).toHaveAttribute(
      'src',
      'blob:noirsound-profile-banner'
    );

    await user.click(screen.getByRole('button', { name: i18n.t('actions.saveChanges') }));

    const progress = await screen.findByRole('progressbar', { name: 'Uploading banner' });
    expect(progress).toHaveAttribute('aria-valuenow', '37');
    expect(updateUser).toHaveBeenCalledBefore(uploadBanner);
    expect(uploadBanner).toHaveBeenCalledWith(banner, { onProgress: expect.any(Function) });

    resolveUpload({ ...useUserStore.getState().user, bannerUrl: 'https://cdn.example/new.jpg' });
    await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());
    expect(screen.getByRole('status')).toHaveTextContent('Profile banner updated.');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:noirsound-profile-banner');
  });

  it('rejects unsupported or oversized banner files before staging them', async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<UserSettingsForm />);
    const input = screen.getByLabelText('Choose a profile banner');

    await user.upload(input, new File(['svg'], 'banner.svg', { type: 'image/svg+xml' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a JPEG, PNG, or WebP image.');

    const oversized = new File(['large'], 'banner.webp', { type: 'image/webp' });
    Object.defineProperty(oversized, 'size', { value: MAX_PROFILE_BANNER_BYTES + 1 });
    await user.upload(input, oversized);
    expect(screen.getByRole('alert')).toHaveTextContent('no larger than 8 MB');
    expect(uploadBanner).not.toHaveBeenCalled();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('confirms banner removal accessibly and defers deletion until Save', async () => {
    const user = userEvent.setup();
    updateUser.mockResolvedValue(useUserStore.getState().user);
    removeBanner.mockImplementation(async () => {
      const nextUser = { ...useUserStore.getState().user, bannerUrl: null };
      useUserStore.setState({ user: nextUser });
      return nextUser;
    });
    render(<UserSettingsForm />);

    const removeTrigger = screen.getByRole('button', { name: 'Remove banner' });
    await user.click(removeTrigger);
    let dialog = screen.getByRole('alertdialog', { name: 'Remove profile banner?' });
    const cancel = within(dialog).getByRole('button', { name: 'Cancel' });
    await waitFor(() => expect(cancel).toHaveFocus());

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    await waitFor(() => expect(removeTrigger).toHaveFocus());

    await user.click(removeTrigger);
    dialog = screen.getByRole('alertdialog', { name: 'Remove profile banner?' });
    await user.click(within(dialog).getByRole('button', { name: 'Remove banner' }));

    expect(removeBanner).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('Save changes to apply it.');
    await user.click(screen.getByRole('button', { name: i18n.t('actions.saveChanges') }));
    await waitFor(() => expect(removeBanner).toHaveBeenCalledOnce());
    expect(screen.getByRole('status')).toHaveTextContent('Profile banner removed.');
  });

  it('returns focus to Upload after discarding a newly selected first banner', async () => {
    const user = userEvent.setup();
    useUserStore.setState({
      user: { ...useUserStore.getState().user, bannerUrl: null },
    });
    render(<UserSettingsForm />);

    await user.upload(
      screen.getByLabelText('Choose a profile banner'),
      new File(['valid'], 'first-banner.jpg', { type: 'image/jpeg' })
    );
    const removeTrigger = screen.getByRole('button', { name: 'Remove banner' });
    await user.click(removeTrigger);
    const dialog = screen.getByRole('alertdialog', { name: 'Remove profile banner?' });
    await user.click(within(dialog).getByRole('button', { name: 'Remove banner' }));

    expect(screen.queryByRole('button', { name: 'Undo removal' })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Upload banner' })).toHaveFocus());
  });

  it('preserves the selected banner and biography draft when upload fails', async () => {
    const user = userEvent.setup();
    updateUser.mockResolvedValue(useUserStore.getState().user);
    uploadBanner.mockRejectedValue(new Error('Banner upload failed.'));
    render(<UserSettingsForm />);

    const biography = screen.getByLabelText(i18n.t('profile.biography'));
    await user.clear(biography);
    await user.type(biography, 'Draft biography\nwith two lines');
    await user.upload(
      screen.getByLabelText('Choose a profile banner'),
      new File(['valid'], 'draft.jpg', { type: 'image/jpeg' })
    );
    await user.click(screen.getByRole('button', { name: i18n.t('actions.saveChanges') }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Banner upload failed.');
    expect(biography).toHaveValue('Draft biography\nwith two lines');
    expect(screen.getByAltText('Profile banner preview')).toHaveAttribute(
      'src',
      'blob:noirsound-profile-banner'
    );
    expect(screen.getByRole('button', { name: i18n.t('actions.saveChanges') })).toBeEnabled();
  });

  it('limits biography input to 500 characters and keeps the visual counter quiet', () => {
    render(<UserSettingsForm />);
    const biography = screen.getByLabelText(i18n.t('profile.biography'));
    expect(biography).toHaveAttribute('maxlength', '500');
    expect(biography).toHaveAccessibleDescription(/Up to 500 characters/);

    const counter = screen.getByText(`${useUserStore.getState().user.bio.length}/500`);
    expect(counter).toHaveAttribute('aria-hidden', 'true');
    expect(counter.closest('[aria-live]')).toBeNull();
  });

  it('keeps the settings route on the wide shell with tabs sticky inside the main scroller', () => {
    const profileSource = readFileSync(path.join(process.cwd(), 'src/pages/Profile.jsx'), 'utf8');

    expect(profileSource).toMatch(/data-testid="profile-tabs"[\s\S]*?sticky top-0[\s\S]*?scroll-mt-2/);
    expect(profileSource).toMatch(/data-testid="profile-settings-layout"[\s\S]*?xl:grid-cols-12/);
    expect(profileSource).toContain('ns-layout-page--form');
    expect(profileSource).toContain('2xl:col-span-9');
    expect(profileSource).toMatch(
      /Keep the settings form mounted[\s\S]*?activeTab === 'settings'[\s\S]*?'hidden'[\s\S]*?<UserSettingsForm \/>/
    );
  });
});
