import type { ApplicationData, ApplicationStore } from "@/lib/application-store"
import { mapStageTemplateRow } from "@/lib/application-store"
import { supabase } from "@/lib/supabase"
import type { BuiltInStageCategory, DbStageTemplate } from "@/mocks/types"

/**
 * The Stage Templates registry — managed from Settings the same way
 * `src/lib/skill-categories.ts` manages skill categories, minus the
 * usage-count concept that file has: `stage_templates` is a pure
 * autocomplete-suggestion registry, never FK-referenced by
 * `application_stages`. A recorded stage's `name`/`category` are plain
 * denormalized `text` columns, copied at creation time — not a foreign key
 * into this table. That's deliberate: a recorded stage is a point-in-time
 * snapshot of one step in a real hiring pipeline, and retroactively renaming
 * or deleting the *template* must never rewrite an application's actual
 * history. So unlike Tags (enforced via `assert_tags_registered()`), there is
 * no "N stages" usage column here and no orphan warning on delete — there's
 * nothing to orphan.
 */

/** Trim only — a display name, not a filter token like tag names. */
export function normaliseStageTemplateName(raw: string): string {
  return raw.trim()
}

/** Why `name` cannot be used, or null when it can. */
export function validateStageTemplateName(
  raw: string,
  registry: DbStageTemplate[],
  /** The template being renamed, which is allowed to keep its own name. */
  options: { except?: string } = {}
): string | null {
  const name = normaliseStageTemplateName(raw)

  if (!name) {
    return "Enter a stage name."
  }

  const clash = registry.some(
    (template) =>
      template.name.toLowerCase() === name.toLowerCase() &&
      template.id !== options.except
  )
  if (clash) {
    return `"${name}" already exists.`
  }

  return null
}

/** Every stage template, alphabetical — what the management screen lists. */
export function listStageTemplates(data: ApplicationData): DbStageTemplate[] {
  return [...data.stageTemplates].sort((a, b) => a.name.localeCompare(b.name))
}

function requireUserId(store: ApplicationStore): string {
  if (!store.userId) {
    throw new Error("No signed-in user.")
  }
  return store.userId
}

/** Inserts a new stage template and adds it to the registry. */
export async function createStageTemplate(
  store: ApplicationStore,
  name: string,
  category: BuiltInStageCategory
): Promise<DbStageTemplate> {
  const userId = requireUserId(store)
  const cleanName = normaliseStageTemplateName(name)
  const problem = validateStageTemplateName(cleanName, store.stageTemplates)
  if (problem) throw new Error(problem)

  const { data, error } = await supabase
    .from("stage_templates")
    .insert({ user_id: userId, name: cleanName, category })
    .select()
    .single()

  if (error) throw error

  const template = mapStageTemplateRow(data)
  store.setStageTemplates((current) =>
    [...current, template].sort((a, b) => a.name.localeCompare(b.name))
  )

  return template
}

/** Patches a stage template's name and/or category. */
export async function updateStageTemplate(
  store: ApplicationStore,
  id: string,
  patch: { name?: string; category?: BuiltInStageCategory }
): Promise<DbStageTemplate> {
  const existing = store.stageTemplates.find((template) => template.id === id)
  if (!existing) {
    throw new Error(`No stage template "${id}".`)
  }

  let name: string | undefined
  if (patch.name !== undefined) {
    name = normaliseStageTemplateName(patch.name)
    const problem = validateStageTemplateName(name, store.stageTemplates, {
      except: id,
    })
    if (problem) throw new Error(problem)
  }

  const { data, error } = await supabase
    .from("stage_templates")
    .update({
      ...(name !== undefined ? { name } : {}),
      ...(patch.category !== undefined ? { category: patch.category } : {}),
    })
    .eq("id", id)
    .select()
    .single()

  if (error) throw error

  const updated = mapStageTemplateRow(data)
  store.setStageTemplates((current) =>
    current
      .map((template) => (template.id === id ? updated : template))
      .sort((a, b) => a.name.localeCompare(b.name))
  )

  return updated
}

/** Drops the registry row. Applications keep their recorded stages as-is. */
export async function deleteStageTemplate(
  store: ApplicationStore,
  id: string
): Promise<void> {
  if (!store.stageTemplates.some((template) => template.id === id)) {
    throw new Error(`No stage template "${id}".`)
  }

  const { error } = await supabase.from("stage_templates").delete().eq("id", id)

  if (error) throw error

  store.setStageTemplates((current) =>
    current.filter((template) => template.id !== id)
  )
}
