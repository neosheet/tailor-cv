import { allLinesOf, contactDetails, formatLocation, linesOf, skillsOf } from "@/lib/inventory"
import type { InventoryData, InventoryStore } from "@/lib/inventory-store"
import {
  mapPersonaRow,
  type DbPersona,
  type PersonaData,
  type PersonaStore,
} from "@/lib/persona-store"
import { supabase } from "@/lib/supabase"
import type { ResumeEntry, ResumeSkillGroup, ResumeDocument } from "@/lib/resume-document"
import type { DbInventoryItem, FieldVisibility, ItemKind, LineKind } from "@/mocks/types"

export type { DbPersona, PersonaData, PersonaStore } from "@/lib/persona-store"
export type { FieldVisibility, CvPersonaSettings } from "@/mocks/types"

/**
 * The Supabase-backed replacement for `src/mocks/persona.ts` and
 * `src/mocks/cv.ts`. Selectors are plain synchronous functions taking
 * already-fetched `PersonaData`/`InventoryData` as explicit arguments —
 * same reasoning as `src/lib/inventory.ts`: `PoolColumn.cell` and other
 * non-component callbacks call these outside any hook context.
 */

/** The 11 non-Basics pool kinds a Persona can have a section for, canonical order. */
export const SECTION_KINDS: ItemKind[] = [
  "work",
  "education",
  "skill",
  "language",
  "project",
  "volunteer",
  "award",
  "certificate",
  "publication",
  "interest",
  "reference",
]

/** Basics kinds that take at most one selected item. Social is multi — excluded. */
export const PICK_ONE_KINDS: ItemKind[] = [
  "name",
  "headline",
  "summary",
  "contact",
  "location",
]

// ---------------------------------------------------------------------------
// Pure selectors
// ---------------------------------------------------------------------------

export function allPersonas(data: PersonaData): DbPersona[] {
  return data.personas
}

export function findPersona(
  data: PersonaData,
  personaId: string
): DbPersona | undefined {
  return data.personas.find((persona) => persona.id === personaId)
}

/** One Persona's currently-selected item ids for one kind, cross-referenced
 * against Inventory since `persona_items` itself carries no `kind` column. */
export function itemIdsForKind(
  persona: PersonaStore,
  inventory: InventoryStore,
  personaId: string,
  kind: ItemKind
): string[] {
  const itemsById = new Map(inventory.items.map((item) => [item.id, item]))

  return persona.personaItems
    .filter((row) => row.personaId === personaId)
    .sort((a, b) => a.position - b.position)
    .map((row) => row.itemId)
    .filter((itemId) => itemsById.get(itemId)?.kind === kind)
}

export type ItemUsage = {
  persona: DbPersona
  /** The entry itself is selected, not merely bullets beneath it. */
  entrySelected: boolean
  /**
   * Which of this entry's lines the Persona takes. Ids rather than a count, so
   * the caller can break them down by list kind — "2 of 4 responsibilities"
   * says something; "5 of 8 lines" does not.
   */
  lineIds: string[]
}

/**
 * Which Personas use an Inventory entry — scenario 5 in spec 02, and the
 * warning shown before a delete.
 *
 * **A Persona counts as using an entry if it selects the entry _or_ any of
 * its lines.** `persona_lines` is keyed on the line, so an entry whose
 * bullets appear on a Persona is in use even when the lookup only checks
 * `persona_items`.
 */
export function personasUsingItem(data: PersonaData, itemId: string): ItemUsage[] {
  return data.personas.flatMap((persona) => {
    const entrySelected = data.personaItems.some(
      (row) => row.personaId === persona.id && row.itemId === itemId
    )
    const lineIds = data.personaLines
      .filter((row) => row.personaId === persona.id && row.itemId === itemId)
      .map((row) => row.lineId)

    if (!entrySelected && lineIds.length === 0) {
      return []
    }

    return [{ persona, entrySelected, lineIds }]
  })
}

