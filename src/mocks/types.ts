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
// CV selection — see docs/specs/03-cv-selection.md
// ---------------------------------------------------------------------------

/**
 * No `templateId`. A CV is content — which entries, which bullets, in what
 * order. Layout is a preview choice, and the binding that matters ("which layout
 * did Globex receive?") belongs to the application. See spec 03.
 */
export type DbCv = DbTimestamps & {
  id: string
  userId: string
  name: string
  note: string | null
  deletedAt: string | null
}

export type DbCvSection = {
  cvId: string
  kind: ItemKind
  position: number
}

export type DbCvItem = {
  cvId: string
  itemId: string
  /** Order within its section, not the document. */
  position: number
}

export type DbCvLine = {
  cvId: string
  itemId: string
  lineId: string
  position: number
}

/**
 * The Inventory half of the dataset. CV selection rows live in `cvDb` from
 * `mocks/cv.ts` — kept separate because that module reads this one, and folding
 * them together would make the import circular.
 */
export type MockDatabase = {
  profile: DbProfile
  items: DbInventoryItem[]
  lines: DbInventoryLine[]
  itemSkills: DbItemSkill[]
}

// ---------------------------------------------------------------------------
// CV authoring shapes
// ---------------------------------------------------------------------------

/**
 * Which of an entry's lines the CV takes. Listing 80 line ids by hand would be
 * unreadable and would rot the moment a bullet is reordered, so selections are
 * authored as a tag filter and expanded to real `cv_lines` rows on load.
 */
export type SourceCvLines =
  "all" | "none" | { tagsAny: string[] } | { ids: string[] }

export type SourceCvItem = {
  itemId: string
  lines?: SourceCvLines
}

export type SourceCvSection = {
  kind: ItemKind
  items: SourceCvItem[]
}

export type SourceCv = {
  id: string
  name: string
  note?: string
  /** Order here is the section order on the page. */
  sections: SourceCvSection[]
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
