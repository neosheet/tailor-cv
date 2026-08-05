import {
  DATE_RANGE,
  detailColumn,
  linesColumn,
  singleDate,
  TAGS_NOTE,
  textColumn,
} from "@/components/inventory/columns"
import type { PoolColumn } from "@/components/inventory/pool-table"
import type { ItemKind } from "@/mocks"

/**
 * Columns for every non-Basics pool, following the field mapping in
 * `docs/specs/02-inventory-data-model.md`. One entry per `item_kind`, so adding
 * a pool page is a config change, not a new table implementation.
 *
 * `url` is deliberately not a column anywhere — it would push every table into
 * horizontal scroll for a value that is rarely the thing you scan for. It stays
 * searchable, and belongs in the detail view.
 */
export const POOL_COLUMNS: Partial<Record<ItemKind, PoolColumn[]>> = {
  work: [
    textColumn("Company", (item) => item.title),
    textColumn("Position", (item) => item.subtitle),
    DATE_RANGE,
    linesColumn("Lines", ["responsibilities", "highlights"]),
    ...TAGS_NOTE,
  ],
  volunteer: [
    textColumn("Organisation", (item) => item.title),
    textColumn("Position", (item) => item.subtitle),
    DATE_RANGE,
    linesColumn("Lines", ["responsibilities", "highlights"]),
    ...TAGS_NOTE,
  ],
  education: [
    textColumn("Institution", (item) => item.title),
    textColumn("Area", (item) => item.subtitle),
    detailColumn("Study type", "studyType"),
    detailColumn("Score", "score"),
    DATE_RANGE,
    linesColumn("Courses", ["courses"]),
    ...TAGS_NOTE,
  ],
  skill: [
    textColumn("Skill", (item) => item.title),
    textColumn("Level", (item) => item.subtitle),
    textColumn("Years", (item) =>
      item.yearsExperience === null ? null : String(item.yearsExperience)
    ),
    linesColumn("Keywords", ["keywords"]),
    ...TAGS_NOTE,
  ],
  project: [
    textColumn("Project", (item) => item.title),
    textColumn("Description", (item) => item.summary),
    DATE_RANGE,
    linesColumn("Lines", ["highlights", "keywords", "roles"]),
    ...TAGS_NOTE,
  ],
  interest: [
    textColumn("Interest", (item) => item.title),
    linesColumn("Keywords", ["keywords"]),
    ...TAGS_NOTE,
  ],
  language: [
    textColumn("Language", (item) => item.title),
    textColumn("Fluency", (item) => item.subtitle),
    ...TAGS_NOTE,
  ],
  award: [
    textColumn("Award", (item) => item.title),
    textColumn("Awarder", (item) => item.subtitle),
    singleDate("Awarded"),
    textColumn("Summary", (item) => item.summary),
    ...TAGS_NOTE,
  ],
  certificate: [
    textColumn("Certificate", (item) => item.title),
    textColumn("Issuer", (item) => item.subtitle),
    singleDate("Issued"),
    ...TAGS_NOTE,
  ],
  publication: [
    textColumn("Publication", (item) => item.title),
    textColumn("Publisher", (item) => item.subtitle),
    singleDate("Released"),
    textColumn("Summary", (item) => item.summary),
    ...TAGS_NOTE,
  ],
  reference: [
    textColumn("Name", (item) => item.title),
    textColumn("Role", (item) => item.subtitle),
    textColumn("Reference", (item) => item.summary),
    ...TAGS_NOTE,
  ],
}
