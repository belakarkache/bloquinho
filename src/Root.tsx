import { lazy, Suspense } from 'react'
import App from './App'
import { useRoute } from './routing/route'

const KanbaninhoPage = lazy(() => import('./kanban/KanbaninhoPage'))

export function Root() {
  const route = useRoute()

  if (route === 'notes') return <App />
  return (
    <Suspense fallback={null}>
      <KanbaninhoPage />
    </Suspense>
  )
}