/** Just the count, for the Inventory tables. */
export function personaUsageCount(data: PersonaData, itemId: string): number {
  return personasUsingItem(data, itemId).length
}

// ---------------------------------------------------------------------------
// The document templates render
// ---------------------------------------------------------------------------

export type {
  ResumeLineGroup,
  ResumeEntry,
  ResumeSkillGroup,
  ResumeSection,
  ResumeDocument,
} from "@/lib/resume-document"

/** Basics pools become the header block, not sections. */
const HEADER_KINDS: ItemKind[] = [
  "name",
  "headline",
  "contact",
  "location",
  "social",
  "summary"
]

/** Labels for the Basics kinds — the header block, not a section. */
export const BASICS_LABEL: Partial<Record<ItemKind, string>> = {
  name: "Name",
  headline: "Headline",
  summary: "Summary",
  contact: "Contact",
  location: "Location",
  social: "Social",
}

/** A kind's display title, Basics or Section alike. */
export function titleFor(kind: ItemKind): string {
  return BASICS_LABEL[kind] ?? SECTION_HEADING[kind] ?? kind
}

export const SECTION_HEADING: Partial<Record<ItemKind, string>> = {
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

/**
 * The toggleable fields for each kind, in the order the settings tree shows
 * them — a leaf's `key` is either a `ResumeEntry` property name, a
 * `LineKind` (a line group), or an `entry.details` key. Kinds absent here
 * take at most one field of real content, so the tree shows them as a single
 * togglable row with no children instead of a redundant one-item folder.
 *
 * Restricted to fields the Classic template actually renders — see
 * `cv-template-defs/classic.ts`'s `entryBlock`/`sectionHeading` — so every
 * toggle here visibly does something.
 */
export const FIELD_REGISTRY: Partial<Record<ItemKind, { key: string; label: string }[]>> = {
  contact: [
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "website", label: "Website" },
  ],
  work: [
    { key: "title", label: "Company name" },
    { key: "subtitle", label: "Position" },
    { key: "url", label: "Website" },
    { key: "summary", label: "Description" },
    { key: "dates", label: "Dates" },
    { key: "location", label: "Location" },
    { key: "workplaceType", label: "Workplace type" },
    { key: "employmentType", label: "Employment type" },
    { key: "responsibilities", label: "Responsibilities" },
    { key: "highlights", label: "Highlights" },
    { key: "skills", label: "Skills used" },
  ],
  volunteer: [
    { key: "title", label: "Organisation" },
    { key: "subtitle", label: "Position" },
    { key: "summary", label: "Description" },
    { key: "dates", label: "Dates" },
    { key: "responsibilities", label: "Responsibilities" },
    { key: "highlights", label: "Highlights" },
    { key: "skills", label: "Skills used" },
  ],
  education: [
    { key: "title", label: "Institution" },
    { key: "subtitle", label: "Area" },
    { key: "studyType", label: "Study type" },
    { key: "score", label: "Score" },
    { key: "dates", label: "Dates" },
    { key: "courses", label: "Courses" },
  ],
  project: [
    { key: "title", label: "Project name" },
    { key: "summary", label: "Description" },
    { key: "dates", label: "Dates" },
    { key: "highlights", label: "Highlights" },
    { key: "keywords", label: "Keywords" },
    { key: "roles", label: "Roles" },
    { key: "skills", label: "Skills used" },
  ],
  award: [
    { key: "title", label: "Award title" },
    { key: "subtitle", label: "Awarder" },
    { key: "summary", label: "Summary" },
    { key: "dates", label: "Date" },
    { key: "url", label: "Link" },
  ],
  certificate: [
    { key: "title", label: "Certificate name" },
    { key: "subtitle", label: "Issuer" },
    { key: "url", label: "Credential URL" },
    { key: "dates", label: "Date" },
  ],
  publication: [
    { key: "title", label: "Publication title" },
    { key: "subtitle", label: "Publisher" },
    { key: "summary", label: "Summary" },
    { key: "dates", label: "Date" },
  ],
  reference: [
    { key: "title", label: "Name" },
    { key: "subtitle", label: "Role" },
    { key: "summary", label: "Reference text" },
  ],
  skill: [
    { key: "title", label: "Skill name" },
    { key: "subtitle", label: "Level" },
    { key: "keywords", label: "Keywords" },
  ],
  language: [
    { key: "title", label: "Language" },
    { key: "subtitle", label: "Fluency" },
  ],
}

