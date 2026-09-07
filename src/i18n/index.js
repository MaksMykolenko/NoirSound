import i18n from 'i18next';
import landingResources from './landingResources';
import landingCreatorResources from './landingCreatorResources';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enCommon from './locales/en/common.json';
import ukCommon from './locales/uk/common.json';
import plCommon from './locales/pl/common.json';
import ruCommon from './locales/ru/common.json';

const resources = {
  en: { common: { ...enCommon, landing: { ...landingResources.en, creator: landingCreatorResources.en } } },
  uk: { common: { ...ukCommon, landing: { ...landingResources.uk, creator: landingCreatorResources.uk } } },
  pl: { common: { ...plCommon, landing: { ...landingResources.pl, creator: landingCreatorResources.pl } } },
  ru: { common: { ...ruCommon, landing: { ...landingResources.ru, creator: landingCreatorResources.ru } } },
};

const customDetector = {
  name: 'customLanguageDetector',
  lookup() {
    let saved;
    try { saved = localStorage.getItem('noirsound_language'); } catch { /* Use the browser language when storage is unavailable. */ }
    if (saved && ['en', 'uk', 'pl', 'ru'].includes(saved)) {
      return saved;
    }

    const browserLangs = navigator.languages || [navigator.language || navigator.userLanguage];
    for (const lang of browserLangs) {
      if (!lang) continue;
      const code = lang.toLowerCase().split('-')[0];
      if (['en', 'uk', 'pl', 'ru'].includes(code)) {
        return code;
      }
    }
    return 'en';
  },
  cacheUserLanguage(lng) {
    if (lng && ['en', 'uk', 'pl', 'ru'].includes(lng)) {
      try { localStorage.setItem('noirsound_language', lng); } catch { /* In-memory language still works. */ }
    }
  },
};

const languageDetector = new LanguageDetector();
languageDetector.addDetector(customDetector);

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    defaultNS: 'common',
    detection: {
      order: ['customLanguageDetector', 'localStorage', 'navigator'],
      lookupLocalStorage: 'noirsound_language',
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false,
    },
  });

i18n.on('languageChanged', (lng) => {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lng;
  }
});

if (typeof document !== 'undefined') {
  document.documentElement.lang = i18n.language || 'en';
}

export default i18n;
