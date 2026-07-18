import React from 'react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import UserSettingsForm from '../../src/components/profile/UserSettingsForm';
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

  beforeEach(async () => {
    await i18n.changeLanguage('en');
    localStorage.clear();
    updateUser = vi.fn();
    addActivity = vi.fn();
    addToast = vi.fn();
    useUserStore.setState({
      user: {
        id: 'listener-1',
        displayName: 'Night Listener',
        username: 'night_listener',
        bio: 'Original biography',
        location: 'Kyiv',
      },
      updateUser,
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

  it('keeps the settings route on the wide shell with tabs sticky inside the main scroller', () => {
    const profileSource = readFileSync(path.join(process.cwd(), 'src/pages/Profile.jsx'), 'utf8');

    expect(profileSource).toMatch(/data-testid="profile-tabs"[\s\S]*?sticky top-0[\s\S]*?scroll-mt-2/);
    expect(profileSource).toMatch(/data-testid="profile-settings-layout"[\s\S]*?xl:grid-cols-12/);
    expect(profileSource).toContain('ns-layout-page--form');
    expect(profileSource).toContain('2xl:col-span-9');
  });
});
