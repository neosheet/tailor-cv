import { Badge } from "@/components/ui/badge"
import {
  NoteCell,
  TagsCell,
  ValueCell,
  type PoolColumn,
} from "@/components/inventory/pool-table"
import { linesOf, type DbInventoryItem, type LineKind } from "@/lib/inventory"
import { personaUsageCount } from "@/lib/persona"

/**
 * Column builders shared by every pool table.
 *
 * Each pool differs only in its first few columns; everything after that —
 * dates, nested-list counts, tags, notes — is the same shape everywhere, so it
 * is defined once here rather than per page.
 */

/**
 * How many Personas draw on this entry. Unused reads as a dash, like every
 * other column; a real count opens the detail dialog scrolled to its
 * Used-in-Personas section, since the number is only interesting alongside
 * *which* Personas.
 */
export const USAGE_COLUMN: PoolColumn = {
  header: "In Personas",
  className: "text-center",
  cell: (item, { openUsage }, _inventory, persona) => {
    const count = personaUsageCount(persona, item.id)

    if (count === 0) {
      return <span className="text-muted-foreground">—</span>
    }

    return (
      <Badge
        variant="outline"
        className="cursor-pointer tabular-nums hover:bg-muted"
        render={
          <button
            type="button"
            onClick={openUsage}
            aria-label={`${item.title} is used in ${count} ${count === 1 ? "Persona" : "Personas"} — show which`}
          />
        }
      >
        {count}
      </Badge>
    )
  },
}

/** Usage, tags, and note close out every pool's table. */
export const TAGS_NOTE: PoolColumn[] = [
  USAGE_COLUMN,
  { header: "Tags", cell: (item) => <TagsCell tags={item.tags} /> },
  { header: "Note", cell: (item) => <NoteCell note={item.note} /> },
]

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

/**
 * Partial ISO dates — `2014`, `2014-06`, `2014-06-29` — rendered readably.
 * Parsed by hand rather than through `Date`, which would shift the value by a
 * timezone and can turn "2014-06" into May for anyone west of UTC.
 */
export function formatPartialDate(
  value: string | null,
  yearOnly = false
): string | null {
  if (!value) {
    return null
  }

  const [year, month, day] = value.split("-")
  if (yearOnly || !month) {
    return year
  }

  const name = MONTHS[Number(month) - 1] ?? month
  return day ? `${Number(day)} ${name} ${year}` : `${name} ${year}`
}

/**
 * Null `end_date` on a ranged kind means the entry is ongoing. Education
 * dates drop the month — a graduation is remembered by year.
 */
function formatRange(item: DbInventoryItem): string | null {
  const yearOnly = item.kind === "education"
  const start = formatPartialDate(item.startDate, yearOnly)
  if (!start) {
    return null
  }

  return `${start} – ${formatPartialDate(item.endDate, yearOnly) ?? "Present"}`
}

/** For Work, Volunteer, Education, Projects — anything with a span. */
export const DATE_RANGE: PoolColumn = {
  header: "Dates",
  cell: (item) => <ValueCell value={formatRange(item)} />,
}

/** For Awards, Certificates, Publications — `end_date` is always null there. */
export function singleDate(header: string): PoolColumn {
  return {
    header,
    cell: (item) => <ValueCell value={formatPartialDate(item.startDate)} />,
  }
}

// ---------------------------------------------------------------------------
// Nested lists
// ---------------------------------------------------------------------------

const LINE_LABEL: Record<LineKind, [singular: string, plural: string]> = {
  highlights: ["highlight", "highlights"],
  responsibilities: ["responsibility", "responsibilities"],
  courses: ["course", "courses"],
  keywords: ["keyword", "keywords"],
  roles: ["role", "roles"],
}

/** Section headings for a line kind, shared by the detail view and item form. */
export const LINE_HEADING: Record<LineKind, string> = {
  responsibilities: "Responsibilities",
  highlights: "Highlights",
  courses: "Courses",
  keywords: "Keywords",
  roles: "Roles",
}

/** Order lists appear in, so a dialog reads the same way every time. */
export const LINE_ORDER: LineKind[] = [
  "responsibilities",
  "highlights",
  "courses",
  "keywords",
  "roles",
]

/**
 * A summary of an entry's nested lists — "6 highlights · 4 responsibilities".
 * Counts rather than content: the lines themselves belong in the detail view,
 * and a job carries a dozen bullets that would swamp the row.
 */
export function linesColumn(header: string, kinds: LineKind[]): PoolColumn {
  return {
    header,
    cell: (item, _actions, store) => {
      const parts = kinds
        .map((kind) => ({
          kind,
          count: linesOf(store, item.id, kind).length,
        }))
        .filter(({ count }) => count > 0)
        .map(({ kind, count }) => {
          const [singular, plural] = LINE_LABEL[kind]
          return `${count} ${count === 1 ? singular : plural}`
        })

      return <ValueCell value={parts.length > 0 ? parts.join(" · ") : null} />
    },
  }
}

// ---------------------------------------------------------------------------
// Simple field columns
// ---------------------------------------------------------------------------

export function textColumn(
  header: string,
  read: (item: DbInventoryItem) => string | null
): PoolColumn {
  return { header, cell: (item) => <ValueCell value={read(item)} /> }
}

/** Skills only — resolves `categoryId` against the registry, like `item-dialog.tsx`'s select. */
export const CATEGORY_COLUMN: PoolColumn = {
  header: "Category",
  cell: (item, _actions, store) => {
    const category = store.skillCategories.find(
      (candidate) => candidate.id === item.categoryId
    )
    return <ValueCell value={category?.name ?? null} />
  },
}

/** Reads one key out of the `details` jsonb, which is untyped by design. */
export function detailColumn(header: string, key: string): PoolColumn {
  return {
    header,
    cell: (item) => {
      const value = item.details[key]
      const text =
        typeof value === "string" || typeof value === "number"
          ? String(value)
          : null
      return <ValueCell value={text} />
    },
  }
}
