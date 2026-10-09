import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { db } from '../db/database'
import { supabase } from '../lib/supabase'
import { clearNoteOrder } from '../notes/noteOrderStore'
import { createSupabaseRemote } from '../sync/supabaseRemote'
import { SyncManager } from '../sync/SyncManager'
import { AuthContext, type AuthContextValue } from './authContext'

function useSession(client: SupabaseClient | null) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(client !== null)
  const [recoveringPassword, setRecoveringPassword] = useState(false)

  useEffect(() => {
    if (!client) return
    void client.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data } = client.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      if (event === 'PASSWORD_RECOVERY') setRecoveringPassword(true)
      if (event === 'SIGNED_OUT') void db.clearAll()
    })
    return () => data.subscription.unsubscribe()
  }, [client])

  return { session, loading, recoveringPassword, setRecoveringPassword }
}

function useSyncManager(client: SupabaseClient | null, userId: string | null) {
  const manager = useMemo(
    () => (client && userId ? new SyncManager(db, createSupabaseRemote(client), userId) : null),
    [client, userId],
  )

  useEffect(() => {
    if (!manager) return
    void manager.start()
    return () => manager.stop()
  }, [manager])

  return manager
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { session, loading, recoveringPassword, setRecoveringPassword } = useSession(supabase)
  const userId = session?.user.id ?? null
  const syncManager = useSyncManager(supabase, userId)

  const signOut = useCallback(
    async (confirmDiscard: (pending: number) => boolean) => {
      if (!supabase) return
      if (syncManager) {
        await syncManager.syncNow()
        const pending = await syncManager.pendingCount()
        if (pending > 0 && !confirmDiscard(pending)) return
      }
      await supabase.auth.signOut()
      await db.clearAll()
    },
    [syncManager],
  )

  const deleteAccount = useCallback(async () => {
    if (!supabase) return { error: null }
    const { error } = await supabase.rpc('delete_account')
    if (error) return { error }
    await supabase.auth.signOut({ scope: 'local' })
    await db.clearAll()
    clearNoteOrder()
    return { error: null }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      client: supabase,
      user: session?.user ?? null,
      loading,
      syncManager,
      recoveringPassword,
      finishPasswordRecovery: () => setRecoveringPassword(false),
      signOut,
      deleteAccount,
    }),
    [session, loading, syncManager, recoveringPassword, setRecoveringPassword, signOut, deleteAccount],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
