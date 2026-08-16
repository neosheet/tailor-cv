/**
 * Types for the demo dataset.
 *
 * The `Db*` types mirror `docs/specs/02-inventory-data-model.md` exactly — they are
 * what a Supabase query will return once the app is wired up. The `Source*` types are
 * an authoring convenience: writing 200 flat line rows with parent ids by hand is
 * unreadable, so the data is authored nested and flattened by `flatten.ts`.
 */

import type { TemplateDefinition, TemplateSettings } from "../lib/cv-template-schema"
import type { CvSnapshotV1 } from "../lib/cv-snapshot"

export type ItemKind =
  // Basics pools. Every one behaves like a normal pool; the CV layer is what
  // limits the first five to a single selection each.
  | "name"
  | "headline"
  | "summary"
  | "contact"
  | "location"
  | "social"
  | "work"
  | "volunteer"
  | "education"
  | "award"
  | "certificate"
  | "publication"
  | "skill"
  | "language"
  | "interest"
  | "reference"
  | "project"

export type LineKind =
  "highlights" | "responsibilities" | "courses" | "keywords" | "roles"

// ---------------------------------------------------------------------------
// Database row shapes
// ---------------------------------------------------------------------------

/**
 * Every table carries these, per the spec. ISO 8601 instants — unlike an item's
 * `start_date`, these are real timestamps, so `new Date()` is safe on them.
 */
export type DbTimestamps = {
  createdAt: string
  updatedAt: string
}

/** Account anchor. Holds no CV content — Basics lives in `inventory_items`. */
export type DbProfile = DbTimestamps & {
  id: string
}

/**
 * Per-kind print settings: whether the whole kind is hidden from a rendered
 * CV, which of its fields are hidden, and — independent of `persona_items`/
 * `persona_lines` selection — which already-*selected* entries are hidden
 * without being deselected. `items` is keyed by `inventory_items.id`; an id
 * absent (or `false`) is visible. Non-destructive on purpose: unlike
 * removing an entry from the Persona's selection (which cascades and loses
 * any bullet curation on it), toggling this flag back off always restores
 * exactly what was there before. Sparse — a kind/field/item absent from this
 * map is visible.
 *
 * Lives on `cvs.persona_settings`, not `personas` (Batch 3,
 * docs/user-request.md) — visibility is a per-CV presentation choice, not
 * Persona content, so two CVs built from the same Persona can diverge.
 */
export type FieldVisibility = Partial<
  Record<
    ItemKind,
    { hidden?: boolean; fields?: string[]; items?: Record<string, boolean> }
  >
>

/** A CV's persona-content overrides — visibility today, room to grow. */
export type CvPersonaSettings = {
  fieldVisibility?: FieldVisibility
}

export type DbInventoryItem = DbTimestamps & {
  id: string
  userId: string
  kind: ItemKind
  title: string
  subtitle: string | null
  summary: string | null
  url: string | null
  /** Partial ISO date — `2014`, `2014-06`, or `2014-06-29`. */
  startDate: string | null
  /** Null means ongoing, or a single-date kind such as an award. */
  endDate: string | null
  details: Record<string, unknown>
  /** Skills only. Null on every other kind. */
  yearsExperience: number | null
  /** Skills only — FK to `skill_categories`. Null on every other kind, and skills may leave it unset. */
  categoryId: string | null
  tags: string[]
  /** Private annotation. Never exported, never rendered on a CV. */
  note: string | null
  /** Sorts to the top of its pool in the Inventory. Never affects a CV. */
  favorite: boolean
  position: number
}

export type DbInventoryLine = DbTimestamps & {
  id: string
  itemId: string
  listKind: LineKind
  content: string
  tags: string[]
  /** Private annotation. Never exported, never rendered on a CV. */
  note: string | null
  position: number
}

export type DbItemSkill = DbTimestamps & {
  itemId: string
  skillId: string
  position: number
}

// ---------------------------------------------------------------------------
// Persona selection — see docs/specs/06-persona-cv-split.md (formerly "CV
// selection" in docs/specs/03-cv-selection.md)
// ---------------------------------------------------------------------------

/**
 * `DbPersona` itself is NOT defined here — it's defined schema-accurately in
 * `src/lib/persona-store.tsx` (this shape would carry a `deletedAt` with no
 * backing column; soft delete isn't implemented for Personas). These three
 * are schema-accurate already and reused as-is by `lib/persona.ts`.
 */
export type DbPersonaSection = {
  personaId: string
  kind: ItemKind
  position: number
}

export type DbPersonaItem = {
  personaId: string
  itemId: string
  /** Order within its section, not the document. */
  position: number
}

export type DbPersonaLine = {
  personaId: string
  itemId: string
  lineId: string
  position: number
}

/**
 * The Inventory half of the dataset. Persona selection rows live in
 * `personaDb` from `mocks/persona.ts` — kept separate because that module
 * reads this one, and folding them together would make the import circular.
 */
export type MockDatabase = {
  profile: DbProfile
  items: DbInventoryItem[]
  lines: DbInventoryLine[]
  itemSkills: DbItemSkill[]
}

// ---------------------------------------------------------------------------
// Persona authoring shapes
// ---------------------------------------------------------------------------

/**
 * Which of an entry's lines the Persona takes. Listing 80 line ids by hand
 * would be unreadable and would rot the moment a bullet is reordered, so
 * selections are authored as a tag filter and expanded to real
 * `persona_lines` rows on load.
 */
export type SourcePersonaLines =
  "all" | "none" | { tagsAny: string[] } | { ids: string[] }

export type SourcePersonaItem = {
  itemId: string
  lines?: SourcePersonaLines
}

