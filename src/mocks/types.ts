/**
 * Types for the demo dataset.
 *
 * The `Db*` types mirror `docs/specs/02-inventory-data-model.md` exactly — they are
 * what a Supabase query will return once the app is wired up. The `Source*` types are
 * an authoring convenience: writing 200 flat line rows with parent ids by hand is
 * unreadable, so the data is authored nested and flattened by `flatten.ts`.
 */

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

/** `templateId` matches an id in `src/lib/cv-templates.ts` — not a real FK yet. */
export type DbCv = DbTimestamps & {
  id: string
  userId: string
  personaId: string
  templateId: string
  name: string
  note: string | null
}

export type SourceCv = {
  id: string
  name: string
  personaId: string
  templateId: string
  note?: string
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
