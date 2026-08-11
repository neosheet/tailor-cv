import { FolderIcon } from "lucide-react"

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { SkillCategory } from "@/lib/inventory-store"

/** Sentinel for "items with no category" — `Select` needs a string value, `value` is `string | null`. */
export const UNCATEGORIZED = "uncategorized"

const ALL_CATEGORIES = "all"

/**
 * Narrow the Skills pool to one category — single-select, unlike `TagFilter`,
 * since a skill carries exactly one category (or none). Options come from the
 * registry (`store.skillCategories`), not from the rows on screen: unlike
 * tags, a category is picked exclusively, so deriving choices from the
 * already-filtered rows would hide every other category the moment one was
 * chosen.
 */
export function CategoryFilter({
  value,
  onChange,
  categories,
}: {
  /** `null` = no filter applied. */
  value: string | null
  onChange: (categoryId: string | null) => void
  categories: SkillCategory[]
}) {
  const options = [
    { value: ALL_CATEGORIES, label: "All categories" },
    { value: UNCATEGORIZED, label: "No category" },
    ...categories.map((category) => ({
      value: category.id,
      label: category.name,
    })),
  ]

  return (
    <Select
      items={options}
      value={value ?? ALL_CATEGORIES}
      onValueChange={(next) =>
        onChange(next === ALL_CATEGORIES ? null : (next as string))
      }
    >
      <SelectTrigger className="w-auto min-w-40" aria-label="Filter by category">
        <FolderIcon
          className="size-4 text-muted-foreground"
          data-icon="inline-start"
        />
        <SelectValue placeholder="Filter by category…" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
