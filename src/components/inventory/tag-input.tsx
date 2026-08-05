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
import { listTags } from "@/mocks/tags"

/** Enough to pick from without turning the popup into a second list to read. */
const MAX_SUGGESTIONS = 5

/**
 * Tag picker for an item/line form field.
 *
 * Same interaction as `TagFilter`, but the suggestion pool is the *full*
 * registry rather than what's present on currently-matching rows — a form
 * field has no "currently matching rows" to narrow against, and every tag in
 * the registry is a legal value to write. No "create new tag" affordance: the
 * spec is explicit that this UI only ever offers registry names
 * (`02-inventory-data-model.md:424-427`).
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
  const anchor = useComboboxAnchor()
  const [input, setInput] = React.useState("")

  const registry = React.useMemo(() => listTags().map((tag) => tag.name), [])

  // Prefix match, not substring: typing "back" is how you reach for a tag you
  // already know the start of, and substring matches would put `feedback` in
  // front of it.
  const suggestions = React.useMemo(() => {
    const needle = input.trim().toLowerCase()

    return registry
      .filter((tag) => !value.includes(tag) && tag.startsWith(needle))
      .slice(0, MAX_SUGGESTIONS)
  }, [registry, value, input])

  return (
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
      onInputValueChange={setInput}
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
              />
            </React.Fragment>
          )}
        </ComboboxValue>
      </ComboboxChips>

      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>
          {registry.length === 0
            ? "No tags in the registry yet."
            : "No tag starts with that."}
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
  )
}
