import { Constants } from "@/lib/database.types"
import type { Json } from "@/lib/database.types"
import { mapItemRow, mapLineRow, mapItemSkillRow } from "@/lib/inventory-store"
import type { InventoryData, InventoryStore } from "@/lib/inventory-store"
import { requireUserId } from "@/lib/store-context"
import { supabase } from "@/lib/supabase"
import type {
  DbInventoryItem,
  DbInventoryLine,
  DbItemSkill,
  ItemKind,
  LineKind,
} from "@/mocks/types"

export type {
  DbInventoryItem,
  DbInventoryLine,
  DbItemSkill,
  ItemKind,
  LineKind,
} from "@/mocks/types"

/**
 * The Supabase-backed replacement for `src/mocks/index.ts`.
 *
 * `columns.tsx` calls selectors like `linesOf(itemId, listKind)`
 * *synchronously* from inside a `PoolColumn.cell` — a plain function invoked
 * per row while `PoolTable` renders, not a React component. A live async
 * Supabase call can't work there, and neither can a hook: `cell` runs a
 * variable number of times per render (once per visible row), which breaks
 * the rules of hooks. The same is true of plain helpers like `toEntry` in
 * `src/lib/cv.ts` and `describeSelection` in `item-detail-dialog.tsx`.
 *
 * So every selector below stays a **plain, synchronous function**, and takes
 * the already-fetched store data as an explicit first argument (an
 * `InventoryData`) instead of reading `useInventoryStore()` itself. Callers
 * that *are* components call the hook once at the top of their render and
 * pass the result down — the same object can be threaded through any number
 * of selector calls, including ones buried in non-component callbacks. This
 * is the one part of the port that isn't a verbatim copy of the mock's
 * function bodies: every mock selector closed over its module-level `items`/
 * `lines`/`itemSkills` arrays directly, which a fetched-once-per-session
 * store can't do.
 *
 * The four mutators (`createItem`, `updateItem`, `deleteItem`,
 * `toggleFavorite`) are async and take the full `InventoryStore` (not just
 * `InventoryData`) as their first argument, since they need both read access
 * (to validate tags, find the current row) and the store's setters to update
 * local state after a successful write — mirroring how the mocks mutate
 * `items`/`lines` in place.
 */

// ---------------------------------------------------------------------------
// Pure selectors
// ---------------------------------------------------------------------------

/** Favourites first, then the pool's own order. */
export function byFavouriteThenPosition(
  a: DbInventoryItem,
  b: DbInventoryItem
): number {
  return Number(b.favorite) - Number(a.favorite) || a.position - b.position
}

/** Every item in one pool, in Inventory display order — favourites first. */
export function itemsOfKind(
  data: InventoryData,
  kind: ItemKind
): DbInventoryItem[] {
  return data.items
    .filter((item) => item.kind === kind)
    .sort(byFavouriteThenPosition)
}

/** One entry's nested list — a job's highlights, a skill's keywords. */
export function linesOf(
  data: InventoryData,
  itemId: string,
  listKind: LineKind
): DbInventoryLine[] {
  return data.lines
    .filter((line) => line.itemId === itemId && line.listKind === listKind)
    .sort((a, b) => a.position - b.position)
}

/** Every line belonging to an entry, whatever the list. */
export function allLinesOf(
  data: InventoryData,
  itemId: string
): DbInventoryLine[] {
  return data.lines.filter((line) => line.itemId === itemId)
}

/** The skills an entry used, resolved to full items. */
export function skillsOf(
  data: InventoryData,
  itemId: string
): DbInventoryItem[] {
  const linked = data.itemSkills
    .filter((link) => link.itemId === itemId)
    .sort((a, b) => a.position - b.position)

  return linked.flatMap(
    (link) => data.items.find((item) => item.id === link.skillId) ?? []
  )
}

/** The reverse lookup — which entries used this skill. */
export function entriesUsingSkill(
  data: InventoryData,
  skillId: string
): DbInventoryItem[] {
  const ids = new Set(
    data.itemSkills
      .filter((link) => link.skillId === skillId)
      .map((l) => l.itemId)
  )
  return data.items.filter((item) => ids.has(item.id))
}

/** Lines carrying a tag — the filter that makes tailoring quick. */
export function linesWithTag(
  data: InventoryData,
  tag: string
): DbInventoryLine[] {
  return data.lines.filter((line) => line.tags.includes(tag))
}

// ---------------------------------------------------------------------------
// Basics
// ---------------------------------------------------------------------------

/** The Basics kinds, in the order the page shows them. */
export const BASICS_KINDS = [
  "name",
  "headline",
  "summary",
  "contact",
  "location",
  "social",
] as const satisfies readonly ItemKind[]

