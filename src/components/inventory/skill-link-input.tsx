import * as React from "react"
import { WrenchIcon } from "lucide-react"

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
import { Field } from "@/components/ui/field"
import { ItemDialog } from "@/components/inventory/item-dialog"
import { itemsOfKind } from "@/lib/inventory"
import { useInventoryStore } from "@/lib/inventory-store"

/** Enough to pick from without turning the popup into a second list to read. */
const MAX_SUGGESTIONS = 5

/**
 * Skill-link picker for a Work/Volunteer/Project entry's "skills used" field.
 *
 * Same `Combobox` + `ComboboxChips` interaction as `TagInput`, but the
 * suggestion pool is every real row in the Skills pool (`itemsOfKind(store,
 * "skill")`) rather than the tag registry — `value` holds skill *ids*, not
 * names, since this links to actual rows, not a flat string registry.
 *
 * Unlike `TagInput`, a skill link can't just register a name — it points at a
 * real row with its own fields. So instead of creating in place, Enter with
 * no match opens the full Skill `ItemDialog` (prefilled with what was typed
 * as the title); saving it there links the new skill here automatically.
 */
export function SkillLinkInput({
  value,
  onValueChange,
  id,
  excludeItemId,
}: {
  value: string[]
  onValueChange: (skillIds: string[]) => void
  id?: string
  excludeItemId?: string
}) {
  const store = useInventoryStore()
  const anchor = useComboboxAnchor()
  const [input, setInput] = React.useState("")
  const [createTitle, setCreateTitle] = React.useState<string | null>(null)

  const skills = itemsOfKind(store, "skill")

  // id -> title, for rendering chips/items from ids (the `Combobox`'s item
  // value type must match `value`'s element type, i.e. plain strings — same
  // as `TagInput` — so suggestions are ids, with titles resolved for display).
  const titleById = new Map(skills.map((skill) => [skill.id, skill.title]))

  // Prefix match, not substring — same reasoning as `TagInput`: typing a
  // known prefix should surface that skill first, not one that merely
  // contains the substring elsewhere.
  const suggestions = React.useMemo(() => {
    const needle = input.trim().toLowerCase()

    return skills
      .filter(
        (skill) =>
          !value.includes(skill.id) &&
          skill.id !== excludeItemId &&
          skill.title.toLowerCase().startsWith(needle)
      )
      .map((skill) => skill.id)
      .slice(0, MAX_SUGGESTIONS)
  }, [skills, value, input, excludeItemId])

  // Enter with no matching suggestion opens the Skill dialog prefilled with
  // what was typed — the combobox itself only acts on a highlighted item,
  // and there isn't one when the list is empty.
  function openCreateFromInput(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" || suggestions.length > 0) {
      return
    }

    if (!input.trim()) {
      return
    }

    setCreateTitle(input.trim())
  }

  return (
    <Field>
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
          // Clear the query after a pick, so the next search starts from the top.
          setInput("")
        }}
        inputValue={input}
        onInputValueChange={setInput}
      >
        <ComboboxChips ref={anchor} className="w-full">
          <WrenchIcon className="size-4 shrink-0 text-muted-foreground" />
          <ComboboxValue>
            {(skillIds: string[]) => (
              <React.Fragment>
                {skillIds.map((skillId) => (
                  <ComboboxChip key={skillId}>
                    {titleById.get(skillId) ?? skillId}
                  </ComboboxChip>
                ))}
                <ComboboxChipsInput
                  id={id}
                  placeholder={skillIds.length === 0 ? "Link a skill…" : ""}
                  aria-label="Skills used"
                  onKeyDown={openCreateFromInput}
                />
              </React.Fragment>
            )}
          </ComboboxValue>
        </ComboboxChips>

        <ComboboxContent anchor={anchor}>
          <ComboboxEmpty>
            {skills.length === 0
              ? "No skills in the Skills pool yet — press Enter to add one."
              : "No skill starts with that — press Enter to add it."}
          </ComboboxEmpty>
          <ComboboxList>
            {(skillId: string) => (
              <ComboboxItem key={skillId} value={skillId}>
                {titleById.get(skillId) ?? skillId}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>

      <ItemDialog
        kind="skill"
        mode="add"
        initialTitle={createTitle ?? undefined}
        open={createTitle !== null}
        onOpenChange={(next) => !next && setCreateTitle(null)}
        onSaved={(skill) => {
          onValueChange([...value, skill.id])
          setInput("")
          setCreateTitle(null)
        }}
      />
    </Field>
  )
}
