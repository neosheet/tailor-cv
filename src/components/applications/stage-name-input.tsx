import * as React from "react"

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { NewStageTemplateDialog } from "@/components/applications/new-stage-template-dialog"
import { useApplicationStore } from "@/lib/application-store"
import { listStageTemplates } from "@/lib/stage-templates"
import type { BuiltInStageCategory, DbStageTemplate } from "@/mocks/types"

/** Enough to pick from without turning the popup into a second list to read. */
const MAX_SUGGESTIONS = 5

/**
 * Stage name field for `StageFormDialog` — a single-value `Combobox` (the
 * plain `ComboboxInput`, not the chips variant `TagInput`/`SkillLinkInput`
 * use, since a stage has exactly one name). Suggestions come from the Stage
 * Templates registry (`listStageTemplates`), prefix-filtered and capped at
 * `MAX_SUGGESTIONS`, same convention as those two. Picking a suggestion (or
 * creating a new template via Enter-with-no-match) fires `onCategoryHint` so
 * the parent form's Category `Select` can auto-fill — a convenience default
 * the user can still override, not a lock.
 */
export function StageNameInput({
  value,
  onValueChange,
  onCategoryHint,
  id,
}: {
  value: string
  onValueChange: (name: string) => void
  onCategoryHint: (category: BuiltInStageCategory) => void
  id?: string
}) {
  const store = useApplicationStore()
  const [createName, setCreateName] = React.useState<string | null>(null)

  const registry = listStageTemplates(store)
  const categoryByName = new Map(
    registry.map((template) => [template.name.toLowerCase(), template.category])
  )

  // Prefix match, not substring, and exclude an exact match of the current
  // value — same reasoning as `TagInput`, plus: once the field already holds
  // a template's exact name, suggesting that same name back is noise.
  const suggestions = React.useMemo(() => {
    const needle = value.trim().toLowerCase()

    return registry
      .filter(
        (template) =>
          template.name.toLowerCase() !== needle &&
          template.name.toLowerCase().startsWith(needle)
      )
      .map((template) => template.name)
      .slice(0, MAX_SUGGESTIONS)
  }, [registry, value])

  function pick(name: string) {
    onValueChange(name)
    const category = categoryByName.get(name.toLowerCase())
    if (category) {
      onCategoryHint(category as BuiltInStageCategory)
    }
  }

  // Enter with no matching suggestion opens the "new template" dialog
  // prefilled with what was typed — the combobox itself only acts on a
  // highlighted item, and there isn't one when the list is empty. Mirrors
  // `SkillLinkInput`'s `openCreateFromInput`.
  function openCreateFromInput(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" || suggestions.length > 0) {
      return
    }

    if (!value.trim()) {
      return
    }

    setCreateName(value.trim())
  }

  function handleCreated(template: DbStageTemplate) {
    onValueChange(template.name)
    onCategoryHint(template.category as BuiltInStageCategory)
    setCreateName(null)
  }

  return (
    <>
      <Combobox
        // Highlights the first suggestion, so Enter picks it without an Arrow Down.
        autoHighlight
        items={suggestions}
        // `suggestions` is already filtered and capped; filtering again would
        // fight it.
        filter={null}
        inputValue={value}
        onInputValueChange={onValueChange}
        onValueChange={(next: string | null) => {
          if (next) pick(next)
        }}
      >
        <ComboboxInput
          id={id}
          placeholder="Stage name…"
          aria-label="Stage name"
          onKeyDown={openCreateFromInput}
        />

        <ComboboxContent>
          <ComboboxEmpty>
            {registry.length === 0
              ? "No stage templates yet — press Enter to create one."
              : "No template starts with that — press Enter to create it."}
          </ComboboxEmpty>
          <ComboboxList>
            {(name: string) => (
              <ComboboxItem key={name} value={name}>
                {name}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>

      <NewStageTemplateDialog
        initialName={createName ?? ""}
        open={createName !== null}
        onOpenChange={(next) => !next && setCreateName(null)}
        onCreated={handleCreated}
      />
    </>
  )
}