export type BasicsKind = (typeof BASICS_KINDS)[number]

/**
 * The writable subset of `DbInventoryItem` an item form submits.
 *
 * Leaves out everything no pool's form edits directly: `id`, `userId`,
 * `kind`, `favorite`, `position`, and the timestamps — those are either
 * fixed at creation or owned by other UI.
 */
export type ItemInput = {
  title: string
  subtitle?: string | null
  summary?: string | null
  url?: string | null
  details?: Record<string, unknown>
  tags?: string[]
  note?: string | null
  startDate?: string | null
  endDate?: string | null
  yearsExperience?: number | null
  /** Skills only. */
  categoryId?: string | null
}

export type ContactDetails = {
  email: string | null
  phone: string | null
  url: string | null
  image: string | null
}

export function contactDetails(item: DbInventoryItem): ContactDetails {
  const details = item.details as { phone?: string; image?: string | null }
  return {
    email: item.subtitle,
    phone: details.phone ?? null,
    url: item.url,
    image: details.image ?? null,
  }
}

export type LocationDetails = {
  city: string
  region: string | null
  address: string | null
  postalCode: string | null
  countryCode: string | null
}

export function locationDetails(item: DbInventoryItem): LocationDetails {
  const details = item.details as {
    address?: string | null
    postalCode?: string | null
    countryCode?: string | null
  }
  return {
    city: item.title,
    region: item.subtitle,
    address: details.address ?? null,
    postalCode: details.postalCode ?? null,
    countryCode: details.countryCode ?? null,
  }
}

/** "Jakarta, DKI Jakarta 12190, ID" — skipping whatever is missing. */
export function formatLocation(item: DbInventoryItem): string {
  const { city, region, postalCode, countryCode } = locationDetails(item)
  const locality = [city, region].filter(Boolean).join(", ")
  return [[locality, postalCode].filter(Boolean).join(" "), countryCode]
    .filter(Boolean)
    .join(", ")
}

/** Row counts per pool. Handy for the Inventory index page. */
export function poolCounts(data: InventoryData): Record<ItemKind, number> {
  const counts = {} as Record<ItemKind, number>
  for (const kind of Constants.public.Enums.item_kind) {
    counts[kind] = 0
  }
  for (const item of data.items) {
    counts[item.kind] += 1
  }
  return counts
}

// ---------------------------------------------------------------------------
// Mutators
// ---------------------------------------------------------------------------

/** Throws naming whichever names aren't in the tag registry. */
function assertTagsRegistered(store: InventoryStore, tags: string[]): void {
  const registered = new Set(store.tags)
  const unknown = tags.filter((tag) => !registered.has(tag))

  if (unknown.length > 0) {
    throw new Error(`Unknown tag(s): ${unknown.join(", ")}.`)
  }
}

/** Adds a new row to a pool and returns it. */
export async function createItem(
  store: InventoryStore,
  kind: ItemKind,
  input: ItemInput
): Promise<DbInventoryItem> {
  const userId = requireUserId(store)
  const tags = input.tags ?? []
  assertTagsRegistered(store, tags)

  const { data, error } = await supabase
    .from("inventory_items")
    .insert({
      user_id: userId,
      kind,
      title: input.title,
      subtitle: input.subtitle ?? null,
      summary: input.summary ?? null,
      url: input.url ?? null,
      details: (input.details ?? {}) as unknown as Json,
      tags,
      note: input.note ?? null,
      start_date: input.startDate ?? null,
      end_date: input.endDate ?? null,
      years_experience: input.yearsExperience ?? null,
      category_id: input.categoryId ?? null,
      position: itemsOfKind(store, kind).length,
    })
    .select()
    .single()

  if (error) throw error

  const item = mapItemRow(data)
  store.setItems((current) => [...current, item])

  return item
}

/** Merges a patch onto an existing row and returns it. */
export async function updateItem(
  store: InventoryStore,
  itemId: string,
  patch: ItemInput
): Promise<DbInventoryItem> {
  if (patch.tags) {
    assertTagsRegistered(store, patch.tags)
  }

  const { data, error } = await supabase
    .from("inventory_items")
    .update({
      title: patch.title,
      ...(patch.subtitle !== undefined ? { subtitle: patch.subtitle } : {}),
      ...(patch.summary !== undefined ? { summary: patch.summary } : {}),
      ...(patch.url !== undefined ? { url: patch.url } : {}),
      ...(patch.details !== undefined
        ? { details: patch.details as unknown as Json }
        : {}),
      ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
      ...(patch.note !== undefined ? { note: patch.note } : {}),
      ...(patch.startDate !== undefined
        ? { start_date: patch.startDate }
        : {}),
      ...(patch.endDate !== undefined ? { end_date: patch.endDate } : {}),
      ...(patch.yearsExperience !== undefined
        ? { years_experience: patch.yearsExperience }
        : {}),
      ...(patch.categoryId !== undefined ? { category_id: patch.categoryId } : {}),
    })
    .eq("id", itemId)
    .select()
    .single()

  if (error) throw error

  const item = mapItemRow(data)
  store.setItems((current) =>
    current.map((existing) => (existing.id === itemId ? item : existing))
  )

  return item
}

