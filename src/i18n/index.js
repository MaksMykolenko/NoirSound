import i18n from 'i18next';
import landingResources from './landingResources';
import landingCreatorResources from './landingCreatorResources';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enCommon from './locales/en/common.json';
import ukCommon from './locales/uk/common.json';
import plCommon from './locales/pl/common.json';
import ruCommon from './locales/ru/common.json';

const mergeCommon = (commonJson, landingRes, creatorRes) => ({
  ...commonJson,
  header: {
    ...commonJson.header,
    signOut: commonJson.header?.signOut || commonJson.admin?.signOut || commonJson.header?.logout || 'Sign out',
  },
  landing: {
    ...(commonJson.landing || {}),
    ...landingRes,
    creator: {
      ...(commonJson.landing?.creator || {}),
      ...creatorRes,
    },
  },
});

const resources = {
  en: { common: mergeCommon(enCommon, landingResources.en, landingCreatorResources.en) },
  uk: { common: mergeCommon(ukCommon, landingResources.uk, landingCreatorResources.uk) },
  pl: { common: mergeCommon(plCommon, landingResources.pl, landingCreatorResources.pl) },
  ru: { common: mergeCommon(ruCommon, landingResources.ru, landingCreatorResources.ru) },
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