export function isKindHidden(fieldVisibility: FieldVisibility, kind: ItemKind): boolean {
  return fieldVisibility[kind]?.hidden === true
}

export function hiddenFieldsOf(
  fieldVisibility: FieldVisibility,
  kind: ItemKind
): Set<string> {
  return new Set(fieldVisibility[kind]?.fields ?? [])
}

/**
 * Whether one already-*selected* entry is hidden — independent of
 * `persona_items` membership. See `FieldVisibility.items`'s doc comment for
 * why this is a separate, non-destructive flag rather than deselecting.
 */
export function isItemHidden(
  fieldVisibility: FieldVisibility,
  kind: ItemKind,
  itemId: string
): boolean {
  return fieldVisibility[kind]?.items?.[itemId] === true
}

/** This Persona's picked entries for one kind, in selection order. */
export function selectedEntriesOf(
  persona: PersonaData,
  inventory: InventoryData,
  personaId: string,
  kind: ItemKind
): DbInventoryItem[] {
  const byId = new Map(inventory.items.map((item) => [item.id, item]))

  return persona.personaItems
    .filter((row) => row.personaId === personaId)
    .sort((a, b) => a.position - b.position)
    .flatMap((row) => {
      const item = byId.get(row.itemId)
      return item && item.kind === kind ? [item] : []
    })
}

/**
 * The line ids one entry currently takes — "which of this entry's
 * responsibilities/highlights/etc. show", independent of the field/item
 * hides above. Defaults to every line the entry has (set when the entry was
 * added to the Persona — see `setPersonaSectionItems`), until curated via
 * `setLineSelected`.
 */
export function selectedLineIdsOf(
  persona: PersonaData,
  personaId: string,
  itemId: string
): Set<string> {
  return new Set(
    persona.personaLines
      .filter((row) => row.personaId === personaId && row.itemId === itemId)
      .map((row) => row.lineId)
  )
}

/**
 * The Section kinds in current display order — rows sorted by their stored
 * `position`, any kind with no row yet (never reordered, or currently empty)
 * falling back to `SECTION_KINDS`' canonical order at the end. Drives both
 * the settings tree's reorder buttons and, once a Persona picks entries into
 * a kind, `buildResumeDocument`'s own `persona_sections.position` sort.
 */
export function orderedSectionKinds(
  data: PersonaData,
  personaId: string
): ItemKind[] {
  const positionByKind = new Map(
    data.personaSections
      .filter((row) => row.personaId === personaId)
      .map((row) => [row.kind, row.position])
  )

  return [...SECTION_KINDS].sort((a, b) => {
    const posA = positionByKind.get(a) ?? SECTION_KINDS.indexOf(a)
    const posB = positionByKind.get(b) ?? SECTION_KINDS.indexOf(b)
    return posA - posB
  })
}

/** Fixed display order for an entry's line groups — every dialog and template uses it. */
export const LINE_ORDER: LineKind[] = [
  "responsibilities",
  "highlights",
  "courses",
  "keywords",
  "roles",
]

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

/**
 * Partial ISO dates — `2014`, `2014-06`, `2014-06-29` — rendered readably.
 * Duplicated from `components/inventory/columns.tsx` rather than imported,
 * since that module imports `personaUsageCount` from here — importing back
 * would be a circular value dependency between the two.
 */
function formatPartialDate(value: string | null): string | null {
  if (!value) {
    return null
  }

  const [year, month, day] = value.split("-")
  if (!month) {
    return year
  }

  const name = MONTHS[Number(month) - 1] ?? month
  return day ? `${Number(day)} ${name} ${year}` : `${name} ${year}`
}

