import type { InventoryStore } from "@/lib/inventory-store"
import { buildResumeDocument, requireUserId, type PersonaData, type ResumeDocument } from "@/lib/persona"
import { cvTemplates, findTemplate, type CvTemplate } from "@/lib/cv-templates"
import { templateFromSnapshot, type CvSnapshotV1 } from "@/lib/cv-snapshot"
import { bakeTemplateSettings } from "@/lib/cv-template-bake"
import { mapCvRow, mapCvTemplateRow, type PersonaStore } from "@/lib/persona-store"
import { supabase } from "@/lib/supabase"
import type { Json } from "@/lib/database.types"
import type { PageConfig, TemplateDefinition, TemplateSettings } from "@/lib/cv-template-schema"
import type { CvPersonaSettings, DbCv, DbCvTemplate, FieldVisibility, ItemKind } from "@/mocks/types"

/**
 * The CV layer — a saved (Persona, Template) pairing. See
 * `docs/specs/06-persona-cv-split.md`. Selectors, the New/Edit/Duplicate/
 * Delete/Favorite mutators, the Visibility tab's per-CV field-visibility
 * mutators (moved off `personas` in Batch 3, docs/user-request.md — see
 * `mocks/types.ts`'s `FieldVisibility`/`CvPersonaSettings` doc comments), and
 * the Style/Page/Block-Settings tabs' per-CV override mutators.
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

// ---------------------------------------------------------------------------
// Mutators — the Visibility tab's per-CV field visibility
// ---------------------------------------------------------------------------

async function saveCvPersonaSettings(
  store: PersonaStore,
  cvId: string,
  next: CvPersonaSettings
): Promise<void> {
  const { data, error } = await supabase
    .from("cvs")
    .update({ persona_settings: next as unknown as Json })
    .eq("id", cvId)
    .select()
    .single()

  if (error) throw error

  const updated = mapCvRow(data)
  store.setCvs((current) =>
    current.map((existing) => (existing.id === cvId ? updated : existing))
  )
}

/** Merges a `fieldVisibility` patch for one kind and saves the whole map. */
async function saveKindVisibility(
  store: PersonaStore,
  cvId: string,
  kind: ItemKind,
  patch: { hidden?: boolean; fields?: string[]; items?: Record<string, boolean> }
): Promise<void> {
  const cv = findCv(store, cvId)
  if (!cv) {
    throw new Error(`No CV "${cvId}".`)
  }

  const fieldVisibility = cv.personaSettings.fieldVisibility ?? {}
  const nextFieldVisibility: FieldVisibility = {
    ...fieldVisibility,
    [kind]: { ...fieldVisibility[kind], ...patch },
  }

  await saveCvPersonaSettings(store, cvId, {
    ...cv.personaSettings,
    fieldVisibility: nextFieldVisibility,
  })
}

/** Hides (or reveals) an entire kind, for this CV only. */
export async function setKindHidden(
  store: PersonaStore,
  cvId: string,
  kind: ItemKind,
  hidden: boolean
): Promise<void> {
  await saveKindVisibility(store, cvId, kind, { hidden })
}

/** Hides (or reveals) one field of a kind — e.g. Work's "Company name" — for this CV only. */
export async function setFieldHidden(
  store: PersonaStore,
  cvId: string,
  kind: ItemKind,
  fieldKey: string,
  hidden: boolean
): Promise<void> {
  const cv = findCv(store, cvId)
  if (!cv) {
    throw new Error(`No CV "${cvId}".`)
  }

  const fields = new Set(cv.personaSettings.fieldVisibility?.[kind]?.fields ?? [])
  if (hidden) {
    fields.add(fieldKey)
  } else {
    fields.delete(fieldKey)
  }

  await saveKindVisibility(store, cvId, kind, { fields: [...fields] })
}

/**
 * Hides (or reveals) one already-selected entry — e.g. one Skill, one Social
 * link, one Work entry — without touching its `persona_items`/`persona_lines`
 * selection, and without touching the Persona at all. See
 * `FieldVisibility.items`'s doc comment (`mocks/types.ts`) for why.
 */
export async function setItemHidden(
  store: PersonaStore,
  cvId: string,
  kind: ItemKind,
  itemId: string,
  hidden: boolean
): Promise<void> {
  const cv = findCv(store, cvId)
  if (!cv) {
    throw new Error(`No CV "${cvId}".`)
  }

  const items = { ...cv.personaSettings.fieldVisibility?.[kind]?.items }
  if (hidden) {
    items[itemId] = true
  } else {
    delete items[itemId]
  }

  await saveKindVisibility(store, cvId, kind, { items })
}

// ---------------------------------------------------------------------------
// Mutators — the Style tab's per-CV overrides
// ---------------------------------------------------------------------------

async function saveCvTemplateSettings(
  store: PersonaStore,
  cvId: string,
  next: TemplateSettings
): Promise<void> {
  const { data, error } = await supabase
    .from("cvs")
    .update({ template_settings: next as unknown as Json })
    .eq("id", cvId)
    .select()
    .single()

  if (error) throw error

  const updated = mapCvRow(data)
  store.setCvs((current) =>
    current.map((existing) => (existing.id === cvId ? updated : existing))
  )
}

/**
 * Sets one property on one named style, for this CV only — e.g. Classic's
 * `headerName.fontSize`. Shallow-merged onto the template's own style at
 * render time (`cv-template-core.ts`'s `resolveStyleObject`), so this writes
 * only the override, never the template's base value.
 */