/** Removes a row from its pool — a hard delete, matching the schema. */
export async function deleteItem(
  store: InventoryStore,
  itemId: string
): Promise<void> {
  const { error } = await supabase
    .from("inventory_items")
    .delete()
    .eq("id", itemId)

  if (error) throw error

  store.setItems((current) => current.filter((item) => item.id !== itemId))
  store.setLines((current) => current.filter((line) => line.itemId !== itemId))
  store.setItemSkills((current) =>
    current.filter((link) => link.itemId !== itemId && link.skillId !== itemId)
  )
}

/** Flips an entry's favourite flag and returns its new value. */
export async function toggleFavorite(
  store: InventoryStore,
  itemId: string
): Promise<boolean> {
  const item = store.items.find((candidate) => candidate.id === itemId)

  if (!item) {
    throw new Error(`No item "${itemId}".`)
  }

  const { data, error } = await supabase
    .from("inventory_items")
    .update({ favorite: !item.favorite })
    .eq("id", itemId)
    .select()
    .single()

  if (error) throw error

  const updated = mapItemRow(data)
  store.setItems((current) =>
    current.map((existing) => (existing.id === itemId ? updated : existing))
  )

  return updated.favorite
}

/** Adds a new row to one entry's nested list and returns it. */
export async function createLine(
  store: InventoryStore,
  itemId: string,
  listKind: LineKind,
  input: { content: string; tags?: string[]; note?: string | null }
): Promise<DbInventoryLine> {
  const tags = input.tags ?? []
  assertTagsRegistered(store, tags)

  const { data, error } = await supabase
    .from("inventory_lines")
    .insert({
      item_id: itemId,
      list_kind: listKind,
      content: input.content,
      tags,
      note: input.note ?? null,
      position: linesOf(store, itemId, listKind).length,
    })
    .select()
    .single()

  if (error) throw error

  const line = mapLineRow(data)
  store.setLines((current) => [...current, line])

  return line
}

/** Merges a patch onto an existing line and returns it. */
export async function updateLine(
  store: InventoryStore,
  lineId: string,
  patch: {
    content?: string
    tags?: string[]
    note?: string | null
    position?: number
  }
): Promise<DbInventoryLine> {
  if (patch.tags) {
    assertTagsRegistered(store, patch.tags)
  }

  const { data, error } = await supabase
    .from("inventory_lines")
    .update({
      ...(patch.content !== undefined ? { content: patch.content } : {}),
      ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
      ...(patch.note !== undefined ? { note: patch.note } : {}),
      ...(patch.position !== undefined ? { position: patch.position } : {}),
    })
    .eq("id", lineId)
    .select()
    .single()

  if (error) throw error

  const line = mapLineRow(data)
  store.setLines((current) =>
    current.map((existing) => (existing.id === lineId ? line : existing))
  )

  return line
}

/** Removes a row from its nested list — a hard delete, matching the schema. */
export async function deleteLine(
  store: InventoryStore,
  lineId: string
): Promise<void> {
  const { error } = await supabase
    .from("inventory_lines")
    .delete()
    .eq("id", lineId)

  if (error) throw error

  store.setLines((current) => current.filter((line) => line.id !== lineId))
}

/**
 * Full-replaces one entry's skill links — deletes every existing link for
 * `itemId` and inserts fresh rows from `skillIds`, in order. Not an
 * incremental diff: there's no reorder-in-place UI for this list (just
 * add/remove + save), and `item_skills` has no soft-delete semantics to
 * preserve.
 */
export async function replaceItemSkills(
  store: InventoryStore,
  itemId: string,
  skillIds: string[]
): Promise<void> {
  const { error: deleteError } = await supabase
    .from("item_skills")
    .delete()
    .eq("item_id", itemId)

  if (deleteError) throw deleteError

  let inserted: DbItemSkill[] = []

  if (skillIds.length > 0) {
    const { data, error: insertError } = await supabase
      .from("item_skills")
      .insert(
        skillIds.map((skillId, position) => ({
          item_id: itemId,
          skill_id: skillId,
          position,
        }))
      )
      .select()

    if (insertError) throw insertError

    inserted = (data ?? []).map(mapItemSkillRow)
  }

  store.setItemSkills((current) => [
    ...current.filter((link) => link.itemId !== itemId),
    ...inserted,
  ])
}
