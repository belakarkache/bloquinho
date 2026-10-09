import { useMotionValueEvent, useScroll } from 'motion/react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AppMenu } from './AppMenu'
import { LogoMark } from './Logo'

interface HeaderProps {
  search: ReactNode
  onSignIn: () => void
  onLogoClick: () => void
}

export function Header({ search, onSignIn, onLogoClick }: HeaderProps) {
  const { t } = useTranslation()
  const { scrollY } = useScroll()
  const [scrolled, setScrolled] = useState(false)
  useMotionValueEvent(scrollY, 'change', (value) => setScrolled(value > 8))

  return (
    <header
      className={`sticky top-0 z-40 pt-[env(safe-area-inset-top)] transition-[background-color,box-shadow,backdrop-filter] duration-300 ${scrolled ? 'bg-canvas/80 shadow-[0_10px_30px_-20px_rgb(var(--shadow-ink)/0.4)] backdrop-blur-xl' : 'bg-transparent'}`}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:gap-5">
        <h1 className="flex shrink-0">
          <span className="sr-only">{t('app.name')}</span>
          <button
            type="button"
            onClick={onLogoClick}
            title={t('composer.new')}
            aria-label={t('composer.new')}
            className="flex rounded-xl outline-offset-2"
          >
            <LogoMark className="size-10" />
          </button>
        </h1>
        <div className="ml-auto flex items-center gap-1.5">
          {search}
          <AppMenu onSignIn={onSignIn} />
        </div>
      </div>
    </header>
  )
}
