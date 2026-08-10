import type { InventoryStore } from "@/lib/inventory-store"
import type { PersonaData } from "@/lib/persona-store"
import { resolveCv } from "@/lib/cv"
import { buildCvSnapshot } from "@/lib/cv-snapshot"
import {
  mapApplicationRow,
  mapApplicationStatusHistoryRow,
  type ApplicationData,
  type ApplicationStore,
} from "@/lib/application-store"
import { supabase } from "@/lib/supabase"
import type { Json } from "@/lib/database.types"
import type { ApplicationStatus, DbApplication, DbApplicationStatusHistory } from "@/mocks/types"

/**
 * The Applications layer — job tracker built on top of the CV snapshot
 * format. See docs/specs/10-applications-tracking.md. Selectors, the New/
 * Edit/Delete mutators, and `setApplicationStatus` — the freeze mutator that
 * writes a `CvSnapshotV1` to `applications.cv_snapshot` once, on the first
 * transition away from `draft`, and never touches it again afterward.
 */

export function allApplications(data: ApplicationData): DbApplication[] {
  return data.applications
}

export function findApplication(
  data: ApplicationData,
  applicationId: string
): DbApplication | undefined {
  return data.applications.find((application) => application.id === applicationId)
}

/**
 * An application's status timeline, oldest first — mirrors natural
 * chronological reading. A "newest first" UI can `.reverse()` at render time
 * rather than baking direction into the selector.
 */
export function applicationHistory(
  data: ApplicationData,
  applicationId: string
): DbApplicationStatusHistory[] {
  return data.applicationStatusHistory
    .filter((entry) => entry.applicationId === applicationId)
    .sort((a, b) => a.changedAt.localeCompare(b.changedAt))
}

function requireUserId(store: ApplicationStore): string {
  if (!store.userId) {
    throw new Error("No signed-in user.")
  }
  return store.userId
}

// ---------------------------------------------------------------------------
// Mutators — New/Edit/Delete
// ---------------------------------------------------------------------------

export type ApplicationFormFields = {
  title: string
  sourceUrl?: string | null
  vacancyDetail?: string | null
  applyVia?: string | null
  cvId?: string | null
  note?: string | null
}

/**
 * Creates a new application in `draft` and inserts its first status-history
 * row (also `draft`) right after, so the timeline always starts at a real
 * point rather than implying the application existed before it was tracked.
 * Two sequential awaited inserts — no DB transaction available via the JS
 * client here, matching this codebase's existing style.
 */
export async function createApplication(
  store: ApplicationStore,
  fields: ApplicationFormFields
): Promise<DbApplication> {
  const userId = requireUserId(store)

  const { data, error } = await supabase
    .from("applications")
    .insert({
      user_id: userId,
      title: fields.title,
      source_url: fields.sourceUrl ?? null,
      vacancy_detail: fields.vacancyDetail ?? null,
      apply_via: fields.applyVia ?? null,
      cv_id: fields.cvId ?? null,
      note: fields.note ?? null,
      status: "draft",
    })
    .select()
    .single()

  if (error) throw error

  const application = mapApplicationRow(data)

  const { data: historyRow, error: historyError } = await supabase
    .from("application_status_history")
    .insert({
      application_id: application.id,
      status: "draft",
    })
    .select()
    .single()

  if (historyError) throw historyError

  const history = mapApplicationStatusHistoryRow(historyRow)

  store.setApplications((current) => [...current, application])
  store.setApplicationStatusHistory((current) => [...current, history])

  return application
}

/** Patches an application's editable fields and returns the updated row. */
export async function updateApplication(
  store: ApplicationStore,
  applicationId: string,
  patch: Partial<ApplicationFormFields>
): Promise<DbApplication> {
  const { data, error } = await supabase
    .from("applications")
    .update({
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.sourceUrl !== undefined ? { source_url: patch.sourceUrl } : {}),
      ...(patch.vacancyDetail !== undefined
        ? { vacancy_detail: patch.vacancyDetail }
        : {}),
      ...(patch.applyVia !== undefined ? { apply_via: patch.applyVia } : {}),
      ...(patch.cvId !== undefined ? { cv_id: patch.cvId } : {}),
      ...(patch.note !== undefined ? { note: patch.note } : {}),
    })
    .eq("id", applicationId)
    .select()
    .single()

  if (error) throw error

  const updated = mapApplicationRow(data)
  store.setApplications((current) =>
    current.map((existing) => (existing.id === applicationId ? updated : existing))
  )

  return updated
}

/** Deletes an application. `application_status_history` cascades via FK. */
export async function deleteApplication(
  store: ApplicationStore,
  applicationId: string
): Promise<void> {
  const { error } = await supabase.from("applications").delete().eq("id", applicationId)
  if (error) throw error

  store.setApplications((current) =>
    current.filter((application) => application.id !== applicationId)
  )
  store.setApplicationStatusHistory((current) =>
    current.filter((entry) => entry.applicationId !== applicationId)
  )
}

// ---------------------------------------------------------------------------
// Mutator — status changes + the freeze
// ---------------------------------------------------------------------------

/**
 * Moves an application to a new status, inserting one status-history row.
 *
 * The freeze: on the *first* transition away from `draft` (i.e.
 * `current.status === "draft" && next !== "draft"`), this resolves the
 * attached CV (live or already-frozen) via `resolveCv` and writes a fresh
 * `CvSnapshotV1` to `applications.cv_snapshot` — "one honest record of what
 * was actually sent." Every later status change — including bouncing back
 * through `draft` again — leaves `cv_snapshot` completely untouched: the
 * `cv_snapshot` key is simply omitted from the update payload whenever
 * `current.status !== "draft"`, so nothing ever overwrites the original
 * freeze. This never inserts a `cvs` row and never calls `importCvSnapshot`
 * — the frozen copy lives only in `applications.cv_snapshot`, a column on
 * the application itself; the original CV in the `cvs` table is untouched
 * and stays fully live/editable.
 */
export async function setApplicationStatus(
  store: ApplicationStore,
  persona: PersonaData,
  inventory: InventoryStore,
  applicationId: string,
  next: ApplicationStatus,
  note?: string
): Promise<DbApplication> {
  const current = findApplication(store, applicationId)
  if (!current) {
    throw new Error(`No application "${applicationId}".`)
  }

  let snapshotPatch: { cv_snapshot: Json } | Record<string, never> = {}

  if (current.status === "draft" && next !== "draft") {
    if (!current.cvId) {
      throw new Error("Cannot leave draft without an attached CV.")
    }

    const resolved = resolveCv(persona, inventory, current.cvId)
    if (!resolved) {
      throw new Error(`Attached CV "${current.cvId}" no longer exists.`)
    }

    const snapshot = buildCvSnapshot(resolved.cv, resolved.document, resolved.template)
    snapshotPatch = { cv_snapshot: snapshot as unknown as Json }
  }

  const { data, error } = await supabase
    .from("applications")
    .update({
      status: next,
      ...snapshotPatch,
    })
    .eq("id", applicationId)
    .select()
    .single()

  if (error) throw error

  const updated = mapApplicationRow(data)

  const { data: historyRow, error: historyError } = await supabase
    .from("application_status_history")
    .insert({
      application_id: applicationId,
      status: next,
      note: note ?? null,
    })
    .select()
    .single()

  if (historyError) throw historyError

  const history = mapApplicationStatusHistoryRow(historyRow)

  store.setApplications((currentApplications) =>
    currentApplications.map((existing) =>
      existing.id === applicationId ? updated : existing
    )
  )
  store.setApplicationStatusHistory((currentHistory) => [...currentHistory, history])

  return updated
}
