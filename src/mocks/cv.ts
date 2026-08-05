import { cvs as sourceCvs } from "./data/cvs"
import { USER_ID } from "./data/basics"
import {
  allLinesOf,
  contactDetails,
  formatLocation,
  linesOf,
  mockDb,
  skillsOf,
} from "./index"
import type {
  DbCv,
  DbCvItem,
  DbCvLine,
  DbCvSection,
  DbInventoryItem,
  ItemKind,
  LineKind,
  SourceCvLines,
} from "./types"

/**
 * The CV selection layer — see `docs/specs/03-cv-selection.md`.
 *
 * Authored selections are expanded into the flat `cv_*` rows a Supabase query
 * returns, then `buildResumeDocument` resolves those rows plus the Inventory
 * into the one shape templates render.
 */

// ---------------------------------------------------------------------------
// Expansion: authored selection → flat rows
// ---------------------------------------------------------------------------

function selectLineIds(itemId: string, spec: SourceCvLines | undefined) {
  if (spec === undefined || spec === "none") {
    return []
  }

  const lines = allLinesOf(itemId).sort((a, b) => a.position - b.position)

  if (spec === "all") {
    return lines.map((line) => line.id)
  }

  if ("ids" in spec) {
    return spec.ids
  }

  return lines
    .filter((line) => line.tags.some((tag) => spec.tagsAny.includes(tag)))
    .map((line) => line.id)
}

const cvRows: DbCv[] = []
const cvSectionRows: DbCvSection[] = []
const cvItemRows: DbCvItem[] = []
const cvLineRows: DbCvLine[] = []

for (const source of sourceCvs) {
  cvRows.push({
    id: source.id,
    userId: USER_ID,
    name: source.name,
    note: source.note ?? null,
    deletedAt: null,
    createdAt: "2025-02-03T09:00:00.000Z",
    updatedAt: "2025-02-17T14:30:00.000Z",
  })

  source.sections.forEach((section, sectionIndex) => {
    cvSectionRows.push({
      cvId: source.id,
      kind: section.kind,
      position: sectionIndex,
    })

    section.items.forEach((item, itemIndex) => {
      cvItemRows.push({
        cvId: source.id,
        itemId: item.itemId,
        position: itemIndex,
      })

      selectLineIds(item.itemId, item.lines).forEach((lineId, lineIndex) => {
        cvLineRows.push({
          cvId: source.id,
          itemId: item.itemId,
          lineId,
          position: lineIndex,
        })
      })
    })
  })
}

assertSelectionsResolve()

export const cvDb = {
  cvs: cvRows,
  cvSections: cvSectionRows,
  cvItems: cvItemRows,
  cvLines: cvLineRows,
}

/**
 * The integrity the database enforces with foreign keys, checked here instead:
 * a selection pointing at a missing row would otherwise render as a silent gap.
 */
function assertSelectionsResolve() {
  const itemIds = new Set(mockDb.items.map((item) => item.id))
  const lineIds = new Set(mockDb.lines.map((line) => line.id))

  for (const row of cvItemRows) {
    if (!itemIds.has(row.itemId)) {
      throw new Error(
        `Mock CVs: "${row.cvId}" selects item "${row.itemId}", which does not exist.`
      )
    }
  }

  for (const row of cvLineRows) {
    if (!lineIds.has(row.lineId)) {
      throw new Error(
        `Mock CVs: "${row.cvId}" selects line "${row.lineId}", which does not exist.`
      )
    }
  }
}

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export function allCvs(): DbCv[] {
  return cvRows.filter((cv) => cv.deletedAt === null)
}

export function findCv(cvId: string): DbCv | undefined {
  return allCvs().find((cv) => cv.id === cvId)
}

export type ItemUsage = {
  cv: DbCv
  /** The entry itself is selected, not merely bullets beneath it. */
  entrySelected: boolean
  /**
   * Which of this entry's lines the CV takes. Ids rather than a count, so the
   * caller can break them down by list kind — "2 of 4 responsibilities" says
   * something; "5 of 8 lines" does not.
   */
  lineIds: string[]
}

/**
 * Which CVs use an Inventory entry — scenario 5 in spec 02, and the warning
 * shown before a delete.
 *
 * **A CV counts as using an entry if it selects the entry _or_ any of its
 * lines.** The second case is the one that is easy to miss: `cv_lines` is keyed
 * on the line, so an entry whose bullets appear on a CV is in use even when the
 * lookup only checks `cv_items`. Getting this wrong would let a delete claim
 * nothing depends on the entry while a CV is still rendering its bullets.
 */
export function cvsUsingItem(itemId: string): ItemUsage[] {
  return allCvs().flatMap((cv) => {
    const entrySelected = cvDb.cvItems.some(
      (row) => row.cvId === cv.id && row.itemId === itemId
    )
    const lineIds = cvDb.cvLines
      .filter((row) => row.cvId === cv.id && row.itemId === itemId)
      .map((row) => row.lineId)

    if (!entrySelected && lineIds.length === 0) {
      return []
    }

    return [{ cv, entrySelected, lineIds }]
  })
}

