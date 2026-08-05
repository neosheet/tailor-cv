import {
  contacts,
  headlines,
  locations,
  names,
  socials,
  summaries,
  USER_ID,
} from "./data/basics"
import { education } from "./data/education"
import {
  awards,
  certificates,
  interests,
  languages,
  publications,
  references,
  volunteer,
} from "./data/misc"
import { projects } from "./data/projects"
import { skills } from "./data/skills"
import { work } from "./data/work"
import { flatten } from "./flatten"
import { listTags } from "./tags"
import type {
  DbInventoryItem,
  DbInventoryLine,
  ItemKind,
  LineKind,
  MockDatabase,
  SourcePool,
} from "./types"

const pools: SourcePool[] = [
  { kind: "name", items: names },
  { kind: "headline", items: headlines },
  { kind: "summary", items: summaries },
  { kind: "contact", items: contacts },
  { kind: "location", items: locations },
  { kind: "social", items: socials },
  { kind: "work", items: work },
  { kind: "education", items: education },
  { kind: "skill", items: skills },
  { kind: "project", items: projects },
  { kind: "volunteer", items: volunteer },
  { kind: "award", items: awards },
  { kind: "certificate", items: certificates },
  { kind: "publication", items: publications },
  { kind: "language", items: languages },
  { kind: "interest", items: interests },
  { kind: "reference", items: references },
]

const { items, lines, itemSkills } = flatten(pools, USER_ID)

/** The whole dataset, in the shape Supabase will return it. */
export const mockDb: MockDatabase = {
  profile: {
    id: USER_ID,
    createdAt: "2025-01-06T00:00:00.000Z",
    updatedAt: "2025-01-06T00:00:00.000Z",
  },
  items,
  lines,
  itemSkills,
}

export { USER_ID }
export type * from "./types"

// ---------------------------------------------------------------------------
// Convenience selectors
//
// Thin helpers so pages can render without hand-filtering. They mirror the queries
// the real data layer will run, so swapping them for Supabase calls later is a
// like-for-like replacement.
// ---------------------------------------------------------------------------

/**
 * Flips an entry's favourite flag and returns its new value.
 *
 * The one write in the mock layer, and it mutates the row in place — which is
 * what the Supabase `update` will do to the same field. It lasts for the session
 * only: a reload re-derives the dataset from `data/`, so nothing here pretends
 * to be persistence.
 */
export function toggleFavorite(itemId: string): boolean {
  const item = items.find((candidate) => candidate.id === itemId)

  if (!item) {
    throw new Error(`No item "${itemId}".`)
  }

  item.favorite = !item.favorite
  item.updatedAt = new Date().toISOString()

  return item.favorite
}

/**
 * The writable subset of `DbInventoryItem` a Basics form submits.
 *
 * Leaves out everything a Basics form never edits: `id`, `userId`, `kind`,
 * `startDate`/`endDate`, `yearsExperience`, `favorite`, `position`, and the
 * timestamps — those are either fixed at creation or owned by other UI.
 */
export type BasicsItemInput = {
  title: string
  subtitle?: string | null
  summary?: string | null
  url?: string | null
  details?: Record<string, unknown>
  tags?: string[]
  note?: string | null
}

/** Throws naming whichever names aren't in the tag registry. */
function assertTagsRegistered(tags: string[]): void {
  const registered = new Set(listTags().map((tag) => tag.name))
  const unknown = tags.filter((tag) => !registered.has(tag))

  if (unknown.length > 0) {
    throw new Error(`Unknown tag(s): ${unknown.join(", ")}.`)
  }
}

/**
 * Adds a new row to a pool and returns it.
 *
 * Mirrors what a Supabase `insert` will do: a fresh id, appended to the end of
 * the pool's own order, both timestamps set to now.
 */
