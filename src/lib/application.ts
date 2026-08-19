import type { InventoryStore } from "@/lib/inventory-store"
import { buildResumeDocument, requireUserId as requirePersonaUserId } from "@/lib/persona"
import type { PersonaData, PersonaStore } from "@/lib/persona-store"
import { mapCvTemplateRow } from "@/lib/persona-store"
import { buildCvSnapshot, templateFromSnapshot, type CvSnapshotV1 } from "@/lib/cv-snapshot"
import { cvTemplates, findTemplate, type CvTemplate } from "@/lib/cv-templates"
import { bakeTemplateSettings } from "@/lib/cv-template-bake"
import type { ResumeDocument } from "@/lib/resume-document"
import { findMissingSkills, skillTitlesOf } from "@/lib/skill-check"
import {
  mapApplicationRow,
  type ApplicationData,
  type ApplicationStore,
} from "@/lib/application-store"
import { supabase } from "@/lib/supabase"
import type { Json } from "@/lib/database.types"
import type { PageConfig, TemplateDefinition, TemplateSettings } from "@/lib/cv-template-schema"
import type {
  ApplicationJobType,
  ApplicationWorkType,
  CvPersonaSettings,
  DbApplication,
  DbCvTemplate,
  FieldVisibility,
  GlobalApplicationStatus,
  ItemKind,
} from "@/mocks/types"

/**
 * The Applications layer — job tracker built on top of the CV snapshot
 * format. See docs/specs/10-applications-tracking.md and
 * docs/specs/15-cv-embedded-in-applications.md. Selectors, the New/Edit/
 * Delete mutators, `setGlobalApplicationStatus` — the freeze mutator that
 * writes a `CvSnapshotV1` to `applications.cv_snapshot` once, on the first
 * transition away from `draft`, and never touches it again afterward — plus
 * (since spec 15) the CV config living directly on the application: the
 * lazy-setup mutator, the "copy CV settings" mutator, the Visibility/Style/
 * Page/Block-Settings tabs' per-application override mutators (formerly
 * `lib/cv.ts`, keyed by `cvId` against the now-gone `cvs` table), and
 * "Save as new template".
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
 * Existing applications (active or archived — `data.applications` holds
 * both) that share the same Company as the given value. Used to warn about
 * likely duplicates without blocking creation — see spec's
 * duplication-detect note. Runs both at create time and on demand (the
 * detail view's "Check for duplicates" button). Company must be present and
 * matches case-insensitively; a blank Company never matches anything.
 * `excludeId` leaves out the application being checked itself, for the
 * on-demand case where it already exists in `data.applications`.
 */
export function findSimilarApplications(
  data: ApplicationData,
  company: string | null | undefined,
  excludeId?: string
): DbApplication[] {
  const needleCompany = company?.trim().toLowerCase()

  if (!needleCompany) return []

  return data.applications.filter(
    (application) =>
      application.id !== excludeId &&
      application.company?.trim().toLowerCase() === needleCompany
  )
}

/**
 * Everything the `/applications/:id/cv` route needs to render the CV
 * attached to one application. Prefers `cvSnapshot` (frozen, once status has
 * left `draft`) over the application's own live `cvPersonaId`/`cvTemplateId`
 * (still unset or live, while in `draft`) — see spec 10's "The freeze". The
 * `kind` discriminant tells the caller how to re-export: a frozen CV's
 * `snapshot` is already a complete `CvSnapshotV1` and can be downloaded
 * as-is, while a live CV's document/template must still be run through
 * `buildCvSnapshot`. The `live` variant carries no `application`/`cv` copy —
 * every call site already has the `application` it passed in.
 */
export type ResolvedApplicationCv =
  | { kind: "frozen"; snapshot: CvSnapshotV1; document: ResumeDocument; template: CvTemplate }
  | { kind: "live"; document: ResumeDocument; template: CvTemplate }

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

  if (application.cvPersonaId && application.cvTemplateId) {
    const document = buildResumeDocument(
      persona,
      inventory,
      application.cvPersonaId,
      application.cvPersonaSettings.fieldVisibility ?? {}
    )
    const template =
      findTemplate(application.cvTemplateId, persona.cvTemplates) ?? cvTemplates[0]

    return { kind: "live", document, template }
  }

  return undefined
}