export async function setCvStyleProperty(
  store: PersonaStore,
  cvId: string,
  styleName: string,
  key: string,
  value: string | number
): Promise<void> {
  const cv = findCv(store, cvId)
  if (!cv) {
    throw new Error(`No CV "${cvId}".`)
  }

  const nextStyles = {
    ...cv.templateSettings.styles,
    [styleName]: { ...cv.templateSettings.styles?.[styleName], [key]: value },
  }

  await saveCvTemplateSettings(store, cvId, { ...cv.templateSettings, styles: nextStyles })
}

/** Clears one property override, reverting it to the template's own value. */
export async function resetCvStyleProperty(
  store: PersonaStore,
  cvId: string,
  styleName: string,
  key: string
): Promise<void> {
  const cv = findCv(store, cvId)
  if (!cv) {
    throw new Error(`No CV "${cvId}".`)
  }

  const nextStyle = { ...cv.templateSettings.styles?.[styleName] }
  delete nextStyle[key]

  const nextStyles = { ...cv.templateSettings.styles, [styleName]: nextStyle }

  await saveCvTemplateSettings(store, cvId, { ...cv.templateSettings, styles: nextStyles })
}

/**
 * Sets one property on the template's page config, for this CV only — e.g.
 * margin or paper size. Same shallow-merge-onto-the-template-base idea as
 * `setCvStyleProperty`, applied to `TemplateDefinition.page` instead of a
 * named style — see `TemplateNodeRenderer`'s `page` merge.
 */
export async function setCvPageProperty(
  store: PersonaStore,
  cvId: string,
  key: keyof PageConfig,
  value: string | number
): Promise<void> {
  const cv = findCv(store, cvId)
  if (!cv) {
    throw new Error(`No CV "${cvId}".`)
  }

  const nextPage = { ...cv.templateSettings.page, [key]: value }

  await saveCvTemplateSettings(store, cvId, { ...cv.templateSettings, page: nextPage })
}

/** Clears one page property override, reverting it to the template's own value. */
export async function resetCvPageProperty(
  store: PersonaStore,
  cvId: string,
  key: keyof PageConfig
): Promise<void> {
  const cv = findCv(store, cvId)
  if (!cv) {
    throw new Error(`No CV "${cvId}".`)
  }

  const nextPage = { ...cv.templateSettings.page }
  delete nextPage[key]

  await saveCvTemplateSettings(store, cvId, { ...cv.templateSettings, page: nextPage })
}

// ---------------------------------------------------------------------------
// Mutators — the Block Settings tab's per-CV, per-node-id overrides
// ---------------------------------------------------------------------------

/**
 * Sets one property (`hidden`/`styles`/`text`) on one addressable node, for
 * this CV only — e.g. Classic's `bulletMarker` node's `text`. Node ids are
 * authored into the template itself (`TemplateNode.id`); see
 * `TemplateNodeRenderer`'s `nodeOverride`/`applyNodeOverride` for how this
 * shallow-merges onto that node at render time.
 */
export async function setCvNodeOverride(
  store: PersonaStore,
  cvId: string,
  nodeId: string,
  patch: { hidden?: boolean; styles?: string | string[]; text?: string }
): Promise<void> {
  const cv = findCv(store, cvId)
  if (!cv) {
    throw new Error(`No CV "${cvId}".`)
  }

  const nextNodes = {
    ...cv.templateSettings.nodes,
    [nodeId]: { ...cv.templateSettings.nodes?.[nodeId], ...patch },
  }

  await saveCvTemplateSettings(store, cvId, { ...cv.templateSettings, nodes: nextNodes })
}

/** Clears one property override on a node, reverting it to the template's own value. */
export async function resetCvNodeOverride(
  store: PersonaStore,
  cvId: string,
  nodeId: string,
  key: "hidden" | "styles" | "text"
): Promise<void> {
  const cv = findCv(store, cvId)
  if (!cv) {
    throw new Error(`No CV "${cvId}".`)
  }

  const nextNode = { ...cv.templateSettings.nodes?.[nodeId] }
  delete nextNode[key]

  const nextNodes = { ...cv.templateSettings.nodes, [nodeId]: nextNode }

  await saveCvTemplateSettings(store, cvId, { ...cv.templateSettings, nodes: nextNodes })
}

// ---------------------------------------------------------------------------
// "Save as new template" — see docs/specs/13-save-as-new-template.md
// ---------------------------------------------------------------------------

export type SaveAsNewTemplateFields = {
  name: string
  description: string
}

/**
 * Bakes `cv`'s current `template_settings` onto `base`'s definition and
 * inserts the result as a new, standalone `cv_templates` row. Does not
 * modify `cv` itself — it stays on its original base template id with its
 * own `template_settings` intact, still further editable.
 */
export async function saveAsNewTemplate(
  store: PersonaStore,
  cv: DbCv,
  base: CvTemplate,
  fields: SaveAsNewTemplateFields
): Promise<DbCvTemplate> {
  const userId = requireUserId(store)
  const baked = bakeTemplateSettings(base.definition, cv.templateSettings)
  const definition: TemplateDefinition = {
    ...baked,
    id: crypto.randomUUID(),
    name: fields.name,
    description: fields.description,
    density: "Balanced",
    atsSafe: false,
    bestFor: "",
  }

  const { data, error } = await supabase
    .from("cv_templates")
    .insert({
      user_id: userId,
      name: fields.name,
      description: fields.description,
      schema_version: definition.schemaVersion,
      definition: definition as unknown as Json,
    })
    .select()
    .single()

  if (error) throw error

  const saved = mapCvTemplateRow(data)
  store.setCvTemplates((current) => [...current, saved])

  return saved
}