export function createItem(
  kind: ItemKind,
  input: BasicsItemInput
): DbInventoryItem {
  const tags = input.tags ?? []
  assertTagsRegistered(tags)

  const now = new Date().toISOString()
  const item: DbInventoryItem = {
    id: `${kind}-${crypto.randomUUID().slice(0, 8)}`,
    userId: USER_ID,
    kind,
    title: input.title,
    subtitle: input.subtitle ?? null,
    summary: input.summary ?? null,
    url: input.url ?? null,
    startDate: null,
    endDate: null,
    details: input.details ?? {},
    yearsExperience: null,
    tags,
    note: input.note ?? null,
    favorite: false,
    position: itemsOfKind(kind).length,
    createdAt: now,
    updatedAt: now,
  }

  items.push(item)

  return item
}

/**
 * Merges a patch onto an existing row and returns it.
 *
 * Mirrors what the Supabase `update` will do to the same columns — same style
 * as `toggleFavorite`.
 */
export function updateItem(
  itemId: string,
  patch: BasicsItemInput
): DbInventoryItem {
  const item = items.find((candidate) => candidate.id === itemId)

  if (!item) {
    throw new Error(`No item "${itemId}".`)
  }

  if (patch.tags) {
    assertTagsRegistered(patch.tags)
  }

  Object.assign(item, patch)
  item.updatedAt = new Date().toISOString()

  return item
}

/**
 * Removes a row from its pool.
 *
 * A hard splice, not a soft delete — `deleted_at` (spec 08) is "Spec only" and
 * not implemented anywhere else in the mock layer yet, so adding it just here
 * would be inconsistent with the rest of the app.
 */
export function deleteItem(itemId: string): void {
  const index = items.findIndex((candidate) => candidate.id === itemId)

  if (index === -1) {
    throw new Error(`No item "${itemId}".`)
  }

  items.splice(index, 1)
}

/** Favourites first, then the pool's own order. */
export function byFavouriteThenPosition(
  a: DbInventoryItem,
  b: DbInventoryItem
): number {
  return Number(b.favorite) - Number(a.favorite) || a.position - b.position
}

/**
 * Every item in one pool, in Inventory display order — favourites first.
 *
 * Display only. `buildResumeDocument` orders a CV's entries by
 * `cv_items.position` and never calls this, so favouriting cannot reorder or
 * otherwise affect a rendered CV. See Favourites in spec 02.
 */
export function itemsOfKind(kind: ItemKind): DbInventoryItem[] {
  return items
    .filter((item) => item.kind === kind)
    .sort(byFavouriteThenPosition)
}

/** One entry's nested list — a job's highlights, a skill's keywords. */
export function linesOf(itemId: string, listKind: LineKind): DbInventoryLine[] {
  return lines
    .filter((line) => line.itemId === itemId && line.listKind === listKind)
    .sort((a, b) => a.position - b.position)
}

/** Every line belonging to an entry, whatever the list. */
export function allLinesOf(itemId: string): DbInventoryLine[] {
  return lines.filter((line) => line.itemId === itemId)
}

/** The skills an entry used, resolved to full items. */
export function skillsOf(itemId: string): DbInventoryItem[] {
  const linked = itemSkills
    .filter((link) => link.itemId === itemId)
    .sort((a, b) => a.position - b.position)

  return linked.flatMap(
    (link) => items.find((item) => item.id === link.skillId) ?? []
  )
}

/** The reverse lookup — which entries used this skill. */
export function entriesUsingSkill(skillId: string): DbInventoryItem[] {
  const ids = new Set(
    itemSkills.filter((link) => link.skillId === skillId).map((l) => l.itemId)
  )
  return items.filter((item) => ids.has(item.id))
}

/**
 * Lines carrying a tag — the filter that makes tailoring quick.
 *
 * The list of tags themselves is not derived from usage any more. It lives in the
 * registry — `listTags()` in `mocks/tags.ts`, mirroring the `tags` table.
 */
export function linesWithTag(tag: string): DbInventoryLine[] {
  return lines.filter((line) => line.tags.includes(tag))
}

// ---------------------------------------------------------------------------
// Basics
//
// The six pools behind the Basics page. `details` is jsonb in the database and
// `Record<string, unknown>` here, so these readers are where that shape is
// pinned down — the UI never reaches into `details` directly.
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
export function poolCounts(): Record<ItemKind, number> {
  const counts = {} as Record<ItemKind, number>
  for (const pool of pools) counts[pool.kind] = pool.items.length
  return counts
}
