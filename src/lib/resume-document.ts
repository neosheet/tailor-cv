import type { ItemKind, LineKind } from "@/mocks/types"

/**
 * The document templates render — moved out of `persona.ts` (which pulls in
 * Supabase/store code, unsafe to reach from `scripts/`) so `cv-snapshot.ts`
 * can depend on `ResumeDocument` without dragging that in. `persona.ts`
 * re-exports these for every existing call site.
 */

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
  /** `summary` (if present) plus every `lineGroups` item flattened into one list — Classic renders these as one shared `<ul>` instead of a separate description paragraph and one `<ul>` per group. */
  bulletItems: string[]
  /**
   * `"{location} ({workplaceType}, {employmentType})"` — Work entries only in
   * practice. Default values (`"on-site"`, `"full-time"`) are dropped as
   * implied/redundant; present-but-default `location` still shows. `null`
   * when there's nothing to show at all.
   */
  metaLine: string | null
}

/** One `skill_categories` row's entries, pre-grouped for Classic's "Category: skill, skill, ..." line. */
export type ResumeSkillGroup = { category: string; skills: string[] }

export type ResumeSection = {
  kind: ItemKind
  heading: string
  entries: ResumeEntry[]
  /** Skill sections only — entries regrouped by category, category-`position` order, uncategorized last under "Other". */
  skillGroups?: ResumeSkillGroup[]
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
