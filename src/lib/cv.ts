import type { InventoryStore } from "@/lib/inventory-store"
import { buildResumeDocument, requireUserId, type PersonaData, type ResumeDocument } from "@/lib/persona"
import { cvTemplates, findTemplate, type CvTemplate } from "@/lib/cv-templates"
import { templateFromSnapshot, type CvSnapshotV1 } from "@/lib/cv-snapshot"
import { mapCvRow, type PersonaStore } from "@/lib/persona-store"
import { supabase } from "@/lib/supabase"
import type { Json } from "@/lib/database.types"
import type { DbCv } from "@/mocks/types"

/**
 * The CV layer — a saved (Persona, Template) pairing. See
 * `docs/specs/06-persona-cv-split.md`.
 *
 * TRANSITIONAL (docs/specs/15-cv-embedded-in-applications.md /
 * docs/plans/17-cv-embedded-in-applications.md): the `cvs` table, `DbCv`,
 * and `PersonaStore.setCvs`/`mapCvRow` are already gone (Phase 2). This file
 * currently fails to typecheck as a result — it survives only because
 * several not-yet-migrated UI files (`cv-list-panel.tsx`, `cv-form-dialog.tsx`,
 * `personas.tsx`, `persona-field-tree.tsx`, `application-list-panel.tsx`,
 * `application-kanban-panel.tsx`, `application-detail-view.tsx`, `cv-print.tsx`,
 * `persona-detail.tsx`, `pages/application-detail.tsx`) still import from it;
 * deleting it now would break those imports before their own phase lands.
 * The Visibility/Style/Page/Block-Settings per-CV override mutators and
 * "Save as new template" have already moved to `lib/application.ts`,
 * retargeted at `applications`. This whole file is deleted in Phase 6 once
 * every remaining importer above has been migrated off it.
 */

export function allCvs(data: PersonaData): DbCv[] {
  return data.cvs
}

export function findCv(data: PersonaData, cvId: string): DbCv | undefined {
  return data.cvs.find((cv) => cv.id === cvId)
}

/**
 * Everything a print/preview page needs for one saved CV: the row itself,
 * its Persona resolved into a renderable document, and its Template. One
 * place to compose these instead of every call site doing it separately.
 */
export function resolveCv(
  persona: PersonaData,
  inventory: InventoryStore,
  cvId: string
): { cv: DbCv; document: ResumeDocument; template: CvTemplate } | undefined {
  const cv = findCv(persona, cvId)
  if (!cv) {
    return undefined
  }

  if (cv.snapshot) {
    return {
      cv,
      document: cv.snapshot.document,
      template: templateFromSnapshot(cv.snapshot),
    }
  }

  if (!cv.personaId) {
    throw new Error(`CV "${cvId}" is neither live nor frozen — data integrity violation.`)
  }

  const document = buildResumeDocument(
    persona,
    inventory,
    cv.personaId,
    cv.personaSettings.fieldVisibility ?? {}
  )
  const template =
    findTemplate(cv.templateId ?? "", persona.cvTemplates) ?? cvTemplates[0]

  return { cv, document, template }
}

// ---------------------------------------------------------------------------
// Mutators — New/Edit/Duplicate/Delete/Favorite
// ---------------------------------------------------------------------------

export type CvFormFields = {
  name: string
  personaId: string
  templateId: string
  note: string | null
  tags: string[]
}

/** Creates a new CV and returns it. */
export async function createCv(
  store: PersonaStore,
  fields: CvFormFields
): Promise<DbCv> {
  const userId = requireUserId(store)

  const { data, error } = await supabase
    .from("cvs")
    .insert({
      user_id: userId,
      name: fields.name,
      persona_id: fields.personaId,
      template_id: fields.templateId,
      note: fields.note,
      tags: fields.tags,
    })
    .select()
    .single()

  if (error) throw error

  const cv = mapCvRow(data)
  store.setCvs((current) => [...current, cv])

  return cv
}

/** Renames a CV, or updates its persona/template/note/tags, and returns the updated row. */
export async function updateCv(
  store: PersonaStore,
  cvId: string,
  patch: Partial<CvFormFields>
): Promise<DbCv> {
  const { data, error } = await supabase
    .from("cvs")
    .update({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.personaId !== undefined ? { persona_id: patch.personaId } : {}),
      ...(patch.templateId !== undefined ? { template_id: patch.templateId } : {}),
      ...(patch.note !== undefined ? { note: patch.note } : {}),
      ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
    })
    .eq("id", cvId)
    .select()
    .single()

  if (error) throw error

  const updated = mapCvRow(data)
  store.setCvs((current) =>
    current.map((existing) => (existing.id === cvId ? updated : existing))
  )

  return updated
}

/** Flips a CV's favourite flag and returns its new value. */
export async function toggleCvFavorite(
  store: PersonaStore,
  cvId: string
): Promise<boolean> {
  const cv = findCv(store, cvId)
  if (!cv) {
    throw new Error(`No CV "${cvId}".`)
  }

  const { data, error } = await supabase
    .from("cvs")
    .update({ favorite: !cv.favorite })
    .eq("id", cvId)
    .select()
    .single()

  if (error) throw error

  const updated = mapCvRow(data)
  store.setCvs((current) =>
    current.map((existing) => (existing.id === cvId ? updated : existing))
  )

  return updated.favorite
}

/**
 * Copies a CV's persona/template pairing and style/page overrides into a new
 * CV under `fields`. Unlike `duplicatePersona`, a CV has no child rows of its
 * own — its content lives on the Persona it points at — so this is a single
 * insert.
 */
export async function duplicateCv(
  store: PersonaStore,
  cvId: string,
  fields: CvFormFields
): Promise<DbCv> {
  const userId = requireUserId(store)
  const source = findCv(store, cvId)
  if (!source) {
    throw new Error(`No CV "${cvId}".`)
  }

  const { data, error } = await supabase
    .from("cvs")
    .insert({
      user_id: userId,
      name: fields.name,
      persona_id: fields.personaId,
      template_id: fields.templateId,
      note: fields.note,
      tags: fields.tags,
      template_settings: source.templateSettings as unknown as Json,
      persona_settings: source.personaSettings as unknown as Json,
    })
    .select()
    .single()

  if (error) throw error

  const duplicated = mapCvRow(data)
  store.setCvs((current) => [...current, duplicated])

  return duplicated
}

/**
 * Imports a `CvSnapshotV1` (from an exported file) as a new, frozen CV — no
 * Persona, no Template lookup, content is read-only. See
 * docs/specs/09-cv-export-import.md's "Import" section.
 */
export async function importCvSnapshot(
  store: PersonaStore,
  snapshot: CvSnapshotV1
): Promise<DbCv> {
  const userId = requireUserId(store)

  const { data, error } = await supabase
    .from("cvs")
    .insert({
      user_id: userId,
      name: snapshot.name,
      note: snapshot.note,
      tags: snapshot.tags,
      persona_id: null,
      template_id: snapshot.template.id,
      template_settings: snapshot.templateSettings as unknown as Json,
      snapshot: snapshot as unknown as Json,
    })
    .select()
    .single()

  if (error) throw error

  const cv = mapCvRow(data)
  store.setCvs((current) => [...current, cv])

  return cv
}

/** Deletes a CV. Nothing else references a CV's id, so no other rows to clean up. */
export async function deleteCv(store: PersonaStore, cvId: string): Promise<void> {
  const { error } = await supabase.from("cvs").delete().eq("id", cvId)
  if (error) throw error

  store.setCvs((current) => current.filter((row) => row.id !== cvId))
}