export type SourcePersonaSection = {
  kind: ItemKind
  items: SourcePersonaItem[]
}

export type SourcePersona = {
  id: string
  name: string
  note?: string
  tags?: string[]
  favorite?: boolean
  /** Order here is the section order on the page. */
  sections: SourcePersonaSection[]
}

// ---------------------------------------------------------------------------
// CV — a saved (Persona, Template) pairing. See docs/specs/06-persona-cv-split.md
// ---------------------------------------------------------------------------

/**
 * `templateId` matches an id in `src/lib/cv-templates.ts` — not a real FK yet.
 * A row is either **live** (`personaId`/`templateId` set, `snapshot` null) or
 * **frozen** (`personaId`/`templateId` null, `snapshot` set) — never neither,
 * never both, enforced by a DB check constraint. See
 * docs/specs/09-cv-export-import.md.
 */
export type DbCv = DbTimestamps & {
  id: string
  userId: string
  personaId: string | null
  templateId: string | null
  name: string
  note: string | null
  tags: string[]
  favorite: boolean
  /** Per-CV style/page/node overrides — see `TemplateSettings`. */
  templateSettings: TemplateSettings
  /** Per-CV persona-content overrides (field visibility) — see `CvPersonaSettings`. */
  personaSettings: CvPersonaSettings
  /** Set only on a frozen (imported) CV — see `personaId`'s doc comment above. */
  snapshot: CvSnapshotV1 | null
}

/**
 * A user-saved, standalone `TemplateDefinition` produced by "Save as new
 * template" (docs/specs/13-save-as-new-template.md) — never a delta on top
 * of a built-in, always a complete definition on its own.
 */
export type DbCvTemplate = DbTimestamps & {
  id: string
  userId: string
  name: string
  description: string
  schemaVersion: number
  definition: TemplateDefinition
}

export type SourceCv = {
  id: string
  name: string
  personaId: string
  templateId: string
  note?: string
  tags?: string[]
  favorite?: boolean
}

// ---------------------------------------------------------------------------
// Applications — job tracker. See docs/specs/10-applications-tracking.md
// ---------------------------------------------------------------------------

export type GlobalApplicationStatus =
  | "draft"
  | "applied"
  | "in_progress"
  | "offered"
  | "rejected"
  | "withdrawn"

export type StageProgressStatus =
  | "not_started"
  | "invited"
  | "scheduled"
  | "submitted"
  | "completed"
  | "under_review"
  | "passed"
  | "failed"
  | "skipped"

export type BuiltInStageCategory =
  | "recruiter_screen"
  | "technical_interview"
  | "system_design"
  | "behavioral"
  | "take_home_assignment"
  | "portfolio_review"
  | "performance_audition"
  | "onsite_loop"
  | "executive_chat"
  | "offer_negotiation"
  | "custom"

export type DbStageTemplate = DbTimestamps & {
  id: string
  userId: string
  name: string
  category: BuiltInStageCategory | string
}

export type DbApplicationStage = DbTimestamps & {
  id: string
  applicationId: string
  parentStageId: string | null
  name: string
  category: BuiltInStageCategory | string
  status: StageProgressStatus
  position: number
  scheduledAt: string | null
  completedAt: string | null
  notes: string | null
  interviewerNames: string[]
}

export type ApplicationJobType = "full_time" | "freelance" | "contract"

export type ApplicationWorkType = "remote" | "hybrid" | "on_site"

/**
 * `cvSnapshot` is set once, on the first transition away from `draft`, and
 * never changes again on later status changes — "one honest record of what
 * was actually sent." `cvId` stays as a link back to the source CV for
 * display/navigation even after freezing; rendering prefers `cvSnapshot`
 * once it's set. See docs/specs/10-applications-tracking.md's "The freeze".
 */
export type DbApplication = DbTimestamps & {
  id: string
  userId: string
  title: string
  company: string | null
  position: string | null
  location: string | null
  jobType: ApplicationJobType | null
  workType: ApplicationWorkType | null
  deadline: string | null
  sourceUrl: string | null
  vacancyDetail: string | null
  coverLetter: string | null
  applyVia: string | null
  cvId: string | null
  globalStatus: GlobalApplicationStatus
  currentStageId: string | null
  cvSnapshot: CvSnapshotV1 | null
  note: string | null
  tags: string[]
  archivedAt: string | null
  /** Stamped once, at the same "freeze" moment as `cvSnapshot` — the first transition away from `draft`. */
  appliedAt: string | null
  /** Raw pasted required-skills text (one per line) from the last Check. */
  requiredSkillsInput: string | null
  /** Result of the last Check — `null` when nothing was missing (or never checked). */
  missingSkills: string[] | null
}

// ---------------------------------------------------------------------------
// Authoring shapes
// ---------------------------------------------------------------------------

/** A bullet point or keyword. Plain string when it needs no tags or note. */
export type SourceLine =
  string | { content: string; tags?: string[]; note?: string }

export type SourceItem = {
  id: string
  title: string
  subtitle?: string
  summary?: string
  url?: string
  startDate?: string
  endDate?: string
  details?: Record<string, unknown>
  yearsExperience?: number
  tags?: string[]
  note?: string
  favorite?: boolean
  /** Nested lists, keyed by `list_kind`. */
  lines?: Partial<Record<LineKind, SourceLine[]>>
  /** Ids of `skill` items this entry used — becomes `item_skills` rows. */
  skills?: string[]
}

/** One pool: every item sharing a `kind`. */
export type SourcePool = {
  kind: ItemKind
  items: SourceItem[]
}
