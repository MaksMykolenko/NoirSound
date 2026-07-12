import { describe, it, expect, beforeEach } from 'vitest';
import i18n from '../../src/i18n';

describe('Multilingual i18n Localization Engine', () => {
  beforeEach(async () => {
    localStorage.removeItem('noirsound_language');
    await i18n.changeLanguage('en');
  });

  it('defaults to English as fallback language', () => {
    expect(i18n.language).toContain('en');
    expect(i18n.t('nav.home')).toBe('Home');
  });

  it('switches cleanly to Ukrainian (uk) and updates translations', async () => {
    await i18n.changeLanguage('uk');
    expect(i18n.t('nav.home')).toBe('Головна');
    expect(i18n.t('nav.discover')).toBe('Огляд');
  });

  it('switches cleanly to Polish (pl) and updates translations', async () => {
    await i18n.changeLanguage('pl');
    expect(i18n.t('nav.home')).toBe('Główna');
    expect(i18n.t('nav.discover')).toBe('Odkrywaj');
  });

  it('switches cleanly to Russian (ru) and updates translations', async () => {
    await i18n.changeLanguage('ru');
    expect(i18n.t('nav.home')).toBe('Главная');
    expect(i18n.t('nav.discover')).toBe('Обзор');
  });

  it('localizes the neutral demo audio failure in every supported language', async () => {
    const expectedMessages = {
      en: 'Demo audio source is unavailable',
      uk: 'Демоаудіо недоступне',
      pl: 'Dźwięk demo jest niedostępny',
      ru: 'Демоаудио недоступно',
    };

    for (const [language, expected] of Object.entries(expectedMessages)) {
      await i18n.changeLanguage(language);
      expect(i18n.t('player.demoAudioUnavailable')).toBe(expected);
    }
  });

  it('falls back to English for unsupported locale codes', async () => {
    await i18n.changeLanguage('fr');
    expect(i18n.t('nav.home')).toBe('Home');
  });
});