export type SkillsCheckResult =
  | { status: "no-cv" }
  | { status: "no-required-skills" }
  | { status: "checked"; missing: string[] }

export type HeadlineCheckResult =
  | { status: "no-cv" }
  | { status: "no-headline" }
  | { status: "no-position" }
  | { status: "match"; headline: string; position: string }
  | { status: "mismatch"; headline: string; position: string }

export type ApplicationCheckResult = {
  duplicates: DbApplication[]
  skills: SkillsCheckResult
  headline: HeadlineCheckResult
}

/**
 * The detail view's "Check" button — runs all three on-demand checks in one
 * pass: duplicate Company matches (`findSimilarApplications`), missing
 * skills against the already-saved `requiredSkillsInput` (this doesn't
 * prompt for new input — that's still `SkillsCheckDialog`'s job, reachable
 * via "Check skills"), and whether `position` matches the attached CV's
 * `headline`.
 */
export function checkApplication(
  data: ApplicationData,
  application: DbApplication,
  resolvedCv: ResolvedApplicationCv | undefined
): ApplicationCheckResult {
  const duplicates = findSimilarApplications(data, application.company, application.id)

  const skills: SkillsCheckResult = !resolvedCv
    ? { status: "no-cv" }
    : !application.requiredSkillsInput?.trim()
      ? { status: "no-required-skills" }
      : {
          status: "checked",
          missing: findMissingSkills(
            application.requiredSkillsInput,
            skillTitlesOf(resolvedCv.document)
          ),
        }

  const headline: HeadlineCheckResult = !resolvedCv
    ? { status: "no-cv" }
    : (() => {
        const headlineValue = resolvedCv.document.headline?.trim()
        if (!headlineValue) return { status: "no-headline" }

        const position = application.position?.trim()
        if (!position) return { status: "no-position" }

        return position.toLowerCase() === headlineValue.toLowerCase()
          ? { status: "match", headline: headlineValue, position }
          : { status: "mismatch", headline: headlineValue, position }
      })()

  return { duplicates, skills, headline }
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
  /** Lazy CV setup / "copy CV settings" — never a general form field on the New/Edit dialog. */
  cvPersonaId?: string | null
  cvTemplateId?: string | null
  /** Written only by `copyApplicationCvSettings` — see its doc comment. */
  cvPersonaSettings?: CvPersonaSettings
  cvTemplateSettings?: TemplateSettings
  note?: string | null
  tags?: string[]
  requiredSkillsInput?: string | null
  missingSkills?: string[] | null
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
      cv_persona_id: fields.cvPersonaId ?? null,
      cv_template_id: fields.cvTemplateId ?? null,
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
      ...(patch.cvPersonaId !== undefined ? { cv_persona_id: patch.cvPersonaId } : {}),
      ...(patch.cvTemplateId !== undefined ? { cv_template_id: patch.cvTemplateId } : {}),
      ...(patch.cvPersonaSettings !== undefined
        ? { cv_persona_settings: patch.cvPersonaSettings as unknown as Json }
        : {}),
      ...(patch.cvTemplateSettings !== undefined
        ? { cv_template_settings: patch.cvTemplateSettings as unknown as Json }
        : {}),
      ...(patch.note !== undefined ? { note: patch.note } : {}),
      ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
      ...(patch.requiredSkillsInput !== undefined
        ? { required_skills_input: patch.requiredSkillsInput }
        : {}),
      ...(patch.missingSkills !== undefined ? { missing_skills: patch.missingSkills } : {}),
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

/** Archives an application (soft-hide from the list, until restored). */
export async function archiveApplication(
  store: ApplicationStore,
  applicationId: string
): Promise<DbApplication> {
  const { data, error } = await supabase
    .from("applications")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", applicationId)
    .select()
    .single()

  if (error) throw error

  const updated = mapApplicationRow(data)
  store.setApplications((current) =>
    current.map((a) => (a.id === applicationId ? updated : a))
  )

  return updated
}

/** Restores a previously archived application. */
export async function restoreApplication(
  store: ApplicationStore,
  applicationId: string
): Promise<DbApplication> {
  const { data, error } = await supabase
    .from("applications")
    .update({ archived_at: null })
    .eq("id", applicationId)
    .select()
    .single()

  if (error) throw error

  const updated = mapApplicationRow(data)
  store.setApplications((current) =>
    current.map((a) => (a.id === applicationId ? updated : a))
  )

  return updated
}

// ---------------------------------------------------------------------------
// Mutators — lazy CV setup + "copy CV settings" (spec 15)
// ---------------------------------------------------------------------------

/**
 * Sets the Persona + Template for an application — both the CV tab's
 * initial lazy setup and its later "change template" selects go through
 * here. A thin wrapper over `updateApplication`, except: whenever `templateId`
 * actually *changes* (initial setup counts — there's no prior template),
 * `cvPersonaSettings.fieldVisibility` is reset to the new template's
 * `defaultFieldVisibility` (or `{}` if it has none), replacing whatever was
 * there — each template's field visibility is its own starting point, so
 * switching to Classic after Classic (Compact Experience) un-hides what the
 * latter hid. Picking the *same* template again, or only changing the
 * Persona, leaves visibility untouched.
 */
export async function setApplicationCvBase(
  store: ApplicationStore,
  applicationId: string,
  personaId: string,
  templateId: string,
  templateDefaultFieldVisibility?: FieldVisibility
): Promise<DbApplication> {
  const application = findApplication(store, applicationId)
  const templateChanged = templateId !== application?.cvTemplateId

  return updateApplication(store, applicationId, {
    cvPersonaId: personaId,
    cvTemplateId: templateId,
    ...(templateChanged
      ? { cvPersonaSettings: { fieldVisibility: templateDefaultFieldVisibility ?? {} } }
      : {}),
  })
}

/**
 * The reworked Import (spec 15): copies a source application's CV
 * config — `cvPersonaId`, `cvTemplateId`, `cvPersonaSettings`,
 * `cvTemplateSettings` — onto a target application. Settings only, never
 * baked-in content: the target keeps resolving its document live off
 * whichever persona ends up set. The source just needs a CV configured
 * (`cvPersonaId`/`cvTemplateId` set) — freezing never clears those fields
 * (see `setGlobalApplicationStatus`'s doc comment), so a frozen source's
 * config is just as valid to copy from as a live one.
 */
export async function copyApplicationCvSettings(
  store: ApplicationStore,
  sourceApplicationId: string,
  targetApplicationId: string
): Promise<DbApplication> {
  const source = findApplication(store, sourceApplicationId)
  if (!source) {
    throw new Error(`No application "${sourceApplicationId}".`)
  }
  if (!source.cvPersonaId || !source.cvTemplateId) {
    throw new Error("Source application has no CV configured.")
  }

  return updateApplication(store, targetApplicationId, {
    cvPersonaId: source.cvPersonaId,
    cvTemplateId: source.cvTemplateId,
    cvPersonaSettings: source.cvPersonaSettings,
    cvTemplateSettings: source.cvTemplateSettings,
  })
}

// ---------------------------------------------------------------------------
// Mutator — status changes + the freeze
// ---------------------------------------------------------------------------

/**
 * Moves an application to a new `global_status`.
 *
 * The freeze: on the *first* transition away from `draft` (i.e.
 * `current.globalStatus === "draft" && next !== "draft"`), this builds the
 * document/template live from the application's own `cvPersonaId`/
 * `cvTemplateId`/`cvPersonaSettings` and writes a fresh `CvSnapshotV1` to
 * `applications.cv_snapshot` — "one honest record of what was actually
 * sent." Every later status change — including bouncing back through
 * `draft` again — leaves `cv_snapshot` completely untouched: the
 * `cv_snapshot` key is simply omitted from the update payload whenever
 * `current.globalStatus !== "draft"`, so nothing ever overwrites the
 * original freeze. `cvPersonaId`/`cvTemplateId`/`cvPersonaSettings`/
 * `cvTemplateSettings` are never cleared by freezing — they stay a
 * permanent record of which persona/template/settings produced the
 * snapshot (see spec 15's "Used in Applications").
 *
 * The same freeze also stamps `applied_at` once, the dashboard's source of
 * truth for "the day this application was actually applied to" — there's no
 * status-change history table to derive it from otherwise (see
 * `applied_at`'s migration).
 */
export async function setGlobalApplicationStatus(
  store: ApplicationStore,
  persona: PersonaStore,
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

  let snapshotPatch:
    | { cv_snapshot: Json; applied_at: string }
    | Record<string, never> = {}

  if (current.globalStatus === "draft" && next !== "draft") {
    if (!current.cvPersonaId || !current.cvTemplateId) {
      throw new Error("Cannot leave draft without an attached CV.")
    }

    // The freeze writes `cv_snapshot` exactly once, ever — resolving it from
    // a persona/inventory store that hasn't finished its initial fetch would
    // silently bake in an empty document with no way to ever re-capture it.
    if (persona.loading || inventory.loading) {
      throw new Error("Still loading your CVs — try again in a moment.")
    }

    const document = buildResumeDocument(
      persona,
      inventory,
      current.cvPersonaId,
      current.cvPersonaSettings.fieldVisibility ?? {}
    )
    const template =
      findTemplate(current.cvTemplateId, persona.cvTemplates) ?? cvTemplates[0]

    const snapshot = buildCvSnapshot(
      { name: current.title, note: null, tags: [], templateSettings: current.cvTemplateSettings },
      document,
      template
    )
    snapshotPatch = {
      cv_snapshot: snapshot as unknown as Json,
      applied_at: new Date().toISOString(),
    }
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

// ---------------------------------------------------------------------------
// Mutators — the Visibility tab's per-application field visibility
// (formerly `lib/cv.ts`, keyed by `cvId` against the `cvs` table — spec 15
// moves this state onto `applications.cv_persona_settings`.)
// ---------------------------------------------------------------------------

async function saveApplicationCvPersonaSettings(
  store: ApplicationStore,
  applicationId: string,
  next: CvPersonaSettings
): Promise<void> {
  const { data, error } = await supabase
    .from("applications")
    .update({ cv_persona_settings: next as unknown as Json })
    .eq("id", applicationId)
    .select()
    .single()

  if (error) throw error

  const updated = mapApplicationRow(data)
  store.setApplications((current) =>
    current.map((existing) => (existing.id === applicationId ? updated : existing))
  )
}

/** Merges a `fieldVisibility` patch for one kind and saves the whole map. */
async function saveKindVisibility(
  store: ApplicationStore,
  applicationId: string,
  kind: ItemKind,
  patch: { hidden?: boolean; fields?: string[]; items?: Record<string, boolean> }
): Promise<void> {
  const application = findApplication(store, applicationId)
  if (!application) {
    throw new Error(`No application "${applicationId}".`)
  }

  const fieldVisibility = application.cvPersonaSettings.fieldVisibility ?? {}
  const nextFieldVisibility: FieldVisibility = {
    ...fieldVisibility,
    [kind]: { ...fieldVisibility[kind], ...patch },
  }

  await saveApplicationCvPersonaSettings(store, applicationId, {
    ...application.cvPersonaSettings,
    fieldVisibility: nextFieldVisibility,
  })
}

/** Hides (or reveals) an entire kind, for this application's CV only. */
export async function setKindHidden(
  store: ApplicationStore,
  applicationId: string,
  kind: ItemKind,
  hidden: boolean
): Promise<void> {
  await saveKindVisibility(store, applicationId, kind, { hidden })
}

/** Hides (or reveals) one field of a kind — e.g. Work's "Company name" — for this application's CV only. */
export async function setFieldHidden(
  store: ApplicationStore,
  applicationId: string,
  kind: ItemKind,
  fieldKey: string,
  hidden: boolean
): Promise<void> {
  const application = findApplication(store, applicationId)
  if (!application) {
    throw new Error(`No application "${applicationId}".`)
  }

  const fields = new Set(
    application.cvPersonaSettings.fieldVisibility?.[kind]?.fields ?? []
  )
  if (hidden) {
    fields.add(fieldKey)
  } else {
    fields.delete(fieldKey)
  }

  await saveKindVisibility(store, applicationId, kind, { fields: [...fields] })
}

/**
 * Hides (or reveals) one already-selected entry — e.g. one Skill, one Social
 * link, one Work entry — without touching its `persona_items`/`persona_lines`
 * selection, and without touching the Persona at all. See
 * `FieldVisibility.items`'s doc comment (`mocks/types.ts`) for why.
 */
export async function setItemHidden(
  store: ApplicationStore,
  applicationId: string,
  kind: ItemKind,
  itemId: string,
  hidden: boolean
): Promise<void> {
  const application = findApplication(store, applicationId)
  if (!application) {
    throw new Error(`No application "${applicationId}".`)
  }

  const items = { ...application.cvPersonaSettings.fieldVisibility?.[kind]?.items }
  if (hidden) {
    items[itemId] = true
  } else {
    delete items[itemId]
  }

  await saveKindVisibility(store, applicationId, kind, { items })
}

// ---------------------------------------------------------------------------
// Mutators — the Style tab's per-application overrides
// ---------------------------------------------------------------------------

async function saveApplicationCvTemplateSettings(
  store: ApplicationStore,
  applicationId: string,
  next: TemplateSettings
): Promise<void> {
  const { data, error } = await supabase
    .from("applications")
    .update({ cv_template_settings: next as unknown as Json })
    .eq("id", applicationId)
    .select()
    .single()

  if (error) throw error

  const updated = mapApplicationRow(data)
  store.setApplications((current) =>
    current.map((existing) => (existing.id === applicationId ? updated : existing))
  )
}

/**
 * Sets one property on one named style, for this application's CV only —
 * e.g. Classic's `headerName.fontSize`. Shallow-merged onto the template's
 * own style at render time (`cv-template-core.ts`'s `resolveStyleObject`),
 * so this writes only the override, never the template's base value.
 */
export async function setCvStyleProperty(
  store: ApplicationStore,
  applicationId: string,
  styleName: string,
  key: string,
  value: string | number
): Promise<void> {
  const application = findApplication(store, applicationId)
  if (!application) {
    throw new Error(`No application "${applicationId}".`)
  }

  const nextStyles = {
    ...application.cvTemplateSettings.styles,
    [styleName]: { ...application.cvTemplateSettings.styles?.[styleName], [key]: value },
  }

  await saveApplicationCvTemplateSettings(store, applicationId, {
    ...application.cvTemplateSettings,
    styles: nextStyles,
  })
}

/** Clears one property override, reverting it to the template's own value. */
export async function resetCvStyleProperty(
  store: ApplicationStore,
  applicationId: string,
  styleName: string,
  key: string
): Promise<void> {
  const application = findApplication(store, applicationId)
  if (!application) {
    throw new Error(`No application "${applicationId}".`)
  }

  const nextStyle = { ...application.cvTemplateSettings.styles?.[styleName] }
  delete nextStyle[key]

  const nextStyles = { ...application.cvTemplateSettings.styles, [styleName]: nextStyle }

  await saveApplicationCvTemplateSettings(store, applicationId, {
    ...application.cvTemplateSettings,
    styles: nextStyles,
  })
}

/**
 * Sets one property on the template's page config, for this application's CV
 * only — e.g. margin or paper size. Same shallow-merge-onto-the-template-base
 * idea as `setCvStyleProperty`, applied to `TemplateDefinition.page` instead
 * of a named style — see `TemplateNodeRenderer`'s `page` merge.
 */
export async function setCvPageProperty(
  store: ApplicationStore,
  applicationId: string,
  key: keyof PageConfig,
  value: string | number
): Promise<void> {
  const application = findApplication(store, applicationId)
  if (!application) {
    throw new Error(`No application "${applicationId}".`)
  }

  const nextPage = { ...application.cvTemplateSettings.page, [key]: value }

  await saveApplicationCvTemplateSettings(store, applicationId, {
    ...application.cvTemplateSettings,
    page: nextPage,
  })
}

/** Clears one page property override, reverting it to the template's own value. */
export async function resetCvPageProperty(
  store: ApplicationStore,
  applicationId: string,
  key: keyof PageConfig
): Promise<void> {
  const application = findApplication(store, applicationId)
  if (!application) {
    throw new Error(`No application "${applicationId}".`)
  }

  const nextPage = { ...application.cvTemplateSettings.page }
  delete nextPage[key]

  await saveApplicationCvTemplateSettings(store, applicationId, {
    ...application.cvTemplateSettings,
    page: nextPage,
  })
}

// ---------------------------------------------------------------------------
// Mutators — the Block Settings tab's per-application, per-node-id overrides
// ---------------------------------------------------------------------------

/**
 * Sets one property (`hidden`/`styles`/`text`) on one addressable node, for
 * this application's CV only — e.g. Classic's `bulletMarker` node's `text`.
 * Node ids are authored into the template itself (`TemplateNode.id`); see
 * `TemplateNodeRenderer`'s `nodeOverride`/`applyNodeOverride` for how this
 * shallow-merges onto that node at render time.
 */
export async function setCvNodeOverride(
  store: ApplicationStore,
  applicationId: string,
  nodeId: string,
  patch: { hidden?: boolean; styles?: string | string[]; text?: string }
): Promise<void> {
  const application = findApplication(store, applicationId)
  if (!application) {
    throw new Error(`No application "${applicationId}".`)
  }

  const nextNodes = {
    ...application.cvTemplateSettings.nodes,
    [nodeId]: { ...application.cvTemplateSettings.nodes?.[nodeId], ...patch },
  }

  await saveApplicationCvTemplateSettings(store, applicationId, {
    ...application.cvTemplateSettings,
    nodes: nextNodes,
  })
}

/** Clears one property override on a node, reverting it to the template's own value. */
export async function resetCvNodeOverride(
  store: ApplicationStore,
  applicationId: string,
  nodeId: string,
  key: "hidden" | "styles" | "text"
): Promise<void> {
  const application = findApplication(store, applicationId)
  if (!application) {
    throw new Error(`No application "${applicationId}".`)
  }

  const nextNode = { ...application.cvTemplateSettings.nodes?.[nodeId] }
  delete nextNode[key]

  const nextNodes = { ...application.cvTemplateSettings.nodes, [nodeId]: nextNode }

  await saveApplicationCvTemplateSettings(store, applicationId, {
    ...application.cvTemplateSettings,
    nodes: nextNodes,
  })
}

// ---------------------------------------------------------------------------
// "Save as new template" — see docs/specs/13-save-as-new-template.md
// ---------------------------------------------------------------------------

export type SaveAsNewTemplateFields = {
  name: string
  description: string
}

/**
 * Bakes `application`'s current `cvTemplateSettings` onto `base`'s
 * definition and inserts the result as a new, standalone `cv_templates` row.
 * Does not modify `application` itself — it stays on its original base
 * template id with its own `cvTemplateSettings` intact, still further
 * editable.
 */
export async function saveAsNewTemplate(
  store: PersonaStore,
  application: DbApplication,
  base: CvTemplate,
  fields: SaveAsNewTemplateFields
): Promise<DbCvTemplate> {
  const userId = requirePersonaUserId(store)
  const baked = bakeTemplateSettings(base.definition, application.cvTemplateSettings)
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
