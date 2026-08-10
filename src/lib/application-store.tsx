/* eslint-disable react-refresh/only-export-components */
import * as React from "react"

import { useAuth } from "@/lib/auth-context"
import { supabase } from "@/lib/supabase"
import type { Tables } from "@/lib/database.types"
import { parseCvSnapshot } from "@/lib/cv-snapshot"
import type { DbApplication, DbApplicationStatusHistory } from "@/mocks/types"

/**
 * Fetches `applications` and `application_status_history` for the signed-in
 * user once per session and holds them in React state. Mirrors
 * `src/lib/persona-store.tsx` exactly — see that file for why the selectors
 * that read this store stay synchronous.
 */

export type ApplicationData = {
  applications: DbApplication[]
  applicationStatusHistory: DbApplicationStatusHistory[]
}

export type ApplicationStore = ApplicationData & {
  userId: string | null
  loading: boolean
  error: Error | null
  refetch: () => void
  setApplications: React.Dispatch<React.SetStateAction<DbApplication[]>>
  setApplicationStatusHistory: React.Dispatch<
    React.SetStateAction<DbApplicationStatusHistory[]>
  >
}

const ApplicationStoreContext = React.createContext<ApplicationStore | null>(
  null
)

function toError(caught: unknown): Error {
  return caught instanceof Error ? caught : new Error(String(caught))
}

export function mapApplicationRow(row: Tables<"applications">): DbApplication {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    sourceUrl: row.source_url,
    vacancyDetail: row.vacancy_detail,
    applyVia: row.apply_via,
    cvId: row.cv_id,
    status: row.status,
    cvSnapshot: row.cv_snapshot ? parseCvSnapshot(row.cv_snapshot) : null,
    note: row.note,
    tags: row.tags,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapApplicationStatusHistoryRow(
  row: Tables<"application_status_history">
): DbApplicationStatusHistory {
  return {
    id: row.id,
    applicationId: row.application_id,
    status: row.status,
    changedAt: row.changed_at,
    note: row.note,
  }
}

async function fetchByApplicationIds(applicationIds: string[]) {
  if (applicationIds.length === 0) {
    return { data: [] as Tables<"application_status_history">[], error: null }
  }

  return supabase
    .from("application_status_history")
    .select("*")
    .in("application_id", applicationIds)
    .order("changed_at") as unknown as Promise<{
    data: Tables<"application_status_history">[] | null
    error: unknown
  }>
}

export function ApplicationStoreProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { session } = useAuth()
  const userId = session?.user.id ?? null

  const [applications, setApplications] = React.useState<DbApplication[]>([])
  const [applicationStatusHistory, setApplicationStatusHistory] =
    React.useState<DbApplicationStatusHistory[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<Error | null>(null)
  const [version, setVersion] = React.useState(0)

  React.useEffect(() => {
    let cancelled = false

    async function load() {
      if (!userId) {
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const { data: applicationRows, error: applicationsError } =
          await supabase
            .from("applications")
            .select("*")
            .eq("user_id", userId as string)
            .order("created_at")

        if (applicationsError) throw applicationsError

        const applicationIds = (applicationRows ?? []).map((row) => row.id)

        const historyResult = await fetchByApplicationIds(applicationIds)

        if (historyResult.error) throw historyResult.error

        if (cancelled) return

        setApplications((applicationRows ?? []).map(mapApplicationRow))
        setApplicationStatusHistory(
          (historyResult.data ?? []).map(mapApplicationStatusHistoryRow)
        )
      } catch (caught) {
        if (!cancelled) {
          setError(toError(caught))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [userId, version])

  const refetch = React.useCallback(() => setVersion((v) => v + 1), [])

  const value = React.useMemo<ApplicationStore>(
    () => ({
      applications,
      applicationStatusHistory,
      userId,
      loading,
      error,
      refetch,
      setApplications,
      setApplicationStatusHistory,
    }),
    [applications, applicationStatusHistory, userId, loading, error, refetch]
  )

  return (
    <ApplicationStoreContext.Provider value={value}>
      {children}
    </ApplicationStoreContext.Provider>
  )
}

export function useApplicationStore(): ApplicationStore {
  const context = React.useContext(ApplicationStoreContext)

  if (!context) {
    throw new Error(
      "useApplicationStore must be used within an ApplicationStoreProvider"
    )
  }

  return context
}
