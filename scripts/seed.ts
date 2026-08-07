/**
 * One-shot dev seed script — not part of the app bundle, run via `npm run seed`.
 *
 * Populates the real Supabase project with the same demo dataset the app reads
 * (see `src/mocks/README.md` for the authored source).
 *
 * Not idempotent, and does not attempt to roll back on failure: Postgres doesn't
 * give a JS client an easy way to wrap several separate `.insert()` round trips in
 * one transaction, and by the time a later step fails, earlier ones already
 * committed. A failed run is expected to be cleaned up by hand — truncate
 * `tags`, `inventory_items`, `inventory_lines`, `item_skills`, `personas`,
 * `persona_sections`, `persona_items`, `persona_lines`, `cvs` for this user —
 * then re-run.
 */

import { randomUUID } from "node:crypto"
import { config } from "dotenv"
import { createClient } from "@supabase/supabase-js"
import type { Database, Json } from "../src/lib/database.types"
import {
  contacts,
  headlines,
  locations,
  names,
  socials,
  summaries,
} from "../src/mocks/data/basics"
import { education } from "../src/mocks/data/education"
import {
  awards,
  certificates,
  interests,
  languages,
  publications,
  references,
  volunteer,
} from "../src/mocks/data/misc"
import { projects } from "../src/mocks/data/projects"
import { skills } from "../src/mocks/data/skills"
import { work } from "../src/mocks/data/work"
import { personas as sourcePersonas } from "../src/mocks/data/personas"
import { cvs as sourceCvs } from "../src/mocks/data/cvs"
import { flatten } from "../src/mocks/flatten"
import type { DbInventoryLine, SourcePersonaLines, SourcePool } from "../src/mocks/types"

config({ path: ".env.seed" })

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    console.error(
      `Missing required env var ${name}. Copy .env.seed.example to .env.seed ` +
        `and fill it in, then re-run.`
    )
    process.exit(1)
  }
  return value
}

function fail(step: string, error: { message: string }): never {
  console.error(`Seed failed at ${step}:`, error)
  process.exit(1)
}

