import type {
  DbInventoryItem,
  DbInventoryLine,
  DbItemSkill,
  DbTimestamps,
  LineKind,
  SourceItem,
  SourceLine,
  SourcePool,
} from "./types"

/**
 * Timestamps are synthesised, not authored — writing `created_at` on 233 rows by
 * hand would be noise. They are derived from a fixed epoch rather than
 * `Date.now()` so the dataset is byte-identical on every reload; a demo whose
 * timestamps drift between refreshes is impossible to screenshot or test.
 */
const EPOCH = Date.UTC(2025, 0, 6)
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

function stamps(seed: number): DbTimestamps {
  const created = EPOCH + seed * DAY
  // Every third row reads as edited after creation; the rest were never touched.
  const updated = created + (seed % 3 === 0 ? 0 : (seed % 11) * 7 * HOUR)

  return {
    createdAt: new Date(created).toISOString(),
    updatedAt: new Date(updated).toISOString(),
  }
}

/** Short codes keep generated line ids readable: `work-lumbung-r1`, `skill-go-k2`. */
const LINE_CODE: Record<LineKind, string> = {
  responsibilities: "r",
  highlights: "h",
  courses: "c",
  keywords: "k",
  roles: "ro",
}

/** Order lines are emitted in, so a line's id is stable regardless of authoring order. */
const LINE_ORDER: LineKind[] = [
  "responsibilities",
  "highlights",
  "courses",
  "keywords",
  "roles",
]

function normalise(line: SourceLine): {
  content: string
  tags: string[]
  note: string | null
} {
  return typeof line === "string"
    ? { content: line, tags: [], note: null }
    : {
        content: line.content,
        tags: line.tags ?? [],
        note: line.note ?? null,
      }
}

/**
 * Turns the nested authoring shape into the flat rows a Supabase query returns.
 *
 * Also acts as a check on the dataset: a skill link pointing at a missing or
 * non-skill item throws here rather than surfacing as an empty render later.
 */
export function flatten(pools: SourcePool[], userId: string) {
  const items: DbInventoryItem[] = []
  const lines: DbInventoryLine[] = []
  const itemSkills: DbItemSkill[] = []

  // Runs across every pool, so no two rows share a timestamp.
  let seed = 0

  for (const pool of pools) {
    pool.items.forEach((source: SourceItem, index) => {
      items.push({
        ...stamps(seed++),
        id: source.id,
        userId,
        kind: pool.kind,
        title: source.title,
        subtitle: source.subtitle ?? null,
        summary: source.summary ?? null,
        url: source.url ?? null,
        startDate: source.startDate ?? null,
        endDate: source.endDate ?? null,
        details: source.details ?? {},
        yearsExperience: source.yearsExperience ?? null,
        categoryId: null,
        tags: source.tags ?? [],
        note: source.note ?? null,
        favorite: source.favorite ?? false,
        position: index,
      })

      for (const listKind of LINE_ORDER) {
        const list = source.lines?.[listKind]
        if (!list) continue

        list.forEach((raw, lineIndex) => {
          const { content, tags, note } = normalise(raw)
          lines.push({
            ...stamps(seed++),
            id: `${source.id}-${LINE_CODE[listKind]}${lineIndex + 1}`,
            itemId: source.id,
            listKind,
            content,
            tags,
            note,
            position: lineIndex,
          })
        })
      }

      source.skills?.forEach((skillId, skillIndex) => {
        itemSkills.push({
          ...stamps(seed++),
          itemId: source.id,
          skillId,
          position: skillIndex,
        })
      })
    })
  }

  assertSkillLinksResolve(items, itemSkills)

  return { items, lines, itemSkills }
}

/** Mirrors the composite foreign key in the spec: a link must point at a real skill. */
function assertSkillLinksResolve(
  items: DbInventoryItem[],
  itemSkills: DbItemSkill[]
) {
  const skillIds = new Set(
    items.filter((item) => item.kind === "skill").map((item) => item.id)
  )

  for (const link of itemSkills) {
    if (!skillIds.has(link.skillId)) {
      throw new Error(
        `Mock data: "${link.itemId}" links to "${link.skillId}", ` +
          `which is not a skill in the Inventory.`
      )
    }
    if (link.itemId === link.skillId) {
      throw new Error(`Mock data: "${link.itemId}" links to itself.`)
    }
  }
}