/** Just the count, for the Inventory tables. */
export function cvUsageCount(itemId: string): number {
  return cvsUsingItem(itemId).length
}

// ---------------------------------------------------------------------------
// The document templates render
// ---------------------------------------------------------------------------

export type ResumeLineGroup = {
  kind: LineKind
  items: string[]
}

export type ResumeEntry = {
  id: string
  title: string
  subtitle: string | null
  summary: string | null
  url: string | null
  /** Partial ISO — templates format these themselves. */
  startDate: string | null
  endDate: string | null
  details: Record<string, unknown>
  lineGroups: ResumeLineGroup[]
  /** Titles of the skills this entry used, already resolved. */
  skills: string[]
}

export type ResumeSection = {
  kind: ItemKind
  heading: string
  entries: ResumeEntry[]
}

export type ResumeDocument = {
  cvId: string
  cvName: string
  /** Header block, lifted out of the Basics pools. */
  name: string
  headline: string | null
  summary: string | null
  contact: {
    email: string | null
    phone: string | null
    url: string | null
  } | null
  location: string | null
  socials: { network: string; username: string | null; url: string | null }[]
  sections: ResumeSection[]
}

/** Basics pools become the header block, not sections. */
const HEADER_KINDS: ItemKind[] = [
  "name",
  "headline",
  "summary",
  "contact",
  "location",
  "social",
]

const SECTION_HEADING: Partial<Record<ItemKind, string>> = {
  work: "Experience",
  volunteer: "Volunteering",
  education: "Education",
  skill: "Skills",
  project: "Projects",
  award: "Awards",
  certificate: "Certificates",
  publication: "Publications",
  language: "Languages",
  interest: "Interests",
  reference: "References",
}

const LINE_ORDER: LineKind[] = [
  "responsibilities",
  "highlights",
  "courses",
  "keywords",
  "roles",
]

/**
 * Resolves one CV into the flat, ordered shape a template renders.
 *
 * This is the seam: it reads mock rows today and Supabase later, and templates
 * change either way. Sections arrive ordered, entries filtered to what the CV
 * selected, and lines narrowed to the chosen bullets.
 */
export function buildResumeDocument(cvId: string): ResumeDocument {
  const cv = findCv(cvId)
  if (!cv) {
    throw new Error(`No CV "${cvId}".`)
  }

  const byId = new Map(mockDb.items.map((item) => [item.id, item]))

  const selectedIn = (kind: ItemKind): DbInventoryItem[] =>
    cvDb.cvItems
      .filter((row) => row.cvId === cvId)
      .sort((a, b) => a.position - b.position)
      .flatMap((row) => {
        const item = byId.get(row.itemId)
        return item && item.kind === kind ? [item] : []
      })

  const firstIn = (kind: ItemKind) => selectedIn(kind)[0]

  const nameItem = firstIn("name")
  const contactItem = firstIn("contact")
  const locationItem = firstIn("location")

  const sections = cvDb.cvSections
    .filter((row) => row.cvId === cvId && !HEADER_KINDS.includes(row.kind))
    .sort((a, b) => a.position - b.position)
    .map((row) => ({
      kind: row.kind,
      heading: SECTION_HEADING[row.kind] ?? row.kind,
      entries: selectedIn(row.kind).map((item) => toEntry(cvId, item)),
    }))
    // A section whose every entry was deleted still has a row; printing a bare
    // heading would be worse than omitting it. See spec 03.
    .filter((section) => section.entries.length > 0)

  return {
    cvId: cv.id,
    cvName: cv.name,
    name: nameItem?.title ?? "",
    headline: firstIn("headline")?.title ?? null,
    summary: firstIn("summary")?.summary ?? null,
    contact: contactItem ? contactDetails(contactItem) : null,
    location: locationItem ? formatLocation(locationItem) : null,
    socials: selectedIn("social").map((item) => ({
      network: item.title,
      username: item.subtitle,
      url: item.url,
    })),
    sections,
  }
}

function toEntry(cvId: string, item: DbInventoryItem): ResumeEntry {
  const chosen = new Set(
    cvDb.cvLines
      .filter((row) => row.cvId === cvId && row.itemId === item.id)
      .map((row) => row.lineId)
  )

  const lineGroups = LINE_ORDER.flatMap((kind) => {
    const items = linesOf(item.id, kind)
      .filter((line) => chosen.has(line.id))
      .map((line) => line.content)

    return items.length > 0 ? [{ kind, items }] : []
  })

  return {
    id: item.id,
    title: item.title,
    subtitle: item.subtitle,
    summary: item.summary,
    url: item.url,
    startDate: item.startDate,
    endDate: item.endDate,
    details: item.details,
    lineGroups,
    skills: skillsOf(item.id).map((skill) => skill.title),
  }
}
