import type { ResumeDocument } from "@/lib/resume-document"

/**
 * Lines of `input` (one skill per line) with no case-insensitive, trimmed
 * match in `availableSkillTitles`. Blank lines are dropped; duplicate input
 * lines collapse to one, keeping the first-seen casing.
 */
export function findMissingSkills(
  input: string,
  availableSkillTitles: string[]
): string[] {
  const available = new Set(availableSkillTitles.map((title) => title.trim().toLowerCase()))
  const seen = new Set<string>()
  const missing: string[] = []

  for (const rawLine of input.split("\n")) {
    const line = rawLine.trim()
    if (!line) continue

    const key = line.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    if (!available.has(key)) missing.push(line)
  }

  return missing
}

/** A resolved document's skill titles, flattened across categories — the shared compare-pool shape for the Application/CV/Persona missing-skills check. */
export function skillTitlesOf(document: ResumeDocument): string[] {
  const skillSection = document.sections.find((section) => section.kind === "skill")
  return skillSection?.skillGroups?.flatMap((group) => group.skills) ?? []
}
