import type { SupabaseClient, User } from '@supabase/supabase-js'
import { createContext, useContext, useSyncExternalStore } from 'react'
import type { SyncManager, SyncStatus } from '../sync/SyncManager'

export interface AuthContextValue {
  client: SupabaseClient | null
  user: User | null
  loading: boolean
  syncManager: SyncManager | null
  recoveringPassword: boolean
  finishPasswordRecovery: () => void
  signOut: (confirmDiscard: (pending: number) => boolean) => Promise<void>
  deleteAccount: () => Promise<{ error: Error | null }>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}

const noopSubscribe = () => () => {}
const offlineStatus = (): SyncStatus | null => null

export function useSyncStatus(): SyncStatus | null {
  const { syncManager } = useAuth()
  return useSyncExternalStore(
    syncManager?.subscribe ?? noopSubscribe,
    syncManager?.getStatus ?? offlineStatus,
  )
}

export function hasPasswordLogin(user: User): boolean {
  const providers: unknown = user.app_metadata.providers
  return Array.isArray(providers) ? providers.includes('email') : user.app_metadata.provider === 'email'
}
