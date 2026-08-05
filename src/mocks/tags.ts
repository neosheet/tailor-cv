/**
 * The tag registry — the canonical list every tagged row draws from.
 *
 * Mirrors the `tags` table from `docs/specs/02-inventory-data-model.md`. Kept out
 * of `mocks/index.ts` for the same reason `mocks/cv.ts` is, but `index.ts` also
 * calls back into this module (`createItem`/`updateItem` validate tags against
 * `listTags()`), so the import genuinely runs both ways. All access to `mockDb`
 * below is deferred into function bodies (never read at module load) so the
 * cycle resolves instead of throwing on the not-yet-initialized `mockDb` export.
 *
 * The `data/` files author tags inline on items and lines, so the registry is
 * seeded from what they use. In Supabase the dependency runs the other way — the
 * registry is written first and a row can only carry names already in it.
 *
 * Writes mutate the shared rows in place, exactly like `toggleFavorite`. That is
 * what the Supabase `update` will do to the same columns, and it lasts for the
 * session only: a reload re-derives everything from `data/`.
 */

import { mockDb } from "./index"

/** Lower-case letters and digits. Matches the CHECK on `tags.name`. */
export const TAG_NAME_PATTERN = /^[a-z0-9]+$/

export type TagUsage = {
  name: string
  /** Entries carrying the tag. */
  itemCount: number
  /** Bullet points and keywords carrying it. */
  lineCount: number
}

let registry: string[] | undefined

/**
 * Seeded from every tag the authored data uses, so nothing starts
 * unregistered. Built lazily, on first real use, rather than at module load —
 * this module and `mocks/index.ts` import each other, and `mockDb` isn't
 * assigned until `index.ts` finishes evaluating, which happens after this
 * module is first reached.
 */
function getRegistry(): string[] {
  if (!registry) {
    registry = [
      ...new Set([
        ...mockDb.items.flatMap((item) => item.tags),
        ...mockDb.lines.flatMap((line) => line.tags),
      ]),
    ].sort()
  }

  return registry
}

/** Trim and lower-case, the normalisation the real write does before inserting. */
export function normaliseTagName(raw: string): string {
  return raw.trim().toLowerCase()
}

/**
 * Why `name` cannot be used, or null when it can.
 *
 * Takes the raw input and normalises it first, so `Backend ` fails as a duplicate
 * of `backend` rather than passing as something new.
 */
export function validateTagName(
  raw: string,
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

  if (name !== options.except && getRegistry().includes(name)) {
    return `“${name}” already exists.`
  }

  return null
}

/** Every tag with its usage, alphabetical — what the management screen lists. */
export function listTags(): TagUsage[] {
  return getRegistry().map((name) => ({
    name,
    itemCount: mockDb.items.filter((item) => item.tags.includes(name)).length,
    lineCount: mockDb.lines.filter((line) => line.tags.includes(name)).length,
  }))
}

/**
 * Rows carrying at least one of `names` — the usage a batch delete will strip.
 *
 * Counted over distinct rows rather than summed per tag, because an entry
 * tagged both `backend` and `api` is one entry losing labels, not two.
 */
export function usageOfAny(names: string[]): Omit<TagUsage, "name"> {
  const wanted = new Set(names)
  const carries = (tags: string[]) => tags.some((tag) => wanted.has(tag))

  return {
    itemCount: mockDb.items.filter((item) => carries(item.tags)).length,
    lineCount: mockDb.lines.filter((line) => carries(line.tags)).length,
  }
}

/** Throws on anything `validateTagName` rejects — the UI checks before calling. */
function assertValid(raw: string, except?: string): string {
  const problem = validateTagName(raw, { except })

  if (problem) {
    throw new Error(problem)
  }

  return normaliseTagName(raw)
}

/** A registry row and nothing else — a new tag is on no rows yet. */
export function createTag(raw: string): string {
  const name = assertValid(raw)

  getRegistry().push(name)
  getRegistry().sort()

  return name
}

/**
 * Renames the registry entry and every row carrying the old name.
 *
 * One call because the two halves cannot be allowed to diverge — a row holding a
 * name the registry no longer has is exactly what the database trigger rejects.
 * Renaming onto an existing tag is an error rather than a merge: predictable, and
 * merging can be added later if it is ever wanted.
 */
export function renameTag(from: string, raw: string): string {
  const index = getRegistry().indexOf(from)

  if (index === -1) {
    throw new Error(`No tag “${from}”.`)
  }

  const to = assertValid(raw, from)

  if (to === from) {
    return to
  }

  getRegistry()[index] = to
  getRegistry().sort()

  for (const row of [...mockDb.items, ...mockDb.lines]) {
    const position = row.tags.indexOf(from)

    if (position !== -1) {
      row.tags[position] = to
      row.updatedAt = new Date().toISOString()
    }
  }

  return to
}

/** Drops the registry row and strips the name from every entry and line. */
export function deleteTag(name: string): void {
  const index = getRegistry().indexOf(name)

  if (index === -1) {
    throw new Error(`No tag “${name}”.`)
  }

  getRegistry().splice(index, 1)

  for (const row of [...mockDb.items, ...mockDb.lines]) {
    if (row.tags.includes(name)) {
      row.tags = row.tags.filter((tag) => tag !== name)
      row.updatedAt = new Date().toISOString()
    }
  }
}
