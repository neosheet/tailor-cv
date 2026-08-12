import type { InventoryStore } from "@/lib/inventory-store"
import { supabase } from "@/lib/supabase"

/**
 * The Supabase-backed replacement for `src/mocks/tags.ts`.
 *
 * Same explicit-argument design as `src/lib/inventory.ts`: `validateTagName`
 * and `listTags`/`usageOfAny` are plain functions that take the current
 * registry (or the whole `InventoryStore`) as an argument rather than closing
 * over module state or calling `useInventoryStore()` themselves, since
 * `TagInput` and other consumers need to call these from non-component code
 * paths too.
 */

/** Lower-case letters and digits. Matches the CHECK on `tags.name`. */
export const TAG_NAME_PATTERN = /^[a-z0-9]+$/

export type TagUsage = {
  name: string
  /** Entries carrying the tag. */
  itemCount: number
  /** Bullet points and keywords carrying it. */
  lineCount: number
}

/** Trim and lower-case, the normalisation the real write does before inserting. */
export function normaliseTagName(raw: string): string {
  return raw.trim().toLowerCase()
}

/**
 * Why `name` cannot be used, or null when it can.
 *
 * Takes the raw input and normalises it first, so `Backend ` fails as a
 * duplicate of `backend` rather than passing as something new. `registry` is
 * the store's current tag names — the caller pulls it from
 * `useInventoryStore().tags`.
 */
export function validateTagName(
  raw: string,
  registry: string[],
  /** The tag being renamed, which is allowed to keep its own name. */
  options: { except?: string } = {}
): string | null {
  const name = normaliseTagName(raw)

  if (!name) {
    return "Enter a tag name."
  }

  if (!TAG_NAME_PATTERN.test(name)) {
    return "Letters and numbers only — no spaces, punctuation, or symbols."
  }

  if (name !== options.except && registry.includes(name)) {
    return `"${name}" already exists.`
  }

  return null
}

/** Every tag with its usage, alphabetical — what the management screen lists. */
export function listTags(store: InventoryStore): TagUsage[] {
  return store.tags.map((name) => ({
    name,
    itemCount: store.items.filter((item) => item.tags.includes(name)).length,
    lineCount: store.lines.filter((line) => line.tags.includes(name)).length,
  }))
}

/**
 * Rows carrying at least one of `names` — the usage a batch delete will strip.
 *
 * Counted over distinct rows rather than summed per tag, because an entry
 * tagged both `backend` and `api` is one entry losing labels, not two.
 */
export function usageOfAny(
  store: InventoryStore,
  names: string[]
): Omit<TagUsage, "name"> {
  const wanted = new Set(names)
  const carries = (tags: string[]) => tags.some((tag) => wanted.has(tag))

  return {
    itemCount: store.items.filter((item) => carries(item.tags)).length,
    lineCount: store.lines.filter((line) => carries(line.tags)).length,
  }
}

/** Throws on anything `validateTagName` rejects — the UI checks before calling. */
function assertValid(raw: string, registry: string[], except?: string): string {
  const problem = validateTagName(raw, registry, { except })

  if (problem) {
    throw new Error(problem)
  }

  return normaliseTagName(raw)
}

function requireUserId(store: InventoryStore): string {
  if (!store.userId) {
    throw new Error("No signed-in user.")
  }
  return store.userId
}

/** A registry row and nothing else — a new tag is on no rows yet. */
export async function createTag(
  store: InventoryStore,
  raw: string
): Promise<string> {
  const userId = requireUserId(store)
  const name = assertValid(raw, store.tags)

  const { error } = await supabase
    .from("tags")
    .insert({ user_id: userId, name })

  if (error) throw error

  store.setTags((current) => [...current, name].sort())

  return name
}

/**
 * Renames the registry entry and every row carrying the old name.
 *
 * Per `docs/specs/02-inventory-data-model.md`'s "The three writes": the
 * registry row is renamed first, then every `inventory_items`/
 * `inventory_lines` row carrying the old name is updated to the new one. The
 * spec runs these as one transaction; here they are sequential awaited calls
 * (per this phase's scope — no RPC), so there is a brief window where a row
 * still carries a name the registry no longer has, same as the spec's own
 * un-transacted description implies for a JS client.
 */
export async function renameTag(
  store: InventoryStore,
  from: string,
  raw: string
): Promise<string> {
  if (!store.tags.includes(from)) {
    throw new Error(`No tag "${from}".`)
  }

  const to = assertValid(raw, store.tags, from)

  if (to === from) {
    return to
  }

  const userId = requireUserId(store)

  const { error: renameError } = await supabase
    .from("tags")
    .update({ name: to })
    .eq("user_id", userId)
    .eq("name", from)

  if (renameError) throw renameError

  const { data: itemRows, error: itemsError } = await supabase
    .from("inventory_items")
    .select("id, tags")
    .eq("user_id", userId)
    .contains("tags", [from])

  if (itemsError) throw itemsError

  for (const row of itemRows ?? []) {
    const nextTags = row.tags.map((tag) => (tag === from ? to : tag))
    const { error } = await supabase
      .from("inventory_items")
      .update({ tags: nextTags })
      .eq("id", row.id)

    if (error) throw error
  }

  const { data: lineRows, error: linesError } = await supabase
    .from("inventory_lines")
    .select("id, tags")
    .contains("tags", [from])

  if (linesError) throw linesError

  for (const row of lineRows ?? []) {
    const nextTags = row.tags.map((tag) => (tag === from ? to : tag))
    const { error } = await supabase
      .from("inventory_lines")
      .update({ tags: nextTags })
      .eq("id", row.id)

    if (error) throw error
  }

  store.setTags((current) =>
    current.map((tag) => (tag === from ? to : tag)).sort()
  )
  store.setItems((current) =>
    current.map((item) =>
      item.tags.includes(from)
        ? { ...item, tags: item.tags.map((tag) => (tag === from ? to : tag)) }
        : item
    )
  )
  store.setLines((current) =>
    current.map((line) =>
      line.tags.includes(from)
        ? { ...line, tags: line.tags.map((tag) => (tag === from ? to : tag)) }
        : line
    )
  )

  return to
}

