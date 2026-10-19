import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import rw from './locales/rw.json';
import en from './locales/en.json';

const STORAGE_KEY = 'idt.language';

function initialLanguage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
    const nav = navigator.language?.slice(0, 2);
    if (nav === 'en') return 'en';
  } catch {
    /* ignore */
  }
  return 'rw';
}

i18n.use(initReactI18next).init({
  resources: {
    rw: { translation: rw },
    en: { translation: en },
  },
  lng: initialLanguage(),
  fallbackLng: 'en',
  supportedLngs: ['rw', 'en'],
  interpolation: { escapeValue: false },
  returnEmptyString: false,
});

export function setLanguage(lang) {
  i18n.changeLanguage(lang);
  try {
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  } catch {
    /* ignore */
  }
}

export default i18n;