/** Kinds where a null `end_date` means "single date", not "ongoing". */
const SINGLE_DATE_KINDS: ItemKind[] = ["award", "certificate", "publication"]

/** Kinds a CV orders newest-first by date rather than by selection order. */
const DATE_SORTED_KINDS: ItemKind[] = [
  "work",
  "volunteer",
  "education",
  "project",
  "award",
  "certificate",
  "publication",
]

/**
 * Newest first. Ongoing entries (`endDate` null, non-single-date kind) sort
 * as if still running today; single-date kinds sort on `startDate` instead,
 * since they have no `endDate`. Partial-ISO strings (`"2014"`, `"2014-06"`)
 * compare correctly as plain strings. Ties (e.g. two ongoing roles) break on
 * `startDate`, also descending.
 */
function byDateDescending(a: DbInventoryItem, b: DbInventoryItem): number {
  const keyOf = (item: DbInventoryItem) =>
    SINGLE_DATE_KINDS.includes(item.kind)
      ? (item.startDate ?? "")
      : (item.endDate ?? "9999-99-99")

  return (
    keyOf(b).localeCompare(keyOf(a)) ||
    (b.startDate ?? "").localeCompare(a.startDate ?? "")
  )
}

function formatEntryDates(
  startDate: string | null,
  endDate: string | null,
  kind: ItemKind
): string | null {
  const start = formatPartialDate(startDate)
  if (!start) {
    return null
  }

  if (SINGLE_DATE_KINDS.includes(kind)) {
    return start
  }

  return `${start} – ${formatPartialDate(endDate) ?? "Present"}`
}

/**
 * Resolves one Persona into the flat, ordered shape a template renders.
 *
 * Sections arrive ordered, entries filtered to what the Persona selected,
 * lines narrowed to the chosen bullets. `fieldVisibility` is the *rendering
 * CV's* visibility choices (Batch 3, docs/user-request.md) — visibility is
 * no longer Persona content, so it's passed in rather than read off the
 * Persona. Callers with no CV context (the Persona's own read-only page, the
 * Templates gallery preview) simply omit it and get the full, untailored
 * Persona.
 */
