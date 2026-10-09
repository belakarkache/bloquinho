import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import { en } from './locales/en'
import { pt } from './locales/pt'

export const SUPPORTED_LANGUAGES = ['pt', 'en'] as const
export type Language = (typeof SUPPORTED_LANGUAGES)[number]

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { pt: { translation: pt }, en: { translation: en } },
    supportedLngs: SUPPORTED_LANGUAGES,
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    fallbackLng: 'pt',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'bloquinho:language',
      caches: ['localStorage'],
    },
  })

i18n.on('languageChanged', (language) => {
  document.documentElement.lang = localeFor(language)
})

export function localeFor(language: string | undefined): string {
  return language === 'en' ? 'en' : 'pt-BR'
}

export function currentLanguage(): Language {
  return i18n.resolvedLanguage === 'en' ? 'en' : 'pt'
}

export default i18n
