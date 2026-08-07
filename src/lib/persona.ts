import { allLinesOf, contactDetails, formatLocation, linesOf, skillsOf } from "@/lib/inventory"
import type { InventoryData } from "@/lib/inventory-store"
import {
  mapPersonaRow,
  type DbPersona,
  type PersonaData,
  type PersonaStore,
} from "@/lib/persona-store"
import { supabase } from "@/lib/supabase"
import type { DbInventoryItem, ItemKind, LineKind } from "@/mocks/types"

export type { DbPersona, PersonaData, PersonaStore } from "@/lib/persona-store"

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
  /** The entry's section kind, denormalized so a template can branch on it without reaching into an ancestor scope. */
  kind: ItemKind
  /** Pre-formatted date range ("Jan 2020 – Present"), or a single date for award/certificate/publication kinds. */
  dateRangeText: string | null
  /** The entry's "keywords" line group items, if any — the skill entry's inline keyword suffix. */
  keywords: string[]
}

export type ResumeSection = {
  kind: ItemKind
  heading: string
  entries: ResumeEntry[]
}

export type ResumeDocument = {
  personaId: string
  personaName: string
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
  /** Contact line, pre-assembled: email, phone, location, url, then each social — blanks already dropped. */
  contactParts: string[]
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

const LINE_ORDER: LineKind[] = [
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
 * lines narrowed to the chosen bullets.
 */
export function buildResumeDocument(
  persona: PersonaData,
  inventory: InventoryData,
  personaId: string
): ResumeDocument {
  const found = findPersona(persona, personaId)
  if (!found) {
    throw new Error(`No Persona "${personaId}".`)
  }

  const byId = new Map(inventory.items.map((item) => [item.id, item]))

  const selectedIn = (kind: ItemKind): DbInventoryItem[] =>
    persona.personaItems
      .filter((row) => row.personaId === personaId)
      .sort((a, b) => a.position - b.position)
      .flatMap((row) => {
        const item = byId.get(row.itemId)
        return item && item.kind === kind ? [item] : []
      })

  const firstIn = (kind: ItemKind) => selectedIn(kind)[0]

  const nameItem = firstIn("name")
  const contactItem = firstIn("contact")
  const locationItem = firstIn("location")
  const contact = contactItem ? contactDetails(contactItem) : null
  const location = locationItem ? formatLocation(locationItem) : null
  const socials = selectedIn("social").map((item) => ({
    network: item.title,
    username: item.subtitle,
    url: item.url,
  }))

  const sections = persona.personaSections
    .filter((row) => row.personaId === personaId && !HEADER_KINDS.includes(row.kind))
    .sort((a, b) => a.position - b.position)
    .map((row) => ({
      kind: row.kind,
      heading: SECTION_HEADING[row.kind] ?? row.kind,
      entries: selectedIn(row.kind).map((item) =>
        toEntry(persona, inventory, personaId, item, row.kind)
      ),
    }))
    // A section whose every entry was deleted still has a row; printing a bare
    // heading would be worse than omitting it. See spec 03.
    .filter((section) => section.entries.length > 0)

  return {
    personaId: found.id,
    personaName: found.name,
    name: nameItem?.title ?? "",
    headline: firstIn("headline")?.title ?? null,
    summary: firstIn("summary")?.summary ?? null,
    contact,
    location,
    socials,
    sections,
    contactParts: [
      contact?.email,
      contact?.phone,
      location,
      contact?.url?.replace(/^https?:\/\//, ""),
      ...socials.map(
        (social) => social.url?.replace(/^https?:\/\//, "") ?? social.network
      ),
    ].filter((part): part is string => Boolean(part)),
  }
}

function toEntry(
  persona: PersonaData,
  inventory: InventoryData,
  personaId: string,
  item: DbInventoryItem,
  kind: ItemKind
): ResumeEntry {
  const chosen = new Set(
    persona.personaLines
      .filter((row) => row.personaId === personaId && row.itemId === item.id)
      .map((row) => row.lineId)
  )

  const lineGroups = LINE_ORDER.flatMap((lineKind) => {
    const items = linesOf(inventory, item.id, lineKind)
      .filter((line) => chosen.has(line.id))
      .map((line) => line.content)

    return items.length > 0 ? [{ kind: lineKind, items }] : []
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
    skills: skillsOf(inventory, item.id).map((skill) => skill.title),
    kind,
    dateRangeText: formatEntryDates(item.startDate, item.endDate, kind),
    keywords: lineGroups.find((g) => g.kind === "keywords")?.items ?? [],
  }
}

// ---------------------------------------------------------------------------
// Mutators
// ---------------------------------------------------------------------------

function requireUserId(store: PersonaStore): string {
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
 * Deletes a Persona. Cascades in the database to its sections/items/lines
 * and any CVs built from it (`cvs.persona_id references personas(id) on
 * delete cascade`) — mirrored here in local state so the UI doesn't wait on
 * a refetch to reflect it.
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
  store.setCvs((current) => current.filter((row) => row.personaId !== personaId))
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