export function buildResumeDocument(
  persona: PersonaData,
  inventory: InventoryStore,
  personaId: string,
  fieldVisibility: FieldVisibility = {}
): ResumeDocument {
  const found = findPersona(persona, personaId)
  if (!found) {
    throw new Error(`No Persona "${personaId}".`)
  }

  // Selected entries, minus any individually hidden via the Data tab — kept
  // separate from `field_visibility[kind].hidden`/`.fields`, which act on
  // the kind as a whole rather than one entry.
  const selectedIn = (kind: ItemKind): DbInventoryItem[] =>
    selectedEntriesOf(persona, inventory, personaId, kind).filter(
      (item) => !isItemHidden(fieldVisibility, kind, item.id)
    )

  const firstIn = (kind: ItemKind) => selectedIn(kind)[0]

  const contactFields = hiddenFieldsOf(fieldVisibility, "contact")

  const nameItem = !isKindHidden(fieldVisibility, "name") ? firstIn("name") : undefined
  const contactItem = !isKindHidden(fieldVisibility, "contact")
    ? firstIn("contact")
    : undefined
  const locationItem = !isKindHidden(fieldVisibility, "location")
    ? firstIn("location")
    : undefined
  const rawContact = contactItem ? contactDetails(contactItem) : null
  const contact = rawContact && {
    ...rawContact,
    email: contactFields.has("email") ? null : rawContact.email,
    phone: contactFields.has("phone") ? null : rawContact.phone,
    url: contactFields.has("website") ? null : rawContact.url,
  }
  const location = locationItem ? formatLocation(locationItem) : null
  const socials = !isKindHidden(fieldVisibility, "social")
    ? selectedIn("social").map((item) => ({
      network: item.title,
      username: item.subtitle,
      url: item.url,
    }))
    : []

  const sections = persona.personaSections
    .filter(
      (row) =>
        row.personaId === personaId &&
        !HEADER_KINDS.includes(row.kind) &&
        !isKindHidden(fieldVisibility, row.kind)
    )
    .sort((a, b) => a.position - b.position)
    .map((row) => {
      const items = selectedIn(row.kind)
      if (DATE_SORTED_KINDS.includes(row.kind)) {
        items.sort(byDateDescending)
      }
      return {
        kind: row.kind,
        heading: SECTION_HEADING[row.kind] ?? row.kind,
        entries: items.map((item) =>
          toEntry(
            persona,
            inventory,
            personaId,
            item,
            row.kind,
            hiddenFieldsOf(fieldVisibility, row.kind)
          )
        ),
        ...(row.kind === "skill"
          ? { skillGroups: buildSkillGroups(inventory, items) }
          : {}),
      }
    })
    // A section whose every entry was deleted still has a row; printing a bare
    // heading would be worse than omitting it. See spec 03.
    .filter((section) => section.entries.length > 0)

  return {
    personaId: found.id,
    personaName: found.name,
    name: nameItem?.title ?? "",
    headline: !isKindHidden(fieldVisibility, "headline")
      ? (firstIn("headline")?.title ?? null)
      : null,
    summary: !isKindHidden(fieldVisibility, "summary")
      ? (firstIn("summary")?.summary ?? null)
      : null,
    contact,
    location,
    socials,
    sections,
    contactParts: [
      contact?.email,
      contact?.phone,
      contact?.url?.replace(/^https?:\/\//, ""),
      ...socials.map(
        (social) => social.url?.replace(/^https?:\/\//, "") ?? social.network,
      ),
      location,
    ].filter((part): part is string => Boolean(part)),
  }
}

/** Groups already-visibility-filtered skill items by `categoryId`, category-`position` order, uncategorized items collected last under "Other". */
function buildSkillGroups(
  inventory: InventoryStore,
  items: DbInventoryItem[]
): ResumeSkillGroup[] {
  const byCategory = new Map<string | null, DbInventoryItem[]>()
  for (const item of items) {
    const key = item.categoryId
    const existing = byCategory.get(key)
    if (existing) {
      existing.push(item)
    } else {
      byCategory.set(key, [item])
    }
  }

  const categories = [...inventory.skillCategories].sort(
    (a, b) => a.position - b.position
  )
  const groups: ResumeSkillGroup[] = []
  for (const category of categories) {
    const catItems = byCategory.get(category.id)
    if (catItems?.length) {
      groups.push({ category: category.name, skills: catItems.map((i) => i.title) })
    }
  }
  const uncategorized = byCategory.get(null)
  if (uncategorized?.length) {
    groups.push({ category: "Other", skills: uncategorized.map((i) => i.title) })
  }
  return groups
}

function toEntry(
  persona: PersonaData,
  inventory: InventoryData,
  personaId: string,
  item: DbInventoryItem,
  kind: ItemKind,
  hiddenFields: Set<string>
): ResumeEntry {
  const chosen = selectedLineIdsOf(persona, personaId, item.id)

  const lineGroups = LINE_ORDER.flatMap((lineKind) => {
    if (hiddenFields.has(lineKind)) {
      return []
    }

    const items = linesOf(inventory, item.id, lineKind)
      .filter((line) => chosen.has(line.id))
      .map((line) => line.content)

    return items.length > 0 ? [{ kind: lineKind, items }] : []
  })

  const details = Object.fromEntries(
    Object.entries(item.details).filter(([key]) => !hiddenFields.has(key))
  )

  const summary = hiddenFields.has("summary") ? null : item.summary
  const metaLine = buildMetaLine(details)

  return {
    id: item.id,
    title: hiddenFields.has("title") ? "" : item.title,
    subtitle: hiddenFields.has("subtitle") ? null : item.subtitle,
    summary,
    url: hiddenFields.has("url") ? null : item.url,
    startDate: item.startDate,
    endDate: item.endDate,
    details,
    lineGroups,
    skills: hiddenFields.has("skills")
      ? []
      : skillsOf(inventory, item.id).map((skill) => skill.title),
    kind,
    dateRangeText: hiddenFields.has("dates")
      ? null
      : formatEntryDates(item.startDate, item.endDate, kind),
    keywords: lineGroups.find((g) => g.kind === "keywords")?.items ?? [],
    // The description leads the merged bullet list Classic renders — see
    // Batch 4, docs/user-request.md.
    bulletItems: [
      ...(summary ? [summary] : []),
      ...lineGroups.flatMap((g) => g.items),
    ],
    metaLine,
  }
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

/**
 * `"{location} ({workplaceType}, {employmentType})"` — drops `"on-site"`/
 * `"full-time"` as the implied default (an ATS-review fix, Batch 4 follow-up,
 * docs/user-request.md): stating them adds clutter without adding
 * information, but a genuine deviation (`"remote"`, `"contract"`, ...) is
 * worth printing.
 */
function buildMetaLine(details: Record<string, unknown>): string | null {
  const location = typeof details.location === "string" ? details.location : null
  const workplaceType =
    typeof details.workplaceType === "string" &&
      details.workplaceType.toLowerCase() !== "on-site"
      ? capitalize(details.workplaceType)
      : null
  const employmentType =
    typeof details.employmentType === "string" &&
      details.employmentType.toLowerCase() !== "full-time"
      ? capitalize(details.employmentType)
      : null

  const tags = [workplaceType, employmentType].filter(
    (tag): tag is string => tag !== null
  )
  const parts = [location, tags.length > 0 ? `(${tags.join(", ")})` : null].filter(
    (part): part is string => part !== null
  )
  return parts.length > 0 ? parts.join(" ") : null
}

// ---------------------------------------------------------------------------
// Mutators
// ---------------------------------------------------------------------------

export function requireUserId(store: PersonaStore): string {
  if (!store.userId) {
    throw new Error("No signed-in user.")
  }
  return store.userId
}

/** Creates a new Persona and returns it. */
export async function createPersona(
  store: PersonaStore,
  fields: { name: string; note?: string | null; tags?: string[] }
): Promise<DbPersona> {
  const userId = requireUserId(store)

  const { data, error } = await supabase
    .from("personas")
    .insert({
      user_id: userId,
      name: fields.name,
      note: fields.note ?? null,
      tags: fields.tags ?? [],
    })
    .select()
    .single()

  if (error) throw error

  const persona = mapPersonaRow(data)
  store.setPersonas((current) => [...current, persona])

  return persona
}

/** Flips a Persona's favourite flag and returns its new value. */
export async function togglePersonaFavorite(
  store: PersonaStore,
  personaId: string
): Promise<boolean> {
  const persona = store.personas.find((candidate) => candidate.id === personaId)

  if (!persona) {
    throw new Error(`No Persona "${personaId}".`)
  }

  const { data, error } = await supabase
    .from("personas")
    .update({ favorite: !persona.favorite })
    .eq("id", personaId)
    .select()
    .single()

  if (error) throw error

  const updated = mapPersonaRow(data)
  store.setPersonas((current) =>
    current.map((existing) => (existing.id === personaId ? updated : existing))
  )

  return updated.favorite
}

/** Renames a Persona, or updates its note/tags, and returns the updated row. */
export async function updatePersona(
  store: PersonaStore,
  personaId: string,
  patch: { name?: string; note?: string | null; tags?: string[] }
): Promise<DbPersona> {
  const { data, error } = await supabase
    .from("personas")
    .update({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.note !== undefined ? { note: patch.note } : {}),
      ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
    })
    .eq("id", personaId)
    .select()
    .single()

  if (error) throw error

  const updated = mapPersonaRow(data)
  store.setPersonas((current) =>
    current.map((existing) => (existing.id === personaId ? updated : existing))
  )

  return updated
}

/**
 * Copies a Persona's full content — sections, items, and lines — into a new
 * Persona under `fields`. A straight row-for-row copy, not a live link: the
 * two Personas share no rows afterward, matching what "duplicate" means
 * everywhere else in the app (e.g. `replaceItemSkills` in `lib/inventory.ts`
 * — full copy, not an incremental diff). `fields.note`/`fields.tags` come
 * from the caller (typically the source Persona's own, pre-filled into the
 * dialog and editable before confirming) rather than being copied here
 * automatically, so what you see in the dialog is exactly what gets saved.
 */
export async function duplicatePersona(
  store: PersonaStore,
  personaId: string,
  fields: { name: string; note: string | null; tags: string[] }
): Promise<DbPersona> {
  const userId = requireUserId(store)
  const source = store.personas.find((candidate) => candidate.id === personaId)
  if (!source) {
    throw new Error(`No Persona "${personaId}".`)
  }

  const { data, error: personaError } = await supabase
    .from("personas")
    .insert({
      user_id: userId,
      name: fields.name,
      note: fields.note,
      tags: fields.tags,
    })
    .select()
    .single()
  if (personaError) throw personaError

  const duplicated = mapPersonaRow(data)

  const sourceSections = store.personaSections.filter(
    (row) => row.personaId === personaId
  )
  if (sourceSections.length > 0) {
    const { error } = await supabase.from("persona_sections").insert(
      sourceSections.map((row) => ({
        persona_id: duplicated.id,
        kind: row.kind,
        position: row.position,
      }))
    )
    if (error) throw error
  }

  const sourceItems = store.personaItems.filter(
    (row) => row.personaId === personaId
  )
  if (sourceItems.length > 0) {
    const { error } = await supabase.from("persona_items").insert(
      sourceItems.map((row) => ({
        persona_id: duplicated.id,
        item_id: row.itemId,
        position: row.position,
      }))
    )
    if (error) throw error
  }

  const sourceLines = store.personaLines.filter(
    (row) => row.personaId === personaId
  )
  if (sourceLines.length > 0) {
    const { error } = await supabase.from("persona_lines").insert(
      sourceLines.map((row) => ({
        persona_id: duplicated.id,
        item_id: row.itemId,
        line_id: row.lineId,
        position: row.position,
      }))
    )
    if (error) throw error
  }

  store.refetch()

  return duplicated
}

/**
 * Deletes a Persona. Cascades in the database to its sections/items/lines —
 * mirrored here in local state so the UI doesn't wait on a refetch to
 * reflect it. Any application whose `cv_persona_id` pointed at this Persona
 * has it nulled server-side (`on delete set null`); that's not mirrored into
 * `ApplicationStore` here since this function only has `PersonaStore` — the
 * next Applications fetch picks it up, same as any other cross-store change.
 */
export async function deletePersona(
  store: PersonaStore,
  personaId: string
): Promise<void> {
  const { error } = await supabase.from("personas").delete().eq("id", personaId)
  if (error) throw error

  store.setPersonas((current) => current.filter((row) => row.id !== personaId))
  store.setPersonaSections((current) =>
    current.filter((row) => row.personaId !== personaId)
  )
  store.setPersonaItems((current) =>
    current.filter((row) => row.personaId !== personaId)
  )
  store.setPersonaLines((current) =>
    current.filter((row) => row.personaId !== personaId)
  )
}

/**
 * Full-replaces the item selection for one Persona section, and
 * default-selects every line of any newly-added item.
 *
 * `previousItemIds` is caller-supplied — `persona_items` has no `kind`
 * column, so resolving "which of this persona's items belong to `kind`"
 * needs a cross-reference against Inventory data the caller already has in
 * scope; recomputing it here would just be a redundant pass over the same
 * data. `inventory` resolves "all lines of a newly-added item" — currently
 * all of them by position; centralizing that rule here is where per-bullet
 * curation plugs in later.
 */
export async function setPersonaSectionItems(
  store: PersonaStore,
  inventory: InventoryData,
  personaId: string,
  kind: ItemKind,
  itemIds: string[],
  previousItemIds: string[]
): Promise<void> {
  if (PICK_ONE_KINDS.includes(kind) && itemIds.length > 1) {
    throw new Error(`"${kind}" takes at most one selected entry.`)
  }

  if (itemIds.length === 0) {
    const { error } = await supabase
      .from("persona_sections")
      .delete()
      .eq("persona_id", personaId)
      .eq("kind", kind)

    if (error) throw error
  } else {
    const { error } = await supabase.from("persona_sections").upsert(
      { persona_id: personaId, kind, position: SECTION_KINDS.indexOf(kind) },
      { onConflict: "persona_id,kind" }
    )

    if (error) throw error
  }

  const removed = previousItemIds.filter((id) => !itemIds.includes(id))

  if (removed.length > 0) {
    // Cascades to persona_lines automatically — FK
    // persona_lines (persona_id, item_id) → persona_items(...) on delete cascade.
    const { error } = await supabase
      .from("persona_items")
      .delete()
      .eq("persona_id", personaId)
      .in("item_id", removed)

    if (error) throw error
  }

  if (itemIds.length > 0) {
    const { error } = await supabase.from("persona_items").upsert(
      itemIds.map((itemId, position) => ({
        persona_id: personaId,
        item_id: itemId,
        position,
      })),
      { onConflict: "persona_id,item_id" }
    )

    if (error) throw error
  }

  const added = itemIds.filter((id) => !previousItemIds.includes(id))

  if (added.length > 0) {
    const lineRows = added.flatMap((itemId) =>
      allLinesOf(inventory, itemId)
        .sort((a, b) => a.position - b.position)
        .map((line, position) => ({
          persona_id: personaId,
          item_id: itemId,
          line_id: line.id,
          position,
        }))
    )

    if (lineRows.length > 0) {
      const { error } = await supabase.from("persona_lines").insert(lineRows)
      if (error) throw error
    }
  }

  store.refetch()
}

/**
 * Includes or drops one bullet — a Work entry's responsibility, an
 * Education entry's course, a Skill's keyword — from what the Persona
 * takes from that entry. Unlike `setItemHidden`, this writes straight to
 * `persona_lines`: dropping a bullet here is the same "not selected" state
 * as when the entry was first added and the bullet wasn't picked, and
 * re-including it later doesn't lose anything — the bullet's content lives
 * in `inventory_lines`, untouched either way.
 */
export async function setLineSelected(
  store: PersonaStore,
  personaId: string,
  itemId: string,
  lineId: string,
  selected: boolean
): Promise<void> {
  if (!selected) {
    const { error } = await supabase
      .from("persona_lines")
      .delete()
      .eq("persona_id", personaId)
      .eq("line_id", lineId)

    if (error) throw error
  } else {
    const position = store.personaLines.filter(
      (row) => row.personaId === personaId && row.itemId === itemId
    ).length

    const { error } = await supabase.from("persona_lines").insert({
      persona_id: personaId,
      item_id: itemId,
      line_id: lineId,
      position,
    })

    if (error) throw error
  }

  store.refetch()
}

/**
 * Reorders the Section kinds (Work, Education, ...) — the order entries
 * print in. Writes every `SECTION_KINDS` position in one upsert rather than
 * patching just the two swapped kinds, so every kind has an explicit
 * `persona_sections` row afterward — including ones with no items yet —
 * and the settings tree's reorder buttons stay simple index swaps.
 */
export async function reorderPersonaSections(
  store: PersonaStore,
  personaId: string,
  orderedKinds: ItemKind[]
): Promise<void> {
  const { error } = await supabase.from("persona_sections").upsert(
    orderedKinds.map((kind, position) => ({
      persona_id: personaId,
      kind,
      position,
    })),
    { onConflict: "persona_id,kind" }
  )

  if (error) throw error

  store.refetch()
}
