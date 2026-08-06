import * as React from "react"
import { TagsIcon } from "lucide-react"

import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox"
import { Field, FieldError } from "@/components/ui/field"
import { createTag, listTags, validateTagName } from "@/lib/tags"
import { useInventoryStore } from "@/lib/inventory-store"

/** Enough to pick from without turning the popup into a second list to read. */
const MAX_SUGGESTIONS = 5

/**
 * Tag picker for an item/line form field.
 *
 * Same interaction as `TagFilter`, but the suggestion pool is the *full*
 * registry rather than what's present on currently-matching rows — a form
 * field has no "currently matching rows" to narrow against, and every tag in
 * the registry is a legal value to write. Typing something no suggestion
 * matches and pressing Enter registers it (`createTag`) and applies it in one
 * step, rather than requiring a detour through Settings first.
 */
export function TagInput({
  value,
  onValueChange,
  id,
}: {
  value: string[]
  onValueChange: (tags: string[]) => void
  id?: string
}) {
  const store = useInventoryStore()
  const anchor = useComboboxAnchor()
  const [input, setInput] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  // Recomputed every render (not memoized) so a tag created via Enter below
  // shows up in `registry` immediately — `store.tags` updates trigger this
  // component's own re-render.
  const registry = listTags(store).map((tag) => tag.name)

  // Prefix match, not substring: typing "back" is how you reach for a tag you
  // already know the start of, and substring matches would put `feedback` in
  // front of it.
  const suggestions = React.useMemo(() => {
    const needle = input.trim().toLowerCase()

    return registry
      .filter((tag) => !value.includes(tag) && tag.startsWith(needle))
      .slice(0, MAX_SUGGESTIONS)
  }, [registry, value, input])

  // Enter with no matching suggestion registers what's typed as a new tag
  // instead of doing nothing — the combobox itself only acts on a
  // highlighted item, and there isn't one when the list is empty.
  async function createFromInput(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" || suggestions.length > 0) {
      return
    }

    if (!input.trim()) {
      return
    }

    const problem = validateTagName(input, store.tags)

    if (problem) {
      setError(problem)
      return
    }

    const name = await createTag(store, input)
    onValueChange([...value, name])
    setInput("")
    setError(null)
  }

  return (
    <Field data-invalid={error ? true : undefined}>
      <Combobox
        multiple
        // Highlights the first suggestion, so Enter picks it without an Arrow Down.
        autoHighlight
        items={suggestions}
        // `suggestions` is already filtered and capped; filtering again would
        // fight it.
        filter={null}
        value={value}
        onValueChange={(next: string[]) => {
          onValueChange(next)
          // Clear the query after a pick, so the next tag starts from the top.
          setInput("")
        }}
        inputValue={input}
        onInputValueChange={(next: string) => {
          setInput(next)
          setError(null)
        }}
      >
        <ComboboxChips ref={anchor} className="w-full">
          <TagsIcon className="size-4 shrink-0 text-muted-foreground" />
          <ComboboxValue>
            {(tags: string[]) => (
              <React.Fragment>
                {tags.map((tag) => (
                  <ComboboxChip key={tag}>{tag}</ComboboxChip>
                ))}
                <ComboboxChipsInput
                  id={id}
                  placeholder={tags.length === 0 ? "Add a tag…" : ""}
                  aria-label="Tags"
                  aria-invalid={error ? true : undefined}
                  onKeyDown={createFromInput}
                />
              </React.Fragment>
            )}
          </ComboboxValue>
        </ComboboxChips>

        <ComboboxContent anchor={anchor}>
          <ComboboxEmpty>
            {registry.length === 0
              ? "No tags in the registry yet — press Enter to create one."
              : "No tag starts with that — press Enter to create it."}
          </ComboboxEmpty>
          <ComboboxList>
            {(tag: string) => (
              <ComboboxItem key={tag} value={tag}>
                {tag}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  )
}