/**
 * Drops the registry row and strips the name from every entry and line.
 *
 * Order matches spec 02: content tables first, registry row last, so no row
 * is ever left carrying a name that isn't (yet) in the registry.
 */
export async function deleteTag(
  store: InventoryStore,
  name: string
): Promise<void> {
  if (!store.tags.includes(name)) {
    throw new Error(`No tag "${name}".`)
  }

  const userId = requireUserId(store)

  const { data: itemRows, error: itemsError } = await supabase
    .from("inventory_items")
    .select("id, tags")
    .eq("user_id", userId)
    .contains("tags", [name])

  if (itemsError) throw itemsError

  for (const row of itemRows ?? []) {
    const nextTags = row.tags.filter((tag) => tag !== name)
    const { error } = await supabase
      .from("inventory_items")
      .update({ tags: nextTags })
      .eq("id", row.id)

    if (error) throw error
  }

  const { data: lineRows, error: linesError } = await supabase
    .from("inventory_lines")
    .select("id, tags")
    .contains("tags", [name])

  if (linesError) throw linesError

  for (const row of lineRows ?? []) {
    const nextTags = row.tags.filter((tag) => tag !== name)
    const { error } = await supabase
      .from("inventory_lines")
      .update({ tags: nextTags })
      .eq("id", row.id)

    if (error) throw error
  }

  const { error: deleteError } = await supabase
    .from("tags")
    .delete()
    .eq("user_id", userId)
    .eq("name", name)

  if (deleteError) throw deleteError

  store.setTags((current) => current.filter((tag) => tag !== name))
  store.setItems((current) =>
    current.map((item) =>
      item.tags.includes(name)
        ? { ...item, tags: item.tags.filter((tag) => tag !== name) }
        : item
    )
  )
  store.setLines((current) =>
    current.map((line) =>
      line.tags.includes(name)
        ? { ...line, tags: line.tags.filter((tag) => tag !== name) }
        : line
    )
  )
}

/** Every occurrence of a name in `from` becomes `to`, then the result is deduped. */
function withTagsMerged(tags: string[], from: string[], to: string): string[] {
  return Array.from(
    new Set(tags.map((tag) => (from.includes(tag) ? to : tag)))
  )
}

/**
 * Merges `fromNames` into a single tag, `raw`.
 *
 * `raw` may name an existing tag — including one of `fromNames` itself, so
 * "these three are duplicates, keep this one" works — or a brand-new name,
 * registered here first. Whichever it is, every row carrying any of
 * `fromNames` ends up carrying it instead, and the other source registry rows
 * are dropped. Same content-tables-first/registry-last order as `deleteTag`,
 * and the same sequential-not-transactional caveat as `renameTag`.
 */
export async function mergeTags(
  store: InventoryStore,
  fromNames: string[],
  raw: string
): Promise<string> {
  if (
    fromNames.length === 0 ||
    fromNames.some((name) => !store.tags.includes(name))
  ) {
    throw new Error("One of the selected tags no longer exists.")
  }

  const normalised = normaliseTagName(raw)
  const targetExists = store.tags.includes(normalised)
  const to = targetExists ? normalised : assertValid(raw, store.tags)

  const userId = requireUserId(store)
  // The target carries itself already — only the other selected tags need rewriting.
  const from = fromNames.filter((name) => name !== to)

  if (!targetExists) {
    const { error } = await supabase
      .from("tags")
      .insert({ user_id: userId, name: to })

    if (error) throw error
  }

  if (from.length > 0) {
    const { data: itemRows, error: itemsError } = await supabase
      .from("inventory_items")
      .select("id, tags")
      .eq("user_id", userId)
      .overlaps("tags", from)

    if (itemsError) throw itemsError

    for (const row of itemRows ?? []) {
      const { error } = await supabase
        .from("inventory_items")
        .update({ tags: withTagsMerged(row.tags, from, to) })
        .eq("id", row.id)

      if (error) throw error
    }

    const { data: lineRows, error: linesError } = await supabase
      .from("inventory_lines")
      .select("id, tags")
      .overlaps("tags", from)

    if (linesError) throw linesError

    for (const row of lineRows ?? []) {
      const { error } = await supabase
        .from("inventory_lines")
        .update({ tags: withTagsMerged(row.tags, from, to) })
        .eq("id", row.id)

      if (error) throw error
    }

    const { error: deleteError } = await supabase
      .from("tags")
      .delete()
      .eq("user_id", userId)
      .in("name", from)

    if (deleteError) throw deleteError
  }

  store.setTags((current) =>
    Array.from(new Set([...current.filter((tag) => !from.includes(tag)), to])).sort()
  )
  store.setItems((current) =>
    current.map((item) =>
      item.tags.some((tag) => from.includes(tag))
        ? { ...item, tags: withTagsMerged(item.tags, from, to) }
        : item
    )
  )
  store.setLines((current) =>
    current.map((line) =>
      line.tags.some((tag) => from.includes(tag))
        ? { ...line, tags: withTagsMerged(line.tags, from, to) }
        : line
    )
  )

  return to
}
