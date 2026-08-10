import type { InventoryStore } from "@/lib/inventory-store"
import type { PersonaData } from "@/lib/persona-store"
import { resolveCv } from "@/lib/cv"
import { buildCvSnapshot, templateFromSnapshot, type CvSnapshotV1 } from "@/lib/cv-snapshot"
import type { CvTemplate } from "@/lib/cv-templates"
import type { ResumeDocument } from "@/lib/resume-document"
import {
  mapApplicationRow,
  type ApplicationData,
  type ApplicationStore,
} from "@/lib/application-store"
import { supabase } from "@/lib/supabase"
import type { Json } from "@/lib/database.types"
import type {
  ApplicationJobType,
  ApplicationWorkType,
  DbApplication,
  DbCv,
  GlobalApplicationStatus,
} from "@/mocks/types"

/**
 * The Applications layer — job tracker built on top of the CV snapshot
 * format. See docs/specs/10-applications-tracking.md. Selectors, the New/
 * Edit/Delete mutators, and `setGlobalApplicationStatus` — the freeze mutator
 * that writes a `CvSnapshotV1` to `applications.cv_snapshot` once, on the
 * first transition away from `draft`, and never touches it again afterward.
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
 * Everything the `/applications/:id/cv` route needs to render the CV
 * attached to one application. Prefers `cvSnapshot` (frozen, once status has
 * left `draft`) over `cvId` (still live, while in `draft`) — see spec 10's
 * "The freeze". The `kind` discriminant tells the caller how to re-export:
 * a frozen CV's `snapshot` is already a complete `CvSnapshotV1` and can be
 * downloaded as-is, while a live CV's document/template must still be run
 * through `buildCvSnapshot`.
 */
export type ResolvedApplicationCv =
  | { kind: "frozen"; snapshot: CvSnapshotV1; document: ResumeDocument; template: CvTemplate }
  | { kind: "live"; cv: DbCv; document: ResumeDocument; template: CvTemplate }

export function resolveApplicationCv(
  application: DbApplication,
  persona: PersonaData,
  inventory: InventoryStore
): ResolvedApplicationCv | undefined {
  if (application.cvSnapshot) {
    return {
      kind: "frozen",
      snapshot: application.cvSnapshot,
      document: application.cvSnapshot.document,
      template: templateFromSnapshot(application.cvSnapshot),
    }
  }

  if (application.cvId) {
    const resolved = resolveCv(persona, inventory, application.cvId)
    if (resolved) {
      return { kind: "live", cv: resolved.cv, document: resolved.document, template: resolved.template }
    }
  }

  return undefined
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
  company?: string | null
  position?: string | null
  location?: string | null
  jobType?: ApplicationJobType | null
  workType?: ApplicationWorkType | null
  deadline?: string | null
  sourceUrl?: string | null
  vacancyDetail?: string | null
  coverLetter?: string | null
  applyVia?: string | null
  cvId?: string | null
  note?: string | null
  tags?: string[]
}

/**
 * Creates a new application in `draft`. There's no longer a bootstrap
 * history row to insert alongside it — the timeline is now `stages`, which
 * correctly starts empty until the user adds the first one, rather than a
 * flat status log that needed a real starting point.
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
      company: fields.company ?? null,
      position: fields.position ?? null,
      location: fields.location ?? null,
      job_type: fields.jobType ?? null,
      work_type: fields.workType ?? null,
      deadline: fields.deadline ?? null,
      source_url: fields.sourceUrl ?? null,
      vacancy_detail: fields.vacancyDetail ?? null,
      cover_letter: fields.coverLetter ?? null,
      apply_via: fields.applyVia ?? null,
      cv_id: fields.cvId ?? null,
      note: fields.note ?? null,
      tags: fields.tags ?? [],
      global_status: "draft",
    })
    .select()
    .single()

  if (error) throw error

  const application = mapApplicationRow(data)

  store.setApplications((current) => [...current, application])

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
      ...(patch.company !== undefined ? { company: patch.company } : {}),
      ...(patch.position !== undefined ? { position: patch.position } : {}),
      ...(patch.location !== undefined ? { location: patch.location } : {}),
      ...(patch.jobType !== undefined ? { job_type: patch.jobType } : {}),
      ...(patch.workType !== undefined ? { work_type: patch.workType } : {}),
      ...(patch.deadline !== undefined ? { deadline: patch.deadline } : {}),
      ...(patch.sourceUrl !== undefined ? { source_url: patch.sourceUrl } : {}),
      ...(patch.vacancyDetail !== undefined
        ? { vacancy_detail: patch.vacancyDetail }
        : {}),
      ...(patch.coverLetter !== undefined ? { cover_letter: patch.coverLetter } : {}),
      ...(patch.applyVia !== undefined ? { apply_via: patch.applyVia } : {}),
      ...(patch.cvId !== undefined ? { cv_id: patch.cvId } : {}),
      ...(patch.note !== undefined ? { note: patch.note } : {}),
      ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
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

/** Deletes an application. `application_stages` cascades via FK. */
export async function deleteApplication(
  store: ApplicationStore,
  applicationId: string
): Promise<void> {
  const { error } = await supabase.from("applications").delete().eq("id", applicationId)
  if (error) throw error

  store.setApplications((current) =>
    current.filter((application) => application.id !== applicationId)
  )
  store.setApplicationStages((current) =>
    current.filter((stage) => stage.applicationId !== applicationId)
  )
}

// ---------------------------------------------------------------------------
// Mutator — status changes + the freeze
// ---------------------------------------------------------------------------

/**
 * Moves an application to a new `global_status`.
 *
 * The freeze: on the *first* transition away from `draft` (i.e.
 * `current.globalStatus === "draft" && next !== "draft"`), this resolves the
 * attached CV (live or already-frozen) via `resolveCv` and writes a fresh
 * `CvSnapshotV1` to `applications.cv_snapshot` — "one honest record of what
 * was actually sent." Every later status change — including bouncing back
 * through `draft` again — leaves `cv_snapshot` completely untouched: the
 * `cv_snapshot` key is simply omitted from the update payload whenever
 * `current.globalStatus !== "draft"`, so nothing ever overwrites the
 * original freeze. This never inserts a `cvs` row and never calls
 * `importCvSnapshot` — the frozen copy lives only in
 * `applications.cv_snapshot`, a column on the application itself; the
 * original CV in the `cvs` table is untouched and stays fully live/editable.
 */
export async function setGlobalApplicationStatus(
  store: ApplicationStore,
  persona: PersonaData,
  inventory: InventoryStore,
  applicationId: string,
  next: GlobalApplicationStatus,
  note?: string
): Promise<DbApplication> {
  // Kept for call-site signature parity; there's no history table left to
  // log it to, so it's intentionally a no-op.
  void note

  const current = findApplication(store, applicationId)
  if (!current) {
    throw new Error(`No application "${applicationId}".`)
  }

  let snapshotPatch: { cv_snapshot: Json } | Record<string, never> = {}

  if (current.globalStatus === "draft" && next !== "draft") {
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
      global_status: next,
      ...snapshotPatch,
    })
    .eq("id", applicationId)
    .select()
    .single()

  if (error) throw error

  const updated = mapApplicationRow(data)

  store.setApplications((currentApplications) =>
    currentApplications.map((existing) =>
      existing.id === applicationId ? updated : existing
    )
  )

  return updated
}
