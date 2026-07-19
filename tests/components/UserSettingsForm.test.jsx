import React from 'react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import UserSettingsForm from '../../src/components/profile/UserSettingsForm';
import UserProfileHeader from '../../src/components/profile/UserProfileHeader';
import { MAX_PROFILE_BANNER_BYTES } from '../../src/components/profile/profileBannerValidation';
import i18n from '../../src/i18n';
import { useThemeStore } from '../../src/store/themeStore';
import { useToastStore } from '../../src/store/toastStore';
import { useUserStore } from '../../src/store/userStore';
import { DEFAULT_THEME } from '../../src/theme/themes';

const originalUserState = useUserStore.getState();
const originalToastState = useToastStore.getState();

function BannerLifecycleHarness() {
  const user = useUserStore((state) => state.user);
  return (
    <>
      <UserProfileHeader user={user} viewerUserId={user.id} />
      <UserSettingsForm />
    </>
  );
}

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

  it('publishes an activated banner to the profile hero immediately and keeps it after remount', async () => {
    const user = userEvent.setup();
    const initialUser = { ...useUserStore.getState().user, bannerUrl: null };
    const activatedBannerUrl = '/api/public/profile-banners/listener-1/activated-banner.jpg';
    useUserStore.setState({ user: initialUser });
    updateUser.mockResolvedValue(initialUser);
    uploadBanner.mockImplementation(async (file, { onProgress }) => {
      expect(file).toMatchObject({ name: 'activated-banner.jpg', type: 'image/jpeg' });
      onProgress(100);
      const activatedUser = { ...initialUser, bannerUrl: activatedBannerUrl };
      useUserStore.setState({ user: activatedUser });
      return activatedUser;
    });

    const mounted = render(<BannerLifecycleHarness />);
    expect(screen.getByTestId('profile-banner-fallback')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload banner' })).toBeInTheDocument();

    await user.upload(
      screen.getByLabelText('Choose a profile banner'),
      new File(['valid-jpeg'], 'activated-banner.jpg', { type: 'image/jpeg' })
    );
    expect(screen.getByAltText('Profile banner preview')).toHaveAttribute(
      'src',
      'blob:noirsound-profile-banner'
    );
    expect(screen.getByRole('button', { name: 'Replace banner' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove banner' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: i18n.t('actions.saveChanges') }));

    await waitFor(() => {
      expect(screen.getByTestId('profile-banner-image')).toHaveAttribute('src', activatedBannerUrl);
    });
    expect(screen.getByRole('status')).toHaveTextContent('Profile banner updated.');
    expect(screen.getByRole('button', { name: 'Replace banner' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove banner' })).toBeInTheDocument();

    mounted.unmount();
    render(<BannerLifecycleHarness />);
    expect(screen.getByTestId('profile-banner-image')).toHaveAttribute('src', activatedBannerUrl);
    expect(screen.getByRole('button', { name: 'Replace banner' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove banner' })).toBeInTheDocument();
  });

  it('rejects unsupported or oversized banner files before staging them', async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<UserSettingsForm />);
    const input = screen.getByLabelText('Choose a profile banner');

    await user.upload(input, new File(['svg'], 'banner.svg', { type: 'image/svg+xml' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a JPEG, PNG, or WebP image.');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-errormessage', 'profile-banner-file-error');

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
    expect(screen.queryByText('Profile banner updated.')).not.toBeInTheDocument();
    expect(addToast).not.toHaveBeenCalled();
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

  it('uses a bounded responsive preview and a complete desktop control rail', () => {
    render(<UserSettingsForm />);

    const layout = screen.getByTestId('profile-banner-settings-grid');
    const preview = screen.getByTestId('profile-banner-preview');
    const previewColumn = preview.parentElement;
    const controls = screen.getByTestId('profile-banner-controls');

    expect(layout).toHaveClass('grid-cols-1', 'lg:grid-cols-12');
    expect(previewColumn).toHaveClass('lg:col-span-7', 'xl:col-span-8');
    expect(preview).toHaveClass('aspect-[3/1]', 'max-h-[260px]', 'max-w-[780px]');
    expect(controls).toHaveClass('lg:col-span-5', 'xl:col-span-4');
    expect(within(controls).getByRole('heading', { name: 'Profile banner' })).toBeInTheDocument();
    expect(within(controls).getByText(/JPEG, PNG, or WebP up to 8 MB/)).toBeInTheDocument();
    expect(within(controls).getByRole('button', { name: 'Replace banner' })).toBeInTheDocument();
    expect(within(controls).getByRole('button', { name: 'Remove banner' })).toBeInTheDocument();
  });

  it('keeps the empty preview semantic and reserves no unavailable Remove action', () => {
    useUserStore.setState({
      user: { ...useUserStore.getState().user, bannerUrl: null },
    });
    render(<UserSettingsForm />);

    const preview = screen.getByTestId('profile-banner-preview');
    const controls = screen.getByTestId('profile-banner-controls');
    const fallback = within(preview).getByRole('img', { name: 'No profile banner selected' });

    expect(fallback).toHaveClass('bg-[var(--ns-surface-elevated)]');
    expect(fallback.className).not.toContain('gradient');
    expect(within(controls).getByRole('button', { name: 'Upload banner' })).toBeInTheDocument();
    expect(within(controls).queryByRole('button', { name: 'Remove banner' })).not.toBeInTheDocument();
  });

  it('places identity and biography before Appearance while keeping one final Save action', () => {
    render(<UserSettingsForm />);

    const biography = screen.getByLabelText(i18n.t('profile.biography'));
    const themeSelector = screen.getByTestId('theme-selector');
    const save = screen.getByRole('button', { name: i18n.t('actions.saveChanges') });

    expect(biography.compareDocumentPosition(themeSelector) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(themeSelector.compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByRole('button', { name: i18n.t('actions.saveChanges') })).toHaveLength(1);
  });

  it('preserves staged biography and banner drafts across a parent rerender', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<UserSettingsForm />);
    const biography = screen.getByLabelText(i18n.t('profile.biography'));

    await user.clear(biography);
    await user.type(biography, 'Unsaved biography draft');
    await user.upload(
      screen.getByLabelText('Choose a profile banner'),
      new File(['valid'], 'unsaved.jpg', { type: 'image/jpeg' })
    );
    rerender(<UserSettingsForm />);

    expect(screen.getByLabelText(i18n.t('profile.biography'))).toHaveValue('Unsaved biography draft');
    expect(screen.getByAltText('Profile banner preview')).toHaveAttribute(
      'src',
      'blob:noirsound-profile-banner'
    );
    expect(uploadBanner).not.toHaveBeenCalled();
  });

  it('keeps the settings route on the wide shell with tabs sticky inside the main scroller', () => {
    const profileSource = readFileSync(path.join(process.cwd(), 'src/pages/Profile.jsx'), 'utf8');

    expect(profileSource).toMatch(/data-testid="profile-tabs"[\s\S]*?sticky top-0[\s\S]*?scroll-mt-2/);
    expect(profileSource).toMatch(/data-testid="profile-settings-layout"[\s\S]*?xl:grid-cols-12/);
    expect(profileSource).toContain('ns-layout-page--form');
    expect(profileSource).toContain('min-w-0 xl:col-span-12');
    expect(profileSource).not.toContain('2xl:col-span-9');
    expect(profileSource).toContain('className="flex flex-col pb-10"');
    expect(profileSource).toMatch(/data-testid="profile-tabs"[\s\S]*?mt-4[\s\S]*?overflow-x-auto[\s\S]*?xl:mt-0/);
    expect(profileSource).toMatch(
      /data-testid="profile-tab-content"[\s\S]*?'pt-6 xl:pt-4'[\s\S]*?'pt-4 xl:pt-3'/
    );
    expect(profileSource).not.toMatch(/data-testid="profile-tab-content"[^>]*(?:min-h|minHeight|height:)/);
    expect(profileSource).not.toContain('sm:ml-auto');
    expect(profileSource).toContain('useScrollableTabs(`${activeTab}:${i18n.resolvedLanguage}`)');
    expect(profileSource).toMatch(
      /Keep the settings form mounted[\s\S]*?activeTab === 'settings'[\s\S]*?'hidden'[\s\S]*?<UserSettingsForm \/>/
    );
  });
});
