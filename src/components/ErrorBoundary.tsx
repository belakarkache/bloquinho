import { ArrowClockwiseIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

function CrashScreen({ error }: { error: unknown }) {
  const { t } = useTranslation()
  const details = error instanceof Error ? error.message : String(error)

  return (
    <main role="alert" className="flex min-h-dvh items-center justify-center bg-canvas px-6 py-12 text-ink">
      <div className="w-full max-w-sm text-center">
        <span className="mx-auto inline-flex size-16 items-center justify-center rounded-full bg-surface-2 text-ink-soft">
          <WarningCircleIcon size={32} weight="duotone" />
        </span>
        <h1 className="mt-6 font-display text-2xl font-bold tracking-[-0.01em]">{t('crash.title')}</h1>
        <p className="mt-2 leading-relaxed text-ink-soft">{t('crash.body')}</p>
        <button
          type="button"
          onClick={() => location.reload()}
          className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-accent px-6 font-semibold text-on-accent shadow-[0_12px_24px_-12px_var(--accent)] transition-colors hover:bg-accent-hover"
        >
          <ArrowClockwiseIcon size={18} weight="bold" />
          {t('crash.reload')}
        </button>
        {details && (
          <details className="mt-8 text-left text-sm text-ink-soft">
            <summary className="cursor-pointer text-center font-semibold">{t('crash.details')}</summary>
            <pre className="mt-2 max-h-40 overflow-auto rounded-2xl bg-surface-2 p-3 text-xs break-words whitespace-pre-wrap">
              {details}
            </pre>
          </details>
        )}
      </div>
    </main>
  )
}

interface ErrorBoundaryState {
  error: unknown
  failed: boolean
}

export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, failed: false }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error, failed: true }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    return this.state.failed ? <CrashScreen error={this.state.error} /> : this.props.children
  }
}
