import type { TagUsage } from "@/lib/tags"

/**
 * How a tag's usage reads, shared between the tag table and the dialogs that act
 * on a row.
 *
 * Both halves matter and they are not interchangeable — `backend` on eight
 * bullet points is a working filter, `backend` on one entry is close to unused —
 * so the count is always shown split, never summed.
 */
function parts(tag: TagUsage): string[] {
  return [
    tag.itemCount > 0
      ? `${tag.itemCount} ${tag.itemCount === 1 ? "entry" : "entries"}`
      : null,
    tag.lineCount > 0
      ? `${tag.lineCount} ${tag.lineCount === 1 ? "line" : "lines"}`
      : null,
  ].filter((part) => part !== null)
}

/** Table cell copy: "14 entries · 3 lines", or "Unused". */
export function usageLabel(tag: TagUsage): string {
  const used = parts(tag)
  return used.length === 0 ? "Unused" : used.join(" · ")
}

/** Sentence fragment: "used on 14 entries and 3 lines". */
export function usageSentence(tag: TagUsage): string {
  const used = parts(tag)
  return used.length === 0 ? "not in use" : `used on ${used.join(" and ")}`
}
