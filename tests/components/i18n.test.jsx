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

  it('provides the complete Music / Beats copy contract in every supported language', async () => {
    const keys = [
      'content.music',
      'content.beat',
      'content.beats',
      'content.all',
      'content.contentType',
      'content.uploadAs',
      'content.uploadMusic',
      'content.uploadBeat',
      'content.musicUploadDescription',
      'content.beatUploadDescription',
      'beats.title',
      'beats.freshBeats',
      'beats.trendingBeats',
      'beats.noBeats',
      'beats.bpm',
      'beats.key',
      'beats.mood',
      'beats.style',
      'beats.producer',
      'beats.contactProducer',
      'beats.usageNotes',
      'beats.beatMetadata',
      'beats.beatDetails',
      'beats.playBeat',
      'beats.goToBeat',
      'beats.goToProducer',
      'beats.addBeatToPlaylist',
      'beats.likedBeats',
      'beats.savedBeats',
      'beats.metadataHelp',
      'beats.bpmPlaceholder',
      'beats.keyPlaceholder',
      'beats.moodPlaceholder',
      'beats.stylePlaceholder',
      'beats.licenseType',
      'beats.licenseTypePlaceholder',
      'beats.usageNotesPlaceholder',
      'beats.contactEnabled',
      'beats.contactEnabledHelp',
      'discover.music',
      'discover.beats',
      'library.music',
      'library.beats',
      'artist.music',
      'artist.beats',
      'admin.contentType',
      'admin.filterMusic',
      'admin.filterBeats',
      'dashboard.contentBreakdown',
      'dashboard.musicReleases',
      'dashboard.musicStreams',
      'dashboard.beatReleases',
      'dashboard.beatStreams',
      'dashboard.topMusic',
      'dashboard.topBeats',
      'dashboard.noTopMusicYet',
      'dashboard.noTopBeatsYet',
      'profile.creatorSections',
      'artist.playlists',
      'artist.beatsByCreator',
      'artist.noBeatsUploaded',
      'artist.noPlaylists',
      'beats.noBeatsDescription',
      'beats.anyMood',
      'beats.anyStyle',
      'beats.anyKey',
      'beats.anyBpm',
      'beats.sort',
      'beats.recentlyAdded',
      'beats.mostPlayed',
      'beats.likedMusic',
      'beats.noLikedBeats',
      'beats.likeBeatsDesc',
      'beats.producedBy',
      'beats.beatDetailsDescription',
      'beats.relatedBeats',
      'home.newMusic',
      'home.newMusicDesc',
      'home.freshBeatsDesc',
      'admin.updateContentType',
      'contextMenu.report',
    ];

    for (const language of ['en', 'uk', 'pl', 'ru']) {
      await i18n.changeLanguage(language);
      for (const key of keys) {
        const translation = i18n.t(key);
        expect(translation, `${language}:${key}`).not.toBe(key);
        expect(translation, `${language}:${key}`).not.toHaveLength(0);
      }
    }
  });

  it('falls back to English for unsupported locale codes', async () => {
    await i18n.changeLanguage('fr');
    expect(i18n.t('nav.home')).toBe('Home');
  });
});
