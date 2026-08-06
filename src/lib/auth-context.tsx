/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import type { Session } from "@supabase/supabase-js"

import { supabase } from "@/lib/supabase"

type AuthContextValue = {
  session: Session | null
  loading: boolean
}

const AuthContext = React.createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
    })

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const value = React.useMemo(() => ({ session, loading }), [session, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = React.useContext(AuthContext)

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }

  return context
}
