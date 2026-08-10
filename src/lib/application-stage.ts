import type { ApplicationData, ApplicationStore } from "@/lib/application-store"
import { mapApplicationStageRow } from "@/lib/application-store"
import { supabase } from "@/lib/supabase"
import type {
  BuiltInStageCategory,
  DbApplicationStage,
  StageProgressStatus,
} from "@/mocks/types"

/**
 * The per-application stage timeline — see docs/plans/12-application-stage-
 * timeline.md. `application_stages` is the history now: there is no separate
 * log table, a stage row *is* one dated, statused step in the pipeline.
 * Sub-stages are capped at one level of nesting (enforced in `createStage`
 * below, not just the UI).
 */

export type StageNode = DbApplicationStage & { subStages: DbApplicationStage[] }

/**
 * Top-level stages for one application, ordered by position, each with its
 * (also position-ordered) sub-stages attached. `subStages` are never further
 * nested — one level, per the locked-in decision.
 */
export function stagesForApplication(
  data: ApplicationData,
  applicationId: string
): StageNode[] {
  const topLevel = data.applicationStages
    .filter(
      (stage) =>
        stage.applicationId === applicationId && stage.parentStageId === null
    )
    .sort((a, b) => a.position - b.position)

  return topLevel.map((stage) => ({
    ...stage,
    subStages: data.applicationStages
      .filter((child) => child.parentStageId === stage.id)
      .sort((a, b) => a.position - b.position),
  }))
}

function requireUserId(store: ApplicationStore): string {
  if (!store.userId) {
    throw new Error("No signed-in user.")
  }
  return store.userId
}

export type StageFormFields = {
  parentStageId: string | null
  name: string
  category: BuiltInStageCategory | string
  status?: StageProgressStatus
  scheduledAt?: string | null
  completedAt?: string | null
  notes?: string | null
  interviewerNames?: string[]
}

/**
 * Inserts a new stage. If `parentStageId` is set, the target must itself be
 * a top-level stage — sub-stages of sub-stages are rejected here, the one
 * enforcement point for the depth-1 rule. A new top-level stage also becomes
 * the application's `current_stage_id` (the "quick UI highlight" default);
 * sub-stage creation never touches it.
 */
export async function createStage(
  store: ApplicationStore,
  applicationId: string,
  fields: StageFormFields
): Promise<DbApplicationStage> {
  requireUserId(store)

  if (fields.parentStageId) {
    const parent = store.applicationStages.find(
      (stage) => stage.id === fields.parentStageId
    )
    if (!parent) {
      throw new Error(`No stage "${fields.parentStageId}".`)
    }
    if (parent.parentStageId !== null) {
      throw new Error("Sub-stages can't have their own sub-stages.")
    }
  }

  const siblingPositions = store.applicationStages
    .filter(
      (stage) =>
        stage.applicationId === applicationId &&
        stage.parentStageId === fields.parentStageId
    )
    .map((stage) => stage.position)
  const position = 1 + (siblingPositions.length > 0 ? Math.max(...siblingPositions) : -1)

  const { data, error } = await supabase
    .from("application_stages")
    .insert({
      application_id: applicationId,
      parent_stage_id: fields.parentStageId,
      name: fields.name,
      category: fields.category,
      status: fields.status ?? "not_started",
      position,
      scheduled_at: fields.scheduledAt ?? null,
      completed_at: fields.completedAt ?? null,
      notes: fields.notes ?? null,
      interviewer_names: fields.interviewerNames ?? [],
    })
    .select()
    .single()

  if (error) throw error

  const stage = mapApplicationStageRow(data)
  store.setApplicationStages((current) => [...current, stage])

  if (fields.parentStageId === null) {
    const { data: applicationRow, error: applicationError } = await supabase
      .from("applications")
      .update({ current_stage_id: stage.id })
      .eq("id", applicationId)
      .select()
      .single()

    if (applicationError) throw applicationError

    store.setApplications((current) =>
      current.map((application) =>
        application.id === applicationId
          ? { ...application, currentStageId: applicationRow.current_stage_id }
          : application
      )
    )
  }

  return stage
}

export type StageUpdateFields = Partial<
  Omit<StageFormFields, "parentStageId">
>

/** Patches a stage's editable fields. No reordering/re-parenting support. */
export async function updateStage(
  store: ApplicationStore,
  stageId: string,
  patch: StageUpdateFields
): Promise<DbApplicationStage> {
  const { data, error } = await supabase
    .from("application_stages")
    .update({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.category !== undefined ? { category: patch.category } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.scheduledAt !== undefined
        ? { scheduled_at: patch.scheduledAt }
        : {}),
      ...(patch.completedAt !== undefined
        ? { completed_at: patch.completedAt }
        : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
      ...(patch.interviewerNames !== undefined
        ? { interviewer_names: patch.interviewerNames }
        : {}),
    })
    .eq("id", stageId)
    .select()
    .single()

  if (error) throw error

  const updated = mapApplicationStageRow(data)
  store.setApplicationStages((current) =>
    current.map((stage) => (stage.id === stageId ? updated : stage))
  )

  return updated
}

/**
 * Deletes a stage. The DB cascades any children automatically (`on delete
 * cascade` on `parent_stage_id`); the local store isn't wired to realtime, so
 * the same filter is applied client-side here. If the deleted stage was the
 * application's `current_stage_id`, that's cleared to `null` in both places.
 */
export async function deleteStage(
  store: ApplicationStore,
  stageId: string
): Promise<void> {
  const stage = store.applicationStages.find((existing) => existing.id === stageId)
  if (!stage) {
    throw new Error(`No stage "${stageId}".`)
  }

  const { error } = await supabase
    .from("application_stages")
    .delete()
    .eq("id", stageId)

  if (error) throw error

  store.setApplicationStages((current) =>
    current.filter(
      (existing) => existing.id !== stageId && existing.parentStageId !== stageId
    )
  )

  const application = store.applications.find(
    (existing) => existing.id === stage.applicationId
  )
  if (application?.currentStageId === stageId) {
    const { error: applicationError } = await supabase
      .from("applications")
      .update({ current_stage_id: null })
      .eq("id", stage.applicationId)

    if (applicationError) throw applicationError

    store.setApplications((current) =>
      current.map((existing) =>
        existing.id === stage.applicationId
          ? { ...existing, currentStageId: null }
          : existing
      )
    )
  }
}

/** The manual "Mark as current" override — a plain single-column update. */
export async function setCurrentStage(
  store: ApplicationStore,
  applicationId: string,
  stageId: string | null
): Promise<void> {
  const { error } = await supabase
    .from("applications")
    .update({ current_stage_id: stageId })
    .eq("id", applicationId)

  if (error) throw error

  store.setApplications((current) =>
    current.map((application) =>
      application.id === applicationId
        ? { ...application, currentStageId: stageId }
        : application
    )
  )
}
