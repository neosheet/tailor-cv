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

/** Enough to pick from without turning the popup into a second list to read. */
const MAX_SUGGESTIONS = 5

/**
 * Narrow a pool to the entries carrying *all* of the chosen tags.
 *
 * AND, not OR, because that is what tags are for here: `backend` alone is a wide
 * net, `backend` + `leadership` is the handful of entries worth putting on one
 * CV. OR would only ever grow the result, which the search box already does.
 *
 * `available` is the caller's job and matters: it holds the tags on the rows
 * that currently match, so every suggestion returns at least one entry and no
 * choice is a dead end.
 */
export function TagFilter({
  value,
  onChange,
  available,
}: {
  value: string[]
  onChange: (tags: string[]) => void
  available: string[]
}) {
  const anchor = useComboboxAnchor()
  const [input, setInput] = React.useState("")

  // Prefix match, not substring: typing "back" is how you reach for a tag you
  // already know the start of, and substring matches would put `feedback` in
  // front of it.
  const suggestions = React.useMemo(() => {
    const needle = input.trim().toLowerCase()

    return available
      .filter((tag) => !value.includes(tag) && tag.startsWith(needle))
      .slice(0, MAX_SUGGESTIONS)
  }, [available, value, input])

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
        onChange(next)
        // Clear the query after a pick, so the next tag starts from the top.
        setInput("")
      }}
      inputValue={input}
      onInputValueChange={setInput}
    >
      <ComboboxChips
        ref={anchor}
        className="w-full min-w-56 flex-1 sm:w-auto sm:max-w-sm sm:flex-none"
      >
        <TagsIcon className="size-4 shrink-0 text-muted-foreground" />
        <ComboboxValue>
          {(tags: string[]) => (
            <React.Fragment>
              {tags.map((tag) => (
                <ComboboxChip key={tag}>{tag}</ComboboxChip>
              ))}
              <ComboboxChipsInput
                placeholder={tags.length === 0 ? "Filter by tag…" : ""}
                aria-label="Filter by tag"
              />
            </React.Fragment>
          )}
        </ComboboxValue>
      </ComboboxChips>

      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>
          {available.length === 0
            ? "Nothing here is tagged."
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
