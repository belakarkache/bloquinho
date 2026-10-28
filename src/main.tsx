import { MotionConfig } from 'motion/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from './auth/AuthProvider.tsx'
import { ContextMenuProvider } from './components/ContextMenu.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import './i18n'
import { ColorNamesProvider } from './notes/ColorNamesProvider.tsx'
import './index.css'
import { Root } from './Root.tsx'

if (import.meta.env.DEV) void import('./dev/seed')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <AuthProvider>
          <ColorNamesProvider>
            <ContextMenuProvider>
              <Root />
            </ContextMenuProvider>
          </ColorNamesProvider>
        </AuthProvider>
      </MotionConfig>
    </ErrorBoundary>
  </StrictMode>,
)
