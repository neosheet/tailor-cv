import * as React from "react"

import { useAuth } from "@/lib/auth-context"
import type { InventoryData } from "@/lib/inventory-store"
import { contactDetails, formatLocation, linesOf, skillsOf } from "@/lib/inventory"
import { supabase } from "@/lib/supabase"
import type { Tables } from "@/lib/database.types"
import type {
  DbCv,
  DbCvItem,
  DbCvLine,
  DbCvSection,
  DbInventoryItem,
  ItemKind,
  LineKind,
} from "@/mocks/types"

/**
 * The Supabase-backed replacement for `src/mocks/cv.ts`.
 *
 * There are only two CVs total (per `src/mocks/README.md`), so unlike
 * Inventory this doesn't get a shared context provider — `useCvStore` is a
 * self-contained hook each consuming component calls directly. Refetching
 * `cvs`/`cv_sections`/`cv_items`/`cv_lines` per component is cheap at this
 * scale; a provider would be one more thing to wire into the component tree
 * for no real benefit yet (see the plan's Phase 4 note on this tradeoff).
 *
 * `allCvs`/`findCv`/`cvsUsingItem`/`cvUsageCount`/`buildResumeDocument` stay
 * plain synchronous functions taking the fetched `CvData` (and, for
 * `buildResumeDocument`, `InventoryData` too) as explicit arguments — same
 * reasoning as `src/lib/inventory.ts`: they're called from non-component
 * code (`toEntry` below, `describeSelection` in `item-detail-dialog.tsx`).
 */

export type CvData = {
  cvs: DbCv[]
  cvSections: DbCvSection[]
  cvItems: DbCvItem[]
  cvLines: DbCvLine[]
}

export type CvStore = CvData & {
  loading: boolean
  error: Error | null
  refetch: () => void
}

function toError(caught: unknown): Error {
  return caught instanceof Error ? caught : new Error(String(caught))
}

function mapCvRow(row: Tables<"cvs">): DbCv {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    note: row.note,
    // The schema dropped soft delete (spec 04 decision 2) — `cvs` has no
    // `deleted_at` column, so every fetched row is live by definition.
    deletedAt: null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapCvSectionRow(row: Tables<"cv_sections">): DbCvSection {
  return { cvId: row.cv_id, kind: row.kind, position: row.position }
}

function mapCvItemRow(row: Tables<"cv_items">): DbCvItem {
  return { cvId: row.cv_id, itemId: row.item_id, position: row.position }
}

function mapCvLineRow(row: Tables<"cv_lines">): DbCvLine {
  return {
    cvId: row.cv_id,
    itemId: row.item_id,
    lineId: row.line_id,
    position: row.position,
  }
}

const EMPTY_CV_DATA: CvData = { cvs: [], cvSections: [], cvItems: [], cvLines: [] }

/** Fetches every CV (and its sections/items/lines) for the signed-in user. */
export function useCvStore(): CvStore {
  const { session } = useAuth()
  const userId = session?.user.id ?? null

  const [data, setData] = React.useState<CvData>(EMPTY_CV_DATA)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<Error | null>(null)
  const [version, setVersion] = React.useState(0)

  React.useEffect(() => {
    let cancelled = false

    async function load() {
      if (!userId) {
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const { data: cvRows, error: cvsError } = await supabase
          .from("cvs")
          .select("*")
          .eq("user_id", userId as string)

        if (cvsError) throw cvsError

        const cvIds = (cvRows ?? []).map((row) => row.id)

        const [sectionsResult, itemsResult, linesResult] = await Promise.all([
          cvIds.length > 0
            ? supabase.from("cv_sections").select("*").in("cv_id", cvIds)
            : Promise.resolve({
                data: [] as Tables<"cv_sections">[],
                error: null,
              }),
          cvIds.length > 0
            ? supabase.from("cv_items").select("*").in("cv_id", cvIds)
            : Promise.resolve({ data: [] as Tables<"cv_items">[], error: null }),
          cvIds.length > 0
            ? supabase.from("cv_lines").select("*").in("cv_id", cvIds)
            : Promise.resolve({ data: [] as Tables<"cv_lines">[], error: null }),
        ])

        if (sectionsResult.error) throw sectionsResult.error
        if (itemsResult.error) throw itemsResult.error
        if (linesResult.error) throw linesResult.error

        if (cancelled) return

        setData({
          cvs: (cvRows ?? []).map(mapCvRow),
          cvSections: (sectionsResult.data ?? []).map(mapCvSectionRow),
          cvItems: (itemsResult.data ?? []).map(mapCvItemRow),
          cvLines: (linesResult.data ?? []).map(mapCvLineRow),
        })
      } catch (caught) {
        if (!cancelled) {
          setError(toError(caught))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [userId, version])

  const refetch = React.useCallback(() => setVersion((v) => v + 1), [])

  return { ...data, loading, error, refetch }
}

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export function allCvs(data: CvData): DbCv[] {
  return data.cvs.filter((cv) => cv.deletedAt === null)
}

export function findCv(data: CvData, cvId: string): DbCv | undefined {
  return allCvs(data).find((cv) => cv.id === cvId)
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
 * lines.**
 */
export function cvsUsingItem(data: CvData, itemId: string): ItemUsage[] {
  return allCvs(data).flatMap((cv) => {
    const entrySelected = data.cvItems.some(
      (row) => row.cvId === cv.id && row.itemId === itemId
    )
    const lineIds = data.cvLines
      .filter((row) => row.cvId === cv.id && row.itemId === itemId)
      .map((row) => row.lineId)

    if (!entrySelected && lineIds.length === 0) {
      return []
    }

    return [{ cv, entrySelected, lineIds }]
  })
}

/** Just the count, for the Inventory tables. */
export function cvUsageCount(data: CvData, itemId: string): number {
  return cvsUsingItem(data, itemId).length
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

function toEntry(
  inventoryData: InventoryData,
  cvData: CvData,
  cvId: string,
  item: DbInventoryItem
): ResumeEntry {
  const chosen = new Set(
    cvData.cvLines
      .filter((row) => row.cvId === cvId && row.itemId === item.id)
      .map((row) => row.lineId)
  )

  const lineGroups = LINE_ORDER.flatMap((kind) => {
    const lineItems = linesOf(inventoryData, item.id, kind)
      .filter((line) => chosen.has(line.id))
      .map((line) => line.content)

    return lineItems.length > 0 ? [{ kind, items: lineItems }] : []
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
    skills: skillsOf(inventoryData, item.id).map((skill) => skill.title),
  }
}

/**
 * Resolves one CV into the flat, ordered shape a template renders.
 *
 * Sections arrive ordered, entries filtered to what the CV selected, and
 * lines narrowed to the chosen bullets.
 */
export function buildResumeDocument(
  inventoryData: InventoryData,
  cvData: CvData,
  cvId: string
): ResumeDocument {
  const cv = findCv(cvData, cvId)
  if (!cv) {
    throw new Error(`No CV "${cvId}".`)
  }

  const byId = new Map(inventoryData.items.map((item) => [item.id, item]))

  const selectedIn = (kind: ItemKind): DbInventoryItem[] =>
    cvData.cvItems
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

  const sections = cvData.cvSections
    .filter((row) => row.cvId === cvId && !HEADER_KINDS.includes(row.kind))
    .sort((a, b) => a.position - b.position)
    .map((row) => ({
      kind: row.kind,
      heading: SECTION_HEADING[row.kind] ?? row.kind,
      entries: selectedIn(row.kind).map((item) =>
        toEntry(inventoryData, cvData, cvId, item)
      ),
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
