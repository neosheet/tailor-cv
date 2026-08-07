import {
  DATE_RANGE,
  detailColumn,
  linesColumn,
  singleDate,
  TAGS_NOTE,
  textColumn,
} from "@/components/inventory/columns"
import { ValueCell, type PoolColumn } from "@/components/inventory/pool-table"
import { contactDetails, locationDetails, type ItemKind } from "@/lib/inventory"

/**
 * Columns for every pool, Basics included, following the field mapping in
 * `docs/specs/02-inventory-data-model.md`. One entry per `item_kind` — a total
 * map, not partial, since the Persona section picker needs columns for every
 * kind, not just the 11 non-Basics pools that get their own page.
 *
 * `url` is deliberately not a column anywhere — it would push every table into
 * horizontal scroll for a value that is rarely the thing you scan for. It stays
 * searchable, and belongs in the detail view.
 */
export const POOL_COLUMNS: Record<ItemKind, PoolColumn[]> = {
  name: [{ header: "Name", cell: (item) => item.title }, ...TAGS_NOTE],
  headline: [
    { header: "Headline", cell: (item) => item.title },
    ...TAGS_NOTE,
  ],
  summary: [
    { header: "Label", cell: (item) => item.title },
    { header: "Summary", cell: (item) => <ValueCell value={item.summary} /> },
    ...TAGS_NOTE,
  ],
  contact: [
    { header: "Label", cell: (item) => item.title },
    {
      header: "Email",
      cell: (item) => <ValueCell value={contactDetails(item).email} />,
    },
    {
      header: "Phone",
      cell: (item) => <ValueCell value={contactDetails(item).phone} />,
    },
    {
      header: "Website",
      cell: (item) => (
        <ValueCell
          value={contactDetails(item).url?.replace(/^https?:\/\//, "") ?? null}
        />
      ),
    },
    ...TAGS_NOTE,
  ],
  location: [
    { header: "City", cell: (item) => locationDetails(item).city },
    {
      header: "Region",
      cell: (item) => <ValueCell value={locationDetails(item).region} />,
    },
    {
      header: "Postal",
      cell: (item) => <ValueCell value={locationDetails(item).postalCode} />,
    },
    {
      header: "Country",
      cell: (item) => <ValueCell value={locationDetails(item).countryCode} />,
    },
    ...TAGS_NOTE,
  ],
  social: [
    { header: "Network", cell: (item) => item.title },
    { header: "Username", cell: (item) => <ValueCell value={item.subtitle} /> },
    {
      header: "URL",
      cell: (item) => (
        <ValueCell value={item.url?.replace(/^https?:\/\//, "") ?? null} />
      ),
    },
    ...TAGS_NOTE,
  ],
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