async function main() {
  const url = requireEnv("VITE_SUPABASE_URL")
  const publishableKey = requireEnv("VITE_SUPABASE_PUBLISHABLE_KEY")
  const email = requireEnv("SEED_USER_EMAIL")
  const password = requireEnv("SEED_USER_PASSWORD")

  // No MCP tool exposes the secret/service-role key (deliberately, for security),
  // so this signs in as the one real account instead. Every table's RLS policy is
  // `auth.uid() = user_id`, reached directly or through a parent — an authenticated
  // insert as that user satisfies it exactly like the app itself would, no
  // elevated key required.
  const supabase = createClient<Database>(url, publishableKey)

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  if (authError || !authData.session) {
    console.error("Sign-in failed:", authError?.message ?? "no session returned")
    process.exit(1)
  }
  const userId = authData.session.user.id

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

  const { items, lines, itemSkills } = flatten(pools, userId)

  const itemIdMap = new Map(items.map((item) => [item.id, randomUUID()]))
  const lineIdMap = new Map(lines.map((line) => [line.id, randomUUID()]))
  const personaIdMap = new Map(
    sourcePersonas.map((persona) => [persona.id, randomUUID()])
  )

  const resolveItemId = (slug: string): string => {
    const id = itemIdMap.get(slug)
    if (!id) throw new Error(`Seed: no generated id for item "${slug}".`)
    return id
  }
  const resolveLineId = (slug: string): string => {
    const id = lineIdMap.get(slug)
    if (!id) throw new Error(`Seed: no generated id for line "${slug}".`)
    return id
  }
  const resolvePersonaId = (slug: string): string => {
    const id = personaIdMap.get(slug)
    if (!id) throw new Error(`Seed: no generated id for persona "${slug}".`)
    return id
  }

  // `profiles` has no signup trigger provisioning it, and inventory_items/tags/
  // personas/cvs all FK to it — the row has to exist before any content insert
  // can succeed.
  const { error: profileError } = await supabase
    .from("profiles")
    .upsert({ id: userId }, { onConflict: "id", ignoreDuplicates: true })
  if (profileError) fail("profiles", profileError)

  // Must land before any inventory_items/inventory_lines row: assert_tags_registered
  // rejects a row carrying a tag name the registry doesn't already have.
  const tagNames = new Set<string>()
  for (const item of items) for (const tag of item.tags) tagNames.add(tag)
  for (const line of lines) for (const tag of line.tags) tagNames.add(tag)

  const { error: tagsError } = await supabase
    .from("tags")
    .insert([...tagNames].map((name) => ({ user_id: userId, name })))
  if (tagsError) fail("tags", tagsError)

  const { error: itemsError } = await supabase.from("inventory_items").insert(
    items.map((item) => ({
      id: resolveItemId(item.id),
      user_id: userId,
      kind: item.kind,
      title: item.title,
      subtitle: item.subtitle,
      summary: item.summary,
      url: item.url,
      start_date: item.startDate,
      end_date: item.endDate,
      details: item.details as unknown as Json,
      years_experience: item.yearsExperience,
      tags: item.tags,
      note: item.note,
      favorite: item.favorite,
      position: item.position,
      created_at: item.createdAt,
      updated_at: item.updatedAt,
    }))
  )
  if (itemsError) fail("inventory_items", itemsError)

  const { error: linesError } = await supabase.from("inventory_lines").insert(
    lines.map((line) => ({
      id: resolveLineId(line.id),
      item_id: resolveItemId(line.itemId),
      list_kind: line.listKind,
      content: line.content,
      tags: line.tags,
      note: line.note,
      position: line.position,
      created_at: line.createdAt,
      updated_at: line.updatedAt,
    }))
  )
  if (linesError) fail("inventory_lines", linesError)

  if (itemSkills.length > 0) {
    const { error: itemSkillsError } = await supabase.from("item_skills").insert(
      itemSkills.map((link) => ({
        item_id: resolveItemId(link.itemId),
        skill_id: resolveItemId(link.skillId),
        skill_kind: "skill" as const,
        position: link.position,
        created_at: link.createdAt,
        updated_at: link.updatedAt,
      }))
    )
    if (itemSkillsError) fail("item_skills", itemSkillsError)
  }

  const linesByItem = new Map<string, DbInventoryLine[]>()
  for (const line of lines) {
    const bucket = linesByItem.get(line.itemId) ?? []
    bucket.push(line)
    linesByItem.set(line.itemId, bucket)
  }

  // data/personas.ts authors line selections as tag filters ("tagsAny"/"all"/
  // "none"/"ids"), not literal line ids — this mirrors src/lib/persona.ts's
  // `buildResumeDocument` line-resolution logic, expanded here to concrete rows.
  function selectLineSlugIds(itemSlug: string, spec: SourcePersonaLines | undefined): string[] {
    if (spec === undefined || spec === "none") return []

    const itemLines = (linesByItem.get(itemSlug) ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)

    if (spec === "all") return itemLines.map((line) => line.id)
    if ("ids" in spec) return spec.ids

    return itemLines
      .filter((line) => line.tags.some((tag) => spec.tagsAny.includes(tag)))
      .map((line) => line.id)
  }

  for (const sourcePersona of sourcePersonas) {
    const personaId = resolvePersonaId(sourcePersona.id)

    const { error: personaError } = await supabase.from("personas").insert({
      id: personaId,
      user_id: userId,
      name: sourcePersona.name,
      note: sourcePersona.note ?? null,
      tags: sourcePersona.tags ?? [],
      favorite: sourcePersona.favorite ?? false,
    })
    if (personaError) fail(`personas (${sourcePersona.id})`, personaError)

    const { error: sectionsError } = await supabase.from("persona_sections").insert(
      sourcePersona.sections.map((section, sectionIndex) => ({
        persona_id: personaId,
        kind: section.kind,
        position: sectionIndex,
      }))
    )
    if (sectionsError) fail(`persona_sections (${sourcePersona.id})`, sectionsError)

    const personaItemRows = sourcePersona.sections.flatMap((section) =>
      section.items.map((item, itemIndex) => ({
        persona_id: personaId,
        item_id: resolveItemId(item.itemId),
        position: itemIndex,
      }))
    )
    const { error: personaItemsError } = await supabase
      .from("persona_items")
      .insert(personaItemRows)
    if (personaItemsError) fail(`persona_items (${sourcePersona.id})`, personaItemsError)

    const personaLineRows = sourcePersona.sections.flatMap((section) =>
      section.items.flatMap((item) =>
        selectLineSlugIds(item.itemId, item.lines).map((lineSlug, lineIndex) => ({
          persona_id: personaId,
          item_id: resolveItemId(item.itemId),
          line_id: resolveLineId(lineSlug),
          position: lineIndex,
        }))
      )
    )
    if (personaLineRows.length > 0) {
      const { error: personaLinesError } = await supabase
        .from("persona_lines")
        .insert(personaLineRows)
      if (personaLinesError) fail(`persona_lines (${sourcePersona.id})`, personaLinesError)
    }
  }

  // Saved (Persona, Template) pairings — the new meaning of `cvs`. Each row
  // just points at a persona already inserted above, by its mock slug.
  const { error: cvsError } = await supabase.from("cvs").insert(
    sourceCvs.map((sourceCv) => ({
      id: randomUUID(),
      user_id: userId,
      persona_id: resolvePersonaId(sourceCv.personaId),
      template_id: sourceCv.templateId,
      name: sourceCv.name,
      note: sourceCv.note ?? null,
    }))
  )
  if (cvsError) fail("cvs", cvsError)

  const expected = {
    items: 68,
    lines: 165,
    itemSkills: 45,
    tags: 47,
    personas: 2,
    cvs: 2,
  }
  const actual = {
    items: items.length,
    lines: lines.length,
    itemSkills: itemSkills.length,
    tags: tagNames.size,
    personas: sourcePersonas.length,
    cvs: sourceCvs.length,
  }

  console.log("Seed complete. Row counts:")
  for (const key of Object.keys(expected) as (keyof typeof expected)[]) {
    console.log(`  ${key}: ${actual[key]} (expected ${expected[key]})`)
  }

  const mismatches = (Object.keys(expected) as (keyof typeof expected)[]).filter(
    (key) => actual[key] !== expected[key]
  )
  if (mismatches.length > 0) {
    console.warn(
      `Mismatch vs src/mocks/README.md for: ${mismatches.join(", ")}. ` +
        `Check whether the dataset in src/mocks/data/ has drifted from the README.`
    )
  }
}

main().catch((error: unknown) => {
  console.error("Unexpected error:", error)
  process.exit(1)
})
