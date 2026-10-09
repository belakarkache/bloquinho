import { useTranslation } from 'react-i18next'

const AUTHOR_URL = 'https://icka.dev'

export function Footer() {
  const { t } = useTranslation()

  return (
    <footer className="px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center text-sm text-ink-soft">
      {t('footer.developedBy')}{' '}
      <a
        href={AUTHOR_URL}
        target="_blank"
        rel="noopener"
        className="font-medium text-ink underline decoration-ink/35 underline-offset-2 transition-colors hover:decoration-ink"
      >
        icka.dev
      </a>
    </footer>
  )
}
