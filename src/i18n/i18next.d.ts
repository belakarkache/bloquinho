import 'i18next'
import type { Translation } from './locales/pt'

declare module 'i18next' {
  interface CustomTypeOptions {
    resources: { translation: Translation }
  }
}
