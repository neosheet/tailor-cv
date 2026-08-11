import type { InventoryStore, SkillCategory } from "@/lib/inventory-store"
import { supabase } from "@/lib/supabase"

/**
 * The Skills-pool category registry — managed from Settings the same way
 * `src/lib/tags.ts` manages tags, but simpler: `inventory_items.category_id`
 * is a real FK to `skill_categories.id`, not array membership, so a rename is
 * one `UPDATE` on the registry row (every referencing item just points at the
 * same id) and a delete relies on the DB's `on delete set null` rather than a
 * manual cascade rewrite across `inventory_items`/`inventory_lines`.
 */

export type SkillCategoryUsage = SkillCategory & {
  /** Skills carrying this category. */
  itemCount: number
}

/** Trim only — a display name, not a filter token like tag names. */
export function normaliseCategoryName(raw: string): string {
  return raw.trim()
}

/** Why `name` cannot be used, or null when it can. */
export function validateCategoryName(
  raw: string,
  registry: SkillCategory[],
  /** The category being renamed, which is allowed to keep its own name. */
  options: { except?: string } = {}
): string | null {
  const name = normaliseCategoryName(raw)

  if (!name) {
    return "Enter a category name."
  }

  const clash = registry.some(
    (category) => category.name === name && category.id !== options.except
  )
  if (clash) {
    return `"${name}" already exists.`
  }

  return null
}

/** "3 skills", "1 skill", or "Unused" — the table cell and dialog copy alike. */
export function categoryUsageLabel(category: { itemCount: number }): string {
  if (category.itemCount === 0) return "Unused"
  return `${category.itemCount} ${category.itemCount === 1 ? "skill" : "skills"}`
}

/** Every category with its usage, alphabetical — what the management screen lists. */
export function listSkillCategories(store: InventoryStore): SkillCategoryUsage[] {
  return store.skillCategories.map((category) => ({
    ...category,
    itemCount: store.items.filter((item) => item.categoryId === category.id).length,
  }))
}

function requireUserId(store: InventoryStore): string {
  if (!store.userId) {
    throw new Error("No signed-in user.")
  }
  return store.userId
}

/** A registry row and nothing else — a new category is on no skills yet. */
export async function createSkillCategory(
  store: InventoryStore,
  raw: string
): Promise<SkillCategory> {
  const userId = requireUserId(store)
  const name = normaliseCategoryName(raw)
  const problem = validateCategoryName(name, store.skillCategories)
  if (problem) throw new Error(problem)

  const { data, error } = await supabase
    .from("skill_categories")
    .insert({ user_id: userId, name, position: store.skillCategories.length })
    .select()
    .single()

  if (error) throw error

  const category: SkillCategory = { id: data.id, name: data.name, position: data.position }
  store.setSkillCategories((current) =>
    [...current, category].sort((a, b) => a.name.localeCompare(b.name))
  )

  return category
}

/** Renames the registry row. Every item's `category_id` still points at the same row. */
export async function renameSkillCategory(
  store: InventoryStore,
  id: string,
  raw: string
): Promise<string> {
  const existing = store.skillCategories.find((category) => category.id === id)
  if (!existing) {
    throw new Error(`No skill category "${id}".`)
  }

  const name = normaliseCategoryName(raw)
  const problem = validateCategoryName(name, store.skillCategories, { except: id })
  if (problem) throw new Error(problem)

  if (name === existing.name) {
    return name
  }

  const { error } = await supabase
    .from("skill_categories")
    .update({ name })
    .eq("id", id)

  if (error) throw error

  store.setSkillCategories((current) =>
    current
      .map((category) => (category.id === id ? { ...category, name } : category))
      .sort((a, b) => a.name.localeCompare(b.name))
  )

  return name
}

/**
 * Drops the registry row. `on delete set null` clears `category_id` on every
 * referencing skill in the DB — mirrored here by nulling it in local state too.
 */
export async function deleteSkillCategory(
  store: InventoryStore,
  id: string
): Promise<void> {
  if (!store.skillCategories.some((category) => category.id === id)) {
    throw new Error(`No skill category "${id}".`)
  }

  const { error } = await supabase.from("skill_categories").delete().eq("id", id)

  if (error) throw error

  store.setSkillCategories((current) => current.filter((category) => category.id !== id))
  store.setItems((current) =>
    current.map((item) =>
      item.categoryId === id ? { ...item, categoryId: null } : item
    )
  )
}
