/* eslint-disable react-refresh/only-export-components */
import * as React from "react"

import { useAuth } from "@/lib/auth-context"
import { supabase } from "@/lib/supabase"
import type { Tables } from "@/lib/database.types"
import { parseCvSnapshot } from "@/lib/cv-snapshot"
import type { DbApplication, DbApplicationStage, DbStageTemplate } from "@/mocks/types"

/**
 * Fetches `applications`, `application_stages`, and `stage_templates` for the
 * signed-in user once per session and holds them in React state. Mirrors
 * `src/lib/persona-store.tsx` exactly — see that file for why the selectors
 * that read this store stay synchronous.
 */

export type ApplicationData = {
  applications: DbApplication[]
  applicationStages: DbApplicationStage[]
  stageTemplates: DbStageTemplate[]
}

export type ApplicationStore = ApplicationData & {
  userId: string | null
  loading: boolean
  error: Error | null
  refetch: () => void
  setApplications: React.Dispatch<React.SetStateAction<DbApplication[]>>
  setApplicationStages: React.Dispatch<React.SetStateAction<DbApplicationStage[]>>
  setStageTemplates: React.Dispatch<React.SetStateAction<DbStageTemplate[]>>
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
    company: row.company,
    position: row.position,
    location: row.location,
    jobType: row.job_type,
    workType: row.work_type,
    deadline: row.deadline,
    sourceUrl: row.source_url,
    vacancyDetail: row.vacancy_detail,
    coverLetter: row.cover_letter,
    applyVia: row.apply_via,
    cvId: row.cv_id,
    globalStatus: row.global_status,
    currentStageId: row.current_stage_id,
    cvSnapshot: row.cv_snapshot ? parseCvSnapshot(row.cv_snapshot) : null,
    note: row.note,
    tags: row.tags,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapApplicationStageRow(
  row: Tables<"application_stages">
): DbApplicationStage {
  return {
    id: row.id,
    applicationId: row.application_id,
    parentStageId: row.parent_stage_id,
    name: row.name,
    category: row.category,
    status: row.status,
    position: row.position,
    scheduledAt: row.scheduled_at,
    completedAt: row.completed_at,
    notes: row.notes,
    interviewerNames: row.interviewer_names,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapStageTemplateRow(
  row: Tables<"stage_templates">
): DbStageTemplate {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    category: row.category,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function fetchStagesForApplications(applicationIds: string[]) {
  if (applicationIds.length === 0) {
    return { data: [] as Tables<"application_stages">[], error: null }
  }

  return supabase
    .from("application_stages")
    .select("*")
    .in("application_id", applicationIds)
    .order("position") as unknown as Promise<{
    data: Tables<"application_stages">[] | null
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
  const [applicationStages, setApplicationStages] = React.useState<
    DbApplicationStage[]
  >([])
  const [stageTemplates, setStageTemplates] = React.useState<DbStageTemplate[]>(
    []
  )
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

        const [stagesResult, templatesResult] = await Promise.all([
          fetchStagesForApplications(applicationIds),
          supabase
            .from("stage_templates")
            .select("*")
            .eq("user_id", userId as string)
            .order("name"),
        ])

        if (stagesResult.error) throw stagesResult.error
        if (templatesResult.error) throw templatesResult.error

        if (cancelled) return

        setApplications((applicationRows ?? []).map(mapApplicationRow))
        setApplicationStages(
          (stagesResult.data ?? []).map(mapApplicationStageRow)
        )
        setStageTemplates(
          (templatesResult.data ?? []).map(mapStageTemplateRow)
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
      applicationStages,
      stageTemplates,
      userId,
      loading,
      error,
      refetch,
      setApplications,
      setApplicationStages,
      setStageTemplates,
    }),
    [
      applications,
      applicationStages,
      stageTemplates,
      userId,
      loading,
      error,
      refetch,
    ]
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
