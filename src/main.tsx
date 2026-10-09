import { MotionConfig } from 'motion/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { AuthProvider } from './auth/AuthProvider.tsx'
import { ContextMenuProvider } from './components/ContextMenu.tsx'
import './i18n'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <AuthProvider>
        <ContextMenuProvider>
          <App />
        </ContextMenuProvider>
      </AuthProvider>
    </MotionConfig>
  </StrictMode>,
)
